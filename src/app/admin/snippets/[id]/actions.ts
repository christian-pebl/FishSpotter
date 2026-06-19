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

// One bbox keyframe in the stored track. Same shape the feed renderer
// (BBoxFrame in FeedPlayer.tsx) and the seed importer expect: a frame index
// within the clip plus the normalised (0..1) box.
export type TrackFrame = {
  frame_clip: number;
  x_norm: number;
  y_norm: number;
  w_norm: number;
  h_norm: number;
};

// A drawn track is keyframes, not per-frame detections, so the ceiling can be
// generous without risking a runaway JSON blob.
const MAX_TRACK_FRAMES = 5000;

function clamp01n(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * Save (or clear) a snippet's bbox tracking, drawn in the admin editor.
 * Replaces the whole track: pass the full keyframe list, or [] to clear it
 * back to "no tracking" (stored as null, same as a snippet that was never
 * tracked). Coords are clamped to 0..1 and frames sorted by frame_clip so the
 * feed's proportional progress->frame mapping reads them in order. Admin-only.
 */
export async function saveSnippetTrack(
  snippetId: string,
  frames: TrackFrame[],
): Promise<{ frames: number }> {
  await requireAdminSession();
  if (!Array.isArray(frames)) throw new Error("Invalid track");
  if (frames.length > MAX_TRACK_FRAMES) {
    throw new Error(`Too many keyframes (max ${MAX_TRACK_FRAMES}).`);
  }

  const snippet = await prisma.snippet.findUnique({
    where: { id: snippetId },
    select: { id: true },
  });
  if (!snippet) throw new Error("Snippet not found");

  const clean: TrackFrame[] = frames
    .map((f) => ({
      frame_clip: Number.isFinite(f.frame_clip) ? Math.max(0, Math.round(f.frame_clip)) : 0,
      x_norm: clamp01n(f.x_norm),
      y_norm: clamp01n(f.y_norm),
      w_norm: clamp01n(f.w_norm),
      h_norm: clamp01n(f.h_norm),
    }))
    .sort((a, b) => a.frame_clip - b.frame_clip);

  const bboxJson = clean.length ? JSON.stringify(clean) : null;
  await prisma.snippet.update({ where: { id: snippetId }, data: { bboxJson } });

  revalidatePath(`/admin/snippets/${snippetId}`);
  revalidatePath("/feed");
  return { frames: clean.length };
}

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
