import { describe, expect, it } from "vitest";
import { orderFeed } from "./feed-ordering";

const snippets = (ids: string[]) => ids.map((id) => ({ id }));

describe("orderFeed", () => {
  it("returns an empty list when there are no snippets", () => {
    expect(orderFeed([], new Set(), "seed")).toEqual([]);
  });

  it("is deterministic given the same (snippets, answered, seed)", () => {
    const all = snippets(["a", "b", "c", "d", "e", "f", "g", "h"]);
    const answered = new Set(["c", "f"]);
    const r1 = orderFeed(all, answered, "user-123");
    const r2 = orderFeed(all, answered, "user-123");
    expect(r2.map((s) => s.id)).toEqual(r1.map((s) => s.id));
  });

  it("puts every unanswered snippet before every answered snippet", () => {
    const all = snippets(["a", "b", "c", "d", "e", "f", "g", "h"]);
    const answered = new Set(["b", "d", "g"]);
    const result = orderFeed(all, answered, "user-123");

    const firstAnsweredIndex = result.findIndex((s) => answered.has(s.id));
    const lastUnansweredIndex = (() => {
      for (let i = result.length - 1; i >= 0; i--) {
        if (!answered.has(result[i].id)) return i;
      }
      return -1;
    })();

    // Every answered snippet must appear after every unanswered one.
    expect(firstAnsweredIndex).toBeGreaterThan(lastUnansweredIndex);
    // And every snippet is in the result exactly once.
    expect(result).toHaveLength(all.length);
    expect(new Set(result.map((s) => s.id)).size).toBe(all.length);
  });

  it("shuffles differently for different seeds", () => {
    // Probabilistic check: across 4 seeds with 8 snippets, at least two
    // orderings should differ. Same-seed determinism is covered above;
    // here we just confirm the seed actually influences the shuffle.
    const all = snippets(["a", "b", "c", "d", "e", "f", "g", "h"]);
    const empty = new Set<string>();
    const orderings = ["user-A", "user-B", "user-C", "user-D"].map((s) =>
      orderFeed(all, empty, s).map((x) => x.id).join(","),
    );
    expect(new Set(orderings).size).toBeGreaterThan(1);
  });

  it("returns all snippets when nothing is answered (still shuffled)", () => {
    const all = snippets(["a", "b", "c", "d", "e"]);
    const result = orderFeed(all, new Set(), "seed-1");
    expect(result).toHaveLength(5);
    expect(new Set(result.map((s) => s.id))).toEqual(
      new Set(["a", "b", "c", "d", "e"]),
    );
  });

  it("returns answered snippets fully shuffled when EVERYTHING is answered", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const all = snippets(ids);
    const answered = new Set(ids);
    const result = orderFeed(all, answered, "seed-1");
    expect(result).toHaveLength(8);
    expect(new Set(result.map((s) => s.id))).toEqual(answered);
  });

  it("places a snippet that moves from unanswered → answered at the tail of the resulting shuffle", () => {
    // Simulates the user submitting an answer for snippet 'c'.
    const all = snippets(["a", "b", "c", "d", "e"]);
    const before = orderFeed(all, new Set(), "user-123");
    const after = orderFeed(all, new Set(["c"]), "user-123");

    // 'c' must be in the back half (the answered tail).
    const cIndex = after.findIndex((s) => s.id === "c");
    expect(cIndex).toBe(after.length - 1);

    // The unanswered tail's relative order is preserved against the seed.
    // (Specifically: the unanswered shuffle is computed on a 4-item list
    // post-answer vs a 5-item list pre-answer — different inputs, so
    // we don't assert ordering equality, just position of 'c'.)
    expect(before).toHaveLength(5);
    expect(after).toHaveLength(5);
  });

  it("never duplicates a snippet", () => {
    const all = snippets(["a", "b", "c", "d", "e", "f"]);
    const answered = new Set(["b", "d"]);
    for (const seed of ["s1", "s2", "s3", "s4"]) {
      const result = orderFeed(all, answered, seed);
      expect(new Set(result.map((s) => s.id)).size).toBe(result.length);
    }
  });
});
