import { describe, it, expect } from "vitest";
import {
  PEBBLE_BASE_SIGHTING,
  PEBBLE_EARLY_SPOTTER,
  PEBBLE_CONSENSUS,
  CONSENSUS_THRESHOLD_USERS,
  CURRENT_MAX_MULTIPLIER,
  consensusTier,
  rarityForProbability,
  currentMultiplier,
  reliabilityStreak,
  immediateAward,
  consensusPayout,
  isContested,
} from "@/lib/pebbles";

describe("immediateAward", () => {
  it("pays base + First Sighting to the first spotter on a clip", () => {
    const a = immediateAward(0);
    expect(a.firstSighting).toBe(true);
    expect(a.pebbles).toBe(PEBBLE_BASE_SIGHTING + PEBBLE_EARLY_SPOTTER[0]);
  });

  it("tapers the early-spotter bonus for the 2nd and 3rd spotters", () => {
    expect(immediateAward(1).pebbles).toBe(PEBBLE_BASE_SIGHTING + PEBBLE_EARLY_SPOTTER[1]);
    expect(immediateAward(2).pebbles).toBe(PEBBLE_BASE_SIGHTING + PEBBLE_EARLY_SPOTTER[2]);
    expect(immediateAward(1).firstSighting).toBe(false);
  });

  it("pays only the base once the early window has passed", () => {
    expect(immediateAward(3).pebbles).toBe(PEBBLE_BASE_SIGHTING);
    expect(immediateAward(50).pebbles).toBe(PEBBLE_BASE_SIGHTING);
  });
});

describe("consensusTier", () => {
  it("classifies by arrival order on the clip", () => {
    expect(consensusTier(0)).toBe("pioneer");
    expect(consensusTier(CONSENSUS_THRESHOLD_USERS - 1)).toBe("pioneer");
    expect(consensusTier(CONSENSUS_THRESHOLD_USERS)).toBe("joiner");
    expect(consensusTier(CONSENSUS_THRESHOLD_USERS * 2 - 1)).toBe("joiner");
    expect(consensusTier(CONSENSUS_THRESHOLD_USERS * 2)).toBe("confirmer");
    expect(consensusTier(99)).toBe("confirmer");
  });

  it("pays pioneers more than joiners more than confirmers", () => {
    expect(PEBBLE_CONSENSUS.pioneer).toBeGreaterThan(PEBBLE_CONSENSUS.joiner);
    expect(PEBBLE_CONSENSUS.joiner).toBeGreaterThan(PEBBLE_CONSENSUS.confirmer);
  });
});

describe("rarityForProbability", () => {
  it("is neutral when we have no bucket data (never inflates on missing data)", () => {
    expect(rarityForProbability(null, false)).toEqual({ tier: "common", multiplier: 1 });
    expect(rarityForProbability(0.5, false).multiplier).toBe(1);
  });

  it("awards legendary when the species is absent from a populated bucket", () => {
    expect(rarityForProbability(null, true)).toEqual({ tier: "legendary", multiplier: 5 });
    expect(rarityForProbability(0, true).tier).toBe("legendary");
  });

  it("maps probability bands to ascending multipliers", () => {
    expect(rarityForProbability(0.4, true).tier).toBe("common");
    expect(rarityForProbability(0.1, true).tier).toBe("frequent");
    expect(rarityForProbability(0.05, true).tier).toBe("uncommon");
    expect(rarityForProbability(0.02, true).tier).toBe("rare");
    expect(rarityForProbability(0.005, true).tier).toBe("epic");
  });

  it("multiplier rises monotonically as probability falls", () => {
    const ps = [0.4, 0.1, 0.05, 0.02, 0.005];
    const mults = ps.map((p) => rarityForProbability(p, true).multiplier);
    for (let i = 1; i < mults.length; i++) {
      expect(mults[i]).toBeGreaterThan(mults[i - 1]);
    }
  });
});

describe("currentMultiplier", () => {
  it("is neutral for a streak of 0 or 1", () => {
    expect(currentMultiplier(0)).toBe(1);
    expect(currentMultiplier(1)).toBe(1);
  });

  it("adds 0.2 per vindicated call and caps", () => {
    expect(currentMultiplier(2)).toBeCloseTo(1.2);
    expect(currentMultiplier(4)).toBeCloseTo(1.6);
    expect(currentMultiplier(100)).toBe(CURRENT_MAX_MULTIPLIER);
  });
});

describe("reliabilityStreak", () => {
  const leaders = new Map<string, string>([
    ["s1", "pollack"],
    ["s2", "saithe"],
    ["s3", "cod"],
  ]);

  it("counts consecutive vindicated calls newest-first", () => {
    const answers = [
      { snippetId: "s1", matchKey: "pollack" },
      { snippetId: "s2", matchKey: "saithe" },
    ];
    expect(reliabilityStreak(answers, leaders)).toBe(2);
  });

  it("skips pending snippets without breaking the streak", () => {
    const answers = [
      { snippetId: "sX", matchKey: "whatever" }, // not in leaders → pending
      { snippetId: "s1", matchKey: "pollack" },
    ];
    expect(reliabilityStreak(answers, leaders)).toBe(1);
  });

  it("breaks on a confirmed miss", () => {
    const answers = [
      { snippetId: "s1", matchKey: "pollack" },
      { snippetId: "s3", matchKey: "haddock" }, // consensus was "cod" → miss
      { snippetId: "s2", matchKey: "saithe" },
    ];
    expect(reliabilityStreak(answers, leaders)).toBe(1);
  });
});

describe("consensusPayout", () => {
  it("multiplies tier base by rarity and current, rounded", () => {
    expect(consensusPayout("pioneer", 1, 1)).toBe(PEBBLE_CONSENSUS.pioneer);
    expect(consensusPayout("pioneer", 2.5, 1.6)).toBe(Math.round(30 * 2.5 * 1.6));
    expect(consensusPayout("confirmer", 1, 1)).toBe(PEBBLE_CONSENSUS.confirmer);
  });
});

describe("isContested", () => {
  it("is false below the spotter threshold", () => {
    expect(isContested([{ count: 1 }, { count: 1 }], 2)).toBe(false);
  });

  it("flags a near-tie", () => {
    expect(isContested([{ count: 4 }, { count: 4 }, { count: 1 }], 9)).toBe(true);
  });

  it("flags a strong runner-up (>=35%)", () => {
    expect(isContested([{ count: 6 }, { count: 4 }], 10)).toBe(true);
  });

  it("is false for a clear leader", () => {
    expect(isContested([{ count: 9 }, { count: 1 }], 10)).toBe(false);
  });
});
