import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================
// L1 Categories
// ============================================================
export const categoriesL1 = mysqlTable("categories_l1", {
  id: varchar("id", { length: 32 }).primaryKey(), // e.g. "narrative"
  name: varchar("name", { length: 128 }).notNull(),
  nameEn: varchar("nameEn", { length: 128 }),
  description: text("description"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================================
// L2 Categories
// ============================================================
export const categoriesL2 = mysqlTable("categories_l2", {
  id: varchar("id", { length: 64 }).primaryKey(), // e.g. "narrative.chase"
  l1Id: varchar("l1Id", { length: 32 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  nameEn: varchar("nameEn", { length: 128 }),
  description: text("description"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================================
// L3 Categories
// ============================================================
export const categoriesL3 = mysqlTable("categories_l3", {
  id: varchar("id", { length: 96 }).primaryKey(), // e.g. "narrative.chase.urban"
  l1Id: varchar("l1Id", { length: 32 }).notNull(),
  l2Id: varchar("l2Id", { length: 64 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  nameEn: varchar("nameEn", { length: 128 }),
  description: text("description"),
  templateRef: varchar("templateRef", { length: 128 }), // reference to existing template
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================================
// Projects (one project = one storyboard)
// ============================================================
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  l1Id: varchar("l1Id", { length: 32 }).notNull(),
  l2Id: varchar("l2Id", { length: 64 }).notNull(),
  l3Id: varchar("l3Id", { length: 96 }).notNull(),
  duration: mysqlEnum("duration", ["15", "30", "45", "60", "90", "120"]).default("15").notNull(),
  status: mysqlEnum("status", ["draft", "scripted", "anchors_generated", "grid_generating", "grid_generated", "reviewing", "confirmed"]).default("draft").notNull(),
  currentVersion: int("currentVersion").default(1).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;

// ============================================================
// Scripts (structured storyboard script per project version)
// ============================================================
export const scripts = mysqlTable("scripts", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  version: int("version").default(1).notNull(),
  // Full structured script as JSON array of frames
  // Each frame: { index, shotType, duration, description, cameraMovement, notes }
  frames: json("frames").notNull(),
  // Constants extracted from script
  characters: json("characters"), // [{name, description, anchorPrompt}]
  scenes: json("scenes"),         // [{name, description, anchorPrompt}]
  props: json("props"),           // [{name, description}]
  // Validation results
  validationResult: json("validationResult"), // {passed, violations: [{rule, severity, frame, suggestion}]}
  validationPassed: boolean("validationPassed"),
  // Generation metadata
  rulesUsed: json("rulesUsed"),   // rule IDs used during generation
  generationPrompt: text("generationPrompt"), // the actual prompt sent to LLM
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_scripts_project_version").on(t.projectId, t.version),
]);

export type Script = typeof scripts.$inferSelect;

// ============================================================
// Anchors (reference images for characters/scenes)
// ============================================================
export const anchors = mysqlTable("anchors", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  version: int("version").default(1).notNull(),
  anchorType: mysqlEnum("anchorType", ["character", "scene", "prop"]).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  prompt: text("prompt"),        // prompt used to generate
  imageUrl: text("imageUrl"),    // S3 URL
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_anchors_project_version").on(t.projectId, t.version),
]);

export type Anchor = typeof anchors.$inferSelect;

// ============================================================
// Grids (the M×N storyboard grid image)
// ============================================================
export const grids = mysqlTable("grids", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  version: int("version").default(1).notNull(),
  pageIndex: int("pageIndex").default(0).notNull(), // 0-based page index for multi-grid support
  pageLabel: varchar("pageLabel", { length: 64 }),  // e.g. "Page 1/3 (frames 1-12)"
  startFrame: int("startFrame"),  // first frame index in this grid page (1-based)
  endFrame: int("endFrame"),      // last frame index in this grid page (1-based)
  rows: int("rows").notNull(),       // M
  cols: int("cols").notNull(),       // N
  totalPanels: int("totalPanels").notNull(),
  gridImageUrl: text("gridImageUrl"),         // S3 URL of the full grid
  annotatedImageUrl: text("annotatedImageUrl"), // S3 URL with annotations
  generationPrompt: text("generationPrompt"), // prompt used to generate grid
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [
  index("idx_grids_project_version").on(t.projectId, t.version),
]);

export type Grid = typeof grids.$inferSelect;

// ============================================================
// Panels (individual cells in a grid)
// ============================================================
export const panels = mysqlTable("panels", {
  id: int("id").autoincrement().primaryKey(),
  gridId: int("gridId").notNull(),
  projectId: int("projectId").notNull(),
  version: int("version").default(1).notNull(),
  panelIndex: int("panelIndex").notNull(),   // 1-based index
  shotType: varchar("shotType", { length: 32 }), // EWS, WS, FS, MS, MCU, CU, ECU, INS
  duration: varchar("duration", { length: 16 }),  // e.g. "2.0"
  description: text("description"),
  cameraMovement: varchar("cameraMovement", { length: 64 }), // pan, tilt, dolly, etc.
  // Panel status
  status: mysqlEnum("status", ["ok", "flagged", "fixing", "fixed"]).default("ok").notNull(),
  issueDescription: text("issueDescription"),
  fixHistory: json("fixHistory"), // [{timestamp, action, description, result}]
  // Extracted panel image (cropped from grid)
  panelImageUrl: text("panelImageUrl"),
  // Reference images used for this panel
  referenceImageUrls: json("referenceImageUrls"), // string[]
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_panels_project_version").on(t.projectId, t.version),
  index("idx_panels_grid").on(t.gridId),
]);

export type Panel = typeof panels.$inferSelect;

// ============================================================
// Prompts (video generation prompt per panel)
// ============================================================
export const prompts = mysqlTable("prompts", {
  id: int("id").autoincrement().primaryKey(),
  panelId: int("panelId").notNull(),
  projectId: int("projectId").notNull(),
  version: int("version").default(1).notNull(),
  // Core prompt fields
  promptText: text("promptText").notNull(),
  negativePrompt: text("negativePrompt"),
  model: varchar("model", { length: 64 }),  // seedance-1.5-pro, kling-2.6, veo3.1-fast
  controlStrategy: mysqlEnum("controlStrategy", ["first_frame", "last_frame", "first_last_frame", "reference_frame"]).default("first_frame").notNull(),
  // Reference configuration
  firstFrameUrl: text("firstFrameUrl"),
  lastFrameUrl: text("lastFrameUrl"),
  referenceImageUrls: json("referenceImageUrls"), // string[]
  // Structured prompt components
  shotType: varchar("shotType", { length: 32 }),
  cameraAngle: varchar("cameraAngle", { length: 64 }),
  subject: text("subject"),
  action: text("action"),
  cameraMovement: varchar("cameraMovement", { length: 64 }),
  lighting: varchar("lighting", { length: 128 }),
  texture: varchar("texture", { length: 128 }),
  effects: varchar("effects", { length: 256 }),
  transition: varchar("transition", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_prompts_project_version").on(t.projectId, t.version),
  index("idx_prompts_panel").on(t.panelId),
]);

export type Prompt = typeof prompts.$inferSelect;

// ============================================================
// References (searched/uploaded reference images)
// ============================================================
export const references = mysqlTable("references_table", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId"),
  source: mysqlEnum("source", ["google_search", "video_frame", "user_upload", "template_library"]).notNull(),
  query: varchar("query", { length: 512 }),
  imageUrl: text("imageUrl"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================================
// Rule Chapters (from 分镜设计终极规则手册)
// ============================================================
export const ruleChapters = mysqlTable("rule_chapters", {
  id: int("id").autoincrement().primaryKey(),
  chapterNumber: int("chapterNumber").notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  category: mysqlEnum("category", ["universal", "scene_specific", "technical", "ai_prompt"]).notNull(),
  applicableL2Ids: json("applicableL2Ids"), // string[] or null for all
  rules: json("rules").notNull(),           // [{type: "do"|"dont", text, severity}]
  ruleCount: int("ruleCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================================
// Experience Records (adjustment history for feedback loop)
// ============================================================
export const experienceRecords = mysqlTable("experience_records", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  categoryId: varchar("categoryId", { length: 96 }), // L1.L2.L3
  actionType: mysqlEnum("actionType", ["panel_fix", "grid_regenerate", "script_edit", "prompt_edit"]).notNull(),
  panelIndex: int("panelIndex"),
  originalContent: json("originalContent"),
  issueDescription: text("issueDescription"),
  fixDescription: text("fixDescription"),
  ruleCategory: varchar("ruleCategory", { length: 64 }), // e.g. "direction_consistency"
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ============================================================
// User Rules (extracted from experience, human-approved)
// ============================================================
export const userRules = mysqlTable("user_rules", {
  id: int("id").autoincrement().primaryKey(),
  ruleType: mysqlEnum("ruleType", ["do", "dont"]).notNull(),
  ruleText: text("ruleText").notNull(),
  applicableL2Ids: json("applicableL2Ids"), // string[]
  severity: mysqlEnum("severity", ["critical", "warning", "info"]).default("warning").notNull(),
  evidenceCount: int("evidenceCount").default(0).notNull(),
  evidenceIds: json("evidenceIds"),  // int[] - experience record IDs
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  approvedBy: varchar("approvedBy", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  approvedAt: timestamp("approvedAt"),
});

// ============================================================
// System Prompts (persisted workflow prompts)
// ============================================================
export const systemPrompts = mysqlTable("system_prompts", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(), // e.g. "script_system", "grid_system"
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 32 }).notNull(), // script, anchor, grid, prompt, validation, panel
  content: text("content").notNull(), // English prompt content
  contentZh: text("contentZh"), // Chinese translation
  isDefault: boolean("isDefault").default(true).notNull(), // whether this is a system default
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SystemPrompt = typeof systemPrompts.$inferSelect;

// ============================================================
// Export Records
// ============================================================
export const exportRecords = mysqlTable("export_records", {
  id: int("id").autoincrement().primaryKey(),
  exportType: mysqlEnum("exportType", ["full", "incremental", "by_category", "rules"]).notNull(),
  filterCriteria: json("filterCriteria"),
  filePath: text("filePath"),
  recordCount: int("recordCount").default(0).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

// ============================================================
// App Logs (product-level operation logs)
// ============================================================
export const appLogs = mysqlTable("app_logs", {
  id: int("id").autoincrement().primaryKey(),
  level: mysqlEnum("level", ["info", "warn", "error", "debug"]).default("info").notNull(),
  source: varchar("source", { length: 64 }).notNull(), // e.g. "script_gen", "anchor_gen", "grid_gen", "panel_fix", "video_gen", "export", "system"
  message: text("message").notNull(),
  details: json("details"), // { error?, stack?, request?, response?, duration?, metadata? }
  projectId: int("projectId"),
  panelIndex: int("panelIndex"),
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AppLog = typeof appLogs.$inferSelect;

// ============================================================
// Video Clips (generated video per panel)
// ============================================================
export const videoClips = mysqlTable("video_clips", {
  id: int("id").autoincrement().primaryKey(),
  panelId: int("panelId").notNull(),
  projectId: int("projectId").notNull(),
  version: int("version").default(1).notNull(),
  panelIndex: int("panelIndex").notNull(),
  // Generation
  model: varchar("model", { length: 64 }).default("seedance-1.5-pro").notNull(),
  taskId: varchar("taskId", { length: 256 }), // yunwu task ID
  prompt: text("prompt"),
  keyframeUrl: text("keyframeUrl"), // panel image used as keyframe
  // Result
  clipUrl: text("clipUrl"), // S3 URL of generated clip
  rawDuration: varchar("rawDuration", { length: 16 }), // raw clip duration from API
  targetDuration: varchar("targetDuration", { length: 16 }), // target duration from script
  trimmedClipUrl: text("trimmedClipUrl"), // trimmed clip URL
  // Status
  status: mysqlEnum("status", ["pending", "generating", "upsampling", "completed", "trimmed", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_videoclips_project").on(t.projectId),
  index("idx_videoclips_status").on(t.status),
]);

export type VideoClip = typeof videoClips.$inferSelect;

// ============================================================
// Final Videos (merged video per project)
// ============================================================
export const finalVideos = mysqlTable("final_videos", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  version: int("version").default(1).notNull(),
  videoUrl: text("videoUrl"), // S3 URL of merged video
  totalDuration: varchar("totalDuration", { length: 16 }),
  clipCount: int("clipCount").default(0).notNull(),
  status: mysqlEnum("status", ["pending", "merging", "completed", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  confirmedAt: timestamp("confirmedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FinalVideo = typeof finalVideos.$inferSelect;

// ============================================================
// Anchor Library (global reusable anchors, independent of projects)
// ============================================================
export const anchorLibrary = mysqlTable("anchor_library", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  anchorType: mysqlEnum("anchorType", ["character", "scene", "prop"]).notNull(),
  description: text("description"),
  prompt: text("prompt"),           // generation prompt (English)
  imageUrl: text("imageUrl"),       // S3 URL of the reference image
  style: varchar("style", { length: 128 }),  // e.g. "anime", "photorealistic", "watercolor"
  tags: json("tags"),               // string[] for flexible categorization
  metadata: json("metadata"),       // { age?, ethnicity?, hairColor?, ... } flexible attributes
  sourceProjectId: int("sourceProjectId"), // if imported from a project
  sourceAnchorId: int("sourceAnchorId"),   // original anchor ID if imported
  usageCount: int("usageCount").default(0).notNull(), // how many projects use this
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [
  index("idx_anchorlib_type").on(t.anchorType),
  index("idx_anchorlib_style").on(t.style),
]);

export type AnchorLibraryItem = typeof anchorLibrary.$inferSelect;
export type InsertAnchorLibraryItem = typeof anchorLibrary.$inferInsert;
