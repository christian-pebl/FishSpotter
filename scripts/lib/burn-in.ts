/**
 * Burned-in overlay detection for exported snips.
 *
 * WHY THIS EXISTS
 * ---------------
 * TRDesk4 cuts a snip from the "original" video when it can find one, and
 * silently falls back to the ML pipeline's own render when it cannot. Those
 * renders (`*_unified_tracked.mp4`, `*_yolo_tracked_web.mp4`,
 * `*_step2_motion.mp4`) have the detector's output drawn INTO THE PIXELS: a
 * black HUD bar across the top-left reading `FUSED TRACKS (n) Frame N`, plus
 * coloured detection rectangles.
 *
 * On 25 Aug 2026 eleven NORF-1 clips shipped that way. The clips looked normal
 * in every check the pipeline had (H.264, right frame count, complete-looking
 * metadata) because nothing ever looked at the pixels. A player of a
 * species-ID game being shown the machine's answer, drawn on the fish, defeats
 * the entire point of the exercise, and it also poisons any training data cut
 * from the same clip.
 *
 * TRDesk4's own resolution was hardened on 26 Aug 2026 (it now consults
 * `data/clip_registry.json`), but the fallback path still exists for any
 * footage the registry does not know about. This module is the independent
 * second gate on the FishSpotter side, so a burnt-in clip cannot reach the app
 * even if the exporter regresses again.
 *
 * TWO SIGNALS, DELIBERATELY INDEPENDENT
 * -------------------------------------
 *  1. `pipelineRenderName()` reads the provenance TRDesk4 records in
 *     `metadata.source_video_used`. Cheap and exact, but only present on
 *     exports new enough to record it.
 *  2. `detectBurnedInOverlay()` looks at the actual pixels, so it works on any
 *     clip from any era and cannot be fooled by wrong metadata.
 *
 * CALIBRATION
 * -----------
 * A naive "is the top-left dark?" test is NOT usable: murky green underwater
 * footage triggers it constantly (it produced a false positive on a clean live
 * Skye clip during the 28 Aug 2026 investigation). The HUD is specifically a
 * near-black bar CARRYING WHITE MONOSPACE GLYPHS, so both conditions are
 * required together. Measured over the 11 burnt-in NORF-1 clips and their 11
 * clean re-cuts, the two populations separated with no overlap at all:
 *
 *     burnt-in : blackFraction 0.67-0.71, whiteFraction 0.047-0.051
 *     clean    : blackFraction 0.00,      whiteFraction 0.000
 *
 * The thresholds below sit in that gap with wide margin on both sides.
 */
import { spawnSync } from "node:child_process";

/**
 * Filename suffixes the ML pipeline gives its own annotated renders. A snip cut
 * from any of these has detections burned into the pixels. Keep in step with
 * DesktopML's `PIPELINE_RENDER_SUFFIXES` in `track_review_app.py`.
 */
export const PIPELINE_RENDER_SUFFIXES = [
  "_unified_tracked",
  "_yolo_tracked_web",
  "_step2_motion",
] as const;

/** Region of the frame the HUD occupies, in pixels from the top-left corner. */
const BAND_W = 500;
const BAND_H = 26;

/** A pixel this dark counts as HUD background; this bright counts as glyph. */
const BLACK_LEVEL = 30;
const WHITE_LEVEL = 190;

/** Fractions of the band that must be background and glyph for a HUD verdict. */
const MIN_BLACK_FRACTION = 0.55;
const MIN_WHITE_FRACTION = 0.015;

/** A clip is condemned when at least this share of sampled frames show a HUD. */
const MIN_HUD_FRAME_SHARE = 0.5;

/** How many frames to sample, and how far apart, when the count is unknown. */
const DEFAULT_SAMPLES = 12;
const DEFAULT_STEP = 10;

export type BurnInStatus = "clean" | "burned-in" | "unknown";

export interface BurnInResult {
  status: BurnInStatus;
  /** Human-readable explanation, safe to print straight into a report. */
  reason: string;
  sampledFrames: number;
  hudFrames: number;
  /** Strongest per-frame measurements seen, for debugging a borderline call. */
  maxBlackFraction: number;
  maxWhiteFraction: number;
}

/**
 * True if `name` looks like one of the pipeline's annotated renders. Accepts a
 * bare name, a filename with extension, or a full path.
 */
export function pipelineRenderName(name: string | null | undefined): boolean {
  if (!name) return false;
  const base = name.replace(/\\/g, "/").split("/").pop() ?? name;
  const stem = base.replace(/\.[^.]+$/, "").toLowerCase();
  return PIPELINE_RENDER_SUFFIXES.some((s) => stem.endsWith(s));
}

/**
 * Classify one sampled band. Exported so the calibration is unit-testable
 * without needing ffmpeg or a real video.
 */
export function isHudBand(blackFraction: number, whiteFraction: number): boolean {
  return blackFraction >= MIN_BLACK_FRACTION && whiteFraction >= MIN_WHITE_FRACTION;
}

/** Per-band black/white fractions from a greyscale buffer of `count` bands. */
export function measureBands(
  gray: Buffer,
  bandW: number,
  bandH: number,
): { black: number; white: number }[] {
  const perBand = bandW * bandH;
  if (perBand <= 0) return [];
  const out: { black: number; white: number }[] = [];
  const count = Math.floor(gray.length / perBand);
  for (let i = 0; i < count; i++) {
    let black = 0;
    let white = 0;
    const start = i * perBand;
    for (let p = start; p < start + perBand; p++) {
      const v = gray[p];
      if (v < BLACK_LEVEL) black++;
      else if (v > WHITE_LEVEL) white++;
    }
    out.push({ black: black / perBand, white: white / perBand });
  }
  return out;
}

function probeDimensions(videoPath: string): { w: number; h: number } | null {
  const r = spawnSync(
    "ffprobe",
    [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height",
      "-of", "csv=p=0",
      videoPath,
    ],
    { encoding: "utf-8" },
  );
  if (r.error || r.status !== 0) return null;
  const [w, h] = r.stdout.trim().split(",").map((n) => parseInt(n, 10));
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { w, h };
}

/**
 * Look at the pixels of `videoPath` and decide whether a detector HUD is burned
 * into them.
 *
 * Returns `unknown` (never `burned-in`) when ffmpeg/ffprobe are unavailable or
 * the clip cannot be decoded, so a missing toolchain degrades to a warning
 * rather than silently blocking every upload. Callers decide how strict to be.
 */
export function detectBurnedInOverlay(
  videoPath: string,
  opts: { expectedFrames?: number; samples?: number } = {},
): BurnInResult {
  const empty = { sampledFrames: 0, hudFrames: 0, maxBlackFraction: 0, maxWhiteFraction: 0 };

  const dims = probeDimensions(videoPath);
  if (!dims) {
    return { status: "unknown", reason: "ffprobe unavailable or clip unreadable", ...empty };
  }
  const bandW = Math.min(BAND_W, dims.w);
  const bandH = Math.min(BAND_H, dims.h);
  if (bandW < 40 || bandH < 8) {
    return { status: "unknown", reason: `frame too small to inspect (${dims.w}x${dims.h})`, ...empty };
  }

  // Spread the samples across the clip when we know how long it is, so a HUD
  // that only appears partway through is still caught.
  const samples = opts.samples ?? DEFAULT_SAMPLES;
  const step =
    opts.expectedFrames && opts.expectedFrames > samples
      ? Math.max(1, Math.floor(opts.expectedFrames / samples))
      : DEFAULT_STEP;

  const r = spawnSync(
    "ffmpeg",
    [
      "-v", "error",
      "-i", videoPath,
      "-vf", `select='not(mod(n\\,${step}))',crop=${bandW}:${bandH}:0:0`,
      "-fps_mode", "passthrough",
      "-frames:v", String(samples),
      "-f", "rawvideo",
      "-pix_fmt", "gray",
      "-",
    ],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  if (r.error || r.status !== 0 || !r.stdout || r.stdout.length === 0) {
    return { status: "unknown", reason: "ffmpeg unavailable or produced no frames", ...empty };
  }

  const bands = measureBands(r.stdout, bandW, bandH);
  if (bands.length === 0) {
    return { status: "unknown", reason: "no frames sampled", ...empty };
  }

  const hudFrames = bands.filter((b) => isHudBand(b.black, b.white)).length;
  const maxBlackFraction = Math.max(...bands.map((b) => b.black));
  const maxWhiteFraction = Math.max(...bands.map((b) => b.white));
  const share = hudFrames / bands.length;
  const stats =
    `${hudFrames}/${bands.length} sampled frames carry a detector HUD ` +
    `(black ${maxBlackFraction.toFixed(2)}, white ${maxWhiteFraction.toFixed(3)})`;

  return {
    status: share >= MIN_HUD_FRAME_SHARE ? "burned-in" : "clean",
    reason: share >= MIN_HUD_FRAME_SHARE ? stats : `no detector HUD found (${stats})`,
    sampledFrames: bands.length,
    hudFrames,
    maxBlackFraction,
    maxWhiteFraction,
  };
}

/**
 * Full burn-in verdict for one snip: the recorded provenance first (cheap and
 * exact when present), then the pixels.
 */
export function checkSnipBurnIn(
  videoPath: string,
  meta: Record<string, unknown> = {},
): BurnInResult {
  const source = typeof meta.source_video_used === "string" ? meta.source_video_used : null;
  if (pipelineRenderName(source)) {
    return {
      status: "burned-in",
      reason: `metadata says it was cut from a pipeline render (${source})`,
      sampledFrames: 0,
      hudFrames: 0,
      maxBlackFraction: 0,
      maxWhiteFraction: 0,
    };
  }
  const expectedFrames =
    typeof meta.clip_duration_frames === "number" ? meta.clip_duration_frames : undefined;
  return detectBurnedInOverlay(videoPath, { expectedFrames });
}
