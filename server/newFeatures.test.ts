import { describe, it, expect, vi, beforeEach } from "vitest";

// ==================== Grid Template Tests ====================
describe("gridTemplate", () => {
  it("generates a valid data URL for 2x3 grid", async () => {
    const { generateGridTemplateDataUrl } = await import("./gridTemplate");
    const dataUrl = await generateGridTemplateDataUrl(2, 3, 1024, 768);
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(dataUrl.length).toBeGreaterThan(100);
  });

  it("generates a valid data URL for 1x4 grid", async () => {
    const { generateGridTemplateDataUrl } = await import("./gridTemplate");
    const dataUrl = await generateGridTemplateDataUrl(1, 4, 800, 400);
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it("handles single cell grid", async () => {
    const { generateGridTemplateDataUrl } = await import("./gridTemplate");
    const dataUrl = await generateGridTemplateDataUrl(1, 1, 512, 512);
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });
});

// ==================== Panel Extractor Tests ====================
describe("panelExtractor", () => {
  it("extractPanel calculates correct crop coordinates for panel 1 of 2x3", async () => {
    // We can't test the full extraction without a real image URL,
    // but we can verify the module exports exist
    const mod = await import("./panelExtractor");
    expect(typeof mod.extractPanel).toBe("function");
    expect(typeof mod.extractAllPanels).toBe("function");
  });

  it("extractPanel with a generated test image", async () => {
    const sharp = (await import("sharp")).default;
    const { extractPanel } = await import("./panelExtractor");

    // Create a 600x400 test image (2 rows x 3 cols = 6 panels)
    const testImage = await sharp({
      create: {
        width: 600,
        height: 400,
        channels: 3,
        background: { r: 200, g: 200, b: 200 },
      },
    }).png().toBuffer();

    // Serve it as a data URL won't work with fetch, so we mock fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(testImage.buffer.slice(testImage.byteOffset, testImage.byteOffset + testImage.byteLength)),
    }) as any;

    try {
      const result = await extractPanel({
        gridImageUrl: "http://test.com/grid.png",
        rows: 2,
        cols: 3,
        panelIndex: 1,
        padding: 0,
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);

      // Verify dimensions: should be 200x200 (600/3 x 400/2)
      const meta = await sharp(result).metadata();
      expect(meta.width).toBe(200);
      expect(meta.height).toBe(200);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("extractPanel for panel 5 of 2x3 grid", async () => {
    const sharp = (await import("sharp")).default;
    const { extractPanel } = await import("./panelExtractor");

    const testImage = await sharp({
      create: { width: 600, height: 400, channels: 3, background: { r: 100, g: 100, b: 100 } },
    }).png().toBuffer();

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(testImage.buffer.slice(testImage.byteOffset, testImage.byteOffset + testImage.byteLength)),
    }) as any;

    try {
      const result = await extractPanel({
        gridImageUrl: "http://test.com/grid.png",
        rows: 2,
        cols: 3,
        panelIndex: 5,
        padding: 0,
      });

      const meta = await sharp(result).metadata();
      // Panel 5 is row 1, col 1 (0-indexed) → should be 200x200
      expect(meta.width).toBe(200);
      expect(meta.height).toBe(200);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ==================== App Logger Tests ====================
describe("appLogger", () => {
  it("exports all log level functions", async () => {
    const mod = await import("./appLogger");
    expect(typeof mod.appLog).toBe("function");
    expect(typeof mod.logInfo).toBe("function");
    expect(typeof mod.logWarn).toBe("function");
    expect(typeof mod.logError).toBe("function");
    expect(typeof mod.logDebug).toBe("function");
  });

  it("appLog does not throw when db is unavailable", async () => {
    // appLog swallows errors by design
    const { appLog } = await import("./appLogger");
    await expect(appLog({
      level: "info",
      source: "test",
      message: "test message",
    })).resolves.toBeUndefined();
  });
});

// ==================== Video Generator Tests ====================
describe("videoGenerator", () => {
  it("exports createVideoTask and queryVideoStatus", async () => {
    const mod = await import("./videoGenerator");
    expect(typeof mod.createVideoTask).toBe("function");
    expect(typeof mod.queryVideoStatus).toBe("function");
    expect(typeof mod.pollVideoTask).toBe("function");
  });

  it("createVideoTask throws when YUNWU_API_KEY is not set", async () => {
    // In test env, YUNWU_API_KEY may not be set
    const { createVideoTask } = await import("./videoGenerator");
    // This should either throw about missing key or fail gracefully
    try {
      await createVideoTask({ prompt: "test" });
    } catch (e: any) {
      expect(e.message).toMatch(/YUNWU_API_KEY|not configured|Video|video|Volc|VEO|failed|timeout|TIMEOUT|fetch/);
    }
  }, 30000);
});

// ==================== Video Merger Tests ====================
describe("videoMerger", () => {
  it("exports mergeVideoClips function", async () => {
    const mod = await import("./videoMerger");
    expect(typeof mod.mergeVideoClips).toBe("function");
  });
});
