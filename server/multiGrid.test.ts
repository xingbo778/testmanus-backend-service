/**
 * Tests for multi-grid pagination logic in gridUtils.ts
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
  it("should return 2x2 for 4 panels", () => {
    expect(calculateGridLayout(4)).toEqual({ rows: 2, cols: 2 });
  });

  it("should return 2x3 for 6 panels", () => {
    expect(calculateGridLayout(6)).toEqual({ rows: 2, cols: 3 });
  });

  it("should return 2x4 for 8 panels", () => {
    expect(calculateGridLayout(8)).toEqual({ rows: 2, cols: 4 });
  });

  it("should return 3x4 for 12 panels", () => {
    expect(calculateGridLayout(12)).toEqual({ rows: 3, cols: 4 });
  });

  it("should return 3x3 for 9 panels", () => {
    expect(calculateGridLayout(9)).toEqual({ rows: 3, cols: 3 });
  });
});

describe("splitFramesIntoPages", () => {
  it("should return 1 page for 6 frames (15s project)", () => {
    const frames = makeFrames(6);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(1);
    expect(pages[0].pageIndex).toBe(0);
    expect(pages[0].totalPanels).toBe(6);
    expect(pages[0].rows).toBe(2);
    expect(pages[0].cols).toBe(3);
    expect(pages[0].startFrame).toBe(1);
    expect(pages[0].endFrame).toBe(6);
  });

  it("should return 1 page for 12 frames (30s project)", () => {
    const frames = makeFrames(12);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(1);
    expect(pages[0].totalPanels).toBe(12);
    expect(pages[0].rows).toBe(3);
    expect(pages[0].cols).toBe(4);
  });

  it("should return 2 pages for 15 frames (45s project)", () => {
    const frames = makeFrames(15);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(2);
    // Page 1: 12 frames
    expect(pages[0].totalPanels).toBe(12);
    expect(pages[0].rows).toBe(3);
    expect(pages[0].cols).toBe(4);
    expect(pages[0].startFrame).toBe(1);
    expect(pages[0].endFrame).toBe(12);
    // Page 2: 3 frames
    expect(pages[1].totalPanels).toBe(3);
    expect(pages[1].startFrame).toBe(13);
    expect(pages[1].endFrame).toBe(15);
  });

  it("should return 2 pages for 20 frames (45s project with more frames)", () => {
    const frames = makeFrames(20);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(2);
    expect(pages[0].totalPanels).toBe(12);
    expect(pages[1].totalPanels).toBe(8);
  });

  it("should return 3 pages for 30 frames (60s project)", () => {
    const frames = makeFrames(30);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(3);
    expect(pages[0].totalPanels).toBe(12);
    expect(pages[1].totalPanels).toBe(12);
    expect(pages[2].totalPanels).toBe(6);
    expect(pages[2].startFrame).toBe(25);
    expect(pages[2].endFrame).toBe(30);
  });

  it("should return 4 pages for 45 frames (90s project)", () => {
    const frames = makeFrames(45);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(4);
    expect(pages[0].totalPanels).toBe(12);
    expect(pages[1].totalPanels).toBe(12);
    expect(pages[2].totalPanels).toBe(12);
    expect(pages[3].totalPanels).toBe(9);
  });

  it("should return 5 pages for 60 frames (120s project)", () => {
    const frames = makeFrames(60);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(5);
    for (let i = 0; i < 4; i++) {
      expect(pages[i].totalPanels).toBe(12);
    }
    expect(pages[4].totalPanels).toBe(12);
  });

  it("should have correct page labels", () => {
    const frames = makeFrames(20);
    const pages = splitFramesIntoPages(frames);
    expect(pages[0].pageLabel).toContain("Page 1/2");
    expect(pages[0].pageLabel).toContain("frames 1-12");
    expect(pages[1].pageLabel).toContain("Page 2/2");
    expect(pages[1].pageLabel).toContain("frames 13-20");
  });

  it("should respect MAX_PANELS_PER_GRID constant", () => {
    expect(MAX_PANELS_PER_GRID).toBe(12);
    const frames = makeFrames(13);
    const pages = splitFramesIntoPages(frames);
    // No page should exceed MAX_PANELS_PER_GRID
    for (const page of pages) {
      expect(page.totalPanels).toBeLessThanOrEqual(MAX_PANELS_PER_GRID);
    }
  });

  it("should handle single frame", () => {
    const frames = makeFrames(1);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(1);
    expect(pages[0].totalPanels).toBe(1);
  });

  it("should have contiguous frame ranges across pages", () => {
    const frames = makeFrames(36);
    const pages = splitFramesIntoPages(frames);
    // Check that frames are contiguous
    for (let i = 1; i < pages.length; i++) {
      expect(pages[i].startFrame).toBe(pages[i - 1].endFrame + 1);
    }
    // First page starts at 1
    expect(pages[0].startFrame).toBe(1);
    // Last page ends at total
    expect(pages[pages.length - 1].endFrame).toBe(36);
  });
});
