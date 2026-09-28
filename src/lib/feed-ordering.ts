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
 *   - But we don't want a dead end when they've answered everything,
 *     they can keep scrolling and revisit past clips.
 *
 * Seed contract:
 *   - Signed-in users: `session.user.id` so the order is stable per user.
 *   - Anonymous users: an `fs.anon_seed` cookie minted by middleware,
 *     stable across reloads in the same browser.
 *
 * Difficulty ramp (optional `readiness` param): within the unanswered tier,
 * after the plain shuffle, softly re-weight toward easy clips for brand-new
 * spotters and toward harder ones as they gain experience, see
 * src/lib/difficulty.ts for the band logic. This is additive and backward
 * compatible: if `readiness` is omitted, or a snippet has no
 * `difficultyScore`, ordering is exactly the plain shuffle as before.
 * `difficultyScore` is currently seeded intrinsically (apparent organism
 * size, see scripts/seed-difficulty.ts); migrating it toward an empirical,
 * answer-accuracy-derived score is a natural follow-up once there's enough
 * per-clip answer volume to trust (there isn't yet, most snippets have a
 * handful of answers at most).
 *
 * Pure module (no Prisma, no Next, no DOM), so it's trivial to test.
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
  // jumble the user's mental position, the unanswered shuffle is
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

/**
 * Keep the order a mounted feed is already showing when a fresh server render
 * of the same feed arrives.
 *
 * `orderFeed` is only stable for a fixed seed and answered set, and both can
 * change mid-visit: the guest gate signs a new spotter in and refreshes /feed,
 * which moves the seed from the anonymous cookie to their new user id and
 * reshuffles every card. Applying that order under a mounted feed moved the
 * clip being watched somewhere down the list and stranded the viewer on a
 * frozen card (28 Sep 2026). The next full page load uses the new order; a
 * refresh must not.
 *
 * Clips in both lists keep `current`'s order and take `next`'s data (through
 * `merge`, for data a fresh render may omit). Clips that are new in `next` go
 * on the end, in `next`'s order. Clips missing from `next` are dropped.
 */
export function keepFeedOrder<T extends OrderableSnippet>(
  current: readonly T[],
  next: readonly T[],
  merge: (previous: T, fresh: T) => T = (_previous, fresh) => fresh,
): T[] {
  const fresh = new Map(next.map((s) => [s.id, s]));
  const kept: T[] = [];
  for (const s of current) {
    const update = fresh.get(s.id);
    if (!update) continue;
    kept.push(merge(s, update));
    fresh.delete(s.id);
  }
  return [...kept, ...fresh.values()];
}

/**
 * The feed with this visit's answered clips moved to the back (Q3A-T7), except
 * `onStage`, the clip the viewer is looking at: it moves only once they have
 * left it. Moving the card on stage is what dragged the active card to the end
 * of the feed and left an empty, frozen screen after "Next" (28 Sep 2026).
 *
 * Returns `order` itself when there is no answered clip to move.
 */
export function sendAnsweredToBack<T extends OrderableSnippet>(
  order: T[],
  answered: ReadonlySet<string>,
  onStage: string | null,
): T[] {
  if (answered.size === 0) return order;
  const front: T[] = [];
  const back: T[] = [];
  for (const s of order) {
    if (answered.has(s.id) && s.id !== onStage) back.push(s);
    else front.push(s);
  }
  return back.length === 0 ? order : [...front, ...back];
}
