import { describe, expect, it } from "vitest";
import { MIN_ANSWERS_FOR_RANKING, rankSpotters, scoreSpotter } from "./leaderboard";

describe("scoreSpotter", () => {
  it("scores by correct count only (the previous formula rewarded wrong answers)", () => {
    // 100 random answers with 50% accuracy under the OLD formula would have
    // scored 50 + 50 * 0.5 = 75. Under the new formula it's 50.
    expect(scoreSpotter({ correct: 50, total: 100 })).toBe(50);
    expect(scoreSpotter({ correct: 0, total: 100 })).toBe(0);
    expect(scoreSpotter({ correct: 12, total: 12 })).toBe(12);
  });
});

describe("rankSpotters", () => {
  it("filters out spotters below the minimum-answer threshold", () => {
    const ranked = rankSpotters([
      { userId: "regular", correct: 5, total: 12 },
      { userId: "drive-by", correct: 1, total: 1 },
      { userId: "almost", correct: 8, total: MIN_ANSWERS_FOR_RANKING - 1 },
    ]);
    expect(ranked.map((r) => r.userId)).toEqual(["regular"]);
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
    expect(
      rankSpotters([
        { userId: "x", correct: 0, total: 0 },
        { userId: "y", correct: 3, total: 5 },
      ]),
    ).toEqual([]);
  });

  it("100 random answers at 50% accuracy scores 50, NOT 75 (regression test for §05 F-LB-02)", () => {
    const ranked = rankSpotters([{ userId: "u", correct: 50, total: 100 }]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].score).toBe(50);
    expect(ranked[0].rank).toBe(1);
  });
});
