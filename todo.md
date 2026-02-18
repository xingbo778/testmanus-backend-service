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
