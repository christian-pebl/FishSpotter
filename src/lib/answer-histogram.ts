/**
 * Histogram bucketing helper shared by `/api/snippets/[id]/stats` and
 * `/leaderboard`'s "Most common species answers" panel (S2-T02 +
 * S2-T20 + S4-02). Groups raw `chosenOption` surface strings by their
 * normalised key, picks a canonical display label per bucket, and
 * returns counts ready for percent calculations.
 *
 * Canonical-label rule:
 *   - If a `preferredCanonical` is supplied (typically the snippet's
 *     `staffAnswer`) and one of the surface forms in a bucket
 *     normalises to it, use the preferred string as-is. This means
 *     the histogram always labels the staff-answer row with the
 *     staff string, not whatever surface form the most users typed.
 *   - Otherwise, the most-frequent surface form wins.
 *   - Ties on surface frequency break via localeCompare (deterministic
 *     across requests).
 */

import { normalizeAnswer } from "@/lib/normalize-answer";

export interface AnswerInput {
  chosenOption: string;
}

export interface HistogramBucket {
  option: string;
  count: number;
}

/**
 * Count-aware variant. Use this when you already have grouped counts
 * (e.g. from a Prisma `groupBy`) — avoids expanding back to one row
 * per answer. (S4-02 leaderboard path.)
 */
export function bucketCountsByNormalized(
  rows: Array<{ chosenOption: string; count: number }>,
  preferredCanonical?: string,
): HistogramBucket[] {
  const preferredKey = preferredCanonical
    ? normalizeAnswer(preferredCanonical)
    : null;
  const buckets = new Map<
    string,
    { count: number; surfaces: Map<string, number> }
  >();

  for (const row of rows) {
    if (!row.chosenOption || row.count <= 0) continue;
    const surface = row.chosenOption.trim();
    const key = normalizeAnswer(surface);
    if (!key) continue;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { count: 0, surfaces: new Map() };
      buckets.set(key, bucket);
    }
    bucket.count += row.count;
    bucket.surfaces.set(
      surface,
      (bucket.surfaces.get(surface) ?? 0) + row.count,
    );
  }

  const out: HistogramBucket[] = [];
  for (const [key, bucket] of buckets) {
    let option: string;
    if (preferredKey && key === preferredKey && preferredCanonical) {
      option = preferredCanonical;
    } else {
      const sortedSurfaces = Array.from(bucket.surfaces.entries()).sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      );
      option = sortedSurfaces[0]?.[0] ?? "";
    }
    out.push({ option, count: bucket.count });
  }
  return out;
}

/**
 * Row-by-row variant — convenient when the input is the raw Answer
 * rows. Internally maps to bucketCountsByNormalized with count=1.
 */
export function bucketAnswersByNormalized(
  answers: AnswerInput[],
  preferredCanonical?: string,
): HistogramBucket[] {
  return bucketCountsByNormalized(
    answers.map((a) => ({ chosenOption: a.chosenOption, count: 1 })),
    preferredCanonical,
  );
}
