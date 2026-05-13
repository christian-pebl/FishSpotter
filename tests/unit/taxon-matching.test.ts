import { describe, it, expect } from "vitest";
import { normalizeAlias } from "@/lib/taxon-matching";

describe("normalizeAlias", () => {
  it("lowercases and trims", () => {
    expect(normalizeAlias("Hermit Crab")).toBe("hermit crab");
    expect(normalizeAlias("  whiting  ")).toBe("whiting");
  });

  it("strips diacritics", () => {
    expect(normalizeAlias("Ångström")).toBe("angstrom");
    expect(normalizeAlias("Sépia")).toBe("sepia");
  });

  it("collapses whitespace", () => {
    expect(normalizeAlias("Trachurus  trachurus")).toBe("trachurus trachurus");
    expect(normalizeAlias("a    b\tc")).toBe("b c"); // 'a' stripped as article
  });

  it("strips leading articles a/an/the", () => {
    expect(normalizeAlias("the Common Hermit Crab")).toBe("common hermit crab");
    expect(normalizeAlias("an octopus")).toBe("octopus");
    expect(normalizeAlias("a fish")).toBe("fish");
  });

  it("treats hyphens and apostrophes as spaces", () => {
    expect(normalizeAlias("small-spotted catshark")).toBe("small spotted catshark");
    expect(normalizeAlias("lion's mane jellyfish")).toBe("lion s mane jellyfish");
  });

  it("returns empty string for null/empty input", () => {
    expect(normalizeAlias("")).toBe("");
    expect(normalizeAlias(undefined as unknown as string)).toBe("");
  });

  it("idempotent: normalizing twice returns same result", () => {
    const v = "The   Spiny-Spider Crab!";
    const once = normalizeAlias(v);
    const twice = normalizeAlias(once);
    expect(once).toBe(twice);
  });
});
