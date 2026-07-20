/**
 * The Pebbles shop catalogue: a static, code-defined list of everything a
 * spotter can spend Pebbles on. Items live here (not the DB) because they are
 * few and stable; only PURCHASES are persisted (PebblePurchase). Prices are in
 * Pebbles, the community-science currency earned in the feed (see pebbles.ts).
 *
 * Pure leaf (no Prisma, no React) so pricing / ownership rules are unit tested
 * in catalogue.test.ts and reused by the purchase route, the shop UI, and the
 * pages that render redeemed items.
 *
 * 20 Jul 2026: the Phase-1 cosmetics (gold nameplate, coral accent) and the
 * Tide Freeze were RETIRED — the shop now sells one real-world prize, the
 * Field Studies Council rockpool ID guide. Prize redemptions are gated by
 * `isPrizeEligible` (src/lib/trust.ts) in the purchase route, per
 * docs/pebbles-anti-gaming-and-prizes-plan.md. Retired item ids must never be
 * reused: PebblePurchase rows for them may exist in prod (their pebbleCost
 * still counts as spent), and held Tide Freezes are still honoured by the
 * streak service via TIDE_FREEZE_ID below.
 */

export type ShopItemType = "cosmetic" | "consumable" | "prize";

export interface ShopItem {
  /** Stable id: the PebblePurchase.itemId key. Never reuse or rename. */
  id: string;
  name: string;
  /** One short line shown on the shop card. */
  blurb: string;
  /** Price in Pebbles. */
  price: number;
  type: ShopItemType;
  /** For consumables: the most a spotter may hold unused at once. */
  maxHold?: number;
}

/**
 * RETIRED consumable id, kept (not in SHOP_ITEMS) because the streak service
 * still consumes freezes that were bought before retirement — a held freeze
 * keeps protecting a missed day; it just can't be bought any more.
 */
export const TIDE_FREEZE_ID = "tide-freeze";

/** The real-world prize: an FSC fold-out guide to UK rockpool wildlife. */
export const FSC_GUIDE_ID = "fsc-rockpool-guide";

/**
 * The live catalogue. Order here is the display order in the shop grid.
 * Prizes are one-time redemptions; fulfilment is manual (PEBL emails the
 * spotter — redeemed rows are the PebblePurchase entries for FSC_GUIDE_ID).
 */
export const SHOP_ITEMS: readonly ShopItem[] = [
  {
    id: FSC_GUIDE_ID,
    name: "FSC rockpool ID guide",
    blurb:
      "A real Field Studies Council fold-out guide to UK rockpool wildlife, posted to you by PEBL.",
    price: 1000,
    type: "prize",
  },
] as const;

export function getShopItem(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.id === id);
}

/** True for items a spotter may only ever own/redeem once (everything but consumables). */
export function isOneTime(item: ShopItem): boolean {
  return item.type !== "consumable";
}
