/**
 * Grid utility functions for multi-page grid support.
 * Handles grid pagination, layout calculation, and single-page grid generation.
 */

import { generateImage } from "./_core/imageGeneration";
import { generateGridTemplateDataUrl } from "./gridTemplate";
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
  gridImageUrl: string | null;
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
 * Calculate optimal rows x cols for a given number of panels.
 * Always uses 3×3 grid. Empty cells are filled with black.
 * Max 6 content panels per grid page.
 */
export function calculateGridLayout(panelCount: number): { rows: number; cols: number; emptyCount: number } {
  // Always use 3×3 grid
  const rows = 3;
  const cols = 3;
  const totalCells = rows * cols; // 9
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
// Single Grid Page Generation
// ============================================================

/**
 * Generate a single grid page image.
 * @param page - The grid page definition
 * @param anchorsList - Character/scene anchors with images
 * @param characters - Character info from script
 * @param scenes - Scene info from script
 * @param prevGridImageUrl - Optional: previous grid page's image URL for style continuity
 * @param customPrompt - Optional: user-provided custom prompt
 */
export async function generateSingleGridPage(opts: {
  page: GridPage;
  anchorsList: AnchorInfo[];
  characters: CharacterInfo[];
  scenes: SceneInfo[];
  prevGridImageUrl?: string;
  customPrompt?: string;
}): Promise<{ gridImageUrl: string | null; gridPrompt: string; error?: string }> {
  const { page, anchorsList, characters, scenes, prevGridImageUrl, customPrompt } = opts;
  const { rows, cols, totalPanels, frames, pageIndex, pageLabel } = page;

  let gridPrompt = '';
  try {
    // Separate character and scene anchors that have images
    const charAnchors = anchorsList.filter(a => a.anchorType === 'character' && a.imageUrl && a.imageUrl.startsWith('http'));
    const sceneAnchors = anchorsList.filter(a => a.anchorType === 'scene' && a.imageUrl && a.imageUrl.startsWith('http'));

    // Build ordered image list
    const orderedImages: Array<{ url: string }> = [];
    const imageDescriptions: string[] = [];
    let imgIdx = 1;

    // 0) If there's a previous grid page, add it as style reference
    if (prevGridImageUrl) {
      orderedImages.push({ url: prevGridImageUrl });
      imageDescriptions.push(`Image #${imgIdx}: PREVIOUS GRID PAGE. This is the style reference from the previous page. The new grid MUST match this exact visual style, color grading, lighting quality, and character appearance.`);
      imgIdx++;
    }

    // 1) Character anchor images
    for (const ca of charAnchors) {
      orderedImages.push({ url: ca.imageUrl! });
      imageDescriptions.push(`Image #${imgIdx}: CHARACTER "${ca.name}" reference photo. ${ca.prompt || ca.description || ''}`);
      imgIdx++;
    }

    // 2) Scene anchor images
    for (const sa of sceneAnchors) {
      orderedImages.push({ url: sa.imageUrl! });
      imageDescriptions.push(`Image #${imgIdx}: SCENE "${sa.name}" reference photo. ${sa.prompt || sa.description || ''}`);
      imgIdx++;
    }

    // 3) Grid layout template
    const gridTemplateDataUrl = await generateGridTemplateDataUrl({ rows, cols, totalPanels });
    orderedImages.push({ url: gridTemplateDataUrl });
    imageDescriptions.push(`Image #${imgIdx}: GRID LAYOUT TEMPLATE. This shows the exact ${rows}x${cols} uniform grid layout you MUST follow. Every panel must be the SAME SIZE as shown in this template.`);

    console.log(`[GridGen] Page ${pageIndex}: Prepared ${orderedImages.length} reference images`);

    // Build character/scene appearance descriptions
    const charAppearanceLines = charAnchors.map(ca => {
      const charData = characters.find(c => c.name === ca.name);
      return `- "${ca.name}": ${ca.prompt || charData?.description || ca.description || 'See reference image'}`;
    }).join('\n');

    const sceneAppearanceLines = sceneAnchors.map(sa => {
      const sceneData = scenes.find(s => s.name === sa.name);
      return `- "${sa.name}": ${sa.prompt || sceneData?.description || sa.description || 'See reference image'}`;
    }).join('\n');

    // Panel descriptions - use LOCAL panel numbering (1-based within this page)
    const panelLines = frames.map((f, i) => {
      const localIndex = i + 1;
      return `Panel ${localIndex} (Frame #${f.index}) [${f.shotType}] (${f.duration}s, camera: ${f.cameraMovement}): ${f.description}`;
    }).join('\n');

    const continuityNote = prevGridImageUrl
      ? `\nSTYLE CONTINUITY: This is ${pageLabel}. The visual style, color grading, and character appearance MUST be IDENTICAL to the previous grid page (Image #1). This is a continuation of the same story.`
      : '';

    const emptyCount = rows * cols - totalPanels;
    const emptyWarning = emptyCount > 0 ? `
⚠️ MANDATORY EMPTY CELLS — READ THIS FIRST ⚠️
This is a ${rows}x${cols} grid (9 cells total) but you are ONLY drawing ${totalPanels} content panels.
The LAST ${emptyCount} cells (bottom-right) MUST be COMPLETELY FILLED WITH SOLID BLACK (#000000).
Do NOT put any image, scene, character, text, or content in those ${emptyCount} cells — just pure black.
Look at the GRID LAYOUT TEMPLATE (Image #${imgIdx}): cells marked with a red ✕ and "EMPTY" MUST stay black.
If your output has content in more than ${totalPanels} cells, your output is WRONG.
` : '';

    gridPrompt = customPrompt || `I am providing ${orderedImages.length} reference images. Here is what each image shows:

${imageDescriptions.join('\n')}
${emptyWarning}
Your task: Create a ${rows}x${cols} cinematic storyboard grid. Draw EXACTLY ${totalPanels} content panels, no more.
${pageLabel ? `This is ${pageLabel} of the storyboard.` : ''}

CRITICAL LAYOUT RULE:
- Follow the GRID LAYOUT TEMPLATE (Image #${imgIdx}) EXACTLY - all panels must be the SAME SIZE
- ${rows} rows x ${cols} columns, uniform white borders between panels
- Content goes in cells 1-${totalPanels} ONLY (left-to-right, top-to-bottom)${emptyCount > 0 ? `\n- Cells ${totalPanels + 1}-${rows * cols} MUST be SOLID BLACK — no imagery, no text, nothing` : ''}
- DO NOT draw any numbers, labels, or text on the panels
- NO text, NO titles, NO captions, NO panel numbers anywhere on the image

30% VISUAL DIVERSITY RULE (CRITICAL):
Every adjacent pair of panels MUST differ by at least 30% in visual composition:
- Adjacent panels MUST use different shot types (e.g., WS→MCU→CU, NOT MCU→MCU)
- Adjacent panels MUST show different camera angles or subject positions
- Adjacent panels MUST have visually distinct compositions (different framing, different background elements visible)
- If two adjacent panels show the same character, they MUST differ in pose, angle, and framing
- NEVER create two adjacent panels that look almost identical - this is the #1 quality issue to avoid

CHARACTER CONSISTENCY (CRITICAL):
The characters in EVERY panel MUST look EXACTLY like the people in the character reference images:
${charAppearanceLines || characters.map(c => `- "${c.name}": ${c.description}`).join('\n')}
Same face, same ethnicity, same hair, same clothing, same body proportions across ALL panels.

SCENE REFERENCE:
${sceneAppearanceLines || scenes.map(s => `- "${s.name}": ${s.description}`).join('\n')}

PANEL-BY-PANEL BREAKDOWN:
${panelLines}
${continuityNote}

FINAL REMINDER:${emptyCount > 0 ? `
- You MUST output EXACTLY ${totalPanels} content panels. The last ${emptyCount} cells MUST be SOLID BLACK with ZERO content.` : ''}
- Do NOT add any text, numbers, or labels to any panel.

STYLE:
- Photorealistic cinematic quality (ARRI Alexa / RED camera look)
- Consistent character appearance across ALL panels
- Cinematic lighting matching each panel's mood
- Natural skin textures, realistic environments, atmospheric depth`;

    console.log(`[GridGen] Page ${pageIndex}: Generating grid with ${orderedImages.length} reference images`);
    const { url: gridImageUrl } = await generateImage({
      prompt: gridPrompt,
      originalImages: orderedImages,
    });

    return { gridImageUrl: gridImageUrl || null, gridPrompt };
  } catch (e: any) {
    console.error(`[GridGen] Page ${pageIndex}: Grid generation failed:`, e?.message || e);
    return { gridImageUrl: null, gridPrompt, error: e instanceof Error ? e.message : String(e) };
  }
}

// ============================================================
// Multi-Grid Generation Orchestrator
// ============================================================

/**
 * Generate all grid pages for a project.
 * Handles splitting frames, generating each page, and saving to DB.
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
  console.log(`[GridGen] Project ${projectId}: ${frames.length} frames → ${pages.length} grid page(s)`);

  const results: GridPageResult[] = [];
  let prevGridImageUrl: string | undefined;

  for (const page of pages) {
    console.log(`[GridGen] Generating page ${page.pageIndex + 1}/${pages.length}: ${page.totalPanels} panels (${page.rows}x${page.cols}), frames ${page.startFrame}-${page.endFrame}`);

    const genResult = await generateSingleGridPage({
      page,
      anchorsList: anchorsList as any,
      characters,
      scenes,
      prevGridImageUrl,
      customPrompt: page.pageIndex === 0 ? customPrompt : undefined, // Only apply custom prompt to first page
    });

    // Save grid to DB
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

    // Create panel records for this page
    const panelData = page.frames.map(f => ({
      gridId,
      projectId,
      version: scriptVersion,
      panelIndex: f.index,
      shotType: f.shotType,
      duration: String(f.duration),
      description: f.description,
      cameraMovement: f.cameraMovement,
    }));
    await db.savePanels(panelData);

    // Use this page's image as reference for next page
    if (genResult.gridImageUrl) {
      prevGridImageUrl = genResult.gridImageUrl;
    }

    const pageResult: GridPageResult = {
      gridId,
      pageIndex: page.pageIndex,
      gridImageUrl: genResult.gridImageUrl,
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

    logInfo("grid_gen", `Grid page ${page.pageIndex + 1}/${pages.length} generated: ${page.rows}x${page.cols} (${page.totalPanels} panels)`, {
      projectId,
      details: { gridId, pageIndex: page.pageIndex, rows: page.rows, cols: page.cols, totalPanels: page.totalPanels, hasImage: !!genResult.gridImageUrl },
    }).catch(() => {});
  }

  return results;
}
