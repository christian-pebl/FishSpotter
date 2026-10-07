/**
 * The rules that turn "a clip was on screen" into watch time, shared by the
 * browser tracker (src/lib/engagement.ts) and the metrics that sum it
 * (src/lib/metrics/series.ts, roundup.ts).
 *
 * Why these exist: the tracker used to bank every second a clip was the active
 * card in a visible tab, with no check that anyone was there. Clips loop, so a
 * tab left open kept counting. On 28 to 29 Aug 2026 one signed-out tab logged
 * 1,151 minutes, 41% of the 90-day total, on what the funder chart showed as
 * the busiest day of the summer. Two guards fix it, one at each end:
 *
 *   - In the browser, time only counts until WATCH_IDLE_AFTER_MS after the last
 *     input, and no single banked segment can exceed WATCH_MAX_SEGMENT_SECONDS
 *     (a laptop that slept on the feed used to bank the whole sleep at once).
 *   - In the metrics, one tab can count at most WATCH_CAP_PER_CLIP_SECONDS on
 *     any one clip. That also cleans up rows logged before the browser fix.
 */

/** Stop counting this long after the last tap, swipe, key or scroll. */
export const WATCH_IDLE_AFTER_MS = 2 * 60 * 1000;

/**
 * Longest single segment the browser will bank. The tracker flushes every 25 s,
 * so a real segment is never longer; anything above this is a sleep or a stall.
 */
export const WATCH_MAX_SEGMENT_SECONDS = 30;

/** Most watch time one tab (session) can count on one clip, in the metrics. */
export const WATCH_CAP_PER_CLIP_SECONDS = 5 * 60;

/**
 * Seconds a watch segment may bank: from its start to now, but not past the
 * idle cut-off, and never more than WATCH_MAX_SEGMENT_SECONDS. All times are
 * epoch milliseconds.
 */
export function countableWatchSeconds(segmentStart: number, now: number, lastInputAt: number): number {
  const end = Math.min(now, lastInputAt + WATCH_IDLE_AFTER_MS);
  const seconds = (end - segmentStart) / 1000;
  if (seconds <= 0) return 0;
  return Math.min(seconds, WATCH_MAX_SEGMENT_SECONDS);
}

/** True once the viewer has gone quiet for longer than the idle cut-off. */
export function isWatchIdle(now: number, lastInputAt: number): boolean {
  return now - lastInputAt > WATCH_IDLE_AFTER_MS;
}

export interface WatchRow {
  createdAt: Date;
  /** Seconds banked by this row; null counts as zero. */
  value: number | null;
  sessionId: string;
  snippetId: string | null;
}

/**
 * The seconds each row may contribute once a tab's time on any one clip is
 * capped at WATCH_CAP_PER_CLIP_SECONDS. The first five minutes count, in the
 * order they were logged, and later rows for that tab and clip count zero, so
 * a day-by-day chart keeps the real viewing on the day it happened.
 *
 * Returns one number per input row, aligned to the input order (which need not
 * be sorted). A row without a clip id is capped per tab.
 */
export function cappedWatchSeconds(rows: readonly WatchRow[]): number[] {
  const order = rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => a.row.createdAt.getTime() - b.row.createdAt.getTime() || a.index - b.index);

  const used = new Map<string, number>();
  const out = new Array<number>(rows.length).fill(0);
  for (const { row, index } of order) {
    const seconds = Math.max(0, row.value ?? 0);
    if (seconds === 0) continue;
    const key = `${row.sessionId}\u0000${row.snippetId ?? ""}`;
    const sofar = used.get(key) ?? 0;
    const allowed = Math.min(seconds, Math.max(0, WATCH_CAP_PER_CLIP_SECONDS - sofar));
    used.set(key, sofar + allowed);
    out[index] = allowed;
  }
  return out;
}
