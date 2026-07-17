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

describe("orderFeed with a difficulty readiness param", () => {
  const rated = (id: string, difficultyScore: number) => ({ id, difficultyScore });

  it("is a no-op (plain shuffle) when readiness is omitted, even if snippets carry difficultyScore", () => {
    const all = [rated("a", 0.9), rated("b", 0.5), rated("c", 0.1)];
    const withOpts = orderFeed(all, new Set(), "seed-1");
    const withoutOpts = orderFeed(
      all.map(({ id }) => ({ id })),
      new Set(),
      "seed-1",
    );
    expect(withOpts.map((s) => s.id)).toEqual(withoutOpts.map((s) => s.id));
  });

  it("is a no-op when snippets have no difficultyScore, even if readiness is set", () => {
    const all = snippets(["a", "b", "c", "d"]);
    const withReadiness = orderFeed(all, new Set(), "seed-1", { readiness: 0 });
    const without = orderFeed(all, new Set(), "seed-1");
    expect(withReadiness.map((s) => s.id)).toEqual(without.map((s) => s.id));
  });

  it("still returns every snippet exactly once with readiness set", () => {
    const all = [
      rated("e1", 0.95), rated("m1", 0.5), rated("h1", 0.05),
      rated("e2", 0.9), rated("m2", 0.45), rated("h2", 0.1),
    ];
    const answered = new Set(["m1"]);
    for (const readiness of [0, 0.5, 1]) {
      const result = orderFeed(all, answered, "seed-1", { readiness });
      expect(result).toHaveLength(all.length);
      expect(new Set(result.map((s) => s.id)).size).toBe(all.length);
    }
  });

  it("keeps the answered tier at the back regardless of readiness", () => {
    const all = [
      rated("e1", 0.95), rated("m1", 0.5), rated("h1", 0.05), rated("e2", 0.9),
    ];
    const answered = new Set(["e1", "h1"]);
    const result = orderFeed(all, answered, "seed-1", { readiness: 1 });
    const firstAnsweredIndex = result.findIndex((s) => answered.has(s.id));
    const lastUnansweredIndex = result.length - 1 - [...result].reverse().findIndex((s) => !answered.has(s.id));
    expect(firstAnsweredIndex).toBeGreaterThan(lastUnansweredIndex);
  });

  it("is deterministic given the same inputs including readiness", () => {
    const all = [rated("a", 0.9), rated("b", 0.5), rated("c", 0.1), rated("d", 0.6)];
    const r1 = orderFeed(all, new Set(), "user-123", { readiness: 0.3 });
    const r2 = orderFeed(all, new Set(), "user-123", { readiness: 0.3 });
    expect(r2.map((s) => s.id)).toEqual(r1.map((s) => s.id));
  });

  it("skews the unanswered tier toward easy clips for a brand-new spotter", () => {
    const all = [
      rated("e1", 0.95), rated("e2", 0.9), rated("e3", 0.85),
      rated("m1", 0.6), rated("m2", 0.55), rated("m3", 0.5),
      rated("h1", 0.2), rated("h2", 0.15), rated("h3", 0.1),
    ];
    let easySum = 0;
    let hardSum = 0;
    const trials = 100;
    for (let i = 0; i < trials; i++) {
      const result = orderFeed(all, new Set(), `trial-${i}`, { readiness: 0 });
      const indexOf = (id: string) => result.findIndex((r) => r.id === id);
      easySum += indexOf("e1") + indexOf("e2") + indexOf("e3");
      hardSum += indexOf("h1") + indexOf("h2") + indexOf("h3");
    }
    expect(easySum / trials).toBeLessThan(hardSum / trials);
  });
});
