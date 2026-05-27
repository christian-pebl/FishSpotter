import { describe, expect, it } from "vitest";
import { eligibleGroups, groupPendingAnswers } from "./consensus";
import { CONSENSUS_THRESHOLD_USERS } from "./answer-matching";

function ans(
  id: string,
  userId: string,
  snippetId: string,
  chosenOption: string,
) {
  return { id, userId, snippetId, chosenOption };
}

describe("groupPendingAnswers", () => {
  it("groups by (snippetId, normalisedName)", () => {
    const groups = groupPendingAnswers([
      ans("a1", "u1", "snip1", "Pollack"),
      ans("a2", "u2", "snip1", "Pollack"),
      ans("a3", "u3", "snip1", "Cod"),
    ]);
    expect(groups).toHaveLength(2);
    const pollack = groups.find((g) => g.normalisedName.includes("pollack"))!;
    expect(pollack.userIds.size).toBe(2);
    expect(pollack.answers.map((a) => a.id).sort()).toEqual(["a1", "a2"]);
  });

  it("normalises whitespace and case", () => {
    const groups = groupPendingAnswers([
      ans("a1", "u1", "snip1", "Pollack"),
      ans("a2", "u2", "snip1", "pollack "),
      ans("a3", "u3", "snip1", "POLLACK"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].userIds.size).toBe(3);
  });

  it("does NOT collapse spelling variants (strict equality)", () => {
    const groups = groupPendingAnswers([
      ans("a1", "u1", "snip1", "Pollack"),
      ans("a2", "u2", "snip1", "Pollock"),
    ]);
    // Pollack vs Pollock differ by one letter and would only collapse via
    // an alias table. For v1 we keep grouping strict.
    expect(groups).toHaveLength(2);
  });

  it("keeps groups per-snippet", () => {
    const groups = groupPendingAnswers([
      ans("a1", "u1", "snip1", "Pollack"),
      ans("a2", "u2", "snip2", "Pollack"),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.userIds.size === 1)).toBe(true);
  });

  it("skips empty / whitespace-only answers", () => {
    const groups = groupPendingAnswers([
      ans("a1", "u1", "snip1", "Pollack"),
      ans("a2", "u2", "snip1", "  "),
      ans("a3", "u3", "snip1", ""),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].userIds.size).toBe(1);
  });
});

describe("eligibleGroups", () => {
  it(`filters groups below the ${CONSENSUS_THRESHOLD_USERS}-user threshold`, () => {
    const groups = groupPendingAnswers([
      ans("a1", "u1", "snip1", "Pollack"),
      ans("a2", "u2", "snip1", "Pollack"),
      ans("a3", "u3", "snip2", "Cod"),
      ans("a4", "u4", "snip2", "Cod"),
      ans("a5", "u5", "snip2", "Cod"),
    ]);
    const eligible = eligibleGroups(groups);
    expect(eligible).toHaveLength(1);
    expect(eligible[0].snippetId).toBe("snip2");
  });

  it("returns empty when no group reaches threshold", () => {
    const groups = groupPendingAnswers([
      ans("a1", "u1", "snip1", "Pollack"),
      ans("a2", "u2", "snip1", "Pollack"),
    ]);
    expect(eligibleGroups(groups)).toEqual([]);
  });

  it(`counts DISTINCT users, not Answer rows`, () => {
    // The schema enforces one Answer per (userId, snippetId) so this case
    // can't actually happen, but the count should still be on userIds.
    const groups = groupPendingAnswers([
      ans("a1", "u1", "snip1", "Pollack"),
      ans("a2", "u2", "snip1", "Pollack"),
    ]);
    expect(eligibleGroups(groups)).toEqual([]);
    expect(groups[0].userIds.size).toBe(2);
  });
});
