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
import { prizeGate, type PrizeBlock } from "@/lib/prize-requirements";
import { loadConsentContext } from "@/lib/parental-consent";
import { isMinor, isUnder13 } from "@/lib/age";
import { notifyStaffOfPrizeClaim } from "@/lib/email/prize-notify";
import { z } from "zod";

/**
 * Claim the Seasearch guide prize. The prize is a GIFT for reaching
 * PRIZE_TARGET_PEBBLES lifetime earned Pebbles, claiming records a
 * PebblePurchase row with pebbleCost 0, so nothing is deducted and the
 * leaderboard rank is untouched. One claim per spotter, ever.
 *
 * Because this is the one flow that costs PEBL real money, it goes through
 * the anti-gaming gate (docs/pebbles-anti-gaming-and-prizes-plan.md):
 * verified email + trust above the bar + account age + non-bursty activity.
 * The email reason is actionable so we surface it; the rest stay a generic
 * "more spotting history" nudge (trust internals are never shown).
 *
 * Since 16 Sep 2026 the gate (prizeGate in src/lib/prize-requirements.ts)
 * also needs a declared age, and a parent's OK for anyone under 18. The
 * spotter must confirm the book can go to a UK address (the prize rules at
 * /prize-rules); for a minor, their parent confirmed it too.
 */
const BodySchema = z.object({ ukAddress: z.literal(true) });

function blockMessage(block: PrizeBlock, user: { isGuest: boolean; ageBracket: string | null }): {
  error: string;
  code: string;
} {
  switch (block) {
    case "age-required":
      return { error: "Tell us your age first.", code: "age-required" };
    case "account":
      if (isUnder13(user.ageBracket)) {
        return {
          error: "A parent or carer needs to save your account first.",
          code: "parent-account-required",
        };
      }
      return user.isGuest
        ? { error: "Save your account with an email first.", code: "not-eligible" }
        : { error: "Verify your email first. Prizes are posted to real spotters.", code: "not-eligible" };
    case "parent-consent":
      return {
        error: "We need a parent or carer's OK before we can post you anything.",
        code: "parent-consent-required",
      };
    default:
      return {
        error: "Prize claims unlock with a bit more spotting history across more days. Keep at it!",
        code: "not-eligible",
      };
  }
}
export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "We can only post the guide to a UK address.", code: "uk-address-required" },
      { status: 400 },
    );
  }

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
      select: {
        emailVerified: true,
        createdAt: true,
        trustScore: true,
        isGuest: true,
        ageBracket: true,
        displayName: true,
        name: true,
      },
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

  const now = new Date();
  const consent = await loadConsentContext(prisma, userId, now);
  const gate = prizeGate(
    {
      earned,
      isGuest: user.isGuest,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      trustScore: user.trustScore,
      answerDates: answers.map((a: { createdAt: Date }) => a.createdAt),
      ageBand: user.ageBracket,
      consents: consent.consents,
      accountConsentGrantedAt: consent.accountConsentGrantedAt,
    },
    now,
  );
  if (!gate.eligible) {
    return NextResponse.json(blockMessage(gate.blocks[0], user), { status: 403 });
  }

  // `select` is load-bearing, not tidiness: without it Prisma emits
  // `INSERT ... RETURNING` every scalar column, so this route starts failing
  // the moment schema.prisma gains a column that prod hasn't migrated yet.
  // That happened on 1 Aug 2026, adding PebblePurchase.fulfilledAt/fulfilledBy
  // for /admin/prizes broke this claim button in the window between deploy and
  // `prisma db push`. We discard the row anyway, so ask for one column.
  await prisma.pebblePurchase.create({
    data: { userId, itemId: SEASEARCH_GUIDE_ID, pebbleCost: 0 },
    select: { id: true },
  });

  // The prize rules promise an email within 7 days; this is how staff know.
  await notifyStaffOfPrizeClaim(prisma, {
    spotter: user.displayName ?? user.name ?? `Spotter ${userId.slice(0, 6)}`,
    viaParent: isMinor(user.ageBracket),
  });

  return NextResponse.json({ ok: true, itemId: SEASEARCH_GUIDE_ID });
}
