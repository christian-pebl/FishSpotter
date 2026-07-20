import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/csrf";
import { checkShopRateLimit } from "@/lib/rate-limit";
import { getShopItem } from "@/lib/shop/catalogue";
import { canPurchase, walletState } from "@/lib/shop/wallet";
import { isPrizeEligible } from "@/lib/trust";

const PurchaseSchema = z.object({
  itemId: z.string().min(1).max(64),
});

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
      { error: "Too many purchases in a short window. Slow down a bit." },
      { status: 429 },
    );
  }

  let parsed;
  try {
    parsed = PurchaseSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Read the spotter's lifetime earned points + existing purchases to derive
  // the wallet and what they already own, then let the pure rule decide.
  const [pointsAgg, purchases] = await Promise.all([
    prisma.answer.aggregate({ _sum: { points: true }, where: { userId } }),
    prisma.pebblePurchase.findMany({
      where: { userId },
      select: { itemId: true, pebbleCost: true, consumedForDate: true },
    }),
  ]);
  const earned = pointsAgg._sum.points ?? 0;
  const { wallet } = walletState(earned, purchases);
  const ownedIds = new Set(purchases.map((p) => p.itemId));

  // Consumable hold cap (Tide Freeze): reject when the spotter already holds the
  // maximum unspent count. Checked before canPurchase because a consumable is
  // never "already-owned" (it's re-buyable) — the cap is the only ceiling.
  const capItem = getShopItem(parsed.itemId);
  if (capItem?.type === "consumable" && capItem.maxHold) {
    const held = purchases.filter(
      (p) => p.itemId === capItem.id && !p.consumedForDate,
    ).length;
    if (held >= capItem.maxHold) {
      return NextResponse.json(
        {
          error: `You can hold at most ${capItem.maxHold}. Use one before buying more.`,
          code: "at-capacity",
        },
        { status: 409 },
      );
    }
  }

  const check = canPurchase(parsed.itemId, wallet, ownedIds);
  if (!check.ok || !check.item) {
    const status =
      check.error === "unknown-item"
        ? 404
        : check.error === "already-owned"
          ? 409
          : 402; // insufficient funds
    const message =
      check.error === "unknown-item"
        ? "That item doesn't exist."
        : check.error === "already-owned"
          ? "You already own that."
          : "Not enough Pebbles yet.";
    return NextResponse.json({ error: message, code: check.error }, { status });
  }

  const item = check.item;

  // Real-world prizes are the one shop path that costs PEBL money, so they go
  // through the anti-gaming gate (docs/pebbles-anti-gaming-and-prizes-plan.md):
  // verified email + trust above the bar + account age + non-bursty activity.
  // The gate only withholds upside — Pebbles are never removed. The email
  // reason is actionable so we surface it; the rest stay a generic "more
  // spotting history" nudge (trust internals are deliberately never shown).
  if (item.type === "prize") {
    const [user, answerDates] = await Promise.all([
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
    const eligibility = isPrizeEligible(
      {
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        trustScore: user.trustScore,
        answerDates: answerDates.map((a: { createdAt: Date }) => a.createdAt),
      },
      new Date(),
    );
    if (!eligibility.eligible) {
      const message = eligibility.reasons.includes("email not verified")
        ? "Verify your email first — prizes are posted to real spotters."
        : "Prize redemptions unlock with a bit more spotting history across more days. Keep at it!";
      return NextResponse.json({ error: message, code: "not-eligible" }, { status: 403 });
    }
  }

  await prisma.pebblePurchase.create({
    data: { userId, itemId: item.id, pebbleCost: item.price },
  });

  const newWallet = wallet - item.price;
  return NextResponse.json({
    ok: true,
    itemId: item.id,
    wallet: newWallet,
    ownedItemIds: [...ownedIds, item.id],
  });
}
