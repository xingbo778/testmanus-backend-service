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
        const anchorsList = await db.getAnchors(input.id);
        const grid = await db.getLatestGrid(input.id);
        const panelsList = await db.getPanels(input.id);
        const promptsList = await db.getPrompts(input.id);
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
    { "name": "角色名", "description": "外貌描述", "anchorPrompt": "用于生成角色参考图的英文prompt" }
  ],
  "scenes": [
    { "name": "场景名", "description": "场景描述", "anchorPrompt": "用于生成场景参考图的英文prompt" }
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

        const characters = (script.characters as Array<{ name: string; description: string; anchorPrompt: string }>) ?? [];
        const scenes = (script.scenes as Array<{ name: string; description: string; anchorPrompt: string }>) ?? [];

        const results: Array<{ id: number; type: string; name: string; imageUrl?: string }> = [];

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
            results.push({ id: anchorId, type: "character", name: char.name, imageUrl: url });
          } catch (e) {
            const anchorId = await db.saveAnchor({
              projectId: input.projectId,
              version: script.version,
              anchorType: "character",
              name: char.name,
              description: char.description,
              prompt: char.anchorPrompt,
            });
            results.push({ id: anchorId, type: "character", name: char.name });
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
            results.push({ id: anchorId, type: "scene", name: scene.name, imageUrl: url });
          } catch (e) {
            const anchorId = await db.saveAnchor({
              projectId: input.projectId,
              version: script.version,
              anchorType: "scene",
              name: scene.name,
              description: scene.description,
              prompt: scene.anchorPrompt,
            });
            results.push({ id: anchorId, type: "scene", name: scene.name });
          }
        }

        return { anchors: results };
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

        const anchorsList = await db.getAnchors(input.projectId);
        const frames = script.frames as Array<{ index: number; shotType: string; duration: number; description: string; cameraMovement: string }>;

        const totalPanels = frames.length;
        let rows: number, cols: number;
        if (totalPanels <= 6) { rows = 2; cols = 3; }
        else if (totalPanels <= 8) { rows = 2; cols = 4; }
        else if (totalPanels <= 12) { rows = 3; cols = 4; }
        else { rows = 3; cols = 5; }

        // Build grid generation prompt
        const anchorDescriptions = anchorsList.map(a => `${a.anchorType}: ${a.name} - ${a.description}`).join("\n");
        const frameDescriptions = frames.map(f =>
          `Panel ${f.index}: [${f.shotType}] ${f.description} (${f.duration}s, ${f.cameraMovement})`
        ).join("\n");

        // Build a detailed grid prompt that strongly references the script content
        const characters = (script.characters as Array<{ name: string; description: string }>) ?? [];
        const scenes = (script.scenes as Array<{ name: string; description: string }>) ?? [];
        const charDesc = characters.map(c => `Character "${c.name}": ${c.description}`).join("; ");
        const sceneDesc = scenes.map(s => `Scene "${s.name}": ${s.description}`).join("; ");

        const gridPrompt = input.customPrompt || `Professional cinematic storyboard grid, ${rows}x${cols} layout (${totalPanels} panels total), clean white borders between panels.

STORY CONTEXT: "${project.title}" - a ${project.duration}-second short video.
CHARACTERS: ${charDesc || anchorDescriptions}
SETTING: ${sceneDesc || "as described in panels"}

PANEL-BY-PANEL BREAKDOWN (must follow this exact sequence):
${frames.map(f => `Panel ${f.index}: [${f.shotType}] ${f.description} — Camera: ${f.cameraMovement}, Duration: ${f.duration}s`).join("\n")}

STYLE: Consistent character appearance across all panels. Cinematic lighting. Each panel clearly depicts its described scene with recognizable characters and actions. Professional storyboard illustration quality. All ${totalPanels} panels must be exactly the same size.`;

        try {
          const { url: gridImageUrl } = await generateImage({ prompt: gridPrompt });

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

        let newImageUrl: string | undefined;
        const prompt = input.modifiedDescription || panel.description || "";

        try {
          if (input.fixType === "reference_based" && input.referenceImageUrl) {
            const { url } = await generateImage({
              prompt,
              originalImages: [{ url: input.referenceImageUrl }],
            });
            newImageUrl = url;
          } else if (input.fixType === "inpaint" && panel.panelImageUrl) {
            const { url } = await generateImage({
              prompt,
              originalImages: [{ url: panel.panelImageUrl }],
            });
            newImageUrl = url;
          } else {
            const { url } = await generateImage({ prompt });
            newImageUrl = url;
          }
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
