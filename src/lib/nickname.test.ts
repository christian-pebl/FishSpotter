import { describe, expect, it } from "vitest";
import {
  NICKNAME_ADJECTIVES,
  NICKNAME_CREATURES,
  generateNickname,
  isGeneratedNickname,
  nicknameSuggestions,
} from "./nickname";

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe("generated nicknames", () => {
  it("always produces a name the validator accepts", () => {
    const random = seeded(42);
    for (let i = 0; i < 500; i++) {
      const name = generateNickname(random);
      expect(isGeneratedNickname(name)).toBe(true);
      expect(name.length).toBeLessThanOrEqual(24);
    }
  });

  it("covers the edges of every list", () => {
    expect(generateNickname(() => 0)).toBe(`${NICKNAME_ADJECTIVES[0]}${NICKNAME_CREATURES[0]}10`);
    expect(generateNickname(() => 0.999999)).toBe(
      `${NICKNAME_ADJECTIVES.at(-1)}${NICKNAME_CREATURES.at(-1)}99`,
    );
  });

  it("offers distinct suggestions", () => {
    const list = nicknameSuggestions(4, seeded(7));
    expect(list).toHaveLength(4);
    expect(new Set(list).size).toBe(4);
  });

  it("rejects anything a child could type instead", () => {
    for (const name of [
      "Emma Smith",
      "EmmaSmith12",
      "SwiftWrasse",
      "SwiftWrasse123",
      "swiftwrasse42",
      "SwiftWrasse4",
      "SwiftEmma42",
      "",
    ]) {
      expect(isGeneratedNickname(name)).toBe(false);
    }
  });

  it("tolerates surrounding whitespace on a real suggestion", () => {
    expect(isGeneratedNickname(" SwiftWrasse42 ")).toBe(true);
  });
});
