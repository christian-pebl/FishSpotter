/**
 * Feed ordering (S8-T1; strict-exclusion revision 2026-06-18).
 *
 * Given the full snippet list, the set of snippet IDs the current viewer
 * has already answered, and a seed, returns ONLY the snippets the viewer
 * has NOT answered yet, shuffled deterministically by the seed.
 *
 * Strict exclusion ("only new videos are served"):
 *   - A snippet a user has answered is "seen" and is never served to them
 *     again on a fresh page load. The set of answered IDs is the per-user
 *     history (the `Answer` table, `@@unique([userId, snippetId])`).
 *   - When a signed-in user has answered every available clip, this returns
 *     an empty list and the feed page renders an "all caught up" state
 *     (they can revisit past clips via the archive). Anonymous viewers have
 *     no answer history, so they always get the full corpus.
 *
 * (Historical note: this used to be a two-tier order — unanswered first,
 * then answered at the tail — so the feed never dead-ended. That let a
 * user re-see clips they'd already labelled. We now hard-exclude instead,
 * surfacing a caught-up screen rather than recycling old clips.)
 *
 * In-session caveat: a card answered DURING the current page lifetime stays
 * in this list (it was unanswered at load); `FeedPlayer` moves it to the
 * back rather than yanking it. It's excluded on the next load. So the
 * exclusion boundary is "page load", which is the right granularity for
 * "only serve new videos".
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

  // Strict exclusion: drop every snippet the viewer has already answered.
  const unseen =
    answeredIds.size === 0
      ? snippets
      : snippets.filter((s) => !answeredIds.has(s.id));

  const rng = mulberry32(hashStringToSeed(seed));
  return shuffle(unseen, rng);
}
