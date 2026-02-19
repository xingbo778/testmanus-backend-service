/**
 * Image generation helper - uses Yunwu API with gemini-3-pro-image-preview
 * via chat/completions endpoint (returns base64 in markdown).
 * Integrates ToAPIs upload for converting base64 responses to URLs.
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

/**
 * Upload a base64-encoded image to ToAPIs and get back a public URL.
 * POST https://toapis.com/v1/uploads/images
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

  const buffer = Buffer.from(b64Data, "base64");
  const extMap: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const ext = extMap[mimeType] || "png";
  const fileName = `storyboard_${Date.now()}.${ext}`;

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
  // Strategy 1: Upload to ToAPIs (preferred)
  if (ENV.toapisApiKey) {
    try {
      return await uploadBase64ToToapis(b64Data, mimeType);
    } catch (e) {
      console.warn(`[ImageUpload] ToAPIs upload failed, trying S3 fallback:`, e);
    }
  }

  // Strategy 2: Upload to S3 storage
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

  // Strategy 3: Return as data URL (last resort)
  return `data:${mimeType};base64,${b64Data}`;
}

/**
 * Extract base64 image data from chat completion response content.
 * The model returns markdown like: ![image](data:image/png;base64,iVBOR...)
 * or just the raw base64 data.
 */
function extractBase64FromContent(content: string): { b64Data: string; mimeType: string } | null {
  // Pattern 1: markdown image with data URL - ![...](data:image/xxx;base64,...)
  const mdMatch = content.match(/!\[.*?\]\(data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+(?:\s*[A-Za-z0-9+/=]+)*)\)/);
  if (mdMatch) {
    return { mimeType: mdMatch[1], b64Data: mdMatch[2].replace(/\s/g, "") };
  }

  // Pattern 2: raw data URL - data:image/xxx;base64,...
  const dataUrlMatch = content.match(/data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+(?:\s*[A-Za-z0-9+/=]+)*)/);
  if (dataUrlMatch) {
    return { mimeType: dataUrlMatch[1], b64Data: dataUrlMatch[2].replace(/\s/g, "") };
  }

  return null;
}

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  const apiKey = resolveImageApiKey();
  if (!apiKey) {
    throw new Error("No API key configured for image generation");
  }

  const yunwuMode = !!(ENV.yunwuApiKey && ENV.yunwuApiKey.trim().length > 0);

  if (yunwuMode) {
    const model = options.model || "gemini-3-pro-image-preview";
    const apiUrl = `${ENV.yunwuApiUrl.replace(/\/$/, "")}/v1/chat/completions`;

    console.log(`[ImageGen] Using model: ${model} via chat completions`);

    // Build messages - for image generation via chat completions
    const messages: Array<{ role: string; content: string | Array<any> }> = [];

    // If we have original images for editing, include them
    if (options.originalImages && options.originalImages.length > 0) {
      const contentParts: Array<any> = [];
      for (const img of options.originalImages) {
        if (img.url) {
          contentParts.push({
            type: "image_url",
            image_url: { url: img.url },
          });
        } else if (img.b64Json) {
          const mime = img.mimeType || "image/png";
          contentParts.push({
            type: "image_url",
            image_url: { url: `data:${mime};base64,${img.b64Json}` },
          });
        }
      }
      contentParts.push({
        type: "text",
        text: options.prompt,
      });
      messages.push({ role: "user", content: contentParts });
    } else {
      messages.push({
        role: "user",
        content: `Generate an image based on the following description. Only output the image, no text explanation.\n\n${options.prompt}`,
      });
    }

    const requestBody = JSON.stringify({
      model,
      messages,
      max_tokens: 8192,
    });

    // Retry up to 2 times with 5-minute timeout each
    const MAX_RETRIES = 2;
    const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    let lastError: Error | null = null;
    let response: Response | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        console.log(`[ImageGen] Retry attempt ${attempt}/${MAX_RETRIES}...`);
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
        response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
          },
          body: requestBody,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        break; // success
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        console.warn(`[ImageGen] Attempt ${attempt + 1} failed: ${lastError.message}`);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 3000)); // wait 3s before retry
        }
      }
    }

    if (!response) {
      throw lastError || new Error("Image generation failed after retries");
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Image generation failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
    }

    const result = (await response.json()) as {
      choices: Array<{
        message: {
          content: string;
        };
      }>;
    };

    if (!result.choices || result.choices.length === 0) {
      throw new Error("No choices returned from image generation API");
    }

    const content = result.choices[0].message.content;
    const extracted = extractBase64FromContent(content);

    if (extracted) {
      console.log(`[ImageGen] Extracted base64 image (${extracted.b64Data.length} chars), uploading...`);
      const url = await resolveBase64Image(extracted.b64Data, extracted.mimeType);
      return { url };
    }

    // If no base64 found, check if content contains a URL directly
    const urlMatch = content.match(/https?:\/\/[^\s\)]+\.(png|jpg|jpeg|webp|gif)/i);
    if (urlMatch) {
      console.log(`[ImageGen] Found direct URL in response: ${urlMatch[0]}`);
      return { url: urlMatch[0] };
    }

    console.error(`[ImageGen] Could not extract image from response content (length: ${content.length})`);
    throw new Error("Could not extract image from model response");
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
export { uploadBase64ToToapis, resolveBase64Image, extractBase64FromContent };
