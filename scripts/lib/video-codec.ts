/**
 * Codec gate for exported snips.
 *
 * WHY THIS EXISTS
 * ---------------
 * Chrome cannot decode MPEG-4 Part 2 Visual (ffprobe calls it `mpeg4`, the
 * fourcc is `mp4v`). A clip encoded that way uploads cleanly, serves a healthy
 * HTTP 206 from storage, and then renders as "This clip didn't load." in the
 * feed. Nothing between the exporter and the browser notices.
 *
 * TRDesk4's `SnippetExporter` pipes frames to `ffmpeg -c:v libx264`, but only
 * when `shutil.which("ffmpeg")` resolves; otherwise it logs a warning and falls
 * back to `cv2.VideoWriter('mp4v')`. On 28 Aug 2026 that fallback fired for the
 * whole Car-Y-Mor batch, and all 52 CYM clips went live unplayable. The warning
 * went into a log file nobody was reading, which is the same failure shape as
 * the blank-metadata and burnt-in-overlay incidents three days earlier.
 *
 * So the codec is now checked on the FishSpotter side too, before upload. The
 * app has a post-hoc guard already (`npm run check:codecs`, which probes live DB
 * URLs), but that runs after the clips are public. This one runs before.
 *
 * WHAT COUNTS AS PLAYABLE
 * -----------------------
 * H.264 only, deliberately. That is the standing invariant in CLAUDE.md
 * ("Video / Codec Notes") and what every clip in the catalogue is encoded as.
 * HEVC and AV1 are technically playable in some browsers and are still refused
 * here: widening the set is a product decision, not something a sync should
 * infer from whatever the exporter happened to emit.
 *
 * MISSING TOOLCHAIN VERSUS BROKEN FILE
 * ------------------------------------
 * Both look like "ffprobe returned nothing", and they are not the same problem.
 * No ffprobe on PATH means the gate cannot run, and freezing every sync over a
 * missing dev tool is worse than the risk, so that yields `unknown` and a
 * warning (the same fail-open rule as the burn-in gate). But ffprobe present and
 * failing on ONE file means that file is not decodable, which is the exact
 * condition the gate is for: two of the Car-Y-Mor exports had no moov atom at
 * all. That yields `unplayable` and a hold.
 */
import { spawnSync } from "node:child_process";

/** Codecs a snip may ship with. ffprobe's `codec_name` spelling. */
export const PLAYABLE_VIDEO_CODECS = ["h264"] as const;

export type CodecStatus = "ok" | "unplayable" | "unknown";

export interface CodecResult {
  status: CodecStatus;
  /** ffprobe's codec_name, or null when the probe could not run. */
  codec: string | null;
  reason: string;
}

/** Pure predicate, unit-tested. */
export function isPlayableCodec(codec: string | null | undefined): boolean {
  if (!codec) return false;
  return (PLAYABLE_VIDEO_CODECS as readonly string[]).includes(codec.trim().toLowerCase());
}

/** Is ffprobe callable at all? Cached: the answer cannot change mid-run. */
let ffprobeAvailable: boolean | null = null;
export function hasFfprobe(): boolean {
  if (ffprobeAvailable === null) {
    const r = spawnSync("ffprobe", ["-version"], { encoding: "utf-8" });
    ffprobeAvailable = !r.error && r.status === 0;
  }
  return ffprobeAvailable;
}

/**
 * Read the video stream's codec name. Returns null when ffprobe is absent or
 * the file cannot be parsed; use `hasFfprobe()` to tell those two apart.
 */
export function probeVideoCodec(videoPath: string): string | null {
  const r = spawnSync(
    "ffprobe",
    [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=codec_name",
      "-of", "csv=p=0",
      videoPath,
    ],
    { encoding: "utf-8" },
  );
  if (r.error || r.status !== 0) return null;
  const name = r.stdout.trim().split(/\r?\n/)[0]?.trim();
  return name ? name.toLowerCase() : null;
}

/**
 * Gate one snip on its codec.
 *
 * Returns `unknown` (never `unplayable`) when ffprobe cannot run, matching the
 * burn-in gate: a missing toolchain degrades to a warning rather than freezing
 * every sync. Callers decide how strict to be.
 */
export function checkSnipCodec(videoPath: string): CodecResult {
  if (!hasFfprobe()) {
    return {
      status: "unknown",
      codec: null,
      reason: "ffprobe is not on PATH, so the codec could not be checked",
    };
  }
  const codec = probeVideoCodec(videoPath);
  if (codec === null) {
    // ffprobe works, but not on this file. A truncated or headerless MP4 will
    // not play either, so hold it rather than waving it through.
    return {
      status: "unplayable",
      codec: null,
      reason: "ffprobe could not read a video stream (truncated or corrupt file?)",
    };
  }
  if (isPlayableCodec(codec)) {
    return { status: "ok", codec, reason: `${codec}, browser-playable` };
  }
  const hint =
    codec === "mpeg4"
      ? "MPEG-4 Part 2 (mp4v), which Chrome cannot decode; TRDesk4 fell back to " +
        "the cv2 mp4v writer because ffmpeg was not on its PATH"
      : `not ${PLAYABLE_VIDEO_CODECS.join("/")}`;
  return { status: "unplayable", codec, reason: `${codec}: ${hint}` };
}
