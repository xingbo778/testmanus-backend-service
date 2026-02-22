/**
 * Grid utility functions for multi-page grid support.
 * 
 * NEW 3-stage pipeline:
 *   Stage 1: Gemini generates a 3×3 Grid (full content, used as style reference)
 *   Stage 2: Generate each panel individually (referencing Grid + Anchors)
 *   Stage 3: Sharp composes panels into a 2×3 final grid image
 * 
 * The 3×3 "reference grid" is kept internally for style guidance.
 * The final output is a clean 2×3 composed grid from individual panels.
 */

import { generateImage } from "./_core/imageGeneration";
import { generateGridTemplateDataUrl } from "./gridTemplate";
import { generateAllPanels, type PanelGenAnchor, type PanelGenCharacter, type PanelGenScene, type PanelGenFrame } from "./panelGenerator";
import { composePanels } from "./gridComposer";
import * as db from "./db";
import { logInfo, logError } from "./appLogger";

// ============================================================
// Types
// ============================================================
export interface Frame {
  index: number;
  shotType: string;
  duration: number;
  description: string;
  cameraMovement: string;
}

export interface AnchorInfo {
  id: number;
  anchorType: string;
  name: string;
  description: string | null;
  prompt: string | null;
  imageUrl: string | null;
}

export interface CharacterInfo {
  name: string;
  description: string;
  anchorPrompt?: string;
}

export interface SceneInfo {
  name: string;
  description: string;
  anchorPrompt?: string;
}

export interface GridPage {
  pageIndex: number;       // 0-based
  startFrame: number;      // 1-based inclusive
  endFrame: number;        // 1-based inclusive
  frames: Frame[];
  rows: number;
  cols: number;
  totalPanels: number;
  pageLabel: string;       // e.g. "Page 1/3 (frames 1-12)"
}

export interface GridPageResult {
  gridId: number;
  pageIndex: number;
  gridImageUrl: string | null;       // Final composed 2×3 grid
  referenceGridUrl?: string | null;  // Original 3×3 reference grid from Gemini
  rows: number;
  cols: number;
  totalPanels: number;
  startFrame: number;
  endFrame: number;
  pageLabel: string;
  error?: string;
}

// ============================================================
// Grid Layout Calculation
// ============================================================

/**
 * Calculate the layout for the final composed grid.
 * Always uses 2×3 layout (2 columns × 3 rows = 6 panels max).
 */
export function calculateGridLayout(panelCount: number): { rows: number; cols: number; emptyCount: number } {
  // Final output is always 2×3
  const cols = 2;
  const rows = 3;
  const totalCells = rows * cols; // 6
  const emptyCount = totalCells - Math.min(panelCount, totalCells);
  return { rows, cols, emptyCount };
}

/**
 * Split frames into grid pages. Each page has at most MAX_PANELS_PER_GRID panels.
 * Returns an array of GridPage objects.
 */
export const MAX_PANELS_PER_GRID = 6;

export function splitFramesIntoPages(frames: Frame[]): GridPage[] {
  const totalFrames = frames.length;

  // If total fits in one grid, no splitting needed
  if (totalFrames <= MAX_PANELS_PER_GRID) {
    const layout = calculateGridLayout(totalFrames);
    return [{
      pageIndex: 0,
      startFrame: frames[0].index,
      endFrame: frames[frames.length - 1].index,
      frames,
      rows: layout.rows,
      cols: layout.cols,
      totalPanels: totalFrames,
      pageLabel: `Page 1/1 (frames ${frames[0].index}-${frames[frames.length - 1].index})`,
    }];
  }

  // Split into pages of MAX_PANELS_PER_GRID
  const pages: GridPage[] = [];
  const totalPages = Math.ceil(totalFrames / MAX_PANELS_PER_GRID);

  for (let i = 0; i < totalPages; i++) {
    const startIdx = i * MAX_PANELS_PER_GRID;
    const endIdx = Math.min(startIdx + MAX_PANELS_PER_GRID, totalFrames);
    const pageFrames = frames.slice(startIdx, endIdx);
    const panelCount = pageFrames.length;
    const layout = calculateGridLayout(panelCount);

    pages.push({
      pageIndex: i,
      startFrame: pageFrames[0].index,
      endFrame: pageFrames[pageFrames.length - 1].index,
      frames: pageFrames,
      rows: layout.rows,
      cols: layout.cols,
      totalPanels: panelCount,
      pageLabel: `Page ${i + 1}/${totalPages} (frames ${pageFrames[0].index}-${pageFrames[pageFrames.length - 1].index})`,
    });
  }

  return pages;
}

// ============================================================
// Stage 1: Generate 3×3 Reference Grid (Gemini)
// ============================================================

/**
 * Generate a 3×3 reference grid using Gemini.
 * This grid is used as a style/composition reference for individual panel generation.
 * Gemini fills all 9 cells with content (we don't worry about empty cells here).
 */
async function generateReferenceGrid(opts: {
  page: GridPage;
  anchorsList: AnchorInfo[];
  characters: CharacterInfo[];
  scenes: SceneInfo[];
  prevGridImageUrl?: string;
  customPrompt?: string;
}): Promise<{ referenceGridUrl: string | null; gridPrompt: string; error?: string }> {
  const { page, anchorsList, characters, scenes, prevGridImageUrl, customPrompt } = opts;
  const { totalPanels, frames, pageIndex, pageLabel } = page;

  // Reference grid is always 3×3
  const refRows = 3;
  const refCols = 3;

  let gridPrompt = '';
  try {
    const charAnchors = anchorsList.filter(a => a.anchorType === 'character' && a.imageUrl && a.imageUrl.startsWith('http'));
    const sceneAnchors = anchorsList.filter(a => a.anchorType === 'scene' && a.imageUrl && a.imageUrl.startsWith('http'));

    const orderedImages: Array<{ url: string }> = [];
    const imageDescriptions: string[] = [];
    let imgIdx = 1;

    // Previous grid for style continuity
    if (prevGridImageUrl) {
      orderedImages.push({ url: prevGridImageUrl });
      imageDescriptions.push(`Image #${imgIdx}: PREVIOUS GRID PAGE. Match this exact visual style, color grading, lighting quality, and character appearance.`);
      imgIdx++;
    }

    // Character anchors
    for (const ca of charAnchors) {
      orderedImages.push({ url: ca.imageUrl! });
      imageDescriptions.push(`Image #${imgIdx}: CHARACTER "${ca.name}" reference photo. ${ca.prompt || ca.description || ''}`);
      imgIdx++;
    }

    // Scene anchors
    for (const sa of sceneAnchors) {
      orderedImages.push({ url: sa.imageUrl! });
      imageDescriptions.push(`Image #${imgIdx}: SCENE "${sa.name}" reference photo. ${sa.prompt || sa.description || ''}`);
      imgIdx++;
    }

    // Grid template (3×3, all cells filled)
    const gridTemplateDataUrl = await generateGridTemplateDataUrl({ rows: refRows, cols: refCols, totalPanels: refRows * refCols });
    orderedImages.push({ url: gridTemplateDataUrl });
    imageDescriptions.push(`Image #${imgIdx}: GRID LAYOUT TEMPLATE. This shows the exact ${refRows}x${refCols} uniform grid layout you MUST follow.`);

    console.log(`[GridGen] Stage 1 - Page ${pageIndex}: Prepared ${orderedImages.length} reference images for 3×3 grid`);

    // Character/scene descriptions
    const charAppearanceLines = charAnchors.map(ca => {
      const charData = characters.find(c => c.name === ca.name);
      return `- "${ca.name}": ${ca.prompt || charData?.description || ca.description || 'See reference image'}`;
    }).join('\n');

    const sceneAppearanceLines = sceneAnchors.map(sa => {
      const sceneData = scenes.find(s => s.name === sa.name);
      return `- "${sa.name}": ${sa.prompt || sceneData?.description || sa.description || 'See reference image'}`;
    }).join('\n');

    // Panel descriptions — map frames to 3×3 positions
    // For ≤6 frames, we place them in the first 6 cells; cells 7-9 can be anything (will be ignored)
    const panelLines = frames.map((f, i) => {
      const localIndex = i + 1;
      return `Panel ${localIndex} (Frame #${f.index}) [${f.shotType}] (${f.duration}s, camera: ${f.cameraMovement}): ${f.description}`;
    }).join('\n');

    // If fewer than 9 frames, tell Gemini to fill remaining cells with related content
    const extraCellNote = totalPanels < 9
      ? `\nNote: You have ${totalPanels} specific panels described below. For the remaining ${9 - totalPanels} cells, create additional shots that complement the story (establishing shots, detail shots, or alternate angles). These extra cells help maintain visual coherence.`
      : '';

    const continuityNote = prevGridImageUrl
      ? `\nSTYLE CONTINUITY: This is ${pageLabel}. Match the previous grid page (Image #1) exactly.`
      : '';

    gridPrompt = customPrompt || `I am providing ${orderedImages.length} reference images:

${imageDescriptions.join('\n')}
${extraCellNote}

Your task: Create a ${refRows}x${refCols} cinematic storyboard grid with ${refRows * refCols} panels.
${pageLabel ? `This is ${pageLabel} of the storyboard.` : ''}

CRITICAL LAYOUT RULE:
- Follow the GRID LAYOUT TEMPLATE EXACTLY - all ${refRows * refCols} panels must be the SAME SIZE
- ${refRows} rows x ${refCols} columns, uniform white borders between panels
- Fill ALL ${refRows * refCols} cells with cinematic content
- DO NOT draw any numbers, labels, or text on the panels
- NO text, NO titles, NO captions, NO panel numbers anywhere

30% VISUAL DIVERSITY RULE (CRITICAL):
Every adjacent pair of panels MUST differ by at least 30% in visual composition:
- Adjacent panels MUST use different shot types (e.g., WS→MCU→CU, NOT MCU→MCU)
- Adjacent panels MUST show different camera angles or subject positions
- NEVER create two adjacent panels that look almost identical

CHARACTER CONSISTENCY (CRITICAL):
The characters in EVERY panel MUST look EXACTLY like the reference images:
${charAppearanceLines || characters.map(c => `- "${c.name}": ${c.description}`).join('\n')}
Same face, same ethnicity, same hair, same clothing across ALL panels.

SCENE REFERENCE:
${sceneAppearanceLines || scenes.map(s => `- "${s.name}": ${s.description}`).join('\n')}

PANEL-BY-PANEL BREAKDOWN:
${panelLines}
${continuityNote}

STYLE:
- Photorealistic cinematic quality (ARRI Alexa / RED camera look)
- Consistent character appearance across ALL panels
- Cinematic lighting matching each panel's mood
- Natural skin textures, realistic environments, atmospheric depth`;

    console.log(`[GridGen] Stage 1 - Page ${pageIndex}: Generating 3×3 reference grid...`);
    const { url: referenceGridUrl } = await generateImage({
      prompt: gridPrompt,
      originalImages: orderedImages,
    });

    return { referenceGridUrl: referenceGridUrl || null, gridPrompt };
  } catch (e: any) {
    console.error(`[GridGen] Stage 1 - Page ${pageIndex}: Reference grid generation failed:`, e?.message || e);
    return { referenceGridUrl: null, gridPrompt, error: e instanceof Error ? e.message : String(e) };
  }
}

// ============================================================
// Stage 2 + 3: Generate Individual Panels & Compose
// ============================================================

/**
 * Generate a single grid page using the 3-stage pipeline:
 *   1. Generate 3×3 reference grid (Gemini)
 *   2. Generate individual panels (Gemini, referencing the grid)
 *   3. Compose panels into 2×3 final grid (Sharp)
 */
export async function generateSingleGridPage(opts: {
  page: GridPage;
  anchorsList: AnchorInfo[];
  characters: CharacterInfo[];
  scenes: SceneInfo[];
  prevGridImageUrl?: string;
  customPrompt?: string;
  projectId?: number;
}): Promise<{ gridImageUrl: string | null; referenceGridUrl?: string | null; gridPrompt: string; panelImageUrls?: (string | null)[]; error?: string }> {
  const { page, anchorsList, characters, scenes, prevGridImageUrl, customPrompt, projectId } = opts;

  // ---- Stage 1: Generate 3×3 reference grid ----
  console.log(`[GridGen] === Stage 1/3: Generating 3×3 reference grid for page ${page.pageIndex} ===`);
  const refResult = await generateReferenceGrid({
    page,
    anchorsList,
    characters,
    scenes,
    prevGridImageUrl,
    customPrompt,
  });

  if (!refResult.referenceGridUrl) {
    console.error(`[GridGen] Stage 1 failed for page ${page.pageIndex}: ${refResult.error}`);
    return {
      gridImageUrl: null,
      referenceGridUrl: null,
      gridPrompt: refResult.gridPrompt,
      error: `Reference grid generation failed: ${refResult.error}`,
    };
  }

  console.log(`[GridGen] Stage 1 complete: reference grid URL = ${refResult.referenceGridUrl.substring(0, 80)}...`);

  // ---- Stage 2: Generate individual panels ----
  console.log(`[GridGen] === Stage 2/3: Generating ${page.frames.length} individual panels ===`);
  const panelResults = await generateAllPanels({
    frames: page.frames as PanelGenFrame[],
    gridImageUrl: refResult.referenceGridUrl,
    anchors: anchorsList as PanelGenAnchor[],
    characters: characters as PanelGenCharacter[],
    scenes: scenes as PanelGenScene[],
  });

  const panelImageUrls = panelResults.map(r => r.imageUrl);
  const successCount = panelImageUrls.filter(u => u !== null).length;
  console.log(`[GridGen] Stage 2 complete: ${successCount}/${page.frames.length} panels generated`);

  if (successCount === 0) {
    return {
      gridImageUrl: refResult.referenceGridUrl, // Fall back to reference grid
      referenceGridUrl: refResult.referenceGridUrl,
      gridPrompt: refResult.gridPrompt,
      panelImageUrls,
      error: 'All individual panel generations failed, using reference grid as fallback',
    };
  }

  // ---- Stage 3: Compose panels into 2×3 grid ----
  console.log(`[GridGen] === Stage 3/3: Composing ${successCount} panels into 2×3 grid ===`);
  try {
    const composeResult = await composePanels({
      panelImageUrls,
      projectId,
      pageIndex: page.pageIndex,
    });

    console.log(`[GridGen] Stage 3 complete: composed grid URL = ${composeResult.composedGridUrl.substring(0, 80)}...`);

    return {
      gridImageUrl: composeResult.composedGridUrl,
      referenceGridUrl: refResult.referenceGridUrl,
      gridPrompt: refResult.gridPrompt,
      panelImageUrls,
    };
  } catch (e: any) {
    console.error(`[GridGen] Stage 3 failed:`, e?.message || e);
    // Fall back to reference grid if composition fails
    return {
      gridImageUrl: refResult.referenceGridUrl,
      referenceGridUrl: refResult.referenceGridUrl,
      gridPrompt: refResult.gridPrompt,
      panelImageUrls,
      error: `Composition failed: ${e?.message}, using reference grid as fallback`,
    };
  }
}

// ============================================================
// Multi-Grid Generation Orchestrator
// ============================================================

/**
 * Generate all grid pages for a project.
 * Uses the 3-stage pipeline for each page.
 */
export async function generateAllGridPages(opts: {
  projectId: number;
  scriptVersion: number;
  frames: Frame[];
  anchorsList: AnchorInfo[];
  characters: CharacterInfo[];
  scenes: SceneInfo[];
  customPrompt?: string;
}): Promise<GridPageResult[]> {
  const { projectId, scriptVersion, frames, anchorsList, characters, scenes, customPrompt } = opts;

  // Delete old grids and panels
  await db.deleteGridsForProject(projectId);
  await db.deletePanelsForProject(projectId);

  // Split frames into pages
  const pages = splitFramesIntoPages(frames);
  console.log(`[GridGen] Project ${projectId}: ${frames.length} frames → ${pages.length} grid page(s) (3-stage pipeline)`);

  const results: GridPageResult[] = [];
  let prevGridImageUrl: string | undefined;

  for (const page of pages) {
    console.log(`[GridGen] ======== Page ${page.pageIndex + 1}/${pages.length}: ${page.totalPanels} panels, frames ${page.startFrame}-${page.endFrame} ========`);

    const genResult = await generateSingleGridPage({
      page,
      anchorsList: anchorsList as any,
      characters,
      scenes,
      prevGridImageUrl,
      customPrompt: page.pageIndex === 0 ? customPrompt : undefined,
      projectId,
    });

    // Save grid to DB — use 2×3 layout for the final composed grid
    const gridId = await db.saveGrid({
      projectId,
      version: scriptVersion,
      rows: page.rows,   // 3 (2×3 layout)
      cols: page.cols,    // 2
      totalPanels: page.totalPanels,
      gridImageUrl: genResult.gridImageUrl || undefined,
      generationPrompt: genResult.gridPrompt,
      pageIndex: page.pageIndex,
      pageLabel: page.pageLabel,
      startFrame: page.startFrame,
      endFrame: page.endFrame,
    });

    // Create panel records with individual panel images
    const panelData = page.frames.map((f, i) => ({
      gridId,
      projectId,
      version: scriptVersion,
      panelIndex: f.index,
      shotType: f.shotType,
      duration: String(f.duration),
      description: f.description,
      cameraMovement: f.cameraMovement,
      panelImageUrl: genResult.panelImageUrls?.[i] || undefined,
    }));
    await db.savePanels(panelData);

    // Use the composed grid as reference for next page's style continuity
    if (genResult.gridImageUrl) {
      prevGridImageUrl = genResult.gridImageUrl;
    }

    const pageResult: GridPageResult = {
      gridId,
      pageIndex: page.pageIndex,
      gridImageUrl: genResult.gridImageUrl,
      referenceGridUrl: genResult.referenceGridUrl,
      rows: page.rows,
      cols: page.cols,
      totalPanels: page.totalPanels,
      startFrame: page.startFrame,
      endFrame: page.endFrame,
      pageLabel: page.pageLabel,
    };
    if (genResult.error) {
      pageResult.error = genResult.error;
    }
    results.push(pageResult);

    logInfo("grid_gen", `Grid page ${page.pageIndex + 1}/${pages.length}: 3-stage pipeline complete (${page.rows}×${page.cols}, ${page.totalPanels} panels)`, {
      projectId,
      details: {
        gridId,
        pageIndex: page.pageIndex,
        rows: page.rows,
        cols: page.cols,
        totalPanels: page.totalPanels,
        hasComposedGrid: !!genResult.gridImageUrl,
        hasReferenceGrid: !!genResult.referenceGridUrl,
        panelSuccessCount: genResult.panelImageUrls?.filter(u => u).length || 0,
      },
    }).catch(() => {});
  }

  return results;
}
