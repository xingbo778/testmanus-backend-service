/**
 * Grid utility functions for multi-page grid support.
 * 
 * NEW 3-stage pipeline:
 *   Stage 1: Gemini generates a reference Grid (used as style reference)
 *   Stage 2: Generate each panel individually (referencing Grid + Anchors)
 *   Stage 3: Sharp composes panels into a final grid image
 * 
 * The reference grid is kept internally for style guidance.
 * The final output is a clean composed grid from individual panels.
 * 
 * Layout is dynamic based on panel count:
 *   1-2 panels → 2×1 (2 cols × 1 row)
 *   3-4 panels → 2×2 (2 cols × 2 rows)
 *   5-6 panels → 2×3 (2 cols × 3 rows)
 *   7-8 panels → 2×4 (2 cols × 4 rows)
 */

import { generateImage } from "./_core/imageGeneration";
import { generateGridTemplateDataUrl } from "./gridTemplate";
import { generateAllPanels, generateSinglePanel, type PanelGenAnchor, type PanelGenCharacter, type PanelGenScene, type PanelGenFrame } from "./panelGenerator";
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
  gridImageUrl: string | null;       // Final composed grid
  referenceGridUrl?: string | null;  // Original reference grid from Gemini
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
 * Calculate the optimal grid layout for a given panel count.
 * Always uses 2 columns, rows scale to fit all panels.
 * 
 * Panel count → Layout:
 *   1-2  → 2×1 (2 cols × 1 row)
 *   3-4  → 2×2 (2 cols × 2 rows)
 *   5-6  → 2×3 (2 cols × 3 rows)
 *   7-8  → 2×4 (2 cols × 4 rows)
 *   9-10 → 2×5 (2 cols × 5 rows)
 *   etc.
 */
export function calculateGridLayout(panelCount: number): { rows: number; cols: number; emptyCount: number } {
  const cols = 2;
  const rows = Math.max(1, Math.ceil(panelCount / cols));
  const totalCells = rows * cols;
  const emptyCount = totalCells - panelCount;
  return { rows, cols, emptyCount };
}

/**
 * Split frames into grid pages. Each page has at most MAX_PANELS_PER_GRID panels.
 * Returns an array of GridPage objects.
 */
export const MAX_PANELS_PER_GRID = 8;

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
// Stage 1: Generate Reference Grid (Gemini)
// ============================================================

/**
 * Generate a reference grid using Gemini.
 * The reference grid layout matches the actual panel count (dynamic rows).
 * This grid is used as a style/composition reference for individual panel generation.
 */
async function generateReferenceGrid(opts: {
  page: GridPage;
  anchorsList: AnchorInfo[];
  characters: CharacterInfo[];
  scenes: SceneInfo[];
  prevGridImageUrl?: string;
  customPrompt?: string;
  visualRules?: string;
}): Promise<{ referenceGridUrl: string | null; gridPrompt: string; error?: string }> {
  const { page, anchorsList, characters, scenes, prevGridImageUrl, customPrompt, visualRules } = opts;
  const { totalPanels, frames, pageIndex, pageLabel, rows: pageRows, cols: pageCols } = page;

  // Reference grid uses the same layout as the final composed grid
  const refRows = pageRows;
  const refCols = pageCols;
  const refTotalCells = refRows * refCols;

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

    // Grid template (dynamic rows × 2 cols)
    const gridTemplateDataUrl = await generateGridTemplateDataUrl({ rows: refRows, cols: refCols, totalPanels: refTotalCells });
    orderedImages.push({ url: gridTemplateDataUrl });
    imageDescriptions.push(`Image #${imgIdx}: GRID LAYOUT TEMPLATE. This shows the exact ${refRows}x${refCols} uniform grid layout you MUST follow.`);

    console.log(`[GridGen] Stage 1 - Page ${pageIndex}: Prepared ${orderedImages.length} reference images for ${refRows}×${refCols} grid (${totalPanels} panels)`);

    // Character/scene descriptions
    const charAppearanceLines = charAnchors.map(ca => {
      const charData = characters.find(c => c.name === ca.name);
      return `- "${ca.name}": ${ca.prompt || charData?.description || ca.description || 'See reference image'}`;
    }).join('\n');

    const sceneAppearanceLines = sceneAnchors.map(sa => {
      const sceneData = scenes.find(s => s.name === sa.name);
      return `- "${sa.name}": ${sa.prompt || sceneData?.description || sa.description || 'See reference image'}`;
    }).join('\n');

    // Panel descriptions — map frames to grid positions
    const panelLines = frames.map((f, i) => {
      const localIndex = i + 1;
      return `Panel ${localIndex} (Frame #${f.index}) [${f.shotType}] (${f.duration}s, camera: ${f.cameraMovement}): ${f.description}`;
    }).join('\n');

    // If fewer panels than total cells, tell Gemini to fill remaining cells
    const emptyCount = refTotalCells - totalPanels;
    const extraCellNote = emptyCount > 0
      ? `\nNote: You have ${totalPanels} specific panels described below. For the remaining ${emptyCount} cell(s), create additional shots that complement the story (establishing shots, detail shots, or alternate angles). These extra cells help maintain visual coherence.`
      : '';

    const continuityNote = prevGridImageUrl
      ? `\nSTYLE CONTINUITY: This is ${pageLabel}. Match the previous grid page (Image #1) exactly.`
      : '';

    gridPrompt = customPrompt || `I am providing ${orderedImages.length} reference images:

${imageDescriptions.join('\n')}
${extraCellNote}

Your task: Create a ${refRows}x${refCols} cinematic storyboard grid with ${refTotalCells} panels.
${pageLabel ? `This is ${pageLabel} of the storyboard.` : ''}

CRITICAL LAYOUT RULE:
- Follow the GRID LAYOUT TEMPLATE EXACTLY - all ${refTotalCells} panels must be the SAME SIZE
- ${refRows} rows x ${refCols} columns, uniform white borders between panels
- Fill ALL ${refTotalCells} cells with cinematic content
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
- Shot as a real photograph, NOT a digital render or CGI
- Use rich, saturated colors with warm tones — avoid grey, washed-out, or desaturated palettes
- Real film texture: visible skin pores, natural hair strands, fabric wrinkles, environmental dust particles
- Each panel should look like a film still from a high-budget movie, shot on 35mm film with Kodak Vision3 500T stock
- Consistent character appearance across ALL panels
${visualRules ? `
CINEMATOGRAPHY RULES (from professional handbook):
${visualRules}` : ''}`;

    console.log(`[GridGen] Stage 1 - Page ${pageIndex}: Generating ${refRows}×${refCols} reference grid...`);
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
 *   1. Generate reference grid (Gemini) with dynamic layout
 *   2. Generate individual panels (Gemini, referencing the grid)
 *   3. Compose panels into final grid (Sharp) with matching layout
 */
export async function generateSingleGridPage(opts: {
  page: GridPage;
  anchorsList: AnchorInfo[];
  characters: CharacterInfo[];
  scenes: SceneInfo[];
  prevGridImageUrl?: string;
  customPrompt?: string;
  projectId?: number;
  visualRules?: string;
}): Promise<{ gridImageUrl: string | null; referenceGridUrl?: string | null; gridPrompt: string; panelImageUrls?: (string | null)[]; error?: string }> {
  const { page, anchorsList, characters, scenes, prevGridImageUrl, customPrompt, projectId, visualRules } = opts;

  // ---- Stage 1: Generate reference grid ----
  console.log(`[GridGen] === Stage 1/3: Generating ${page.rows}×${page.cols} reference grid for page ${page.pageIndex} (${page.totalPanels} panels) ===`);
  const refResult = await generateReferenceGrid({
    page,
    anchorsList,
    characters,
    scenes,
    prevGridImageUrl,
    customPrompt,
    visualRules,
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
    visualRules,
  });

  let panelImageUrls = panelResults.map(r => r.imageUrl);
  let successCount = panelImageUrls.filter(u => u !== null).length;
  console.log(`[GridGen] Stage 2 complete: ${successCount}/${page.frames.length} panels generated`);

  // Second-chance retry for failed panels (one more attempt each)
  const failedIndices = panelImageUrls.map((url, i) => url === null ? i : -1).filter(i => i >= 0);
  if (failedIndices.length > 0 && successCount > 0) {
    console.log(`[GridGen] Stage 2.5: Retrying ${failedIndices.length} failed panels: [${failedIndices.map(i => i + 1).join(', ')}]`);
    await new Promise(r => setTimeout(r, 3000)); // Brief cooldown before retry
    
    for (const idx of failedIndices) {
      try {
        const retryResult = await generateSinglePanel({
          frame: page.frames[idx] as PanelGenFrame,
          localIndex: idx + 1,
          totalPanelsInPage: page.frames.length,
          gridImageUrl: refResult.referenceGridUrl,
          anchors: anchorsList as PanelGenAnchor[],
          characters: characters as PanelGenCharacter[],
          scenes: scenes as PanelGenScene[],
          visualRules,
        });
        if (retryResult.imageUrl) {
          panelImageUrls[idx] = retryResult.imageUrl;
          console.log(`[GridGen] Stage 2.5: Panel ${idx + 1} recovered on second-chance retry`);
        }
      } catch (e: any) {
        console.warn(`[GridGen] Stage 2.5: Panel ${idx + 1} second-chance retry also failed: ${e?.message}`);
      }
    }
    successCount = panelImageUrls.filter(u => u !== null).length;
    console.log(`[GridGen] Stage 2.5 complete: ${successCount}/${page.frames.length} panels now available`);
  }

  if (successCount === 0) {
    return {
      gridImageUrl: refResult.referenceGridUrl, // Fall back to reference grid
      referenceGridUrl: refResult.referenceGridUrl,
      gridPrompt: refResult.gridPrompt,
      panelImageUrls,
      error: 'All individual panel generations failed, using reference grid as fallback',
    };
  }

  // ---- Stage 3: Compose panels into final grid ----
  console.log(`[GridGen] === Stage 3/3: Composing ${successCount} panels into ${page.rows}×${page.cols} grid ===`);
  try {
    const composeResult = await composePanels({
      panelImageUrls,
      rows: page.rows,
      cols: page.cols,
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
  visualRules?: string;
}): Promise<GridPageResult[]> {
  const { projectId, scriptVersion, frames, anchorsList, characters, scenes, customPrompt, visualRules } = opts;

  // Split frames into pages
  const pages = splitFramesIntoPages(frames);
  console.log(`[GridGen] Project ${projectId}: ${frames.length} frames → ${pages.length} grid page(s) (3-stage pipeline)`);

  // === SAFE DELETE: Generate all pages first, then replace old data ===
  const tempResults: Array<{
    page: GridPage;
    genResult: { gridImageUrl: string | null; referenceGridUrl?: string | null; gridPrompt: string; panelImageUrls?: (string | null)[]; error?: string };
  }> = [];

  let prevGridImageUrl: string | undefined;

  const MAX_PAGE_RETRIES = 2;

  for (const page of pages) {
    console.log(`[GridGen] ======== Page ${page.pageIndex + 1}/${pages.length}: ${page.totalPanels} panels (${page.rows}×${page.cols}), frames ${page.startFrame}-${page.endFrame} ========`);

    let genResult = await generateSingleGridPage({
      page,
      anchorsList: anchorsList as any,
      characters,
      scenes,
      prevGridImageUrl,
      customPrompt: page.pageIndex === 0 ? customPrompt : undefined,
      projectId,
      visualRules,
    });

    // Page-level retry: if gridImageUrl is null (Stage 1 failed), retry up to MAX_PAGE_RETRIES times
    let retryCount = 0;
    while (!genResult.gridImageUrl && retryCount < MAX_PAGE_RETRIES) {
      retryCount++;
      const delay = 3000 * retryCount; // 3s, 6s
      console.warn(`[GridGen] Page ${page.pageIndex + 1} failed (${genResult.error || 'no grid image'}), retrying ${retryCount}/${MAX_PAGE_RETRIES} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));

      genResult = await generateSingleGridPage({
        page,
        anchorsList: anchorsList as any,
        characters,
        scenes,
        prevGridImageUrl,
        customPrompt: page.pageIndex === 0 ? customPrompt : undefined,
        projectId,
        visualRules,
      });
    }

    if (retryCount > 0) {
      console.log(`[GridGen] Page ${page.pageIndex + 1} ${genResult.gridImageUrl ? 'succeeded' : 'STILL FAILED'} after ${retryCount} retries`);
    }

    tempResults.push({ page, genResult });

    // Use the composed grid as reference for next page's style continuity
    if (genResult.gridImageUrl) {
      prevGridImageUrl = genResult.gridImageUrl;
    }
  }

  // Check if at least one page succeeded before deleting old data
  const anySuccess = tempResults.some(r => r.genResult.gridImageUrl);
  if (anySuccess) {
    console.log(`[GridGen] At least one page succeeded, deleting old grids/panels for project ${projectId}`);
    await db.deleteGridsForProject(projectId);
    await db.deletePanelsForProject(projectId);
  } else {
    console.error(`[GridGen] ALL pages failed for project ${projectId}, keeping old data`);
  }

  // Save new results to DB
  const results: GridPageResult[] = [];

  for (const { page, genResult } of tempResults) {
    // Only save if we deleted old data (anySuccess) or if this page succeeded
    if (!anySuccess && !genResult.gridImageUrl) continue;

    const gridId = await db.saveGrid({
      projectId,
      version: scriptVersion,
      rows: page.rows,
      cols: page.cols,
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
