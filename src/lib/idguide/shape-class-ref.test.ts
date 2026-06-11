import { describe, it, expect } from "vitest";
import { resolveShapeClassRef } from "@/lib/idguide/shape-class-ref";
import { SHAPE_CLASS } from "@/lib/idguide/traits";
import { SHAPE_CLASS_GUIDES } from "@/data/shape-class-guides";

describe("resolveShapeClassRef", () => {
  it("maps the bare class keys", () => {
    for (const c of SHAPE_CLASS) {
      expect(resolveShapeClassRef(c)).toBe(c);
    }
  });

  it("maps gate labels and casual synonyms", () => {
    expect(resolveShapeClassRef("Flatfish")).toBe("flatfish");
    expect(resolveShapeClassRef("It's just a Fish")).toBe("fish");
    expect(resolveShapeClassRef("Snail / slug")).toBe("gastropod");
    expect(resolveShapeClassRef("sea slug")).toBe("gastropod");
    expect(resolveShapeClassRef("Octopus")).toBe("squid");
    expect(resolveShapeClassRef("Cuttlefish")).toBe("squid");
    expect(resolveShapeClassRef("CRABS")).toBe("crab");
  });

  it("returns null for species names and junk", () => {
    expect(resolveShapeClassRef("Ballan wrasse")).toBeNull();
    expect(resolveShapeClassRef("Edible crab")).toBeNull(); // a species, not the group word
    expect(resolveShapeClassRef("")).toBeNull();
    expect(resolveShapeClassRef(null)).toBeNull();
    expect(resolveShapeClassRef(undefined)).toBeNull();
  });
});

describe("SHAPE_CLASS_GUIDES", () => {
  it("has a well-formed guide for every shape class", () => {
    for (const c of SHAPE_CLASS) {
      const g = SHAPE_CLASS_GUIDES[c];
      expect(g, `guide for ${c}`).toBeDefined();
      expect(g.label.length).toBeGreaterThan(0);
      expect(g.intro.length).toBeGreaterThan(0);
      expect(g.cues.length).toBeGreaterThanOrEqual(2);
      expect(g.cues.length).toBeLessThanOrEqual(4);
      expect(g.tellApart.length).toBeGreaterThan(0);
    }
  });
});
