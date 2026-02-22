/**
 * Tests for multi-grid pagination logic in gridUtils.ts
 * Updated for dynamic grid layout with MAX_PANELS_PER_GRID=8
 * 
 * New pipeline: Gemini generates reference grid → individual panels → Sharp composes final grid
 * calculateGridLayout returns dynamic rows based on panel count (always 2 cols)
 * 
 * Layout mapping:
 *   1-2 panels → 2×1
 *   3-4 panels → 2×2
 *   5-6 panels → 2×3
 *   7-8 panels → 2×4
 */
import { describe, it, expect } from "vitest";
import { splitFramesIntoPages, calculateGridLayout, MAX_PANELS_PER_GRID, type Frame } from "./gridUtils";

function makeFrames(count: number): Frame[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i + 1,
    shotType: "中景",
    duration: 2,
    description: `Frame ${i + 1} description`,
    cameraMovement: "固定",
  }));
}

describe("calculateGridLayout", () => {
  it("should return 2×1 for 1 panel", () => {
    const layout = calculateGridLayout(1);
    expect(layout).toEqual({ rows: 1, cols: 2, emptyCount: 1 });
  });

  it("should return 2×1 for 2 panels", () => {
    const layout = calculateGridLayout(2);
    expect(layout).toEqual({ rows: 1, cols: 2, emptyCount: 0 });
  });

  it("should return 2×2 for 3 panels", () => {
    const layout = calculateGridLayout(3);
    expect(layout).toEqual({ rows: 2, cols: 2, emptyCount: 1 });
  });

  it("should return 2×2 for 4 panels", () => {
    const layout = calculateGridLayout(4);
    expect(layout).toEqual({ rows: 2, cols: 2, emptyCount: 0 });
  });

  it("should return 2×3 for 5 panels", () => {
    const layout = calculateGridLayout(5);
    expect(layout).toEqual({ rows: 3, cols: 2, emptyCount: 1 });
  });

  it("should return 2×3 for 6 panels", () => {
    const layout = calculateGridLayout(6);
    expect(layout).toEqual({ rows: 3, cols: 2, emptyCount: 0 });
  });

  it("should return 2×4 for 7 panels", () => {
    const layout = calculateGridLayout(7);
    expect(layout).toEqual({ rows: 4, cols: 2, emptyCount: 1 });
  });

  it("should return 2×4 for 8 panels", () => {
    const layout = calculateGridLayout(8);
    expect(layout).toEqual({ rows: 4, cols: 2, emptyCount: 0 });
  });

  it("should always use 2 columns", () => {
    for (const count of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const layout = calculateGridLayout(count);
      expect(layout.cols).toBe(2);
    }
  });

  it("should have emptyCount 0 or 1", () => {
    for (const count of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const layout = calculateGridLayout(count);
      expect(layout.emptyCount).toBeLessThanOrEqual(1);
    }
  });
});

describe("MAX_PANELS_PER_GRID", () => {
  it("should be 8", () => {
    expect(MAX_PANELS_PER_GRID).toBe(8);
  });
});

describe("splitFramesIntoPages", () => {
  it("should return 1 page for 3 frames (2×2 layout)", () => {
    const frames = makeFrames(3);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(1);
    expect(pages[0].pageIndex).toBe(0);
    expect(pages[0].totalPanels).toBe(3);
    expect(pages[0].rows).toBe(2);
    expect(pages[0].cols).toBe(2);
    expect(pages[0].startFrame).toBe(1);
    expect(pages[0].endFrame).toBe(3);
  });

  it("should return 1 page for 6 frames (2×3 layout)", () => {
    const frames = makeFrames(6);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(1);
    expect(pages[0].totalPanels).toBe(6);
    expect(pages[0].rows).toBe(3);
    expect(pages[0].cols).toBe(2);
  });

  it("should return 1 page for 7 frames (2×4 layout)", () => {
    const frames = makeFrames(7);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(1);
    expect(pages[0].totalPanels).toBe(7);
    expect(pages[0].rows).toBe(4);
    expect(pages[0].cols).toBe(2);
    expect(pages[0].startFrame).toBe(1);
    expect(pages[0].endFrame).toBe(7);
  });

  it("should return 1 page for 8 frames (2×4 layout)", () => {
    const frames = makeFrames(8);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(1);
    expect(pages[0].totalPanels).toBe(8);
    expect(pages[0].rows).toBe(4);
    expect(pages[0].cols).toBe(2);
  });

  it("should return 2 pages for 9 frames (8+1)", () => {
    const frames = makeFrames(9);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(2);
    // Page 1: 8 frames, 2×4
    expect(pages[0].totalPanels).toBe(8);
    expect(pages[0].rows).toBe(4);
    expect(pages[0].cols).toBe(2);
    expect(pages[0].startFrame).toBe(1);
    expect(pages[0].endFrame).toBe(8);
    // Page 2: 1 frame, 2×1
    expect(pages[1].totalPanels).toBe(1);
    expect(pages[1].rows).toBe(1);
    expect(pages[1].cols).toBe(2);
    expect(pages[1].startFrame).toBe(9);
    expect(pages[1].endFrame).toBe(9);
  });

  it("should return 2 pages for 12 frames (8+4)", () => {
    const frames = makeFrames(12);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(2);
    expect(pages[0].totalPanels).toBe(8);
    expect(pages[0].rows).toBe(4);
    expect(pages[1].totalPanels).toBe(4);
    expect(pages[1].rows).toBe(2);
  });

  it("should return 2 pages for 15 frames (8+7)", () => {
    const frames = makeFrames(15);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(2);
    expect(pages[0].totalPanels).toBe(8);
    expect(pages[0].rows).toBe(4);
    expect(pages[1].totalPanels).toBe(7);
    expect(pages[1].rows).toBe(4);
    expect(pages[1].startFrame).toBe(9);
    expect(pages[1].endFrame).toBe(15);
  });

  it("should return 2 pages for 16 frames (8+8)", () => {
    const frames = makeFrames(16);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(2);
    expect(pages[0].totalPanels).toBe(8);
    expect(pages[1].totalPanels).toBe(8);
  });

  it("should return 3 pages for 20 frames (8+8+4)", () => {
    const frames = makeFrames(20);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(3);
    expect(pages[0].totalPanels).toBe(8);
    expect(pages[1].totalPanels).toBe(8);
    expect(pages[2].totalPanels).toBe(4);
    expect(pages[2].rows).toBe(2);
  });

  it("should return 4 pages for 30 frames (8+8+8+6)", () => {
    const frames = makeFrames(30);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(4);
    expect(pages[0].totalPanels).toBe(8);
    expect(pages[1].totalPanels).toBe(8);
    expect(pages[2].totalPanels).toBe(8);
    expect(pages[3].totalPanels).toBe(6);
    expect(pages[3].rows).toBe(3);
  });

  it("should return 6 pages for 45 frames (8×5+5)", () => {
    const frames = makeFrames(45);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(6);
    for (let i = 0; i < 5; i++) {
      expect(pages[i].totalPanels).toBe(8);
    }
    expect(pages[5].totalPanels).toBe(5);
    expect(pages[5].rows).toBe(3);
  });

  it("should return 8 pages for 60 frames (8×7+4)", () => {
    const frames = makeFrames(60);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(8);
    for (let i = 0; i < 7; i++) {
      expect(pages[i].totalPanels).toBe(8);
    }
    expect(pages[7].totalPanels).toBe(4);
    expect(pages[7].rows).toBe(2);
  });

  it("should have correct page labels", () => {
    const frames = makeFrames(12);
    const pages = splitFramesIntoPages(frames);
    expect(pages[0].pageLabel).toContain("Page 1/2");
    expect(pages[0].pageLabel).toContain("frames 1-8");
    expect(pages[1].pageLabel).toContain("Page 2/2");
    expect(pages[1].pageLabel).toContain("frames 9-12");
  });

  it("should respect MAX_PANELS_PER_GRID constant", () => {
    expect(MAX_PANELS_PER_GRID).toBe(8);
    const frames = makeFrames(13);
    const pages = splitFramesIntoPages(frames);
    for (const page of pages) {
      expect(page.totalPanels).toBeLessThanOrEqual(MAX_PANELS_PER_GRID);
    }
  });

  it("should handle single frame", () => {
    const frames = makeFrames(1);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(1);
    expect(pages[0].totalPanels).toBe(1);
    expect(pages[0].rows).toBe(1);
    expect(pages[0].cols).toBe(2);
  });

  it("should have contiguous frame ranges across pages", () => {
    const frames = makeFrames(36);
    const pages = splitFramesIntoPages(frames);
    for (let i = 1; i < pages.length; i++) {
      expect(pages[i].startFrame).toBe(pages[i - 1].endFrame + 1);
    }
    expect(pages[0].startFrame).toBe(1);
    expect(pages[pages.length - 1].endFrame).toBe(36);
  });
});
