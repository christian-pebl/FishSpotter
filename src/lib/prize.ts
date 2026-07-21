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
export const PRIZE_TARGET_PEBBLES = 2000;

export const PRIZE_NAME = "Seasearch marine life ID guide";

export const PRIZE_BLURB =
  "Earn 2,000 Pebbles spotting clips and PEBL will post you the Seasearch guide to the marine life of Britain and Ireland — the book the pros carry.";

/** True once a spotter's lifetime earned Pebbles reach the target. */
export function hasReachedPrizeTarget(earned: number): boolean {
  return earned >= PRIZE_TARGET_PEBBLES;
}

/**
 * Gallery manifest for the prize card: the front cover plus a few inside
 * pages so spotters can flick through what they'd win. Each slot lists its
 * candidate sources (jpg then png); the gallery tries them in order at
 * runtime and drops the slot if none load, falling back to
 * PRIZE_FALLBACK_IMAGE when nothing loads at all. So shipping the real
 * screenshots is just: drop files with these names (either extension) into
 * public/shop/guide/ — no code change needed. Cover first; pages in
 * reading order.
 */
export interface PrizeGallerySlot {
  /** Candidate URLs tried in order until one loads. */
  srcs: readonly string[];
  alt: string;
}

const slotSources = (name: string): readonly string[] => [
  `/shop/guide/${name}.jpg`,
  `/shop/guide/${name}.png`,
];

export const PRIZE_GALLERY: ReadonlyArray<PrizeGallerySlot> = [
  { srcs: slotSources("cover"), alt: "Seasearch guide — front cover" },
  ...Array.from({ length: 6 }, (_, i) => ({
    srcs: slotSources(`page-${i + 1}`),
    alt: `Seasearch guide — inside page ${i + 1}`,
  })),
];

/** Committed PEBL illustration shown until real screenshots land. */
export const PRIZE_FALLBACK_IMAGE = {
  src: `/shop/${SEASEARCH_GUIDE_ID}.svg`,
  alt: "Illustration of a fold-out marine identification guide",
} as const;
