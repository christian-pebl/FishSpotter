/**
 * Wallet math for the Pebbles shop. Pure leaf (no Prisma) so it's unit tested
 * in wallet.test.ts and shared by the purchase route + the shop/hub UI.
 *
 * Two distinct numbers, deliberately kept apart:
 *   - EARNED  = sum(Answer.points), a spotter's lifetime contribution. This is
 *               the leaderboard score and it NEVER decreases.
 *   - WALLET  = earned - spent, the spendable balance shown in the Pebble bag
 *               and the shop. Spending draws this down but leaves EARNED (and so
 *               the leaderboard rank) untouched. This split is what lets buying
 *               things never cost a spotter their standing ("never penalise").
 */

import { getShopItem, isOneTime, type ShopItem } from "./catalogue";

export interface WalletState {
  earned: number;
  spent: number;
  wallet: number;
}

/** Total Pebbles spent, from the snapshotted per-purchase costs. */
export function totalSpent(purchases: ReadonlyArray<{ pebbleCost: number }>): number {
  return purchases.reduce((sum, p) => sum + p.pebbleCost, 0);
}

/** Assemble the wallet state from lifetime earned and the purchase ledger. */
export function walletState(
  earned: number,
  purchases: ReadonlyArray<{ pebbleCost: number }>,
): WalletState {
  const spent = totalSpent(purchases);
  return { earned, spent, wallet: Math.max(0, earned - spent) };
}

export type PurchaseError = "unknown-item" | "already-owned" | "insufficient";

export interface PurchaseCheck {
  ok: boolean;
  error?: PurchaseError;
  item?: ShopItem;
}

/**
 * Decide whether a purchase may proceed, given the item id, the spotter's
 * current wallet, and the item ids they already own. Pure; the route does the
 * DB write only when this returns ok.
 */
export function canPurchase(
  itemId: string,
  wallet: number,
  ownedItemIds: ReadonlySet<string>,
): PurchaseCheck {
  const item = getShopItem(itemId);
  if (!item) return { ok: false, error: "unknown-item" };
  if (isOneTime(item) && ownedItemIds.has(item.id)) {
    return { ok: false, error: "already-owned", item };
  }
  if (wallet < item.price) return { ok: false, error: "insufficient", item };
  return { ok: true, item };
}
