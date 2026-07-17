/**
 * Feed ordering (S8-T1, difficulty ramp added Jul 2026).
 *
 * Given the full snippet list, the set of snippet IDs the current viewer
 * has already answered, and a seed, returns the ordered feed:
 *
 *   1. Unanswered snippets first, shuffled deterministically by the seed.
 *   2. Answered snippets after, also shuffled by the same seed.
 *
 * Why two-tier:
 *   - The first card a user sees should be one they haven't labelled.
 *   - But we don't want a dead end when they've answered everything —
 *     they can keep scrolling and revisit past clips.
 *
 * Seed contract:
 *   - Signed-in users: `session.user.id` so the order is stable per user.
 *   - Anonymous users: an `fs.anon_seed` cookie minted by middleware,
 *     stable across reloads in the same browser.
 *
 * Difficulty ramp (optional `readiness` param): within the unanswered tier,
 * after the plain shuffle, softly re-weight toward easy clips for brand-new
 * spotters and toward harder ones as they gain experience — see
 * src/lib/difficulty.ts for the band logic. This is additive and backward
 * compatible: if `readiness` is omitted, or a snippet has no
 * `difficultyScore`, ordering is exactly the plain shuffle as before.
 * `difficultyScore` is currently seeded intrinsically (apparent organism
 * size — see scripts/seed-difficulty.ts); migrating it toward an empirical,
 * answer-accuracy-derived score is a natural follow-up once there's enough
 * per-clip answer volume to trust (there isn't yet — most snippets have a
 * handful of answers at most).
 *
 * Pure module — no Prisma, no Next, no DOM — so it's trivial to test.
 */

import { hashStringToSeed, mulberry32, shuffle } from "@/lib/shuffle";
import { bandWeightsForReadiness, weightedBandOrder, type DifficultyRateable } from "@/lib/difficulty";

export interface OrderableSnippet {
  id: string;
}

export interface OrderFeedOptions {
  /** 0 (brand new) .. 1 (ramped up). Omit to skip difficulty weighting entirely. */
  readiness?: number;
}

export function orderFeed<T extends OrderableSnippet>(
  snippets: T[],
  answeredIds: Set<string>,
  seed: string,
  options?: OrderFeedOptions,
): T[] {
  if (snippets.length === 0) return [];

  const unanswered: T[] = [];
  const answered: T[] = [];
  for (const s of snippets) {
    if (answeredIds.has(s.id)) {
      answered.push(s);
    } else {
      unanswered.push(s);
    }
  }

  // One RNG instance, consumed in order across both shuffles. This means
  // shifting a snippet from "unanswered" to "answered" (after the user
  // submits) doesn't reshuffle the unanswered tail in a way that would
  // jumble the user's mental position — the unanswered shuffle is
  // computed against the same seed regardless of the answered set size.
  const rng = mulberry32(hashStringToSeed(seed));
  const shuffledUnanswered = shuffle(unanswered, rng);
  const shuffledAnswered = shuffle(answered, rng);

  const readiness = options?.readiness;
  const orderedUnanswered =
    readiness == null || !hasDifficultyScores(shuffledUnanswered)
      ? shuffledUnanswered
      : weightedBandOrder(shuffledUnanswered, bandWeightsForReadiness(readiness), rng);

  return [...orderedUnanswered, ...shuffledAnswered];
}

function hasDifficultyScores<T>(items: T[]): items is (T & DifficultyRateable)[] {
  return items.every((i) => typeof (i as { difficultyScore?: unknown }).difficultyScore === "number");
}
