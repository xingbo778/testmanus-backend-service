/**
 * Video generation service using Yunwu API.
 * Supports two API families:
 *   1. VEO models (veo3, veo3-fast, veo3.1, veo3.1-fast) — /v1/video/create + /v1/video/query
 *   2. Volc models (doubao-seedance-1-5-pro-251215) — /volc/v1/contents/generations/tasks
 */
import { ENV } from "./_core/env";
import { logInfo, logError, logWarn } from "./appLogger";

const YUNWU_BASE = ENV.yunwuApiUrl || "https://yunwu.ai";
const YUNWU_KEY = ENV.yunwuApiKey;

/** Known model families and their API routing */
const VOLC_MODELS = new Set([
  "doubao-seedance-1-5-pro-251215",
  "doubao-seedance-1-5-pro",
  "seedance-1.5-pro",  // alias
]);

const VEO_MODELS = new Set([
  "veo3.1-fast",
  "veo3.1",
  "veo3-fast",
  "veo3",
]);

/** Normalize model aliases to the actual API model name */
function resolveModelName(model: string): string {
  if (model === "seedance-1.5-pro" || model === "doubao-seedance-1-5-pro") {
    return "doubao-seedance-1-5-pro-251215";
  }
  return model;
}

/** Determine which API family a model belongs to */
function isVolcModel(model: string): boolean {
  const resolved = resolveModelName(model);
  return VOLC_MODELS.has(resolved) || resolved.startsWith("doubao-");
}

interface CreateVideoOptions {
  prompt: string;
  imageUrl?: string;        // Keyframe image URL for image-to-video
  model?: string;           // Override model
  aspectRatio?: string;     // "16:9" | "9:16" | "1:1"
  duration?: number;        // Duration in seconds (Seedance: 4/5/10, default 4)
  enhancePrompt?: boolean;
  enableUpsample?: boolean;
}

interface VideoTaskResult {
  taskId: string;
  status: string;
  model: string;
}

interface VideoStatusResult {
  taskId: string;
  status: string;           // Normalized: "pending" | "processing" | "completed" | "failed" | "timeout"
  videoUrl?: string;
  error?: string;
  statusUpdateTime?: number;
}

// ─── Primary entry point ────────────────────────────────────

const PRIMARY_MODEL = "doubao-seedance-1-5-pro-251215";
const FALLBACK_MODEL = "veo3.1-fast";

/**
 * Create a video generation task.
 * Tries primary model first, falls back to fallback model on failure.
 */
export async function createVideoTask(opts: CreateVideoOptions): Promise<VideoTaskResult> {
  const model = opts.model || PRIMARY_MODEL;

  try {
    const result = await callCreateVideo({ ...opts, model });
    return result;
  } catch (e) {
    if (model === PRIMARY_MODEL) {
      const errMsg = e instanceof Error ? e.message : String(e);
      await logWarn("video_gen", `Primary model ${PRIMARY_MODEL} failed: ${errMsg}, falling back to ${FALLBACK_MODEL}`, {
        details: { error: errMsg },
      });
      return callCreateVideo({ ...opts, model: FALLBACK_MODEL });
    }
    throw e;
  }
}

// ─── Unified create dispatcher ──────────────────────────────

async function callCreateVideo(opts: CreateVideoOptions & { model: string }): Promise<VideoTaskResult> {
  if (!YUNWU_KEY) {
    throw new Error("YUNWU_API_KEY not configured");
  }

  const resolved = resolveModelName(opts.model);

  if (isVolcModel(resolved)) {
    return callCreateVideoVolc({ ...opts, model: resolved });
  } else {
    return callCreateVideoVeo({ ...opts, model: resolved });
  }
}

// ─── Volc API (Seedance) ────────────────────────────────────

async function callCreateVideoVolc(opts: CreateVideoOptions & { model: string }): Promise<VideoTaskResult> {
  const body: Record<string, any> = {
    model: opts.model,
    content: [
      { type: "text", text: opts.prompt },
    ],
    ratio: opts.aspectRatio || "16:9",
    duration: opts.duration ?? 4,
    watermark: false,
  };

  // Image-to-video: use first_frame_image
  if (opts.imageUrl) {
    body.first_frame_image = opts.imageUrl;
  }

  const url = `${YUNWU_BASE}/volc/v1/contents/generations/tasks`;

  console.log(`[VideoGen] Volc API: POST ${url} model=${opts.model}`);

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${YUNWU_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Volc video create failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();

  if (!data.id) {
    throw new Error(`Volc video create returned no task ID: ${JSON.stringify(data)}`);
  }

  await logInfo("video_gen", `Volc video task created: ${data.id} (model: ${opts.model})`, {
    details: { taskId: data.id, model: opts.model, prompt: opts.prompt.substring(0, 100) },
  });

  return {
    taskId: data.id,
    status: normalizeStatus(data.status || "submitted"),
    model: opts.model,
  };
}

// ─── VEO API ────────────────────────────────────────────────

async function callCreateVideoVeo(opts: CreateVideoOptions & { model: string }): Promise<VideoTaskResult> {
  const body: Record<string, any> = {
    model: opts.model,
    prompt: opts.prompt,
    enhance_prompt: opts.enhancePrompt ?? true,
    enable_upsample: opts.enableUpsample ?? true,
    aspect_ratio: opts.aspectRatio || "16:9",
  };

  if (opts.imageUrl) {
    body.images = [opts.imageUrl];
  }

  const url = `${YUNWU_BASE}/v1/video/create`;

  console.log(`[VideoGen] VEO API: POST ${url} model=${opts.model}`);

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${YUNWU_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`VEO video create failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();

  if (!data.id) {
    throw new Error(`VEO video create returned no task ID: ${JSON.stringify(data)}`);
  }

  await logInfo("video_gen", `VEO video task created: ${data.id} (model: ${opts.model})`, {
    details: { taskId: data.id, model: opts.model, prompt: opts.prompt.substring(0, 100) },
  });

  return {
    taskId: data.id,
    status: normalizeStatus(data.status || "pending"),
    model: opts.model,
  };
}

// ─── Unified query dispatcher ───────────────────────────────

/**
 * Query the status of a video generation task.
 * Auto-detects Volc vs VEO based on task ID format.
 */
export async function queryVideoStatus(taskId: string): Promise<VideoStatusResult> {
  if (!YUNWU_KEY) {
    throw new Error("YUNWU_API_KEY not configured");
  }

  // Volc task IDs start with "cgt-", VEO task IDs contain model name prefix
  if (taskId.startsWith("cgt-")) {
    return queryVideoStatusVolc(taskId);
  } else {
    return queryVideoStatusVeo(taskId);
  }
}

async function queryVideoStatusVolc(taskId: string): Promise<VideoStatusResult> {
  const url = `${YUNWU_BASE}/volc/v1/contents/generations/tasks/${encodeURIComponent(taskId)}`;

  const resp = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${YUNWU_KEY}`,
      "Accept": "application/json",
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Volc video query failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();

  // Extract video URL from nested content object
  let videoUrl: string | undefined;
  if (data.content && typeof data.content === "object") {
    videoUrl = data.content.video_url;
  }
  if (!videoUrl) {
    videoUrl = data.video_url;
  }

  return {
    taskId: data.id || taskId,
    status: normalizeStatus(data.status || "unknown"),
    videoUrl: videoUrl || undefined,
    error: data.error || data.message || undefined,
    statusUpdateTime: data.updated_at ? data.updated_at * 1000 : undefined,
  };
}

async function queryVideoStatusVeo(taskId: string): Promise<VideoStatusResult> {
  const url = `${YUNWU_BASE}/v1/video/query?id=${encodeURIComponent(taskId)}`;

  const resp = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${YUNWU_KEY}`,
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`VEO video query failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();

  return {
    taskId: data.id || taskId,
    status: normalizeStatus(data.status || "unknown"),
    videoUrl: data.video_url || undefined,
    error: data.error || undefined,
    statusUpdateTime: data.status_update_time || undefined,
  };
}

// ─── Status normalization ───────────────────────────────────

/**
 * Normalize status values from different API families to a common set:
 * "pending" | "processing" | "completed" | "failed" | "unknown"
 */
function normalizeStatus(raw: string): string {
  const s = raw.toLowerCase();
  // Volc statuses
  if (s === "submitted" || s === "pending") return "pending";
  if (s === "running" || s === "processing" || s === "video_generating" || s === "video_upsampling") return "processing";
  if (s === "succeeded" || s === "completed") return "completed";
  if (s === "failed" || s === "error") return "failed";
  return raw;
}

// ─── Polling helper ─────────────────────────────────────────

/**
 * Poll a video task until completion or failure.
 * Returns the final status with video URL if successful.
 */
export async function pollVideoTask(
  taskId: string,
  opts?: { maxAttempts?: number; intervalMs?: number; onProgress?: (status: string) => void }
): Promise<VideoStatusResult> {
  const maxAttempts = opts?.maxAttempts ?? 60;  // 30 minutes at 30s intervals
  const intervalMs = opts?.intervalMs ?? 30000; // 30 seconds

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await queryVideoStatus(taskId);

    if (opts?.onProgress) {
      opts.onProgress(result.status);
    }

    if (result.status === "completed") {
      await logInfo("video_gen", `Video task completed: ${taskId}`, {
        details: { videoUrl: result.videoUrl },
      });
      return result;
    }

    if (result.status === "failed") {
      await logError("video_gen", `Video task failed: ${taskId}`, {
        details: { error: result.error },
      });
      return result;
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return {
    taskId,
    status: "timeout",
    error: `Task did not complete within ${maxAttempts * intervalMs / 1000} seconds`,
  };
}

// ─── Available models list (for frontend) ───────────────────

export const AVAILABLE_VIDEO_MODELS = [
  { id: "doubao-seedance-1-5-pro-251215", name: "Seedance 1.5 Pro", family: "volc", description: "字节跳动 Seedance，高质量视频生成，720p 24fps" },
  { id: "veo3.1-fast", name: "VEO 3.1 Fast", family: "veo", description: "Google VEO 3.1 快速版" },
  { id: "veo3.1", name: "VEO 3.1", family: "veo", description: "Google VEO 3.1 标准版（较慢但质量更高）" },
  { id: "veo3-fast", name: "VEO 3.0 Fast", family: "veo", description: "Google VEO 3.0 快速版" },
  { id: "veo3", name: "VEO 3.0", family: "veo", description: "Google VEO 3.0 标准版" },
];
