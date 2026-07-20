import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SHOP_ITEMS, getShopItem, isOneTime } from "@/lib/shop/catalogue";
import { walletState } from "@/lib/shop/wallet";
import { isPrizeEligible } from "@/lib/trust";
import { ShopGrid } from "@/components/shop/ShopGrid";

/**
 * Server wrapper for the shop tab of the Pebbles hub: resolves the viewer's
 * spendable wallet, what they've already redeemed, and (because the catalogue
 * now sells a real-world prize) their prize eligibility, then hands the static
 * catalogue and that state to the client grid which does the buying.
 *
 * Eligibility is precomputed here so the grid can pre-warn ("verify your
 * email") instead of letting a spotter grind to 1000 Pebbles and only then
 * discover the gate at redeem time. The purchase route re-checks it
 * server-side regardless — this copy is UX, not enforcement.
 */
export async function ShopPanel() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  let wallet = 0;
  let ownedItemIds: string[] = [];
  const heldByItem: Record<string, number> = {};
  let prizeEligibility: { eligible: boolean; reason: string | null } | null = null;

  if (userId) {
    const [pointsAgg, purchases, user, answerDates] = await Promise.all([
      prisma.answer.aggregate({ _sum: { points: true }, where: { userId } }),
      prisma.pebblePurchase.findMany({
        where: { userId },
        select: { itemId: true, pebbleCost: true, consumedForDate: true },
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
    const earned = pointsAgg._sum.points ?? 0;
    wallet = walletState(earned, purchases).wallet;
    // One-time items (prizes, legacy cosmetics): owned once, forever.
    // Consumables: count only the unspent (held) ones.
    ownedItemIds = purchases
      .filter((p) => {
        const item = getShopItem(p.itemId);
        return item ? isOneTime(item) : false;
      })
      .map((p) => p.itemId);
    for (const p of purchases) {
      if (getShopItem(p.itemId)?.type === "consumable" && !p.consumedForDate) {
        heldByItem[p.itemId] = (heldByItem[p.itemId] ?? 0) + 1;
      }
    }

    if (user) {
      const result = isPrizeEligible(
        {
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          trustScore: user.trustScore,
          answerDates: answerDates.map((a) => a.createdAt),
        },
        new Date(),
      );
      prizeEligibility = {
        eligible: result.eligible,
        // Actionable reason only; trust internals stay a generic nudge.
        reason: result.eligible
          ? null
          : result.reasons.includes("email not verified")
            ? "Verify your email to redeem prizes — they're posted to real spotters."
            : "Prize redemption unlocks with more spotting history across more days.",
      };
    }
  }

  return (
    <ShopGrid
      items={[...SHOP_ITEMS]}
      ownedItemIds={ownedItemIds}
      heldByItem={heldByItem}
      initialWallet={wallet}
      authed={!!userId}
      prizeEligibility={prizeEligibility}
    />
  );
}
