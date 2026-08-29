import { describe, expect, it } from "vitest";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { REFERENCES } from "@/lib/references/catalogue";
import { factClaimKey, SPECIES_FACTS, type SpeciesFactKey } from "./species-facts";

const FACT_KEYS: SpeciesFactKey[] = ["depth", "size", "habitat", "behaviour"];

/**
 * The guide no longer carries a note admitting which of its statements are
 * traced to a source, because the intent is that all of them are. That promise
 * is only worth anything if something enforces it, and this is that something.
 */
describe("species fact tiles", () => {
  it("has an entry for every catalogue species, even an empty one", () => {
    const missing = Object.keys(CATALOGUE).filter((sci) => !(sci in SPECIES_FACTS));
    expect(missing).toEqual([]);
  });

  it("never names a species the catalogue does not hold", () => {
    const stray = Object.keys(SPECIES_FACTS).filter((sci) => !(sci in CATALOGUE));
    expect(stray).toEqual([]);
  });

  it("every published tile is bound to a passage somebody read", () => {
    const unevidenced: string[] = [];
    for (const [sci, facts] of Object.entries(SPECIES_FACTS)) {
      for (const key of FACT_KEYS) {
        if (!facts[key]) continue;
        const claim = REFERENCES.species[sci]?.claims?.[factClaimKey(key)];
        if (!claim?.claimSupported) unevidenced.push(`${sci} ${key}`);
      }
    }
    expect(unevidenced).toEqual([]);
  });

  it("states a size rather than bucketing it", () => {
    // The tiles used to render the Spot It wizard's trait tokens, which exist
    // to cut a candidate list and cannot say what a source says: that is how
    // the corkwing wrasse came to read "Small (under 10 cm)" on a page whose
    // own source gives a 25 cm maximum. A bucket phrase here means the tokens
    // have leaked back in.
    const BUCKETS = [/\bsmall \(under/i, /\bmedium \(10/i, /\blarge \(over/i];
    const bucketed: string[] = [];
    for (const [sci, facts] of Object.entries(SPECIES_FACTS)) {
      const text = facts.size?.text;
      if (text && BUCKETS.some((b) => b.test(text))) bucketed.push(`${sci}: ${text}`);
    }
    expect(bucketed).toEqual([]);
  });

  it("keeps every tile short enough to read as a tile", () => {
    const tooLong: string[] = [];
    for (const [sci, facts] of Object.entries(SPECIES_FACTS)) {
      for (const key of FACT_KEYS) {
        const text = facts[key]?.text;
        if (text && text.length > 160) tooLong.push(`${sci} ${key} (${text.length})`);
      }
    }
    expect(tooLong).toEqual([]);
  });
});
