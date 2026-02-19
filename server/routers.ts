import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { CATEGORY_SEED } from "./seed-categories";
import { RULE_CHAPTERS_SEED } from "./seed-rules";
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import { storagePut } from "./storage";
import { uploadFile } from "./uploadHelper";
import { generateGridTemplateDataUrl } from "./gridTemplate";
import { DEFAULT_SYSTEM_PROMPTS } from "./seed-prompts";
import { logInfo, logError, logWarn } from "./appLogger";
import { extractPanel, extractAllPanels } from "./panelExtractor";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============================================================
  // Category System
  // ============================================================
  category: router({
    tree: publicProcedure.query(async () => {
      return db.getCategoryTree();
    }),
    seed: adminProcedure.mutation(async () => {
      await db.seedCategories(CATEGORY_SEED);
      return { success: true, message: "Categories seeded successfully" };
    }),
  }),

  // ============================================================
  // Rule Management
  // ============================================================
  rule: router({
    chapters: publicProcedure.query(async () => {
      return db.getRuleChapters();
    }),
    forScene: publicProcedure
      .input(z.object({ l2Id: z.string() }))
      .query(async ({ input }) => {
        return db.getRulesForScene(input.l2Id);
      }),
    seed: adminProcedure.mutation(async () => {
      await db.seedRuleChapters(RULE_CHAPTERS_SEED);
      return { success: true, message: "Rule chapters seeded successfully" };
    }),
    userRules: publicProcedure
      .input(z.object({ status: z.string().optional(), applicableL2Id: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return db.getUserRules(input);
      }),
    approveRule: adminProcedure
      .input(z.object({ ruleId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.updateUserRule(input.ruleId, {
          status: "approved",
          approvedBy: ctx.user.name ?? ctx.user.openId,
          approvedAt: new Date(),
        });
        return { success: true };
      }),
    rejectRule: adminProcedure
      .input(z.object({ ruleId: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateUserRule(input.ruleId, { status: "rejected" });
        return { success: true };
      }),
    clearAll: adminProcedure.mutation(async () => {
      await db.clearAllRuleChapters();
      return { success: true, message: "All rule chapters cleared" };
    }),
    // Create new chapter
    createChapter: adminProcedure
      .input(z.object({
        chapterNumber: z.number(),
        title: z.string(),
        category: z.enum(["universal", "scene_specific", "technical", "ai_prompt"]),
        applicableL2Ids: z.array(z.string()).nullable().optional(),
        rules: z.array(z.object({
          type: z.string(),
          text: z.string(),
          severity: z.string(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createRuleChapter({
          chapterNumber: input.chapterNumber,
          title: input.title,
          category: input.category,
          applicableL2Ids: input.applicableL2Ids ?? null,
          rules: input.rules ?? [],
          ruleCount: input.rules?.length ?? 0,
        });
        return { success: true, id };
      }),
    // Update chapter
    updateChapter: adminProcedure
      .input(z.object({
        chapterId: z.number(),
        title: z.string().optional(),
        category: z.enum(["universal", "scene_specific", "technical", "ai_prompt"]).optional(),
        applicableL2Ids: z.array(z.string()).nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { chapterId, ...data } = input;
        await db.updateRuleChapter(chapterId, data as any);
        return { success: true };
      }),
    // Delete chapter
    deleteChapter: adminProcedure
      .input(z.object({ chapterId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteRuleChapter(input.chapterId);
        return { success: true };
      }),
    // Add rule to chapter
    addRule: adminProcedure
      .input(z.object({
        chapterId: z.number(),
        rule: z.object({
          type: z.string(),
          text: z.string(),
          severity: z.string(),
        }),
      }))
      .mutation(async ({ input }) => {
        const chapter = await db.getRuleChapterById(input.chapterId);
        if (!chapter) throw new Error("Chapter not found");
        const rules = (chapter.rules as any[]) ?? [];
        rules.push(input.rule);
        await db.updateRuleChapter(input.chapterId, { rules, ruleCount: rules.length });
        return { success: true, ruleCount: rules.length };
      }),
    // Update rule in chapter
    updateRule: adminProcedure
      .input(z.object({
        chapterId: z.number(),
        ruleIndex: z.number(),
        rule: z.object({
          type: z.string().optional(),
          text: z.string().optional(),
          severity: z.string().optional(),
        }),
      }))
      .mutation(async ({ input }) => {
        const chapter = await db.getRuleChapterById(input.chapterId);
        if (!chapter) throw new Error("Chapter not found");
        const rules = (chapter.rules as any[]) ?? [];
        if (input.ruleIndex < 0 || input.ruleIndex >= rules.length) throw new Error("Rule index out of range");
        rules[input.ruleIndex] = { ...rules[input.ruleIndex], ...input.rule };
        await db.updateRuleChapter(input.chapterId, { rules });
        return { success: true };
      }),
    // Delete rule from chapter
    deleteRule: adminProcedure
      .input(z.object({
        chapterId: z.number(),
        ruleIndex: z.number(),
      }))
      .mutation(async ({ input }) => {
        const chapter = await db.getRuleChapterById(input.chapterId);
        if (!chapter) throw new Error("Chapter not found");
        const rules = (chapter.rules as any[]) ?? [];
        if (input.ruleIndex < 0 || input.ruleIndex >= rules.length) throw new Error("Rule index out of range");
        rules.splice(input.ruleIndex, 1);
        await db.updateRuleChapter(input.chapterId, { rules, ruleCount: rules.length });
        return { success: true, ruleCount: rules.length };
      }),
    chapterDetail: publicProcedure
      .input(z.object({ chapterNumber: z.number() }))
      .query(async ({ input }) => {
        return db.getRuleChapterByNumber(input.chapterNumber);
      }),
    importChapter: adminProcedure
      .input(z.object({
        chapterNumber: z.number(),
        title: z.string(),
        category: z.enum(["universal", "scene_specific", "technical", "ai_prompt"]),
        applicableL2Ids: z.array(z.string()).nullable().optional(),
        rules: z.array(z.object({
          type: z.string(),
          text: z.string(),
          severity: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        await db.importRuleChapter({
          chapterNumber: input.chapterNumber,
          title: input.title,
          category: input.category,
          applicableL2Ids: input.applicableL2Ids ?? null,
          rules: input.rules,
          ruleCount: input.rules.length,
        });
        return { success: true, chapterNumber: input.chapterNumber, ruleCount: input.rules.length };
      }),
  }),

  // ============================================================
  // Category CRUD
  // ============================================================
  categoryManage: router({
    create: adminProcedure
      .input(z.object({
        level: z.enum(["1", "2", "3"]),
        id: z.string(),
        name: z.string(),
        nameEn: z.string().optional(),
        description: z.string().optional(),
        sortOrder: z.number().optional(),
        l1Id: z.string().optional(),
        l2Id: z.string().optional(),
        templateRef: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const level = parseInt(input.level) as 1 | 2 | 3;
        const data: any = { id: input.id, name: input.name, nameEn: input.nameEn, description: input.description, sortOrder: input.sortOrder ?? 0 };
        if (level >= 2) data.l1Id = input.l1Id;
        if (level === 3) { data.l2Id = input.l2Id; data.templateRef = input.templateRef; }
        await db.createCategory(level, data);
        return { success: true };
      }),
    update: adminProcedure
      .input(z.object({
        level: z.enum(["1", "2", "3"]),
        id: z.string(),
        name: z.string().optional(),
        nameEn: z.string().optional(),
        description: z.string().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const level = parseInt(input.level) as 1 | 2 | 3;
        const { level: _, id, ...data } = input;
        await db.updateCategory(level, id, data as any);
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({
        level: z.enum(["1", "2", "3"]),
        id: z.string(),
      }))
      .mutation(async ({ input }) => {
        const level = parseInt(input.level) as 1 | 2 | 3;
        await db.deleteCategory(level, input.id);
        return { success: true };
      }),
  }),

  // ============================================================
  // Prompt Template Management (view/edit/translate workflow prompts)
  // ============================================================
  promptTemplate: router({
    // List all workflow prompt templates
    list: publicProcedure.query(async () => {
      return [
        { id: "script_system", name: "脚本生成 System Prompt", description: "用于生成分镜脚本的系统提示词", category: "script" },
        { id: "script_user", name: "脚本生成 User Prompt", description: "用于生成分镜脚本的用户提示词模板", category: "script" },
        { id: "anchor_character", name: "角色锚点 Prompt", description: "用于生成角色参考图的提示词模板", category: "anchor" },
        { id: "anchor_scene", name: "场景锚点 Prompt", description: "用于生成场景参考图的提示词模板", category: "anchor" },
        { id: "grid_system", name: "Grid生成 Prompt", description: "用于生成分镜Grid图的提示词模板", category: "grid" },
        { id: "prompt_system", name: "Prompt生成 System Prompt", description: "用于生成视频Prompt的系统提示词", category: "prompt" },
        { id: "prompt_user", name: "Prompt生成 User Prompt", description: "用于生成视频Prompt的用户提示词模板", category: "prompt" },
        { id: "validation_system", name: "校验 System Prompt", description: "用于校验脚本的系统提示词", category: "validation" },
        { id: "panel_fix", name: "面板修复 Prompt", description: "用于修复面板图片的提示词模板", category: "panel" },
      ];
    }),
    // Get actual prompt content by ID
    get: publicProcedure
      .input(z.object({ templateId: z.string() }))
      .query(async ({ input }) => {
        // Return the actual prompt templates from the codebase
        const templates: Record<string, string> = {
          "script_system": `你是一个专业的分镜脚本设计师。根据给定的场景类型和规则，生成结构化的分镜脚本。\n\n## 输出要求\n- 每帧时长：1-3秒\n- 前3秒必须有强钩子\n- 角色anchorPrompt必须是英文，白背景、半身、居中\n- 场景anchorPrompt必须是英文，全景、无人物`,
          "script_user": `场景类型：{l1Id} > {l2Id} > {l3Id}\n标题：{title}\n总时长：{duration}秒\n补充说明：{additionalContext}`,
          "anchor_character": `A half-body portrait of [CHARACTER], [detailed appearance]. The character is centered in the frame, facing slightly to the right at a 3/4 angle. Shot against a pure white studio background with soft, even lighting. Professional studio photography, shot on 85mm f/1.4 lens.`,
          "anchor_scene": `A wide establishing shot of [SCENE], [detailed environment description]. Cinematic composition with depth, atmospheric lighting. No people in the scene, focus on environment and atmosphere. Shot on 35mm wide-angle lens. High detail, 8K resolution, photorealistic.`,
          "grid_system": `Create a professional storyboard grid image. Layout: {rows}×{cols} panels.\n\nEach panel must:\n- Match the script description exactly\n- Maintain character consistency with anchor reference images\n- Include clear panel numbering and shot type labels\n- Use cinematic composition and lighting`,
          "prompt_system": `你是一个AI视频生成提示词专家。根据分镜脚本和角色/场景锚点，为每一帧生成结构化的视频生成参数。\n\n## 通用公式\n镜头类型 + 视角 + 主体 + 动作 + 运镜 + 光影 + 材质 + 特效 + 渲染 + 环境交互 + 过渡`,
          "prompt_user": `分镜脚本：\n{frames}\n\n请为每一帧生成视频生成参数。`,
          "validation_system": `你是一个分镜脚本质量审核专家。根据规则检查脚本中的问题。`,
          "panel_fix": `Regenerate this storyboard panel with the following description: {description}\n\nIMPORTANT: Maintain character consistency with the reference images provided. Keep the same art style and visual quality as the original storyboard.`,
        };
        return { templateId: input.templateId, content: templates[input.templateId] ?? "Template not found" };
      }),
    // Translate prompt to Chinese
    translate: protectedProcedure
      .input(z.object({ text: z.string() }))
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "你是一个专业翻译。将以下英文Prompt翻译成中文，保持专业术语的准确性。只输出翻译结果，不要添加任何解释。" },
            { role: "user", content: input.text },
          ],
        });
        const translated = response.choices?.[0]?.message?.content;
        return { original: input.text, translated: typeof translated === "string" ? translated : "翻译失败" };
      }),
  }),

  // ============================================================
  // Project CRUD
  // ============================================================
  project: router({
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        l1Id: z.string(),
        l2Id: z.string(),
        l3Id: z.string(),
        duration: z.enum(["15", "30", "45"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await db.createProject({ ...input, createdBy: ctx.user.id });
        return { id };
      }),
    list: publicProcedure
      .input(z.object({
        l1Id: z.string().optional(),
        l2Id: z.string().optional(),
        l3Id: z.string().optional(),
        status: z.string().optional(),
        duration: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.listProjects(input);
      }),
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const project = await db.getProjectById(input.id);
        if (!project) return null;
        const script = await db.getLatestScript(input.id);
        const currentVersion = script?.version ?? project.currentVersion;
        // Filter by current version to avoid duplicates
        const anchorsList = await db.getAnchors(input.id, currentVersion);
        const grid = await db.getLatestGrid(input.id);
        const panelsList = grid ? await db.getPanels(input.id, grid.version) : [];
        const promptsList = await db.getPrompts(input.id, currentVersion);
        const referencesList = await db.getReferences(input.id);
        return { project, script, anchors: anchorsList, grid, panels: panelsList, prompts: promptsList, references: referencesList };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        status: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateProject(id, data);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProject(input.id);
        return { success: true };
      }),
    confirm: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateProject(input.id, { status: "confirmed" });
        return { success: true };
      }),
  }),

  // ============================================================
  // Script Generation & Validation
  // ============================================================
  script: router({
    generate: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        additionalContext: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project) throw new Error("Project not found");

        // Get applicable rules - prioritize scene-specific + key universal rules
        const allRuleChapters = await db.getRulesForScene(project.l2Id);
        const userRulesList = await db.getUserRules({ status: "approved", applicableL2Id: project.l2Id });

        // Separate scene-specific and universal/technical rules
        const sceneSpecific = allRuleChapters.filter(ch => ch.category === 'scene_specific');
        const universal = allRuleChapters.filter(ch => ch.category === 'universal');
        const technical = allRuleChapters.filter(ch => ch.category === 'technical');
        const aiPrompt = allRuleChapters.filter(ch => ch.category === 'ai_prompt');

        // Prioritize: scene-specific (all) + universal (all) + ai_prompt (all) + technical (top 3 by relevance)
        const prioritizedChapters = [
          ...sceneSpecific,
          ...universal,
          ...aiPrompt,
          ...technical.slice(0, 3), // Limit technical rules to avoid token overflow
        ];

        let totalRulesInjected = 0;
        const rulesContext = prioritizedChapters.map(ch => {
          const rules = ch.rules as Array<{ type: string; text: string; severity: string }>;
          // For large chapters, only include warning/critical rules
          const filteredRules = rules.length > 30
            ? rules.filter(r => r.severity === 'warning' || r.severity === 'critical')
            : rules;
          totalRulesInjected += filteredRules.length;
          return `## 第${ch.chapterNumber}章 ${ch.title}（${ch.category}）\n${filteredRules.map(r => `- [${r.type.toUpperCase()}][${r.severity}] ${r.text}`).join("\n")}`;
        }).join("\n\n");

        const userRulesContext = userRulesList.length > 0
          ? `## 用户自定义规则（优先级最高）\n${userRulesList.map(r => `- [${r.ruleType.toUpperCase()}][${r.severity}] ${r.ruleText}`).join("\n")}`
          : "";

        console.log(`[ScriptGen] Injected ${totalRulesInjected} rules from ${prioritizedChapters.length} chapters for scene type: ${project.l2Id}`);

        const totalDuration = parseInt(project.duration);
        const frameCount = totalDuration === 15 ? "6-8" : totalDuration === 30 ? "10-15" : "15-22";
        const gridLayout = totalDuration === 15 ? "2×3 or 2×4" : totalDuration === 30 ? "3×4 or 3×5" : "4×5 or 4×6";

        const systemPrompt = `你是一个专业的分镜脚本设计师，精通电影分镜、摄影构图和视觉叙事。根据给定的场景类型和专业规则手册，生成高质量的结构化分镜脚本。

# 参考规则手册（共${totalRulesInjected}条规则，来自${prioritizedChapters.length}个章节）

${rulesContext}

${userRulesContext}

# 输出要求
- 总时长：${totalDuration}秒
- 帧数：${frameCount}帧
- 推荐布局：${gridLayout}
- 每帧时长：1-3秒
- 前3秒必须有强钩子（hook）
- 必须严格遵循上述规则手册中的规则

# 重要：每帧description必须非常详细
每帧的description字段必须包含以下所有要素（用英文撰写，因为后续用于生成图片）：
1. **环境/背景**：具体的场景环境描述（如"warm-toned cafe interior with wooden tables, large windows letting in golden afternoon sunlight, potted plants on windowsills"）
2. **关键元素**：画面中的重要道具和视觉元素（如"two cups of coffee on the table, a handwritten letter partially visible"）
3. **人物及位置**：每个角色的具体位置、姿态、表情（如"Liam sits on the left side of the frame, leaning forward with nervous anticipation, his hands clasped around a coffee cup. Maya sits across from him on the right, looking down with a gentle smile"）
4. **光线/氛围**：光线方向、色调、情绪氛围（如"warm golden hour light from the left window, creating soft shadows. Intimate, tender atmosphere"）
5. **景深/焦点**：前景、中景、背景的层次关系（如"shallow depth of field, focus on characters' faces, background cafe patrons softly blurred"）

请以JSON格式输出，包含以下字段：
{
  "frames": [
    {
      "index": 1,
      "shotType": "EWS/WS/FS/MS/MCU/CU/ECU/INS",
      "duration": 2.0,
      "description": "非常详细的画面描述（英文），必须包含环境、人物位置、关键元素、光线氛围、景深等所有要素",
      "cameraMovement": "static/pan/tilt/dolly/tracking/handheld/crane",
      "notes": "导演备注（中文）"
    }
  ],
  "characters": [
    { "name": "角色名", "description": "外貌描述（中文，非常详细：年龄、身高体型、发型发色、五官特征、肤色、穿着风格）", "anchorPrompt": "用于生成角色参考图的英文prompt，必须遵循以下格式：A half-body portrait of [CHARACTER], [age] years old, [ethnicity], [detailed hair description], [detailed facial features], wearing [specific clothing]. The character is centered in the frame, facing slightly to the right at a 3/4 angle. Shot against a pure white studio background (#FFFFFF) with soft, even lighting. Professional studio photography, shot on 85mm f/1.4 lens. Soft key light from the upper left, subtle fill light from the right. Natural skin texture, clean catchlights in the eyes. High detail, 8K resolution, photorealistic." }
  ],
  "scenes": [
    { "name": "场景名", "description": "场景描述（中文，非常详细：空间大小、装修风格、家具摆设、光线条件、时间段、氛围）", "anchorPrompt": "用于生成场景参考图的英文prompt，必须遵循以下格式：A wide establishing shot of [SCENE], [detailed environment: furniture, decorations, materials, colors]. [Lighting description: direction, color temperature, shadows]. [Time of day] atmosphere. Cinematic composition with depth. Shot on 35mm wide-angle lens. High detail, 8K resolution, photorealistic. No people in the scene, focus on environment and atmosphere." }
  ],
  "props": [
    { "name": "道具名", "description": "道具描述" }
  ]
}`;

        const userPrompt = `场景类型：${project.l1Id} > ${project.l2Id} > ${project.l3Id}
标题：${project.title}
总时长：${totalDuration}秒
${input.additionalContext ? `补充说明：${input.additionalContext}` : ""}

请生成分镜脚本。`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "storyboard_script",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  frames: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "integer" },
                        shotType: { type: "string" },
                        duration: { type: "number" },
                        description: { type: "string" },
                        cameraMovement: { type: "string" },
                        notes: { type: "string" },
                      },
                      required: ["index", "shotType", "duration", "description", "cameraMovement", "notes"],
                      additionalProperties: false,
                    },
                  },
                  characters: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        description: { type: "string" },
                        anchorPrompt: { type: "string" },
                      },
                      required: ["name", "description", "anchorPrompt"],
                      additionalProperties: false,
                    },
                  },
                  scenes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        description: { type: "string" },
                        anchorPrompt: { type: "string" },
                      },
                      required: ["name", "description", "anchorPrompt"],
                      additionalProperties: false,
                    },
                  },
                  props: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        description: { type: "string" },
                      },
                      required: ["name", "description"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["frames", "characters", "scenes", "props"],
                additionalProperties: false,
              },
            },
          },
        });

        const contentRaw = response.choices?.[0]?.message?.content;
        const content = typeof contentRaw === "string" ? contentRaw : JSON.stringify(contentRaw);
        if (!content) throw new Error("LLM returned empty response");

        const parsed = JSON.parse(content);
        const version = (project.currentVersion ?? 0) + 1;

        const scriptId = await db.saveScript({
          projectId: input.projectId,
          version,
          frames: parsed.frames,
          characters: parsed.characters,
          scenes: parsed.scenes,
          props: parsed.props,
          generationPrompt: userPrompt,
          rulesUsed: prioritizedChapters.map((ch: any) => ch.id),
        });

        await db.updateProject(input.projectId, { status: "scripted", currentVersion: version });

        logInfo("script_gen", `Script generated: ${parsed.frames?.length ?? 0} frames, ${parsed.characters?.length ?? 0} characters`, {
          projectId: input.projectId,
          details: { version, frameCount: parsed.frames?.length, characterCount: parsed.characters?.length, rulesInjected: totalRulesInjected },
        });

        return { scriptId, script: parsed, version };
      }),

    // Edit single frame
    updateFrame: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        frameIndex: z.number(),
        data: z.object({
          shotType: z.string().optional(),
          duration: z.number().optional(),
          description: z.string().optional(),
          cameraMovement: z.string().optional(),
          notes: z.string().optional(),
        }),
      }))
      .mutation(async ({ input }) => {
        const script = await db.getLatestScript(input.projectId);
        if (!script) throw new Error("No script found");
        const frames = script.frames as any[];
        const idx = frames.findIndex((f: any) => f.index === input.frameIndex);
        if (idx === -1) throw new Error(`Frame ${input.frameIndex} not found`);
        frames[idx] = { ...frames[idx], ...input.data };
        await db.updateScriptFrames(script.id, frames);
        return { success: true, frame: frames[idx] };
      }),

    // Add new frame at position
    addFrame: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        afterIndex: z.number(), // insert after this index, 0 = insert at beginning
        frame: z.object({
          shotType: z.string(),
          duration: z.number(),
          description: z.string(),
          cameraMovement: z.string(),
          notes: z.string().optional(),
        }),
      }))
      .mutation(async ({ input }) => {
        const script = await db.getLatestScript(input.projectId);
        if (!script) throw new Error("No script found");
        const frames = script.frames as any[];
        const insertPos = input.afterIndex === 0 ? 0 : frames.findIndex((f: any) => f.index === input.afterIndex) + 1;
        if (input.afterIndex !== 0 && insertPos === 0) throw new Error(`Frame ${input.afterIndex} not found`);
        const newFrame = { ...input.frame, index: 0, notes: input.frame.notes ?? "" };
        frames.splice(insertPos, 0, newFrame);
        // Re-index all frames
        frames.forEach((f: any, i: number) => { f.index = i + 1; });
        await db.updateScriptFrames(script.id, frames);
        return { success: true, frames, totalFrames: frames.length };
      }),

    // Remove frame
    removeFrame: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        frameIndex: z.number(),
      }))
      .mutation(async ({ input }) => {
        const script = await db.getLatestScript(input.projectId);
        if (!script) throw new Error("No script found");
        const frames = script.frames as any[];
        const idx = frames.findIndex((f: any) => f.index === input.frameIndex);
        if (idx === -1) throw new Error(`Frame ${input.frameIndex} not found`);
        frames.splice(idx, 1);
        // Re-index all frames
        frames.forEach((f: any, i: number) => { f.index = i + 1; });
        await db.updateScriptFrames(script.id, frames);
        return { success: true, frames, totalFrames: frames.length };
      }),

    validate: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project) throw new Error("Project not found");

        const script = await db.getLatestScript(input.projectId);
        if (!script) throw new Error("No script found for this project");

        // Get all applicable rules
        const ruleChapters = await db.getRulesForScene(project.l2Id);
        const userRulesList = await db.getUserRules({ status: "approved", applicableL2Id: project.l2Id });

        // Collect all "dont" rules
        const dontRules: Array<{ source: string; text: string; severity: string }> = [];
        for (const ch of ruleChapters) {
          const rules = ch.rules as Array<{ type: string; text: string; severity: string }>;
          for (const r of rules) {
            if (r.type === "dont") {
              dontRules.push({ source: ch.title, text: r.text, severity: r.severity });
            }
          }
        }
        for (const r of userRulesList) {
          dontRules.push({ source: "用户自定义规则", text: r.ruleText, severity: r.severity });
        }

        const frames = script.frames as Array<{ index: number; shotType: string; duration: number; description: string }>;

        // Use LLM to validate
        const validationPrompt = `请检查以下分镜脚本是否违反了任何规则。

## 分镜脚本
${JSON.stringify(frames, null, 2)}

## Don't Do 规则列表
${dontRules.map((r, i) => `${i + 1}. [${r.severity}] ${r.text} (来源: ${r.source})`).join("\n")}

## 额外检查
- 总时长是否为${project.duration}秒
- 前3秒是否有强钩子
- 景别是否有变化节奏
- 每帧时长是否在1-3秒范围内

请以JSON格式输出检查结果：
{
  "passed": true/false,
  "violations": [
    {
      "ruleIndex": 1,
      "ruleText": "规则内容",
      "severity": "critical/warning/info",
      "frameIndex": 1,
      "description": "违规说明",
      "suggestion": "修复建议"
    }
  ],
  "totalDurationCheck": { "expected": 15, "actual": 15, "passed": true },
  "hookCheck": { "passed": true, "description": "前3秒钩子评估" }
}`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "你是一个专业的分镜脚本审核员。严格按照规则检查脚本，输出JSON格式的检查结果。" },
            { role: "user", content: validationPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "validation_result",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  passed: { type: "boolean" },
                  violations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        ruleIndex: { type: "integer" },
                        ruleText: { type: "string" },
                        severity: { type: "string" },
                        frameIndex: { type: "integer" },
                        description: { type: "string" },
                        suggestion: { type: "string" },
                      },
                      required: ["ruleIndex", "ruleText", "severity", "frameIndex", "description", "suggestion"],
                      additionalProperties: false,
                    },
                  },
                  totalDurationCheck: {
                    type: "object",
                    properties: {
                      expected: { type: "number" },
                      actual: { type: "number" },
                      passed: { type: "boolean" },
                    },
                    required: ["expected", "actual", "passed"],
                    additionalProperties: false,
                  },
                  hookCheck: {
                    type: "object",
                    properties: {
                      passed: { type: "boolean" },
                      description: { type: "string" },
                    },
                    required: ["passed", "description"],
                    additionalProperties: false,
                  },
                },
                required: ["passed", "violations", "totalDurationCheck", "hookCheck"],
                additionalProperties: false,
              },
            },
          },
        });

        const contentRaw = response.choices?.[0]?.message?.content;
        const content = typeof contentRaw === "string" ? contentRaw : JSON.stringify(contentRaw);
        if (!content) throw new Error("LLM returned empty response");

        const validationResult = JSON.parse(content);

        // Update script with validation result
        const dbConn = await db.getDb();
        if (dbConn) {
          const { scripts: scriptsTable } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await dbConn.update(scriptsTable)
            .set({ validationResult, validationPassed: validationResult.passed })
            .where(eq(scriptsTable.id, script.id));
        }

        return validationResult;
      }),

    get: publicProcedure
      .input(z.object({ projectId: z.number(), version: z.number().optional() }))
      .query(async ({ input }) => {
        if (input.version) {
          return db.getScriptByVersion(input.projectId, input.version);
        }
        return db.getLatestScript(input.projectId);
      }),
  }),

  // ============================================================
  // Anchor Generation
  // ============================================================
  anchor: router({
    generate: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ input }) => {
        const script = await db.getLatestScript(input.projectId);
        if (!script) throw new Error("No script found");

        // Delete old anchors for this project+version before regenerating
        await db.deleteAnchorsForProject(input.projectId, script.version);

        const characters = (script.characters as Array<{ name: string; description: string; anchorPrompt: string }>) ?? [];
        const scenes = (script.scenes as Array<{ name: string; description: string; anchorPrompt: string }>) ?? [];

        const results: Array<{ id: number; type: string; name: string; imageUrl?: string; prompt?: string }> = [];

        // Generate character anchors
        for (const char of characters) {
          try {
            const { url } = await generateImage({ prompt: char.anchorPrompt });
            const anchorId = await db.saveAnchor({
              projectId: input.projectId,
              version: script.version,
              anchorType: "character",
              name: char.name,
              description: char.description,
              prompt: char.anchorPrompt,
              imageUrl: url,
            });
            results.push({ id: anchorId, type: "character", name: char.name, imageUrl: url, prompt: char.anchorPrompt });
          } catch (e) {
            console.error(`[AnchorGen] Failed to generate image for character "${char.name}":`, e instanceof Error ? e.message : e);
            const anchorId = await db.saveAnchor({
              projectId: input.projectId,
              version: script.version,
              anchorType: "character",
              name: char.name,
              description: char.description,
              prompt: char.anchorPrompt,
            });
            results.push({ id: anchorId, type: "character", name: char.name, prompt: char.anchorPrompt });
          }
        }

        // Generate scene anchors
        for (const scene of scenes) {
          try {
            const { url } = await generateImage({ prompt: scene.anchorPrompt });
            const anchorId = await db.saveAnchor({
              projectId: input.projectId,
              version: script.version,
              anchorType: "scene",
              name: scene.name,
              description: scene.description,
              prompt: scene.anchorPrompt,
              imageUrl: url,
            });
            results.push({ id: anchorId, type: "scene", name: scene.name, imageUrl: url, prompt: scene.anchorPrompt });
          } catch (e) {
            console.error(`[AnchorGen] Failed to generate image for scene "${scene.name}":`, e instanceof Error ? e.message : e);
            const anchorId = await db.saveAnchor({
              projectId: input.projectId,
              version: script.version,
              anchorType: "scene",
              name: scene.name,
              description: scene.description,
              prompt: scene.anchorPrompt,
            });
            results.push({ id: anchorId, type: "scene", name: scene.name, prompt: scene.anchorPrompt });
          }
        }

        const successCount = results.filter(r => r.imageUrl).length;
        logInfo("anchor_gen", `Anchors generated: ${successCount}/${results.length} with images`, {
          projectId: input.projectId,
          details: { total: results.length, withImages: successCount, types: results.map(r => r.type) },
        });

        return { anchors: results };
      }),
    regenerateOne: protectedProcedure
      .input(z.object({
        anchorId: z.number(),
        customPrompt: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const dbConn = await db.getDb();
        if (!dbConn) throw new Error("Database not available");

        const { anchors: anchorsTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [anchor] = await dbConn.select().from(anchorsTable).where(eq(anchorsTable.id, input.anchorId)).limit(1);
        if (!anchor) throw new Error("Anchor not found");

        const prompt = input.customPrompt || anchor.prompt || "";

        try {
          const { url } = await generateImage({ prompt });
          await dbConn.update(anchorsTable)
            .set({ imageUrl: url, prompt })
            .where(eq(anchorsTable.id, input.anchorId));
          return { success: true, imageUrl: url, prompt };
        } catch (e: any) {
          // Update prompt even if image gen fails
          if (input.customPrompt) {
            await dbConn.update(anchorsTable)
              .set({ prompt: input.customPrompt })
              .where(eq(anchorsTable.id, input.anchorId));
          }
          throw new Error(`Anchor regeneration failed: ${e.message}`);
        }
      }),
    list: publicProcedure
      .input(z.object({ projectId: z.number(), version: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getAnchors(input.projectId, input.version);
      }),
  }),

  // ============================================================
  // Grid Generation
  // ============================================================
  grid: router({
    generate: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        customPrompt: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project) throw new Error("Project not found");

        const script = await db.getLatestScript(input.projectId);
        if (!script) throw new Error("No script found");

        // Delete old panels for this project+version before regenerating
        await db.deletePanelsForProject(input.projectId, script.version);

        // Get anchors - try current version first, then fall back to all versions
        let anchorsList = await db.getAnchors(input.projectId, script.version);
        if (anchorsList.length === 0) {
          // Fall back to all anchors if none found for current version
          anchorsList = await db.getAnchors(input.projectId);
          console.log(`[GridGen] No anchors for version ${script.version}, using all ${anchorsList.length} anchors`);
        } else {
          console.log(`[GridGen] Found ${anchorsList.length} anchors for version ${script.version}`);
        }
        const frames = script.frames as Array<{ index: number; shotType: string; duration: number; description: string; cameraMovement: string }>;

        const totalPanels = frames.length;
        let rows: number, cols: number;
        if (totalPanels <= 6) { rows = 2; cols = 3; }
        else if (totalPanels <= 8) { rows = 2; cols = 4; }
        else if (totalPanels <= 12) { rows = 3; cols = 4; }
        else if (totalPanels <= 15) { rows = 3; cols = 5; }
        else if (totalPanels <= 20) { rows = 4; cols = 5; }
        else { rows = 4; cols = 6; }

        // ========== Build ordered reference images with explicit numbering ==========
        let gridPrompt = '';
        try {
        const characters = (script.characters as Array<{ name: string; description: string; anchorPrompt?: string }>) ?? [];
        const scenes = (script.scenes as Array<{ name: string; description: string; anchorPrompt?: string }>) ?? [];

        // Separate character and scene anchors that have images
        const charAnchors = anchorsList.filter(a => a.anchorType === 'character' && a.imageUrl && a.imageUrl.startsWith('http'));
        const sceneAnchors = anchorsList.filter(a => a.anchorType === 'scene' && a.imageUrl && a.imageUrl.startsWith('http'));
        console.log(`[GridGen] Anchor refs: ${charAnchors.length} characters, ${sceneAnchors.length} scenes`);

        // Build ordered image list: [char1, char2, ..., scene1, scene2, ..., gridTemplate]
        // Each image gets a clear number and description in the prompt
        const orderedImages: Array<{ url: string }> = [];
        const imageDescriptions: string[] = [];
        let imgIdx = 1;

        // 1) Character anchor images
        for (const ca of charAnchors) {
          orderedImages.push({ url: ca.imageUrl! });
          imageDescriptions.push(`Image #${imgIdx}: CHARACTER "${ca.name}" reference photo. ${ca.prompt || ca.description || ''}`);
          imgIdx++;
        }

        // 2) Scene anchor images
        for (const sa of sceneAnchors) {
          orderedImages.push({ url: sa.imageUrl! });
          imageDescriptions.push(`Image #${imgIdx}: SCENE "${sa.name}" reference photo. ${sa.prompt || sa.description || ''}`);
          imgIdx++;
        }

        // 3) Grid layout template image (generated by Sharp, small data URL)
        const gridTemplateDataUrl = await generateGridTemplateDataUrl({ rows, cols, totalPanels });
        orderedImages.push({ url: gridTemplateDataUrl });
        imageDescriptions.push(`Image #${imgIdx}: GRID LAYOUT TEMPLATE. This shows the exact ${rows}x${cols} uniform grid layout you MUST follow. Every panel must be the SAME SIZE as shown in this template.`);

        console.log(`[GridGen] Prepared ${orderedImages.length} reference images: ${charAnchors.length} chars, ${sceneAnchors.length} scenes, 1 grid template`);

        // ========== Build prompt with explicit image-to-content mapping ==========
        // Build character appearance descriptions from anchor prompts (detailed physical features)
        const charAppearanceLines = charAnchors.map(ca => {
          const charData = characters.find(c => c.name === ca.name);
          return `- "${ca.name}": ${ca.prompt || charData?.description || ca.description || 'See reference image'}`;
        }).join('\n');

        const sceneAppearanceLines = sceneAnchors.map(sa => {
          const sceneData = scenes.find(s => s.name === sa.name);
          return `- "${sa.name}": ${sa.prompt || sceneData?.description || sa.description || 'See reference image'}`;
        }).join('\n');

        // Panel descriptions with character names highlighted
        const panelLines = frames.map(f => `Panel ${f.index} [${f.shotType}] (${f.duration}s, camera: ${f.cameraMovement}): ${f.description}`).join('\n');

        gridPrompt = input.customPrompt || `I am providing ${orderedImages.length} reference images. Here is what each image shows:

${imageDescriptions.join('\n')}

Your task: Create a professional ${rows}x${cols} cinematic storyboard grid with exactly ${totalPanels} panels.

CRITICAL LAYOUT RULE:
- Follow the GRID LAYOUT TEMPLATE (Image #${imgIdx}) EXACTLY - all panels must be the SAME SIZE
- ${rows} rows x ${cols} columns, uniform white borders between panels
- Panels numbered 1-${totalPanels}, reading left-to-right, top-to-bottom
- NO text, NO titles, NO captions anywhere

CHARACTER CONSISTENCY (CRITICAL):
The characters in EVERY panel MUST look EXACTLY like the people in the character reference images:
${charAppearanceLines || characters.map(c => `- "${c.name}": ${c.description}`).join('\n')}
Same face, same ethnicity, same hair, same clothing, same body proportions across ALL panels.

SCENE REFERENCE:
${sceneAppearanceLines || scenes.map(s => `- "${s.name}": ${s.description}`).join('\n')}

PANEL-BY-PANEL BREAKDOWN:
${panelLines}

STYLE:
- Photorealistic cinematic quality (ARRI Alexa / RED camera look)
- Consistent character appearance across ALL panels
- Cinematic lighting matching each panel's mood
- Natural skin textures, realistic environments, atmospheric depth`;

          console.log(`[GridGen] Generating grid with ${orderedImages.length} reference images`);
          const { url: gridImageUrl } = await generateImage({
            prompt: gridPrompt,
            originalImages: orderedImages,
          });

          const gridId = await db.saveGrid({
            projectId: input.projectId,
            version: script.version,
            rows,
            cols,
            totalPanels,
            gridImageUrl,
            generationPrompt: gridPrompt,
          });

          // Create panel records
          const panelData = frames.map(f => ({
            gridId,
            projectId: input.projectId,
            version: script.version,
            panelIndex: f.index,
            shotType: f.shotType,
            duration: String(f.duration),
            description: f.description,
            cameraMovement: f.cameraMovement,
          }));
          await db.savePanels(panelData);

          await db.updateProject(input.projectId, { status: "grid_generated" });

          logInfo("grid_gen", `Grid generated: ${rows}x${cols} (${totalPanels} panels) with image`, {
            projectId: input.projectId,
            details: { gridId, rows, cols, totalPanels },
          });

          return { gridId, gridImageUrl, rows, cols, totalPanels };
        } catch (e: any) {
          // Even if image generation or preparation fails, save the grid structure
          console.error(`[GridGen] Grid generation failed:`, e?.message || e);
          const gridId = await db.saveGrid({
            projectId: input.projectId,
            version: script.version,
            rows,
            cols,
            totalPanels,
            generationPrompt: gridPrompt,
          });

          const panelData = frames.map(f => ({
            gridId,
            projectId: input.projectId,
            version: script.version,
            panelIndex: f.index,
            shotType: f.shotType,
            duration: String(f.duration),
            description: f.description,
            cameraMovement: f.cameraMovement,
          }));
          await db.savePanels(panelData);

          await db.updateProject(input.projectId, { status: "grid_generated" });

          logError("grid_gen", `Grid image generation failed: ${e instanceof Error ? e.message : String(e)}`, {
            projectId: input.projectId,
            details: { gridId, rows, cols, totalPanels, error: e instanceof Error ? e.stack : String(e) },
          });

          return { gridId, gridImageUrl: null, rows, cols, totalPanels, error: "Image generation failed, grid structure saved" };
        }
      }),
    get: publicProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getLatestGrid(input.projectId);
      }),
    // Regenerate Grid from modified panels: uses original grid + modified panels as reference
    regenerateFromPanels: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        modifiedPanelIndices: z.array(z.number()).optional(), // auto-detect if not provided
      }))
      .mutation(async ({ input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project) throw new Error("Project not found");

        const script = await db.getLatestScript(input.projectId);
        if (!script) throw new Error("No script found");

        const grid = await db.getLatestGrid(input.projectId);
        if (!grid) throw new Error("No grid found");
        if (!grid.gridImageUrl) throw new Error("Grid has no image");

        const panelsList = await db.getPanels(input.projectId, grid.version);
        const frames = script.frames as Array<{ index: number; shotType: string; duration: number; description: string; cameraMovement: string }>;

        // Get anchors
        let anchorsList = await db.getAnchors(input.projectId, script.version);
        if (anchorsList.length === 0) anchorsList = await db.getAnchors(input.projectId);

        // Detect which panels have been modified (status = 'fixed' or have fixHistory)
        const modifiedIndices = input.modifiedPanelIndices || panelsList
          .filter(p => p.status === 'fixed' || ((p.fixHistory as any[])?.length > 0))
          .map(p => p.panelIndex);

        if (modifiedIndices.length === 0) {
          throw new Error("没有检测到已修改的面板，请先修复面板后再重新合成Grid");
        }

        const rows = grid.rows;
        const cols = grid.cols;
        const totalPanels = grid.totalPanels;

        try {
        // ========== Build reference images ==========
        const orderedImages: Array<{ url: string }> = [];
        const imageDescriptions: string[] = [];
        let imgIdx = 1;

        // 1) Original Grid image - PRIMARY style reference
        orderedImages.push({ url: grid.gridImageUrl });
        imageDescriptions.push(`Image #${imgIdx}: ORIGINAL STORYBOARD GRID (${rows}x${cols}). This is the PRIMARY STYLE REFERENCE. The new grid MUST match this exact visual style, color grading, lighting quality, and artistic approach.`);
        imgIdx++;

        // 2) Character anchor images
        const charAnchors = anchorsList.filter(a => a.anchorType === 'character' && a.imageUrl?.startsWith('http'));
        for (const ca of charAnchors) {
          orderedImages.push({ url: ca.imageUrl! });
          imageDescriptions.push(`Image #${imgIdx}: CHARACTER "${ca.name}" reference. ${ca.prompt || ca.description || ''}`);
          imgIdx++;
        }

        // 3) Scene anchor images
        const sceneAnchors = anchorsList.filter(a => a.anchorType === 'scene' && a.imageUrl?.startsWith('http'));
        for (const sa of sceneAnchors) {
          orderedImages.push({ url: sa.imageUrl! });
          imageDescriptions.push(`Image #${imgIdx}: SCENE "${sa.name}" reference. ${sa.prompt || sa.description || ''}`);
          imgIdx++;
        }

        // 4) Modified panel images as content reference
        const modifiedPanelImages: Array<{ index: number; imgNum: number }> = [];
        for (const pi of modifiedIndices) {
          const panel = panelsList.find(p => p.panelIndex === pi);
          if (panel?.panelImageUrl?.startsWith('http')) {
            orderedImages.push({ url: panel.panelImageUrl });
            modifiedPanelImages.push({ index: pi, imgNum: imgIdx });
            imageDescriptions.push(`Image #${imgIdx}: MODIFIED PANEL #${pi} - this is the UPDATED content for panel position ${pi}. Use this exact image content for panel ${pi} in the new grid.`);
            imgIdx++;
          }
        }

        // 5) Grid layout template
        const gridTemplateDataUrl = await generateGridTemplateDataUrl({ rows, cols, totalPanels });
        orderedImages.push({ url: gridTemplateDataUrl });
        imageDescriptions.push(`Image #${imgIdx}: GRID LAYOUT TEMPLATE. ${rows}x${cols} uniform grid layout to follow.`);

        console.log(`[GridRegen] ${orderedImages.length} ref images: 1 original grid, ${charAnchors.length} chars, ${sceneAnchors.length} scenes, ${modifiedPanelImages.length} modified panels, 1 template`);

        // ========== Build prompt ==========
        const characters = (script.characters as Array<{ name: string; description: string }>) ?? [];
        const scenes = (script.scenes as Array<{ name: string; description: string }>) ?? [];
        const panelLines = frames.map(f => `Panel ${f.index} [${f.shotType}] (${f.duration}s, ${f.cameraMovement}): ${f.description}`).join('\n');

        const modifiedPanelRefs = modifiedPanelImages.map(mp => `- Panel #${mp.index}: Use the content from Image #${mp.imgNum} (the modified version)`).join('\n');
        const unchangedIndices = frames.map(f => f.index).filter(i => !modifiedIndices.includes(i));
        const unchangedList = unchangedIndices.join(', ');

        const regenPrompt = `I am providing ${orderedImages.length} reference images. Here is what each image shows:

${imageDescriptions.join('\n')}

Your task: Regenerate the ${rows}x${cols} storyboard grid with SELECTIVE PANEL UPDATES.

CRITICAL RULES:
1. STYLE CONSISTENCY: The new grid MUST be visually IDENTICAL in style to Image #1 (the original grid). Same color grading, same lighting, same camera quality, same artistic approach.
2. UNCHANGED PANELS (${unchangedList}): These panels must look EXACTLY the same as in the original grid (Image #1). Same composition, same characters, same everything.
3. MODIFIED PANELS: Only these panels should be updated with new content:
${modifiedPanelRefs}
4. The modified panels must MATCH the style of the unchanged panels - same color temperature, same post-processing, same level of photorealism.
5. Layout: ${rows}x${cols} uniform grid, white borders, panels numbered 1-${totalPanels} left-to-right top-to-bottom.
6. NO text, NO titles, NO captions.

CHARACTER CONSISTENCY:
${characters.map(c => `- "${c.name}": ${c.description}`).join('\n')}
Same face, same clothing, same proportions across ALL panels.

PANEL-BY-PANEL BREAKDOWN:
${panelLines}

STYLE: Photorealistic cinematic quality matching the original grid exactly.`;

          console.log(`[GridRegen] Generating new grid with ${modifiedIndices.length} modified panels: [${modifiedIndices.join(', ')}]`);
          const { url: newGridImageUrl } = await generateImage({
            prompt: regenPrompt,
            originalImages: orderedImages,
          });

          // Save as new grid version
          const newVersion = (grid.version || 1) + 1;
          const gridId = await db.saveGrid({
            projectId: input.projectId,
            version: newVersion,
            rows,
            cols,
            totalPanels,
            gridImageUrl: newGridImageUrl,
            generationPrompt: regenPrompt,
          });

          // Copy panels to new version, keeping modified panel images
          const newPanelData = frames.map(f => {
            const existingPanel = panelsList.find(p => p.panelIndex === f.index);
            return {
              gridId,
              projectId: input.projectId,
              version: newVersion,
              panelIndex: f.index,
              shotType: f.shotType,
              duration: String(f.duration),
              description: existingPanel?.description || f.description,
              cameraMovement: f.cameraMovement,
              panelImageUrl: existingPanel?.panelImageUrl || undefined,
              status: existingPanel?.status || 'pending',
            };
          });
          await db.savePanels(newPanelData);

          // Update script version
          await db.updateProject(input.projectId, { currentVersion: newVersion });

          logInfo("grid_regen", `Grid regenerated with ${modifiedIndices.length} modified panels: [${modifiedIndices.join(', ')}]`, {
            projectId: input.projectId,
            details: { gridId, newVersion, modifiedIndices, totalRefs: orderedImages.length },
          });

          return { gridId, gridImageUrl: newGridImageUrl, rows, cols, totalPanels, modifiedPanels: modifiedIndices, version: newVersion };
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          logError("grid_regen", `Grid regeneration failed: ${errMsg}`, {
            projectId: input.projectId,
            details: { modifiedIndices, error: errMsg },
          });
          throw new Error(`Grid重新合成失败: ${errMsg}`);
        }
      }),
  }),

  // ============================================================
  // Panel Adjustment
  // ============================================================
  panel: router({
    list: publicProcedure
      .input(z.object({ projectId: z.number(), version: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getPanels(input.projectId, input.version);
      }),
    // Extract all panels from grid image and save individual panel images
    extractAll: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ input }) => {
        const grid = await db.getLatestGrid(input.projectId);
        if (!grid) throw new Error("No grid found");
        if (!grid.gridImageUrl) throw new Error("Grid has no image");

        // IMPORTANT: filter panels by grid.version so we update the correct version
        const panelsList = await db.getPanels(input.projectId, grid.version);
        console.log(`[PanelExtract] Found ${panelsList.length} panels for project ${input.projectId} version ${grid.version}`);
        const results: Array<{ panelIndex: number; imageUrl: string }> = [];

        // Collect panel descriptions for AI redraw
        const panelDescriptions: string[] = [];
        for (let i = 1; i <= grid.totalPanels; i++) {
          const p = panelsList.find(pp => pp.panelIndex === i);
          panelDescriptions.push(p?.description || "");
        }

        try {
          const extracted = await extractAllPanels({
            gridImageUrl: grid.gridImageUrl,
            rows: grid.rows,
            cols: grid.cols,
            totalPanels: grid.totalPanels,
            panelDescriptions,
          });

          for (const { panelIndex, buffer } of extracted) {
            const fileName = `panel-${panelIndex}-${Date.now()}.png`;
            const url = await uploadFile({
              buffer,
              mimeType: "image/png",
              fileName,
              s3Key: `projects/${input.projectId}/panels/${fileName}`,
            });

            console.log(`[PanelExtract] Panel ${panelIndex} uploaded: ${url.substring(0, 80)}...`);

            // Update panel record - match by panelIndex within the correct version
            const panel = panelsList.find(p => p.panelIndex === panelIndex);
            if (panel) {
              await db.updatePanel(panel.id, { panelImageUrl: url });
              console.log(`[PanelExtract] Updated panel id=${panel.id} panelIndex=${panelIndex} with image URL`);
            } else {
              console.warn(`[PanelExtract] No panel record found for panelIndex=${panelIndex} in version ${grid.version}`);
            }
            results.push({ panelIndex, imageUrl: url });
          }

          logInfo("panel_extract", `Extracted ${results.length} panels from grid`, {
            projectId: input.projectId,
            details: { gridId: grid.id, gridVersion: grid.version, rows: grid.rows, cols: grid.cols, totalPanels: grid.totalPanels, updatedPanelIds: panelsList.map(p => p.id) },
          }).catch(() => {});
        } catch (e) {
          logError("panel_extract", `Panel extraction failed: ${e instanceof Error ? e.message : String(e)}`, {
            projectId: input.projectId,
            details: { error: e instanceof Error ? e.stack : String(e) },
          }).catch(() => {});
          throw e;
        }

        return { panels: results };
      }),
    // Extract a single panel from grid image
    extractOne: protectedProcedure
      .input(z.object({ panelId: z.number() }))
      .mutation(async ({ input }) => {
        const dbConn = await db.getDb();
        if (!dbConn) throw new Error("Database not available");
        const { panels: panelsTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [panel] = await dbConn.select().from(panelsTable).where(eq(panelsTable.id, input.panelId)).limit(1);
        if (!panel) throw new Error("Panel not found");

        const grid = await db.getLatestGrid(panel.projectId);
        if (!grid || !grid.gridImageUrl) throw new Error("Grid image not found");

        const buffer = await extractPanel({
          gridImageUrl: grid.gridImageUrl,
          rows: grid.rows,
          cols: grid.cols,
          panelIndex: panel.panelIndex,
          panelDescription: panel.description || undefined,
        });

        const fileName = `panel-${panel.panelIndex}-${Date.now()}.png`;
        const url = await uploadFile({
          buffer,
          mimeType: "image/png",
          fileName,
          s3Key: `projects/${panel.projectId}/panels/${fileName}`,
        });
        await db.updatePanel(panel.id, { panelImageUrl: url });

        return { panelIndex: panel.panelIndex, imageUrl: url };
      }),
    flag: protectedProcedure
      .input(z.object({
        panelId: z.number(),
        issueDescription: z.string(),
      }))
      .mutation(async ({ input }) => {
        await db.updatePanel(input.panelId, {
          status: "flagged",
          issueDescription: input.issueDescription,
        });

        // Record experience
        const dbConn = await db.getDb();
        if (dbConn) {
          const { panels: panelsTable } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const [panel] = await dbConn.select().from(panelsTable).where(eq(panelsTable.id, input.panelId)).limit(1);
          if (panel) {
            const project = await db.getProjectById(panel.projectId);
            await db.saveExperienceRecord({
              projectId: panel.projectId,
              categoryId: project ? `${project.l1Id}.${project.l2Id}.${project.l3Id}` : undefined,
              actionType: "panel_fix",
              panelIndex: panel.panelIndex,
              originalContent: { description: panel.description, shotType: panel.shotType },
              issueDescription: input.issueDescription,
            });
          }
        }

        return { success: true };
      }),
    fix: protectedProcedure
      .input(z.object({
        panelId: z.number(),
        fixType: z.enum(["regenerate", "inpaint", "reference_based"]),
        modifiedDescription: z.string().optional(),
        referenceImageUrl: z.string().optional(),
        referenceImageUrls: z.array(z.string()).optional(), // multiple reference images (original panel, other frames, etc.)
        maskDataUrl: z.string().optional(), // base64 data URL of the mask image (white=fix, black=keep)
      }))
      .mutation(async ({ input }) => {
        const dbConn = await db.getDb();
        if (!dbConn) throw new Error("Database not available");

        const { panels: panelsTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const [panel] = await dbConn.select().from(panelsTable).where(eq(panelsTable.id, input.panelId)).limit(1);
        if (!panel) throw new Error("Panel not found");

        // Auto-collect anchor images for reference
        const anchorsList = await db.getAnchors(panel.projectId);
        const anchorRefImages = anchorsList
          .filter(a => a.imageUrl && a.imageUrl.startsWith("http"))
          .map(a => ({ url: a.imageUrl!, label: a.name || 'anchor' }));

        // Get original Grid image as style reference
        const grid = await db.getLatestGrid(panel.projectId);
        const gridImageUrl = grid?.gridImageUrl;

        let newImageUrl: string | undefined;
        const prompt = input.modifiedDescription || panel.description || "";

        // Build reference images: GRID FIRST (style ref) + anchors + original panel + user refs
        const referenceImages: Array<{ url: string; mimeType?: string }> = [];
        // 1) Original Grid image as primary style reference
        if (gridImageUrl && gridImageUrl.startsWith("http")) {
          referenceImages.push({ url: gridImageUrl });
        }
        // 2) Anchor images for character/scene consistency
        for (const ar of anchorRefImages) {
          referenceImages.push({ url: ar.url });
        }
        // 3) Original panel image
        if (panel.panelImageUrl && panel.panelImageUrl.startsWith("http")) {
          referenceImages.push({ url: panel.panelImageUrl });
        }
        // 4) Single user-provided reference
        if (input.referenceImageUrl && input.referenceImageUrl.startsWith("http")) {
          referenceImages.push({ url: input.referenceImageUrl });
        }
        // 5) Multiple user-selected reference images (other frames, etc.)
        if (input.referenceImageUrls) {
          for (const refUrl of input.referenceImageUrls) {
            if (refUrl.startsWith("http") && !referenceImages.some(r => r.url === refUrl)) {
              referenceImages.push({ url: refUrl });
            }
          }
        }
        // 6) Mask for inpaint mode
        if (input.maskDataUrl && input.fixType === "inpaint") {
          referenceImages.push({ url: input.maskDataUrl, mimeType: "image/png" });
        }

        console.log(`[PanelFix] Panel #${panel.panelIndex}: ${referenceImages.length} ref images (grid: ${!!gridImageUrl}, anchors: ${anchorRefImages.length}, userRefs: ${(input.referenceImageUrls?.length || 0)})`);

        // Build anchor description for prompt
        const anchorDesc = anchorRefImages.map(a => a.label).join(', ');

        // Build enhanced prompt based on fix type - with strong style consistency emphasis
        let enhancedPrompt: string;
        if (input.fixType === "inpaint" && input.maskDataUrl) {
          enhancedPrompt = `Edit this storyboard panel image. The white areas in the mask image indicate the regions that need to be modified. Fix those regions according to this description: ${prompt}

CRITICAL STYLE REQUIREMENTS:
- The FIRST reference image is the ORIGINAL STORYBOARD GRID - you MUST match its exact visual style, color grading, lighting, and artistic quality
- Maintain IDENTICAL art style: same color palette, same lighting mood, same level of photorealism
- Character reference images (${anchorDesc}) show the exact appearance of characters - match them precisely
- Keep all non-masked areas exactly the same
- The result must look like it belongs in the same storyboard as the grid image`;
        } else {
          enhancedPrompt = `Regenerate this storyboard panel with the following description: ${prompt}

CRITICAL STYLE REQUIREMENTS:
- The FIRST reference image is the ORIGINAL STORYBOARD GRID - you MUST match its exact visual style, color grading, lighting, and artistic quality
- Your output must look like it was generated as part of that same grid - same camera quality, same color temperature, same post-processing
- Character reference images (${anchorDesc}) show the exact appearance of characters - match their face, hair, clothing, body proportions precisely
- Maintain the same photorealistic cinematic quality (ARRI Alexa / RED camera look)
- The result must be visually indistinguishable in style from the other panels in the grid`;
        }

        try {
          const { url } = await generateImage({
            prompt: enhancedPrompt,
            originalImages: referenceImages.length > 0 ? referenceImages : undefined,
          });
          newImageUrl = url;
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          logError("panel_fix", `Panel #${panel.panelIndex} image generation failed: ${errMsg}`, {
            projectId: panel.projectId,
            panelIndex: panel.panelIndex,
            details: { fixType: input.fixType, hasMask: !!input.maskDataUrl, error: errMsg },
          });
        }

        const fixEntry = {
          timestamp: new Date().toISOString(),
          action: input.fixType,
          description: input.modifiedDescription,
          result: newImageUrl ? "success" : "failed",
        };

        const existingHistory = (panel.fixHistory as any[]) ?? [];
        existingHistory.push(fixEntry);

        await db.updatePanel(input.panelId, {
          status: newImageUrl ? "fixed" : "fixing",
          panelImageUrl: newImageUrl || panel.panelImageUrl || undefined,
          fixHistory: existingHistory,
          description: input.modifiedDescription || panel.description || undefined,
          referenceImageUrls: input.referenceImageUrl
            ? [...((panel.referenceImageUrls as string[]) ?? []), input.referenceImageUrl]
            : (panel.referenceImageUrls as any) ?? undefined,
        });

        // Record experience
        const project = await db.getProjectById(panel.projectId);
        await db.saveExperienceRecord({
          projectId: panel.projectId,
          categoryId: project ? `${project.l1Id}.${project.l2Id}.${project.l3Id}` : undefined,
          actionType: "panel_fix",
          panelIndex: panel.panelIndex,
          originalContent: { description: panel.description, imageUrl: panel.panelImageUrl },
          issueDescription: panel.issueDescription || undefined,
          fixDescription: `${input.fixType}: ${input.modifiedDescription || "no description"}`,
        });

        logInfo("panel_fix", `Panel #${panel.panelIndex} fix (${input.fixType}): ${newImageUrl ? 'success' : 'failed'}`, {
          projectId: panel.projectId,
          panelIndex: panel.panelIndex,
          details: { fixType: input.fixType, hasNewImage: !!newImageUrl, panelId: input.panelId },
        });

        return { success: true, newImageUrl };
      }),
    updatePrompt: protectedProcedure
      .input(z.object({
        promptId: z.number(),
        promptText: z.string().optional(),
        model: z.string().optional(),
        controlStrategy: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { promptId, ...data } = input;
        await db.updatePrompt(promptId, data as any);
        return { success: true };
      }),
  }),

  // ============================================================
  // Prompt Generation
  // ============================================================
  prompt: router({
    generate: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ input }) => {
        const project = await db.getProjectById(input.projectId);
        if (!project) throw new Error("Project not found");

        const script = await db.getLatestScript(input.projectId);
        if (!script) throw new Error("No script found");

        const panelsList = await db.getPanels(input.projectId);
        const anchorsList = await db.getAnchors(input.projectId);

        const frames = script.frames as Array<{
          index: number; shotType: string; duration: number;
          description: string; cameraMovement: string;
        }>;

        // Get prompt generation rules
        const promptRules = await db.getRulesForScene(project.l2Id);
        const aiPromptRules = promptRules.filter(ch => ch.category === "ai_prompt");

        const rulesText = aiPromptRules.map(ch => {
          const rules = ch.rules as Array<{ type: string; text: string }>;
          return rules.map(r => `- [${r.type.toUpperCase()}] ${r.text}`).join("\n");
        }).join("\n");

        const anchorInfo = anchorsList.map(a => `${a.anchorType} "${a.name}": ${a.description}`).join("\n");

        const systemPrompt = `你是一个AI视频生成提示词专家。根据分镜脚本和角色/场景锚点，为每一帧生成结构化的视频生成参数。

## 提示词规则
${rulesText}

## 通用公式
镜头类型 + 视角 + 主体 + 动作 + 运镜 + 光影 + 材质 + 特效 + 渲染 + 环境交互 + 过渡

## 角色/场景锚点
${anchorInfo}

## 控制策略选择指南
- first_frame: 第一帧有明确的起始画面时使用
- last_frame: 需要精确控制结束画面时使用
- first_last_frame: 需要精确控制起止画面时使用（如两个关键姿势之间的过渡）
- reference_frame: 需要参考已有画面风格但不严格匹配时使用

## 模型选择指南
- seedance-1.5-pro: 适合人物动作、表情变化
- kling-2.6: 适合场景转换、特效
- veo3.1-fast: 适合快速迭代、一般场景

请为每一帧输出JSON数组，每个元素包含：
{
  "panelIndex": 1,
  "promptText": "英文prompt",
  "negativePrompt": "英文negative prompt",
  "model": "seedance-1.5-pro/kling-2.6/veo3.1-fast",
  "controlStrategy": "first_frame/last_frame/first_last_frame/reference_frame",
  "shotType": "CU",
  "cameraAngle": "eye level/low angle/high angle/bird's eye/dutch angle",
  "subject": "主体描述",
  "action": "动作描述",
  "cameraMovement": "运镜方式",
  "lighting": "光线描述",
  "texture": "材质质感",
  "effects": "特效",
  "transition": "过渡方式"
}`;

        const userPrompt = `分镜脚本：
${frames.map(f => `Panel ${f.index}: [${f.shotType}] ${f.description} (${f.duration}s, ${f.cameraMovement})`).join("\n")}

请为每一帧生成视频生成参数。`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "prompt_list",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  prompts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        panelIndex: { type: "integer" },
                        promptText: { type: "string" },
                        negativePrompt: { type: "string" },
                        model: { type: "string" },
                        controlStrategy: { type: "string" },
                        shotType: { type: "string" },
                        cameraAngle: { type: "string" },
                        subject: { type: "string" },
                        action: { type: "string" },
                        cameraMovement: { type: "string" },
                        lighting: { type: "string" },
                        texture: { type: "string" },
                        effects: { type: "string" },
                        transition: { type: "string" },
                      },
                      required: ["panelIndex", "promptText", "negativePrompt", "model", "controlStrategy", "shotType", "cameraAngle", "subject", "action", "cameraMovement", "lighting", "texture", "effects", "transition"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["prompts"],
                additionalProperties: false,
              },
            },
          },
        });

        const contentRaw = response.choices?.[0]?.message?.content;
        const content = typeof contentRaw === "string" ? contentRaw : JSON.stringify(contentRaw);
        if (!content) throw new Error("LLM returned empty response");

        const parsed = JSON.parse(content);

        // Match prompts to panels and save
        const promptData = parsed.prompts.map((p: any) => {
          const panel = panelsList.find(pan => pan.panelIndex === p.panelIndex);
          return {
            panelId: panel?.id ?? 0,
            projectId: input.projectId,
            version: script.version,
            promptText: p.promptText,
            negativePrompt: p.negativePrompt,
            model: p.model,
            controlStrategy: p.controlStrategy as any,
            shotType: p.shotType,
            cameraAngle: p.cameraAngle,
            subject: p.subject,
            action: p.action,
            cameraMovement: p.cameraMovement,
            lighting: p.lighting,
            texture: p.texture,
            effects: p.effects,
            transition: p.transition,
          };
        });

        await db.savePrompts(promptData);

        logInfo("prompt_gen", `Prompts generated: ${parsed.prompts.length} prompts for ${frames.length} frames`, {
          projectId: input.projectId,
          details: { promptCount: parsed.prompts.length, models: Array.from(new Set(parsed.prompts.map((p: any) => p.model))) },
        });

        return { prompts: parsed.prompts };
      }),
    list: publicProcedure
      .input(z.object({ projectId: z.number(), version: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getPrompts(input.projectId, input.version);
      }),
  }),

  // ============================================================
  // Version History & Rollback
  // ============================================================
  version: router({
    history: publicProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        const scriptVersions = await db.getScriptVersions(input.projectId);
        const gridVersions = await db.getGridVersions(input.projectId);
        const promptVersions = await db.getPromptVersions(input.projectId);
        return { scriptVersions, gridVersions, promptVersions };
      }),
    rollback: protectedProcedure
      .input(z.object({ projectId: z.number(), targetVersion: z.number() }))
      .mutation(async ({ input }) => {
        return db.rollbackToVersion(input.projectId, input.targetVersion);
      }),
  }),

  // ============================================================
  // Experience Feedback Loop
  // ============================================================
  experience: router({
    list: publicProcedure
      .input(z.object({
        categoryId: z.string().optional(),
        actionType: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getExperienceRecords(input);
      }),
    summary: publicProcedure.query(async () => {
      return db.getExperienceSummary();
    }),
    extractRules: adminProcedure.mutation(async () => {
      const records = await db.getExperienceRecords();
      if (records.length === 0) return { rules: [], message: "No experience records to analyze" };

      const recordsSummary = records.slice(0, 50).map(r => ({
        actionType: r.actionType,
        category: r.categoryId,
        issue: r.issueDescription,
        fix: r.fixDescription,
        ruleCategory: r.ruleCategory,
      }));

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `你是一个分镜质量分析专家。分析以下调整记录，提炼出高频问题并转化为可复用的规则。

输出JSON格式：
{
  "rules": [
    {
      "ruleType": "do/dont",
      "ruleText": "规则描述",
      "applicableL2Ids": ["场景ID列表"],
      "severity": "critical/warning/info",
      "evidenceCount": 3,
      "reasoning": "提炼理由"
    }
  ]
}`
          },
          { role: "user", content: JSON.stringify(recordsSummary) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "extracted_rules",
            strict: true,
            schema: {
              type: "object",
              properties: {
                rules: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      ruleType: { type: "string" },
                      ruleText: { type: "string" },
                      applicableL2Ids: { type: "array", items: { type: "string" } },
                      severity: { type: "string" },
                      evidenceCount: { type: "integer" },
                      reasoning: { type: "string" },
                    },
                    required: ["ruleType", "ruleText", "applicableL2Ids", "severity", "evidenceCount", "reasoning"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["rules"],
              additionalProperties: false,
            },
          },
        },
      });

      const contentRaw = response.choices?.[0]?.message?.content;
        const content = typeof contentRaw === "string" ? contentRaw : JSON.stringify(contentRaw);
      if (!content) return { rules: [], message: "LLM returned empty response" };

      const parsed = JSON.parse(content);

      // Save extracted rules as pending
      for (const rule of parsed.rules) {
        await db.saveUserRule({
          ruleType: rule.ruleType as "do" | "dont",
          ruleText: rule.ruleText,
          applicableL2Ids: rule.applicableL2Ids,
          severity: rule.severity as "critical" | "warning" | "info",
          evidenceCount: rule.evidenceCount,
        });
      }

      return { rules: parsed.rules, message: `Extracted ${parsed.rules.length} rules` };
    }),
  }),

  // ============================================================
  // KB Export
  // ============================================================
  export: router({
    create: adminProcedure
      .input(z.object({
        exportType: z.enum(["full", "incremental", "by_category", "rules"]),
        filterCriteria: z.object({
          l1Id: z.string().optional(),
          l2Id: z.string().optional(),
          l3Id: z.string().optional(),
          since: z.string().optional(),
        }).optional(),
      }))
      .mutation(async ({ input }) => {
        const exportId = await db.createExportRecord({
          exportType: input.exportType,
          filterCriteria: input.filterCriteria,
        });

        // Process export
        try {
          let records: any[] = [];

          if (input.exportType === "rules") {
            const rules = await db.getUserRules({ status: "approved" });
            records = rules;
          } else {
            const filters: any = {};
            if (input.filterCriteria?.l1Id) filters.l1Id = input.filterCriteria.l1Id;
            if (input.filterCriteria?.l2Id) filters.l2Id = input.filterCriteria.l2Id;
            if (input.filterCriteria?.l3Id) filters.l3Id = input.filterCriteria.l3Id;
            if (input.filterCriteria?.since) filters.since = new Date(input.filterCriteria.since);

            const confirmedProjects = await db.getConfirmedProjects(filters);

            for (const proj of confirmedProjects) {
              const script = await db.getLatestScript(proj.id);
              const anchorsList = await db.getAnchors(proj.id);
              const grid = await db.getLatestGrid(proj.id);
              const panelsList = await db.getPanels(proj.id);
              const promptsList = await db.getPrompts(proj.id);

              records.push({
                project: {
                  id: proj.id,
                  title: proj.title,
                  l1Id: proj.l1Id,
                  l2Id: proj.l2Id,
                  l3Id: proj.l3Id,
                  duration: proj.duration,
                },
                script: script ? { frames: script.frames, characters: script.characters, scenes: script.scenes } : null,
                anchors: anchorsList.map(a => ({ type: a.anchorType, name: a.name, imageUrl: a.imageUrl })),
                grid: grid ? { rows: grid.rows, cols: grid.cols, imageUrl: grid.gridImageUrl } : null,
                panels: panelsList.map(p => ({
                  index: p.panelIndex,
                  shotType: p.shotType,
                  duration: p.duration,
                  description: p.description,
                })),
                prompts: promptsList.map(p => ({
                  panelIndex: panelsList.find(pan => pan.id === p.panelId)?.panelIndex,
                  promptText: p.promptText,
                  model: p.model,
                  controlStrategy: p.controlStrategy,
                })),
              });
            }
          }

          // Generate JSONL content
          const jsonlContent = records.map(r => JSON.stringify(r)).join("\n");
          const fileName = `export_${input.exportType}_${Date.now()}.jsonl`;

          // Upload to storage (try ToAPIs for image, or return inline for JSONL)
          let url: string;
          try {
            // Try S3 storage first
            const result = await storagePut(
              `exports/${fileName}`,
              Buffer.from(jsonlContent, "utf-8"),
              "application/jsonl"
            );
            url = result.url;
          } catch {
            // If S3 not available, return as data URL
            const b64 = Buffer.from(jsonlContent, "utf-8").toString("base64");
            url = `data:application/jsonl;base64,${b64}`;
          }

          await db.updateExportRecord(exportId, {
            status: "completed",
            filePath: url,
            recordCount: records.length,
            completedAt: new Date(),
          });

          return { exportId, fileUrl: url, recordCount: records.length };
        } catch (e: any) {
          await db.updateExportRecord(exportId, { status: "failed" });
          throw new Error(`Export failed: ${e.message}`);
        }
      }),
    list: publicProcedure.query(async () => {
      return db.getExportRecords();
    }),
   }),

  // ============================================================
  // System Prompt Management
  // ============================================================
  systemPrompt: router({
    list: protectedProcedure
      .input(z.object({ category: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return db.listSystemPrompts(input?.category);
      }),
    get: protectedProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => {
        return db.getSystemPrompt(input.key);
      }),
    upsert: adminProcedure
      .input(z.object({
        key: z.string().min(1).max(64),
        name: z.string().min(1),
        description: z.string().optional(),
        category: z.string().min(1),
        content: z.string().min(1),
        contentZh: z.string().optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.upsertSystemPrompt(input);
        return { id, key: input.key };
      }),
    updateContent: adminProcedure
      .input(z.object({
        key: z.string(),
        content: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        await db.updateSystemPromptContent(input.key, input.content);
        return { success: true };
      }),
    translate: adminProcedure
      .input(z.object({ key: z.string() }))
      .mutation(async ({ input }) => {
        const prompt = await db.getSystemPrompt(input.key);
        if (!prompt) throw new Error("Prompt not found");

        // Use LLM to translate the prompt to Chinese
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "你是一个专业的翻译专家。将以下英文提示词翻译成中文，保持原有的格式、变量占位符（如{variable}）和技术术语不变。翻译要准确、自然、专业。" },
            { role: "user", content: prompt.content },
          ],
        });

        const rawContent = response.choices?.[0]?.message?.content;
        const translated = typeof rawContent === 'string' ? rawContent : "";
        if (translated) {
          await db.updateSystemPromptTranslation(input.key, translated);
        }
        return { contentZh: translated };
      }),
    delete: adminProcedure
      .input(z.object({ key: z.string() }))
      .mutation(async ({ input }) => {
        await db.deleteSystemPrompt(input.key);
        return { success: true };
      }),
    seed: adminProcedure
      .mutation(async () => {
        await db.seedSystemPrompts(DEFAULT_SYSTEM_PROMPTS);
        return { success: true, count: DEFAULT_SYSTEM_PROMPTS.length };
      }),
  }),

  // ============================================================
  // App Logs
  // ============================================================
  appLog: router({
    list: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
        level: z.string().optional(),
        source: z.string().optional(),
        projectId: z.number().optional(),
        search: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return db.getAppLogs(input);
      }),
    clear: adminProcedure
      .input(z.object({ before: z.string().optional() }))
      .mutation(async ({ input }) => {
        const before = input.before ? new Date(input.before) : undefined;
        await db.clearAppLogs(before);
        return { success: true };
      }),
  }),

  // ============================================================
  // Video Clips & Final Videos
  // ============================================================
  video: router({
    clips: publicProcedure
      .input(z.object({ projectId: z.number(), version: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getVideoClips(input.projectId, input.version);
      }),
    finalVideos: publicProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getFinalVideos(input.projectId);
      }),
    generateClips: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        model: z.string().default("doubao-seedance-1-5-pro-251215"),
      }))
      .mutation(async ({ input }) => {
        // Get latest grid version to filter panels and prompts
        const latestGrid = await db.getLatestGrid(input.projectId);
        const gridVersion = latestGrid?.version;
        
        const panelsList = await db.getPanels(input.projectId, gridVersion);
        // Get ALL prompts for this project (prompts.panelId may point to older version panel ids)
        const allPrompts = await db.getPrompts(input.projectId);
        // Also get ALL panels to build panelId -> panelIndex mapping
        const allPanels = await db.getPanels(input.projectId);
        if (!panelsList.length) throw new Error("No panels found");
        if (!allPrompts.length) throw new Error("No prompts found");

        // Build panelId -> panelIndex mapping from all panels
        const panelIdToIndex = new Map<number, number>();
        for (const p of allPanels) {
          panelIdToIndex.set(p.id, p.panelIndex);
        }
        
        // Build panelIndex -> prompts mapping (use latest version prompt for each panelIndex)
        const promptsByPanelIndex = new Map<number, typeof allPrompts>();
        for (const pr of allPrompts) {
          const idx = panelIdToIndex.get(pr.panelId);
          if (idx === undefined) continue;
          if (!promptsByPanelIndex.has(idx)) promptsByPanelIndex.set(idx, []);
          promptsByPanelIndex.get(idx)!.push(pr);
        }
        // Sort each group by version desc, pick latest
        promptsByPanelIndex.forEach((prs, _idx) => {
          prs.sort((a: { version: number }, b: { version: number }) => b.version - a.version);
        });

        // For each panel, pick ONE prompt (deduplicate):
        const clipIds: Array<{ clipId: number; panelIndex: number; panelId: number; prompt: string; keyframeUrl?: string; hasKeyframe: boolean }> = [];
        const seenPanelIndexes = new Set<number>();
        
        for (const panel of panelsList) {
          if (seenPanelIndexes.has(panel.panelIndex)) continue;
          seenPanelIndexes.add(panel.panelIndex);
          
          // Find prompts for this panelIndex (matched via panelId->panelIndex mapping)
          const panelPrompts = promptsByPanelIndex.get(panel.panelIndex) || [];
          if (!panelPrompts.length) continue;
          
          // Pick the best prompt (prefer latest one)
          const bestPrompt = panelPrompts[panelPrompts.length - 1];
          const hasKeyframe = !!panel.panelImageUrl;
          
          // For image-to-video: simplify prompt to focus on motion/action only
          // The keyframe already contains scene/character appearance info
          let finalPrompt = bestPrompt.promptText;
          if (hasKeyframe && finalPrompt.length > 200) {
            // Extract action/motion part: use the action field if available, otherwise truncate
            const actionPart = bestPrompt.action || '';
            const cameraPart = bestPrompt.cameraMovement || '';
            if (actionPart) {
              finalPrompt = `${actionPart}${cameraPart ? '. Camera: ' + cameraPart : ''}. Cinematic lighting, smooth motion.`;
            } else {
              // Truncate long prompt for image-to-video (model works better with shorter prompts when keyframe is provided)
              finalPrompt = finalPrompt.substring(0, 200);
            }
          }
          
          const clipId = await db.createVideoClip({
            panelId: panel.id,
            projectId: input.projectId,
            version: panel.version,
            panelIndex: panel.panelIndex,
            model: input.model,
            prompt: finalPrompt,
            keyframeUrl: hasKeyframe ? panel.panelImageUrl! : undefined,
          });
          clipIds.push({ clipId, panelIndex: panel.panelIndex, panelId: panel.id, prompt: finalPrompt, keyframeUrl: hasKeyframe ? panel.panelImageUrl! : undefined, hasKeyframe });
        }

        // Fire-and-forget: submit to Yunwu API in background
        (async () => {
          const yunwuUrl = process.env.YUNWU_API_URL || "https://yunwu.ai";
          const yunwuKey = process.env.YUNWU_API_KEY;
          if (!yunwuKey) {
            for (const c of clipIds) {
              await db.updateVideoClip(c.clipId, { status: "failed", errorMessage: "YUNWU_API_KEY not configured" });
            }
            return;
          }

          // Detect API family: Volc (Seedance) vs VEO
          const isVolc = input.model.startsWith("doubao-") || input.model.includes("seedance");

          for (const c of clipIds) {
            try {
              let resp: Response;

              if (isVolc) {
                // ── Volc API (Seedance) ──
                const volcPayload: any = {
                  model: input.model,
                  content: [
                    { type: "text", text: c.prompt },
                  ],
                  ratio: "16:9",
                  duration: 4,
                  watermark: false,
                };
                if (c.keyframeUrl) {
                  volcPayload.first_frame_image = c.keyframeUrl;
                }

                resp = await fetch(`${yunwuUrl}/volc/v1/contents/generations/tasks`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Authorization": `Bearer ${yunwuKey}`,
                  },
                  body: JSON.stringify(volcPayload),
                });
              } else {
                // ── VEO API ──
                const veoPayload: any = {
                  model: input.model,
                  prompt: c.prompt,
                  enhance_prompt: true,
                  enable_upsample: true,
                  aspect_ratio: "16:9",
                };
                if (c.keyframeUrl) {
                  veoPayload.images = [c.keyframeUrl];
                }

                resp = await fetch(`${yunwuUrl}/v1/video/create`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${yunwuKey}`,
                  },
                  body: JSON.stringify(veoPayload),
                });
              }

              if (!resp.ok) {
                const text = await resp.text();
                throw new Error(`Yunwu API error (${resp.status}): ${text.substring(0, 500)}`);
              }

              const data = await resp.json();

              if (data.id) {
                await db.updateVideoClip(c.clipId, { taskId: data.id, status: "generating" });
                logInfo("video_gen", `Video clip submitted: panel #${c.panelIndex}, task ${data.id}`, {
                  projectId: input.projectId,
                  panelIndex: c.panelIndex,
                  details: { model: input.model, taskId: data.id, apiFamily: isVolc ? "volc" : "veo" },
                });
              } else {
                const rawErr = data.message || data.error || data;
                const errMsg = typeof rawErr === "string" ? rawErr : JSON.stringify(rawErr);
                await db.updateVideoClip(c.clipId, { status: "failed", errorMessage: errMsg });
                logError("video_gen", `Video clip submission failed: panel #${c.panelIndex}: ${errMsg}`, {
                  projectId: input.projectId,
                  panelIndex: c.panelIndex,
                  details: { model: input.model, error: errMsg },
                });
              }
            } catch (e) {
              const errMsg = e instanceof Error ? e.message : String(e);
              await db.updateVideoClip(c.clipId, { status: "failed", errorMessage: errMsg });
              logError("video_gen", `Video clip error: panel #${c.panelIndex}: ${errMsg}`, {
                projectId: input.projectId,
                panelIndex: c.panelIndex,
                details: { error: errMsg, stack: e instanceof Error ? e.stack : undefined },
              });
            }
            // Small delay between submissions
            await new Promise(r => setTimeout(r, 1500));
          }
        })().catch(err => {
          logError("video_gen", `Background video generation failed: ${err.message}`, { projectId: input.projectId });
        });

        // Return immediately with pending clip records
        return { clips: clipIds.map(c => ({ panelIndex: c.panelIndex, clipId: c.clipId, status: "pending" })) };
      }),
    clearFailedClips: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ input }) => {
        const count = await db.deleteFailedClips(input.projectId);
        return { deleted: count };
      }),
    clearAllClips: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ input }) => {
        const count = await db.deleteAllClips(input.projectId);
        return { deleted: count };
      }),
    pollClipStatus: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ input }) => {
        const clips = await db.getVideoClips(input.projectId);
        const pendingClips = clips.filter(c => c.status === "generating" || c.status === "upsampling" || c.status === "pending");

        const yunwuUrl = process.env.YUNWU_API_URL || "https://yunwu.ai";
        const yunwuKey = process.env.YUNWU_API_KEY;
        if (!yunwuKey) throw new Error("YUNWU_API_KEY not configured");

        const updates: Array<{ clipId: number; panelIndex: number; status: string; clipUrl?: string }> = [];

        for (const clip of pendingClips) {
          if (!clip.taskId) continue;
          try {
            // Auto-detect API family from task ID format
            const isVolcTask = clip.taskId.startsWith("cgt-");
            let resp: Response;

            if (isVolcTask) {
              // Volc API query
              resp = await fetch(`${yunwuUrl}/volc/v1/contents/generations/tasks/${encodeURIComponent(clip.taskId)}`, {
                headers: { "Authorization": `Bearer ${yunwuKey}`, "Accept": "application/json" },
              });
            } else {
              // VEO API query
              resp = await fetch(`${yunwuUrl}/v1/video/query?id=${encodeURIComponent(clip.taskId)}`, {
                headers: { "Authorization": `Bearer ${yunwuKey}` },
              });
            }
            const data = await resp.json();

            // Normalize status: Volc uses "succeeded", VEO uses "completed"
            const rawStatus = (data.status || "").toLowerCase();
            const isCompleted = rawStatus === "completed" || rawStatus === "succeeded";
            const isFailed = rawStatus === "failed" || rawStatus === "error";

            if (isCompleted) {
              // Extract video URL: Volc nests under content.video_url, VEO uses video_url directly
              let videoUrl = data.video_url || data.url;
              if (!videoUrl && data.content && typeof data.content === "object") {
                videoUrl = data.content.video_url;
              }
              await db.updateVideoClip(clip.id, { status: "completed", clipUrl: videoUrl });
              updates.push({ clipId: clip.id, panelIndex: clip.panelIndex, status: "completed", clipUrl: videoUrl });
              logInfo("video_gen", `Video clip completed: panel #${clip.panelIndex}`, {
                projectId: input.projectId,
                panelIndex: clip.panelIndex,
              });
            } else if (isFailed) {
              const rawErr = data.error || data.message || "Unknown error";
              const errMsg = typeof rawErr === "string" ? rawErr : JSON.stringify(rawErr);
              await db.updateVideoClip(clip.id, { status: "failed", errorMessage: errMsg });
              updates.push({ clipId: clip.id, panelIndex: clip.panelIndex, status: "failed" });
              logError("video_gen", `Video clip failed: panel #${clip.panelIndex}: ${errMsg}`, {
                projectId: input.projectId,
                panelIndex: clip.panelIndex,
              });
            } else {
              // Still in progress (running, submitted, video_upsampling, etc.)
              const normalizedProgress = rawStatus === "running" || rawStatus === "submitted" ? "generating" : data.status;
              if (rawStatus === "video_upsampling" && clip.status !== "upsampling") {
                await db.updateVideoClip(clip.id, { status: "upsampling" });
              }
              updates.push({ clipId: clip.id, panelIndex: clip.panelIndex, status: normalizedProgress || clip.status });
            }
          } catch (e) {
            // Query failed, skip
          }
          await new Promise(r => setTimeout(r, 500));
        }

        return { updates, allCompleted: pendingClips.length === 0 || updates.every(u => u.status === "completed" || u.status === "failed") };
      }),
    mergeClips: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        clipDurations: z.array(z.object({
          panelIndex: z.number(),
          duration: z.number().optional(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        const { mergeVideoClips } = await import("./videoMerger");
        const clips = await db.getVideoClips(input.projectId);
        const completedClips = clips.filter(c => c.status === "completed" && c.clipUrl);
        if (!completedClips.length) throw new Error("No completed clips to merge");

        // Sort by panelIndex
        completedClips.sort((a, b) => a.panelIndex - b.panelIndex);

        const clipInfos = completedClips.map(c => {
          const durationOverride = input.clipDurations?.find(d => d.panelIndex === c.panelIndex);
          return {
            panelIndex: c.panelIndex,
            clipUrl: c.clipUrl!,
            duration: durationOverride?.duration,
          };
        });

        const result = await mergeVideoClips(input.projectId, clipInfos);

        // Save final video record
        const finalId = await db.createFinalVideo({
          projectId: input.projectId,
          version: completedClips[0].version,
          clipCount: completedClips.length,
        });
        await db.updateFinalVideo(Number(finalId), {
          videoUrl: result.finalVideoUrl,
          totalDuration: String(result.totalDuration),
          status: "completed",
        });

        return { finalVideoId: finalId, videoUrl: result.finalVideoUrl, totalDuration: result.totalDuration };
      }),
    confirmFinal: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ input }) => {
        const finalVids = await db.getFinalVideos(input.projectId);
        if (!finalVids.length) throw new Error("No final video found");
        const latest = finalVids[0];
        await db.updateFinalVideo(latest.id, { confirmedAt: new Date() });
        await db.updateProject(input.projectId, { status: "confirmed" });
        logInfo("video_gen", `Final video confirmed for project`, { projectId: input.projectId });
        return { success: true };
      }),
  }),
  // ============================================================
  // Utility: Image proxy for ZIP download (avoid CORS)
  // ============================================================
  util: router({
    proxyImage: protectedProcedure
      .input(z.object({ url: z.string().url() }))
      .mutation(async ({ input }) => {
        const resp = await fetch(input.url);
        if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`);
        const buffer = await resp.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const contentType = resp.headers.get("content-type") || "image/png";
        return { base64, contentType };
      }),
    proxyImages: protectedProcedure
      .input(z.object({ urls: z.array(z.string().url()) }))
      .mutation(async ({ input }) => {
        const results = await Promise.all(
          input.urls.map(async (url) => {
            try {
              const resp = await fetch(url);
              if (!resp.ok) return { url, base64: null, contentType: null, error: `HTTP ${resp.status}` };
              const buffer = await resp.arrayBuffer();
              return { url, base64: Buffer.from(buffer).toString("base64"), contentType: resp.headers.get("content-type") || "image/png", error: null };
            } catch (e: any) {
              return { url, base64: null, contentType: null, error: e.message };
            }
          })
        );
        return results;
      }),
  }),
});
export type AppRouter = typeof appRouter;
