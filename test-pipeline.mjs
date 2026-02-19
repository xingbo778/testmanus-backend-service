// Full pipeline test: Script -> Anchor -> Grid for 3 projects
// Run with: npx tsx test-pipeline.mjs

import * as db from './server/db.ts';
import { invokeLLM } from './server/_core/llm.ts';
import { generateImage } from './server/_core/imageGeneration.ts';
import { storagePut } from './server/storage.ts';
import { RULE_CHAPTERS_SEED } from './server/seed-rules.ts';
import crypto from 'crypto';

const PROJECT_IDS = [1, 2, 3];

async function generateScript(projectId) {
  const project = await db.getProjectById(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  
  console.log(`\n📝 Generating script for "${project.title}" (${project.duration}s)...`);
  
  // Get rules
  const allRuleChapters = await db.getRulesForScene(project.l2Id);
  const sceneSpecific = allRuleChapters.filter(ch => ch.category === 'scene_specific');
  const universal = allRuleChapters.filter(ch => ch.category === 'universal');
  const technical = allRuleChapters.filter(ch => ch.category === 'technical');
  const aiPrompt = allRuleChapters.filter(ch => ch.category === 'ai_prompt');
  
  const prioritizedChapters = [...sceneSpecific, ...universal, ...aiPrompt, ...technical.slice(0, 3)];
  
  let totalRulesInjected = 0;
  const rulesContext = prioritizedChapters.map(ch => {
    const rules = ch.rules;
    const filteredRules = rules.length > 30 ? rules.filter(r => r.severity === 'warning' || r.severity === 'critical') : rules;
    totalRulesInjected += filteredRules.length;
    return `## 第${ch.chapterNumber}章 ${ch.title}（${ch.category}）\n${filteredRules.map(r => `- [${r.type.toUpperCase()}][${r.severity}] ${r.text}`).join("\n")}`;
  }).join("\n\n");
  
  const totalDuration = parseInt(project.duration);
  const frameCount = totalDuration === 15 ? "6-8" : totalDuration === 30 ? "10-15" : "15-22";
  const gridLayout = totalDuration === 15 ? "2×3 or 2×4" : totalDuration === 30 ? "3×4 or 3×5" : "4×5 or 4×6";
  
  console.log(`  Rules injected: ${totalRulesInjected} from ${prioritizedChapters.length} chapters`);
  
  const systemPrompt = `你是一个专业的分镜脚本设计师，精通电影分镜、摄影构图和视觉叙事。根据给定的场景类型和专业规则手册，生成高质量的结构化分镜脚本。

# 参考规则手册（共${totalRulesInjected}条规则，来自${prioritizedChapters.length}个章节）

${rulesContext}

# 输出要求
- 总时长：${totalDuration}秒
- 帧数：${frameCount}帧
- 推荐布局：${gridLayout}
- 每帧时长：1-3秒
- 前3秒必须有强钩子（hook）
- 必须严格遵循上述规则手册中的规则

# 重要：每帧description必须非常详细
每帧的description字段必须包含以下所有要素（用英文撰写，因为后续用于生成图片）：
1. **环境/背景**：具体的场景环境描述
2. **关键元素**：画面中的重要道具和视觉元素
3. **人物及位置**：每个角色的具体位置、姿态、表情
4. **光线/氛围**：光线方向、色调、情绪氛围
5. **景深/焦点**：前景、中景、背景的层次关系

请以JSON格式输出，包含以下字段：
{
  "frames": [{ "index": 1, "shotType": "WS", "duration": 2.0, "description": "详细英文描述", "cameraMovement": "static", "notes": "导演备注（中文）" }],
  "characters": [{ "name": "角色名", "description": "外貌描述（中文）", "anchorPrompt": "英文prompt for character reference" }],
  "scenes": [{ "name": "场景名", "description": "场景描述（中文）", "anchorPrompt": "英文prompt for scene reference" }],
  "props": [{ "name": "道具名", "description": "道具描述" }]
}`;

  const userPrompt = `场景类型：${project.l1Id} > ${project.l2Id} > ${project.l3Id}
标题：${project.title}
总时长：${totalDuration}秒

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
            frames: { type: "array", items: { type: "object", properties: { index: { type: "integer" }, shotType: { type: "string" }, duration: { type: "number" }, description: { type: "string" }, cameraMovement: { type: "string" }, notes: { type: "string" } }, required: ["index", "shotType", "duration", "description", "cameraMovement", "notes"], additionalProperties: false } },
            characters: { type: "array", items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, anchorPrompt: { type: "string" } }, required: ["name", "description", "anchorPrompt"], additionalProperties: false } },
            scenes: { type: "array", items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, anchorPrompt: { type: "string" } }, required: ["name", "description", "anchorPrompt"], additionalProperties: false } },
            props: { type: "array", items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" } }, required: ["name", "description"], additionalProperties: false } },
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
    projectId,
    version,
    frames: parsed.frames,
    characters: parsed.characters,
    scenes: parsed.scenes,
    props: parsed.props,
    generationPrompt: userPrompt,
    rulesUsed: prioritizedChapters.map(ch => ch.id),
  });

  await db.updateProject(projectId, { status: "scripted", currentVersion: version });

  console.log(`  ✅ Script generated: ${parsed.frames.length} frames, ${parsed.characters.length} characters, ${parsed.scenes.length} scenes`);
  console.log(`  📊 Total duration: ${parsed.frames.reduce((s, f) => s + f.duration, 0)}s`);
  
  return { scriptId, script: parsed, version };
}

async function generateAnchors(projectId) {
  const script = await db.getLatestScript(projectId);
  if (!script) throw new Error(`No script for project ${projectId}`);
  
  console.log(`\n🎨 Generating anchors for project ${projectId}...`);
  
  const characters = script.characters ?? [];
  const scenes = script.scenes ?? [];
  
  const results = [];
  
  for (const char of characters) {
    console.log(`  Generating character anchor: ${char.name}...`);
    try {
      const { url: imageUrl } = await generateImage({ prompt: char.anchorPrompt });
      const suffix = crypto.randomBytes(4).toString('hex');
      const key = `anchors/${projectId}/char-${char.name}-${suffix}.png`;
      const { url: storageUrl } = await storagePut(key, Buffer.from(await (await fetch(imageUrl)).arrayBuffer()), 'image/png');
      
      await db.saveAnchor({
        projectId,
        version: script.version,
        anchorType: 'character',
        name: char.name,
        description: char.description,
        prompt: char.anchorPrompt,
        imageUrl: storageUrl,
      });
      
      results.push({ type: 'character', name: char.name, url: storageUrl });
      console.log(`  ✅ ${char.name} anchor saved`);
    } catch (e) {
      console.error(`  ❌ Failed to generate anchor for ${char.name}:`, e.message);
    }
  }
  
  for (const scene of scenes) {
    console.log(`  Generating scene anchor: ${scene.name}...`);
    try {
      const { url: imageUrl } = await generateImage({ prompt: scene.anchorPrompt });
      const suffix = crypto.randomBytes(4).toString('hex');
      const key = `anchors/${projectId}/scene-${scene.name}-${suffix}.png`;
      const { url: storageUrl } = await storagePut(key, Buffer.from(await (await fetch(imageUrl)).arrayBuffer()), 'image/png');
      
      await db.saveAnchor({
        projectId,
        version: script.version,
        anchorType: 'scene',
        name: scene.name,
        description: scene.description,
        prompt: scene.anchorPrompt,
        imageUrl: storageUrl,
      });
      
      results.push({ type: 'scene', name: scene.name, url: storageUrl });
      console.log(`  ✅ ${scene.name} anchor saved`);
    } catch (e) {
      console.error(`  ❌ Failed to generate anchor for ${scene.name}:`, e.message);
    }
  }
  
  return results;
}

async function main() {
  console.log('🚀 Starting full pipeline test for 3 projects...\n');
  
  for (const pid of PROJECT_IDS) {
    try {
      // Step 1: Generate Script
      const { script, version } = await generateScript(pid);
      
      // Step 2: Generate Anchors
      const anchors = await generateAnchors(pid);
      
      console.log(`\n✅ Project ${pid} pipeline complete!`);
      console.log(`   Frames: ${script.frames.length}, Characters: ${script.characters.length}, Scenes: ${script.scenes.length}`);
      console.log(`   Anchors generated: ${anchors.length}`);
      console.log(`   → Grid generation should be done via UI (requires image generation with multiple references)`);
      
    } catch (e) {
      console.error(`\n❌ Project ${pid} pipeline failed:`, e.message);
    }
    
    console.log('\n' + '='.repeat(60));
  }
  
  console.log('\n🏁 All projects processed! Open the UI to generate Grids and test Prompt export.');
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
