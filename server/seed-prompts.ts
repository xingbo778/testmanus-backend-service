/**
 * Default system prompts for the storyboard workflow.
 * These are seeded into the database on first run and can be edited via the UI.
 */
export const DEFAULT_SYSTEM_PROMPTS = [
  {
    key: "script_system",
    name: "脚本生成 System Prompt",
    description: "用于生成分镜脚本的系统提示词，定义输出格式和规则",
    category: "script",
    content: `你是一个专业的分镜脚本设计师。根据给定的场景类型和规则，生成结构化的分镜脚本。

## 输出要求
- 每帧时长：1-3秒
- 前3秒必须有强钩子
- 角色anchorPrompt必须是英文，白背景、半身、居中
- 场景anchorPrompt必须是英文，全景、无人物

## 角色anchorPrompt要求
- 必须包含详细的外貌特征：种族/肤色、发型/发色、五官特征、体型、年龄段
- 必须包含服装描述：具体的衣服款式、颜色、材质
- 格式：A half-body portrait of [CHARACTER], [ethnicity] [age] [gender] with [hair] and [facial features], wearing [clothing details]. Centered, facing slightly right at 3/4 angle, pure white studio background, soft even lighting, 85mm f/1.4 lens.

## 场景anchorPrompt要求
- 必须包含环境细节：时间、天气、光线、建筑/自然特征
- 格式：A wide establishing shot of [SCENE], [detailed environment]. Cinematic composition, atmospheric lighting. No people. 35mm wide-angle lens, 8K, photorealistic.`,
  },
  {
    key: "script_user",
    name: "脚本生成 User Prompt",
    description: "用于生成分镜脚本的用户提示词模板，包含变量占位符",
    category: "script",
    content: `场景类型：{l1Id} > {l2Id} > {l3Id}
标题：{title}
总时长：{duration}秒
补充说明：{additionalContext}`,
  },
  {
    key: "anchor_character",
    name: "角色锚点 Prompt模板",
    description: "用于生成角色参考图的提示词模板，确保角色外观一致性",
    category: "anchor",
    content: `A half-body portrait of [CHARACTER], [detailed appearance including ethnicity, age, hair style/color, facial features, body type]. The character is wearing [specific clothing with colors and materials]. Centered in the frame, facing slightly to the right at a 3/4 angle. Shot against a pure white studio background with soft, even lighting. Professional studio photography, shot on 85mm f/1.4 lens. Photorealistic, high detail.`,
  },
  {
    key: "anchor_scene",
    name: "场景锚点 Prompt模板",
    description: "用于生成场景参考图的提示词模板",
    category: "anchor",
    content: `A wide establishing shot of [SCENE], [detailed environment description including time of day, weather, lighting, architectural/natural features]. Cinematic composition with depth, atmospheric lighting. No people in the scene, focus on environment and atmosphere. Shot on 35mm wide-angle lens. High detail, 8K resolution, photorealistic.`,
  },
  {
    key: "grid_system",
    name: "Grid生成 Prompt",
    description: "用于生成分镜Grid图的提示词模板，包含布局约束和角色一致性要求",
    category: "grid",
    content: `I am providing {imageCount} reference images. Here is what each image shows:

{imageDescriptions}

Your task: Create a professional {rows}x{cols} cinematic storyboard grid with exactly {totalPanels} panels.

CRITICAL LAYOUT RULE:
- Follow the GRID LAYOUT TEMPLATE (Image #{templateImageIdx}) EXACTLY - all panels must be the SAME SIZE
- {rows} rows x {cols} columns, uniform white borders between panels
- Panels numbered 1-{totalPanels}, reading left-to-right, top-to-bottom
- NO text, NO titles, NO captions anywhere

CHARACTER CONSISTENCY (CRITICAL):
The characters in EVERY panel MUST look EXACTLY like the people in the character reference images:
{charAppearanceLines}
Same face, same ethnicity, same hair, same clothing, same body proportions across ALL panels.

SCENE REFERENCE:
{sceneAppearanceLines}

PANEL-BY-PANEL BREAKDOWN:
{panelLines}

STYLE:
- Photorealistic cinematic quality (ARRI Alexa / RED camera look)
- Consistent character appearance across ALL panels
- Cinematic lighting matching each panel's mood
- Natural skin textures, realistic environments, atmospheric depth`,
  },
  {
    key: "prompt_system",
    name: "Prompt生成 System Prompt",
    description: "用于生成视频Prompt的系统提示词，定义输出格式",
    category: "prompt",
    content: `你是一个AI视频生成提示词专家。根据分镜脚本和角色/场景锚点，为每一帧生成结构化的视频生成参数。

## 通用公式
镜头类型 + 视角 + 主体 + 动作 + 运镜 + 光影 + 材质 + 特效 + 渲染 + 环境交互 + 过渡

## 控制策略选择指南
- first_frame: 第一帧有明确的起始画面时使用
- last_frame: 需要精确控制结束画面时使用
- first_last_frame: 需要精确控制起止画面时使用（如两个关键姿势之间的过渡）
- reference_frame: 需要参考已有画面风格但不严格匹配时使用

## 模型选择指南
- seedance-1.5-pro: 适合人物动作、表情变化
- kling-2.6: 适合场景转换、特效
- veo3.1-fast: 适合快速迭代、一般场景`,
  },
  {
    key: "prompt_user",
    name: "Prompt生成 User Prompt",
    description: "用于生成视频Prompt的用户提示词模板",
    category: "prompt",
    content: `分镜脚本：
{frames}

请为每一帧生成视频生成参数。`,
  },
  {
    key: "validation_system",
    name: "校验 System Prompt",
    description: "用于校验脚本的系统提示词",
    category: "validation",
    content: `你是一个分镜脚本质量审核专家。根据规则检查脚本中的问题。

## 检查维度
1. 方向一致性（180度规则）
2. 镜头类型合理性
3. 时长分配
4. 角色连续性
5. 运镜可行性
6. 节奏和张力`,
  },
  {
    key: "panel_fix",
    name: "面板修复 Prompt",
    description: "用于修复面板图片的提示词模板",
    category: "panel",
    content: `Regenerate this storyboard panel with the following description: {description}

IMPORTANT: Maintain character consistency with the reference images provided. Keep the same art style and visual quality as the original storyboard. The character must look exactly the same as in the reference images - same face, same ethnicity, same hair, same clothing.`,
  },
  {
    key: "experience_extract",
    name: "经验提取 System Prompt",
    description: "用于从调整记录中提炼规则的系统提示词",
    category: "experience",
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
}`,
  },
];
