/**
 * Pure scoring + ranking logic for the leaderboard.
 *
 * Kept separate from the route component so unit tests don't have to spin up
 * Next.js / Prisma. The route is responsible for:
 *   1. Loading per-user aggregates from the DB (count + sum(points) + correct count)
 *   2. Stitching display names from the User table
 *
 * Scoring model (S7-T1):
 *   - correct match against a reference  = POINTS_CORRECT_REF (2)
 *   - submission on a reference-less clip = POINTS_PENDING_REF (1)
 *   - unmatched guess                     = POINTS_INCORRECT (0)
 *
 * Score on the leaderboard = sum of `Answer.points` per user. The
 * previous correct-count formula (S2-T03) was a special case where
 * pending didn't exist; correct=1, incorrect=0. The new model preserves
 * the *ordering* over the historical answer set when backfilled with
 * the same per-row values, just at a different scale.
 *
 * See audit §05 F-LB-02 (P0) for why the wrong-points-for-wrong-answers
 * formula was retired in S2-T03.
 */

// Every spotter with at least one answer qualifies -- accessibility over
// gatekeeping. Kept at 1 rather than 0 as a defensive floor: the DB
// aggregation this feeds never emits a 0-answer row, but rankSpotters() is
// also called directly with hand-built fixtures in tests.
export const MIN_ANSWERS_FOR_RANKING = 1;

export interface SpotterCounts {
  userId: string;
  correct: number;
  total: number;
  /**
   * Sum of `Answer.points` for this user. When omitted (legacy callers
   * predating S7-T1), falls back to `correct` for backwards compatibility
   * with the previous correct-count score model.
   */
  points?: number;
}

export interface RankedSpotter extends SpotterCounts {
  score: number;
  rank: number;
}

export function scoreSpotter(counts: SpotterCounts): number {
  return counts.points ?? counts.correct;
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
