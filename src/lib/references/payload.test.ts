import { describe, expect, it } from "vitest";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { REFERENCES, VERIFICATION } from "@/lib/references/catalogue";
import { SPECIES_FACTS, factClaimKey, type SpeciesFactKey } from "@/lib/biodiversity/species-facts";
import { STATED_DIETS, dietClaimKey } from "@/lib/foodweb/stated-diet";
import { getSpeciesProvenance } from "./payload";

const FACT_KEYS: SpeciesFactKey[] = ["depth", "size", "habitat", "behaviour"];

/**
 * These tests check what a READER gets, not what the data file says.
 *
 * The distinction is not academic: it already shipped a defect. The claim audit
 * counts `claimSupported` and reported 935 of 935 claims evidenced, while the
 * page renders a claim only if it ALSO has a source that passed the live-web
 * check. 81 newly added sources had no verification row, so their claims were
 * silently dropped from the payload and the barrel jellyfish went live with no
 * depth tile and three uncited diet bullets, on a page whose whole promise is
 * that everything shown is sourced.
 *
 * A count taken one layer above the renderer is a count of something nobody
 * sees. These are taken from the payload the page is actually handed.
 */
describe("species provenance payload", () => {
  it("hands the page a claim for every fact tile it will render", () => {
    const missing: string[] = [];
    for (const [sci, facts] of Object.entries(SPECIES_FACTS)) {
      if (!(sci in CATALOGUE)) continue;
      const provenance = getSpeciesProvenance(sci);
      for (const key of FACT_KEYS) {
        if (!facts[key]) continue;
        const claim = provenance?.claims[factClaimKey(key)];
        if (!claim?.evidenced) missing.push(`${sci} ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("hands the page a claim for every diet bullet it will render", () => {
    const missing: string[] = [];
    for (const [sci, diet] of Object.entries(STATED_DIETS)) {
      if (!(sci in CATALOGUE)) continue;
      const provenance = getSpeciesProvenance(sci);
      for (const side of ["eats", "eatenBy"] as const) {
        diet[side].forEach((_, i) => {
          const claim = provenance?.claims[dietClaimKey(side, i)];
          if (!claim?.evidenced) missing.push(`${sci} ${dietClaimKey(side, i)}`);
        });
      }
    }
    expect(missing).toEqual([]);
  });

  it("gives every source cited by an evidenced claim a verification row", () => {
    // This is the specific hole. `refs:verify` reaches the live web, so it is
    // easy to add a source and forget to run it; the reference file then looks
    // complete and the payload quietly discards the claim.
    const unverifiable: string[] = [];
    for (const [sci, entry] of Object.entries(REFERENCES.species)) {
      for (const [key, claim] of Object.entries(entry.claims)) {
        if (!claim.claimSupported) continue;
        const anyLive = claim.sourceIds.some((id) => VERIFICATION[id]?.status === "ok");
        if (!anyLive) unverifiable.push(`${sci} ${key} -> ${claim.sourceIds.join(", ")}`);
      }
    }
    expect(unverifiable).toEqual([]);
  });
});
