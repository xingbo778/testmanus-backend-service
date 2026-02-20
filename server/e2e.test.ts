import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ============================================================
// Mock Setup - vi.hoisted() ensures these are available before vi.mock
// ============================================================

const { mockScript, mockProject, mockAnchor, mockGrid, mockPanel, mockPrompt, mockVideoClip, mockExperience, mockLibraryItem, mockSystemPrompt, mockRuleChapter, mockFinalVideo } = vi.hoisted(() => {
  const mockScript = {
    id: 100,
    projectId: 1,
    version: 1,
    frames: [
      { index: 1, shotType: "全景", duration: 2, description: "开场全景", cameraMovement: "推镜头", notes: "" },
      { index: 2, shotType: "中景", duration: 3, description: "角色出场", cameraMovement: "跟拍", notes: "" },
      { index: 3, shotType: "特写", duration: 2, description: "角色表情", cameraMovement: "固定", notes: "" },
    ],
    characters: [{ name: "主角", description: "年轻女性", anchorPrompt: "A young woman" }],
    scenes: [{ name: "城市街道", description: "现代都市", anchorPrompt: "A modern city street" }],
    props: [],
    generationPrompt: "test prompt",
    rulesUsed: [],
    createdAt: new Date(),
  };

  const mockProject = {
    id: 1,
    title: "测试项目",
    l1Id: "narrative",
    l2Id: "narrative.chase",
    l3Id: "narrative.chase.friend",
    duration: "15",
    status: "scripted",
    currentVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAnchor = {
    id: 1,
    projectId: 1,
    version: 1,
    anchorType: "character",
    name: "主角",
    description: "年轻女性",
    prompt: "A young woman portrait",
    imageUrl: "https://example.com/anchor.png",
    createdAt: new Date(),
  };

  const mockGrid = {
    id: 1,
    projectId: 1,
    version: 1,
    rows: 2,
    cols: 2,
    totalPanels: 3,
    gridImageUrl: "https://example.com/grid.png",
    pageIndex: 0,
    pageLabel: "Page 1/1",
    createdAt: new Date(),
  };

  const mockPanel = {
    id: 1,
    projectId: 1,
    version: 1,
    gridId: 1,
    panelIndex: 1,
    shotType: "全景",
    duration: 2,
    description: "开场全景",
    panelImageUrl: "https://example.com/panel1.png",
    status: "extracted",
    fixHistory: [],
    referenceImageUrls: [],
    issueDescription: null,
    createdAt: new Date(),
  };

  const mockPrompt = {
    id: 1,
    panelId: 1,
    projectId: 1,
    version: 1,
    promptText: "A wide establishing shot of a city street",
    negativePrompt: "blurry, low quality",
    model: "seedance-1.5-pro",
    controlStrategy: "first_frame",
    shotType: "WS",
    cameraAngle: "eye level",
    subject: "city street",
    action: "establishing",
    cameraMovement: "push in",
    lighting: "natural daylight",
    texture: "photorealistic",
    effects: "none",
    transition: "cut",
    createdAt: new Date(),
  };

  const mockVideoClip = {
    id: 1,
    projectId: 1,
    version: 1,
    panelIndex: 1,
    promptId: 1,
    taskId: "task-123",
    status: "completed",
    clipUrl: "https://example.com/clip1.mp4",
    model: "seedance-1.5-pro",
    errorMessage: null,
    createdAt: new Date(),
  };

  const mockExperience = {
    id: 1,
    projectId: 1,
    categoryId: "narrative.chase.friend",
    actionType: "panel_fix",
    panelIndex: 1,
    originalContent: { description: "test" },
    issueDescription: "test issue",
    fixDescription: "test fix",
    createdAt: new Date(),
  };

  const mockLibraryItem = {
    id: 1,
    name: "Luna",
    anchorType: "character",
    description: "赛博朋克女黑客",
    prompt: "A cyberpunk female hacker",
    imageUrl: "https://example.com/luna.png",
    style: "cyberpunk",
    tags: JSON.stringify(["赛博朋克", "女性角色"]),
    usageCount: 0,
    createdBy: 1,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSystemPrompt = {
    id: 1,
    key: "script_gen",
    name: "Script Generation",
    description: "System prompt for script generation",
    category: "script",
    content: "You are a professional storyboard designer.",
    contentZh: "你是一个专业的分镜脚本设计师。",
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRuleChapter = {
    id: 1,
    chapterNumber: 1,
    title: "通用基础规则",
    category: "universal",
    applicableL2Ids: null,
    rules: [{ type: "composition", text: "Rule 1: 前3秒必须有强钩子", severity: "critical" }],
    ruleCount: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockFinalVideo = {
    id: 1,
    projectId: 1,
    version: 1,
    videoUrl: "https://example.com/final.mp4",
    clipCount: 3,
    totalDuration: "7",
    status: "completed",
    createdAt: new Date(),
  };

  return { mockScript, mockProject, mockAnchor, mockGrid, mockPanel, mockPrompt, mockVideoClip, mockExperience, mockLibraryItem, mockSystemPrompt, mockRuleChapter, mockFinalVideo };
});

// ============================================================
// Mock all external dependencies
// ============================================================

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  }),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  // Category
  getCategoryTree: vi.fn().mockResolvedValue([
    { id: 1, categoryId: "narrative", name: "叙事剧情", level: 1, parentId: null, description: "叙事类短视频", sortOrder: 1, templateRef: null, createdAt: new Date() },
    { id: 2, categoryId: "narrative.chase", name: "追逐戏", level: 2, parentId: "narrative", description: "追逐场景", sortOrder: 1, templateRef: null, createdAt: new Date() },
  ]),
  seedCategories: vi.fn().mockResolvedValue(undefined),
  createCategory: vi.fn().mockResolvedValue(1),
  updateCategory: vi.fn().mockResolvedValue(undefined),
  deleteCategory: vi.fn().mockResolvedValue(undefined),
  // Rules
  seedRuleChapters: vi.fn().mockResolvedValue(undefined),
  getRuleChapters: vi.fn().mockResolvedValue([mockRuleChapter]),
  getRulesForScene: vi.fn().mockResolvedValue([mockRuleChapter]),
  getUserRules: vi.fn().mockResolvedValue([]),
  saveUserRule: vi.fn().mockResolvedValue(undefined),
  updateUserRule: vi.fn().mockResolvedValue(undefined),
  clearAllRuleChapters: vi.fn().mockResolvedValue(undefined),
  createRuleChapter: vi.fn().mockResolvedValue(1),
  updateRuleChapter: vi.fn().mockResolvedValue(undefined),
  deleteRuleChapter: vi.fn().mockResolvedValue(undefined),
  getRuleChapterById: vi.fn().mockResolvedValue(mockRuleChapter),
  getRuleChapterByNumber: vi.fn().mockResolvedValue(mockRuleChapter),
  importRuleChapter: vi.fn().mockResolvedValue(1),
  // Project
  createProject: vi.fn().mockResolvedValue({ id: 1 }),
  listProjects: vi.fn().mockResolvedValue([mockProject]),
  getProjectById: vi.fn().mockResolvedValue(mockProject),
  updateProject: vi.fn().mockResolvedValue(undefined),
  deleteProject: vi.fn().mockResolvedValue(undefined),
  // Script
  saveScript: vi.fn().mockResolvedValue(100),
  getLatestScript: vi.fn().mockResolvedValue(mockScript),
  getScriptByVersion: vi.fn().mockResolvedValue(mockScript),
  getScriptVersions: vi.fn().mockResolvedValue([{ version: 1, createdAt: new Date() }]),
  updateScriptFrames: vi.fn().mockResolvedValue(undefined),
  updateScriptCharacters: vi.fn().mockResolvedValue(undefined),
  updateScriptScenes: vi.fn().mockResolvedValue(undefined),
  // Anchor
  saveAnchor: vi.fn().mockResolvedValue(1),
  getAnchors: vi.fn().mockResolvedValue([mockAnchor]),
  getAnchorById: vi.fn().mockResolvedValue(mockAnchor),
  updateAnchor: vi.fn().mockResolvedValue(undefined),
  deleteAnchorsForProject: vi.fn().mockResolvedValue(undefined),
  // Grid
  saveGrid: vi.fn().mockResolvedValue(1),
  getLatestGrid: vi.fn().mockResolvedValue(mockGrid),
  getGridPages: vi.fn().mockResolvedValue([mockGrid]),
  getGridVersions: vi.fn().mockResolvedValue([{ version: 1, createdAt: new Date() }]),
  deleteGridsForProject: vi.fn().mockResolvedValue(undefined),
  // Panel
  savePanels: vi.fn().mockResolvedValue(undefined),
  getPanels: vi.fn().mockResolvedValue([mockPanel]),
  updatePanel: vi.fn().mockResolvedValue(undefined),
  deletePanelsForProject: vi.fn().mockResolvedValue(undefined),
  // Prompt
  savePrompts: vi.fn().mockResolvedValue(undefined),
  getPrompts: vi.fn().mockResolvedValue([mockPrompt]),
  updatePrompt: vi.fn().mockResolvedValue(undefined),
  getPromptVersions: vi.fn().mockResolvedValue([{ version: 1, createdAt: new Date() }]),
  deletePromptsForProject: vi.fn().mockResolvedValue(undefined),
  // Video
  createVideoClip: vi.fn().mockResolvedValue(1),
  getVideoClips: vi.fn().mockResolvedValue([mockVideoClip]),
  getVideoClipByTaskId: vi.fn().mockResolvedValue(mockVideoClip),
  updateVideoClip: vi.fn().mockResolvedValue(undefined),
  deleteFailedClips: vi.fn().mockResolvedValue(3),
  deleteAllClips: vi.fn().mockResolvedValue(5),
  createFinalVideo: vi.fn().mockResolvedValue(1),
  updateFinalVideo: vi.fn().mockResolvedValue(undefined),
  getFinalVideos: vi.fn().mockResolvedValue([mockFinalVideo]),
  // Experience
  saveExperienceRecord: vi.fn().mockResolvedValue({ id: 1 }),
  getExperienceRecords: vi.fn().mockResolvedValue([mockExperience]),
  getExperienceSummary: vi.fn().mockResolvedValue({ total: 5, byCategory: [], byActionType: [{ actionType: "panel_fix", count: 3 }] }),
  // Export
  createExportRecord: vi.fn().mockResolvedValue(1),
  updateExportRecord: vi.fn().mockResolvedValue(undefined),
  getExportRecords: vi.fn().mockResolvedValue([]),
  getConfirmedProjects: vi.fn().mockResolvedValue([]),
  // Reference
  saveReference: vi.fn().mockResolvedValue(undefined),
  getReferences: vi.fn().mockResolvedValue([]),
  // Version
  rollbackToVersion: vi.fn().mockResolvedValue({ success: true }),
  // System Prompt
  listSystemPrompts: vi.fn().mockResolvedValue([mockSystemPrompt]),
  getSystemPrompt: vi.fn().mockResolvedValue(mockSystemPrompt),
  upsertSystemPrompt: vi.fn().mockResolvedValue(1),
  updateSystemPromptContent: vi.fn().mockResolvedValue(undefined),
  updateSystemPromptTranslation: vi.fn().mockResolvedValue(undefined),
  deleteSystemPrompt: vi.fn().mockResolvedValue(undefined),
  seedSystemPrompts: vi.fn().mockResolvedValue(undefined),
  // App Log
  getAppLogs: vi.fn().mockResolvedValue([]),
  clearAppLogs: vi.fn().mockResolvedValue(undefined),
  // Anchor Library
  createAnchorLibraryItem: vi.fn().mockResolvedValue(1),
  listAnchorLibrary: vi.fn().mockResolvedValue({ items: [mockLibraryItem], total: 1 }),
  getAnchorLibraryItem: vi.fn().mockResolvedValue(mockLibraryItem),
  updateAnchorLibraryItem: vi.fn().mockResolvedValue(undefined),
  deleteAnchorLibraryItem: vi.fn().mockResolvedValue(undefined),
  saveProjectAnchorToLibrary: vi.fn().mockResolvedValue(1),
  importLibraryAnchorToProject: vi.fn().mockResolvedValue(1),
  incrementAnchorLibraryUsage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          frames: [
            { index: 1, shotType: "全景", duration: 2, description: "开场全景", cameraMovement: "推镜头", notes: "" },
            { index: 2, shotType: "中景", duration: 3, description: "角色出场", cameraMovement: "跟拍", notes: "" },
          ],
          characters: [{ name: "主角", description: "年轻女性", anchorPrompt: "A young woman" }],
          scenes: [{ name: "城市街道", description: "现代都市", anchorPrompt: "A modern city street" }],
          props: [],
        })
      }
    }]
  }),
}));

vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn().mockResolvedValue({ url: "https://example.com/generated.png" }),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/file.jsonl", key: "file.jsonl" }),
}));

vi.mock("./uploadHelper", () => ({
  uploadFile: vi.fn().mockResolvedValue("https://s3.example.com/panel.png"),
}));

vi.mock("./gridTemplate", () => ({
  generateGridTemplateDataUrl: vi.fn().mockResolvedValue("data:image/png;base64,mock"),
}));

vi.mock("./panelExtractor", () => ({
  extractPanel: vi.fn().mockResolvedValue(Buffer.from("mock-panel")),
  extractAllPanels: vi.fn().mockResolvedValue([
    { panelIndex: 1, buffer: Buffer.from("mock-panel-1") },
    { panelIndex: 2, buffer: Buffer.from("mock-panel-2") },
    { panelIndex: 3, buffer: Buffer.from("mock-panel-3") },
  ]),
}));

vi.mock("./gridUtils", () => ({
  generateAllGridPages: vi.fn().mockResolvedValue([{
    pageIndex: 0,
    gridId: 1,
    gridImageUrl: "https://example.com/grid.png",
    rows: 2,
    cols: 2,
    panelCount: 3,
  }]),
  splitFramesIntoPages: vi.fn().mockReturnValue([{
    pageIndex: 0,
    pageLabel: "Page 1/1",
    frames: [
      { index: 1, shotType: "全景", duration: 2, description: "开场全景", cameraMovement: "推镜头" },
      { index: 2, shotType: "中景", duration: 3, description: "角色出场", cameraMovement: "跟拍" },
    ],
  }]),
}));

vi.mock("./appLogger", () => ({
  logInfo: vi.fn().mockResolvedValue(undefined),
  logError: vi.fn().mockResolvedValue(undefined),
  logWarn: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./videoMerger", () => ({
  mergeVideoClips: vi.fn().mockResolvedValue({
    finalVideoUrl: "https://example.com/final.mp4",
    totalDuration: 7,
    clipCount: 3,
  }),
}));

// ============================================================
// Context Helpers
// ============================================================

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {}, secure: true } as any,
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "normal-user",
    email: "user@example.com",
    name: "User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {}, secure: true } as any,
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {}, secure: true } as any,
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ============================================================
// Tests
// ============================================================

describe("Auth Router", () => {
  it("auth.me returns user when authenticated", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.name).toBe("User");
    expect(result?.role).toBe("user");
  });

  it("auth.me returns null when not authenticated", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("auth.logout clears cookies", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(ctx.res.clearCookie).toHaveBeenCalled();
  });

  it("auth.apiKeyLogin rejects invalid key", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.auth.apiKeyLogin({ apiKey: "wrong-key" })).rejects.toThrow("Invalid API Key");
  });
});

describe("Category Management Router", () => {
  it("categoryManage.create requires admin", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.categoryManage.create({
      level: "1",
      categoryId: "test",
      name: "Test",
    })).rejects.toThrow();
  });

  it("categoryManage.create works for admin", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.categoryManage.create({
      level: "1",
      id: "test",
      name: "测试分类",
    });
    expect(result).toHaveProperty("success", true);
  });

  it("categoryManage.update works for admin", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.categoryManage.update({
      level: "1",
      id: "narrative",
      name: "Updated Name",
    });
    expect(result).toHaveProperty("success", true);
  });

  it("categoryManage.delete works for admin", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.categoryManage.delete({ level: "1", id: "narrative" });
    expect(result).toHaveProperty("success", true);
  });
});

describe("Rule Management Router", () => {
  it("rule.clearAll requires admin", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.rule.clearAll()).rejects.toThrow();
  });

  it("rule.clearAll works for admin", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.rule.clearAll();
    expect(result).toHaveProperty("success", true);
  });

  it("rule.createChapter creates a new chapter", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.rule.createChapter({
      chapterNumber: 10,
      title: "New Chapter",
      category: "universal",
      rules: [{ type: "composition", text: "Test rule", severity: "warning" }],
    });
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("id");
  });

  it("rule.updateChapter updates chapter", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.rule.updateChapter({
      chapterId: 1,
      title: "Updated Title",
    });
    expect(result).toHaveProperty("success", true);
  });

  it("rule.deleteChapter deletes chapter", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.rule.deleteChapter({ chapterId: 1 });
    expect(result).toHaveProperty("success", true);
  });

  it("rule.addRule adds a rule to chapter", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.rule.addRule({
      chapterId: 1,
      rule: { type: "composition", text: "New rule", severity: "info" },
    });
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("ruleCount");
  });

  it("rule.updateRule updates a rule in chapter", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.rule.updateRule({
      chapterId: 1,
      ruleIndex: 0,
      rule: { text: "Updated rule text" },
    });
    expect(result).toHaveProperty("success", true);
  });

  it("rule.deleteRule deletes a rule from chapter", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.rule.deleteRule({
      chapterId: 1,
      ruleIndex: 0,
    });
    expect(result).toHaveProperty("success", true);
  });

  it("rule.approveRule requires admin", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.rule.approveRule({ ruleId: 1 })).rejects.toThrow();
  });

  it("rule.approveRule works for admin", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.rule.approveRule({ ruleId: 1 });
    expect(result).toHaveProperty("success", true);
  });

  it("rule.rejectRule works for admin", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.rule.rejectRule({ ruleId: 1 });
    expect(result).toHaveProperty("success", true);
  });
});

describe("Project Router", () => {
  it("project.create requires auth", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.project.create({
      title: "Test",
      l1Id: "narrative",
      l2Id: "narrative.chase",
      l3Id: "narrative.chase.friend",
      duration: "15",
    })).rejects.toThrow();
  });

  it("project.create works for authenticated user", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.project.create({
      title: "测试项目",
      l1Id: "narrative",
      l2Id: "narrative.chase",
      l3Id: "narrative.chase.friend",
      duration: "15",
    });
    expect(result).toHaveProperty("id");
  });

  it("project.list returns projects", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.project.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("project.get returns project with details", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.project.get({ id: 1 });
    expect(result).not.toBeNull();
    expect(result?.project).toHaveProperty("title");
  });

  it("project.update requires auth", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.project.update({ id: 1, title: "New Title" })).rejects.toThrow();
  });

  it("project.update works for authenticated user", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.project.update({ id: 1, title: "New Title" });
    expect(result).toHaveProperty("success", true);
  });

  it("project.delete requires auth", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.project.delete({ id: 1 })).rejects.toThrow();
  });

  it("project.delete works for authenticated user", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.project.delete({ id: 1 });
    expect(result).toHaveProperty("success", true);
  });
});

describe("Script Router", () => {
  it("script.get returns latest script", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.script.get({ projectId: 1 });
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("frames");
  });

  it("script.validate validates script", async () => {
    const llmMod = await import("./_core/llm") as any;
    llmMod.invokeLLM.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            passed: true,
            violations: [],
            totalDurationCheck: { expected: 15, actual: 7, passed: false },
            hookCheck: { passed: true, description: "前3秒有强钩子" },
          }),
        },
      }],
    });
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.script.validate({ projectId: 1 });
    expect(result).toHaveProperty("passed");
    expect(result).toHaveProperty("violations");
  });

  it("script.generate requires auth", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.script.generate({ projectId: 1 })).rejects.toThrow();
  });

  it("script.generate creates script with LLM", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.script.generate({ projectId: 1 });
    expect(result).toHaveProperty("scriptId");
    expect(result).toHaveProperty("script");
    expect(result.script).toHaveProperty("frames");
    expect(result.script).toHaveProperty("characters");
  });

  it("script.updateFrame modifies a frame", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.script.updateFrame({
      projectId: 1,
      frameIndex: 1,
      data: { description: "Updated description" },
    });
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("frame");
  });

  it("script.addFrame inserts a new frame", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.script.addFrame({
      projectId: 1,
      afterIndex: 1,
      frame: {
        shotType: "特写",
        duration: 2,
        description: "New frame",
        cameraMovement: "固定",
      },
    });
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("totalFrames");
    expect(result.totalFrames).toBe(4); // 3 original + 1 new
  });

  it("script.removeFrame removes a frame", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.script.removeFrame({
      projectId: 1,
      frameIndex: 2,
    });
    expect(result).toHaveProperty("success", true);
    expect(result.totalFrames).toBe(result.frames.length); // frames array should match totalFrames
  });

  it("script.updateFrame throws for non-existent frame", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.script.updateFrame({
      projectId: 1,
      frameIndex: 999,
      data: { description: "test" },
    })).rejects.toThrow("Frame 999 not found");
  });
});

describe("Anchor Router", () => {
  it("anchor.list returns anchors", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.anchor.list({ projectId: 1 });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("anchor.generate requires auth", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.anchor.generate({ projectId: 1 })).rejects.toThrow();
  });

  it("anchor.generate creates anchors from script", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.anchor.generate({ projectId: 1 });
    expect(result).toHaveProperty("anchors");
    expect(Array.isArray(result.anchors)).toBe(true);
  });

  it("anchor.importFromLibrary imports library anchors", async () => {
    const db = await import("./db");
    const dbMock = db as any;
    dbMock.getDb.mockResolvedValueOnce({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockLibraryItem]),
        }),
      }),
    });
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.anchor.importFromLibrary({
      projectId: 1,
      libraryItemIds: [1],
    });
    expect(result).toHaveProperty("imported");
    expect(Array.isArray(result.imported)).toBe(true);
  });

  it("anchor.exportToLibrary exports anchor to library", async () => {
    const db = await import("./db");
    const dbMock = db as any;
    dbMock.getDb.mockResolvedValueOnce({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockAnchor]),
          }),
        }),
      }),
    });
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.anchor.exportToLibrary({
      anchorId: 1,
      style: "写实",
      tags: ["武侠", "角色"],
    });
    expect(result).toHaveProperty("libraryItemId");
  });
});

describe("Grid Router", () => {
  it("grid.get returns grid pages", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.grid.get({ projectId: 1 });
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("pages");
    expect(result).toHaveProperty("totalPages");
  });

  it("grid.generate requires auth", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.grid.generate({ projectId: 1 })).rejects.toThrow();
  });

  it("grid.generate creates grid from script", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.grid.generate({ projectId: 1 });
    expect(result).toHaveProperty("gridId");
    expect(result).toHaveProperty("totalPanels");
    expect(result).toHaveProperty("pages");
  });
});

describe("Panel Router", () => {
  it("panel.list returns panels", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.panel.list({ projectId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("panel.extractAll requires auth", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.panel.extractAll({ projectId: 1 })).rejects.toThrow();
  });

  it("panel.extractAll extracts panels from grid", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.panel.extractAll({ projectId: 1 });
    expect(result).toHaveProperty("panels");
    expect(Array.isArray(result.panels)).toBe(true);
    expect(result.panels.length).toBeGreaterThan(0);
  });

  it("panel.flag marks panel for review", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.panel.flag({
      panelId: 1,
      issueDescription: "Character face inconsistent",
    });
    expect(result).toHaveProperty("success", true);
  });

  it("panel.updatePrompt updates prompt text", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.panel.updatePrompt({
      promptId: 1,
      promptText: "Updated prompt text",
    });
    expect(result).toHaveProperty("success", true);
  });
});

describe("Prompt Router", () => {
  it("prompt.list returns prompts", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.prompt.list({ projectId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("prompt.generate requires auth", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.prompt.generate({ projectId: 1 })).rejects.toThrow();
  });

  it("prompt.generate creates prompts from script", async () => {
    // Mock LLM to return prompt-specific response
    const llm = await import("./_core/llm");
    const llmMock = llm as any;
    llmMock.invokeLLM.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            prompts: [{
              panelIndex: 1,
              promptText: "A wide shot of city street",
              negativePrompt: "blurry",
              model: "seedance-1.5-pro",
              controlStrategy: "first_frame",
              shotType: "WS",
              cameraAngle: "eye level",
              subject: "city",
              action: "establishing",
              cameraMovement: "push in",
              lighting: "natural",
              texture: "photorealistic",
              effects: "none",
              transition: "cut",
            }],
          }),
        },
      }],
    });
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.prompt.generate({ projectId: 1 });
    expect(result).toHaveProperty("prompts");
    expect(Array.isArray(result.prompts)).toBe(true);
  });
});

describe("Video Router", () => {
  it("video.clips returns video clips", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.video.clips({ projectId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("video.finalVideos returns final videos", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.video.finalVideos({ projectId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("video.clearFailedClips removes failed clips", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.video.clearFailedClips({ projectId: 1 });
    expect(result).toHaveProperty("deleted");
  });

  it("video.clearAllClips removes all clips", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.video.clearAllClips({ projectId: 1 });
    expect(result).toHaveProperty("deleted");
  });
});

describe("Version Router", () => {
  it("version.history returns version history", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.version.history({ projectId: 1 });
    expect(result).toHaveProperty("scriptVersions");
    expect(result).toHaveProperty("gridVersions");
    expect(result).toHaveProperty("promptVersions");
  });

  it("version.rollback requires auth", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.version.rollback({ projectId: 1, targetVersion: 1 })).rejects.toThrow();
  });

  it("version.rollback works for authenticated user", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.version.rollback({ projectId: 1, targetVersion: 1 });
    expect(result).toHaveProperty("success", true);
  });
});

describe("Experience Router", () => {
  it("experience.list returns records", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.experience.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("experience.list with filters", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.experience.list({ categoryId: "narrative.chase", actionType: "panel_fix" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("experience.summary returns aggregated data", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.experience.summary();
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("byActionType");
  });
});

describe("Export Router", () => {
  it("export.list returns export records", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.export.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("export.create requires admin", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.export.create({ exportType: "full" })).rejects.toThrow();
  });

  it("export.create works for admin - full export", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.export.create({ exportType: "full" });
    expect(result).toHaveProperty("exportId");
    expect(result).toHaveProperty("fileUrl");
    expect(result).toHaveProperty("recordCount");
  });

  it("export.create works for admin - rules export", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.export.create({ exportType: "rules" });
    expect(result).toHaveProperty("exportId");
  });
});

describe("System Prompt Router", () => {
  it("systemPrompt.list requires auth", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.systemPrompt.list()).rejects.toThrow();
  });

  it("systemPrompt.list returns prompts", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.systemPrompt.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("systemPrompt.get returns specific prompt", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.systemPrompt.get({ key: "script_gen" });
    expect(result).toHaveProperty("key", "script_gen");
    expect(result).toHaveProperty("content");
  });

  it("systemPrompt.upsert requires admin", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.systemPrompt.upsert({
      key: "test",
      name: "Test",
      category: "script",
      content: "Test content",
    })).rejects.toThrow();
  });

  it("systemPrompt.upsert works for admin", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.systemPrompt.upsert({
      key: "test_prompt",
      name: "Test Prompt",
      category: "script",
      content: "You are a test assistant.",
    });
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("key", "test_prompt");
  });

  it("systemPrompt.updateContent works for admin", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.systemPrompt.updateContent({
      key: "script_gen",
      content: "Updated content",
    });
    expect(result).toHaveProperty("success", true);
  });

  it("systemPrompt.delete works for admin", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.systemPrompt.delete({ key: "test_prompt" });
    expect(result).toHaveProperty("success", true);
  });

  it("systemPrompt.seed works for admin", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.systemPrompt.seed();
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("count");
  });
});

describe("App Log Router", () => {
  it("appLog.list requires auth", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.appLog.list({})).rejects.toThrow();
  });

  it("appLog.list returns logs", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.appLog.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("appLog.list with filters", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.appLog.list({
      limit: 10,
      offset: 0,
      level: "error",
      source: "video_gen",
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("appLog.clear requires admin", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.appLog.clear({})).rejects.toThrow();
  });

  it("appLog.clear works for admin", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.appLog.clear({});
    expect(result).toHaveProperty("success", true);
  });
});

describe("Prompt Template Router", () => {
  it("promptTemplate.list returns template list", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.promptTemplate.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("name");
    expect(result[0]).toHaveProperty("category");
  });

  it("promptTemplate.get returns specific template", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.promptTemplate.get({ templateId: "script_system" });
    expect(result).toHaveProperty("templateId", "script_system");
    expect(result).toHaveProperty("content");
    expect(result.content).toContain("分镜脚本");
  });

  it("promptTemplate.get returns fallback for unknown template", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.promptTemplate.get({ templateId: "nonexistent" });
    expect(result.content).toBe("Template not found");
  });

  it("promptTemplate.translate requires auth", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.promptTemplate.translate({ text: "Hello" })).rejects.toThrow();
  });
});

describe("Anchor Library Router", () => {
  it("anchorLib.list requires auth", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.anchorLib.list({})).rejects.toThrow();
  });

  it("anchorLib.list returns library items", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.anchorLib.list({});
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.items)).toBe(true);
  });

  it("anchorLib.list with filters", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.anchorLib.list({
      anchorType: "character",
      style: "cyberpunk",
      search: "Luna",
      limit: 20,
      offset: 0,
    });
    expect(result).toHaveProperty("items");
  });

  it("anchorLib.get returns specific item", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.anchorLib.get({ id: 1 });
    expect(result).toHaveProperty("name", "Luna");
    expect(result).toHaveProperty("anchorType", "character");
  });

  it("anchorLib.create creates new library item", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.anchorLib.create({
      name: "Shadow Fox",
      anchorType: "character",
      description: "忍者角色",
      prompt: "A ninja character",
      style: "anime",
      tags: ["忍者", "动漫"],
    });
    expect(result).toHaveProperty("id");
  });

  it("anchorLib.createWithImage creates item with generated image", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.anchorLib.createWithImage({
      name: "Shadow Fox",
      anchorType: "character",
      description: "忍者角色",
      prompt: "A ninja character",
      style: "anime",
      tags: ["忍者", "动漫"],
    });
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("imageUrl");
  });

  it("anchorLib.update modifies library item", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.anchorLib.update({
      id: 1,
      name: "Luna Updated",
      description: "Updated description",
    });
    expect(result).toHaveProperty("success", true);
  });

  it("anchorLib.regenerateImage generates new image", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.anchorLib.regenerateImage({ id: 1 });
    expect(result).toHaveProperty("imageUrl");
    expect(result).toHaveProperty("prompt");
  });

  it("anchorLib.delete removes library item", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.anchorLib.delete({ id: 1 });
    expect(result).toHaveProperty("success", true);
  });

  it("anchorLib.saveFromProject saves project anchor to library", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.anchorLib.saveFromProject({
      anchorId: 1,
      style: "写实",
      tags: ["武侠"],
    });
    expect(result).toHaveProperty("id");
  });

  it("anchorLib.importToProject imports library item to project", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.anchorLib.importToProject({
      libraryItemId: 1,
      projectId: 1,
    });
    expect(result).toHaveProperty("anchorId");
  });
});

describe("Util Router", () => {
  it("util.proxyImage requires auth", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.util.proxyImage({ url: "https://example.com/img.png" })).rejects.toThrow();
  });

  it("util.proxyImages requires auth", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.util.proxyImages({ urls: ["https://example.com/img.png"] })).rejects.toThrow();
  });
});

// ============================================================
// Cross-cutting Concerns
// ============================================================

describe("Authorization Guards", () => {
  it("protectedProcedure rejects unauthenticated users", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    // All these should reject
    await expect(caller.project.create({ title: "T", l1Id: "n", l2Id: "n.c", l3Id: "n.c.f", duration: "15" })).rejects.toThrow();
    await expect(caller.script.generate({ projectId: 1 })).rejects.toThrow();
    await expect(caller.anchor.generate({ projectId: 1 })).rejects.toThrow();
    await expect(caller.grid.generate({ projectId: 1 })).rejects.toThrow();
    await expect(caller.panel.extractAll({ projectId: 1 })).rejects.toThrow();
    await expect(caller.prompt.generate({ projectId: 1 })).rejects.toThrow();
  });

  it("adminProcedure rejects normal users", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.category.seed()).rejects.toThrow();
    await expect(caller.rule.seed()).rejects.toThrow();
    await expect(caller.rule.clearAll()).rejects.toThrow();
    await expect(caller.export.create({ exportType: "full" })).rejects.toThrow();
    await expect(caller.appLog.clear({})).rejects.toThrow();
  });

  it("publicProcedure allows unauthenticated access", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    // These should all succeed
    const categories = await caller.category.tree();
    expect(Array.isArray(categories)).toBe(true);
    const projects = await caller.project.list({});
    expect(Array.isArray(projects)).toBe(true);
    const experience = await caller.experience.list();
    expect(Array.isArray(experience)).toBe(true);
  });
});

describe("Input Validation", () => {
  it("rejects empty project title", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.project.create({
      title: "",
      l1Id: "narrative",
      l2Id: "narrative.chase",
      l3Id: "narrative.chase.friend",
      duration: "15",
    })).rejects.toThrow();
  });

  it("rejects invalid anchorLib type", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.anchorLib.create({
      name: "Test",
      anchorType: "invalid" as any,
      prompt: "test",
    })).rejects.toThrow();
  });

  it("rejects negative limit in anchorLib.list", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.anchorLib.list({ limit: -1 })).rejects.toThrow();
  });

  it("rejects limit over 100 in anchorLib.list", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.anchorLib.list({ limit: 200 })).rejects.toThrow();
  });

  it("rejects empty system prompt key", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.systemPrompt.upsert({
      key: "",
      name: "Test",
      category: "script",
      content: "Test",
    })).rejects.toThrow();
  });
});
