/**
 * Grid Template Generator
 * Generates a uniform grid template image using Sharp.
 * This template is passed as a reference image to the AI model
 * to ensure the generated storyboard has uniform panel sizes.
 */
import sharp from "sharp";

interface GridTemplateOptions {
  rows: number;
  cols: number;
  totalPanels: number;
  width?: number;   // total image width in px
  height?: number;  // total image height in px
  borderWidth?: number;
  borderColor?: string;
  bgColor?: string;
  labelColor?: string;
}

/**
 * Generate a uniform grid template image as a Buffer (PNG).
 * Each cell is labeled with its panel number.
 */
export async function generateGridTemplate(opts: GridTemplateOptions): Promise<Buffer> {
  const {
    rows,
    cols,
    totalPanels,
    width = 1200,
    height = 800,
    borderWidth = 6,
    borderColor = "#FFFFFF",
    bgColor = "#D1D5DB",
    labelColor = "#374151",
  } = opts;

  const cellW = Math.floor((width - borderWidth * (cols + 1)) / cols);
  const cellH = Math.floor((height - borderWidth * (rows + 1)) / rows);

  // Build SVG for the grid template
  const svgParts: string[] = [];
  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`);
  // Background (border color fills gaps between cells)
  svgParts.push(`<rect width="${width}" height="${height}" fill="${borderColor}"/>`);

  let panelIdx = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (panelIdx > totalPanels) break;
      const x = borderWidth + c * (cellW + borderWidth);
      const y = borderWidth + r * (cellH + borderWidth);

      // Cell background
      svgParts.push(`<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="${bgColor}" rx="2"/>`);

      // Panel number label (centered, large and clear)
      const fontSize = Math.min(cellW, cellH) * 0.35;
      svgParts.push(
        `<text x="${x + cellW / 2}" y="${y + cellH / 2 + fontSize * 0.35}" ` +
        `font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="bold" ` +
        `fill="${labelColor}" text-anchor="middle">${panelIdx}</text>`
      );

      panelIdx++;
    }
  }

  svgParts.push(`</svg>`);
  const svgString = svgParts.join("\n");

  const buffer = await sharp(Buffer.from(svgString)).png().toBuffer();
  return buffer;
}

/**
 * Generate grid template and return as a data URL.
 * The template is small (a few KB), so data URL is fine for passing to the model.
 */
export async function generateGridTemplateDataUrl(opts: GridTemplateOptions): Promise<string> {
  const buffer = await generateGridTemplate(opts);
  const b64 = buffer.toString("base64");
  return `data:image/png;base64,${b64}`;
}
