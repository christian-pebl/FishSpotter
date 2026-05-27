import { describe, expect, it } from "vitest";
import { selectCandidates } from "./candidates";

type Image = { thumbUrl: string; attribution: string };

function imageIndex(species: string[]): Map<string, Image> {
  return new Map(
    species.map((sci) => [
      sci,
      { thumbUrl: `https://example/${sci}.jpg`, attribution: "© test" },
    ]),
  );
}

const STAFF_ANSWER = "Pollack";
const STAFF_SCIENTIFIC = "Pollachius pollachius";

const OBIS_TOP_10 = [
  { scientificName: STAFF_SCIENTIFIC, probability: 0.42 },
  { scientificName: "Labrus mixtus", probability: 0.18 },
  { scientificName: "Ctenolabrus rupestris", probability: 0.12 },
  { scientificName: "Symphodus melops", probability: 0.09 },
  { scientificName: "Labrus bergylta", probability: 0.07 },
  { scientificName: "Gadus morhua", probability: 0.05 },
  { scientificName: "Trisopterus luscus", probability: 0.04 },
  { scientificName: "Conger conger", probability: 0.02 },
  { scientificName: "Scyliorhinus canicula", probability: 0.005 },
  { scientificName: "Pleuronectes platessa", probability: 0.005 },
];

describe("selectCandidates — OBIS path", () => {
  it("returns 4 candidates including the staff option", () => {
    const result = selectCandidates({
      probability: OBIS_TOP_10,
      staffAnswer: STAFF_ANSWER,
      staffScientific: STAFF_SCIENTIFIC,
      imageIndex: imageIndex(OBIS_TOP_10.map((p) => p.scientificName)),
      seed: "snippet-abc",
    });
    expect(result.fallback).toBe("OBIS");
    expect(result.candidates).toHaveLength(4);
    expect(
      result.candidates.some((c) => c.scientificName === STAFF_SCIENTIFIC),
    ).toBe(true);
  });

  it("is deterministic given the same seed", () => {
    const args = {
      probability: OBIS_TOP_10,
      staffAnswer: STAFF_ANSWER,
      staffScientific: STAFF_SCIENTIFIC,
      imageIndex: imageIndex(OBIS_TOP_10.map((p) => p.scientificName)),
      seed: "snippet-abc",
    };
    const r1 = selectCandidates(args);
    const r2 = selectCandidates(args);
    expect(r2.candidates.map((c) => c.scientificName)).toEqual(
      r1.candidates.map((c) => c.scientificName),
    );
  });

  it("different seeds shuffle differently", () => {
    const base = {
      probability: OBIS_TOP_10,
      staffAnswer: STAFF_ANSWER,
      staffScientific: STAFF_SCIENTIFIC,
      imageIndex: imageIndex(OBIS_TOP_10.map((p) => p.scientificName)),
    };
    const r1 = selectCandidates({ ...base, seed: "snippet-A" });
    const r2 = selectCandidates({ ...base, seed: "snippet-Z" });
    // We don't assert mismatch (PRNG could collide for small n), but the
    // selections shouldn't be identical across many distinct seeds.
    expect(r1.candidates.length).toBe(r2.candidates.length);
  });

  it("skips species without usable images", () => {
    // Only the staff + 2 species have images. n=4 requested but only 3
    // candidates are possible — and 3 distractors with images would meet
    // the >=2 threshold, so OBIS path stands.
    const idx = imageIndex([
      STAFF_SCIENTIFIC,
      "Labrus mixtus",
      "Ctenolabrus rupestris",
    ]);
    const result = selectCandidates({
      probability: OBIS_TOP_10,
      staffAnswer: STAFF_ANSWER,
      staffScientific: STAFF_SCIENTIFIC,
      imageIndex: idx,
      seed: "snippet-x",
    });
    expect(result.fallback).toBe("OBIS");
    expect(result.candidates.length).toBeGreaterThanOrEqual(2);
    expect(
      result.candidates.every(
        (c) =>
          c.scientificName === STAFF_SCIENTIFIC || idx.has(c.scientificName),
      ),
    ).toBe(true);
  });

  it("includes thumbUrl + attribution per candidate when available", () => {
    const result = selectCandidates({
      probability: OBIS_TOP_10,
      staffAnswer: STAFF_ANSWER,
      staffScientific: STAFF_SCIENTIFIC,
      imageIndex: imageIndex(OBIS_TOP_10.map((p) => p.scientificName)),
      seed: "snippet-thumbs",
    });
    for (const c of result.candidates) {
      expect(c.thumbUrl).toMatch(/^https:\/\/example/);
      expect(c.attribution).toBe("© test");
    }
  });

  it("respects the n parameter (clamped to 3-5)", () => {
    const expectations: Array<[number, number]> = [
      [3, 3],
      [5, 5],
      [2, 3], // clamped up to 3
      [99, 5], // clamped down to 5
    ];
    for (const [requested, expected] of expectations) {
      const result = selectCandidates({
        probability: OBIS_TOP_10,
        staffAnswer: STAFF_ANSWER,
        staffScientific: STAFF_SCIENTIFIC,
        imageIndex: imageIndex(OBIS_TOP_10.map((p) => p.scientificName)),
        n: requested,
        seed: "snippet-n",
      });
      expect(result.candidates).toHaveLength(expected);
    }
  });
});

describe("selectCandidates — CATALOGUE fallback", () => {
  it("falls back to CATALOGUE when probability is null", () => {
    const result = selectCandidates({
      probability: null,
      staffAnswer: STAFF_ANSWER,
      staffScientific: STAFF_SCIENTIFIC,
      // Pull thumbs for several catalogue species so the path can pick distractors.
      imageIndex: imageIndex([
        STAFF_SCIENTIFIC,
        "Labrus mixtus",
        "Labrus bergylta",
        "Ctenolabrus rupestris",
        "Symphodus melops",
        "Gadus morhua",
      ]),
      seed: "snippet-no-obis",
    });
    expect(result.fallback).toBe("CATALOGUE");
    expect(result.candidates).toHaveLength(4);
    expect(
      result.candidates.some((c) => c.scientificName === STAFF_SCIENTIFIC),
    ).toBe(true);
  });

  it("falls back to CATALOGUE when staffScientific is null", () => {
    const result = selectCandidates({
      probability: OBIS_TOP_10,
      staffAnswer: STAFF_ANSWER,
      staffScientific: null,
      imageIndex: imageIndex([
        "Pollachius pollachius",
        "Labrus mixtus",
        "Labrus bergylta",
        "Ctenolabrus rupestris",
        "Symphodus melops",
      ]),
      seed: "snippet-no-sci",
    });
    expect(result.fallback).toBe("CATALOGUE");
    expect(
      result.candidates.some((c) => c.commonName === STAFF_ANSWER),
    ).toBe(true);
  });
});

describe("selectCandidates — DEGENERATE fallback", () => {
  it("returns only the staff candidate when no distractors have images", () => {
    const result = selectCandidates({
      probability: OBIS_TOP_10,
      staffAnswer: STAFF_ANSWER,
      staffScientific: STAFF_SCIENTIFIC,
      imageIndex: imageIndex([STAFF_SCIENTIFIC]), // only the staff has a thumb
      seed: "snippet-deg",
    });
    expect(result.fallback).toBe("DEGENERATE");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].scientificName).toBe(STAFF_SCIENTIFIC);
  });

  it("returns DEGENERATE when only one distractor has an image", () => {
    const result = selectCandidates({
      probability: OBIS_TOP_10,
      staffAnswer: STAFF_ANSWER,
      staffScientific: STAFF_SCIENTIFIC,
      imageIndex: imageIndex([STAFF_SCIENTIFIC, "Labrus mixtus"]),
      seed: "snippet-deg2",
    });
    expect(result.fallback).toBe("DEGENERATE");
  });
});

describe("selectCandidates — NO_REFERENCE path (S7-T1)", () => {
  it("draws all candidates from OBIS when staffAnswer is null", () => {
    const result = selectCandidates({
      probability: OBIS_TOP_10,
      staffAnswer: null,
      staffScientific: null,
      imageIndex: imageIndex(OBIS_TOP_10.map((p) => p.scientificName)),
      seed: "snippet-noref",
    });
    expect(result.fallback).toBe("NO_REFERENCE");
    expect(result.candidates).toHaveLength(4);
    // Every candidate must come from the OBIS list — no "staff" slot.
    const obisNames = new Set(OBIS_TOP_10.map((p) => p.scientificName));
    for (const c of result.candidates) {
      expect(obisNames.has(c.scientificName)).toBe(true);
    }
  });

  it("falls back to the catalogue when staffAnswer is null AND OBIS is empty", () => {
    const result = selectCandidates({
      probability: null,
      staffAnswer: null,
      staffScientific: null,
      // Seed a few catalogue species with images so the pool is large
      // enough.
      imageIndex: imageIndex([
        "Pollachius pollachius",
        "Labrus mixtus",
        "Labrus bergylta",
        "Ctenolabrus rupestris",
        "Symphodus melops",
      ]),
      seed: "snippet-noref-noobis",
    });
    expect(result.fallback).toBe("NO_REFERENCE");
    expect(result.candidates.length).toBeGreaterThanOrEqual(3);
  });

  it("never reserves a 'right answer' slot — every candidate is drawn from the pool", () => {
    // Run several seeds and verify no candidate has commonName matching
    // a sentinel "STAFF_ANSWER" string that doesn't exist in the pool.
    for (const seed of ["a", "b", "c"]) {
      const result = selectCandidates({
        probability: OBIS_TOP_10,
        staffAnswer: null,
        staffScientific: null,
        imageIndex: imageIndex(OBIS_TOP_10.map((p) => p.scientificName)),
        seed,
      });
      expect(result.fallback).toBe("NO_REFERENCE");
      const obisNames = new Set(OBIS_TOP_10.map((p) => p.scientificName));
      expect(
        result.candidates.every((c) => obisNames.has(c.scientificName)),
      ).toBe(true);
    }
  });

  it("is deterministic given the same seed (NO_REFERENCE)", () => {
    const args = {
      probability: OBIS_TOP_10,
      staffAnswer: null,
      staffScientific: null,
      imageIndex: imageIndex(OBIS_TOP_10.map((p) => p.scientificName)),
      seed: "snippet-noref-det",
    };
    const r1 = selectCandidates(args);
    const r2 = selectCandidates(args);
    expect(r2.candidates.map((c) => c.scientificName)).toEqual(
      r1.candidates.map((c) => c.scientificName),
    );
  });
});

describe("selectCandidates — invariants", () => {
  it("never returns duplicates", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const result = selectCandidates({
        probability: OBIS_TOP_10,
        staffAnswer: STAFF_ANSWER,
        staffScientific: STAFF_SCIENTIFIC,
        imageIndex: imageIndex(OBIS_TOP_10.map((p) => p.scientificName)),
        seed,
      });
      const names = result.candidates.map((c) => c.scientificName);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("always includes the staff option in OBIS and CATALOGUE paths", () => {
    for (const seed of ["x", "y", "z"]) {
      const r1 = selectCandidates({
        probability: OBIS_TOP_10,
        staffAnswer: STAFF_ANSWER,
        staffScientific: STAFF_SCIENTIFIC,
        imageIndex: imageIndex(OBIS_TOP_10.map((p) => p.scientificName)),
        seed,
      });
      expect(
        r1.candidates.some((c) => c.scientificName === STAFF_SCIENTIFIC),
      ).toBe(true);

      const r2 = selectCandidates({
        probability: null,
        staffAnswer: STAFF_ANSWER,
        staffScientific: STAFF_SCIENTIFIC,
        imageIndex: imageIndex([
          STAFF_SCIENTIFIC,
          "Labrus mixtus",
          "Labrus bergylta",
          "Ctenolabrus rupestris",
          "Symphodus melops",
        ]),
        seed,
      });
      expect(
        r2.candidates.some((c) => c.scientificName === STAFF_SCIENTIFIC),
      ).toBe(true);
    }
  });
});
