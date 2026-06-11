import { describe, it, expect } from "vitest";
import { speciesSlug, resolveSpeciesSlug, allSpeciesSlugs } from "./species-slug";

describe("speciesSlug", () => {
  it("kebab-cases a binomial", () => {
    expect(speciesSlug("Labrus mixtus")).toBe("labrus-mixtus");
    expect(speciesSlug("Pollachius pollachius")).toBe("pollachius-pollachius");
  });
  it("strips punctuation + collapses separators", () => {
    expect(speciesSlug("  Cancer  pagurus  ")).toBe("cancer-pagurus");
  });
});

describe("resolveSpeciesSlug", () => {
  it("round-trips every catalogue species", () => {
    for (const slug of allSpeciesSlugs()) {
      const r = resolveSpeciesSlug(slug);
      expect(r).not.toBeNull();
      expect(speciesSlug(r!.scientificName)).toBe(slug);
    }
  });
  it("is case-insensitive and returns null for unknown slugs", () => {
    const known = allSpeciesSlugs()[0];
    expect(resolveSpeciesSlug(known.toUpperCase())).not.toBeNull();
    expect(resolveSpeciesSlug("not-a-species")).toBeNull();
  });
  it("exposes a slug per catalogue entry with no collisions", () => {
    const slugs = allSpeciesSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
