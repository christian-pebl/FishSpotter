/**
 * Where a track actually has data inside its clip, and how strongly to draw it.
 *
 * WHY THIS EXISTS
 * ---------------
 * FeedCard's trail renderer historically stretched a track across the WHOLE
 * clip: it mapped video progress 0..1 onto the track's first..last frame. That
 * is correct only while every clip is cut tight around the animal, which was
 * true until the 28 Aug 2026 minimum-duration re-cut. That re-cut widened 53
 * clips (the shortest ran 1.77s, too short to look at before the loop
 * restarted) by adding footage either side of the tracked window. Stretching a
 * track across that padding would drag the trace through frames the animal was
 * never marked in, and slide it off the animal during the part that IS marked.
 *
 * So re-cut clips stamp each point with `t_norm`, its position as a fraction of
 * the clip's duration, and the renderer positions the track absolutely. Outside
 * the tracked window there is no measurement, so the trail fades rather than
 * asserting a position nobody recorded.
 *
 * Points without `t_norm` return null coverage, which means "spans the whole
 * clip" and keeps every pre-re-cut clip on its original behaviour.
 */

/** The minimum a point needs for coverage. Structural, so both BBoxFrame and
 *  TrackPoint satisfy it without importing the component types. */
export interface TimedPoint {
  t_norm?: number;
}

export interface Coverage {
  /** Fraction of the clip's duration where the track starts. */
  start: number;
  /** Fraction of the clip's duration where the track ends. */
  end: number;
}

/**
 * How long the trail takes to fade in/out at the edges of the tracked window,
 * as a fraction of the clip's duration. Long enough to read as a fade rather
 * than a cut, short enough that a 7s clip still shows most of its trail solid.
 */
export const TRACK_FADE_FRACTION = 0.06;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * The window of the clip the track covers, or null when the track carries no
 * position stamps (treat as covering everything).
 */
export function trackCoverage(points: TimedPoint[]): Coverage | null {
  if (points.length === 0) return null;
  const start = points[0].t_norm;
  const end = points[points.length - 1].t_norm;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if ((end as number) <= (start as number)) return null;
  return { start: start as number, end: end as number };
}

/**
 * Trail opacity at a point in the clip: 1 inside the tracked window, ramping to
 * 0 across TRACK_FADE_FRACTION either side of it. Always 1 when coverage is
 * null, so untracked-padding logic never touches the older clips.
 */
export function coverageAlpha(progress: number, coverage: Coverage | null): number {
  if (!coverage) return 1;
  const f = TRACK_FADE_FRACTION;
  if (progress < coverage.start) {
    return clamp01((progress - (coverage.start - f)) / f);
  }
  if (progress > coverage.end) {
    return clamp01((coverage.end + f - progress) / f);
  }
  return 1;
}

/** Is the clip currently inside the tracked window? */
export function inCoverage(progress: number, coverage: Coverage | null): boolean {
  if (!coverage) return true;
  return progress >= coverage.start && progress <= coverage.end;
}
