import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock database and LLM to avoid real calls
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getCategoryTree: vi.fn().mockResolvedValue([
    { id: 1, categoryId: "narrative", name: "叙事剧情", level: 1, parentId: null, description: "叙事类短视频", sortOrder: 1, templateRef: null, createdAt: new Date() },
    { id: 2, categoryId: "narrative.chase", name: "追逐戏", level: 2, parentId: "narrative", description: "追逐场景", sortOrder: 1, templateRef: null, createdAt: new Date() },
    { id: 3, categoryId: "narrative.chase.friend", name: "朋友间追逐", level: 3, parentId: "narrative.chase", description: "朋友追逐", sortOrder: 1, templateRef: "template_01", createdAt: new Date() },
  ]),
  seedCategories: vi.fn().mockResolvedValue(undefined),
  seedRuleChapters: vi.fn().mockResolvedValue(undefined),
  getRuleChapters: vi.fn().mockResolvedValue([
    { id: 1, chapterNumber: 1, chapterTitle: "通用基础规则", content: "Rule 1: ...", ruleCount: 37, applicableScenes: "all", createdAt: new Date() },
  ]),
  getRulesForScene: vi.fn().mockResolvedValue([
    { id: 1, chapterNumber: 1, chapterTitle: "通用基础规则", content: "Rule 1: ...", ruleCount: 37, applicableScenes: "all", createdAt: new Date() },
  ]),
  getUserRules: vi.fn().mockResolvedValue([]),
  saveUserRule: vi.fn().mockResolvedValue(undefined),
  updateUserRule: vi.fn().mockResolvedValue(undefined),
  createProject: vi.fn().mockResolvedValue({ id: 1 }),
  listProjects: vi.fn().mockResolvedValue([]),
  getProjectById: vi.fn().mockResolvedValue(null),
  updateProject: vi.fn().mockResolvedValue(undefined),
  deleteProject: vi.fn().mockResolvedValue(undefined),
  saveScript: vi.fn().mockResolvedValue({ id: 1 }),
  getLatestScript: vi.fn().mockResolvedValue(null),
  getScriptByVersion: vi.fn().mockResolvedValue(null),
  saveAnchor: vi.fn().mockResolvedValue({ id: 1 }),
  getAnchors: vi.fn().mockResolvedValue([]),
  saveGrid: vi.fn().mockResolvedValue({ id: 1 }),
  getLatestGrid: vi.fn().mockResolvedValue(null),
  savePanels: vi.fn().mockResolvedValue(undefined),
  getPanels: vi.fn().mockResolvedValue([]),
  updatePanel: vi.fn().mockResolvedValue(undefined),
  savePrompts: vi.fn().mockResolvedValue(undefined),
  getPrompts: vi.fn().mockResolvedValue([]),
  updatePrompt: vi.fn().mockResolvedValue(undefined),
  saveExperienceRecord: vi.fn().mockResolvedValue({ id: 1 }),
  getExperienceRecords: vi.fn().mockResolvedValue([]),
  getExperienceSummary: vi.fn().mockResolvedValue({ total: 0, byCategory: [], byActionType: [] }),
  createExportRecord: vi.fn().mockResolvedValue({ id: 1 }),
  updateExportRecord: vi.fn().mockResolvedValue(undefined),
  getExportRecords: vi.fn().mockResolvedValue([]),
  saveReference: vi.fn().mockResolvedValue(undefined),
  getReferences: vi.fn().mockResolvedValue([]),
  getConfirmedProjects: vi.fn().mockResolvedValue([]),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          frames: [
            { shotType: "全景", duration: 2, description: "开场全景", cameraMove: "推镜头" },
            { shotType: "中景", duration: 3, description: "角色出场", cameraMove: "跟拍" },
          ],
          characters: [{ name: "主角", description: "年轻女性" }],
          scenes: [{ name: "城市街道", description: "现代都市" }],
          props: [],
        })
      }
    }]
  }),
}));

vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn().mockResolvedValue({ url: "https://example.com/image.png" }),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/file.jsonl", key: "file.jsonl" }),
}));

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
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
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
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("category router", () => {
  it("returns category tree", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.category.tree();
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("叙事剧情");
    expect(result[0].level).toBe(1);
  });

  it("seed categories requires admin", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.category.seed()).rejects.toThrow();
  });

  it("seed categories works for admin", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.category.seed();
    expect(result).toHaveProperty("success", true);
  });
});

describe("rule router", () => {
  it("returns rule chapters", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.rule.chapters();
    expect(result).toHaveLength(1);
    expect(result[0].chapterTitle).toBe("通用基础规则");
  });

  it("returns rules for scene", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.rule.forScene({ l2Id: "narrative.chase" });
    expect(result).toHaveLength(1);
  });

  it("seed rules requires admin", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.rule.seed()).rejects.toThrow();
  });

  it("returns user rules", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.rule.userRules({});
    expect(result).toEqual([]);
  });
});

describe("project router", () => {
  it("creates a project", async () => {
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

  it("lists projects", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.project.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("create project requires auth", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.project.create({
      title: "测试",
      l1Id: "narrative",
      l2Id: "narrative.chase",
      l3Id: "narrative.chase.friend",
      duration: "15",
    })).rejects.toThrow();
  });
});

describe("experience router", () => {
  it("lists experience records", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.experience.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns experience summary", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.experience.summary();
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("byActionType");
  });
});

describe("export router", () => {
  it("lists export records", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.export.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("create export requires admin", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.export.create({
      exportType: "full",
    })).rejects.toThrow();
  });
});
