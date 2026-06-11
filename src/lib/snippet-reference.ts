/**
 * Retro-scoring for the admin reference editor. When a staffer sets (or clears)
 * a clip's reference, every existing answer on that clip must be re-judged
 * against the new reference, and any now-correct answer on a species-level
 * reference unlocks that species in the spotter's pokedex.
 *
 * `rescoreAnswers` is pure (no DB) so it is unit-tested; the server action
 * (admin/snippets/[id]/actions.ts) builds the alias data, calls this, and
 * applies the result in a transaction.
 */
import { matchWithAliases, scientificFromLocalName, type AliasEntry } from "@/lib/answer-matching";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import type { ShapeClass } from "@/lib/idguide/traits";

export type RescoredAnswer = {
  id: string;
  userId: string;
  isCorrect: boolean | null;
  points: number;
  /** the catalogue species this answer's user now collects, or null */
  unlockSpecies: string | null;
};

/**
 * Recompute each answer's verdict + points against `staffAnswer` (null =
 * community / indeterminate clip -> all pending). A now-correct answer on a
 * reference that resolves to a catalogue species unlocks that species (the
 * reference's species, since isCorrect means the pick matched it).
 */
export function rescoreAnswers(
  answers: Array<{ id: string; userId: string; chosenOption: string }>,
  staffAnswer: string | null,
  aliases: AliasEntry[],
  shapeMap: ReadonlyMap<string, ShapeClass>,
): RescoredAnswer[] {
  const refSci = staffAnswer ? scientificFromLocalName(staffAnswer, aliases) : null;
  const refIsCatalogueSpecies = !!refSci && !!CATALOGUE[refSci];
  return answers.map((a) => {
    const { isCorrect, points } = matchWithAliases(staffAnswer, a.chosenOption, aliases, shapeMap);
    return {
      id: a.id,
      userId: a.userId,
      isCorrect,
      points,
      unlockSpecies: isCorrect === true && refIsCatalogueSpecies ? refSci : null,
    };
  });
}
