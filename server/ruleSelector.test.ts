import { describe, it, expect } from "vitest";
import {
  selectRulesForStage,
  buildRulesForGrid,
  buildRulesForPanel,
  buildRulesForScript,
  buildRulesForPrompt,
  type RuleChapter,
} from "./ruleSelector";

// ============================================================
// Test Data
// ============================================================

const mockChapters: RuleChapter[] = [
  {
    id: 1,
    chapterNumber: 1,
    title: "通用分镜基础法则",
    category: "universal",
    applicableL2Ids: null,
    rules: [
      { type: "do", text: "每个镜头必须有明确的叙事目的", severity: "critical" },
      { type: "dont", text: "不要连续使用相同景别超过3次", severity: "warning" },
      { type: "do", text: "保持画面构图的视觉平衡", severity: "info" },
    ],
    ruleCount: 3,
  },
  {
    id: 2,
    chapterNumber: 2,
    title: "景别使用规范",
    category: "universal",
    applicableL2Ids: null,
    rules: [
      { type: "do", text: "远景用于建立场景环境和空间关系", severity: "critical" },
      { type: "do", text: "近景和特写用于表达情感和细节", severity: "warning" },
      { type: "dont", text: "避免在对话场景中过度使用远景", severity: "warning" },
    ],
    ruleCount: 3,
  },
  {
    id: 3,
    chapterNumber: 8,
    title: "对话场景",
    category: "scene_specific",
    applicableL2Ids: ["dialogue_cafe", "dialogue_office"],
    rules: [
      { type: "do", text: "对话场景使用正反打切换角色视角", severity: "critical" },
      { type: "do", text: "在对话中穿插反应镜头", severity: "warning" },
      { type: "dont", text: "不要让对话场景的镜头静止超过5秒", severity: "info" },
    ],
    ruleCount: 3,
  },
  {
    id: 4,
    chapterNumber: 30,
    title: "构图与画面美学",
    category: "technical",
    applicableL2Ids: null,
    rules: [
      { type: "do", text: "使用三分法构图引导观众视线", severity: "critical" },
      { type: "do", text: "利用前景元素增加画面层次和景深", severity: "warning" },
      { type: "do", text: "对称构图适用于庄严、仪式感场景", severity: "info" },
      { type: "dont", text: "避免将主体放在画面正中央（除非刻意为之）", severity: "warning" },
      { type: "do", text: "使用引导线将观众视线引向画面重心", severity: "info" },
    ],
    ruleCount: 5,
  },
  {
    id: 5,
    chapterNumber: 31,
    title: "运镜与摄影机运动",
    category: "technical",
    applicableL2Ids: null,
    rules: [
      { type: "do", text: "推镜头用于强调主体或揭示细节", severity: "critical" },
      { type: "do", text: "摇镜头用于展示空间或跟随运动", severity: "warning" },
      { type: "dont", text: "避免无目的的镜头运动", severity: "critical" },
    ],
    ruleCount: 3,
  },
  {
    id: 6,
    chapterNumber: 32,
    title: "剪辑节奏与蒙太奇",
    category: "technical",
    applicableL2Ids: null,
    rules: [
      { type: "do", text: "快切节奏用于紧张、动作场景", severity: "warning" },
      { type: "do", text: "蒙太奇用于时间压缩和情绪渲染", severity: "info" },
      { type: "dont", text: "避免跳切（Jump Cut）破坏视觉连续性", severity: "critical" },
    ],
    ruleCount: 3,
  },
  {
    id: 7,
    chapterNumber: 33,
    title: "光线、色彩与氛围",
    category: "technical",
    applicableL2Ids: null,
    rules: [
      { type: "do", text: "暖色调营造温馨、亲密氛围", severity: "warning" },
      { type: "do", text: "冷色调营造疏离、紧张氛围", severity: "warning" },
      { type: "do", text: "逆光剪影用于神秘或戏剧性效果", severity: "info" },
    ],
    ruleCount: 3,
  },
  {
    id: 8,
    chapterNumber: 37,
    title: "声音设计与音画配合",
    category: "technical",
    applicableL2Ids: null,
    rules: [
      { type: "do", text: "声音先于画面出现可增加悬念", severity: "info" },
      { type: "do", text: "环境音增强场景真实感", severity: "info" },
    ],
    ruleCount: 2,
  },
  {
    id: 9,
    chapterNumber: 38,
    title: "AI视频生成提示词规范",
    category: "ai_prompt",
    applicableL2Ids: null,
    rules: [
      { type: "do", text: "提示词必须包含镜头类型、视角、主体、动作、光影", severity: "critical" },
      { type: "do", text: "使用英文撰写提示词以获得最佳效果", severity: "warning" },
      { type: "dont", text: "不要在提示词中使用模糊描述如'好看的'", severity: "warning" },
    ],
    ruleCount: 3,
  },
];

// ============================================================
// Tests
// ============================================================

describe("ruleSelector", () => {
  describe("selectRulesForStage", () => {
    it("should select rules for script stage", () => {
      const result = selectRulesForStage(mockChapters, "script", 50);
      expect(result.totalRules).toBeGreaterThan(0);
      expect(result.totalRules).toBeLessThanOrEqual(50);
      expect(result.chaptersUsed).toBeGreaterThan(0);
      expect(result.rulesText).toContain("[DO]");
      expect(result.summary).toContain("script");
    });

    it("should select rules for grid stage", () => {
      const result = selectRulesForStage(mockChapters, "grid", 20);
      expect(result.totalRules).toBeGreaterThan(0);
      expect(result.totalRules).toBeLessThanOrEqual(20);
      expect(result.rulesText.length).toBeGreaterThan(0);
    });

    it("should select rules for panel stage", () => {
      const result = selectRulesForStage(mockChapters, "panel", 15);
      expect(result.totalRules).toBeGreaterThan(0);
      expect(result.totalRules).toBeLessThanOrEqual(15);
    });

    it("should select rules for prompt stage", () => {
      const result = selectRulesForStage(mockChapters, "prompt", 30);
      expect(result.totalRules).toBeGreaterThan(0);
      expect(result.totalRules).toBeLessThanOrEqual(30);
    });

    it("should prioritize critical rules", () => {
      const result = selectRulesForStage(mockChapters, "script", 5);
      // With only 5 rules, critical ones should be prioritized
      const criticalCount = result.rulesText.split("[critical]").length - 1;
      const infoCount = result.rulesText.split("[info]").length - 1;
      expect(criticalCount).toBeGreaterThanOrEqual(infoCount);
    });

    it("should respect maxRules limit", () => {
      const result = selectRulesForStage(mockChapters, "script", 3);
      expect(result.totalRules).toBeLessThanOrEqual(3);
    });

    it("should handle empty chapters array", () => {
      const result = selectRulesForStage([], "script");
      expect(result.totalRules).toBe(0);
      expect(result.chaptersUsed).toBe(0);
      expect(result.rulesText).toBe("");
    });
  });

  describe("buildRulesForGrid", () => {
    it("should return visual rules for grid generation", () => {
      const result = buildRulesForGrid(mockChapters);
      expect(result).toContain("分镜视觉规则参考");
      // Should include composition rules
      expect(result).toContain("构图");
    });

    it("should deprioritize non-visual rules for grid", () => {
      const result = buildRulesForGrid(mockChapters);
      // Sound design rules should have lower priority for grid generation
      // They might still appear if there's room, but visual rules should dominate
      const hasComposition = result.includes("构图") || result.includes("景别") || result.includes("光线");
      expect(hasComposition).toBe(true);
    });

    it("should return empty string for empty chapters", () => {
      const result = buildRulesForGrid([]);
      expect(result).toBe("");
    });
  });

  describe("buildRulesForPanel", () => {
    it("should return rules for panel generation", () => {
      const result = buildRulesForPanel(mockChapters, "CU");
      expect(result).toContain("视觉规则参考");
    });

    it("should mention the shot type", () => {
      const result = buildRulesForPanel(mockChapters, "CU");
      expect(result).toContain("CU");
    });

    it("should work with unknown shot types", () => {
      const result = buildRulesForPanel(mockChapters, "UNKNOWN");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("buildRulesForScript", () => {
    it("should return comprehensive rules for script generation", () => {
      const result = buildRulesForScript(mockChapters);
      expect(result.totalRules).toBeGreaterThan(0);
      expect(result.chaptersUsed).toBeGreaterThan(0);
      expect(result.rulesText.length).toBeGreaterThan(0);
    });

    it("should include rules from multiple categories", () => {
      const result = buildRulesForScript(mockChapters);
      // Script generation should pull from multiple categories
      expect(result.chaptersUsed).toBeGreaterThanOrEqual(3);
    });
  });

  describe("buildRulesForPrompt", () => {
    it("should return AI prompt rules", () => {
      const result = buildRulesForPrompt(mockChapters);
      expect(result).toContain("提示词生成规则");
    });

    it("should include AI prompt category rules", () => {
      const result = buildRulesForPrompt(mockChapters);
      expect(result).toContain("提示词");
    });
  });

  describe("stage-specific prioritization", () => {
    it("grid stage should prioritize composition/lighting over editing/sound", () => {
      // Create chapters with clear visual vs non-visual distinction
      const testChapters: RuleChapter[] = [
        {
          id: 100,
          chapterNumber: 100,
          title: "构图与画面美学",
          category: "technical",
          applicableL2Ids: null,
          rules: [{ type: "do", text: "使用三分法构图", severity: "critical" }],
          ruleCount: 1,
        },
        {
          id: 101,
          chapterNumber: 101,
          title: "声音设计与音画配合",
          category: "technical",
          applicableL2Ids: null,
          rules: [{ type: "do", text: "声音先于画面出现", severity: "critical" }],
          ruleCount: 1,
        },
      ];

      const gridResult = selectRulesForStage(testChapters, "grid", 1);
      // With only 1 rule allowed, grid should pick composition over sound
      expect(gridResult.rulesText).toContain("构图");
    });

    it("script stage should include pacing/editing rules", () => {
      const result = selectRulesForStage(mockChapters, "script", 50);
      // Script generation should include editing/pacing rules
      const hasPacing = result.rulesText.includes("节奏") || result.rulesText.includes("剪辑") || result.rulesText.includes("蒙太奇");
      expect(hasPacing).toBe(true);
    });
  });
});
