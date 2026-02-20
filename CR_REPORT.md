# Code Review Report - storyboard-platform

## 概述

对 storyboard-platform 项目进行全面 Code Review，覆盖数据库 Schema、后端路由、前端页面、配置和测试。

---

## 🔴 Bug（需修复）

### BUG-1: `like()` 搜索存在 SQL 通配符注入风险
**文件**: `server/db.ts` 第 863 行、第 1072 行
**问题**: 用户输入直接拼接到 `like()` 模式中，`%` 和 `_` 等 SQL 通配符字符没有转义。攻击者可以通过输入 `%` 来匹配所有记录，或使用 `_` 进行单字符模糊匹配。
```ts
// 当前代码
conditions.push(like(anchorLibrary.name, `%${opts.search}%`));
// 如果用户输入 "%"，等效于 LIKE '%%%'，匹配所有
```
**修复**: 转义 `%` 和 `_` 字符。

### BUG-2: Anchor 库导入时 `usageCount` 没有递增
**文件**: `server/routers.ts` `anchor.importFromLibrary` mutation
**问题**: 从 Anchor 库导入到项目时，库中 Anchor 的 `usageCount` 字段没有 +1。这个字段的设计目的就是跟踪使用次数，但导入操作没有更新它。
**修复**: 在导入成功后，对每个导入的 library item 执行 `UPDATE SET usageCount = usageCount + 1`。

### BUG-3: `isPolling` useEffect 依赖数组缺失 `pollClipsMut`
**文件**: `client/src/pages/ProjectDetail.tsx` 第 243-255 行
**问题**: `useEffect` 内部使用了 `pollClipsMut.mutate`，但依赖数组只有 `[isPolling, projectId]`。虽然 tRPC mutation 对象通常是稳定引用，但这违反了 React hooks 的 exhaustive-deps 规则，可能在某些边缘情况下导致 stale closure。
**风险**: 低，但应该修复以符合最佳实践。

### BUG-4: 硬编码 Admin API Key 安全风险
**文件**: `server/_core/env.ts` 第 17 行
**问题**: `adminApiKey: process.env.ADMIN_API_KEY ?? "storyboard-admin-2024"` — 如果 Railway 没有设置 `ADMIN_API_KEY` 环境变量，任何人都可以用默认密钥 `storyboard-admin-2024` 登录为 Admin。
**修复**: 移除默认值，或在生产环境中强制要求设置环境变量。

### BUG-5: 视频轮询 useEffect 中 `videoClips.data` 依赖缺失
**文件**: `client/src/pages/ProjectDetail.tsx` 第 237-241 行
**问题**: `useEffect` 依赖数组是 `[videoClips.data]`，但内部调用了 `setIsPolling`。当 `videoClips.data` 变化时会触发，但如果 `isPolling` 已经是 `true`，`setIsPolling(true)` 是无效操作。虽然不会导致 bug，但逻辑冗余。

---

## 🟡 优化建议

### OPT-1: `routers.ts` 文件过大（2600+ 行），应拆分
**文件**: `server/routers.ts`
**问题**: 单个文件包含所有路由逻辑（auth, category, project, script, anchor, grid, panel, prompt, video, experience, export, anchorLib 等），超过 2600 行。
**建议**: 按功能拆分为 `server/routers/script.ts`, `server/routers/anchor.ts`, `server/routers/video.ts` 等，每个文件 100-200 行。

### OPT-2: 数据库表缺少索引
**文件**: `drizzle/schema.ts`
**问题**: 以下高频查询字段没有索引：
- `scripts.projectId` — 按项目查询脚本
- `anchors.projectId` — 按项目查询 Anchor
- `grids.projectId` — 按项目查询 Grid
- `panels.projectId` — 按项目查询面板
- `panels.gridId` — 按 Grid 查询面板
- `prompts.projectId` — 按项目查询 Prompt
- `videoClips.projectId` — 按项目查询视频
- `anchorLibrary.anchorType` — 按类型筛选
- `anchorLibrary.style` — 按风格筛选
**影响**: 随着数据量增长，查询性能会显著下降。
**建议**: 添加复合索引。

### OPT-3: 串行 `await` 循环可改为并行
**文件**: `server/routers.ts` 多处
**问题**: 以下代码使用 `for...of + await` 串行执行，可以用 `Promise.all` 并行化：
- Anchor 生成（角色图片逐个生成，第 865 行）
- 从库导入 Anchor（逐个保存，第 978 行）
- 经验规则提取（逐条保存，第 1845 行）
**建议**: 使用 `Promise.allSettled` 并行执行，失败的单独处理。

### OPT-4: `ProjectDetail.tsx` 过大（2100+ 行）
**文件**: `client/src/pages/ProjectDetail.tsx`
**问题**: 单个组件文件超过 2100 行，包含 6 个 Tab 的所有逻辑和 UI。
**建议**: 拆分为子组件：`ScriptTab.tsx`, `AnchorTab.tsx`, `GridTab.tsx`, `PromptTab.tsx`, `VideoTab.tsx`。

### OPT-5: `AnchorLibrary.tsx` 过大（700+ 行）
**文件**: `client/src/pages/AnchorLibrary.tsx`
**问题**: 单个文件包含列表页、创建对话框、详情对话框、编辑逻辑。
**建议**: 拆分为 `AnchorLibraryList.tsx`, `AnchorCreateDialog.tsx`, `AnchorDetailDialog.tsx`。

### OPT-6: 大量 `as any` 类型断言
**文件**: `server/routers.ts`（15+ 处）
**问题**: 使用 `as any` 绕过类型检查，失去了 TypeScript 的类型安全保护。
**建议**: 定义正确的类型接口，特别是 JSON 字段（frames, characters, scenes, fixHistory 等）。

### OPT-7: 缺少 Anchor 库的单元测试
**文件**: `server/*.test.ts`
**问题**: 现有 8 个测试文件覆盖了 storyboard 核心流程、Grid 模板、面板提取等，但没有专门的 Anchor 库测试。
**建议**: 添加 `server/anchorLib.test.ts`，覆盖 CRUD、导入导出、搜索筛选等。

### OPT-8: 前端错误处理可以统一
**文件**: 多个前端文件
**问题**: 每个 mutation 都有独立的 `onError: (err) => toast.error(...)` 处理，代码重复。
**建议**: 创建一个 `useMutationWithToast` hook 统一处理成功/失败提示。

---

## 🟢 做得好的地方

1. **类型安全的 tRPC 端到端类型流**: 前后端共享类型，减少了接口不一致的风险
2. **版本控制系统**: 项目支持版本回退，每次操作都记录版本
3. **结构化日志系统**: `appLogger.ts` 提供了统一的日志记录
4. **经验反馈循环**: 从面板修复中提取经验规则，用于改进后续生成
5. **多页 Grid 支持**: 长脚本自动分页生成多个 Grid
6. **Anchor 库设计**: 全局复用 Anchor，支持跨项目共享

---

## 修复优先级

| 优先级 | 编号 | 描述 | 工作量 |
|--------|------|------|--------|
| P0 | BUG-4 | 硬编码 Admin API Key | 小 |
| P0 | BUG-1 | SQL 通配符注入 | 小 |
| P1 | BUG-2 | 导入时 usageCount 未递增 | 小 |
| P1 | OPT-2 | 添加数据库索引 | 中 |
| P2 | OPT-3 | 串行 await 改并行 | 中 |
| P2 | OPT-7 | 添加 Anchor 库测试 | 中 |
| P3 | OPT-1 | 拆分 routers.ts | 大 |
| P3 | OPT-4 | 拆分 ProjectDetail.tsx | 大 |
