import { describe, expect, it } from "vitest";
import { MIN_ANSWERS_FOR_RANKING, rankSpotters, scoreSpotter } from "./leaderboard";

describe("scoreSpotter", () => {
  it("falls back to correct count when points isn't provided (legacy callers)", () => {
    // 100 random answers with 50% accuracy under the OLD formula would have
    // scored 50 + 50 * 0.5 = 75. The S2-T03 formula scored 50. The S7-T1
    // formula scores by Answer.points sum — but when callers don't pass
    // points, we keep the S2-T03 semantics for back-compat.
    expect(scoreSpotter({ userId: "u", correct: 50, total: 100 })).toBe(50);
    expect(scoreSpotter({ userId: "u", correct: 0, total: 100 })).toBe(0);
    expect(scoreSpotter({ userId: "u", correct: 12, total: 12 })).toBe(12);
  });

  it("uses sum-of-points when provided (S7-T1)", () => {
    // 5 correct (10 pts) + 3 pending (3 pts) + 2 wrong (0 pts) = 13.
    expect(
      scoreSpotter({ userId: "u", correct: 5, total: 10, points: 13 }),
    ).toBe(13);
    // Points takes precedence even when it'd equal correct count.
    expect(
      scoreSpotter({ userId: "u", correct: 10, total: 10, points: 20 }),
    ).toBe(20);
  });
});

describe("rankSpotters", () => {
  it("filters out only spotters with zero answers -- a single guess qualifies", () => {
    const ranked = rankSpotters([
      { userId: "regular", correct: 5, total: 12 },
      { userId: "one-guess", correct: 1, total: 1 },
      { userId: "never-answered", correct: 0, total: MIN_ANSWERS_FOR_RANKING - 1 },
    ]);
    expect(ranked.map((r) => r.userId)).toEqual(["regular", "one-guess"]);
  });

  it("uses shared ranks for tied scores (1, 2, 2, 4 style)", () => {
    const ranked = rankSpotters([
      { userId: "a", correct: 15, total: 20 },
      { userId: "b", correct: 12, total: 20 },
      { userId: "c", correct: 12, total: 20 },
      { userId: "d", correct: 8, total: 20 },
    ]);
    expect(ranked.map((r) => `${r.userId}=${r.rank}`)).toEqual([
      "a=1",
      "b=2",
      "c=2",
      "d=4",
    ]);
  });

  it("breaks ties on the accuracy ratio so the order is deterministic", () => {
    const ranked = rankSpotters([
      // Both score 12. accuracy: b=12/15=0.8, c=12/20=0.6 → b ranks higher
      { userId: "c", correct: 12, total: 20 },
      { userId: "b", correct: 12, total: 15 },
    ]);
    expect(ranked.map((r) => r.userId)).toEqual(["b", "c"]);
    // Same rank because the score is tied.
    expect(ranked.map((r) => r.rank)).toEqual([1, 1]);
  });

  it("yields stable ordering when scores AND accuracy are tied (userId fallback)", () => {
    const ranked = rankSpotters([
      { userId: "zz", correct: 10, total: 10 },
      { userId: "aa", correct: 10, total: 10 },
    ]);
    expect(ranked.map((r) => r.userId)).toEqual(["aa", "zz"]);
  });

  it("returns an empty list when no spotter is eligible", () => {
    expect(rankSpotters([{ userId: "x", correct: 0, total: 0 }])).toEqual([]);
  });

  it("100 random answers at 50% accuracy scores 50, NOT 75 (regression test for §05 F-LB-02)", () => {
    const ranked = rankSpotters([{ userId: "u", correct: 50, total: 100 }]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].score).toBe(50);
    expect(ranked[0].rank).toBe(1);
  });

  it("ranks by points sum when supplied — a user with pending answers beats a user with the same correct count and no pending (S7-T1)", () => {
    // Spotter A: 10 correct, 0 pending → 20 pts
    // Spotter B: 10 correct, 5 pending → 25 pts (beats A)
    const ranked = rankSpotters([
      { userId: "A", correct: 10, total: 10, points: 20 },
      { userId: "B", correct: 10, total: 15, points: 25 },
    ]);
    expect(ranked.map((r) => r.userId)).toEqual(["B", "A"]);
    expect(ranked[0].score).toBe(25);
    expect(ranked[1].score).toBe(20);
  });

  it("a user with one pending + one correct beats a user with two pending (S7-T1)", () => {
    // A: 1 correct (2 pts) + 1 pending (1 pt) = 3
    // B: 0 correct (0 pts) + 2 pending (2 pts) = 2
    const ranked = rankSpotters([
      { userId: "A", correct: 1, total: 2, points: 3 },
      { userId: "B", correct: 0, total: 2, points: 2 },
    ]);
    expect(ranked.map((r) => r.userId)).toEqual(["A", "B"]);
  });
});
