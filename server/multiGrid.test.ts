/**
 * Tests for multi-grid pagination logic in gridUtils.ts
 * Updated for dynamic grid layout with MAX_PANELS_PER_GRID=9
 * 
 * Layout mapping (per user specification):
 *   1 panel  → 1×1
 *   2 panels → 1×2
 *   3 panels → 1×3
 *   4 panels → 2×2
 *   5 panels → 2×3 (1 empty)
 *   6 panels → 2×3
 *   7 panels → 2×4 (1 empty)
 *   8 panels → 2×4
 *   9 panels → 3×3
 */
import { describe, it, expect } from "vitest";
import { splitFramesIntoPages, calculateGridLayout, calculateBalancedPageSizes, MAX_PANELS_PER_GRID, type Frame } from "./gridUtils";

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
  it("should return 1×1 for 1 panel", () => {
    const layout = calculateGridLayout(1);
    expect(layout).toEqual({ rows: 1, cols: 1, emptyCount: 0 });
  });

  it("should return 1×2 for 2 panels", () => {
    const layout = calculateGridLayout(2);
    expect(layout).toEqual({ rows: 1, cols: 2, emptyCount: 0 });
  });

  it("should return 1×3 for 3 panels", () => {
    const layout = calculateGridLayout(3);
    expect(layout).toEqual({ rows: 1, cols: 3, emptyCount: 0 });
  });

  it("should return 2×2 for 4 panels", () => {
    const layout = calculateGridLayout(4);
    expect(layout).toEqual({ rows: 2, cols: 2, emptyCount: 0 });
  });

  it("should return 2×3 for 5 panels (1 empty)", () => {
    const layout = calculateGridLayout(5);
    expect(layout).toEqual({ rows: 2, cols: 3, emptyCount: 1 });
  });

  it("should return 2×3 for 6 panels", () => {
    const layout = calculateGridLayout(6);
    expect(layout).toEqual({ rows: 2, cols: 3, emptyCount: 0 });
  });

  it("should return 2×4 for 7 panels (1 empty)", () => {
    const layout = calculateGridLayout(7);
    expect(layout).toEqual({ rows: 2, cols: 4, emptyCount: 1 });
  });

  it("should return 2×4 for 8 panels", () => {
    const layout = calculateGridLayout(8);
    expect(layout).toEqual({ rows: 2, cols: 4, emptyCount: 0 });
  });

  it("should return 3×3 for 9 panels", () => {
    const layout = calculateGridLayout(9);
    expect(layout).toEqual({ rows: 3, cols: 3, emptyCount: 0 });
  });

  it("should handle counts > 9 with 4 columns", () => {
    const layout = calculateGridLayout(10);
    expect(layout.cols).toBe(4);
    expect(layout.rows).toBe(3);
    expect(layout.emptyCount).toBe(2);
  });

  it("should have emptyCount >= 0", () => {
    for (const count of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const layout = calculateGridLayout(count);
      expect(layout.emptyCount).toBeGreaterThanOrEqual(0);
      expect(layout.rows * layout.cols).toBeGreaterThanOrEqual(count);
    }
  });
});

describe("MAX_PANELS_PER_GRID", () => {
  it("should be 9", () => {
    expect(MAX_PANELS_PER_GRID).toBe(9);
  });
});

describe("calculateBalancedPageSizes", () => {
  it("should return single page for ≤9 frames", () => {
    expect(calculateBalancedPageSizes(4)).toEqual([4]);
    expect(calculateBalancedPageSizes(6)).toEqual([6]);
    expect(calculateBalancedPageSizes(8)).toEqual([8]);
    expect(calculateBalancedPageSizes(9)).toEqual([9]);
  });

  it("should split 10 frames into 2 pages", () => {
    const sizes = calculateBalancedPageSizes(10);
    expect(sizes).toHaveLength(2);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(10);
    sizes.forEach(s => {
      expect(s).toBeGreaterThanOrEqual(4);
      expect(s).toBeLessThanOrEqual(9);
    });
  });

  it("should split 12 frames into 2 pages", () => {
    const sizes = calculateBalancedPageSizes(12);
    expect(sizes).toHaveLength(2);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(12);
    sizes.forEach(s => {
      expect(s).toBeGreaterThanOrEqual(4);
      expect(s).toBeLessThanOrEqual(9);
    });
  });

  it("should split 14 frames into 2 pages", () => {
    const sizes = calculateBalancedPageSizes(14);
    expect(sizes).toHaveLength(2);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(14);
  });

  it("should split 16 frames into 2 pages", () => {
    const sizes = calculateBalancedPageSizes(16);
    expect(sizes).toHaveLength(2);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(16);
    sizes.forEach(s => {
      expect(s).toBeGreaterThanOrEqual(4);
      expect(s).toBeLessThanOrEqual(9);
    });
  });

  it("should split 18 frames into 2 pages of 9", () => {
    const sizes = calculateBalancedPageSizes(18);
    expect(sizes).toEqual([9, 9]);
  });

  it("should split 20 frames into 3 pages", () => {
    const sizes = calculateBalancedPageSizes(20);
    expect(sizes.length).toBeGreaterThanOrEqual(3);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(20);
    sizes.forEach(s => {
      expect(s).toBeGreaterThanOrEqual(4);
      expect(s).toBeLessThanOrEqual(9);
    });
  });

  it("should split 30 frames into 4 pages", () => {
    const sizes = calculateBalancedPageSizes(30);
    expect(sizes.length).toBeGreaterThanOrEqual(4);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(30);
    sizes.forEach(s => {
      expect(s).toBeGreaterThanOrEqual(4);
      expect(s).toBeLessThanOrEqual(9);
    });
  });

  it("should handle all page sizes within 4-9 range", () => {
    for (const total of [10, 12, 14, 16, 18, 20, 24, 30, 36, 45, 60]) {
      const sizes = calculateBalancedPageSizes(total);
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(total);
      sizes.forEach(s => {
        expect(s).toBeGreaterThanOrEqual(4);
        expect(s).toBeLessThanOrEqual(9);
      });
    }
  });
});

describe("splitFramesIntoPages", () => {
  it("should return 1 page for 4 frames (2×2 layout)", () => {
    const frames = makeFrames(4);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(1);
    expect(pages[0].pageIndex).toBe(0);
    expect(pages[0].totalPanels).toBe(4);
    expect(pages[0].rows).toBe(2);
    expect(pages[0].cols).toBe(2);
    expect(pages[0].startFrame).toBe(1);
    expect(pages[0].endFrame).toBe(4);
  });

  it("should return 1 page for 6 frames (2×3 layout)", () => {
    const frames = makeFrames(6);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(1);
    expect(pages[0].totalPanels).toBe(6);
    expect(pages[0].rows).toBe(2);
    expect(pages[0].cols).toBe(3);
  });

  it("should return 1 page for 8 frames (2×4 layout)", () => {
    const frames = makeFrames(8);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(1);
    expect(pages[0].totalPanels).toBe(8);
    expect(pages[0].rows).toBe(2);
    expect(pages[0].cols).toBe(4);
  });

  it("should return 1 page for 9 frames (3×3 layout)", () => {
    const frames = makeFrames(9);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(1);
    expect(pages[0].totalPanels).toBe(9);
    expect(pages[0].rows).toBe(3);
    expect(pages[0].cols).toBe(3);
  });

  it("should return 2 pages for 12 frames", () => {
    const frames = makeFrames(12);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(2);
    const totalPanels = pages.reduce((sum, p) => sum + p.totalPanels, 0);
    expect(totalPanels).toBe(12);
    pages.forEach(p => {
      expect(p.totalPanels).toBeGreaterThanOrEqual(4);
      expect(p.totalPanels).toBeLessThanOrEqual(9);
    });
  });

  it("should return 2 pages for 16 frames", () => {
    const frames = makeFrames(16);
    const pages = splitFramesIntoPages(frames);
    expect(pages).toHaveLength(2);
    const totalPanels = pages.reduce((sum, p) => sum + p.totalPanels, 0);
    expect(totalPanels).toBe(16);
    pages.forEach(p => {
      expect(p.totalPanels).toBeGreaterThanOrEqual(4);
      expect(p.totalPanels).toBeLessThanOrEqual(9);
    });
  });

  it("should have correct page labels", () => {
    const frames = makeFrames(12);
    const pages = splitFramesIntoPages(frames);
    expect(pages[0].pageLabel).toContain("Page 1/2");
    expect(pages[1].pageLabel).toContain("Page 2/2");
  });

  it("should respect MAX_PANELS_PER_GRID constant", () => {
    expect(MAX_PANELS_PER_GRID).toBe(9);
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
    expect(pages[0].cols).toBe(1);
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

  it("should handle large frame counts correctly", () => {
    for (const total of [20, 30, 45, 60]) {
      const frames = makeFrames(total);
      const pages = splitFramesIntoPages(frames);
      const totalPanels = pages.reduce((sum, p) => sum + p.totalPanels, 0);
      expect(totalPanels).toBe(total);
      pages.forEach(p => {
        expect(p.totalPanels).toBeLessThanOrEqual(MAX_PANELS_PER_GRID);
        expect(p.totalPanels).toBeGreaterThanOrEqual(4);
      });
    }
  });
});
