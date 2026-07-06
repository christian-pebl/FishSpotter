import { describe, it, expect } from "vitest";
import { CATALOGUE_ALIASES, buildShapeClassByForm } from "./answer-matching";
import { rescoreAnswers } from "./snippet-reference";

const aliases = CATALOGUE_ALIASES;
const shapeMap = buildShapeClassByForm(aliases);

function ans(id: string, userId: string, chosenOption: string) {
  return { id, userId, chosenOption };
}

describe("rescoreAnswers", () => {
  it("judges a species reference: correct unlocks, wrong (any shape) does not", () => {
    const out = rescoreAnswers(
      [
        ans("a1", "u1", "Cuckoo wrasse"), // matches Labrus mixtus (alias)
        ans("a2", "u2", "Ballan wrasse"), // wrong species, same shape class (fish)
        ans("a3", "u3", "Edible crab"), // wrong shape class
      ],
      "Labrus mixtus",
      aliases,
      shapeMap,
    );
    expect(out[0]).toMatchObject({ isCorrect: true, unlockSpecies: "Labrus mixtus" });
    expect(out[1]).toMatchObject({ isCorrect: false, unlockSpecies: null });
    expect(out[2]).toMatchObject({ isCorrect: false, unlockSpecies: null });
  });

  it("never emits points — Pebbles are live currency the rescore must not touch", () => {
    // The P0 (2026-07-06): writing the matcher's retired 0/1/2 points scale
    // over live Pebbles balances. The result type has no `points`; this guards
    // against it creeping back in.
    const out = rescoreAnswers([ans("a1", "u1", "Cuckoo wrasse")], "Labrus mixtus", aliases, shapeMap);
    for (const r of out) {
      expect(r).not.toHaveProperty("points");
    }
  });

  it("clearing the reference (null) makes every answer pending, no unlocks", () => {
    const out = rescoreAnswers(
      [ans("a1", "u1", "Cuckoo wrasse"), ans("a2", "u2", "anything")],
      null,
      aliases,
      shapeMap,
    );
    for (const r of out) {
      expect(r.isCorrect).toBeNull();
      expect(r.unlockSpecies).toBeNull();
    }
  });

  it("a coarse reference (not a catalogue species) can be correct but unlocks nothing", () => {
    const out = rescoreAnswers([ans("a1", "u1", "Fish")], "Fish", aliases, shapeMap);
    expect(out[0].isCorrect).toBe(true);
    expect(out[0].unlockSpecies).toBeNull();
  });
});
