/**
 * Tests for multi-grid pagination logic in gridUtils.ts
 * Updated for 2×3 composed grid layout with MAX_PANELS_PER_GRID=6
 * 
 * New pipeline: Gemini generates 3×3 reference grid → individual panels → Sharp composes 2×3 final grid
 * calculateGridLayout returns the FINAL composed layout (2 cols × 3 rows)
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
  it("should always return 2 cols × 3 rows grid", () => {
    for (const count of [1, 2, 3, 4, 5, 6]) {
      const layout = calculateGridLayout(count);
      expect(layout.rows).toBe(3);
      expect(layout.cols).toBe(2);
    }
  });

  it("should return correct emptyCount for 1 panel", () => {
    const layout = calculateGridLayout(1);
    expect(layout).toEqual({ rows: 3, cols: 2, emptyCount: 5 });
  });

  it("should return correct emptyCount for 4 panels", () => {
    const layout = calculateGridLayout(4);
    expect(layout).toEqual({ rows: 3, cols: 2, emptyCount: 2 });
  });

  it("should return correct emptyCount for 6 panels (full grid)", () => {
    const layout = calculateGridLayout(6);
    expect(layout).toEqual({ rows: 3, cols: 2, emptyCount: 0 });
  });

  it("should cap emptyCount at 0 for counts >= 6", () => {
    const layout = calculateGridLayout(9);
    expect(layout).toEqual({ rows: 3, cols: 2, emptyCount: 0 });
  });
});

describe("MAX_PANELS_PER_GRID", () => {
  it("should be 6", () => {
    expect(MAX_PANELS_PER_GRID).toBe(6);
  });
});

describe("splitFramesIntoPages", () => {
  it("should return 1 page for 3 frames", () => {
    const frames = makeFrames(3);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(1);
    expect(pages[0].pageIndex).toBe(0);
    expect(pages[0].totalPanels).toBe(3);
    expect(pages[0].rows).toBe(3);
    expect(pages[0].cols).toBe(2);
    expect(pages[0].startFrame).toBe(1);
    expect(pages[0].endFrame).toBe(3);
  });

  it("should return 1 page for 6 frames", () => {
    const frames = makeFrames(6);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(1);
    expect(pages[0].totalPanels).toBe(6);
    expect(pages[0].rows).toBe(3);
    expect(pages[0].cols).toBe(2);
  });

  it("should return 2 pages for 7 frames", () => {
    const frames = makeFrames(7);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(2);
    // Page 1: 6 frames
    expect(pages[0].totalPanels).toBe(6);
    expect(pages[0].rows).toBe(3);
    expect(pages[0].cols).toBe(2);
    expect(pages[0].startFrame).toBe(1);
    expect(pages[0].endFrame).toBe(6);
    // Page 2: 1 frame
    expect(pages[1].totalPanels).toBe(1);
    expect(pages[1].rows).toBe(3);
    expect(pages[1].cols).toBe(2);
    expect(pages[1].startFrame).toBe(7);
    expect(pages[1].endFrame).toBe(7);
  });

  it("should return 2 pages for 12 frames", () => {
    const frames = makeFrames(12);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(2);
    expect(pages[0].totalPanels).toBe(6);
    expect(pages[1].totalPanels).toBe(6);
  });

  it("should return 3 pages for 15 frames", () => {
    const frames = makeFrames(15);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(3);
    expect(pages[0].totalPanels).toBe(6);
    expect(pages[1].totalPanels).toBe(6);
    expect(pages[2].totalPanels).toBe(3);
    expect(pages[2].startFrame).toBe(13);
    expect(pages[2].endFrame).toBe(15);
  });

  it("should return 4 pages for 20 frames", () => {
    const frames = makeFrames(20);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(4);
    expect(pages[0].totalPanels).toBe(6);
    expect(pages[1].totalPanels).toBe(6);
    expect(pages[2].totalPanels).toBe(6);
    expect(pages[3].totalPanels).toBe(2);
  });

  it("should return 5 pages for 30 frames", () => {
    const frames = makeFrames(30);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(pages[i].totalPanels).toBe(6);
    }
  });

  it("should return 8 pages for 45 frames", () => {
    const frames = makeFrames(45);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(8);
    for (let i = 0; i < 7; i++) {
      expect(pages[i].totalPanels).toBe(6);
    }
    expect(pages[7].totalPanels).toBe(3);
  });

  it("should return 10 pages for 60 frames", () => {
    const frames = makeFrames(60);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(10);
    for (let i = 0; i < 10; i++) {
      expect(pages[i].totalPanels).toBe(6);
    }
  });

  it("should have correct page labels", () => {
    const frames = makeFrames(12);
    const pages = splitFramesIntoPages(frames);
    expect(pages[0].pageLabel).toContain("Page 1/2");
    expect(pages[0].pageLabel).toContain("frames 1-6");
    expect(pages[1].pageLabel).toContain("Page 2/2");
    expect(pages[1].pageLabel).toContain("frames 7-12");
  });

  it("should respect MAX_PANELS_PER_GRID constant", () => {
    expect(MAX_PANELS_PER_GRID).toBe(6);
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
    expect(pages[0].rows).toBe(3);
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
