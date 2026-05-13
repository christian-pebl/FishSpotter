// Derive smart pre-fill suggestions for the ID Guide from a clip's bbox track.
// Pure function — easy to unit-test.

import type { Answers } from "./id-guide-questions";

export interface BBoxLike {
  frame_clip: number;
  x_norm: number;
  y_norm: number;
  w_norm: number;
  h_norm: number;
}

/** Tunables — kept here as named constants so the unit tests can pin behaviour. */
export const PREFILL_THRESHOLDS = {
  // screenZone: mean centre y across the track
  SEABED_Y: 0.65,    // y > this → seabed
  SURFACE_Y: 0.35,   // y < this → surface
  // locomotion: per-frame mean step distance, normalised
  STATIONARY: 0.001,    // < this → "stationary"
  CRAWLING_MAX: 0.008,  // < this AND on seabed → "crawling"
  SWIMMING_MIN: 0.003,  // ≥ this → "swimming" (or darting if bursty)
  DARTING_CV: 1.5,      // coefficient of variation > this → "darting"
} as const;

/**
 * Compute centre point of a bbox (already normalised to 0..1 video coords).
 */
function centre(b: BBoxLike): { x: number; y: number } {
  return { x: b.x_norm + b.w_norm / 2, y: b.y_norm + b.h_norm / 2 };
}

/**
 * Returns suggested values for `screenZone` and/or `locomotion` based on the bbox track.
 * Returns an empty object for empty / single-frame / null tracks.
 *
 * Suggestions are intentionally conservative — when the data is ambiguous we omit
 * the suggestion rather than guess wrong. The user always confirms by tapping.
 */
export function deriveIdGuidePrefill(bboxes: BBoxLike[] | null | undefined): Partial<Answers> {
  if (!bboxes || bboxes.length === 0) return {};

  const centres = bboxes.map(centre);

  // ── screenZone from mean centre y (works with even a single frame) ───────
  const meanY = centres.reduce((acc, p) => acc + p.y, 0) / centres.length;
  let screenZone: string | undefined;
  if (meanY >= PREFILL_THRESHOLDS.SEABED_Y) screenZone = "seabed";
  else if (meanY <= PREFILL_THRESHOLDS.SURFACE_Y) screenZone = "surface";
  else screenZone = "midwater";

  // ── locomotion from path geometry (needs ≥2 frames; otherwise omit) ──────
  if (bboxes.length < 2) {
    return screenZone ? { screenZone } : {};
  }
  const stepDists: number[] = [];
  for (let i = 1; i < centres.length; i++) {
    const dx = centres[i].x - centres[i - 1].x;
    const dy = centres[i].y - centres[i - 1].y;
    stepDists.push(Math.hypot(dx, dy));
  }
  const meanStep = stepDists.reduce((a, d) => a + d, 0) / stepDists.length;
  const variance =
    stepDists.reduce((a, d) => a + (d - meanStep) ** 2, 0) / stepDists.length;
  const stdev = Math.sqrt(variance);
  const cv = meanStep > 0 ? stdev / meanStep : 0; // coefficient of variation

  let locomotion: string | undefined;
  if (meanStep < PREFILL_THRESHOLDS.STATIONARY) {
    locomotion = "stationary";
  } else if (
    meanY >= 0.55 &&
    meanStep < PREFILL_THRESHOLDS.CRAWLING_MAX
  ) {
    locomotion = "crawling";
  } else if (
    cv > PREFILL_THRESHOLDS.DARTING_CV &&
    meanStep >= PREFILL_THRESHOLDS.SWIMMING_MIN
  ) {
    locomotion = "darting";
  } else if (meanStep >= PREFILL_THRESHOLDS.SWIMMING_MIN) {
    locomotion = "swimming";
  }
  // Else: ambiguous (low motion that's not on the seabed) — leave undefined

  const out: Partial<Answers> = {};
  if (screenZone) out.screenZone = screenZone;
  if (locomotion) out.locomotion = locomotion;
  return out;
}
