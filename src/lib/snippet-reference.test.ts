import { describe, it, expect } from "vitest";
import {
  CATALOGUE_ALIASES,
  buildShapeClassByForm,
  POINTS_CORRECT_REF,
  POINTS_SHAPE_CLASS,
  POINTS_INCORRECT,
  POINTS_PENDING_REF,
} from "./answer-matching";
import { rescoreAnswers } from "./snippet-reference";

const aliases = CATALOGUE_ALIASES;
const shapeMap = buildShapeClassByForm(aliases);

function ans(id: string, userId: string, chosenOption: string) {
  return { id, userId, chosenOption };
}

describe("rescoreAnswers", () => {
  it("scores a species reference: correct unlocks, same-shape gets partial, wrong-shape zero", () => {
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
    expect(out[0]).toMatchObject({ isCorrect: true, points: POINTS_CORRECT_REF, unlockSpecies: "Labrus mixtus" });
    expect(out[1]).toMatchObject({ isCorrect: false, points: POINTS_SHAPE_CLASS, unlockSpecies: null });
    expect(out[2]).toMatchObject({ isCorrect: false, points: POINTS_INCORRECT, unlockSpecies: null });
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
      expect(r.points).toBe(POINTS_PENDING_REF);
      expect(r.unlockSpecies).toBeNull();
    }
  });

  it("a coarse reference (not a catalogue species) can be correct but unlocks nothing", () => {
    const out = rescoreAnswers([ans("a1", "u1", "Fish")], "Fish", aliases, shapeMap);
    expect(out[0].isCorrect).toBe(true);
    expect(out[0].unlockSpecies).toBeNull();
  });
});
