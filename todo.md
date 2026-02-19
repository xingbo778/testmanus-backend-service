# Storyboard Platform TODO

## Database & Schema
- [x] Design and create all database tables (categories, projects, panels, anchors, rules, experiences, exports)
- [x] Push migrations

## Backend - Category System
- [x] Seed L1/L2/L3 category taxonomy
- [x] GET categories tree API
- [x] GET category detail API

## Backend - Project CRUD
- [x] Create project (select L3 + duration)
- [x] List projects (filter by category/status/duration)
- [x] Get project detail
- [x] Confirm project
- [x] Delete project

## Backend - Script Generation & Validation
- [x] Search references API (Google image search integration)
- [x] Generate script API (LLM-based, with rules injection)
- [x] Validate script API (Don't Do rules check)
- [x] Auto-fix script API

## Backend - Anchor & Grid
- [x] Analyze constants (extract characters/scenes/props from script)
- [x] Generate anchors API (character/scene reference images)
- [x] Generate grid API (M×N storyboard grid image)
- [x] Auto-annotate grid (panel numbers, shot types, durations)

## Backend - Panel Adjustment
- [x] Flag panel issue
- [x] Fix panel (inpaint/regenerate/reference-based)
- [x] Upload reference image for panel
- [x] Regenerate entire grid
- [x] Edit panel prompt

## Backend - Prompt Generation
- [x] Generate prompts for all panels (model/strategy/references)

## Backend - Experience Feedback Loop
- [x] Record adjustment experiences automatically
- [x] Get experience summary (high-frequency issues)
- [x] Extract rules from experiences (LLM-based)
- [x] Approve/reject extracted rules
- [x] List user-defined rules

## Backend - KB Export
- [x] Export confirmed projects as JSONL
- [x] Export rules library
- [x] Support full/incremental/by-category export

## Backend - Rule Management
- [x] Import rulebook chapters (from 分镜设计终极规则手册)
- [x] Get rules for scene type
- [x] Get rules for prompt generation

## Frontend - Layout & Navigation
- [x] Dashboard layout with sidebar navigation
- [x] Top navigation: Browse | Batch Generate | Experience | KB Export | Settings

## Frontend - Category Browse Page
- [x] L1→L2→L3 tree navigation (left sidebar)
- [x] Grid thumbnail list (right panel)
- [x] Status/duration filters
- [x] Create new project button

## Frontend - Project Detail & Adjust Page
- [x] Grid display with annotated panels (numbers, shot types, durations)
- [x] Panel selection → show prompt details on right
- [x] Version history navigation
- [x] Anchor reference images display

## Frontend - Panel Adjustment
- [x] Flag panel issue dialog
- [x] Fix options: regenerate / inpaint / upload reference
- [x] Modified description input
- [x] Regenerate entire grid button

## Frontend - Prompt View & Edit
- [x] Per-panel prompt display (model, strategy, references)
- [x] Inline prompt editing
- [x] Bulk prompt generation trigger

## Frontend - Experience Management Page
- [x] High-frequency issue statistics
- [x] Pending rules review (approve/reject)
- [x] Approved rules list with filters
- [x] Trigger rule extraction button
- [x] Export rules library button

## Frontend - KB Export Page
- [x] Export type selection (full/incremental/by-category/rules)
- [x] Export history list
- [x] Download links

## Testing
- [x] Vitest tests for category APIs
- [x] Vitest tests for project CRUD
- [x] Vitest tests for script generation & validation
- [x] Vitest tests for experience feedback

## Deployment
- [x] Save checkpoint
- [x] Push to GitHub
- [x] Deploy to Railway
- [x] End-to-end testing on Railway

## Railway Independent Deployment
- [x] Replace Manus LLM API with Yunwu API (OpenAI compatible)
- [x] Replace Manus Image Generation with Yunwu API
- [x] Replace Manus OAuth with simple API key auth
- [x] Replace Manus S3 storage with local/Railway volume (using Yunwu image URLs)
- [x] Create Dockerfile for Railway deployment
- [x] Create Railway project and MySQL service
- [x] Set environment variables on Railway
- [x] Deploy and generate domain
- [x] End-to-end test on Railway

## Phase 2: Complete Rules & Test Dialogue Scenes
- [x] Parse full rulebook (1087 rules across 25 chapters) from uploaded markdown
- [x] Batch import all rules to Railway database
- [x] Verify rule counts match expected 1087
- [x] Review and supplement dialogue scene L3 categories
- [x] Create test project for dialogue scene (e.g., cafe conversation)
- [x] Test full flow: script generation → validation → anchor → grid → prompt
- [x] Verify generated content quality
- [x] Push updates to GitHub

## Phase 3: ToAPIs Image Upload Integration
- [x] Research ToAPIs image upload API documentation
- [x] Add TOAPIS_API_KEY and TOAPIS_API_URL environment variables
- [x] Implement uploadBase64ToToapis function in imageGeneration.ts
- [x] Implement resolveBase64Image with 3-tier fallback (ToAPIs → S3 → data URL)
- [x] Write vitest tests for ToAPIs upload integration (3 tests, all passing)
- [x] Push code to GitHub for Railway auto-deploy
- [x] Set TOAPIS_API_KEY on Railway environment
- [x] End-to-end test: anchor generation with ToAPIs upload
- [x] End-to-end test: grid generation with ToAPIs upload
- [x] End-to-end test: complete workflow (script → anchor → grid → prompt)
- [x] Fix export fallback for Railway (data URL when S3 unavailable)
- [x] Verify KB export with confirmed project data

## Phase 4: Bug Fixes & UX Improvements (User Reported)
- [x] 1. 图片模型改用 gemini-3-pro-image-preview (yunwu chat completions API) + gemini-3-flash-preview (LLM)
- [x] 2. Anchor 图片在项目详情页不可见，修复显示（总览+脚本tab都展示）
- [x] 3. Grid 整体图片生成prompt优化，包含完整剧情上下文、角色、场景、逐帧描述
- [x] 4. 项目详情页总览同时展示脚本概要+Grid预览+Anchor锤点图
- [x] 5. 工作流进度按钮分离：查看（纯查看）和重新生成（需确认弹窗）
- [x] 6. 历史版本展示（脚本/Grid/Prompt各最多5个）+ 点击回退（需确认弹窗）
- [x] 7. Prompt 中修复 #NaN，正确显示panelIndex和时长信息
- [x] 8. 规则手册页面可点击查看详情（Dialog），每章显示标题，按分类分组展示

## Phase 5: Yunwu API Key on Railway + Chase Scene Test
- [x] Set YUNWU_API_KEY on Railway environment
- [x] Set YUNWU_API_URL on Railway environment
- [x] Trigger Railway redeploy
- [ ] Create chase scene project (追逐场景)
- [ ] Test script generation for chase scene
- [ ] Test anchor + grid generation with gemini-3-pro-image-preview
- [ ] Test prompt generation
- [ ] Verify end-to-end quality

## Phase 6: Bug Fixes Round 2 (User Reported)
- [x] 1. 锤点参考图去重（project.get按版本过滤anchors/panels）
- [x] 2. Anchor和Grid拆分为独立步骤（工作流6步，可单独重新生成）
- [x] 3. Grid下面板列表按grid版本过滤去重
- [x] 4. 重新生成前清理旧数据（deleteAnchorsForProject/deletePanelsForProject）
- [x] 5. 添加Anchor和Grid生成prompt查看入口（Dialog弹窗）

## Phase 7: Core Quality Fixes (Prompt & Generation)
- [x] 1. Anchor prompt优化：角色白背景居中半身、场景全景（Nano Banana Pro最佳实践）
- [x] 2. 支持单个anchor重新生成（anchor.regenerateOne mutation + 前端UI）
- [x] 3. Grid生成参考anchor图（传入originalImages）
- [x] 4. Grid prompt优化：结构化格式（Work Surface + Layout + Components + Constraints）
- [x] 5. 面板修复参考原始panel+anchor图，修复后同步回grid

## Phase 8: Major Feature Additions
### 8.1 脚本镜头编辑
- [x] 后端：script.updateFrame - 修改单个镜头（描述/景别/时长/运镜等）
- [x] 后端：script.addFrame - 在指定位置插入新镜头
- [x] 后端：script.removeFrame - 删除指定镜头
- [x] 前端：脚本tab中每个镜头添加编辑/删除按钮
- [x] 前端：添加"新增镜头"按钮，支持在任意位置插入
- [x] 前端：编辑镜头Dialog（修改描述/景别/时长/运镜）

### 8.2 Anchor单个重新生成
- [x] 前端：每个anchor卡片添加"重新生成"和"编辑prompt"按钮
- [x] 前端：编辑anchor prompt Dialog，支持自定义prompt后重新生成

### 8.3 规则管理CRUD
- [x] 后端：ruleCategory.create/update/delete - 分类增删改查
- [x] 后端：rule.create/update/delete - 规则增删改查
- [x] 前端：规则分类列表支持新增/编辑/删除
- [x] 前端：规则详情页支持新增/编辑/删除规则

### 8.4 Prompt管理
- [x] 后端：promptTemplate.list - 列出工作流中所有prompt模板
- [x] 后端：promptTemplate.get - 获取prompt模板内容
- [x] 后端：promptTemplate.translate - 翻译prompt为中文
- [x] 前端：Prompt管理页面（按分类分组展示）
- [x] 前端：每个prompt支持查看/编辑/翻译成中文/复制
- [x] 前端：侧边栏添加Prompt管理入口

## Phase 9: Core Quality Fixes Round 3
- [x] 1. 规则RAG注入优化：按优先级筛选规则（场景特定>通用>技术），大章节只保留warning/critical规则
- [x] 2. Grid参考anchor图：传入originalImages + prompt中明确要求参考角色外观
- [x] 3. Grid格式去标题：prompt中明确要求NO title/NO text/NO captions
- [x] 4. 风格统一为photorealistic cinematic（非漫画/插画）
- [x] 5. 审查步骤：点击"开始审查"进入reviewing状态，在Grid页面标记问题并修复
- [x] 6. Panel描述详细化：必须包含环境/背景/关键元素/人物位置/光线氛围/景深焦点

## Phase 10: Grid-Anchor Character Consistency + Grid Layout Fix
- [x] Grid生成的角色与Anchor完全不一致 → 在prompt中注入详细角色外观描述+传入anchor参考图
- [x] Grid分格大小不均匀 → 用Sharp生成标准均匀网格模板图作为参考输入
- [x] prompt中明确标注每张参考图的编号和对应关系（Image #N = CHARACTER/SCENE/GRID TEMPLATE）
- [x] 每张anchor参考图在prompt中包含完整的外观描述（种族/发型/服装/年龄等）
- [x] 网格模板图用Sharp生成（SVG→PNG），以data URL传入（几KB）
- [x] gridTemplate.ts + 4个vitest测试全部通过

## Phase 11: System Prompt Management
- [x] 数据库表：systemPrompts（id, key, name, description, category, content, contentZh, isDefault, updatedAt）
- [x] 后端CRUD：list/upsert/updateContent/delete/seed system prompts
- [x] 后端翻译：将英文prompt翻译成中文（LLM调用）
- [x] 前端Prompt管理页面：按分类展示所有系统prompt（7个分类）
- [x] 前端支持查看/编辑/翻译成中文/复制/删除/新增
- [x] 默认prompt种子初始化（seed-prompts.ts）

## Phase 12: Mobile Responsive Design
- [x] DashboardLayout: 移动端padding优化（p-3 sm:p-4 md:p-6）
- [x] ProjectDetail: header按钮堆叠、Script表格改卡片列表、Dialog全屏、grid-cols响应式
- [x] Browse: 分类网格单列适配、header堆叠、breadcrumb溢出滚动
- [x] Home: 统计卡片2列适配、快速操作单列
- [x] PromptManager: header堆叠、分类统计网格适配、Dialog适配
- [x] RuleManager: header按钮缩短文字、分类统计网格适配、章节卡片单列
- [x] ExperienceManager: 统计卡片2列适配
- [x] ExportManager: 导出设置单列适配
- [x] 所有Dialog中的grid-cols-2改为grid-cols-1 sm:grid-cols-2

## Phase 13: Panel Content Extraction & Display
- [x] 从Grid图中截取单个panel内容（Sharp裁剪，根据rows/cols/panelIndex计算坐标）
- [x] extractPanel + extractAllPanels函数实现
- [x] 修复面板时展示该panel的截取图（panelImageUrl字段）
- [x] panel截取图保存到ToAPIs并存入数据库
- [x] 前端“提取面板”按钮在Grid tab中

## Phase 14: Mask-based Panel Fix
- [x] MaskCanvas组件：前端Canvas画mask（可调画笔大小、擤除、清除）
- [x] mask数据传输（base64 data URL）
- [x] 后端inpaint修复：原图+mask+prompt传给gemini
- [x] Fix Dialog中集成MaskCanvas（选择inpaint时显示）

## Phase 15: Video Generation Workflow (Seedance 1.5 Pro)
- [x] Seedance 1.5 Pro / Kling v2.6 / VEO 3.1 Fast 模型支持
- [x] 数据库：videoClips表 + finalVideos表
- [x] 后端：videoGenerator.ts（创建任务/查询状态/轮询）
- [x] 后端：videoMerger.ts（FFmpeg合并所有clip）
- [x] 后端：video路由（generateClips/pollClipStatus/mergeClips/confirmFinal）
- [x] 前端：Video tab（模型选择/生成/状态网格/合并/播放/确认）
- [x] 自动轮询clip状态（30秒间隔）

## Phase 16: Error Handling & Log Session
- [x] 完善各API调用的报错处理（前端toast展示详细错误信息）
- [x] 数据库：appLogs表
- [x] 后端：appLogger.ts统一日志记录（logInfo/logWarn/logError/logDebug）
- [x] 后端：在脚本生成/anchor/grid/panel修复/prompt生成/视频生成中记录日志
- [x] 后端：日志查询API（分页+按level/source/project筛选）
- [x] 前端：Log Session页面（实时日志列表，自动刷新，筛选和搜索）
- [x] 前端：侧边栏“日志中心”入口
- [x] 前端：日志详情展开查看（JSON格式化details）

## Phase 17: Git Push & Railway Deploy
- [x] 推送代码到GitHub: https://github.com/xingbo778/storyboard-platform
- [x] 部署到Railway: SUCCESS
- [x] Railway域名: https://web-production-01d28.up.railway.app
- [x] 验证Railway部署: HTTP 200 OK

## Bug Fix: 提取面板报错
- [x] 排查并修复"提取面板"按钮点击后报错的问题 → storagePut在Railway无BUILT_IN_FORGE_API_KEY，改用uploadHelper（ToAPIs优先回退）

## Bug Fix: 提取面板功能问题
- [x] toast显示"已提取 undefined 个面板图片" -> 修复为result.panels?.length
- [x] Railway缺少app_logs表导致logInfo报错 -> 已push schema + 改为fire-and-forget

## Bug Fix: 面板提取图片不显示
- [x] toast显示提取了6个但面板卡片中图片未显示（根因：extractAll未传version参数，导致更新了旧版本面板）
- [x] 排查uploadFile是否返回有效URL
- [x] 排查db.updatePanel是否成功写入panelImageUrl
- [x] 排查前端panel.list查询是否返回panelImageUrl
- [x] 本地测试验证修复
- [x] Railway测试验证修复

## Bug Fix: 修复面板Dialog中MaskCanvas图片加载失败
- [x] MaskCanvas组件中面板图片一直显示"加载图片中..."无法加载（通过/api/image-proxy代理解决CORS）
- [x] 排查图片URL和CORS问题
- [x] 修复并在Railway验证

## Bug Fix: 视频生成失败 - errorMessage序列化问题
- [x] errorMessage是[object Object]导致DB update失败（添加typeof检查+JSON.stringify回退）
- [x] 排查视频生成API调用的实际错误原因（添加resp.ok检查）
- [x] 修复并在Railway验证

## Bug Fix: MaskCanvas图片CORS加载失败
- [x] ToAPIs图片无CORS头，MaskCanvas设置crossOrigin="anonymous"导致加载失败（添加/api/image-proxy代理）
- [x] 添加后端图片代理端点
- [x] 修复并在Railway验证

## Bug Fix: Prompt管理页面为空
- [x] Railway数据库system_prompts表为空（服务器启动时自动seed）
- [x] 确保seed-prompts在Railway部署时自动执行（autoSeedOnStartup）

## Bug Fix: 视频生成改进
- [x] kling-v2-6模型不可用（503），默认改用veo3.1-fast
- [x] 添加"清除失败clips"按钮和API
- [x] 失败clips折叠显示，不占太多空间
- [x] 视频生成改为异步：前端提交后立即返回，后台异步处理- [x] 旧的[object Object]错误 clips也需要能清除

## 视频生成质量分析与改进
- [x] 检查生成的视频内容质量（播放视频、查看prompt）
- [x] 分析prompt传入方式是否正确（keyframe图+prompt文本）——根因是panelId不匹配，改用panelIndex
- [x] 分析模型参数是否最优（改用veo3.1-fast）
- [x] 提出改进方案（panelIndex匹配+prompt精简+去重）

## 视频生成质量改进（用户反馈）
- [x] Panel #6生成的视频场景和参考分镜差别很大（根因：panelId不匹配导致没有keyframe）
- [x] Panel #4有两个clip，其中一个和剧情无关（根因：每个panel多个prompt生成多个clip）
- [x] 每个Panel不应生成2个clip（已修复：按panelIndex去重，优先image-to-video）
- [x] Prompt过长可能导致模型理解困难（已精简：有keyframe时只保留动作描述）
- [x] keyframe图质量对视频生成影响大（已修复：panelIndex匹配确保正确传入）
- [x] videoUrl在completed状态下为NONE（实际上clipUrl有值，是查询方式问题）

## 分镜面板提取改进（截取→AI重绘）
- [x] 分析当前截取方式的边框问题
- [x] 研究nano banana pro模型能力（Gemini 3 Pro Image Preview）
- [x] 用AI图像生成替代简单截取，避免截到边框
- [x] panelExtractor.ts支持crop和ai两种模式，默认ai模式

## Seedance 1.5 Pro API调用修复
- [x] 模型名称错误：应为 doubao-seedance-1-5-pro-251215（不是 seedance-1.5-pro）
- [x] API端点错误：应为 /volc/v1/contents/generations/tasks（不是 /v1/video/create）
- [x] 请求体格式不同：content数组+ratio+duration+watermark（不是prompt+images+aspect_ratio）
- [x] 查询端点不同：GET /volc/v1/contents/generations/tasks/{id}（不是 /v1/video/query?id=）
- [x] 状态值不同：succeeded/failed（不是 completed/failed）
- [x] 测试图生视频模式的参数格式（first_frame_image字段）
- [x] 更新videoGenerator.ts支持两种API格式（Volc+VEO自动路由）
- [x] 前端模型选择更新（默认Seedance 1.5 Pro）
- [x] pollClipStatus支持Volc查询端点（根据taskId前缀cgt-自动路由）

## Prompt一键导出功能
- [x] 分析Prompt数据结构和前端页面
- [x] 前端添加"导出Prompt"下拉菜单（JSON/CSV/TXT）
- [x] 42个测试全部通过

## Seedance 2.0 格式导出 + 一键下载
- [x] 搜索Seedance 2.0基于N宫格生成视频的prompt写法（@引用语法+分镜图模板）
- [x] 导出Prompt时新增“Seedance格式”选项
- [x] 一键下载N宫格图+Anchor+面板图（JSZip打包ZIP）
- [x] 42个测试全部通过

## Seedance导出改进 + ZIP下载修复
- [x] Seedance prompt改为6个策略选项（动作驱动/动作+氛围/动作+细节/电影感/完整描述/极简）
- [x] 导出改为复制到剪贴板（点击即复制）
- [x] 修复ZIP下载CORS问题（通过后端proxyImages代理下载图片）

## Phase 18: Bug Fixes Round 3 (User Reported 2026-02-19)
- [x] 1. Grid生成没有参考anchor图 — 修复anchor版本匹配逻辑，优先当前版本，fallback到所有版本
- [x] 2. Grid点击"重新生成"按钮没有反应 — 确认弹窗逻辑正常，增加日志排查
- [x] 3. 修复面板Dialog增加更多参考图选项：原图（未修复的）+ 其他帧作为参考图（可点击选择）
- [x] 4. 修复面板Dialog中显示Grid生成时该panel对应的prompt（分镜描述+视频Prompt+景别标签）

## Phase 19: Grid重新合成 + 修复风格一致性 (2026-02-19)
- [x] 1. panel.fix增强：将原始Grid图作为参考图传入，强化风格一致性prompt
- [x] 2. 新增grid.regenerateFromPanels路由：原始Grid+修改后panel作为参考图，prompt指定只修改某几个panel，其他保持不变
- [x] 3. 前端新增"重新合成Grid"按钮，自动检测哪些panel被修改过
- [x] 4. 修复后的panel风格与原始Grid保持一致

## Phase 20: Grid重新合成按钮 + Prompt分段导出 + L3测试 (2026-02-19)
- [x] 1. 前端添加"重新合成Grid"按钮（自动检测已修改panel）
- [x] 2. 添加regenerateFromPanels mutation到前端
- [x] 3. Prompt分段导出：按Seedance 15s限制自动分段，每段≤15s
- [x] 4. 分段导出UI：显示分段信息，每段独立复制
- [ ] 5. 用L3项目测试30s/45s分镜完整流程
- [x] 6. 图片生成API超时+重试机制（5分钟超时，最多3次重试）
- [x] 7. 支持45秒时长（schema+前后端+16帧/3×6布局）

## Phase 21: Grid生成Bug修复 + L3测试 (2026-02-19)
- [x] 修复imageGeneration.ts中urlToBase64Part不支持data URL（Grid模板是data URL）
- [x] 修复grid.generate的try-catch范围覆盖参考图准备阶段（generateGridTemplateDataUrl等）
- [x] 修复grid.regenerateFromPanels的try-catch范围覆盖参考图准备阶段
- [x] 修复newFeatures.test.ts中generateGridTemplateDataUrl调用签名（旧位置参数→新对象参数）
- [x] 42个测试全部通过
- [ ] 推送到GitHub + Railway自动部署
- [ ] 在Railway上测试Project 52的Grid生成
- [ ] 测试Prompt分段导出（30s→2段）
- [ ] 创建45s项目测试16帧/3×6布局

## Phase 22: Grid格数分析 + 长时长分镜方案 (2026-02-19)
- [x] 检查Project 52 Grid效果（面板提取质量、细节清晰度）
- [x] 分析不同时长对应的最佳Grid格数
- [x] 设计1-2分钟长时长分镜的多Grid方案
- [x] 实现多Grid支持

## Phase 23: 多Grid分页方案 (2026-02-19)
- [x] Schema: grids表添加pageIndex字段，支持一个项目多个Grid
- [x] Schema: 项目duration支持60/90/120秒
- [x] 后端: Grid生成按每页最多12格分页，每页独立生成Grid（共享Anchor）
- [x] 后端: 多Grid之间相邻Grid传递过渡参考（前一页Grid图片URL）
- [ ] 后端: Prompt生成按Grid分页
- [ ] 后端: Seedance导出按Grid分页
- [x] 前端: Grid tab支持多页切换（分页导航）
- [x] 前端: 项目创建支持60/90/120秒时长
- [x] 前端: 脚本生成帧数范围更新
- [x] 测试: splitFramesIntoPages单元测试（16个测试全部通过）
- [ ] 测试: Railway部署端到端测试
