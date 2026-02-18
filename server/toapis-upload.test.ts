import { describe, expect, it, vi, beforeEach } from "vitest";

// Test ToAPIs image upload API key validation
describe("ToAPIs Image Upload Integration", () => {
  it("should successfully upload a small test image to ToAPIs", async () => {
    const apiKey = process.env.TOAPIS_API_KEY;
    if (!apiKey) {
      console.warn("TOAPIS_API_KEY not set, skipping integration test");
      return;
    }

    const apiUrl = process.env.TOAPIS_API_URL || "https://toapis.com";

    // Create a minimal 1x1 red PNG image (base64)
    // This is a valid PNG file: 1x1 pixel, red color
    const minimalPngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

    const buffer = Buffer.from(minimalPngBase64, "base64");
    const blob = new Blob([buffer], { type: "image/png" });
    const formData = new FormData();
    formData.append("file", blob, "test_upload.png");

    const uploadUrl = `${apiUrl.replace(/\/$/, "")}/v1/uploads/images`;

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    expect(response.ok).toBe(true);

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.url).toBeDefined();
    expect(typeof result.data.url).toBe("string");
    expect(result.data.url).toMatch(/^https?:\/\//);

    console.log("ToAPIs upload test passed! URL:", result.data.url);
  }, 30000); // 30 second timeout for network request

  it("should reject requests with invalid API key", async () => {
    const apiUrl = process.env.TOAPIS_API_URL || "https://toapis.com";

    const minimalPngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

    const buffer = Buffer.from(minimalPngBase64, "base64");
    const blob = new Blob([buffer], { type: "image/png" });
    const formData = new FormData();
    formData.append("file", blob, "test_upload.png");

    const uploadUrl = `${apiUrl.replace(/\/$/, "")}/v1/uploads/images`;

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: "Bearer invalid-key-12345",
      },
      body: formData,
    });

    // Should fail with 401 or 403
    expect(response.ok).toBe(false);
    expect([401, 403]).toContain(response.status);
  }, 15000);
});

describe("resolveBase64Image function", () => {
  it("should handle base64 image upload via ToAPIs", async () => {
    // Mock the ENV
    vi.stubEnv("TOAPIS_API_KEY", process.env.TOAPIS_API_KEY || "test-key");
    vi.stubEnv("TOAPIS_API_URL", process.env.TOAPIS_API_URL || "https://toapis.com");

    // Import after env is set
    const { resolveBase64Image } = await import("./_core/imageGeneration");

    if (!process.env.TOAPIS_API_KEY) {
      console.warn("TOAPIS_API_KEY not set, skipping resolveBase64Image test");
      return;
    }

    const minimalPngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

    const url = await resolveBase64Image(minimalPngBase64, "image/png");
    expect(url).toBeDefined();
    expect(typeof url).toBe("string");
    // Should be a real URL, not a data URL
    expect(url).toMatch(/^https?:\/\//);
    expect(url).not.toContain("data:image");

    console.log("resolveBase64Image test passed! URL:", url);
  }, 30000);
});
