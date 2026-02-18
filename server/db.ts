import { eq, and, desc, sql, like, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  categoriesL1, categoriesL2, categoriesL3,
  projects, scripts, anchors, grids, panels, prompts,
  references, ruleChapters, experienceRecords, userRules, exportRecords,
  type Project, type Script, type Anchor, type Grid, type Panel, type Prompt,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================================
// User helpers (keep existing)
// ============================================================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================
// Category helpers
// ============================================================
export async function getCategoryTree() {
  const db = await getDb();
  if (!db) return [];
  const l1s = await db.select().from(categoriesL1).orderBy(categoriesL1.sortOrder);
  const l2s = await db.select().from(categoriesL2).orderBy(categoriesL2.sortOrder);
  const l3s = await db.select().from(categoriesL3).orderBy(categoriesL3.sortOrder);
  return l1s.map(l1 => ({
    ...l1,
    children: l2s.filter(l2 => l2.l1Id === l1.id).map(l2 => ({
      ...l2,
      children: l3s.filter(l3 => l3.l2Id === l2.id),
    })),
  }));
}

export async function seedCategories(data: {
  l1: Array<{ id: string; name: string; nameEn?: string; description?: string; sortOrder: number }>;
  l2: Array<{ id: string; l1Id: string; name: string; nameEn?: string; description?: string; sortOrder: number }>;
  l3: Array<{ id: string; l1Id: string; l2Id: string; name: string; nameEn?: string; description?: string; templateRef?: string; sortOrder: number }>;
}) {
  const db = await getDb();
  if (!db) return;
  // Upsert L1
  for (const item of data.l1) {
    await db.insert(categoriesL1).values(item).onDuplicateKeyUpdate({ set: { name: item.name, nameEn: item.nameEn, description: item.description, sortOrder: item.sortOrder } });
  }
  for (const item of data.l2) {
    await db.insert(categoriesL2).values(item).onDuplicateKeyUpdate({ set: { name: item.name, nameEn: item.nameEn, description: item.description, sortOrder: item.sortOrder, l1Id: item.l1Id } });
  }
  for (const item of data.l3) {
    await db.insert(categoriesL3).values(item).onDuplicateKeyUpdate({ set: { name: item.name, nameEn: item.nameEn, description: item.description, sortOrder: item.sortOrder, l1Id: item.l1Id, l2Id: item.l2Id, templateRef: item.templateRef } });
  }
}

// ============================================================
// Project helpers
// ============================================================
export async function createProject(data: { title: string; l1Id: string; l2Id: string; l3Id: string; duration: "15" | "30"; createdBy?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(projects).values(data);
  return result[0].insertId;
}

export async function listProjects(filters?: { l1Id?: string; l2Id?: string; l3Id?: string; status?: string; duration?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.l1Id) conditions.push(eq(projects.l1Id, filters.l1Id));
  if (filters?.l2Id) conditions.push(eq(projects.l2Id, filters.l2Id));
  if (filters?.l3Id) conditions.push(eq(projects.l3Id, filters.l3Id));
  if (filters?.status) conditions.push(eq(projects.status, filters.status as any));
  if (filters?.duration) conditions.push(eq(projects.duration, filters.duration as any));
  const query = conditions.length > 0
    ? db.select().from(projects).where(and(...conditions)).orderBy(desc(projects.updatedAt))
    : db.select().from(projects).orderBy(desc(projects.updatedAt));
  return query;
}

export async function getProjectById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result[0] ?? null;
}

export async function updateProject(id: number, data: Partial<{ title: string; status: string; currentVersion: number }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(projects).set(data as any).where(eq(projects.id, id));
}

export async function deleteProject(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(projects).where(eq(projects.id, id));
}

// ============================================================
// Script helpers
// ============================================================
export async function saveScript(data: {
  projectId: number; version: number; frames: any;
  characters?: any; scenes?: any; props?: any;
  validationResult?: any; validationPassed?: boolean;
  rulesUsed?: any; generationPrompt?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(scripts).values(data);
  return result[0].insertId;
}

export async function getLatestScript(projectId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(scripts)
    .where(eq(scripts.projectId, projectId))
    .orderBy(desc(scripts.version))
    .limit(1);
  return result[0] ?? null;
}

export async function getScriptByVersion(projectId: number, version: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(scripts)
    .where(and(eq(scripts.projectId, projectId), eq(scripts.version, version)))
    .limit(1);
  return result[0] ?? null;
}

// ============================================================
// Anchor helpers
// ============================================================
export async function saveAnchor(data: {
  projectId: number; version: number; anchorType: "character" | "scene" | "prop";
  name: string; description?: string; prompt?: string; imageUrl?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(anchors).values(data);
  return result[0].insertId;
}

export async function getAnchors(projectId: number, version?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(anchors.projectId, projectId)];
  if (version) conditions.push(eq(anchors.version, version));
  return db.select().from(anchors).where(and(...conditions));
}

export async function deleteAnchorsForProject(projectId: number, version?: number) {
  const db = await getDb();
  if (!db) return;
  const conditions = [eq(anchors.projectId, projectId)];
  if (version) conditions.push(eq(anchors.version, version));
  await db.delete(anchors).where(and(...conditions));
}

// ============================================================
// Grid helpers
// ============================================================
export async function saveGrid(data: {
  projectId: number; version: number; rows: number; cols: number;
  totalPanels: number; gridImageUrl?: string; annotatedImageUrl?: string;
  generationPrompt?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(grids).values(data);
  return result[0].insertId;
}

export async function getLatestGrid(projectId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(grids)
    .where(eq(grids.projectId, projectId))
    .orderBy(desc(grids.version))
    .limit(1);
  return result[0] ?? null;
}

// ============================================================
// Panel helpers
// ============================================================
export async function savePanels(data: Array<{
  gridId: number; projectId: number; version: number; panelIndex: number;
  shotType?: string; duration?: string; description?: string; cameraMovement?: string;
  panelImageUrl?: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.length === 0) return;
  await db.insert(panels).values(data);
}

export async function getPanels(projectId: number, version?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(panels.projectId, projectId)];
  if (version) conditions.push(eq(panels.version, version));
  return db.select().from(panels).where(and(...conditions)).orderBy(panels.panelIndex);
}

export async function deletePanelsForProject(projectId: number, version?: number) {
  const db = await getDb();
  if (!db) return;
  const conditions = [eq(panels.projectId, projectId)];
  if (version) conditions.push(eq(panels.version, version));
  await db.delete(panels).where(and(...conditions));
}

export async function updatePanel(panelId: number, data: Partial<{
  status: string; issueDescription: string; fixHistory: any;
  panelImageUrl: string; referenceImageUrls: any; description: string;
}>) {
  const db = await getDb();
  if (!db) return;
  await db.update(panels).set(data as any).where(eq(panels.id, panelId));
}

// ============================================================
// Prompt helpers
// ============================================================
export async function savePrompts(data: Array<{
  panelId: number; projectId: number; version: number;
  promptText: string; negativePrompt?: string; model?: string;
  controlStrategy: "first_frame" | "last_frame" | "first_last_frame" | "reference_frame";
  firstFrameUrl?: string; lastFrameUrl?: string; referenceImageUrls?: any;
  shotType?: string; cameraAngle?: string; subject?: string; action?: string;
  cameraMovement?: string; lighting?: string; texture?: string; effects?: string; transition?: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.length === 0) return;
  await db.insert(prompts).values(data);
}

export async function getPrompts(projectId: number, version?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(prompts.projectId, projectId)];
  if (version) conditions.push(eq(prompts.version, version));
  return db.select().from(prompts).where(and(...conditions));
}

export async function updatePrompt(promptId: number, data: Partial<{
  promptText: string; negativePrompt: string; model: string;
  controlStrategy: string; firstFrameUrl: string; lastFrameUrl: string;
}>) {
  const db = await getDb();
  if (!db) return;
  await db.update(prompts).set(data as any).where(eq(prompts.id, promptId));
}

// ============================================================
// Rule Chapter helpers
// ============================================================
export async function seedRuleChapters(chapters: Array<{
  chapterNumber: number; title: string;
  category: "universal" | "scene_specific" | "technical" | "ai_prompt";
  applicableL2Ids?: any; rules: any; ruleCount: number;
}>) {
  const db = await getDb();
  if (!db) return;
  for (const ch of chapters) {
    await db.insert(ruleChapters).values(ch).onDuplicateKeyUpdate({
      set: { title: ch.title, category: ch.category, applicableL2Ids: ch.applicableL2Ids, rules: ch.rules, ruleCount: ch.ruleCount }
    });
  }
}

export async function getRuleChapters() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ruleChapters).orderBy(ruleChapters.chapterNumber);
}

export async function getRulesForScene(l2Id: string) {
  const db = await getDb();
  if (!db) return [];
  // Get universal rules + scene-specific rules
  const allChapters = await db.select().from(ruleChapters);
  return allChapters.filter(ch => {
    if (!ch.applicableL2Ids) return true; // universal
    const ids = ch.applicableL2Ids as string[];
    return ids.includes(l2Id);
  });
}

export async function clearAllRuleChapters() {
  const db = await getDb();
  if (!db) return;
  await db.delete(ruleChapters);
}

export async function importRuleChapter(data: {
  chapterNumber: number; title: string;
  category: "universal" | "scene_specific" | "technical" | "ai_prompt";
  applicableL2Ids: any; rules: any; ruleCount: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Upsert by chapterNumber
  await db.insert(ruleChapters).values(data).onDuplicateKeyUpdate({
    set: { title: data.title, category: data.category, applicableL2Ids: data.applicableL2Ids, rules: data.rules, ruleCount: data.ruleCount }
  });
}

// ============================================================
// Experience Record helpers
// ============================================================
export async function saveExperienceRecord(data: {
  projectId: number; categoryId?: string;
  actionType: "panel_fix" | "grid_regenerate" | "script_edit" | "prompt_edit";
  panelIndex?: number; originalContent?: any;
  issueDescription?: string; fixDescription?: string; ruleCategory?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(experienceRecords).values(data);
  return result[0].insertId;
}

export async function getExperienceRecords(filters?: { categoryId?: string; actionType?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.categoryId) conditions.push(eq(experienceRecords.categoryId, filters.categoryId));
  if (filters?.actionType) conditions.push(eq(experienceRecords.actionType, filters.actionType as any));
  const query = conditions.length > 0
    ? db.select().from(experienceRecords).where(and(...conditions)).orderBy(desc(experienceRecords.createdAt))
    : db.select().from(experienceRecords).orderBy(desc(experienceRecords.createdAt));
  return query;
}

export async function getExperienceSummary() {
  const db = await getDb();
  if (!db) return { total: 0, byCategory: [], byActionType: [] };
  const records = await db.select().from(experienceRecords);
  const byCategory: Record<string, number> = {};
  const byActionType: Record<string, number> = {};
  for (const r of records) {
    const cat = r.ruleCategory ?? "uncategorized";
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    byActionType[r.actionType] = (byActionType[r.actionType] || 0) + 1;
  }
  return {
    total: records.length,
    byCategory: Object.entries(byCategory).map(([k, v]) => ({ category: k, count: v })).sort((a, b) => b.count - a.count),
    byActionType: Object.entries(byActionType).map(([k, v]) => ({ type: k, count: v })).sort((a, b) => b.count - a.count),
  };
}

// ============================================================
// User Rule helpers
// ============================================================
export async function saveUserRule(data: {
  ruleType: "do" | "dont"; ruleText: string;
  applicableL2Ids?: any; severity?: "critical" | "warning" | "info";
  evidenceCount?: number; evidenceIds?: any;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(userRules).values(data);
  return result[0].insertId;
}

export async function getUserRules(filters?: { status?: string; applicableL2Id?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.status) conditions.push(eq(userRules.status, filters.status as any));
  const allRules = conditions.length > 0
    ? await db.select().from(userRules).where(and(...conditions)).orderBy(desc(userRules.createdAt))
    : await db.select().from(userRules).orderBy(desc(userRules.createdAt));
  if (filters?.applicableL2Id) {
    return allRules.filter(r => {
      if (!r.applicableL2Ids) return true;
      return (r.applicableL2Ids as string[]).includes(filters.applicableL2Id!);
    });
  }
  return allRules;
}

export async function updateUserRule(id: number, data: Partial<{ status: string; approvedBy: string; approvedAt: Date }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(userRules).set(data as any).where(eq(userRules.id, id));
}

// ============================================================
// Export Record helpers
// ============================================================
export async function createExportRecord(data: {
  exportType: "full" | "incremental" | "by_category" | "rules";
  filterCriteria?: any;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(exportRecords).values({ ...data, status: "pending" as const });
  return result[0].insertId;
}

export async function updateExportRecord(id: number, data: Partial<{ status: string; filePath: string; recordCount: number; completedAt: Date }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(exportRecords).set(data as any).where(eq(exportRecords.id, id));
}

export async function getExportRecords() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(exportRecords).orderBy(desc(exportRecords.createdAt));
}

// ============================================================
// Reference helpers
// ============================================================
export async function saveReference(data: {
  projectId?: number; source: "google_search" | "video_frame" | "user_upload" | "template_library";
  query?: string; imageUrl?: string; notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(references).values(data);
  return result[0].insertId;
}

export async function getReferences(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(references).where(eq(references.projectId, projectId));
}

// ============================================================
// Version History helpers
// ============================================================
export async function getScriptVersions(projectId: number, limit: number = 5) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: scripts.id,
    version: scripts.version,
    createdAt: scripts.createdAt,
    validationPassed: scripts.validationPassed,
  }).from(scripts)
    .where(eq(scripts.projectId, projectId))
    .orderBy(desc(scripts.version))
    .limit(limit);
}

export async function getGridVersions(projectId: number, limit: number = 5) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: grids.id,
    version: grids.version,
    rows: grids.rows,
    cols: grids.cols,
    totalPanels: grids.totalPanels,
    gridImageUrl: grids.gridImageUrl,
    createdAt: grids.createdAt,
  }).from(grids)
    .where(eq(grids.projectId, projectId))
    .orderBy(desc(grids.version))
    .limit(limit);
}

export async function getPromptVersions(projectId: number, limit: number = 5) {
  const db = await getDb();
  if (!db) return [];
  // Get distinct versions from prompts
  const allPrompts = await db.select({
    version: prompts.version,
    createdAt: prompts.createdAt,
  }).from(prompts)
    .where(eq(prompts.projectId, projectId))
    .orderBy(desc(prompts.version));
  // Deduplicate by version
  const seen = new Set<number>();
  const versions: Array<{ version: number; createdAt: Date; count: number }> = [];
  for (const p of allPrompts) {
    if (!seen.has(p.version)) {
      seen.add(p.version);
      versions.push({ version: p.version, createdAt: p.createdAt, count: allPrompts.filter(x => x.version === p.version).length });
    }
    if (versions.length >= limit) break;
  }
  return versions;
}

export async function rollbackToVersion(projectId: number, targetVersion: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Verify the target version exists
  const targetScript = await getScriptByVersion(projectId, targetVersion);
  if (!targetScript) throw new Error(`Version ${targetVersion} not found for project ${projectId}`);
  // Update project to target version
  await db.update(projects).set({ currentVersion: targetVersion } as any).where(eq(projects.id, projectId));
  return { success: true, version: targetVersion };
}

// ============================================================
// Rule Chapter detail helper
// ============================================================
export async function getRuleChapterById(chapterId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(ruleChapters).where(eq(ruleChapters.id, chapterId)).limit(1);
  return result[0] ?? null;
}

export async function getRuleChapterByNumber(chapterNumber: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(ruleChapters).where(eq(ruleChapters.chapterNumber, chapterNumber)).limit(1);
  return result[0] ?? null;
}

// ============================================================
// Confirmed projects for export
// ============================================================
export async function getConfirmedProjects(filters?: { l1Id?: string; l2Id?: string; l3Id?: string; since?: Date }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(projects.status, "confirmed")];
  if (filters?.l1Id) conditions.push(eq(projects.l1Id, filters.l1Id));
  if (filters?.l2Id) conditions.push(eq(projects.l2Id, filters.l2Id));
  if (filters?.l3Id) conditions.push(eq(projects.l3Id, filters.l3Id));
  if (filters?.since) conditions.push(sql`${projects.updatedAt} >= ${filters.since}`);
  return db.select().from(projects).where(and(...conditions));
}
