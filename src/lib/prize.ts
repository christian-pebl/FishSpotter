/**
 * The Pebbles prize: reach PRIZE_TARGET_PEBBLES lifetime EARNED Pebbles and
 * PEBL posts you the Seasearch marine life ID guide. This replaced the
 * short-lived Pebbles shop (cosmetics + Tide Freeze, retired 20 Jul 2026 the
 * day they shipped): one visible goal on the leaderboard page beats a
 * storefront.
 *
 * The prize is a GIFT, not a spend — claiming records a PebblePurchase row
 * with pebbleCost 0, so the spotter's Pebbles (and leaderboard rank) are
 * untouched. Claims are gated by `isPrizeEligible` (src/lib/trust.ts) in
 * POST /api/prize/claim per docs/pebbles-anti-gaming-and-prizes-plan.md.
 * Fulfilment is manual: claimed rows are the PebblePurchase entries for
 * SEASEARCH_GUIDE_ID; PEBL emails the spotter to arrange delivery.
 *
 * Pure leaf (no Prisma, no React). Historic shop itemIds (gold-nameplate,
 * coral-accent, tide-freeze) may exist as PebblePurchase rows in prod and must
 * never be reused.
 */

/** PebblePurchase.itemId key for the claimed guide. Never reuse or rename. */
export const SEASEARCH_GUIDE_ID = "seasearch-guide";

/** Lifetime earned Pebbles needed to win the guide. */
export const PRIZE_TARGET_PEBBLES = 1000;

export const PRIZE_NAME = "Seasearch marine life ID guide";

export const PRIZE_BLURB =
  "Earn 1,000 Pebbles spotting clips and PEBL will post you the Seasearch guide to the marine life of Britain and Ireland — the book the pros carry.";

/** True once a spotter's lifetime earned Pebbles reach the target. */
export function hasReachedPrizeTarget(earned: number): boolean {
  return earned >= PRIZE_TARGET_PEBBLES;
}
