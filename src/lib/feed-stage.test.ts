import { describe, expect, it } from "vitest";
import { indexAtScroll, stageIndex } from "./feed-stage";

describe("indexAtScroll", () => {
  it("is the card the feed is snapped to", () => {
    expect(indexAtScroll(0, 844, 10)).toBe(0);
    expect(indexAtScroll(844 * 3, 844, 10)).toBe(3);
  });

  it("changes card at the halfway point, like the old 0.5 threshold", () => {
    expect(indexAtScroll(421, 844, 10)).toBe(0);
    expect(indexAtScroll(423, 844, 10)).toBe(1);
  });

  it("stays inside the feed", () => {
    expect(indexAtScroll(-50, 844, 10)).toBe(0);
    expect(indexAtScroll(844 * 40, 844, 10)).toBe(9);
  });

  it("has no answer before there is a card or a height", () => {
    expect(indexAtScroll(0, 844, 0)).toBe(-1);
    expect(indexAtScroll(0, 0, 10)).toBe(-1);
  });
});

describe("stageIndex", () => {
  it("follows the card on stage through a reorder, not its old slot", () => {
    // "b" was on stage at index 1; "a" above it was sent to the back.
    expect(stageIndex(["b", "c", "d", "a"], { key: "b", index: 1 })).toBe(0);
    // A reshuffle that moved "b" far down keeps "b" on stage.
    expect(stageIndex(["c", "d", "a", "b"], { key: "b", index: 1 })).toBe(3);
  });

  it("falls back to the last index when the card has left the feed", () => {
    expect(stageIndex(["a", "c", "d"], { key: "b", index: 1 })).toBe(1);
    expect(stageIndex(["a"], { key: "b", index: 5 })).toBe(0);
  });

  it("uses the index before any card has been keyed", () => {
    expect(stageIndex(["a", "b"], { key: null, index: 0 })).toBe(0);
    expect(stageIndex([], { key: null, index: 0 })).toBe(0);
  });
});
