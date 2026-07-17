/**
 * Difficulty ladder (Jul 2026): give brand-new spotters clear, easy clips to
 * build confidence, then gradually mix in harder/more cryptic ones as they
 * gain experience. Pure module — no Prisma, no Next — so it composes with
 * feed-ordering.ts (which is likewise pure) and is trivially unit-testable.
 *
 * Two pieces:
 *   1. `readinessFromAnsweredCount` — how "ramped up" a spotter is, 0..1.
 *   2. `bandWeightsForReadiness` + `weightedBandOrder` — turn readiness into
 *      an ordering that skews toward easy early and toward hard later,
 *      without ever hard-excluding a band (no dead ends, same principle as
 *      the existing unanswered/answered split in feed-ordering.ts).
 *
 * Snippet.difficultyScore is corpus-relative: 1 = easiest, 0 = hardest (see
 * scripts/seed-difficulty.ts for how it's derived). Bands are fixed
 * thresholds on that 0..1 score rather than a live tertile split, since the
 * score is already seeded as a roughly uniform percentile.
 */

export interface DifficultyRateable {
  id: string;
  difficultyScore: number;
}

export type DifficultyBand = "easy" | "medium" | "hard";

/** difficultyScore >= this = easy; below HARD_MAX = hard; between = medium. */
export const EASY_MIN = 2 / 3;
export const HARD_MAX = 1 / 3;

export function bandForScore(score: number): DifficultyBand {
  if (score >= EASY_MIN) return "easy";
  if (score < HARD_MAX) return "hard";
  return "medium";
}

/** Clips answered before a spotter is considered "fully ramped" (readiness = 1). */
export const RAMP_CLIPS = 15;

/**
 * 0 = brand new (favour easy heavily), 1 = experienced (favour hard more).
 * Linear ramp over RAMP_CLIPS answered clips. Deliberately clips-seen, not
 * accuracy — a simple, hard-to-game signal that's enough for a first cut;
 * accuracy-weighted readiness is a natural follow-up once there's answer
 * volume to trust (see feed-ordering.ts doc comment).
 */
export function readinessFromAnsweredCount(answeredCount: number): number {
  if (answeredCount <= 0) return 0;
  if (answeredCount >= RAMP_CLIPS) return 1;
  return answeredCount / RAMP_CLIPS;
}

export interface BandWeights {
  easy: number;
  medium: number;
  hard: number;
}

// Endpoints of the ramp. At readiness=0 a new spotter's feed is dominated by
// easy clips (but never exclusively — a little medium keeps the feed from
// feeling repetitive, and zero-hard avoids a bad first impression). At
// readiness=1, hard clips lead but easy/medium stay in the mix so the feed
// never becomes a wall of cryptic clips either.
const WEIGHTS_AT_START: BandWeights = { easy: 0.7, medium: 0.25, hard: 0.05 };
const WEIGHTS_AT_RAMPED: BandWeights = { easy: 0.15, medium: 0.35, hard: 0.5 };

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function bandWeightsForReadiness(readiness: number): BandWeights {
  const t = Math.min(1, Math.max(0, readiness));
  return {
    easy: lerp(WEIGHTS_AT_START.easy, WEIGHTS_AT_RAMPED.easy, t),
    medium: lerp(WEIGHTS_AT_START.medium, WEIGHTS_AT_RAMPED.medium, t),
    hard: lerp(WEIGHTS_AT_START.hard, WEIGHTS_AT_RAMPED.hard, t),
  };
}

/**
 * Order `items` (already shuffled — see feed-ordering.ts) so the FRONT of
 * the list is weighted toward bands the spotter is ready for, per
 * `weights`, while every item still appears exactly once. Soft, not a hard
 * filter or exclusion: implemented as a weighted draw (consuming `rng` once
 * per pick) from whichever bands still have items, falling back to
 * whatever's left once a band empties out. Deterministic for a given
 * (items order, weights, rng) — same seed always yields the same order.
 */
export function weightedBandOrder<T extends DifficultyRateable>(
  items: T[],
  weights: BandWeights,
  rng: () => number,
): T[] {
  if (items.length === 0) return [];

  const queues: Record<DifficultyBand, T[]> = { easy: [], medium: [], hard: [] };
  for (const item of items) {
    queues[bandForScore(item.difficultyScore)].push(item);
  }

  const order: DifficultyBand[] = ["easy", "medium", "hard"];
  const result: T[] = [];

  while (result.length < items.length) {
    const available = order.filter((b) => queues[b].length > 0);
    const totalWeight = available.reduce((sum, b) => sum + weights[b], 0);

    let chosen: DifficultyBand;
    if (totalWeight <= 0) {
      // All remaining weights are zero (shouldn't happen given the fixed
      // endpoints above, but stay correct regardless) — just drain in a
      // fixed order rather than divide by zero.
      chosen = available[0];
    } else {
      let roll = rng() * totalWeight;
      chosen = available[available.length - 1];
      for (const b of available) {
        roll -= weights[b];
        if (roll <= 0) {
          chosen = b;
          break;
        }
      }
    }

    result.push(queues[chosen].shift() as T);
  }

  return result;
}
