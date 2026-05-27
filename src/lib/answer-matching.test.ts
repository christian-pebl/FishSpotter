import { describe, expect, it } from "vitest";
import {
  isCorrectWithAliases,
  matchWithAliases,
  POINTS_CORRECT_REF,
  POINTS_PENDING_REF,
  POINTS_INCORRECT,
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
