import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SHOP_ITEMS, getShopItem } from "@/lib/shop/catalogue";
import { walletState } from "@/lib/shop/wallet";
import { ShopGrid } from "@/components/shop/ShopGrid";

/**
 * Server wrapper for the shop tab of the Pebbles hub: resolves the viewer's
 * spendable wallet + owned item ids, then hands the static catalogue and that
 * state to the client grid which does the buying.
 */
export async function ShopPanel() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  let wallet = 0;
  let ownedItemIds: string[] = [];
  const heldByItem: Record<string, number> = {};
  if (userId) {
    const [pointsAgg, purchases] = await Promise.all([
      prisma.answer.aggregate({ _sum: { points: true }, where: { userId } }),
      prisma.pebblePurchase.findMany({
        where: { userId },
        select: { itemId: true, pebbleCost: true, consumedForDate: true },
      }),
    ]);
    const earned = pointsAgg._sum.points ?? 0;
    wallet = walletState(earned, purchases).wallet;
    // Cosmetics: owned once. Consumables: count only the unspent (held) ones.
    ownedItemIds = purchases
      .filter((p) => getShopItem(p.itemId)?.type === "cosmetic")
      .map((p) => p.itemId);
    for (const p of purchases) {
      if (getShopItem(p.itemId)?.type === "consumable" && !p.consumedForDate) {
        heldByItem[p.itemId] = (heldByItem[p.itemId] ?? 0) + 1;
      }
    }
  }

  return (
    <ShopGrid
      items={[...SHOP_ITEMS]}
      ownedItemIds={ownedItemIds}
      heldByItem={heldByItem}
      initialWallet={wallet}
      authed={!!userId}
    />
  );
}
