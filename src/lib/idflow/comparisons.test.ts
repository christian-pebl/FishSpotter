import { describe, it, expect } from "vitest";
import { COMPARISON_GROUPS, comparisonGroupForCandidates } from "./comparisons";
import { CATALOGUE } from "@/lib/idguide/catalogue";

describe("comparison groups", () => {
  it("every member is a real catalogue species with a matching common name", () => {
    for (const g of COMPARISON_GROUPS) {
      for (const m of g.members) {
        const entry = CATALOGUE[m.scientificName];
        expect(entry, `${m.scientificName} (group ${g.id}) not in catalogue`).toBeDefined();
        expect(
          entry!.commonName.toLowerCase(),
          `${m.scientificName} commonName mismatch`,
        ).toBe(m.commonName.toLowerCase());
      }
    }
  });

  it("each group has >=2 members and a unique id", () => {
    const ids = new Set<string>();
    for (const g of COMPARISON_GROUPS) {
      expect(g.members.length, g.id).toBeGreaterThanOrEqual(2);
      expect(ids.has(g.id), `duplicate group id ${g.id}`).toBe(false);
      ids.add(g.id);
    }
  });

  it("resolves the flatfish group for the flatfish candidate set", () => {
    const flat = ["Pleuronectes platessa", "Limanda limanda", "Platichthys flesus"];
    expect(comparisonGroupForCandidates(flat)?.id).toBe("flatfish-right-eyed");
  });

  it("does not surface a group inside a large (whole-catalogue) candidate set", () => {
    const many = [
      "Pleuronectes platessa",
      "Limanda limanda",
      "Platichthys flesus",
      "a", "b", "c", "d", "e", "f", "g", "h", "i", "j",
    ];
    expect(comparisonGroupForCandidates(many)).toBeNull();
  });

  it("returns null when not every member is present", () => {
    expect(
      comparisonGroupForCandidates(["Pleuronectes platessa", "Limanda limanda"]),
    ).toBeNull();
  });
});
