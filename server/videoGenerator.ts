/**
 * Video generation service using Yunwu API.
 * Supports seedance-1.5-pro (primary) with fallback to kling-v2-6.
 */
import { ENV } from "./_core/env";
import { logInfo, logError, logWarn } from "./appLogger";

const YUNWU_BASE = ENV.yunwuApiUrl || "https://yunwu.ai";
const YUNWU_KEY = ENV.yunwuApiKey;

const PRIMARY_MODEL = "seedance-1.5-pro";
const FALLBACK_MODEL = "kling-v2-6";

interface CreateVideoOptions {
  prompt: string;
  imageUrl?: string;        // Keyframe image URL for image-to-video
  model?: string;           // Override model
  aspectRatio?: string;     // "16:9" | "9:16" | "1:1"
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
  status: string;
  videoUrl?: string;
  error?: string;
  statusUpdateTime?: number;
}

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
      // Fallback to secondary model
      return callCreateVideo({ ...opts, model: FALLBACK_MODEL });
    }
    throw e;
  }
}

async function callCreateVideo(opts: CreateVideoOptions & { model: string }): Promise<VideoTaskResult> {
  if (!YUNWU_KEY) {
    throw new Error("YUNWU_API_KEY not configured");
  }

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

  const resp = await fetch(`${YUNWU_BASE}/v1/video/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${YUNWU_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Video create failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();

  if (!data.id) {
    throw new Error(`Video create returned no task ID: ${JSON.stringify(data)}`);
  }

  await logInfo("video_gen", `Video task created: ${data.id} (model: ${opts.model})`, {
    details: { taskId: data.id, model: opts.model, prompt: opts.prompt.substring(0, 100) },
  });

  return {
    taskId: data.id,
    status: data.status || "pending",
    model: opts.model,
  };
}

/**
 * Query the status of a video generation task.
 */
export async function queryVideoStatus(taskId: string): Promise<VideoStatusResult> {
  if (!YUNWU_KEY) {
    throw new Error("YUNWU_API_KEY not configured");
  }

  const resp = await fetch(`${YUNWU_BASE}/v1/video/query?id=${encodeURIComponent(taskId)}`, {
    headers: {
      "Authorization": `Bearer ${YUNWU_KEY}`,
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Video query failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();

  return {
    taskId: data.id || taskId,
    status: data.status || "unknown",
    videoUrl: data.video_url || undefined,
    error: data.error || undefined,
    statusUpdateTime: data.status_update_time || undefined,
  };
}

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
