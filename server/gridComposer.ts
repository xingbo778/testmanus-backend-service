/**
 * Grid Composer - composes individual panel images into a final 2×3 grid using Sharp.
 * 
 * Takes 1-6 panel image URLs, downloads them, resizes to uniform size,
 * and composites them into a 2-column × 3-row grid with white borders.
 * 
 * Layout (2 cols × 3 rows):
 *   [Panel 1] [Panel 2]
 *   [Panel 3] [Panel 4]
 *   [Panel 5] [Panel 6]
 */

import sharp from "sharp";
import { uploadFile } from "./uploadHelper";
import { logInfo, logError } from "./appLogger";

// Grid configuration
const PANEL_WIDTH = 768;     // Each panel width in pixels
const PANEL_HEIGHT = 512;    // Each panel height (16:9-ish cinematic ratio)
const BORDER_WIDTH = 6;      // White border between panels
const COLS = 2;
const ROWS = 3;

// Total canvas size
const CANVAS_WIDTH = COLS * PANEL_WIDTH + (COLS + 1) * BORDER_WIDTH;
const CANVAS_HEIGHT = ROWS * PANEL_HEIGHT + (ROWS + 1) * BORDER_WIDTH;

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
  /** Panel image URLs in order (1-6). null entries become dark placeholders. */
  panelImageUrls: (string | null)[];
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
 * Compose individual panel images into a 2×3 grid.
 * 
 * @param opts.panelImageUrls - Array of up to 6 panel image URLs (null for missing)
 * @returns ComposeResult with the composed grid image URL
 */
export async function composePanels(opts: ComposePanelsOptions): Promise<ComposeResult> {
  const { panelImageUrls, projectId, pageIndex } = opts;
  const totalPanels = Math.min(panelImageUrls.length, COLS * ROWS);

  console.log(`[GridComposer] Composing ${totalPanels} panels into ${COLS}×${ROWS} grid`);

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

  // Fill remaining slots (if fewer than 6 panels) with placeholders
  while (panelBuffers.length < COLS * ROWS) {
    panelBuffers.push(await createPlaceholderPanel());
  }

  // Create the canvas with white background (borders will show as white)
  const composites: sharp.OverlayOptions[] = [];

  for (let i = 0; i < panelBuffers.length; i++) {
    const row = Math.floor(i / COLS);
    const col = i % COLS;
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
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }, // White borders
    },
  })
    .composite(composites)
    .jpeg({ quality: 92 })
    .toBuffer();

  console.log(`[GridComposer] Composed grid: ${CANVAS_WIDTH}×${CANVAS_HEIGHT}px, uploading...`);

  // Upload the composed image (JPEG to keep file size under upload limits)
  const composedUrl = await uploadFile({
    buffer: composedBuffer,
    mimeType: 'image/jpeg',
    fileName: `composed_grid_p${projectId || 0}_page${pageIndex ?? 0}_${Date.now()}.jpg`,
    s3Key: `grids/composed_${projectId || 0}_${pageIndex ?? 0}_${Date.now()}.jpg`,
  });

  logInfo("grid_compose", `Composed ${COLS}×${ROWS} grid: ${successCount} panels, ${failCount} placeholders`, {
    projectId,
    details: { pageIndex, successCount, failCount, totalPanels, canvasSize: `${CANVAS_WIDTH}×${CANVAS_HEIGHT}` },
  }).catch(() => {});

  return {
    composedGridUrl: composedUrl,
    successCount,
    failCount,
  };
}

// Export constants for testing
export { PANEL_WIDTH, PANEL_HEIGHT, BORDER_WIDTH, COLS, ROWS, CANVAS_WIDTH, CANVAS_HEIGHT };
