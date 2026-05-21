import { describe, expect, it } from "vitest";
import {
  normalizeAnswer,
  normalizeForMatch,
  singulariseToken,
} from "./normalize-answer";

describe("normalizeAnswer", () => {
  it("lowercases and trims", () => {
    expect(normalizeAnswer(" Pollack ")).toBe("pollack");
  });

  it("strips diacritics", () => {
    expect(normalizeAnswer("Jëllyfish")).toBe("jellyfish");
  });

  it("drops articles", () => {
    expect(normalizeAnswer("The Great Pollack")).toBe("great pollack");
    expect(normalizeAnswer("a wrasse")).toBe("wrasse");
    expect(normalizeAnswer("an eel")).toBe("eel");
  });

  it("collapses whitespace", () => {
    expect(normalizeAnswer("cuckoo    wrasse")).toBe("cuckoo wrasse");
  });

  it("normalises punctuation to space", () => {
    expect(normalizeAnswer("lesser-spotted catshark")).toBe(
      "lesser spotted catshark",
    );
  });

  it("expands ampersand", () => {
    expect(normalizeAnswer("Cuckoo & Goldsinny")).toBe(
      "cuckoo and goldsinny",
    );
  });
});

describe("singulariseToken", () => {
  it("strips trailing s on common plurals", () => {
    expect(singulariseToken("catsharks")).toBe("catshark");
    expect(singulariseToken("sprats")).toBe("sprat");
  });

  it("keeps short tokens intact", () => {
    expect(singulariseToken("gas")).toBe("gas");
    expect(singulariseToken("is")).toBe("is");
  });

  it("keeps double-s endings (wrasse, bass)", () => {
    expect(singulariseToken("wrasse")).toBe("wrasse");
    expect(singulariseToken("bass")).toBe("bass");
  });

  it("keeps -us endings (Latin binomials)", () => {
    expect(singulariseToken("pollachius")).toBe("pollachius");
    expect(singulariseToken("ctenolabrus")).toBe("ctenolabrus");
  });

  it("leaves tokens that don't end in s untouched", () => {
    expect(singulariseToken("cod")).toBe("cod");
  });
});

describe("normalizeForMatch", () => {
  it("combines normalisation + singularisation", () => {
    expect(normalizeForMatch("Catsharks")).toBe("catshark");
    expect(normalizeForMatch("The Lesser-Spotted CATSHARKS")).toBe(
      "lesser spotted catshark",
    );
  });

  it("preserves Linnaean binomial -us endings", () => {
    expect(normalizeForMatch("Pollachius pollachius")).toBe(
      "pollachius pollachius",
    );
  });

  it("treats wrasse plural correctly", () => {
    expect(normalizeForMatch("Cuckoo wrasses")).toBe("cuckoo wrasse");
  });
});
