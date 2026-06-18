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

  it("excludes every answered snippet entirely (strict exclusion)", () => {
    const all = snippets(["a", "b", "c", "d", "e", "f", "g", "h"]);
    const answered = new Set(["b", "d", "g"]);
    const result = orderFeed(all, answered, "user-123");

    // No answered snippet may appear at all.
    for (const s of result) {
      expect(answered.has(s.id)).toBe(false);
    }
    // Exactly the unanswered ones survive, each once.
    expect(result).toHaveLength(all.length - answered.size);
    expect(new Set(result.map((s) => s.id))).toEqual(
      new Set(["a", "c", "e", "f", "h"]),
    );
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

  it("returns an empty list when EVERYTHING is answered (caught up)", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const all = snippets(ids);
    const answered = new Set(ids);
    const result = orderFeed(all, answered, "seed-1");
    // Strict exclusion: nothing new to serve -> the page shows "all caught up".
    expect(result).toEqual([]);
  });

  it("drops a snippet once it becomes answered (no longer served)", () => {
    // Simulates the user submitting an answer for snippet 'c' on a reload.
    const all = snippets(["a", "b", "c", "d", "e"]);
    const before = orderFeed(all, new Set(), "user-123");
    const after = orderFeed(all, new Set(["c"]), "user-123");

    // 'c' is served before answering, and gone afterwards.
    expect(before.some((s) => s.id === "c")).toBe(true);
    expect(after.some((s) => s.id === "c")).toBe(false);
    expect(before).toHaveLength(5);
    expect(after).toHaveLength(4);
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
