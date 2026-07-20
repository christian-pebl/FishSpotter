import { describe, expect, it } from "vitest";
import {
  SHOP_ITEMS,
  getShopItem,
  isOneTime,
  ownedCosmeticKinds,
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

  it("every cosmetic declares a kind", () => {
    for (const item of SHOP_ITEMS) {
      if (item.type === "cosmetic") expect(item.kind).toBeDefined();
    }
  });

  it("getShopItem resolves known ids and rejects unknown", () => {
    expect(getShopItem("gold-nameplate")?.name).toBe("Gold nameplate");
    expect(getShopItem("does-not-exist")).toBeUndefined();
  });

  it("isOneTime is true for cosmetics", () => {
    expect(isOneTime(getShopItem("gold-nameplate")!)).toBe(true);
  });

  it("ownedCosmeticKinds maps owned ids to kinds and ignores unknowns", () => {
    const kinds = ownedCosmeticKinds(["gold-nameplate", "coral-accent", "bogus"]);
    expect(kinds.has("nameplate")).toBe(true);
    expect(kinds.has("profile-accent")).toBe(true);
    expect(kinds.size).toBe(2);
  });
});
