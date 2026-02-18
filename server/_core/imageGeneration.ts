/**
 * Image generation helper - supports Yunwu API (OpenAI-compatible) and Manus Forge API
 */
import { ENV } from "./env";

export type GenerateImageOptions = {
  prompt: string;
  model?: string;
  size?: string;
  n?: number;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
};

function resolveImageApiKey(): string {
  if (ENV.yunwuApiKey && ENV.yunwuApiKey.trim().length > 0) {
    return ENV.yunwuApiKey;
  }
  return ENV.forgeApiKey;
}

function isYunwuMode(): boolean {
  return !!(ENV.yunwuApiKey && ENV.yunwuApiKey.trim().length > 0);
}

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  const apiKey = resolveImageApiKey();
  if (!apiKey) {
    throw new Error("No API key configured for image generation");
  }

  if (isYunwuMode()) {
    // Yunwu API (OpenAI-compatible images/generations endpoint)
    const apiUrl = `${ENV.yunwuApiUrl.replace(/\/$/, "")}/v1/images/generations`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || "gpt-image-1",
        prompt: options.prompt,
        n: options.n || 1,
        size: options.size || "1024x1024",
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Image generation failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
    }

    const result = (await response.json()) as {
      data: Array<{ url?: string; b64_json?: string }>;
    };

    if (result.data && result.data.length > 0) {
      return { url: result.data[0].url };
    }

    throw new Error("No image data returned from API");
  } else {
    // Manus Forge API (original implementation)
    if (!ENV.forgeApiUrl) {
      throw new Error("BUILT_IN_FORGE_API_URL is not configured");
    }

    const baseUrl = ENV.forgeApiUrl.endsWith("/")
      ? ENV.forgeApiUrl
      : `${ENV.forgeApiUrl}/`;
    const fullUrl = new URL(
      "images.v1.ImageService/GenerateImage",
      baseUrl
    ).toString();

    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "connect-protocol-version": "1",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: options.prompt,
        original_images: options.originalImages || [],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Image generation failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
    }

    const result = (await response.json()) as {
      image: { b64Json: string; mimeType: string };
    };

    try {
      const { storagePut } = await import("../storage");
      const buffer = Buffer.from(result.image.b64Json, "base64");
      const { url } = await storagePut(
        `generated/${Date.now()}.png`,
        buffer,
        result.image.mimeType
      );
      return { url };
    } catch {
      return {
        url: `data:${result.image.mimeType};base64,${result.image.b64Json}`,
      };
    }
  }
}
