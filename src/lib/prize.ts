/**
 * The Pebbles prize: reach PRIZE_TARGET_PEBBLES lifetime EARNED Pebbles and
 * PEBL posts you the Seasearch marine life ID guide. This replaced the
 * short-lived Pebbles shop (cosmetics + Tide Freeze, retired 20 Jul 2026 the
 * day they shipped): one visible goal on the leaderboard page beats a
 * storefront.
 *
 * There is NO in-app claim step (removed 11 Aug 2026). A spotter who reaches
 * the target sees a "PEBL will email you" card and nothing else; PEBL works
 * the /admin/prizes desk, emails each winner directly to ask for a postal
 * address, and marks the guide posted. That first fulfilment (Teagan Grey,
 * 11 Aug 2026) was done entirely by hand, which is what this simplification
 * codifies: one winner every few weeks does not need a claim funnel.
 *
 * Consequences, all deliberate:
 *   - PebblePurchase rows for SEASEARCH_GUIDE_ID are now written ONLY by an
 *     admin marking a guide posted, never by the spotter. They are a
 *     fulfilment record, not a request.
 *   - `isPrizeEligible` (src/lib/trust.ts) no longer BLOCKS anything. It is
 *     advisory signal on the desk, so a 2,000-Pebble run earned in a single
 *     three-day burst is visible before PEBL spends money on a book.
 *
 * The prize is still a GIFT, not a spend: the fulfilment row carries
 * pebbleCost 0, so Pebbles and leaderboard rank are untouched.
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
  "Earn 2,000 Pebbles spotting clips and PEBL will post you the Seasearch guide to the marine life of Britain and Ireland, the book the pros carry.";

/** Shown once a spotter is over the line. Sets the expectation that the next
 *  move is PEBL's, since there is nothing for them to tap. */
export const PRIZE_REACHED_BLURB =
  "You've reached 2,000 Pebbles, so the guide is yours. PEBL will email you to ask where to post it.";

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
 *   to-post     = over the target with a real address. THE work queue: email
 *                 them, post the book, mark it posted.
 *   posted      = an admin has marked the guide sent.
 *   unreachable = over the target, but a guest with no real address.
 *
 * The old `reached-unclaimed` status is gone with the claim button: with no
 * way for a spotter to raise their hand, "reached but not claimed" and "needs
 * posting" are the same state, and keeping both just split the work queue in
 * two for no reason.
 */
export type PrizeStatus = "to-post" | "posted" | "unreachable";

/** Display order: what needs doing first, then what might need chasing. */
export const PRIZE_STATUS_ORDER: readonly PrizeStatus[] = [
  "to-post",
  "unreachable",
  "posted",
];

export const PRIZE_STATUS_LABEL: Record<PrizeStatus, string> = {
  "to-post": "To post",
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
  // Driven by fulfilment, NOT by claimedAt: post-refactor the PebblePurchase
  // row is written when an admin marks the book sent, so claimedAt and
  // fulfilledAt land together and only the latter means anything.
  if (input.fulfilledAt) return "posted";
  return contact === "guest" ? "unreachable" : "to-post";
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
 * A fulfilled row is kept even if the spotter's total later dips below the
 * target (it can't today, since Pebbles are never deducted, but a posted book
 * must never silently vanish from the desk, or PEBL loses the only record it
 * has that the guide was already sent).
 */
export function buildPrizeWinnerRows(
  inputs: readonly PrizeWinnerInput[],
): PrizeWinnerRow[] {
  return inputs
    .filter(
      (w) =>
        hasReachedPrizeTarget(w.pebbles) ||
        w.fulfilledAt !== null ||
        w.claimedAt !== null,
    )
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
  { srcs: slotSources("cover"), alt: "Seasearch guide: front cover" },
  ...Array.from({ length: 6 }, (_, i) => ({
    srcs: slotSources(`page-${i + 1}`),
    alt: `Seasearch guide: inside page ${i + 1}`,
  })),
];

/** Committed PEBL illustration shown until real screenshots land. */
export const PRIZE_FALLBACK_IMAGE = {
  src: `/shop/${SEASEARCH_GUIDE_ID}.svg`,
  alt: "Illustration of a fold-out marine identification guide",
} as const;
