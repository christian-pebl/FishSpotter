/**
 * Data layer for the prize fulfilment desk (/admin/prizes).
 *
 * Split out of the page so the query pipeline, which decides who PEBL owes a
 * book and which address to write to, is exercised by integration tests
 * against a real Postgres rather than eyeballed against production. The page
 * renders; this assembles. src/lib/prize.ts stays the pure leaf underneath
 * (status/contact derivation, sorting).
 */

import type { PrismaClient } from "@prisma/client";
import { prizeGate } from "@/lib/prize-requirements";
import { summariseConsents } from "@/lib/parental-consent-shared";
import {
  SEASEARCH_GUIDE_ID,
  buildPrizeWinnerRows,
  hasReachedPrizeTarget,
  type PrizeWinnerInput,
  type PrizeWinnerRow,
} from "@/lib/prize";

/**
 * Everyone at or over the target, plus anyone holding a claim, as desk rows
 * ordered by what needs doing. `now` is explicit so eligibility windows are
 * deterministically testable.
 */
export async function loadPrizeWinnerRows(
  prisma: PrismaClient,
  now: Date,
): Promise<PrizeWinnerRow[]> {
  type PointsRow = { userId: string; _sum: { points: number | null } };

  const [claims, perUserPoints] = await Promise.all([
    prisma.pebblePurchase.findMany({
      where: { itemId: SEASEARCH_GUIDE_ID },
      select: { userId: true, purchasedAt: true, fulfilledAt: true, fulfilledBy: true },
      orderBy: { purchasedAt: "asc" },
    }),
    prisma.answer.groupBy({ by: ["userId"], _sum: { points: true } }),
  ]);

  const pebblesByUser = new Map<string, number>(
    (perUserPoints as PointsRow[]).map((r) => [r.userId, r._sum.points ?? 0]),
  );
  // One claim per spotter ever (enforced in the claim route); keep the oldest
  // defensively so a duplicate row can't hide the original's posted stamp.
  const claimByUser = new Map<string, (typeof claims)[number]>();
  for (const c of claims) if (!claimByUser.has(c.userId)) claimByUser.set(c.userId, c);

  const candidateIds = Array.from(
    new Set([
      ...Array.from(pebblesByUser.entries())
        .filter(([, pebbles]) => hasReachedPrizeTarget(pebbles))
        .map(([userId]) => userId),
      ...claimByUser.keys(),
    ]),
  );
  if (candidateIds.length === 0) return [];

  const [users, answerDates, consents] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: candidateIds } },
      select: {
        id: true,
        email: true,
        displayName: true,
        name: true,
        isGuest: true,
        emailVerified: true,
        createdAt: true,
        trustScore: true,
        ageBracket: true,
      },
    }),
    prisma.answer.findMany({
      where: { userId: { in: candidateIds } },
      select: { userId: true, createdAt: true },
    }),
    // Only GRANTED consents count on the desk: a pending request is not a
    // parent's OK, and its address must not be written to.
    prisma.parentalConsent.findMany({
      where: { childId: { in: candidateIds }, status: "granted" },
      select: { childId: true, purpose: true, status: true, parentEmail: true, grantedAt: true },
    }),
  ]);

  type ConsentRow = (typeof consents)[number];
  const consentsByChild = new Map<string, ConsentRow[]>();
  for (const c of consents) {
    const list = consentsByChild.get(c.childId);
    if (list) list.push(c);
    else consentsByChild.set(c.childId, [c]);
  }

  const datesByUser = new Map<string, Date[]>();
  for (const a of answerDates) {
    const list = datesByUser.get(a.userId);
    if (list) list.push(a.createdAt);
    else datesByUser.set(a.userId, [a.createdAt]);
  }

  const inputs: PrizeWinnerInput[] = users.map((u) => {
    const claim = claimByUser.get(u.id) ?? null;
    const childConsents = consentsByChild.get(u.id) ?? [];
    const prizeConsent = childConsents.find((c) => c.purpose === "prize") ?? null;
    const accountConsent = childConsents.find((c) => c.purpose === "account") ?? null;
    // The same gate the claim route applies, so "passes" here means the
    // route would accept a claim today.
    const pebbles = pebblesByUser.get(u.id) ?? 0;
    const verdict = prizeGate(
      {
        earned: pebbles,
        isGuest: u.isGuest,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
        trustScore: u.trustScore,
        answerDates: datesByUser.get(u.id) ?? [],
        ageBand: u.ageBracket,
        consents: summariseConsents(childConsents),
        accountConsentGrantedAt: accountConsent?.grantedAt ?? null,
      },
      now,
    );
    return {
      userId: u.id,
      displayName: u.displayName,
      name: u.name,
      email: u.email,
      isGuest: u.isGuest,
      emailVerified: u.emailVerified,
      pebbles,
      claimedAt: claim?.purchasedAt ?? null,
      fulfilledAt: claim?.fulfilledAt ?? null,
      fulfilledBy: claim?.fulfilledBy ?? null,
      eligible: verdict.eligible,
      eligibilityReasons: [
        ...verdict.reasons,
        ...(verdict.blocks.includes("age-required") ? ["age not given"] : []),
        ...(verdict.blocks.includes("parent-consent") ? ["no parent's OK"] : []),
      ],
      ageBand: u.ageBracket,
      parentEmail: prizeConsent?.parentEmail ?? null,
    };
  });

  return buildPrizeWinnerRows(inputs);
}

/** JSON-safe shape of one row for the token-gated remote summary endpoint. */
export interface PrizeDeskSummaryWinner {
  userId: string;
  spotter: string;
  pebbles: number;
  status: PrizeWinnerRow["status"];
  contact: PrizeWinnerRow["contact"];
  ageBand: string | null;
  contactEmail: string | null;
  isGuest: boolean;
  emailVerified: string | null;
  claimedAt: string | null;
  fulfilledAt: string | null;
  fulfilledBy: string | null;
  eligible: boolean;
  eligibilityReasons: readonly string[];
}

/**
 * Serialize desk rows for GET /api/admin/prize-desk/summary, Dates become
 * ISO strings, and the field list here is the explicit, tested contract for
 * what a PRIZE_DESK_TOKEN holder can see. This endpoint (unlike metrics) is
 * NOT aggregate-only: contactEmail is real PII. Keep this an allow-list
 * (never `...row`) so a future field added to PrizeWinnerRow doesn't leak
 * into the response without a deliberate, reviewed change here.
 */
export function toPrizeDeskSummary(
  rows: readonly PrizeWinnerRow[],
): { count: number; winners: PrizeDeskSummaryWinner[] } {
  const winners = rows.map((r) => ({
    userId: r.userId,
    spotter: r.spotter,
    pebbles: r.pebbles,
    status: r.status,
    contact: r.contact,
    ageBand: r.ageBand,
    contactEmail: r.contactEmail,
    isGuest: r.isGuest,
    emailVerified: r.emailVerified?.toISOString() ?? null,
    claimedAt: r.claimedAt?.toISOString() ?? null,
    fulfilledAt: r.fulfilledAt?.toISOString() ?? null,
    fulfilledBy: r.fulfilledBy,
    eligible: r.eligible,
    eligibilityReasons: r.eligibilityReasons,
  }));
  return { count: winners.length, winners };
}

export type MarkFulfilledResult = {
  fulfilledAt: Date | null;
  fulfilledBy: string | null;
};

/**
 * Stamp (or clear) the posted marker on a spotter's guide claim.
 *
 * Scoped by itemId as well as userId: the ledger also holds retired shop
 * purchases (gold-nameplate, coral-accent, tide-freeze) that must never be
 * stamped as a posted prize. Throws when the spotter holds no guide claim.
 *
 * Never touches Pebbles, the claim itself, or leaderboard rank.
 */
export async function markPrizeFulfilled(
  prisma: PrismaClient,
  userId: string,
  posted: boolean,
  adminEmail: string,
): Promise<MarkFulfilledResult> {
  const claim = await prisma.pebblePurchase.findFirst({
    where: { userId, itemId: SEASEARCH_GUIDE_ID },
    select: { id: true },
    orderBy: { purchasedAt: "asc" },
  });
  if (!claim) {
    throw new Error("That spotter hasn't claimed the guide yet.");
  }

  return prisma.pebblePurchase.update({
    where: { id: claim.id },
    data: posted
      ? { fulfilledAt: new Date(), fulfilledBy: adminEmail }
      : { fulfilledAt: null, fulfilledBy: null },
    select: { fulfilledAt: true, fulfilledBy: true },
  });
}
