/**
 * Video merger service using FFmpeg.
 * Downloads clips, trims to specified duration, and merges into a final video.
 */
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { storagePut } from "./storage";
import { uploadFile } from "./uploadHelper";
import { logInfo, logError } from "./appLogger";

const execAsync = promisify(exec);

// Try to use @ffmpeg-installer/ffmpeg, fall back to system ffmpeg
let ffmpegPath = "ffmpeg";
try {
  const installer = require("@ffmpeg-installer/ffmpeg");
  if (installer?.path) ffmpegPath = installer.path;
} catch {
  // Use system ffmpeg
}

interface ClipInfo {
  panelIndex: number;
  clipUrl: string;
  duration?: number;  // Target duration in seconds (trim to this length)
}

interface MergeResult {
  finalVideoUrl: string;
  totalDuration: number;
}

/**
 * Download a video from URL to a local temp file.
 */
async function downloadVideo(url: string, destPath: string): Promise<void> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to download video: ${resp.status}`);
  const buffer = await resp.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buffer));
}

/**
 * Get video duration using ffprobe.
 */
async function getVideoDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `${ffmpegPath.replace("ffmpeg", "ffprobe")} -v error -show_entries format=duration -of csv=p=0 "${filePath}"`,
      { timeout: 30000 }
    );
    return parseFloat(stdout.trim()) || 0;
  } catch {
    // Fallback: try with system ffprobe
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`,
        { timeout: 30000 }
      );
      return parseFloat(stdout.trim()) || 0;
    } catch {
      return 0;
    }
  }
}

/**
 * Trim a video to a specified duration.
 */
async function trimVideo(inputPath: string, outputPath: string, duration: number): Promise<void> {
  await execAsync(
    `"${ffmpegPath}" -i "${inputPath}" -t ${duration} -c copy -y "${outputPath}"`,
    { timeout: 120000 }
  );
}

/**
 * Merge multiple video clips into a single video.
 * 1. Downloads all clips
 * 2. Trims each to specified duration (if provided)
 * 3. Re-encodes to consistent format
 * 4. Concatenates using FFmpeg concat demuxer
 * 5. Uploads to S3
 */
export async function mergeVideoClips(
  projectId: number,
  clips: ClipInfo[],
): Promise<MergeResult> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "video-merge-"));

  try {
    await logInfo("video_gen", `Starting video merge: ${clips.length} clips`, {
      projectId,
      details: { clipCount: clips.length },
    });

    // Step 1: Download all clips
    const localPaths: string[] = [];
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const ext = ".mp4";
      const rawPath = path.join(tmpDir, `raw_${clip.panelIndex}${ext}`);
      await downloadVideo(clip.clipUrl, rawPath);
      localPaths.push(rawPath);
    }

    // Step 2: Re-encode each clip to consistent format and trim if needed
    const processedPaths: string[] = [];
    let totalDuration = 0;

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const rawPath = localPaths[i];
      const processedPath = path.join(tmpDir, `processed_${clip.panelIndex}.mp4`);

      const rawDuration = await getVideoDuration(rawPath);
      const targetDuration = clip.duration || rawDuration;
      const actualDuration = Math.min(targetDuration, rawDuration);

      // Re-encode to consistent format (H.264 + AAC) with optional trim
      const trimArg = clip.duration ? `-t ${actualDuration}` : "";
      await execAsync(
        `"${ffmpegPath}" -i "${rawPath}" ${trimArg} -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -ar 44100 -ac 2 -r 30 -pix_fmt yuv420p -y "${processedPath}"`,
        { timeout: 300000 }
      );

      processedPaths.push(processedPath);
      totalDuration += actualDuration;
    }

    // Step 3: Create concat file list
    const concatListPath = path.join(tmpDir, "concat_list.txt");
    const concatContent = processedPaths.map(p => `file '${p}'`).join("\n");
    fs.writeFileSync(concatListPath, concatContent);

    // Step 4: Merge using concat demuxer
    const mergedPath = path.join(tmpDir, "final_merged.mp4");
    await execAsync(
      `"${ffmpegPath}" -f concat -safe 0 -i "${concatListPath}" -c copy -y "${mergedPath}"`,
      { timeout: 300000 }
    );

    // Step 5: Upload merged video
    const mergedBuffer = fs.readFileSync(mergedPath);
    const fileName = `final-${Date.now()}.mp4`;
    let url: string;
    try {
      // Try S3 first (for Manus env)
      const result = await storagePut(`projects/${projectId}/videos/${fileName}`, mergedBuffer, "video/mp4");
      url = result.url;
    } catch {
      // Fallback: upload as data URL (video can be large, but it's a fallback)
      const b64 = mergedBuffer.toString("base64");
      url = `data:video/mp4;base64,${b64}`;
    }

    await logInfo("video_gen", `Video merge completed: ${totalDuration.toFixed(1)}s total`, {
      projectId,
      details: { totalDuration, clipCount: clips.length, url },
    });

    return { finalVideoUrl: url, totalDuration };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    await logError("video_gen", `Video merge failed: ${errMsg}`, {
      projectId,
      details: { error: errMsg },
    });
    throw e;
  } finally {
    // Cleanup temp files
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
