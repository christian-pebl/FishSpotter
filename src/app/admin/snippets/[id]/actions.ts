"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin";
import { CATALOGUE_ALIASES, loadAliases, buildShapeClassByForm } from "@/lib/answer-matching";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { rescoreAnswers } from "@/lib/snippet-reference";

export type SetReferenceResult = {
  rescored: number;
  nowCorrect: number;
  unlocked: number;
};

/**
 * Set (a catalogue species) or clear (null = indeterminate / community) a
 * snippet's reference, then retro-score every answer on it and retro-unlock the
 * species for now-correct spotters. Admin-only.
 *
 * A non-null value must be a catalogue species (the editor picks from the
 * catalogue). Clearing makes it a community clip (answers go pending; the
 * consensus path takes over). Existing unlocks from a prior reference are left
 * as-is (we add, never yank a collected species).
 */
export async function setSnippetReference(
  snippetId: string,
  value: string | null,
): Promise<SetReferenceResult> {
  await requireAdminSession();

  const staffAnswer = value && value.trim() ? value.trim() : null;
  if (staffAnswer !== null && !CATALOGUE[staffAnswer]) {
    throw new Error("Reference must be a catalogue species, or cleared (indeterminate).");
  }

  const snippet = await prisma.snippet.findUnique({ where: { id: snippetId }, select: { id: true } });
  if (!snippet) throw new Error("Snippet not found");

  const answers = await prisma.answer.findMany({
    where: { snippetId },
    select: { id: true, userId: true, chosenOption: true },
  });

  const aliases = [...CATALOGUE_ALIASES, ...(await loadAliases())];
  const shapeMap = buildShapeClassByForm(aliases);
  const rescored = rescoreAnswers(answers, staffAnswer, aliases, shapeMap);

  const unlocks = rescored.filter(
    (r): r is typeof r & { unlockSpecies: string } => !!r.unlockSpecies,
  );

  await prisma.$transaction([
    prisma.snippet.update({ where: { id: snippetId }, data: { staffAnswer } }),
    ...rescored.map((r) =>
      prisma.answer.update({
        where: { id: r.id },
        data: { isCorrect: r.isCorrect, points: r.points },
      }),
    ),
    ...(unlocks.length
      ? [
          prisma.unlockedSpecies.createMany({
            data: unlocks.map((r) => ({ userId: r.userId, scientificName: r.unlockSpecies })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  revalidatePath("/admin/snippets");
  revalidatePath(`/admin/snippets/${snippetId}`);

  return {
    rescored: rescored.length,
    nowCorrect: rescored.filter((r) => r.isCorrect === true).length,
    unlocked: unlocks.length,
  };
}
