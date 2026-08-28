import { describe, it, expect } from "vitest";
import {
  CATEGORIES,
  CATEGORY_ORDER,
  milestonesReached,
  nextMilestone,
  milestoneProgress,
  rankWithin,
  ZERO_COUNTS,
  type CategoryId,
} from "@/lib/badges";

describe("category definitions", () => {
  it("has exactly three categories", () => {
    expect(CATEGORY_ORDER).toHaveLength(3);
    expect(Object.keys(CATEGORIES)).toHaveLength(3);
  });

  it("leads with pioneer, the hardest one", () => {
    expect(CATEGORY_ORDER[0]).toBe("pioneer");
  });

  it("gives every category exactly three ascending milestones", () => {
    for (const id of CATEGORY_ORDER) {
      const m = CATEGORIES[id].milestones;
      expect(m).toHaveLength(3);
      expect([...m].sort((a, b) => a - b)).toEqual([...m]);
    }
  });

  it("defines nine milestones in total", () => {
    const all = CATEGORY_ORDER.flatMap((id) => [...CATEGORIES[id].milestones]);
    expect(all).toHaveLength(9);
  });

  it("keeps the ladders Christian set", () => {
    expect(CATEGORIES.pioneer.milestones).toEqual([10, 25, 50]);
    expect(CATEGORIES.consensus.milestones).toEqual([20, 50, 100]);
    expect(CATEGORIES.pathfinder.milestones).toEqual([30, 75, 150]);
  });

  it("makes pioneer the scarcest ladder at every rung", () => {
    // Being first AND right must never be easier than the other two.
    for (let i = 0; i < 3; i++) {
      expect(CATEGORIES.pioneer.milestones[i]).toBeLessThan(
        CATEGORIES.consensus.milestones[i],
      );
      expect(CATEGORIES.consensus.milestones[i]).toBeLessThan(
        CATEGORIES.pathfinder.milestones[i],
      );
    }
  });

  it("has a zero for every category in ZERO_COUNTS", () => {
    for (const id of CATEGORY_ORDER) {
      expect(ZERO_COUNTS[id as CategoryId]).toBe(0);
    }
  });
});

describe("milestonesReached", () => {
  const m = [10, 25, 50] as const;

  it("is 0 below the first rung", () => {
    expect(milestonesReached(0, m)).toBe(0);
    expect(milestonesReached(9, m)).toBe(0);
  });

  it("counts a rung on reaching it exactly", () => {
    expect(milestonesReached(10, m)).toBe(1);
    expect(milestonesReached(25, m)).toBe(2);
    expect(milestonesReached(50, m)).toBe(3);
  });

  it("never exceeds three", () => {
    expect(milestonesReached(9999, m)).toBe(3);
  });
});

describe("nextMilestone", () => {
  const m = [20, 50, 100] as const;

  it("points at the first unmet rung", () => {
    expect(nextMilestone(0, m)).toBe(20);
    expect(nextMilestone(20, m)).toBe(50);
    expect(nextMilestone(99, m)).toBe(100);
  });

  it("is null once all three are held", () => {
    expect(nextMilestone(100, m)).toBeNull();
  });
});

describe("milestoneProgress", () => {
  const m = [10, 25, 50] as const;

  it("measures from the previous rung, not from zero", () => {
    // 17 is 7 of the way through the 10 -> 25 span, not 17/25.
    expect(milestoneProgress(17, m)).toBeCloseTo(7 / 15, 5);
  });

  it("is 0 at the start and 1 when complete", () => {
    expect(milestoneProgress(0, m)).toBe(0);
    expect(milestoneProgress(50, m)).toBe(1);
    expect(milestoneProgress(9999, m)).toBe(1);
  });

  it("resets after crossing a rung rather than staying near full", () => {
    // The reason for measuring from the floor: crossing 10 must not leave the
    // bar at 40% of the way to 25 looking almost done.
    expect(milestoneProgress(10, m)).toBe(0);
    expect(milestoneProgress(9, m)).toBeCloseTo(0.9, 5);
  });

  it("stays within 0..1", () => {
    for (const n of [0, 1, 10, 24, 25, 49, 50, 500]) {
      const p = milestoneProgress(n, m);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});

describe("rankWithin", () => {
  it("ranks a spotter among those with a non-zero count", () => {
    expect(rankWithin(26, [26, 20, 16, 14])).toEqual({ rank: 1, of: 4 });
    expect(rankWithin(16, [26, 20, 16, 14])).toEqual({ rank: 3, of: 4 });
  });

  it("shares a rank on a tie rather than breaking it arbitrarily", () => {
    expect(rankWithin(20, [26, 20, 20, 14])).toEqual({ rank: 2, of: 4 });
  });

  it("excludes zero-count spotters from the field", () => {
    // Being told you are 48th of 48 for having done nothing is a punishment,
    // not a credential, so they are not counted in the denominator.
    expect(rankWithin(5, [5, 3, 0, 0, 0])).toEqual({ rank: 1, of: 2 });
  });

  it("returns null for a spotter with nothing on this category", () => {
    expect(rankWithin(0, [5, 3])).toBeNull();
  });

  it("returns null when nobody has anything", () => {
    expect(rankWithin(0, [0, 0])).toBeNull();
  });
});
