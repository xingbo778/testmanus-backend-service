/**
 * Image generation helper - supports Yunwu API (OpenAI-compatible) and Manus Forge API
 * Integrates ToAPIs upload for converting b64_json responses to URLs
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

/**
 * Upload a base64-encoded image to ToAPIs and get back a public URL.
 * POST https://toapis.com/v1/uploads/images
 * Returns the URL from the response data.
 */
async function uploadBase64ToToapis(
  b64Data: string,
  mimeType: string = "image/png"
): Promise<string> {
  const apiKey = ENV.toapisApiKey;
  const apiUrl = ENV.toapisApiUrl;

  if (!apiKey) {
    throw new Error("TOAPIS_API_KEY is not configured for image upload");
  }

  // Convert base64 to Buffer
  const buffer = Buffer.from(b64Data, "base64");

  // Determine file extension from mime type
  const extMap: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const ext = extMap[mimeType] || "png";
  const fileName = `storyboard_${Date.now()}.${ext}`;

  // Create FormData with the image file
  const blob = new Blob([buffer], { type: mimeType });
  const formData = new FormData();
  formData.append("file", blob, fileName);

  const uploadUrl = `${apiUrl.replace(/\/$/, "")}/v1/uploads/images`;

  console.log(`[ImageUpload] Uploading ${fileName} (${buffer.length} bytes) to ToAPIs...`);

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `ToAPIs image upload failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }

  const result = (await response.json()) as {
    success: boolean;
    message: string;
    data: {
      id: string;
      url: string;
      mime_type: string;
      size: number;
    };
  };

  if (!result.success || !result.data?.url) {
    throw new Error(`ToAPIs upload returned unexpected response: ${JSON.stringify(result)}`);
  }

  console.log(`[ImageUpload] Upload successful: ${result.data.url}`);
  return result.data.url;
}

/**
 * Try to upload base64 image to ToAPIs first, fall back to S3 storage, then data URL
 */
async function resolveBase64Image(
  b64Data: string,
  mimeType: string = "image/png"
): Promise<string> {
  // Strategy 1: Upload to ToAPIs (preferred - gives a real URL)
  if (ENV.toapisApiKey) {
    try {
      return await uploadBase64ToToapis(b64Data, mimeType);
    } catch (e) {
      console.warn(`[ImageUpload] ToAPIs upload failed, trying S3 fallback:`, e);
    }
  }

  // Strategy 2: Upload to S3 storage (Manus environment)
  try {
    const { storagePut } = await import("../storage");
    const buffer = Buffer.from(b64Data, "base64");
    const { url } = await storagePut(
      `generated/${Date.now()}.png`,
      buffer,
      mimeType
    );
    return url;
  } catch (e) {
    console.warn(`[ImageUpload] S3 upload failed, using data URL fallback:`, e);
  }

  // Strategy 3: Return as data URL (last resort - may cause issues with large images)
  return `data:${mimeType};base64,${b64Data}`;
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
        model: options.model || "flux-schnell",
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
      const item = result.data[0];
      // Some models return url directly
      if (item.url) {
        return { url: item.url };
      }
      // Some models (like gpt-image-1) return b64_json - upload to get URL
      if (item.b64_json) {
        const url = await resolveBase64Image(item.b64_json, "image/png");
        return { url };
      }
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

    const url = await resolveBase64Image(result.image.b64Json, result.image.mimeType);
    return { url };
  }
}

// Export for testing
export { uploadBase64ToToapis, resolveBase64Image };
