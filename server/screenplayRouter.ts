import { z } from "zod";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { logInfo, logError } from "./appLogger";
import * as db from "./db";

// ============================================================
// Screenplay Template Router
// ============================================================
export const screenplayTemplateRouter = router({
  list: publicProcedure
    .input(z.object({
      category: z.string().optional(),
      narrativeArchetype: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.listScreenplayTemplates(input);
    }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getScreenplayTemplateById(input.id);
    }),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      nameEn: z.string().optional(),
      category: z.string(),
      subcategory: z.string().optional(),
      description: z.string().optional(),
      targetDuration: z.string().optional(),
      sceneCount: z.number().optional(),
      narrativeArchetype: z.string().optional(),
      emotionCurve: z.string().optional(),
      hookStrategy: z.string().optional(),
      scenes: z.any(),
      slots: z.any().optional(),
      shuangdian: z.any().optional(),
      tags: z.any().optional(),
      isBuiltin: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = await db.createScreenplayTemplate({
        ...input,
        createdBy: ctx.user.id,
      } as any);
      return { id };
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      nameEn: z.string().optional(),
      category: z.string().optional(),
      subcategory: z.string().optional(),
      description: z.string().optional(),
      targetDuration: z.string().optional(),
      sceneCount: z.number().optional(),
      narrativeArchetype: z.string().optional(),
      emotionCurve: z.string().optional(),
      hookStrategy: z.string().optional(),
      scenes: z.any().optional(),
      slots: z.any().optional(),
      shuangdian: z.any().optional(),
      tags: z.any().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateScreenplayTemplate(id, data as any);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteScreenplayTemplate(input.id);
      return { success: true };
    }),
});

// ============================================================
// Screenplay Router (idea → script generation & management)
// ============================================================
export const screenplayRouter = router({
  list: publicProcedure
    .input(z.object({
      status: z.string().optional(),
      templateId: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.listScreenplays(input);
    }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const screenplay = await db.getScreenplayById(input.id);
      if (!screenplay) return null;
      // Also fetch the template if linked
      let template = null;
      if (screenplay.templateId) {
        template = await db.getScreenplayTemplateById(screenplay.templateId);
      }
      return { screenplay, template };
    }),

  // Core: Generate screenplay from an idea
  generate: protectedProcedure
    .input(z.object({
      idea: z.string().min(1),
      templateId: z.number().optional(),
      totalDuration: z.number().min(15).max(180).optional(),
      additionalContext: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const totalDuration = input.totalDuration ?? 60;

      // Fetch template if specified
      let templateContext = "";
      let templateName = "";
      if (input.templateId) {
        const template = await db.getScreenplayTemplateById(input.templateId);
        if (template) {
          templateName = template.name;
          templateContext = `
## 参考脚本模板：${template.name}
- 叙事原型：${template.narrativeArchetype ?? "通用"}
- 情绪曲线：${template.emotionCurve ?? "未指定"}
- 钩子策略：${template.hookStrategy ?? "未指定"}
- 场景数：${template.sceneCount}
- 场景模板：${JSON.stringify(template.scenes)}
- 可配置参数：${JSON.stringify(template.slots ?? [])}
- 爽点配置：${JSON.stringify(template.shuangdian ?? [])}

请严格按照此模板的场景结构和叙事节奏生成脚本，但用用户的灵感替换具体内容。`;
          await db.incrementScreenplayTemplateUsage(input.templateId);
        }
      }

      // Fetch category tree for L1/L2/L3 mapping
      const categoryTree = await db.getCategoryTree();
      const categoryList = categoryTree.flatMap((l1: any) =>
        l1.children.flatMap((l2: any) =>
          (l2.children ?? []).map((l3: any) => `${l1.id} > ${l2.id} > ${l3.id} (${l1.name} > ${l2.name} > ${l3.name})`)
        )
      );

      // Fetch shuangdian library for reference
      const shuangdianItems = await db.listShuangdianItems();
      const shuangdianContext = shuangdianItems.length > 0
        ? `\n## 爽点知识库（供参考，选择合适的爽点注入每个场景）\n${shuangdianItems.map((s: any) => `- [${s.level}][${s.category}] ${s.name}: ${s.description ?? ""}`).join("\n")}`
        : "";

      const systemPrompt = `你是一个专业的短剧/短视频脚本编剧。你的任务是根据用户提供的一句灵感，生成一个完整的、可直接用于拍摄的分场脚本。

# 核心原则
1. **每个脚本由多个"场戏"组成**，每场戏对应一个独立的拍摄场景
2. **每场戏必须关联到分镜模板分类**（L1 > L2 > L3），这样后续可以自动匹配分镜模板
3. **每5秒一个爽点**：微爽点(5-10秒)、中爽点(20-30秒)、大爽点(60-90秒)
4. **前3秒必须有强钩子**，抓住观众注意力
5. **总时长：${totalDuration}秒**

# 可用的分镜分类体系（L1 > L2 > L3）
${categoryList.join("\n")}

${templateContext}
${shuangdianContext}

# 输出格式要求
请以JSON格式输出，严格遵循以下结构：
{
  "title": "脚本标题",
  "narrativeArchetype": "叙事原型（如：鱼离水、赘婿逆袭、三幕式等）",
  "emotionCurve": "情绪曲线描述（如：压抑→爆发→逆转→升华）",
  "scenes": [
    {
      "index": 1,
      "title": "场景标题（如：咖啡厅羞辱）",
      "sceneType": "场景类型（如：对话、打斗、暧昧、独白、展示、教程等）",
      "l1Id": "匹配的L1分类ID",
      "l2Id": "匹配的L2分类ID",
      "l3Id": "匹配的L3分类ID",
      "duration": 20,
      "durationRatio": 0.33,
      "location": "拍摄场景（如：高档咖啡厅、豪华办公室）",
      "characters": ["角色A", "角色B"],
      "sceneCategory": "对话/打斗/暧昧/独白/展示/教程/追逐/揭示",
      "description": "这场戏的详细剧情描述（100字以上）",
      "dialogue": [
        {"character": "角色A", "line": "台词内容", "emotion": "情绪"},
        {"character": "角色B", "line": "台词内容", "emotion": "情绪"}
      ],
      "shuangdian": [
        {"level": "micro/mid/major", "timing": "0:05", "description": "爽点描述"}
      ],
      "hook": "这场戏的钩子/悬念设计",
      "transition": "与下一场戏的衔接方式"
    }
  ],
  "characters": [
    {"name": "角色名", "description": "角色描述（外貌、性格、身份）", "role": "protagonist/antagonist/supporting"}
  ],
  "settings": [
    {"name": "场景名", "description": "场景环境描述"}
  ]
}`;

      const userPrompt = `灵感：${input.idea}
总时长：${totalDuration}秒
${input.additionalContext ? `补充说明：${input.additionalContext}` : ""}

请根据这个灵感生成完整的分场脚本。`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "screenplay",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  narrativeArchetype: { type: "string" },
                  emotionCurve: { type: "string" },
                  scenes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "integer" },
                        title: { type: "string" },
                        sceneType: { type: "string" },
                        l1Id: { type: "string" },
                        l2Id: { type: "string" },
                        l3Id: { type: "string" },
                        duration: { type: "number" },
                        durationRatio: { type: "number" },
                        location: { type: "string" },
                        characters: { type: "array", items: { type: "string" } },
                        sceneCategory: { type: "string" },
                        description: { type: "string" },
                        dialogue: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              character: { type: "string" },
                              line: { type: "string" },
                              emotion: { type: "string" },
                            },
                            required: ["character", "line", "emotion"],
                            additionalProperties: false,
                          },
                        },
                        shuangdian: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              level: { type: "string" },
                              timing: { type: "string" },
                              description: { type: "string" },
                            },
                            required: ["level", "timing", "description"],
                            additionalProperties: false,
                          },
                        },
                        hook: { type: "string" },
                        transition: { type: "string" },
                      },
                      required: ["index", "title", "sceneType", "l1Id", "l2Id", "l3Id", "duration", "durationRatio", "location", "characters", "sceneCategory", "description", "dialogue", "shuangdian", "hook", "transition"],
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
                        role: { type: "string" },
                      },
                      required: ["name", "description", "role"],
                      additionalProperties: false,
                    },
                  },
                  settings: {
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
                required: ["title", "narrativeArchetype", "emotionCurve", "scenes", "characters", "settings"],
                additionalProperties: false,
              },
            },
          },
        });

        const contentRaw = response.choices?.[0]?.message?.content;
        const content = typeof contentRaw === "string" ? contentRaw : JSON.stringify(contentRaw);
        if (!content) throw new Error("LLM returned empty response");

        const parsed = JSON.parse(content);

        // Save to database
        const screenplayId = await db.createScreenplay({
          title: parsed.title,
          idea: input.idea,
          templateId: input.templateId ?? null,
          templateName: templateName || null,
          totalDuration,
          sceneCount: parsed.scenes?.length ?? 0,
          status: "generated",
          version: 1,
          narrativeArchetype: parsed.narrativeArchetype,
          emotionCurve: parsed.emotionCurve,
          generationPrompt: userPrompt,
          scenes: parsed.scenes,
          characters: parsed.characters,
          settings: parsed.settings,
          createdBy: ctx.user.id,
        } as any);

        logInfo("screenplay_gen", `Screenplay generated: "${parsed.title}" with ${parsed.scenes?.length ?? 0} scenes`, {
          details: {
            screenplayId,
            idea: input.idea,
            templateId: input.templateId,
            sceneCount: parsed.scenes?.length,
            totalDuration,
          },
        });

        return { screenplayId, screenplay: parsed };
      } catch (error: any) {
        logError("screenplay_gen", `Failed to generate screenplay: ${error.message}`, {
          details: { idea: input.idea, error: error.message },
        });
        throw error;
      }
    }),

  // Update screenplay (edit scenes, characters, etc.)
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      scenes: z.any().optional(),
      characters: z.any().optional(),
      settings: z.any().optional(),
      status: z.enum(["draft", "generated", "editing", "finalized", "archived"]).optional(),
      totalDuration: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      if (data.scenes) {
        (data as any).sceneCount = Array.isArray(data.scenes) ? data.scenes.length : 0;
      }
      await db.updateScreenplay(id, data as any);
      return { success: true };
    }),

  // Update a single scene within a screenplay
  updateScene: protectedProcedure
    .input(z.object({
      screenplayId: z.number(),
      sceneIndex: z.number(),
      data: z.object({
        title: z.string().optional(),
        sceneType: z.string().optional(),
        l1Id: z.string().optional(),
        l2Id: z.string().optional(),
        l3Id: z.string().optional(),
        duration: z.number().optional(),
        location: z.string().optional(),
        characters: z.array(z.string()).optional(),
        sceneCategory: z.string().optional(),
        description: z.string().optional(),
        dialogue: z.any().optional(),
        shuangdian: z.any().optional(),
        hook: z.string().optional(),
        transition: z.string().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      const screenplay = await db.getScreenplayById(input.screenplayId);
      if (!screenplay) throw new Error("Screenplay not found");
      const scenes = (screenplay.scenes as any[]) ?? [];
      const idx = scenes.findIndex((s: any) => s.index === input.sceneIndex);
      if (idx === -1) throw new Error(`Scene ${input.sceneIndex} not found`);
      scenes[idx] = { ...scenes[idx], ...input.data };
      // Recalculate duration ratios
      const totalDur = scenes.reduce((sum: number, s: any) => sum + (s.duration ?? 0), 0);
      if (totalDur > 0) {
        scenes.forEach((s: any) => { s.durationRatio = Math.round((s.duration / totalDur) * 100) / 100; });
      }
      await db.updateScreenplay(input.screenplayId, { scenes, status: "editing" } as any);
      return { success: true, scene: scenes[idx] };
    }),

  // Delete screenplay
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteScreenplay(input.id);
      return { success: true };
    }),

  // Expand a scene into a storyboard project
  expandToProject: protectedProcedure
    .input(z.object({
      screenplayId: z.number(),
      sceneIndex: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const screenplay = await db.getScreenplayById(input.screenplayId);
      if (!screenplay) throw new Error("Screenplay not found");
      const scenes = (screenplay.scenes as any[]) ?? [];
      const scene = scenes.find((s: any) => s.index === input.sceneIndex);
      if (!scene) throw new Error(`Scene ${input.sceneIndex} not found`);

      // Map duration to allowed enum values
      const dur = Math.round(scene.duration ?? 15);
      const allowedDurations = [15, 30, 45, 60, 90, 120] as const;
      const closestDuration = allowedDurations.reduce((prev, curr) =>
        Math.abs(curr - dur) < Math.abs(prev - dur) ? curr : prev
      );

      // Create a storyboard project from this scene
      const projectId = await db.createProject({
        title: `${screenplay.title} - ${scene.title}`,
        l1Id: scene.l1Id || "narrative",
        l2Id: scene.l2Id || "narrative.dialogue",
        l3Id: scene.l3Id || "narrative.dialogue.cafe",
        duration: String(closestDuration) as any,
        createdBy: ctx.user.id,
      });

      // Link back: store projectId in the scene
      scene.storyboardProjectId = projectId;
      await db.updateScreenplay(input.screenplayId, { scenes } as any);

      logInfo("screenplay_expand", `Scene "${scene.title}" expanded to project #${projectId}`, {
        projectId,
        details: { screenplayId: input.screenplayId, sceneIndex: input.sceneIndex },
      });

      return { projectId, scene };
    }),

  // Expand all scenes into storyboard projects
  expandAllToProjects: protectedProcedure
    .input(z.object({ screenplayId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const screenplay = await db.getScreenplayById(input.screenplayId);
      if (!screenplay) throw new Error("Screenplay not found");
      const scenes = (screenplay.scenes as any[]) ?? [];
      const results: Array<{ sceneIndex: number; projectId: number }> = [];

      const allowedDurations = [15, 30, 45, 60, 90, 120] as const;

      for (const scene of scenes) {
        if (scene.storyboardProjectId) continue; // skip already expanded

        const dur = Math.round(scene.duration ?? 15);
        const closestDuration = allowedDurations.reduce((prev, curr) =>
          Math.abs(curr - dur) < Math.abs(prev - dur) ? curr : prev
        );

        const projectId = await db.createProject({
          title: `${screenplay.title} - ${scene.title}`,
          l1Id: scene.l1Id || "narrative",
          l2Id: scene.l2Id || "narrative.dialogue",
          l3Id: scene.l3Id || "narrative.dialogue.cafe",
          duration: String(closestDuration) as any,
          createdBy: ctx.user.id,
        });

        scene.storyboardProjectId = projectId;
        results.push({ sceneIndex: scene.index, projectId });
      }

      await db.updateScreenplay(input.screenplayId, { scenes, status: "finalized" } as any);

      logInfo("screenplay_expand_all", `All ${results.length} scenes expanded to projects`, {
        details: { screenplayId: input.screenplayId, results },
      });

      return { results };
    }),
});

// ============================================================
// Shuangdian Library Router
// ============================================================
export const shuangdianRouter = router({
  list: publicProcedure
    .input(z.object({
      category: z.string().optional(),
      level: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.listShuangdianItems(input);
    }),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      category: z.string(),
      level: z.enum(["micro", "mid", "major"]).optional(),
      description: z.string().optional(),
      example: z.string().optional(),
      applicableTemplates: z.any().optional(),
      emotionTarget: z.string().optional(),
      tags: z.any().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createShuangdianItem(input as any);
      return { id };
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      category: z.string().optional(),
      level: z.enum(["micro", "mid", "major"]).optional(),
      description: z.string().optional(),
      example: z.string().optional(),
      applicableTemplates: z.any().optional(),
      emotionTarget: z.string().optional(),
      tags: z.any().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateShuangdianItem(id, data as any);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteShuangdianItem(input.id);
      return { success: true };
    }),

  // Batch seed shuangdian items
  seed: adminProcedure
    .input(z.object({
      items: z.array(z.object({
        name: z.string(),
        category: z.string(),
        level: z.enum(["micro", "mid", "major"]),
        description: z.string().optional(),
        example: z.string().optional(),
        applicableTemplates: z.any().optional(),
        emotionTarget: z.string().optional(),
        tags: z.any().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      let count = 0;
      for (const item of input.items) {
        await db.createShuangdianItem(item as any);
        count++;
      }
      return { success: true, count };
    }),
});
