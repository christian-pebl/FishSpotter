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

// ---------------------------------------------------------------------------
// Fulfilment desk (/admin/prizes) — pure row derivation
// ---------------------------------------------------------------------------

/**
 * How reachable a winner is by email.
 *
 * `guest` matters: zero-friction guest accounts carry a SYNTHETIC PLACEHOLDER
 * address in User.email (see the guest branch in src/lib/auth.ts), so the
 * column looks populated but nothing can be posted to it. Never show a guest's
 * email as a contact — the only route to them is nudging the in-app "save your
 * finds" prompt, which runs POST /api/guest/claim.
 *
 * `unverified` is a real address the spotter typed at guest-claim but never
 * confirmed. Worth showing (you can email a nudge) but it can't clear the
 * claim gate, which requires emailVerified.
 */
export type PrizeContactState = "verified" | "unverified" | "guest";

export function prizeContactState(user: {
  isGuest: boolean;
  emailVerified: Date | null;
}): PrizeContactState {
  if (user.isGuest) return "guest";
  return user.emailVerified ? "verified" : "unverified";
}

/**
 * Where a winner sits in the fulfilment pipeline.
 *   to-post           — claimed, not yet posted. THE work queue.
 *   posted            — claimed and marked posted by an admin.
 *   reached-unclaimed — over the target but hasn't tapped claim; reachable.
 *   unreachable       — over the target, but a guest with no real address.
 */
export type PrizeStatus = "to-post" | "reached-unclaimed" | "posted" | "unreachable";

/** Display order: what needs doing first, then what might need chasing. */
export const PRIZE_STATUS_ORDER: readonly PrizeStatus[] = [
  "to-post",
  "reached-unclaimed",
  "unreachable",
  "posted",
];

export const PRIZE_STATUS_LABEL: Record<PrizeStatus, string> = {
  "to-post": "To post",
  "reached-unclaimed": "Not claimed",
  unreachable: "No contact",
  posted: "Posted",
};

export interface PrizeWinnerInput {
  userId: string;
  displayName: string | null;
  name: string | null;
  email: string;
  isGuest: boolean;
  emailVerified: Date | null;
  /** Lifetime earned Pebbles (sum of Answer.points). */
  pebbles: number;
  /** PebblePurchase.purchasedAt for SEASEARCH_GUIDE_ID, or null if never claimed. */
  claimedAt: Date | null;
  /** PebblePurchase.fulfilledAt — set once an admin marks the book posted. */
  fulfilledAt: Date | null;
  fulfilledBy: string | null;
  /** isPrizeEligible()'s verdict, so the desk can flag a suspect claim. */
  eligible: boolean;
  eligibilityReasons: readonly string[];
}

export interface PrizeWinnerRow extends PrizeWinnerInput {
  status: PrizeStatus;
  contact: PrizeContactState;
  /** The address to actually write to, or null when there is no real one. */
  contactEmail: string | null;
  /** Best available human label for the spotter. */
  spotter: string;
}

function statusFor(input: PrizeWinnerInput, contact: PrizeContactState): PrizeStatus {
  if (input.claimedAt) return input.fulfilledAt ? "posted" : "to-post";
  return contact === "guest" ? "unreachable" : "reached-unclaimed";
}

/**
 * Derive one fulfilment-desk row. Pure so the desk's whole decision table is
 * unit tested rather than eyeballed against production data.
 */
export function toPrizeWinnerRow(input: PrizeWinnerInput): PrizeWinnerRow {
  const contact = prizeContactState(input);
  return {
    ...input,
    contact,
    status: statusFor(input, contact),
    contactEmail: contact === "guest" ? null : input.email,
    spotter: input.displayName?.trim() || input.name?.trim() || "Unnamed spotter",
  };
}

/**
 * Build the desk's rows: everyone at or over the target, ordered by what needs
 * doing (see PRIZE_STATUS_ORDER), then by Pebbles descending within a status.
 *
 * A claim is honoured even if the spotter's total later dips below the target
 * (it can't today — Pebbles are never deducted — but a claimed row must never
 * silently vanish from the desk while PEBL still owes someone a book).
 */
export function buildPrizeWinnerRows(
  inputs: readonly PrizeWinnerInput[],
): PrizeWinnerRow[] {
  return inputs
    .filter((w) => hasReachedPrizeTarget(w.pebbles) || w.claimedAt !== null)
    .map(toPrizeWinnerRow)
    .sort(
      (a, b) =>
        PRIZE_STATUS_ORDER.indexOf(a.status) - PRIZE_STATUS_ORDER.indexOf(b.status) ||
        b.pebbles - a.pebbles ||
        a.spotter.localeCompare(b.spotter),
    );
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
