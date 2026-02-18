import { describe, it, expect } from "vitest";

// Test extractBase64FromContent function
describe("extractBase64FromContent", () => {
  // We need to import the function - it's exported from imageGeneration.ts
  it("should extract base64 from markdown image syntax", async () => {
    const { extractBase64FromContent } = await import("./_core/imageGeneration");
    
    const content = 'Here is the image:\n![image](data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==)';
    const result = extractBase64FromContent(content);
    
    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe("image/png");
    expect(result!.b64Data).toBe("iVBORw0KGgoAAAANSUhEUg==");
  });

  it("should extract base64 from raw data URL", async () => {
    const { extractBase64FromContent } = await import("./_core/imageGeneration");
    
    const content = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    const result = extractBase64FromContent(content);
    
    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe("image/jpeg");
    expect(result!.b64Data).toBe("/9j/4AAQSkZJRg==");
  });

  it("should return null for content without images", async () => {
    const { extractBase64FromContent } = await import("./_core/imageGeneration");
    
    const content = 'This is just text with no image data.';
    const result = extractBase64FromContent(content);
    
    expect(result).toBeNull();
  });
});

// Test Yunwu API key validity
describe("Yunwu API key validation", () => {
  it("should be able to list models with the yunwu API key", async () => {  // eslint-disable-line
    const apiKey = process.env.YUNWU_API_KEY;
    if (!apiKey) {
      console.log("YUNWU_API_KEY not set, skipping");
      return;
    }

    const apiUrl = process.env.YUNWU_API_URL || "https://yunwu.ai";
    const response = await fetch(`${apiUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    expect(response.ok).toBe(true);
    const data = (await response.json()) as { data: Array<{ id: string }> };
    expect(data.data).toBeDefined();
    expect(data.data.length).toBeGreaterThan(0);

    // Verify gemini-3-pro-image-preview is available
    const modelIds = data.data.map((m) => m.id);
    expect(modelIds).toContain("gemini-3-pro-image-preview");
    expect(modelIds).toContain("gemini-3-flash-preview");
    console.log("Found target models: gemini-3-pro-image-preview, gemini-3-flash-preview");
  }, 15000);
});
