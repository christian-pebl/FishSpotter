import { describe, expect, it } from "vitest";
import { canPurchase, totalSpent, walletState } from "./wallet";
import { FSC_GUIDE_ID, getShopItem } from "./catalogue";

const GUIDE = getShopItem(FSC_GUIDE_ID)!;

describe("wallet math", () => {
  it("totalSpent sums snapshotted costs", () => {
    expect(totalSpent([])).toBe(0);
    expect(totalSpent([{ pebbleCost: 150 }, { pebbleCost: 300 }])).toBe(450);
  });

  it("walletState = earned - spent, never negative", () => {
    expect(walletState(500, [{ pebbleCost: 150 }])).toEqual({
      earned: 500,
      spent: 150,
      wallet: 350,
    });
    // Wallet clamps at 0 even if a price later exceeded a shrunk balance.
    expect(walletState(100, [{ pebbleCost: 150 }]).wallet).toBe(0);
  });
});

describe("canPurchase", () => {
  it("rejects unknown items", () => {
    expect(canPurchase("nope", 9999, new Set())).toMatchObject({
      ok: false,
      error: "unknown-item",
    });
  });

  it("rejects a one-time item already owned", () => {
    const owned = new Set([GUIDE.id]);
    expect(canPurchase(GUIDE.id, 9999, owned)).toMatchObject({
      ok: false,
      error: "already-owned",
    });
  });

  it("rejects when the wallet can't cover the price", () => {
    expect(canPurchase(GUIDE.id, GUIDE.price - 1, new Set())).toMatchObject({
      ok: false,
      error: "insufficient",
    });
  });

  it("allows an affordable, unowned item", () => {
    const res = canPurchase(GUIDE.id, GUIDE.price, new Set());
    expect(res.ok).toBe(true);
    expect(res.item?.id).toBe(GUIDE.id);
  });
});
