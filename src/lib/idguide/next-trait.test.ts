import { describe, expect, it } from "vitest";
import { nextBestTrait } from "./next-trait";
import type { SpeciesTraits } from "./traits";

function sp(over: Partial<SpeciesTraits>): SpeciesTraits {
  return {
    commonName: "x",
    shapeClass: "fish",
    bodyShape: ["fusiform"],
    size: "medium",
    coloration: ["uniform"],
    markings: ["none"],
    finShape: ["forked-tail"],
    features: ["none"],
    behavior: ["solitary"],
    habitat: ["open-water"],
    movement: ["water-column"],
    fieldNote: "",
    ...over,
  };
}

describe("nextBestTrait", () => {
  it("returns null with fewer than two candidates", () => {
    expect(nextBestTrait([])).toBeNull();
    expect(nextBestTrait([sp({})])).toBeNull();
  });

  it("returns null when no trait discriminates the set", () => {
    expect(nextBestTrait([sp({}), sp({}), sp({})])).toBeNull();
  });

  it("picks the value that splits the candidate set most evenly", () => {
    const cands = [
      sp({ features: ["barbels"] }),
      sp({ features: ["barbels"] }),
      sp({ features: ["none"] }),
      sp({ features: ["none"] }),
    ];
    const res = nextBestTrait(cands);
    expect(res).not.toBeNull();
    expect(res!.key).toBe("features");
    expect(res!.yesCount).toBe(2);
    expect(res!.noCount).toBe(2);
    expect(res!.score).toBeCloseTo(1, 6);
  });

  it("prefers an even split over a lopsided one", () => {
    // features splits 2/4 (entropy 1.0); coloration:spotted splits 1/4 (~0.81).
    const cands = [
      sp({ features: ["barbels"], coloration: ["spotted"] }),
      sp({ features: ["barbels"], coloration: ["uniform"] }),
      sp({ features: ["none"], coloration: ["uniform"] }),
      sp({ features: ["none"], coloration: ["uniform"] }),
    ];
    expect(nextBestTrait(cands)!.key).toBe("features");
  });

  it("does not re-ask a trait listed in askedKeys", () => {
    // Both features and habitat split 2/2; features wins on trait order, so
    // once it is asked the picker falls through to habitat.
    const cands = [
      sp({ features: ["barbels"], habitat: ["kelp"] }),
      sp({ features: ["barbels"], habitat: ["sandy-bottom"] }),
      sp({ features: ["none"], habitat: ["kelp"] }),
      sp({ features: ["none"], habitat: ["sandy-bottom"] }),
    ];
    expect(nextBestTrait(cands)!.key).toBe("features");
    expect(nextBestTrait(cands, ["features"])!.key).toBe("habitat");
  });

  it("is deterministic regardless of candidate ordering", () => {
    const a = sp({ commonName: "A", features: ["barbels"] });
    const b = sp({ commonName: "B", features: ["barbels"] });
    const c = sp({ commonName: "C", features: ["none"] });
    const d = sp({ commonName: "D", features: ["none"] });
    const r1 = nextBestTrait([a, b, c, d]);
    const r2 = nextBestTrait([d, c, b, a]);
    expect(r1).toEqual(r2);
  });
});
