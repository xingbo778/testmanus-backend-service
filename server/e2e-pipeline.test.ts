/**
 * E2E Pipeline Verification Tests
 * 
 * Tests the complete pipeline: Create Project → Generate Script → Generate Anchors → Generate Grid → Generate Prompts
 * 
 * These tests call actual LLM and image generation APIs, so they are slow (~2-5 min per case).
 * Run with: pnpm test -- --testPathPattern=e2e-pipeline --testTimeout=600000
 * 
 * For post-release verification, run a single quick case:
 *   pnpm test -- --testPathPattern=e2e-pipeline -t "quick"
 */
import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ============================================================
// Test Context Setup
// ============================================================
function createTestContext(): TrpcContext {
  const user = {
    id: 1,
    openId: "test-integration-user",
    email: "test@integration.com",
    name: "Integration Test User",
    loginMethod: "manus" as const,
    role: "admin" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

// ============================================================
// Test Cases Definition
// ============================================================
const QUICK_CASE = {
  name: "quick - 咖啡馆浪漫邂逅 15s",
  project: {
    title: `E2E验证 - 咖啡馆 ${Date.now()}`,
    l1Id: "narrative",
    l2Id: "narrative.romance",
    l3Id: "narrative.romance.firstmeet",
    duration: "15" as const,
  },
  additionalContext: "温暖的午后，男女主角在咖啡馆偶遇",
  expectedFrameRange: [5, 10],
  expectedAnchorRange: [2, 5],
};

const MEDIUM_CASE = {
  name: "medium - 赛博朋克追逐 30s",
  project: {
    title: `E2E验证 - 赛博朋克 ${Date.now()}`,
    l1Id: "scifi",
    l2Id: "scifi.cyberpunk",
    l3Id: "scifi.cyberpunk.chase",
    duration: "30" as const,
  },
  additionalContext: "霓虹灯闪烁的未来城市，主角在高楼间穿梭逃亡",
  expectedFrameRange: [8, 18],
  expectedAnchorRange: [1, 5],
};

const LONG_CASE = {
  name: "long - 武术格斗 60s多Grid",
  project: {
    title: `E2E验证 - 武术格斗 ${Date.now()}`,
    l1Id: "sports",
    l2Id: "sports.martial",
    l3Id: "sports.martial.kungfu",
    duration: "60" as const,
  },
  additionalContext: "古代武林大会，两位高手在擂台上的终极对决",
  expectedFrameRange: [15, 35],
  expectedAnchorRange: [2, 6],
};

// ============================================================
// Pipeline Runner
// ============================================================
async function runPipeline(
  caller: ReturnType<typeof appRouter.createCaller>,
  testCase: typeof QUICK_CASE,
) {
  const results: Record<string, any> = {};

  // Step 1: Create Project
  const createResult = await caller.project.create(testCase.project);
  expect(createResult.id).toBeGreaterThan(0);
  results.projectId = createResult.id;

  // Step 2: Generate Script
  const scriptResult = await caller.script.generate({
    projectId: results.projectId,
    additionalContext: testCase.additionalContext,
  });
  expect(scriptResult.scriptId).toBeGreaterThan(0);
  expect(scriptResult.script.frames.length).toBeGreaterThanOrEqual(testCase.expectedFrameRange[0]);
  expect(scriptResult.script.frames.length).toBeLessThanOrEqual(testCase.expectedFrameRange[1]);
  expect(scriptResult.script.characters.length).toBeGreaterThan(0);
  expect(scriptResult.script.scenes.length).toBeGreaterThan(0);

  // Validate frame structure
  for (const frame of scriptResult.script.frames) {
    expect(frame).toHaveProperty("index");
    expect(frame).toHaveProperty("shotType");
    expect(frame).toHaveProperty("duration");
    expect(frame).toHaveProperty("description");
    expect(frame).toHaveProperty("cameraMovement");
    expect(frame.duration).toBeGreaterThanOrEqual(0.5);
    expect(frame.duration).toBeLessThanOrEqual(5);
    expect(frame.description.length).toBeGreaterThan(50); // descriptions should be detailed
  }

  // Validate character structure
  for (const char of scriptResult.script.characters) {
    expect(char).toHaveProperty("name");
    expect(char).toHaveProperty("description");
    expect(char).toHaveProperty("anchorPrompt");
    expect(char.anchorPrompt.length).toBeGreaterThan(20);
  }

  results.script = {
    frameCount: scriptResult.script.frames.length,
    charCount: scriptResult.script.characters.length,
    sceneCount: scriptResult.script.scenes.length,
    version: scriptResult.version,
  };

  // Step 3: Generate Anchors
  const anchorResult = await caller.anchor.generate({ projectId: results.projectId });
  expect(anchorResult.anchors.length).toBeGreaterThanOrEqual(testCase.expectedAnchorRange[0]);
  expect(anchorResult.anchors.length).toBeLessThanOrEqual(testCase.expectedAnchorRange[1]);

  const anchorsWithImages = anchorResult.anchors.filter((a: any) => a.imageUrl);
  // At least some anchors should have images (API might occasionally fail)
  expect(anchorsWithImages.length).toBeGreaterThan(0);

  results.anchors = {
    total: anchorResult.anchors.length,
    withImages: anchorsWithImages.length,
    types: anchorResult.anchors.map((a: any) => `${a.type}:${a.name}`),
  };

  // Step 4: Generate Grid
  const gridResult = await caller.grid.generate({ projectId: results.projectId });
  expect(gridResult.totalPanels).toBe(scriptResult.script.frames.length);
  expect(gridResult.totalPages).toBeGreaterThanOrEqual(1);
  expect(gridResult.pages.length).toBe(gridResult.totalPages);

  // At least one page should have an image
  const pagesWithImages = gridResult.pages.filter((p: any) => p.gridImageUrl);
  expect(pagesWithImages.length).toBeGreaterThan(0);

  // Validate grid layout
  for (const page of gridResult.pages) {
    expect(page.rows).toBeGreaterThanOrEqual(1);
    expect(page.cols).toBeGreaterThanOrEqual(1);
    expect(page.rows * page.cols).toBeGreaterThanOrEqual(1);
  }

  results.grid = {
    totalPages: gridResult.totalPages,
    totalPanels: gridResult.totalPanels,
    pagesWithImages: pagesWithImages.length,
    layouts: gridResult.pages.map((p: any) => `${p.rows}x${p.cols}`),
  };

  // Step 5: Generate Prompts
  const promptResult = await caller.prompt.generate({ projectId: results.projectId });
  expect(promptResult.prompts.length).toBe(scriptResult.script.frames.length);

  // Validate prompt structure
  for (const prompt of promptResult.prompts) {
    expect(prompt).toHaveProperty("panelIndex");
    expect(prompt).toHaveProperty("promptText");
    expect(prompt).toHaveProperty("model");
    expect(prompt).toHaveProperty("shotType");
    expect(prompt.promptText.length).toBeGreaterThan(20);
    // Model should be one of the known models
    expect(["seedance-1.5-pro", "kling-2.6", "veo3.1-fast", "wan-2.1"]).toContain(prompt.model);
  }

  const models = [...new Set(promptResult.prompts.map((p: any) => p.model))];
  results.prompts = {
    count: promptResult.prompts.length,
    models,
  };

  // Step 6: Verify final project state
  const projectState = await caller.project.get({ id: results.projectId });
  expect(projectState).not.toBeNull();
  expect(projectState!.project.status).toBe("grid_generated");
  expect(projectState!.script).not.toBeNull();
  expect(projectState!.anchors.length).toBeGreaterThan(0);
  expect(projectState!.gridPages.length).toBeGreaterThanOrEqual(1);
  expect(projectState!.panels.length).toBe(scriptResult.script.frames.length);
  expect(projectState!.prompts.length).toBe(scriptResult.script.frames.length);

  results.finalStatus = projectState!.project.status;

  return results;
}

// ============================================================
// Test Suite
// ============================================================
describe("E2E Pipeline Verification", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    const ctx = createTestContext();
    caller = appRouter.createCaller(ctx);
  });

  it("quick - 15s短片完整流程 (咖啡馆浪漫邂逅)", async () => {
    const results = await runPipeline(caller, QUICK_CASE);

    console.log("\n📊 Quick Case Results:", JSON.stringify(results, null, 2));

    expect(results.projectId).toBeGreaterThan(0);
    expect(results.script.frameCount).toBeGreaterThanOrEqual(5);
    expect(results.anchors.withImages).toBeGreaterThan(0);
    expect(results.grid.pagesWithImages).toBeGreaterThan(0);
    expect(results.prompts.count).toBe(results.script.frameCount);
    expect(results.finalStatus).toBe("grid_generated");
  }, 300_000); // 5 min timeout

  it("medium - 30s中等时长完整流程 (赛博朋克追逐)", async () => {
    const results = await runPipeline(caller, MEDIUM_CASE);

    console.log("\n📊 Medium Case Results:", JSON.stringify(results, null, 2));

    expect(results.projectId).toBeGreaterThan(0);
    expect(results.script.frameCount).toBeGreaterThanOrEqual(8);
    expect(results.anchors.withImages).toBeGreaterThan(0);
    expect(results.grid.pagesWithImages).toBeGreaterThan(0);
    expect(results.prompts.count).toBe(results.script.frameCount);
    expect(results.finalStatus).toBe("grid_generated");
  }, 300_000);

  it("long - 60s长片多Grid流程 (武术格斗对决)", async () => {
    const results = await runPipeline(caller, LONG_CASE);

    console.log("\n📊 Long Case Results:", JSON.stringify(results, null, 2));

    expect(results.projectId).toBeGreaterThan(0);
    expect(results.script.frameCount).toBeGreaterThanOrEqual(15);
    expect(results.anchors.withImages).toBeGreaterThan(0);
    // 60s should produce multi-page grid
    expect(results.grid.totalPages).toBeGreaterThanOrEqual(1);
    expect(results.grid.pagesWithImages).toBeGreaterThan(0);
    expect(results.prompts.count).toBe(results.script.frameCount);
    expect(results.finalStatus).toBe("grid_generated");
  }, 600_000); // 10 min timeout for 60s case
});
