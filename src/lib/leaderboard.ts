/**
 * Pure scoring + ranking logic for the leaderboard.
 *
 * Kept separate from the route component so unit tests don't have to spin up
 * Next.js / Prisma. The route is responsible for:
 *   1. Loading raw Answer rows from the DB
 *   2. Reducing into per-user totals (a pre-step for `rankSpotters` below)
 *   3. Stitching display names from the User table
 *
 * The two pieces this module owns:
 *   - `scoreSpotter`: score formula. Pure correct count. The previous
 *     formula (`correct + (total - correct) * 0.5`) rewarded wrong answers
 *     with 0.5 points each — see audit §05 F-LB-02 (P0).
 *   - `rankSpotters`: applies the minimum-answer eligibility gate, sorts
 *     descending, assigns shared ranks for ties (1, 2, 2, 4 style).
 */

export const MIN_ANSWERS_FOR_RANKING = 10;

export interface SpotterCounts {
  userId: string;
  correct: number;
  total: number;
}

export interface RankedSpotter extends SpotterCounts {
  score: number;
  rank: number;
}

export function scoreSpotter(counts: { correct: number; total: number }): number {
  return counts.correct;
}

export function rankSpotters(
  rows: SpotterCounts[],
  minAnswers: number = MIN_ANSWERS_FOR_RANKING,
): RankedSpotter[] {
  // 1. Filter to eligible spotters.
  const eligible = rows.filter((r) => r.total >= minAnswers);

  // 2. Sort by score desc; tie-break by accuracy ratio desc so equal-score
  //    spotters land in a deterministic order across requests.
  const sorted = [...eligible]
    .map((r) => ({ ...r, score: scoreSpotter(r) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const accuracyA = a.total > 0 ? a.correct / a.total : 0;
      const accuracyB = b.total > 0 ? b.correct / b.total : 0;
      if (accuracyB !== accuracyA) return accuracyB - accuracyA;
      // Final stable tiebreak: userId. Same DB state → same order.
      return a.userId.localeCompare(b.userId);
    });

  // 3. Walk the sorted list and assign shared ranks. `1, 2, 2, 4` semantics.
  let prevScore = Number.POSITIVE_INFINITY;
  let currentRank = 0;
  return sorted.map((row, i) => {
    if (row.score < prevScore) {
      currentRank = i + 1;
      prevScore = row.score;
    }
    return { ...row, rank: currentRank };
  });
}
