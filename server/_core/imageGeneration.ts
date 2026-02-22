/**
 * Image generation helper - uses Yunwu API with Gemini native format (v1beta)
 * for image generation. Falls back to Manus Forge API.
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

/**
 * Convert a URL image to base64 inline_data for Gemini native format
 */
async function urlToBase64Part(url: string, mimeType?: string): Promise<{ inline_data: { mime_type: string; data: string } }> {
  // Handle data URLs directly (e.g., data:image/png;base64,...)
  if (url.startsWith('data:')) {
    const match = url.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
    if (match) {
      return {
        inline_data: {
          mime_type: mimeType || match[1],
          data: match[2],
        },
      };
    }
    throw new Error(`Invalid data URL format`);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from ${url.substring(0, 100)}: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  const b64 = Buffer.from(buffer).toString("base64");
  const detectedMime = mimeType || response.headers.get("content-type") || "image/png";
  return {
    inline_data: {
      mime_type: detectedMime,
      data: b64,
    },
  };
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
    // Use Yunwu native Gemini format (v1beta)
    const model = options.model || "gemini-3-pro-image-preview";
    const baseUrl = ENV.yunwuApiUrl.replace(/\/$/, "");
    const apiUrl = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;

    console.log(`[ImageGen] Using Yunwu native format, model: ${model}`);

    // Build contents parts
    const parts: Array<any> = [];

    // If we have original images for editing, include them as inline_data
    if (options.originalImages && options.originalImages.length > 0) {
      for (const img of options.originalImages) {
        try {
          if (img.url) {
            const inlinePart = await urlToBase64Part(img.url, img.mimeType);
            parts.push(inlinePart);
          } else if (img.b64Json) {
            parts.push({
              inline_data: {
                mime_type: img.mimeType || "image/png",
                data: img.b64Json,
              },
            });
          }
        } catch (e) {
          console.warn(`[ImageGen] Failed to convert reference image: ${e}`);
        }
      }
    }

    // Add text prompt
    parts.push({
      text: options.prompt,
    });

    const requestBody = JSON.stringify({
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "OFF" },
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "OFF" },
        { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
      ],
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
            "Content-Type": "application/json",
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

    // Parse Gemini native response format
    // Note: Yunwu API returns camelCase (inlineData, mimeType) not snake_case
    const result = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            inline_data?: { mime_type: string; data: string };
            inlineData?: { mimeType: string; data: string };
          }>;
        };
      }>;
    };

    if (!result.candidates || result.candidates.length === 0) {
      throw new Error("No candidates returned from Gemini image generation");
    }

    const candidate = result.candidates[0];
    if (!candidate.content?.parts) {
      throw new Error("No parts in Gemini response candidate");
    }

    // Find the image part (inline_data or inlineData - API may return either format)
    for (const part of candidate.content.parts) {
      const inlineData = part.inline_data || part.inlineData;
      if (inlineData) {
        const mimeType = (inlineData as any).mime_type || (inlineData as any).mimeType || "image/png";
        const data = inlineData.data;
        console.log(`[ImageGen] Got inline image (${data.length} chars, ${mimeType}), uploading...`);
        const url = await resolveBase64Image(data, mimeType);
        return { url };
      }
    }

    // No inline_data found, check text parts for embedded base64
    for (const part of candidate.content.parts) {
      if (part.text) {
        const extracted = extractBase64FromContent(part.text);
        if (extracted) {
          console.log(`[ImageGen] Extracted base64 from text part (${extracted.b64Data.length} chars), uploading...`);
          const url = await resolveBase64Image(extracted.b64Data, extracted.mimeType);
          return { url };
        }

        // Check for direct URL
        const urlMatch = part.text.match(/https?:\/\/[^\s\)]+\.(png|jpg|jpeg|webp|gif)/i);
        if (urlMatch) {
          console.log(`[ImageGen] Found direct URL in text: ${urlMatch[0]}`);
          return { url: urlMatch[0] };
        }
      }
    }

    console.error(`[ImageGen] Could not extract image from Gemini response. Parts:`, 
      candidate.content.parts.map(p => ({ hasText: !!p.text, hasInlineData: !!p.inline_data })));
    throw new Error("Could not extract image from Gemini response");
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
