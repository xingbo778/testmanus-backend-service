/**
 * Rule Selector - intelligent rule selection for different generation stages.
 * 
 * Instead of injecting ALL rules (which overwhelms the LLM), this module
 * selects the most relevant rules based on:
 * 1. Generation stage (script / grid / panel / prompt)
 * 2. Scene type (L2 category)
 * 3. Rule priority (critical > warning > info)
 * 4. Rule category relevance
 * 
 * Design principles:
 * - Script generation: comprehensive rules (cinematography + structure + pacing)
 * - Grid/Panel generation: visual rules only (composition, shot type, lighting, color)
 * - Prompt generation: AI prompt rules + technical specs
 * - Max rules per prompt: ~80-120 for scripts, ~30-50 for images
 */

export interface RuleChapter {
  id: number;
  chapterNumber: number;
  title: string;
  category: "universal" | "scene_specific" | "technical" | "ai_prompt";
  applicableL2Ids: string[] | null;
  rules: Array<{ type: string; text: string; severity: string }>;
  ruleCount: number;
}

export type GenerationStage = "script" | "grid" | "panel" | "prompt";

/**
 * Keywords that indicate a rule is relevant to visual/image generation.
 * Used to filter technical rules for Grid/Panel generation.
 */
const VISUAL_KEYWORDS = [
  // Composition
  "构图", "画面", "画幅", "比例", "对称", "三分", "黄金", "引导线", "前景", "中景", "背景",
  "留白", "负空间", "框架", "对角线", "视觉重心", "视觉引导",
  // Shot types
  "景别", "远景", "全景", "中景", "近景", "特写", "大特写", "俯拍", "仰拍", "平视",
  "过肩", "主观", "客观", "鸟瞰", "虫视",
  // Lighting & Color
  "光线", "光影", "色彩", "色调", "色温", "暖色", "冷色", "对比度", "饱和度",
  "逆光", "侧光", "顶光", "底光", "自然光", "人工光", "柔光", "硬光",
  "高调", "低调", "剪影", "伦勃朗", "蝴蝶光",
  // Camera
  "镜头", "焦距", "景深", "虚化", "焦点", "广角", "长焦", "微距",
  // Style
  "氛围", "质感", "纹理", "胶片", "颗粒", "真实", "写实",
];

/**
 * Keywords for pacing/editing rules (relevant to script generation).
 */
const PACING_KEYWORDS = [
  "节奏", "剪辑", "蒙太奇", "转场", "切换", "时长", "速度", "快切", "慢镜",
  "交叉剪辑", "平行剪辑", "跳切", "匹配剪辑", "淡入", "淡出",
  "叠化", "擦除", "闪白", "闪黑",
];

/**
 * Keywords for character/staging rules.
 */
const CHARACTER_KEYWORDS = [
  "角色", "人物", "调度", "走位", "站位", "表情", "动作", "姿态", "手势",
  "视线", "眼神", "互动", "对话", "反应",
];

/**
 * Score a rule's relevance to a generation stage.
 * Higher score = more relevant.
 */
function scoreRule(ruleText: string, stage: GenerationStage): number {
  let score = 0;
  const text = ruleText.toLowerCase();

  if (stage === "grid" || stage === "panel") {
    // For image generation, prioritize visual rules
    for (const kw of VISUAL_KEYWORDS) {
      if (text.includes(kw)) score += 3;
    }
    for (const kw of CHARACTER_KEYWORDS) {
      if (text.includes(kw)) score += 1;
    }
  } else if (stage === "script") {
    // For script generation, all rule types are relevant
    for (const kw of VISUAL_KEYWORDS) {
      if (text.includes(kw)) score += 2;
    }
    for (const kw of PACING_KEYWORDS) {
      if (text.includes(kw)) score += 3;
    }
    for (const kw of CHARACTER_KEYWORDS) {
      if (text.includes(kw)) score += 2;
    }
  } else if (stage === "prompt") {
    // For prompt generation, technical + AI prompt rules
    for (const kw of VISUAL_KEYWORDS) {
      if (text.includes(kw)) score += 2;
    }
  }

  return score;
}

/**
 * Score a chapter's relevance to a generation stage.
 */
function scoreChapter(chapter: RuleChapter, stage: GenerationStage): number {
  let baseScore = 0;

  // Category-based scoring
  if (stage === "script") {
    // Script generation benefits from all categories
    if (chapter.category === "scene_specific") baseScore = 100;
    if (chapter.category === "universal") baseScore = 80;
    if (chapter.category === "technical") baseScore = 40;
    if (chapter.category === "ai_prompt") baseScore = 20;
  } else if (stage === "grid" || stage === "panel") {
    // Image generation: visual rules are king
    if (chapter.category === "scene_specific") baseScore = 60;
    if (chapter.category === "universal") baseScore = 50;
    if (chapter.category === "technical") baseScore = 80; // Technical has composition/lighting chapters
    if (chapter.category === "ai_prompt") baseScore = 10;
  } else if (stage === "prompt") {
    if (chapter.category === "ai_prompt") baseScore = 100;
    if (chapter.category === "technical") baseScore = 50;
    if (chapter.category === "scene_specific") baseScore = 30;
    if (chapter.category === "universal") baseScore = 20;
  }

  // Title-based boosting for image generation stages
  if (stage === "grid" || stage === "panel") {
    const title = chapter.title;
    if (title.includes("构图") || title.includes("画面")) baseScore += 50;
    if (title.includes("景别")) baseScore += 50;
    if (title.includes("光线") || title.includes("色彩") || title.includes("氛围")) baseScore += 40;
    if (title.includes("运镜") || title.includes("摄影")) baseScore += 30;
    if (title.includes("角色调度") || title.includes("场面调度")) baseScore += 20;
    // Deprioritize non-visual chapters for image generation
    if (title.includes("声音") || title.includes("音画")) baseScore -= 50;
    if (title.includes("剪辑") || title.includes("蒙太奇")) baseScore -= 30;
    if (title.includes("节奏") || title.includes("结构")) baseScore -= 20;
  }

  return baseScore;
}

/**
 * Select and format rules for a specific generation stage.
 * 
 * @param allChapters - All rule chapters applicable to the scene
 * @param stage - The generation stage
 * @param maxRules - Maximum number of rules to inject (default varies by stage)
 * @returns Formatted rules text and metadata
 */
export function selectRulesForStage(
  allChapters: RuleChapter[],
  stage: GenerationStage,
  maxRules?: number,
): { rulesText: string; totalRules: number; chaptersUsed: number; summary: string } {
  // Default max rules by stage
  const defaultMax: Record<GenerationStage, number> = {
    script: 120,
    grid: 40,
    panel: 25,
    prompt: 60,
  };
  const limit = maxRules ?? defaultMax[stage];

  // Score and sort chapters
  const scoredChapters = allChapters.map(ch => ({
    chapter: ch,
    score: scoreChapter(ch, stage),
  })).sort((a, b) => b.score - a.score);

  // For grid/panel, skip chapters with very low scores
  const minScore = stage === "grid" || stage === "panel" ? 20 : 0;
  const relevantChapters = scoredChapters.filter(sc => sc.score >= minScore);

  // Collect rules with scoring and severity priority
  let collectedRules: Array<{
    chapterTitle: string;
    category: string;
    type: string;
    text: string;
    severity: string;
    relevanceScore: number;
  }> = [];

  for (const { chapter, score: chapterScore } of relevantChapters) {
    const rules = chapter.rules || [];
    for (const rule of rules) {
      // Severity bonus
      let severityBonus = 0;
      if (rule.severity === "critical") severityBonus = 20;
      else if (rule.severity === "warning") severityBonus = 10;

      // Rule-level relevance scoring
      const ruleScore = scoreRule(rule.text, stage);

      collectedRules.push({
        chapterTitle: chapter.title,
        category: chapter.category,
        type: rule.type,
        text: rule.text,
        severity: rule.severity,
        relevanceScore: chapterScore + severityBonus + ruleScore,
      });
    }
  }

  // Sort by relevance score (highest first)
  collectedRules.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Take top N rules
  const selectedRules = collectedRules.slice(0, limit);

  // Group by chapter for readable output
  const byChapter = new Map<string, typeof selectedRules>();
  for (const rule of selectedRules) {
    const key = rule.chapterTitle;
    if (!byChapter.has(key)) byChapter.set(key, []);
    byChapter.get(key)!.push(rule);
  }

  // Format output
  const sections: string[] = [];
  byChapter.forEach((rules, chapterTitle) => {
    const category = rules[0].category;
    const ruleLines = rules.map((r: { type: string; severity: string; text: string }) => `- [${r.type.toUpperCase()}][${r.severity}] ${r.text}`).join("\n");
    sections.push(`### ${chapterTitle}\uff08${category}\uff09\n${ruleLines}`);
  });

  const rulesText = sections.join("\n\n");
  const summary = `${selectedRules.length} rules from ${byChapter.size} chapters (stage: ${stage}, max: ${limit})`;

  return {
    rulesText,
    totalRules: selectedRules.length,
    chaptersUsed: byChapter.size,
    summary,
  };
}

/**
 * Build visual rules specifically for Grid/Panel image generation.
 * Returns a concise set of rules focused on composition, shot types, and lighting.
 */
export function buildRulesForGrid(allChapters: RuleChapter[]): string {
  const { rulesText, summary } = selectRulesForStage(allChapters, "grid", 40);
  
  if (!rulesText) return "";
  
  return `## 分镜视觉规则参考（${summary}）

以下规则指导画面构图、景别选择和光线处理。请在生成每个面板时参考：

${rulesText}`;
}

/**
 * Build visual rules for individual Panel generation.
 * More concise than grid rules since each panel has a specific focus.
 */
export function buildRulesForPanel(allChapters: RuleChapter[], shotType: string): string {
  // Filter rules that mention the specific shot type
  const shotTypeMap: Record<string, string[]> = {
    "EWS": ["远景", "大远景", "extreme wide"],
    "WS": ["远景", "全景", "wide shot"],
    "FS": ["全景", "全身", "full shot"],
    "MS": ["中景", "半身", "medium shot"],
    "MCU": ["中近景", "胸上", "medium close"],
    "CU": ["近景", "特写", "close-up"],
    "ECU": ["大特写", "极特写", "extreme close"],
    "INS": ["特写", "插入", "insert"],
    "OTS": ["过肩", "over the shoulder"],
    "POV": ["主观", "point of view"],
  };

  const { rulesText, totalRules } = selectRulesForStage(allChapters, "panel", 25);
  
  if (!rulesText) return "";

  // Add shot-type specific note
  const keywords = shotTypeMap[shotType] || [];
  const shotNote = keywords.length > 0
    ? `\n注意：当前面板使用 ${shotType} 景别，请特别关注与"${keywords.join('/')}"相关的规则。`
    : "";

  return `## 视觉规则参考（${totalRules}条）${shotNote}

${rulesText}`;
}

/**
 * Build rules for script generation.
 * Comprehensive rules covering cinematography, pacing, and scene-specific guidelines.
 */
export function buildRulesForScript(allChapters: RuleChapter[]): {
  rulesText: string;
  totalRules: number;
  chaptersUsed: number;
} {
  return selectRulesForStage(allChapters, "script", 120);
}

/**
 * Build rules for prompt generation.
 * Focuses on AI prompt rules and technical specifications.
 */
export function buildRulesForPrompt(allChapters: RuleChapter[]): string {
  const { rulesText, totalRules } = selectRulesForStage(allChapters, "prompt", 60);
  
  if (!rulesText) return "";
  
  return `## 提示词生成规则（${totalRules}条）\n\n${rulesText}`;
}
