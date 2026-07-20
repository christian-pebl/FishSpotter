import { describe, expect, it } from "vitest";
import {
  deriveWinningCamps,
  buildCoOccurrenceGraph,
  propagateTrust,
  computeFinalTrustScores,
  isPrizeEligible,
  PRIZE_TRUST_BAR,
  PRIZE_MIN_ACCOUNT_AGE_DAYS,
  PRIZE_MIN_ACTIVE_DAYS,
  PRIZE_MIN_ACTIVITY_SPAN_DAYS,
} from "./trust";

const DAY_MS = 86_400_000;

describe("deriveWinningCamps", () => {
  it("returns one winning camp per snippet that reached threshold, and skips snippets that didn't", () => {
    const answers = [
      { id: "a1", userId: "u1", snippetId: "s1", chosenOption: "Cod" },
      { id: "a2", userId: "u2", snippetId: "s1", chosenOption: "Cod" },
      { id: "a3", userId: "u3", snippetId: "s1", chosenOption: "Cod" },
      { id: "a4", userId: "u1", snippetId: "s2", chosenOption: "Bib" }, // only 1 spotter
    ];
    const camps = deriveWinningCamps(answers);
    expect(camps).toHaveLength(1);
    expect(camps[0]).toMatchObject({ snippetId: "s1", normalisedName: "cod" });
    expect(camps[0].userIds.slice().sort()).toEqual(["u1", "u2", "u3"]);
  });
});

describe("buildCoOccurrenceGraph", () => {
  it("decays a camp aged exactly halfLifeDays to half weight (true half-life, not e-folding)", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const campTime = new Date(now.getTime() - 90 * DAY_MS);
    const camps = [{ snippetId: "s1", normalisedName: "cod", userIds: ["u1", "u2"] }];
    const graph = buildCoOccurrenceGraph(camps, () => campTime, now, 90);
    expect(graph.get("u1")?.get("u2")).toBeCloseTo(0.5, 5);
    expect(graph.get("u2")?.get("u1")).toBeCloseTo(0.5, 5);
  });

  it("sums edge weight across multiple shared camps for the same pair, rather than overwriting", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const camps = [
      { snippetId: "s1", normalisedName: "cod", userIds: ["u1", "u2"] },
      { snippetId: "s2", normalisedName: "cod", userIds: ["u1", "u2"] },
    ];
    const graph = buildCoOccurrenceGraph(camps, () => now, now, 90); // ageDays=0 -> weight 1 each
    expect(graph.get("u1")?.get("u2")).toBeCloseTo(2, 5);
  });

  it("connects every pair within a larger camp, not just consecutive members", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const camps = [{ snippetId: "s1", normalisedName: "cod", userIds: ["u1", "u2", "u3"] }];
    const graph = buildCoOccurrenceGraph(camps, () => now, now, 90);
    expect(graph.get("u1")?.get("u3")).toBeCloseTo(1, 5);
    expect(graph.get("u2")?.get("u3")).toBeCloseTo(1, 5);
  });
});

describe("propagateTrust", () => {
  it("gives seeds only their damped teleport re-injection when the graph has zero edges, and non-seeds exactly zero", () => {
    // With no edges at all, nothing ever propagates -- each round every
    // seed's mass resets to (1-damping)*teleportShare, forever.
    const graph = new Map<string, Map<string, number>>();
    const t = propagateTrust(graph, ["S1", "S2", "A"], ["S1", "S2"], { damping: 0.85, iterations: 5 });
    expect(t.get("S1")).toBeCloseTo(0.15 * 0.5, 6);
    expect(t.get("S2")).toBeCloseTo(0.15 * 0.5, 6);
    expect(t.get("A")).toBe(0);
  });

  it("attenuates trust with graph distance from the seed along a chain", () => {
    // S -- A -- B. A is one hop from the seed, B is two.
    const graph = new Map<string, Map<string, number>>([
      ["S", new Map([["A", 1]])],
      ["A", new Map([["S", 1], ["B", 1]])],
      ["B", new Map([["A", 1]])],
    ]);
    const t = propagateTrust(graph, ["S", "A", "B"], ["S"]);
    expect(t.get("A")!).toBeGreaterThan(t.get("B")!);
    expect(t.get("B")!).toBeGreaterThan(0);
  });

  it("gives an isolated ring EXACTLY zero trust, no matter how densely it agrees with itself", () => {
    // R1/R2/R3 form a fully-connected ring with each other and share zero
    // edges with anyone outside it. S is a seed with no path to the ring.
    const graph = new Map<string, Map<string, number>>([
      ["R1", new Map([["R2", 5], ["R3", 5]])],
      ["R2", new Map([["R1", 5], ["R3", 5]])],
      ["R3", new Map([["R1", 5], ["R2", 5]])],
    ]);
    const t = propagateTrust(graph, ["S", "R1", "R2", "R3"], ["S"]);
    expect(t.get("R1")).toBe(0);
    expect(t.get("R2")).toBe(0);
    expect(t.get("R3")).toBe(0);
  });

  it("breaks isolation (nonzero trust) the moment the ring shares even one camp with a seed-connected user", () => {
    const graph = new Map<string, Map<string, number>>([
      ["S", new Map([["R1", 1]])],
      ["R1", new Map([["S", 1], ["R2", 5], ["R3", 5]])],
      ["R2", new Map([["R1", 5], ["R3", 5]])],
      ["R3", new Map([["R1", 5], ["R2", 5]])],
    ]);
    const t = propagateTrust(graph, ["S", "R1", "R2", "R3"], ["S"]);
    expect(t.get("R1")!).toBeGreaterThan(0);
    expect(t.get("R2")!).toBeGreaterThan(0);
    expect(t.get("R3")!).toBeGreaterThan(0);
  });

  it("resolves a fully dangling (zero-edge) non-seed user to exactly zero, never NaN", () => {
    const graph = new Map<string, Map<string, number>>([["S", new Map([["A", 1]])], ["A", new Map([["S", 1]])]]);
    const t = propagateTrust(graph, ["S", "A", "D"], ["S"]); // D has no edges at all
    expect(t.get("D")).toBe(0);
    expect(Number.isNaN(t.get("D"))).toBe(false);
  });

  it("conserves total mass to ~1 when every node has at least one edge", () => {
    const graph = new Map<string, Map<string, number>>([
      ["S1", new Map([["A", 1]])],
      ["S2", new Map([["A", 1]])],
      ["A", new Map([["S1", 1], ["S2", 1]])],
    ]);
    const t = propagateTrust(graph, ["S1", "S2", "A"], ["S1", "S2"], { iterations: 100 });
    const total = (t.get("S1") ?? 0) + (t.get("S2") ?? 0) + (t.get("A") ?? 0);
    expect(total).toBeCloseTo(1, 3);
  });
});

describe("computeFinalTrustScores", () => {
  it("pins a newly-flagged seed to exactly 100, never blending with its pre-seed history (Bug 1 regression)", () => {
    const rawScores = new Map([["dani", 0.1], ["seed2", 0.2]]);
    const users = [
      { userId: "dani", isTrustSeed: true, trustScore: 15, trustUpdatedAt: new Date("2026-01-01") },
      { userId: "seed2", isTrustSeed: true, trustScore: 100, trustUpdatedAt: new Date("2026-01-01") },
    ];
    const result = computeFinalTrustScores(rawScores, users) as Map<string, number>;
    expect(result.get("dani")).toBe(100);
  });

  it("short-circuits to skipped rather than dividing by a zero seed median (Bug 3 regression)", () => {
    const rawScores = new Map([["u1", 0.5]]);
    const users = [{ userId: "u1", isTrustSeed: false, trustScore: 0, trustUpdatedAt: null }];
    const result = computeFinalTrustScores(rawScores, users);
    expect(result).toEqual({ skipped: "no-seeds" });
  });

  it("takes the scaled value directly on a user's first-ever computation (no blending against a meaningless zero)", () => {
    const rawScores = new Map([["seed", 1], ["u1", 0.5]]);
    const users = [
      { userId: "seed", isTrustSeed: true, trustScore: 0, trustUpdatedAt: null },
      { userId: "u1", isTrustSeed: false, trustScore: 0, trustUpdatedAt: null },
    ];
    const result = computeFinalTrustScores(rawScores, users) as Map<string, number>;
    // seedMedianRaw = 1 (one seed); u1 scaled = 100 * 0.5 / 1 = 50, first run so no blend.
    expect(result.get("u1")).toBe(50);
  });

  it("blends 0.3/0.7 with the previous stored value on subsequent runs", () => {
    const rawScores = new Map([["seed", 1], ["u1", 1]]);
    const users = [
      { userId: "seed", isTrustSeed: true, trustScore: 0, trustUpdatedAt: new Date() },
      { userId: "u1", isTrustSeed: false, trustScore: 10, trustUpdatedAt: new Date("2026-01-01") },
    ];
    const result = computeFinalTrustScores(rawScores, users) as Map<string, number>;
    // scaled = 100 * 1/1 = 100; blended = 0.3*100 + 0.7*10 = 37
    expect(result.get("u1")).toBeCloseTo(37, 6);
  });

  it("pins an isolated seed's own score to 100 even though its raw propagated value is near-zero, while an isolated non-seed stays 0", () => {
    const rawScores = propagateTrust(new Map(), ["S", "A"], ["S"]);
    const result = computeFinalTrustScores(rawScores, [
      { userId: "S", isTrustSeed: true, trustScore: 0, trustUpdatedAt: null },
      { userId: "A", isTrustSeed: false, trustScore: 0, trustUpdatedAt: null },
    ]) as Map<string, number>;
    expect(result.get("S")).toBe(100);
    expect(result.get("A")).toBe(0);
  });
});

describe("isPrizeEligible", () => {
  const now = new Date("2026-07-20T00:00:00Z");
  const base = {
    emailVerified: new Date("2026-01-01"),
    createdAt: new Date("2026-01-01"),
    trustScore: 100,
    answerDates: [
      new Date(Date.UTC(2026, 6, 1)),
      new Date(Date.UTC(2026, 6, 5)),
      new Date(Date.UTC(2026, 6, 10)),
      new Date(Date.UTC(2026, 6, 14)),
      new Date(Date.UTC(2026, 6, 18)),
    ], // 5 distinct days, 17-day span
  };

  it("is eligible when every gate passes", () => {
    const r = isPrizeEligible(base, now);
    expect(r).toEqual({ eligible: true, reasons: [] });
  });

  it("fails on unverified email", () => {
    const r = isPrizeEligible({ ...base, emailVerified: null }, now);
    expect(r.reasons).toContain("email not verified");
  });

  it("fails on trust below the bar, passes at exactly the bar (>= not >)", () => {
    expect(isPrizeEligible({ ...base, trustScore: PRIZE_TRUST_BAR - 1 }, now).reasons).toContain(
      "trust score below bar",
    );
    expect(isPrizeEligible({ ...base, trustScore: PRIZE_TRUST_BAR }, now).reasons).not.toContain(
      "trust score below bar",
    );
  });

  it("fails on an account younger than the minimum age, passes at exactly the boundary (>= not >)", () => {
    const young = new Date(now.getTime() - (PRIZE_MIN_ACCOUNT_AGE_DAYS - 1) * DAY_MS);
    const boundary = new Date(now.getTime() - PRIZE_MIN_ACCOUNT_AGE_DAYS * DAY_MS);
    expect(isPrizeEligible({ ...base, createdAt: young }, now).reasons).toContain("account too new");
    expect(isPrizeEligible({ ...base, createdAt: boundary }, now).reasons).not.toContain("account too new");
  });

  it("fails with no activity at all", () => {
    const r = isPrizeEligible({ ...base, answerDates: [] }, now);
    expect(r.reasons).toContain("no activity yet");
  });

  it("fails on too few distinct active days even with a wide span", () => {
    const r = isPrizeEligible(
      { ...base, answerDates: [new Date(Date.UTC(2026, 6, 1)), new Date(Date.UTC(2026, 6, 18))] },
      now,
    );
    expect(r.reasons).toContain("activity too bursty (too few distinct days)");
  });

  it("fails on too short a span even with enough distinct days", () => {
    const burst = Array.from(
      { length: PRIZE_MIN_ACTIVE_DAYS },
      (_, i) => new Date(Date.UTC(2026, 6, 1 + i)),
    ); // PRIZE_MIN_ACTIVE_DAYS consecutive days -- plenty of distinct days, tiny span
    const r = isPrizeEligible({ ...base, answerDates: burst }, now);
    expect(r.reasons).toContain("activity too bursty (too short a span)");
  });

  it("documented gap: a burst plus one token day still clears both activity gates", () => {
    // PRIZE_MIN_ACTIVE_DAYS-1 clustered days + one token day exactly
    // PRIZE_MIN_ACTIVITY_SPAN_DAYS later. Accepted v1 looseness (see
    // isPrizeEligible's docstring) -- trust-graph connectivity is the real
    // bottleneck for an attacker, not day-spacing.
    const gamed = [
      ...Array.from({ length: PRIZE_MIN_ACTIVE_DAYS - 1 }, (_, i) => new Date(Date.UTC(2026, 6, 1 + i))),
      new Date(Date.UTC(2026, 6, 1) + PRIZE_MIN_ACTIVITY_SPAN_DAYS * DAY_MS),
    ];
    const r = isPrizeEligible({ ...base, answerDates: gamed }, now);
    expect(r.reasons).not.toContain("activity too bursty (too few distinct days)");
    expect(r.reasons).not.toContain("activity too bursty (too short a span)");
  });

  it("a guest-shaped input (unverified, high trust) is still ineligible", () => {
    const r = isPrizeEligible({ ...base, emailVerified: null, trustScore: 200 }, now);
    expect(r.eligible).toBe(false);
    expect(r.reasons).toEqual(["email not verified"]);
  });
});
