import { describe, expect, it } from "vitest";
import { bucketAnswersByNormalized } from "./answer-histogram";

describe("bucketAnswersByNormalized", () => {
  it("groups case + whitespace + article variants into one bucket", () => {
    const result = bucketAnswersByNormalized([
      { chosenOption: "Pollack" },
      { chosenOption: "Pollack" },
      { chosenOption: "Pollack" },
      { chosenOption: "Pollack" },
      { chosenOption: "Pollack" },
      { chosenOption: "pollack" },
      { chosenOption: "pollack" },
      { chosenOption: "pollack" },
      { chosenOption: "the pollack" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ option: "Pollack", count: 9 });
  });

  it("uses preferredCanonical when bucket key matches it", () => {
    const result = bucketAnswersByNormalized(
      [
        { chosenOption: "pollack" },
        { chosenOption: "pollack" },
        { chosenOption: "pollack" },
      ],
      "Pollack",
    );
    expect(result).toHaveLength(1);
    expect(result[0].option).toBe("Pollack");
  });

  it("picks the most-frequent surface form when no preferred match", () => {
    const result = bucketAnswersByNormalized([
      { chosenOption: "cod" },
      { chosenOption: "Cod" },
      { chosenOption: "Cod" },
      { chosenOption: "Cod" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ option: "Cod", count: 4 });
  });

  it("breaks frequency ties via localeCompare (deterministic order)", () => {
    const result = bucketAnswersByNormalized([
      { chosenOption: "wrasse" },
      { chosenOption: "Wrasse" },
    ]);
    // One bucket; both forms have count 1. localeCompare is locale-
    // dependent; we just need the order to be deterministic across
    // repeated calls.
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
    const first = result[0].option;
    const repeat = bucketAnswersByNormalized([
      { chosenOption: "wrasse" },
      { chosenOption: "Wrasse" },
    ]);
    expect(repeat[0].option).toBe(first);
  });

  it("ignores empty / whitespace-only chosenOption", () => {
    const result = bucketAnswersByNormalized([
      { chosenOption: "" },
      { chosenOption: "   " },
      { chosenOption: "cod" },
    ]);
    expect(result).toEqual([{ option: "cod", count: 1 }]);
  });

  it("returns a separate bucket per distinct normalised key", () => {
    const result = bucketAnswersByNormalized([
      { chosenOption: "Pollack" },
      { chosenOption: "Cod" },
      { chosenOption: "Cod" },
    ]);
    const byOption = Object.fromEntries(result.map((r) => [r.option, r.count]));
    expect(byOption).toEqual({ Pollack: 1, Cod: 2 });
  });

  it("returns an empty array on an empty input", () => {
    expect(bucketAnswersByNormalized([])).toEqual([]);
  });
});
