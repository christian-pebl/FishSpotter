import { describe, it, expect } from "vitest";
import {
  BADGES,
  awardBadge,
  awardBadges,
  tierFor,
  rarityRank,
  atLeastAsRare,
  rarerOf,
  RARITY_ORDER,
  DEEP_PIONEER_MIN_RARITY,
  type BadgeCounts,
} from "@/lib/badges";

const NONE: BadgeCounts = {
  confirmed: 0,
  pathfinder: 0,
  current: 0,
  pioneer: 0,
  "deep-pioneer": 0,
};

describe("tierFor", () => {
  it("is 0 below the first threshold", () => {
    expect(tierFor(0, [1, 5, 10])).toBe(0);
  });

  it("awards on reaching a threshold exactly", () => {
    expect(tierFor(1, [1, 5, 10])).toBe(1);
    expect(tierFor(5, [1, 5, 10])).toBe(2);
    expect(tierFor(10, [1, 5, 10])).toBe(3);
  });

  it("does not overrun the top tier", () => {
    expect(tierFor(9999, [1, 5, 10])).toBe(3);
  });
});

describe("awardBadge", () => {
  it("returns null when the ladder has not been started", () => {
    expect(awardBadge("pioneer", 0)).toBeNull();
  });

  it("reports the next threshold while one remains", () => {
    const b = awardBadge("pioneer", 1);
    expect(b?.tier).toBe(1);
    expect(b?.nextAt).toBe(3);
    expect(b?.maxTier).toBe(BADGES.pioneer.tiers.length);
  });

  it("reports nextAt null once maxed", () => {
    expect(awardBadge("pioneer", 10)?.nextAt).toBeNull();
  });

  it("carries the raw count through for display", () => {
    expect(awardBadge("confirmed", 26)?.count).toBe(26);
  });
});

describe("awardBadges", () => {
  it("returns nothing for a spotter who has earned nothing", () => {
    expect(awardBadges(NONE)).toEqual([]);
  });

  it("leads with the rarest credential, not the biggest number", () => {
    // A spotter with lots of volume but one elite call: the elite badge leads.
    const awarded = awardBadges({
      ...NONE,
      confirmed: 100,
      pathfinder: 25,
      "deep-pioneer": 1,
    });
    expect(awarded[0]?.id).toBe("deep-pioneer");
  });

  it("omits ladders that are still at zero", () => {
    const ids = awardBadges({ ...NONE, confirmed: 3 }).map((b) => b.id);
    expect(ids).toEqual(["confirmed"]);
  });
});

describe("ladder design invariants", () => {
  it("keeps every ladder ascending", () => {
    for (const def of Object.values(BADGES)) {
      const sorted = [...def.tiers].sort((a, b) => a - b);
      expect(def.tiers).toEqual(sorted);
    }
  });

  it("makes pioneer scarcer than raw volume at the top", () => {
    // The whole point: being first AND right must be harder than piling up
    // confirmations, so the pioneer ladder must top out lower.
    const topPioneer = BADGES.pioneer.tiers.at(-1)!;
    const topConfirmed = BADGES.confirmed.tiers.at(-1)!;
    expect(topPioneer).toBeLessThan(topConfirmed);
  });

  it("gates Deep Water Pioneer above the midpoint of the rarity scale", () => {
    expect(rarityRank(DEEP_PIONEER_MIN_RARITY)).toBeGreaterThanOrEqual(
      Math.floor(RARITY_ORDER.length / 2),
    );
  });
});

describe("rarity helpers", () => {
  it("orders the tiers common through legendary", () => {
    expect(rarityRank("common")).toBeLessThan(rarityRank("legendary"));
    expect(rarityRank("rare")).toBeLessThan(rarityRank("epic"));
  });

  it("treats a tier as at least as rare as itself", () => {
    expect(atLeastAsRare("rare", "rare")).toBe(true);
    expect(atLeastAsRare("uncommon", "rare")).toBe(false);
    expect(atLeastAsRare("legendary", "rare")).toBe(true);
  });

  it("picks the rarer of two tiers", () => {
    expect(rarerOf("common", "epic")).toBe("epic");
    expect(rarerOf("legendary", "rare")).toBe("legendary");
  });
});
