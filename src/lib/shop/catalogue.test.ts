import { describe, expect, it } from "vitest";
import {
  FSC_GUIDE_ID,
  SHOP_ITEMS,
  TIDE_FREEZE_ID,
  getShopItem,
  isOneTime,
} from "./catalogue";

describe("shop catalogue", () => {
  it("has unique ids and positive prices", () => {
    const ids = SHOP_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of SHOP_ITEMS) {
      expect(item.price).toBeGreaterThan(0);
      expect(Number.isInteger(item.price)).toBe(true);
    }
  });

  it("sells the FSC guide as a 1000-Pebble one-time prize", () => {
    const guide = getShopItem(FSC_GUIDE_ID);
    expect(guide?.type).toBe("prize");
    expect(guide?.price).toBe(1000);
    expect(isOneTime(guide!)).toBe(true);
  });

  it("getShopItem resolves known ids and rejects unknown", () => {
    expect(getShopItem(FSC_GUIDE_ID)?.name).toBe("FSC rockpool ID guide");
    expect(getShopItem("does-not-exist")).toBeUndefined();
  });

  it("retired items stay retired: not purchasable, ids never reused", () => {
    // The Phase-1 cosmetics and the Tide Freeze were removed from sale on
    // 20 Jul 2026. Their PebblePurchase rows may exist in prod, so the ids
    // must never come back as different items.
    for (const retired of ["gold-nameplate", "coral-accent", TIDE_FREEZE_ID]) {
      expect(getShopItem(retired)).toBeUndefined();
    }
    // TIDE_FREEZE_ID stays exported: the streak service still honours held
    // freezes bought before retirement.
    expect(TIDE_FREEZE_ID).toBe("tide-freeze");
  });
});
