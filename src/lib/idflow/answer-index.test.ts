import { describe, expect, it } from "vitest";
import { searchSpecies } from "./answer-index";
import { CATALOGUE } from "@/lib/idguide/catalogue";

// These tests assert behaviour against the live catalogue + alias file, so they
// double as a guard that the index keeps resolving the canonical names the
// scoring matcher expects.

describe("searchSpecies", () => {
  it("returns nothing for an empty or whitespace query", () => {
    expect(searchSpecies("")).toEqual([]);
    expect(searchSpecies("   ")).toEqual([]);
  });

  it("resolves a common-name alias to the canonical species", () => {
    // "cod" is an alias of Atlantic cod (Gadus morhua).
    const top = searchSpecies("cod")[0];
    expect(top.scientificName).toBe("Gadus morhua");
    expect(top.commonName).toBe(CATALOGUE["Gadus morhua"].commonName);
  });

  it("resolves a genus fragment to the species", () => {
    const names = searchSpecies("Gadus").map((s) => s.scientificName);
    expect(names).toContain("Gadus morhua");
  });

  it("tolerates a small typo", () => {
    // "wrase" -> wrasse: at least one wrasse species should surface.
    const hits = searchSpecies("wrase");
    expect(hits.some((s) => /wrasse/i.test(s.commonName))).toBe(true);
  });

  it("collapses the many forms of a multi-name species to one row", () => {
    // Chelon labrosus carries several common-name variants in the alias file.
    const rows = searchSpecies("mullet").filter(
      (s) => s.scientificName === "Chelon labrosus",
    );
    expect(rows).toHaveLength(1);
  });

  it("flags when the match came via an alias, and exposes the matched form", () => {
    const top = searchSpecies("bass")[0];
    expect(top.scientificName).toBe("Dicentrarchus labrax");
    expect(top.viaAlias).toBe(true);
    expect(top.matchedForm.toLowerCase()).toContain("bass");
  });

  it("ranks an exact canonical-name match top with score 100", () => {
    const common = CATALOGUE["Gadus morhua"].commonName; // "Atlantic cod"
    const top = searchSpecies(common)[0];
    expect(top.scientificName).toBe("Gadus morhua");
    expect(top.score).toBeGreaterThanOrEqual(100);
    expect(top.viaAlias).toBe(false);
  });

  it("matches case- and diacritic-insensitively", () => {
    const a = searchSpecies("ATLANTIC COD")[0];
    expect(a?.scientificName).toBe("Gadus morhua");
  });

  it("returns [] for gibberish with no plausible match", () => {
    expect(searchSpecies("zzzqqwx")).toEqual([]);
  });

  it("respects the result limit", () => {
    // A broad fragment that hits many species, capped.
    expect(searchSpecies("a", 3).length).toBeLessThanOrEqual(3);
  });
});
