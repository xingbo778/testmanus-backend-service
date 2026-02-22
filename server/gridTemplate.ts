/**
 * Grid Template Generator
 * Generates a uniform grid template image using Sharp.
 * This template is passed as a reference image to the AI model
 * to ensure the generated storyboard has uniform panel sizes.
 *
 * Empty cells are rendered with a bold red "✕" and "EMPTY" label
 * on a black background to make them unmistakable.
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
 * Each content cell is labeled with its panel number.
 * Empty cells are rendered as black with a large red "✕" and "EMPTY" text.
 */
export async function generateGridTemplate(opts: GridTemplateOptions): Promise<Buffer> {
  const {
    rows,
    cols,
    totalPanels,
    width = 1200,
    height = 1200,
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

  const emptyBgColor = "#000000";   // Black background for empty cells
  const emptyXColor = "#FF0000";    // Red for the X mark
  const emptyLabelColor = "#FF0000"; // Red for "EMPTY" text

  let panelIdx = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = borderWidth + c * (cellW + borderWidth);
      const y = borderWidth + r * (cellH + borderWidth);

      if (panelIdx <= totalPanels) {
        // Content cell: gray background with panel number
        svgParts.push(`<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="${bgColor}" rx="2"/>`);

        const fontSize = Math.min(cellW, cellH) * 0.35;
        svgParts.push(
          `<text x="${x + cellW / 2}" y="${y + cellH / 2 + fontSize * 0.35}" ` +
          `font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="bold" ` +
          `fill="${labelColor}" text-anchor="middle">${panelIdx}</text>`
        );
      } else {
        // Empty cell: black background + large red X + "EMPTY" label
        svgParts.push(`<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="${emptyBgColor}" rx="2"/>`);

        // Draw a large red X across the cell
        const xPad = cellW * 0.15;
        const yPad = cellH * 0.15;
        const strokeW = Math.max(4, Math.min(cellW, cellH) * 0.04);
        svgParts.push(
          `<line x1="${x + xPad}" y1="${y + yPad}" x2="${x + cellW - xPad}" y2="${y + cellH - yPad}" ` +
          `stroke="${emptyXColor}" stroke-width="${strokeW}" stroke-linecap="round"/>`
        );
        svgParts.push(
          `<line x1="${x + cellW - xPad}" y1="${y + yPad}" x2="${x + xPad}" y2="${y + cellH - yPad}" ` +
          `stroke="${emptyXColor}" stroke-width="${strokeW}" stroke-linecap="round"/>`
        );

        // "EMPTY" text centered in the cell
        const emptyFontSize = Math.min(cellW, cellH) * 0.18;
        svgParts.push(
          `<text x="${x + cellW / 2}" y="${y + cellH / 2 + emptyFontSize * 0.35}" ` +
          `font-family="Arial, Helvetica, sans-serif" font-size="${emptyFontSize}" font-weight="bold" ` +
          `fill="${emptyLabelColor}" text-anchor="middle">EMPTY</text>`
        );
      }

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
