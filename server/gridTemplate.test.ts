import { describe, it, expect } from "vitest";
import { generateGridTemplate, generateGridTemplateDataUrl } from "./gridTemplate";

describe("gridTemplate", () => {
  it("generates a PNG buffer for a 2x3 grid", async () => {
    const buffer = await generateGridTemplate({ rows: 2, cols: 3, totalPanels: 6 });
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100); // PNG should have some data
    // PNG magic bytes
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50); // 'P'
    expect(buffer[2]).toBe(0x4e); // 'N'
    expect(buffer[3]).toBe(0x47); // 'G'
  });

  it("generates a data URL for a 3x4 grid", async () => {
    const dataUrl = await generateGridTemplateDataUrl({ rows: 3, cols: 4, totalPanels: 10 });
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    // Should be a reasonable size (small SVG-based PNG)
    expect(dataUrl.length).toBeGreaterThan(100);
    expect(dataUrl.length).toBeLessThan(100000); // Should be small
  });

  it("handles partial last row (totalPanels < rows*cols)", async () => {
    const buffer = await generateGridTemplate({ rows: 2, cols: 4, totalPanels: 7 });
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
  });

  it("supports custom dimensions", async () => {
    const buffer = await generateGridTemplate({
      rows: 2,
      cols: 3,
      totalPanels: 6,
      width: 600,
      height: 400,
    });
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
  });
});
