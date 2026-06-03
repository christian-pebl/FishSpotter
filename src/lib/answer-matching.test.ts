import { describe, expect, it } from "vitest";
import {
  buildShapeClassByForm,
  CATALOGUE_ALIASES,
  isCorrectWithAliases,
  matchWithAliases,
  POINTS_CORRECT_REF,
  POINTS_PENDING_REF,
  POINTS_INCORRECT,
  POINTS_SHAPE_CLASS,
  type AliasEntry,
} from "./answer-matching";

const ALIASES: AliasEntry[] = [
  {
    canonical: "Pollachius pollachius",
    aliases: ["Pollack", "pollock", "Atlantic pollack", "Pollachius"],
  },
  {
    canonical: "Scyliorhinus canicula",
    aliases: [
      "Lesser-spotted catshark",
      "catshark",
      "lesser-spotted dogfish",
      "dogfish",
    ],
  },
  {
    canonical: "Labrus mixtus",
    aliases: ["Cuckoo wrasse", "cuckoo"],
  },
];

describe("isCorrectWithAliases", () => {
  it("accepts the exact staff answer (case-insensitive)", () => {
    expect(isCorrectWithAliases("Pollack", "pollack", ALIASES)).toBe(true);
    expect(isCorrectWithAliases("Pollack", "POLLACK", ALIASES)).toBe(true);
  });

  it("accepts the Linnaean binomial when the staff answer is the common name", () => {
    expect(
      isCorrectWithAliases("Pollack", "Pollachius pollachius", ALIASES),
    ).toBe(true);
  });

  it("accepts the common name when the staff answer is the Linnaean binomial", () => {
    expect(
      isCorrectWithAliases("Pollachius pollachius", "Pollack", ALIASES),
    ).toBe(true);
  });

  it("accepts editorial common synonyms (pollack/pollock)", () => {
    expect(isCorrectWithAliases("Pollack", "pollock", ALIASES)).toBe(true);
    expect(
      isCorrectWithAliases("Pollachius pollachius", "Atlantic pollack", ALIASES),
    ).toBe(true);
  });

  it("accepts singular/plural variants", () => {
    expect(
      isCorrectWithAliases(
        "Lesser-spotted catshark",
        "catsharks",
        ALIASES,
      ),
    ).toBe(true);
    expect(
      isCorrectWithAliases("Scyliorhinus canicula", "catsharks", ALIASES),
    ).toBe(true);
  });

  it("accepts the hyphen/whitespace alternates surfaced via alias list", () => {
    expect(
      isCorrectWithAliases(
        "Scyliorhinus canicula",
        "lesser spotted catshark",
        ALIASES,
      ),
    ).toBe(true);
  });

  it("rejects answers that don't match any acceptable form", () => {
    expect(isCorrectWithAliases("Pollack", "cod", ALIASES)).toBe(false);
    expect(isCorrectWithAliases("Pollack", "Labrus mixtus", ALIASES)).toBe(
      false,
    );
  });

  it("rejects empty alias list when the answers don't match directly", () => {
    expect(isCorrectWithAliases("Pollack", "pollock", [])).toBe(false);
  });

  it("falls back to direct match if no alias row exists for the staff answer", () => {
    // staffAnswer "Bass" isn't in the alias table at all → only direct
    // normalised equality should make it correct.
    expect(isCorrectWithAliases("Bass", "bass", ALIASES)).toBe(true);
    expect(isCorrectWithAliases("Bass", "Dicentrarchus", ALIASES)).toBe(false);
  });

  it("handles diacritics and articles", () => {
    expect(
      isCorrectWithAliases("Pollack", "the Pollachius pollachius", ALIASES),
    ).toBe(true);
  });
});

describe("matchWithAliases (S7-T1 — points + nullable staff answer)", () => {
  it("awards POINTS_CORRECT_REF for a direct correct match", () => {
    expect(matchWithAliases("Pollack", "pollack", ALIASES)).toEqual({
      isCorrect: true,
      points: POINTS_CORRECT_REF,
    });
  });

  it("awards POINTS_CORRECT_REF for an alias-resolved match", () => {
    expect(
      matchWithAliases("Pollachius pollachius", "Pollack", ALIASES),
    ).toEqual({
      isCorrect: true,
      points: POINTS_CORRECT_REF,
    });
  });

  it("awards POINTS_INCORRECT for an unmatched guess", () => {
    expect(matchWithAliases("Pollack", "cod", ALIASES)).toEqual({
      isCorrect: false,
      points: POINTS_INCORRECT,
    });
  });

  it("returns { isCorrect: null, points: POINTS_PENDING_REF } when staffAnswer is null", () => {
    // The pending payout is independent of what the user guessed — no
    // reference label exists to compare against.
    expect(matchWithAliases(null, "Pollack", ALIASES)).toEqual({
      isCorrect: null,
      points: POINTS_PENDING_REF,
    });
    expect(matchWithAliases(null, "literally anything", ALIASES)).toEqual({
      isCorrect: null,
      points: POINTS_PENDING_REF,
    });
  });

  it("enforces pending < correct so un-referenced clips can't be farmed at a better rate", () => {
    expect(POINTS_PENDING_REF).toBeLessThan(POINTS_CORRECT_REF);
  });
});

describe("matchWithAliases — shape-class partial credit (Workstream E)", () => {
  // Mirror production: catalogue species links + editorial aliases, plus the
  // derived shape-class map.
  const aliases = [...CATALOGUE_ALIASES, ...ALIASES];
  const shapeMap = buildShapeClassByForm(aliases);

  it("awards POINTS_SHAPE_CLASS for a wrong species in the right shape class", () => {
    // Reference is the Edible Crab; user picked a different crab. Wrong species,
    // right shape → partial credit, isCorrect still false.
    expect(
      matchWithAliases("Cancer pagurus", "Shore Crab", aliases, shapeMap),
    ).toEqual({ isCorrect: false, points: POINTS_SHAPE_CLASS });
  });

  it("still awards full credit for the correct species (binomial ref, common-name guess)", () => {
    // The catalogue link resolves Cancer pagurus ↔ Edible Crab without a DB alias.
    expect(
      matchWithAliases("Cancer pagurus", "Edible Crab", aliases, shapeMap),
    ).toEqual({ isCorrect: true, points: POINTS_CORRECT_REF });
  });

  it("awards 0 when the shape class is wrong (crab reference, fish guess)", () => {
    expect(
      matchWithAliases("Cancer pagurus", "Pollack", aliases, shapeMap),
    ).toEqual({ isCorrect: false, points: POINTS_INCORRECT });
  });

  it("treats a coarse shape-word reference as a valid shape-class ref", () => {
    // Nullify-audit reframe: a snippet referenced only as "Crab" gives shape
    // credit to any crab guess.
    expect(
      matchWithAliases("Crab", "Velvet Swimming Crab", aliases, shapeMap),
    ).toEqual({ isCorrect: false, points: POINTS_SHAPE_CLASS });
  });

  it("falls back to species-only scoring when no shape map is supplied", () => {
    // The alias unit tests call the 3-arg form; behaviour must be unchanged.
    expect(matchWithAliases("Cancer pagurus", "Shore Crab", ALIASES)).toEqual({
      isCorrect: false,
      points: POINTS_INCORRECT,
    });
  });

  it("preserves the scoring order: species > shape-class > wrong", () => {
    expect(POINTS_CORRECT_REF).toBeGreaterThan(POINTS_SHAPE_CLASS);
    expect(POINTS_SHAPE_CLASS).toBeGreaterThan(POINTS_INCORRECT);
  });
});

describe("buildShapeClassByForm", () => {
  const map = buildShapeClassByForm(ALIASES);

  it("resolves catalogue common names and scientific names to shape class", () => {
    expect(map.get("shore crab")).toBe("crab");
    expect(map.get("cancer pagurus")).toBe("crab");
    expect(map.get("pollachius pollachius")).toBe("fish");
  });

  it("resolves aliases via their catalogue-known forms", () => {
    // "pollock" is an alias of Pollachius pollachius (a fish in the catalogue).
    expect(map.get("pollock")).toBe("fish");
  });

  it("maps the coarse shape words to themselves", () => {
    expect(map.get("crab")).toBe("crab");
    expect(map.get("fish")).toBe("fish");
  });
});
