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
- [x] 后端: Prompt生成按Grid分页
- [x] 后端: Seedance导出按Grid分页
- [x] 前端: Grid tab支持多页切换（分页导航）
- [x] 前端: 项目创建支持60/90/120秒时长
- [x] 前端: 脚本生成帧数范围更新
- [x] 测试: splitFramesIntoPages单元测试（16个测试全部通过）
- [x] 测试: 本地dev server端到端测试通过（60秒项目，22帧，2页Grid，4段Seedance导出）

## Phase 24: Bug修复 - Railway Project 52页面打不开 (2026-02-20)
- [x] 诊断Railway上Project 52页面打不开的原因（grids表缺少pageIndex/pageLabel/startFrame/endFrame列，projects.duration缺少60/90/120枚举值）
- [x] 修复问题（通过ALTER TABLE手动添加缺失列和枚举值）
- [x] 通过GitHub connector推送代码到GitHub（GH_TOKEN环境变量可用）
- [x] 验证Railway部署后Project 52可正常访问

## Phase 25: 全局Anchor库管理 (2026-02-20)
- [x] Schema: 新增anchorLibrary表（全局Anchor库，独立于项目）
- [x] Schema: anchorLibrary表内置tags JSON字段（无需独立tags表）
- [x] 后端: anchorLib CRUD路由（创建/编辑/删除/列表/搜索）
- [x] 后端: 从Anchor库导入到项目的路由（anchor.importFromLibrary）
- [x] 后端: 从项目Anchor保存到库的路由（anchor.exportToLibrary）
- [x] 前端: Anchor库管理页面（侧边栏入口 /anchors）
- [x] 前端: Anchor库浏览/搜索/筛选（按类型/风格过滤）
- [x] 前端: Anchor详情编辑（名称/描述/风格/标签/图片）+ 重新生成图片
- [x] 前端: 项目Anchor tab "从库中导入"按钮（选择多个库Anchor导入）
- [x] 前端: 项目Anchor tab "导出到库"按钮（每个Anchor卡片上传按钮）
- [x] 测试: 58个测试全部通过（含Anchor库相关逻辑）
- [x] 测试: 端到端测试通过（导出3个Anchor到库→库中显示3个→导入对话框正常）

## Phase 26: 30%法则 - 相邻镜头差异性保证 (2026-02-21)
- [ ] 脚本生成system prompt集成30%法则规则（相邻镜头景别/角度/构图至少30%变化）
- [ ] 添加相邻镜头差异性验证逻辑（shotType+cameraAngle连续重复检测）
- [ ] Prompt生成后自动标记违反30%法则的相邻镜头对
- [ ] 前端显示30%法则违规警告
- [ ] 对Railway上80个项目执行30%法则批量检查，生成违规报告

## Bug Fix: Anchor库列表页不显示数据 (2026-02-20)
- [x] 前端AnchorLibrary.tsx发送limit:200超过后端验证max(100)导致400错误
- [x] 修复：limit改为100

## Code Review 修复 (2026-02-20)
- [x] BUG-1: SQL LIKE通配符注入修复（escapeLike函数转义%和_字符）
- [x] BUG-4: 移除硬编码Admin API Key默认值（空字符串禁用API Key认证）
- [x] OPT-2: 添加11个数据库索引（scripts/anchors/grids/panels/prompts/videoClips/anchorLibrary）
- [ ] OPT-1: 拆分routers.ts（2600+行→按功能模块拆分）
- [ ] OPT-3: 串行await循环改为Promise.all并行
- [ ] OPT-4: 拆分ProjectDetail.tsx（2100+行→子组件）
- [ ] OPT-5: 拆分AnchorLibrary.tsx（700+行→子组件）
- [ ] OPT-7: 添加Anchor库专项单元测试

## 端到端测试用例 (2026-02-20)
- [x] 项目CRUD测试（创建/列表/详情/更新/删除）
- [x] 脚本CRUD测试（生成/列表/更新/版本管理）
- [x] Anchor CRUD测试（生成/列表/更新/删除/导出到库/从库导入）
- [x] Grid生成测试（生成/列表/多页分页）
- [x] Panel测试（列表/更新/提取）
- [x] Prompt测试（生成/列表/更新/导出）
- [x] 视频Clip测试（创建任务/轮询状态/清除失败）
- [x] Anchor库测试（CRUD/搜索/筛选/导入导出）
- [x] 经验记录测试（创建/列表/搜索）
- [x] 辅助功能测试（SQL通配符转义/分页/权限）
- [x] 运行全部测试通过（161 tests, 9 files, all passed）
- [x] 推送到GitHub

## Phase 27: 集成测试 - 3个测试Case实际运行Grid和Prompt生成
- [x] 编写3个测试case（不同题材/时长）的集成测试脚本
- [x] Case 1: 短片（15s）- 运行完整流程（创建→脚本→Anchor→Grid→Prompt）✅ 6帧/3anchor/1页Grid/6prompt
- [x] Case 2: 中片（30s）- 运行完整流程 ✅ 12帧/2anchor/1页Grid(3×4)/12prompt
- [x] Case 3: 长片（60s多Grid）- 运行完整流程 ✅ 18帧/3anchor/2页Grid(1/2有图)/18prompt
- [x] 验证每个case的Grid和Prompt生成结果
- [x] 建立发布后自动验证脚本 e2e-pipeline.test.ts（vitest，3个case，quick/medium/long）

## Phase 28: 批量L3分类覆盖 - 为所有未生成过的L3创建项目并生成Grid+Prompt
- [x] 获取所有L3分类列表，对比已有项目，找出未覆盖的L3
- [x] 批量创建项目并运行完整生成流程（脚本→Anchor→Grid→Prompt）
- [x] 验证所有生成结果 ✅ 80个项目，77个grid_generated，72/72 L3全部覆盖
- [x] 创建Anchor库：亚洲男+亚洲女通用角色 + 10个通用场景
- [x] 新项目使用固定Anchor（importFromLibrary）保持角色一致性

## Phase 29: 视频生成 - 选几个项目生成视频并拼接
- [ ] 选择项目并获取完整Prompt和Anchor数据
- [ ] 使用veo3.1-fast生成各面板视频片段
- [ ] 下载视频片段并拼接成完整剧情

## Phase 30: 30%法则全面修复 (2026-02-21)
- [x] 后端：实现30%法则验证逻辑（shotType + description语义相似度 + 场景/角色重复检测）
- [x] 后端：新增 script.validate30PercentRule tRPC procedure
- [x] 后端：改进脚本生成system prompt，强制面板差异性（场景/构图/主体位置必须30%以上变化）
- [x] 后端：修复Grid编号重复bug（面板编号出现重复的3/9/10/11）— Grid prompt中明确禁止画编号
- [x] 前端：在脚本详情页显示30%法则违规警告标记
- [x] 编写vitest测试覆盖30%法则验证逻辑（9个测试全部通过）

## Phase 31: 3×3 Grid布局（最后3格留空）(2026-02-22)
- [x] calculateGridLayout 改为所有 ≤6 面板返回 3×3（emptyCount = 9 - panelCount）
- [x] splitFramesIntoPages 改为每页最多6帧（MAX_PANELS_PER_GRID=6）
- [x] gridTemplate 空格子渲染为深色/黑色（区别于内容格）
- [x] Grid prompt 指示 Gemini 将空格子保持纯黑
- [x] 更新 multiGrid.test.ts 匹配新的布局逻辑（19个测试全部通过）
- [x] 推送到 GitHub + Railway 自动部署
- [x] 验证 Railway 上 Grid 生成效果（项目 #66 已验证通过）

## Phase 32: 修复 Gemini 不遵守空格子纯黑指令 (2026-02-22)
- [x] 已废弃 — 改用 Phase 33 的新方案（逐张Panel生成+拼接）

## Phase 33: 新Grid方案 — Gemini生成Grid → 逐张Panel → Sharp拼接2×3 (2026-02-22)
- [x] 实现 panelGenerator.ts：基于Grid整体图+Anchor逐张生成独立Panel
- [x] 实现 gridComposer.ts：用Sharp将6个Panel拼接成2×3最终图
- [x] 修改 gridUtils.ts 串联三阶段流程（Grid生成→Panel生成→拼接）
- [x] 去掉空格子相关逻辑（不再需要3×3空格子，最终输出2×3）
- [x] 编写测试并本地验证（19个测试全部通过）
- [ ] 推送到GitHub + Railway验证
## Phase 34: Grid生成异步化 + 安全删除 (2026-02-22)
- [x] grid.generate 改为异步：立即返回，后台处理
- [x] 安全删除：先生成新Grid，成功后再删除旧的
- [x] 项目状态跟踪：grid_generating → grid_generated（schema已迁移）
- [ ] 推送到GitHub + Railway验证（Phase 34）

## Phase 35: Panel生成重试机制 (2026-02-22)
- [x] panelGenerator.ts 加入单Panel重试（最多2次，指数退避）
- [x] 修复 TypeScript 编译错误（prompt 变量名冲突→panelPrompt）
- [x] generateAllPanels 使用 generateSinglePanelWithRetry 替代直接调用
- [x] 更新 e2e.test.ts 适配异步 grid.generate 返回格式
- [x] 所有测试通过（103 e2e + 19 multiGrid + 11 newFeatures + 18 其他 = 151+）
- [x] 推送到GitHub

## Phase 36: Railway 部署优化与验证 (2026-02-22)
- [x] 检查 Railway 部署状态（最新代码已部署，触发了重新部署 03:07 UTC）
- [x] 在 Railway 上测试三阶段 Grid 生成（项目 #66 赛博朋克）
- [x] 验证 Panel 重试机制生效（之前失败的 Panel #8, #9 现在成功生成）
- [x] 检查生成结果质量（12/12 Panel 全部成功，两页 Grid 完整）
- [x] 提取面板成功（12 个独立 Panel 图片全部提取）
- [x] 无需修复，全流程工作正常

## Phase 37: 挑选3个L3场景并在Railway走完全流程 (2026-02-22)
- [x] 查看当前L1/L2/L3分类体系（72个L3全部已测试过）
- [x] 挑选3个有代表性的L3场景（悬疑推理/武侠对决/美食ASMR）
- [x] 优化L3场景描述（更新了3个L3的详细描述）
- [x] 在Railway上创建3个项目并走完全流程（ID: 81, 82, 83）
- [x] 检查生成结果质量（所有页面100%生成，面板92-100%）
- [x] 添加页面级重试机制（最多2次，3s/6s退避）
- [x] 推送到GitHub并验证生效

## Phase 38: Grid画面质量优化 - 去灰+去CG感 (2026-02-22)
- [x] 分析当前Grid/Panel生成prompt中导致灰色调和CG感的关键词
- [x] 优化prompt：移除ARRI/RED/8K，改用35mm胶片+Kodak育色风格
- [x] 优化Anchor prompt：确保参考图也是真实摄影风格
- [x] 推送到GitHub + Railway重新生成3个项目验证
- [x] 对比前后效果：所有页面生成成功（7/7页）
- [x] 修复纯黑Panel问题：占位图改为红色X标记+文字提示，新增Stage 2.5二次重试

## Phase 39: 切换生图模型 + 修复图片截断 (2026-02-22)
- [x] 将默认生图模型从gemini-2.5-flash-image-preview改为gemini-3-pro-image-preview
- [x] 排查Grid图片底部Panel未渲染完全的根因：PNG文件过大(5MB+)导致ToAPIs上传截断
- [x] 修复图片截断问题：Sharp输出从PNG改为JPEG(quality 92)，文件大小从5MB降至~650KB
- [x] 推送到GitHub + Railway重新生成3个项目验证
- [x] 所有7张Grid图片完整渲染，Row 3黑色像素从59%降至3-5%

## Phase 41: RAG规则导出 + 规则遵循优化 + 3个15秒L3项目 (2026-02-22)
- [x] 分析RAG规则注入逻辑，导出实际注入到脚本/Grid/Prompt的规则内容
- [x] 优化规则注入机制，确保规则被更好地遵循
- [ ] 挑选3个新的L3场景（15秒时长）
- [ ] 在Railway创建3个项目并走完全流程
- [ ] 检查生成结果质量，验证规则遵循情况
- [x] 去重复规则章节（55→39章节，1281→1177规则，删除16个重复）
- [x] 优化规则注入策略：脚本生成（智能选择top-N规则，移除technical.slice(0,3)硬限制）
- [x] 优化规则注入策略：Grid/Panel生成（注入精简的视觉规则——构图/景别/光线）
- [x] 新增buildRulesForGrid()函数：为图片生成提取最相关的视觉规则
- [x] 新增ruleSelector.ts模块 + 19个vitest测试全部通过
