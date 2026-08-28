/**
 * Reads a spotter's cosmetic state: which frame their record has earned, which
 * site backdrops they have unlocked, and which animals from their collection
 * they may wear as a crest.
 *
 * Kept out of src/lib/cosmetics.ts so the unlock rules there stay a pure,
 * unit-tested leaf. This file is the Prisma half.
 */

import type { PrismaClient } from "@prisma/client";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import type { BadgeCounts } from "@/lib/badges";
import {
  backdropTarget,
  backdropUnlocked,
  frameFor,
  shortSiteName,
  type FrameId,
} from "@/lib/cosmetics";

export interface BackdropOption {
  /** Snippet.site verbatim, the stored value. */
  site: string;
  /** Display name ("Ramsey Sound"). */
  label: string;
  /** This spotter's answers on clips from the site. */
  answers: number;
  /** Answers needed, already capped by how many clips the site has. */
  target: number;
  unlocked: boolean;
}

export interface CrestOption {
  scientificName: string;
  commonName: string;
  /** Shape class, which selects the silhouette asset. */
  shapeClass: string;
}

export interface CosmeticState {
  frame: FrameId;
  crest: CrestOption | null;
  backdropSite: string | null;
  backdropLabel: string | null;
  crestOptions: CrestOption[];
  backdropOptions: BackdropOption[];
}

export async function readCosmetics(
  prisma: PrismaClient,
  userId: string,
  counts: BadgeCounts,
): Promise<CosmeticState> {
  const [user, unlockedRows, clipsBySite, myAnswers] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { crestSpecies: true, backdropSite: true },
    }),
    prisma.unlockedSpecies.findMany({
      where: { userId },
      select: { scientificName: true },
      orderBy: { firstUnlockedAt: "asc" },
    }),
    prisma.snippet.groupBy({ by: ["site"], _count: { id: true } }),
    prisma.answer.findMany({
      where: { userId },
      select: { snippet: { select: { site: true } } },
    }),
  ]);

  const crestOptions: CrestOption[] = [];
  for (const row of unlockedRows) {
    const entry = CATALOGUE[row.scientificName];
    if (!entry) continue; // a species since removed from the catalogue
    crestOptions.push({
      scientificName: row.scientificName,
      commonName: entry.commonName,
      shapeClass: entry.shapeClass,
    });
  }
  crestOptions.sort((a, b) => a.commonName.localeCompare(b.commonName));

  const answersBySite = new Map<string, number>();
  for (const a of myAnswers) {
    const site = a.snippet.site;
    answersBySite.set(site, (answersBySite.get(site) ?? 0) + 1);
  }

  const backdropOptions: BackdropOption[] = clipsBySite
    .map((row) => {
      const answers = answersBySite.get(row.site) ?? 0;
      return {
        site: row.site,
        label: shortSiteName(row.site),
        answers,
        target: backdropTarget(row._count.id),
        unlocked: backdropUnlocked(answers, row._count.id),
      };
    })
    .sort(
      (a, b) =>
        Number(b.unlocked) - Number(a.unlocked) || a.label.localeCompare(b.label),
    );

  // A stored choice is re-checked on read, not just on write: a species can be
  // removed from the catalogue, and a site can be renamed, so a stale selection
  // must degrade to the default look rather than render something broken.
  const storedCrest = user?.crestSpecies ?? null;
  const crest = storedCrest
    ? (crestOptions.find((c) => c.scientificName === storedCrest) ?? null)
    : null;

  const storedBackdrop = user?.backdropSite ?? null;
  const backdropStillValid =
    storedBackdrop !== null &&
    backdropOptions.some((o) => o.site === storedBackdrop && o.unlocked);

  return {
    frame: frameFor(counts),
    crest,
    backdropSite: backdropStillValid ? storedBackdrop : null,
    backdropLabel: backdropStillValid ? shortSiteName(storedBackdrop) : null,
    crestOptions,
    backdropOptions,
  };
}
