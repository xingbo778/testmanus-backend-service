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
- [ ] Save checkpoint
- [ ] Push to GitHub
- [ ] Deploy to Railway
- [ ] End-to-end testing on Railway

## Railway Independent Deployment
- [ ] Replace Manus LLM API with Yunwu API (OpenAI compatible)
- [ ] Replace Manus Image Generation with Yunwu API
- [ ] Replace Manus OAuth with simple API key auth
- [ ] Replace Manus S3 storage with local/Railway volume
- [ ] Create Dockerfile for Railway deployment
- [ ] Create Railway project and MySQL service
- [ ] Set environment variables on Railway
- [ ] Deploy and generate domain
- [ ] End-to-end test on Railway
