/**
 * The 720p feed rendition: a second, smaller encode of every clip, served to
 * viewers whose screen cannot show more detail anyway.
 *
 * Why this exists (7 Sep 2026). The load-performance benchmark found the site
 * media-bound, and feed clips are the single biggest thing a spotter
 * downloads: 3.4 to 10.5 Mbps at 1080p, ~8.8 MB for a ~7 second clip. Every
 * live clip is 1920x1080 (the H.264 export invariant only constrains the
 * codec, not the resolution), so a phone viewport, which can show at most a
 * few hundred CSS pixels of width, downloads four to nine times the pixels it
 * can ever paint.
 *
 * The setting was chosen by measurement, not a round number. Three real
 * clips (a calm reef shot, a fast-moving fish, a busier scene) were encoded
 * at 720p, CRF 20/22/24, slow preset, and scored against the 1080p source
 * with SSIM:
 *
 *   CRF 20: 0.983-0.991 SSIM, 3.7-5.6x smaller
 *   CRF 22: 0.980-0.989 SSIM, 5.6-9.3x smaller
 *   CRF 24: 0.977-0.988 SSIM, 8.6-15.3x smaller
 *
 * All three are excellent by the usual "visually lossless" bar (SSIM > 0.95).
 * CRF 20 was chosen anyway, and it matters WHY: this app's whole "Spot It"
 * flow asks a viewer to read small diagnostic features (a barbel, a spot
 * pattern, a fin ray count) off the clip, which is a stricter bar than most
 * video products need to clear. The SD rendition is also only ever served
 * where it cannot cost that: see `chooseVideoSrc` in
 * `src/lib/video-rendition-select.ts`, which keeps the full 1080p master for
 * every desktop viewer (docked-panel width, comfortable zoom, more likely to
 * be doing careful identification work) and serves SD only on a phone
 * viewport, where the screen could not show 1080p detail regardless of which
 * file was downloaded.
 *
 * `-fps_mode passthrough` keeps the encode frame-for-frame identical in
 * count and timing to the source (verified: 240/240, 211/211, 168/168 frames
 * on the three test clips), which is what a caller should assert too: the
 * bbox/manual-track trail is a normalised (x, y, t) path, resolution-
 * independent, but only correct if the SD rendition's duration and frame
 * timing exactly match the master it was measured against.
 */

import { execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export const SD_RENDITION_HEIGHT = 720;
/** The encoded width for a 16:9 clip at SD_RENDITION_HEIGHT (`scale=-2:720`
 *  on 1920x1080 source). Every live clip is 16:9, so this is exact, not an
 *  estimate; `src/lib/video-rendition-select.ts` uses it as the "how much
 *  display width does this rendition actually cover" figure. */
export const SD_RENDITION_WIDTH = 1280;
const CRF = 20;
const PRESET = "slow";

export type EncodeResult =
  | { ok: true; buffer: Buffer; frames: number; bytes: number }
  | { ok: false; reason: string };

function ffmpegAvailable(): boolean {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function ffprobeFrameCount(filePath: string): number | null {
  const r = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-count_frames",
      "-show_entries",
      "stream=nb_read_frames",
      "-of",
      "csv=p=0",
      filePath,
    ],
    { encoding: "utf8", timeout: 30_000 },
  );
  if (r.status !== 0) return null;
  const n = parseInt(r.stdout.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

let ffmpegChecked: boolean | null = null;

/** Cached: `ffmpeg -version` is a real process spawn, worth asking once per run. */
export function hasFfmpeg(): boolean {
  if (ffmpegChecked === null) ffmpegChecked = ffmpegAvailable();
  return ffmpegChecked;
}

/**
 * Encode `sourcePath` (a local 1080p H.264 file) to the 720p rendition and
 * return its bytes. Verifies the encode succeeded, is non-empty, and carries
 * the SAME frame count as the source (see the module doc: this is what
 * guarantees the trail stays aligned). Never throws; a caller should treat
 * `{ ok: false }` as "leave the SD rendition unset, fall back to the master"
 * rather than aborting a batch.
 */
export function encodeSdRendition(sourcePath: string): EncodeResult {
  if (!hasFfmpeg()) return { ok: false, reason: "ffmpeg is not on PATH" };
  if (!fs.existsSync(sourcePath)) return { ok: false, reason: `source not found: ${sourcePath}` };

  const sourceFrames = ffprobeFrameCount(sourcePath);
  if (sourceFrames === null) return { ok: false, reason: "ffprobe could not read the source frame count" };

  const tmpOut = path.join(os.tmpdir(), `fs-sd-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);
  try {
    const r = spawnSync(
      "ffmpeg",
      [
        "-y",
        "-i",
        sourcePath,
        "-vf",
        `scale=-2:${SD_RENDITION_HEIGHT}:flags=lanczos`,
        "-c:v",
        "libx264",
        "-preset",
        PRESET,
        "-crf",
        String(CRF),
        "-profile:v",
        "high",
        "-level",
        "4.0",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-an", // the feed plays every clip muted; no point shipping audio twice
        "-fps_mode",
        "passthrough",
        tmpOut,
      ],
      { encoding: "utf8", timeout: 120_000 },
    );
    if (r.status !== 0 || !fs.existsSync(tmpOut)) {
      return { ok: false, reason: `ffmpeg exited ${r.status}: ${(r.stderr || "").slice(-300)}` };
    }
    const bytes = fs.statSync(tmpOut).size;
    if (bytes === 0) return { ok: false, reason: "ffmpeg produced an empty file" };

    const outFrames = ffprobeFrameCount(tmpOut);
    if (outFrames !== sourceFrames) {
      return {
        ok: false,
        reason: `frame count mismatch: source ${sourceFrames}, rendition ${outFrames} (would desync the trail)`,
      };
    }

    return { ok: true, buffer: fs.readFileSync(tmpOut), frames: outFrames, bytes };
  } catch (e) {
    return { ok: false, reason: `ffmpeg threw: ${String(e).slice(0, 200)}` };
  } finally {
    if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
  }
}
