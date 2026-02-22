/**
 * Grid Composer - composes individual panel images into a final grid using Sharp.
 * 
 * Takes panel image URLs, downloads them, resizes to uniform size,
 * and composites them into a grid with dynamic rows/cols and white borders.
 * 
 * Layout is dynamic based on the number of panels:
 *   2 panels → 2×1 (2 cols × 1 row)
 *   4 panels → 2×2 (2 cols × 2 rows)
 *   6 panels → 2×3 (2 cols × 3 rows)
 *   8 panels → 2×4 (2 cols × 4 rows)
 */

import sharp from "sharp";
import { uploadFile } from "./uploadHelper";
import { logInfo, logError } from "./appLogger";

// Grid configuration
const PANEL_WIDTH = 768;     // Each panel width in pixels
const PANEL_HEIGHT = 512;    // Each panel height (16:9-ish cinematic ratio)
const BORDER_WIDTH = 6;      // White border between panels
const DEFAULT_COLS = 2;
const DEFAULT_ROWS = 3;

/**
 * Download an image from URL and return as Buffer.
 */
async function downloadImage(url: string): Promise<Buffer> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to download image: ${resp.status} ${resp.statusText}`);
  const arrayBuffer = await resp.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Resize a panel image to the standard panel size.
 * Uses cover mode to fill the entire area without distortion.
 */
async function resizePanel(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(PANEL_WIDTH, PANEL_HEIGHT, {
      fit: 'cover',
      position: 'centre',
    })
    .removeAlpha()
    .jpeg({ quality: 95 })
    .toBuffer();
}

/**
 * Create a placeholder panel with visible error indicator for missing/failed panels.
 * Shows a dark background with a red X and "FAILED" text so it's clearly distinguishable.
 */
async function createPlaceholderPanel(): Promise<Buffer> {
  const w = PANEL_WIDTH;
  const h = PANEL_HEIGHT;
  // Create SVG with red X marker and text
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="#1a1a2e"/>
    <line x1="${w * 0.3}" y1="${h * 0.25}" x2="${w * 0.7}" y2="${h * 0.65}" stroke="#e74c3c" stroke-width="8" stroke-linecap="round"/>
    <line x1="${w * 0.7}" y1="${h * 0.25}" x2="${w * 0.3}" y2="${h * 0.65}" stroke="#e74c3c" stroke-width="8" stroke-linecap="round"/>
    <text x="${w / 2}" y="${h * 0.82}" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" fill="#e74c3c" font-weight="bold">GENERATION FAILED</text>
  </svg>`;
  return sharp(Buffer.from(svg))
    .resize(PANEL_WIDTH, PANEL_HEIGHT)
    .jpeg({ quality: 90 })
    .toBuffer();
}

export interface ComposePanelsOptions {
  /** Panel image URLs in order. null entries become dark placeholders. */
  panelImageUrls: (string | null)[];
  /** Number of rows in the grid. If not provided, calculated from panel count. */
  rows?: number;
  /** Number of columns in the grid. Defaults to 2. */
  cols?: number;
  /** Project ID for logging */
  projectId?: number;
  /** Page index for logging */
  pageIndex?: number;
}

export interface ComposeResult {
  /** URL of the composed grid image */
  composedGridUrl: string;
  /** Number of successful panels */
  successCount: number;
  /** Number of failed/missing panels */
  failCount: number;
}

/**
 * Compose individual panel images into a grid with dynamic layout.
 * 
 * @param opts.panelImageUrls - Array of panel image URLs (null for missing)
 * @param opts.rows - Number of rows (auto-calculated if not provided)
 * @param opts.cols - Number of columns (defaults to 2)
 * @returns ComposeResult with the composed grid image URL
 */
export async function composePanels(opts: ComposePanelsOptions): Promise<ComposeResult> {
  const { panelImageUrls, projectId, pageIndex } = opts;
  
  // Determine grid dimensions
  const cols = opts.cols ?? DEFAULT_COLS;
  const rows = opts.rows ?? Math.max(1, Math.ceil(panelImageUrls.length / cols));
  const totalCells = rows * cols;
  const totalPanels = Math.min(panelImageUrls.length, totalCells);

  // Calculate canvas size dynamically
  const canvasWidth = cols * PANEL_WIDTH + (cols + 1) * BORDER_WIDTH;
  const canvasHeight = rows * PANEL_HEIGHT + (rows + 1) * BORDER_WIDTH;

  console.log(`[GridComposer] Composing ${totalPanels} panels into ${cols}×${rows} grid (${canvasWidth}×${canvasHeight}px)`);

  // Download and resize all panels (or create placeholders)
  const panelBuffers: Buffer[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < totalPanels; i++) {
    const url = panelImageUrls[i];
    if (url) {
      try {
        const raw = await downloadImage(url);
        const resized = await resizePanel(raw);
        panelBuffers.push(resized);
        successCount++;
      } catch (e: any) {
        console.warn(`[GridComposer] Failed to download/resize panel ${i + 1}: ${e?.message}`);
        panelBuffers.push(await createPlaceholderPanel());
        failCount++;
      }
    } else {
      panelBuffers.push(await createPlaceholderPanel());
      failCount++;
    }
  }

  // Fill remaining slots (if fewer panels than total cells) with placeholders
  while (panelBuffers.length < totalCells) {
    panelBuffers.push(await createPlaceholderPanel());
  }

  // Create the canvas with white background (borders will show as white)
  const composites: sharp.OverlayOptions[] = [];

  for (let i = 0; i < panelBuffers.length; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const left = BORDER_WIDTH + col * (PANEL_WIDTH + BORDER_WIDTH);
    const top = BORDER_WIDTH + row * (PANEL_HEIGHT + BORDER_WIDTH);

    composites.push({
      input: panelBuffers[i],
      left,
      top,
    });
  }

  const composedBuffer = await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }, // White borders
    },
  })
    .composite(composites)
    .jpeg({ quality: 92 })
    .toBuffer();

  console.log(`[GridComposer] Composed grid: ${canvasWidth}×${canvasHeight}px, uploading...`);

  // Upload the composed image (JPEG to keep file size under upload limits)
  const composedUrl = await uploadFile({
    buffer: composedBuffer,
    mimeType: 'image/jpeg',
    fileName: `composed_grid_p${projectId || 0}_page${pageIndex ?? 0}_${Date.now()}.jpg`,
    s3Key: `grids/composed_${projectId || 0}_${pageIndex ?? 0}_${Date.now()}.jpg`,
  });

  logInfo("grid_compose", `Composed ${cols}×${rows} grid: ${successCount} panels, ${failCount} placeholders`, {
    projectId,
    details: { pageIndex, successCount, failCount, totalPanels, canvasSize: `${canvasWidth}×${canvasHeight}` },
  }).catch(() => {});

  return {
    composedGridUrl: composedUrl,
    successCount,
    failCount,
  };
}

// Export constants for testing
export { PANEL_WIDTH, PANEL_HEIGHT, BORDER_WIDTH, DEFAULT_COLS as COLS, DEFAULT_ROWS as ROWS };
