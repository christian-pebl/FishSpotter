/**
 * Data layer for the prize fulfilment desk (/admin/prizes).
 *
 * Split out of the page so the query pipeline — which decides who PEBL owes a
 * book and which address to write to — is exercised by integration tests
 * against a real Postgres rather than eyeballed against production. The page
 * renders; this assembles. src/lib/prize.ts stays the pure leaf underneath
 * (status/contact derivation, sorting).
 */

import type { PrismaClient } from "@prisma/client";
import { isPrizeEligible } from "@/lib/trust";
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

  const [users, answerDates] = await Promise.all([
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
      },
    }),
    prisma.answer.findMany({
      where: { userId: { in: candidateIds } },
      select: { userId: true, createdAt: true },
    }),
  ]);

  const datesByUser = new Map<string, Date[]>();
  for (const a of answerDates) {
    const list = datesByUser.get(a.userId);
    if (list) list.push(a.createdAt);
    else datesByUser.set(a.userId, [a.createdAt]);
  }

  const inputs: PrizeWinnerInput[] = users.map((u) => {
    const claim = claimByUser.get(u.id) ?? null;
    const verdict = isPrizeEligible(
      {
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
        trustScore: u.trustScore,
        answerDates: datesByUser.get(u.id) ?? [],
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
      pebbles: pebblesByUser.get(u.id) ?? 0,
      claimedAt: claim?.purchasedAt ?? null,
      fulfilledAt: claim?.fulfilledAt ?? null,
      fulfilledBy: claim?.fulfilledBy ?? null,
      eligible: verdict.eligible,
      eligibilityReasons: verdict.reasons,
    };
  });

  return buildPrizeWinnerRows(inputs);
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
