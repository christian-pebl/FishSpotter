/**
 * The Pebbles shop catalogue: a static, code-defined list of everything a
 * spotter can spend Pebbles on. Items live here (not the DB) because they are
 * few and stable; only PURCHASES are persisted (PebblePurchase). Prices are in
 * Pebbles, the community-science currency earned in the feed (see pebbles.ts).
 *
 * Pure leaf (no Prisma, no React) so pricing / ownership rules are unit tested
 * in catalogue.test.ts and reused by the purchase route, the shop UI, and the
 * profile page that renders owned cosmetics.
 *
 * Phase 1 is cosmetic-only: nothing here costs PEBL real money, so it needs no
 * anti-gaming gate (a farmer only ever buys their own cosmetics). Real-world
 * prizes (guidebook, SubCam) are a later phase gated on the trust layer in
 * docs/pebbles-anti-gaming-and-prizes-plan.md; deliberately NOT in this list.
 */

export type ShopItemType = "cosmetic" | "consumable";

/** How a cosmetic renders on the public profile card. */
export type CosmeticKind = "nameplate" | "profile-accent";

export interface ShopItem {
  /** Stable id: the PebblePurchase.itemId key. Never reuse or rename. */
  id: string;
  name: string;
  /** One short line shown on the shop card. */
  blurb: string;
  /** Price in Pebbles. */
  price: number;
  type: ShopItemType;
  /** For cosmetics: how/where it renders. Omitted for consumables. */
  kind?: CosmeticKind;
  /** For consumables: the most a spotter may hold unused at once (Duolingo-style
   *  streak-freeze cap). Omitted for cosmetics (they are one-time by nature). */
  maxHold?: number;
}

/** The consumable that protects a day-streak from one missed day. */
export const TIDE_FREEZE_ID = "tide-freeze";

/**
 * The live catalogue. Order here is the display order in the shop grid.
 * Cosmetics are one-time buys; a consumable (e.g. a future Tide Freeze) may be
 * bought repeatedly.
 */
export const SHOP_ITEMS: readonly ShopItem[] = [
  {
    id: "gold-nameplate",
    name: "Gold nameplate",
    blurb: "Your spotter name shines gold on your profile.",
    price: 150,
    type: "cosmetic",
    kind: "nameplate",
  },
  {
    id: "coral-accent",
    name: "Coral accent",
    blurb: "A warm coral band across your profile header.",
    price: 300,
    type: "cosmetic",
    kind: "profile-accent",
  },
  {
    id: TIDE_FREEZE_ID,
    name: "Tide Freeze",
    blurb: "Miss a day without losing your streak. Hold up to two.",
    price: 80,
    type: "consumable",
    maxHold: 2,
  },
] as const;

export function getShopItem(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.id === id);
}

/** True for items a spotter may only ever own once (all cosmetics today). */
export function isOneTime(item: ShopItem): boolean {
  return item.type === "cosmetic";
}

/** The set of cosmetic item ids a spotter owns, from their purchase itemIds. */
export function ownedCosmeticKinds(
  ownedItemIds: Iterable<string>,
): Set<CosmeticKind> {
  const kinds = new Set<CosmeticKind>();
  for (const id of ownedItemIds) {
    const item = getShopItem(id);
    if (item?.type === "cosmetic" && item.kind) kinds.add(item.kind);
  }
  return kinds;
}
