/**
 * Feed ordering (S8-T1).
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
 * Pure module — no Prisma, no Next, no DOM — so it's trivial to test.
 */

import { hashStringToSeed, mulberry32, shuffle } from "@/lib/shuffle";

export interface OrderableSnippet {
  id: string;
}

export function orderFeed<T extends OrderableSnippet>(
  snippets: T[],
  answeredIds: Set<string>,
  seed: string,
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
  return [...shuffle(unanswered, rng), ...shuffle(answered, rng)];
}
