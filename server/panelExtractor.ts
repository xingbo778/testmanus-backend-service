/**
 * Extract individual panel images from a grid image.
 * 
 * Uses smart cropping with Sharp:
 * 1. Calculate cell boundaries from grid layout (rows × cols)
 * 2. Apply generous padding to avoid border lines
 * 3. Use Sharp's trim() to auto-detect and remove remaining solid-color borders
 * 4. Process all panels in parallel for speed
 */
import sharp from "sharp";
import { logInfo, logWarn } from "./appLogger";

interface ExtractPanelOptions {
  gridImageUrl: string;       // URL of the full grid image
  rows: number;               // Number of rows in the grid
  cols: number;               // Number of columns in the grid
  panelIndex: number;         // 1-based panel index (left-to-right, top-to-bottom)
  padding?: number;           // Padding in pixels to trim from edges (default: 10)
  panelDescription?: string;  // Optional (unused, kept for API compat)
  mode?: "crop" | "ai";       // Ignored - always uses smart crop now
}

interface ExtractAllPanelsOptions {
  gridImageUrl: string;
  rows: number;
  cols: number;
  totalPanels: number;
  padding?: number;
  panelDescriptions?: string[];
  mode?: "crop" | "ai";       // Ignored - always uses smart crop now
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
 * Smart crop: extract a panel from the grid, then trim solid-color borders.
 * 
 * Strategy:
 * 1. Calculate the cell region for this panel
 * 2. Inset by `padding` pixels on all sides to skip border lines
 * 3. Extract that region
 * 4. Use Sharp trim() to auto-remove any remaining uniform-color edges
 *    (handles cases where the border is thicker than expected)
 */
async function smartCropPanel(
  imageBuffer: Buffer,
  imgWidth: number,
  imgHeight: number,
  rows: number,
  cols: number,
  panelIndex: number,
  padding: number
): Promise<Buffer> {
  const cellWidth = Math.floor(imgWidth / cols);
  const cellHeight = Math.floor(imgHeight / rows);

  const panelRow = Math.floor((panelIndex - 1) / cols);
  const panelCol = (panelIndex - 1) % cols;

  // Calculate crop region with padding inset
  const left = Math.max(0, panelCol * cellWidth + padding);
  const top = Math.max(0, panelRow * cellHeight + padding);
  const right = Math.min(imgWidth, (panelCol + 1) * cellWidth - padding);
  const bottom = Math.min(imgHeight, (panelRow + 1) * cellHeight - padding);
  const width = right - left;
  const height = bottom - top;

  if (width <= 0 || height <= 0) {
    throw new Error(`Invalid crop dimensions for panel ${panelIndex}: ${width}x${height}`);
  }

  // Step 1: Extract the padded region
  let cropped = sharp(imageBuffer)
    .extract({ left, top, width, height });

  // Step 2: Try to auto-trim remaining border artifacts
  // trim() removes uniform-color borders; threshold controls sensitivity
  try {
    const trimmed = await cropped
      .trim({ threshold: 30 })  // 30 = tolerance for near-black/near-white borders
      .png()
      .toBuffer();

    // Verify the trimmed image isn't too small (trim can be too aggressive)
    const trimMeta = await sharp(trimmed).metadata();
    if (trimMeta.width && trimMeta.height &&
        trimMeta.width > width * 0.5 && trimMeta.height > height * 0.5) {
      return trimmed;
    }
    // If trim removed too much, fall back to the padded crop
    logWarn("panel_extract", `Trim was too aggressive for panel ${panelIndex}, using padded crop`, {
      details: { panelIndex, trimmedSize: `${trimMeta.width}x${trimMeta.height}`, originalSize: `${width}x${height}` },
    }).catch(() => {});
  } catch (e) {
    // trim() can fail on some images; fall back to padded crop
    logWarn("panel_extract", `Trim failed for panel ${panelIndex}, using padded crop: ${e}`, {
      details: { panelIndex },
    }).catch(() => {});
  }

  // Fallback: return the padded crop without trim
  return sharp(imageBuffer)
    .extract({ left, top, width, height })
    .png()
    .toBuffer();
}

/**
 * Extract a single panel from a grid image.
 * Returns a PNG buffer of the extracted panel.
 */
export async function extractPanel(opts: ExtractPanelOptions): Promise<Buffer> {
  const { gridImageUrl, rows, cols, panelIndex, padding = 10 } = opts;

  const imageBuffer = await downloadImage(gridImageUrl);
  const metadata = await sharp(imageBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read image dimensions");
  }

  return smartCropPanel(
    imageBuffer, metadata.width, metadata.height,
    rows, cols, panelIndex, padding
  );
}

/**
 * Extract all panels from a grid image.
 * Processes all panels in parallel for speed.
 * Returns an array of { panelIndex, buffer } objects.
 */
export async function extractAllPanels(opts: ExtractAllPanelsOptions): Promise<Array<{ panelIndex: number; buffer: Buffer }>> {
  const { gridImageUrl, rows, cols, totalPanels, padding = 10 } = opts;

  // Download the grid image once
  const imageBuffer = await downloadImage(gridImageUrl);
  const metadata = await sharp(imageBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read image dimensions");
  }

  const imgWidth = metadata.width;
  const imgHeight = metadata.height;

  // Process all panels in parallel
  const promises = Array.from({ length: totalPanels }, (_, i) => {
    const panelIndex = i + 1;
    return smartCropPanel(imageBuffer, imgWidth, imgHeight, rows, cols, panelIndex, padding)
      .then(buffer => {
        logInfo("panel_extract", `Smart crop successful for panel ${panelIndex}/${totalPanels}`, {
          details: { panelIndex, mode: "smart_crop" },
        }).catch(() => {});
        return { panelIndex, buffer };
      })
      .catch(err => {
        logWarn("panel_extract", `Failed to extract panel ${panelIndex}: ${err}`, {
          details: { panelIndex, error: String(err) },
        }).catch(() => {});
        throw err;
      });
  });

  return Promise.all(promises);
}
