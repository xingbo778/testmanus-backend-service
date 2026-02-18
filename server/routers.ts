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
        duration: z.enum(["15", "30"]),
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

        // Get applicable rules
        const ruleChapters = await db.getRulesForScene(project.l2Id);
        const userRulesList = await db.getUserRules({ status: "approved", applicableL2Id: project.l2Id });

        // Build rules context
        const rulesContext = ruleChapters.map(ch => {
          const rules = ch.rules as Array<{ type: string; text: string; severity: string }>;
          return `## ${ch.title}\n${rules.map(r => `- [${r.type.toUpperCase()}] ${r.text}`).join("\n")}`;
        }).join("\n\n");

        const userRulesContext = userRulesList.length > 0
          ? `## 用户自定义规则（优先级最高）\n${userRulesList.map(r => `- [${r.ruleType.toUpperCase()}][${r.severity}] ${r.ruleText}`).join("\n")}`
          : "";

        const totalDuration = parseInt(project.duration);
        const frameCount = totalDuration === 15 ? "6-8" : "10-15";
        const gridLayout = totalDuration === 15 ? "2×3 or 2×4" : "3×4 or 3×5";

        const systemPrompt = `你是一个专业的分镜脚本设计师。根据给定的场景类型和规则，生成结构化的分镜脚本。

${rulesContext}

${userRulesContext}

## 输出要求
- 总时长：${totalDuration}秒
- 帧数：${frameCount}帧
- 推荐布局：${gridLayout}
- 每帧时长：1-3秒
- 前3秒必须有强钩子

请以JSON格式输出，包含以下字段：
{
  "frames": [
    {
      "index": 1,
      "shotType": "EWS/WS/FS/MS/MCU/CU/ECU/INS",
      "duration": 2.0,
      "description": "画面描述",
      "cameraMovement": "static/pan/tilt/dolly/tracking/handheld/crane",
      "notes": "导演备注"
    }
  ],
  "characters": [
    { "name": "角色名", "description": "外貌描述（中文，详细）", "anchorPrompt": "用于生成角色参考图的英文prompt，必须遵循以下格式：A half-body portrait of [CHARACTER], [detailed appearance]. The character is centered in the frame, facing slightly to the right at a 3/4 angle. Shot against a pure white studio background with soft, even lighting. Professional studio photography, shot on 85mm f/1.4 lens. Soft key light from the upper left, subtle fill light from the right. Natural skin texture, clean catchlights in the eyes. High detail, 8K resolution, photorealistic." }
  ],
  "scenes": [
    { "name": "场景名", "description": "场景描述（中文，详细）", "anchorPrompt": "用于生成场景参考图的英文prompt，必须遵循以下格式：A wide establishing shot of [SCENE], [detailed environment description]. Cinematic composition with depth, atmospheric lighting. The scene conveys [mood/atmosphere]. Shot on 35mm wide-angle lens. High detail, 8K resolution, photorealistic. No people in the scene, focus on environment and atmosphere." }
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
          rulesUsed: ruleChapters.map(ch => ch.id),
        });

        await db.updateProject(input.projectId, { status: "scripted", currentVersion: version });

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

        const anchorsList = await db.getAnchors(input.projectId);
        const frames = script.frames as Array<{ index: number; shotType: string; duration: number; description: string; cameraMovement: string }>;

        const totalPanels = frames.length;
        let rows: number, cols: number;
        if (totalPanels <= 6) { rows = 2; cols = 3; }
        else if (totalPanels <= 8) { rows = 2; cols = 4; }
        else if (totalPanels <= 12) { rows = 3; cols = 4; }
        else { rows = 3; cols = 5; }

        // Build grid generation prompt using Nano Banana Pro best practices
        const characters = (script.characters as Array<{ name: string; description: string }>) ?? [];
        const scenes = (script.scenes as Array<{ name: string; description: string }>) ?? [];
        const charDesc = characters.map(c => `"${c.name}": ${c.description}`).join("; ");
        const sceneDesc = scenes.map(s => `"${s.name}": ${s.description}`).join("; ");

        // Collect anchor image URLs for reference
        const anchorImageUrls = anchorsList
          .filter(a => a.imageUrl && a.imageUrl.startsWith("http"))
          .map(a => ({ url: a.imageUrl! }));

        const gridPrompt = input.customPrompt || `WORK SURFACE:
Create a professional ${rows}x${cols} cinematic storyboard grid (${totalPanels} panels total).

LAYOUT:
- ${rows} rows x ${cols} columns grid layout
- Clean white borders between panels (4px width)
- Each panel is exactly the same size
- Panel numbers visible in the top-left corner of each panel
- Horizontal reading order: left to right, top to bottom

COMPONENTS:
Title: "${project.title}" - ${project.duration}-second short film
Characters: ${charDesc}
Setting: ${sceneDesc}

PANEL-BY-PANEL BREAKDOWN (each panel must depict its described scene precisely):
${frames.map(f => `Panel ${f.index} (${f.shotType}): ${f.description}. Camera: ${f.cameraMovement}. Duration: ${f.duration}s`).join("\n")}

STYLE:
- Cinematic storyboard illustration quality
- Consistent character appearance across ALL panels (same face, same clothing, same proportions)
- Dynamic compositions with varied camera angles as specified
- Atmospheric lighting matching the mood of each scene
- Professional film storyboard with clear visual storytelling

CONSTRAINTS:
- Character design MUST remain identical across all panels
- No overlap between panel borders
- Each panel must clearly show the described action and camera angle
- Panel numbers must be sharp and readable
- Uniform spacing between all panels`;

        try {
          // Pass anchor images as reference for character/scene consistency
          const { url: gridImageUrl } = await generateImage({
            prompt: gridPrompt,
            originalImages: anchorImageUrls.length > 0 ? anchorImageUrls : undefined,
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

          return { gridId, gridImageUrl, rows, cols, totalPanels };
        } catch (e) {
          // Even if image generation fails, save the grid structure
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

          return { gridId, gridImageUrl: null, rows, cols, totalPanels, error: "Image generation failed, grid structure saved" };
        }
      }),
    get: publicProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getLatestGrid(input.projectId);
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
          .map(a => ({ url: a.imageUrl! }));

        let newImageUrl: string | undefined;
        const prompt = input.modifiedDescription || panel.description || "";

        // Build reference images: anchor images + original panel image + user-provided reference
        const referenceImages: Array<{ url: string }> = [...anchorRefImages];
        if (panel.panelImageUrl && panel.panelImageUrl.startsWith("http")) {
          referenceImages.push({ url: panel.panelImageUrl });
        }
        if (input.referenceImageUrl && input.referenceImageUrl.startsWith("http")) {
          referenceImages.push({ url: input.referenceImageUrl });
        }

        // Build enhanced prompt that references the original panel context
        const enhancedPrompt = `Regenerate this storyboard panel with the following description: ${prompt}\n\nIMPORTANT: Maintain character consistency with the reference images provided. Keep the same art style and visual quality as the original storyboard.`;

        try {
          const { url } = await generateImage({
            prompt: enhancedPrompt,
            originalImages: referenceImages.length > 0 ? referenceImages : undefined,
          });
          newImageUrl = url;
        } catch (e) {
          // Image generation failed, continue with metadata update
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
});

export type AppRouter = typeof appRouter;
