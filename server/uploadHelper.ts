/**
 * Unified file upload helper that works in both Manus and Railway environments.
 * Strategy: ToAPIs (preferred for images) → S3 storagePut → data URL fallback
 */
import { ENV } from "./_core/env";

/**
 * Upload a buffer to ToAPIs image endpoint.
 * Only works for image types.
 */
async function uploadToToapis(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  const apiKey = ENV.toapisApiKey;
  const apiUrl = ENV.toapisApiUrl;

  if (!apiKey) {
    throw new Error("TOAPIS_API_KEY is not configured");
  }

  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
  const formData = new FormData();
  formData.append("file", blob, fileName);

  const uploadUrl = `${apiUrl.replace(/\/$/, "")}/v1/uploads/images`;

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
      `ToAPIs upload failed (${response.status})${detail ? `: ${detail}` : ""}`
    );
  }

  const result = (await response.json()) as {
    success: boolean;
    data: { url: string };
  };

  if (!result.success || !result.data?.url) {
    throw new Error(`ToAPIs upload unexpected response: ${JSON.stringify(result)}`);
  }

  return result.data.url;
}

/**
 * Upload a buffer to S3 via Manus storagePut.
 */
async function uploadToS3(
  buffer: Buffer,
  key: string,
  mimeType: string
): Promise<string> {
  const { storagePut } = await import("./storage");
  const { url } = await storagePut(key, buffer, mimeType);
  return url;
}

/**
 * Upload a file buffer with automatic fallback.
 * For images: ToAPIs → S3 → data URL
 * For non-images: S3 → data URL
 */
export async function uploadFile(opts: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  s3Key?: string;
}): Promise<string> {
  const { buffer, mimeType, fileName, s3Key } = opts;
  const isImage = mimeType.startsWith("image/");

  // Strategy 1: ToAPIs (for images, works on Railway)
  if (isImage && ENV.toapisApiKey) {
    try {
      return await uploadToToapis(buffer, mimeType, fileName);
    } catch (e) {
      console.warn(`[UploadHelper] ToAPIs failed, trying S3:`, e);
    }
  }

  // Strategy 2: S3 storagePut (works on Manus)
  if (ENV.forgeApiKey) {
    try {
      const key = s3Key || `uploads/${fileName}`;
      return await uploadToS3(buffer, key, mimeType);
    } catch (e) {
      console.warn(`[UploadHelper] S3 failed, using data URL:`, e);
    }
  }

  // Strategy 3: data URL fallback (last resort)
  const b64 = buffer.toString("base64");
  return `data:${mimeType};base64,${b64}`;
}
