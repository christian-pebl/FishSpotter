import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/csrf";
import { checkShopRateLimit } from "@/lib/rate-limit";
import {
  PRIZE_TARGET_PEBBLES,
  SEASEARCH_GUIDE_ID,
  hasReachedPrizeTarget,
} from "@/lib/prize";
import { isPrizeEligible } from "@/lib/trust";

/**
 * Claim the Seasearch guide prize. The prize is a GIFT for reaching
 * PRIZE_TARGET_PEBBLES lifetime earned Pebbles — claiming records a
 * PebblePurchase row with pebbleCost 0, so nothing is deducted and the
 * leaderboard rank is untouched. One claim per spotter, ever.
 *
 * Because this is the one flow that costs PEBL real money, it goes through
 * the anti-gaming gate (docs/pebbles-anti-gaming-and-prizes-plan.md):
 * verified email + trust above the bar + account age + non-bursty activity.
 * The email reason is actionable so we surface it; the rest stay a generic
 * "more spotting history" nudge (trust internals are never shown).
 */
export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  if (!(await checkShopRateLimit(userId))) {
    return NextResponse.json(
      { error: "Too many attempts in a short window. Slow down a bit." },
      { status: 429 },
    );
  }

  const [pointsAgg, existingClaim, user, answers] = await Promise.all([
    prisma.answer.aggregate({ _sum: { points: true }, where: { userId } }),
    prisma.pebblePurchase.findFirst({
      where: { userId, itemId: SEASEARCH_GUIDE_ID },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true, createdAt: true, trustScore: true },
    }),
    prisma.answer.findMany({
      where: { userId },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
  ]);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (existingClaim) {
    return NextResponse.json(
      { error: "You've already claimed your guide.", code: "already-claimed" },
      { status: 409 },
    );
  }

  const earned = pointsAgg._sum.points ?? 0;
  if (!hasReachedPrizeTarget(earned)) {
    return NextResponse.json(
      {
        error: `You need ${PRIZE_TARGET_PEBBLES.toLocaleString()} Pebbles to claim the guide.`,
        code: "target-not-reached",
      },
      { status: 402 },
    );
  }

  const eligibility = isPrizeEligible(
    {
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      trustScore: user.trustScore,
      answerDates: answers.map((a: { createdAt: Date }) => a.createdAt),
    },
    new Date(),
  );
  if (!eligibility.eligible) {
    const message = eligibility.reasons.includes("email not verified")
      ? "Verify your email first — prizes are posted to real spotters."
      : "Prize claims unlock with a bit more spotting history across more days. Keep at it!";
    return NextResponse.json({ error: message, code: "not-eligible" }, { status: 403 });
  }

  await prisma.pebblePurchase.create({
    data: { userId, itemId: SEASEARCH_GUIDE_ID, pebbleCost: 0 },
  });

  return NextResponse.json({ ok: true, itemId: SEASEARCH_GUIDE_ID });
}
