/**
 * Extract individual panel images from a grid image.
 * 
 * Two modes:
 * 1. "crop" (legacy) - Simple Sharp crop with padding. Fast but may include borders.
 * 2. "ai" (default) - Crop a rough region then use Gemini (Nano Banana Pro) to
 *    redraw/clean the panel, removing borders, numbers, and annotations.
 */
import sharp from "sharp";
import { generateImage } from "./_core/imageGeneration";
import { logInfo, logWarn } from "./appLogger";

interface ExtractPanelOptions {
  gridImageUrl: string;       // URL of the full grid image
  rows: number;               // Number of rows in the grid
  cols: number;               // Number of columns in the grid
  panelIndex: number;         // 1-based panel index (left-to-right, top-to-bottom)
  padding?: number;           // Padding in pixels to trim from edges (default: 2)
  mode?: "crop" | "ai";       // Extraction mode (default: "ai")
  panelDescription?: string;  // Optional description of the panel content for AI mode
}

interface ExtractAllPanelsOptions {
  gridImageUrl: string;
  rows: number;
  cols: number;
  totalPanels: number;
  padding?: number;
  mode?: "crop" | "ai";
  panelDescriptions?: string[];  // Optional descriptions for each panel (index 0 = panel 1)
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
 * Crop a single panel from a grid image using Sharp.
 * Returns a PNG buffer of the cropped panel.
 */
async function cropPanel(
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

  const left = Math.max(0, panelCol * cellWidth + padding);
  const top = Math.max(0, panelRow * cellHeight + padding);
  const width = Math.min(cellWidth - padding * 2, imgWidth - left);
  const height = Math.min(cellHeight - padding * 2, imgHeight - top);

  return sharp(imageBuffer)
    .extract({ left, top, width, height })
    .png()
    .toBuffer();
}

/**
 * Use AI (Gemini / Nano Banana Pro) to redraw a cropped panel,
 * removing borders, panel numbers, and annotations while preserving
 * the core visual content.
 */
async function aiRedrawPanel(
  croppedBuffer: Buffer,
  panelDescription?: string
): Promise<Buffer> {
  const b64 = croppedBuffer.toString("base64");
  const mimeType = "image/png";

  const descHint = panelDescription
    ? `\nThe panel depicts: ${panelDescription}`
    : "";

  const prompt = `You are given a single panel cropped from a storyboard grid image. The cropped image may contain:
- Black border lines on the edges
- Panel number labels (like "1", "2", etc.)
- Shot type annotations (like "MS", "CU", "WS")
- Duration labels (like "3s", "5s")

Your task: Redraw this panel as a CLEAN, standalone image.
- REMOVE all border lines, numbers, labels, and text annotations
- KEEP the exact same scene, characters, composition, colors, lighting, and art style
- The output should look like a single clean frame/shot, not a panel from a grid
- Maintain the same aspect ratio and resolution
- Do NOT add any new elements or change the scene content${descHint}

Output only the cleaned image, no text.`;

  const result = await generateImage({
    prompt,
    originalImages: [{ b64Json: b64, mimeType }],
  });

  if (!result.url) {
    throw new Error("AI redraw returned no image URL");
  }

  // Download the AI-generated image and return as buffer
  const redrawBuffer = await downloadImage(result.url);
  return redrawBuffer;
}

/**
 * Extract a single panel from a grid image.
 * Returns a PNG buffer of the extracted panel.
 */
export async function extractPanel(opts: ExtractPanelOptions): Promise<Buffer> {
  const { gridImageUrl, rows, cols, panelIndex, padding = 2, mode = "ai", panelDescription } = opts;

  // Download the grid image
  const imageBuffer = await downloadImage(gridImageUrl);
  const metadata = await sharp(imageBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read image dimensions");
  }

  // Step 1: Always crop first
  const croppedBuffer = await cropPanel(
    imageBuffer, metadata.width, metadata.height,
    rows, cols, panelIndex, padding
  );

  // Step 2: If AI mode, redraw the cropped panel
  if (mode === "ai") {
    try {
      const aiBuffer = await aiRedrawPanel(croppedBuffer, panelDescription);
      logInfo("panel_extract", `AI redraw successful for panel ${panelIndex}`, {
        details: { panelIndex, mode: "ai" },
      }).catch(() => {});
      return aiBuffer;
    } catch (e) {
      // Fallback to crop mode if AI fails
      const errMsg = e instanceof Error ? e.message : String(e);
      logWarn("panel_extract", `AI redraw failed for panel ${panelIndex}, falling back to crop: ${errMsg}`, {
        details: { panelIndex, error: errMsg },
      }).catch(() => {});
      return croppedBuffer;
    }
  }

  return croppedBuffer;
}

/**
 * Extract all panels from a grid image.
 * Returns an array of { panelIndex, buffer } objects.
 */
export async function extractAllPanels(opts: ExtractAllPanelsOptions): Promise<Array<{ panelIndex: number; buffer: Buffer }>> {
  const { gridImageUrl, rows, cols, totalPanels, padding = 2, mode = "ai", panelDescriptions } = opts;

  // Download the grid image once
  const imageBuffer = await downloadImage(gridImageUrl);
  const metadata = await sharp(imageBuffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read image dimensions");
  }

  const imgWidth = metadata.width;
  const imgHeight = metadata.height;

  const results: Array<{ panelIndex: number; buffer: Buffer }> = [];

  for (let i = 1; i <= totalPanels; i++) {
    // Step 1: Crop
    const croppedBuffer = await cropPanel(
      imageBuffer, imgWidth, imgHeight,
      rows, cols, i, padding
    );

    // Step 2: AI redraw if enabled
    if (mode === "ai") {
      try {
        const desc = panelDescriptions?.[i - 1];
        const aiBuffer = await aiRedrawPanel(croppedBuffer, desc);
        results.push({ panelIndex: i, buffer: aiBuffer });
        logInfo("panel_extract", `AI redraw successful for panel ${i}/${totalPanels}`, {
          details: { panelIndex: i, mode: "ai" },
        }).catch(() => {});
        continue;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        logWarn("panel_extract", `AI redraw failed for panel ${i}, using crop fallback: ${errMsg}`, {
          details: { panelIndex: i, error: errMsg },
        }).catch(() => {});
      }
    }

    results.push({ panelIndex: i, buffer: croppedBuffer });
  }

  return results;
}
