/**
 * Extract individual panel images from a grid image using Sharp.
 * Calculates crop coordinates based on grid dimensions (rows x cols) and panel index.
 */
import sharp from "sharp";

interface ExtractPanelOptions {
  gridImageUrl: string;       // URL of the full grid image
  rows: number;               // Number of rows in the grid
  cols: number;               // Number of columns in the grid
  panelIndex: number;         // 1-based panel index (left-to-right, top-to-bottom)
  padding?: number;           // Padding in pixels to trim from edges (default: 2)
}

interface ExtractAllPanelsOptions {
  gridImageUrl: string;
  rows: number;
  cols: number;
  totalPanels: number;
  padding?: number;
}

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
 * Extract a single panel from a grid image.
 * Returns a PNG buffer of the cropped panel.
 */
export async function extractPanel(opts: ExtractPanelOptions): Promise<Buffer> {
  const { gridImageUrl, rows, cols, panelIndex, padding = 2 } = opts;

  // Download the grid image
  const imageBuffer = await downloadImage(gridImageUrl);
  const metadata = await sharp(imageBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read image dimensions");
  }

  const imgWidth = metadata.width;
  const imgHeight = metadata.height;

  // Calculate cell dimensions
  const cellWidth = Math.floor(imgWidth / cols);
  const cellHeight = Math.floor(imgHeight / rows);

  // Calculate row and column for this panel (0-based)
  const panelRow = Math.floor((panelIndex - 1) / cols);
  const panelCol = (panelIndex - 1) % cols;

  // Calculate crop coordinates with padding
  const left = Math.max(0, panelCol * cellWidth + padding);
  const top = Math.max(0, panelRow * cellHeight + padding);
  const width = Math.min(cellWidth - padding * 2, imgWidth - left);
  const height = Math.min(cellHeight - padding * 2, imgHeight - top);

  // Crop and return
  const croppedBuffer = await sharp(imageBuffer)
    .extract({ left, top, width, height })
    .png()
    .toBuffer();

  return croppedBuffer;
}

/**
 * Extract all panels from a grid image.
 * Returns an array of { panelIndex, buffer } objects.
 */
export async function extractAllPanels(opts: ExtractAllPanelsOptions): Promise<Array<{ panelIndex: number; buffer: Buffer }>> {
  const { gridImageUrl, rows, cols, totalPanels, padding = 2 } = opts;

  // Download the grid image once
  const imageBuffer = await downloadImage(gridImageUrl);
  const metadata = await sharp(imageBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read image dimensions");
  }

  const imgWidth = metadata.width;
  const imgHeight = metadata.height;
  const cellWidth = Math.floor(imgWidth / cols);
  const cellHeight = Math.floor(imgHeight / rows);

  const results: Array<{ panelIndex: number; buffer: Buffer }> = [];

  for (let i = 1; i <= totalPanels; i++) {
    const panelRow = Math.floor((i - 1) / cols);
    const panelCol = (i - 1) % cols;

    const left = Math.max(0, panelCol * cellWidth + padding);
    const top = Math.max(0, panelRow * cellHeight + padding);
    const width = Math.min(cellWidth - padding * 2, imgWidth - left);
    const height = Math.min(cellHeight - padding * 2, imgHeight - top);

    const croppedBuffer = await sharp(imageBuffer)
      .extract({ left, top, width, height })
      .png()
      .toBuffer();

    results.push({ panelIndex: i, buffer: croppedBuffer });
  }

  return results;
}
