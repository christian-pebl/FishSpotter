"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { backdropAllowed, backdropUnlocked, crestAllowed } from "@/lib/cosmetics";

/**
 * Server actions for the two cosmetics a spotter CHOOSES (the frame is derived
 * from their record and cannot be picked).
 *
 * Both re-derive what the spotter has unlocked from the database and reject
 * anything else. The client is never trusted here, because each value is a
 * public claim on a public profile: a crest asserts "I found this animal" and a
 * backdrop asserts "I worked this site". A spotter may only ever set their OWN
 * appearance, so the target is the session user, never an id from the client.
 */

async function requireOwnUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) throw new Error("Not signed in");
  return userId;
}

export async function setCrest(scientificName: string | null): Promise<void> {
  const userId = await requireOwnUserId();

  const unlocked = new Set(
    (
      await prisma.unlockedSpecies.findMany({
        where: { userId },
        select: { scientificName: true },
      })
    ).map((r) => r.scientificName),
  );

  if (!crestAllowed(scientificName, unlocked)) {
    throw new Error("You have not unlocked that species");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { crestSpecies: scientificName },
  });
  revalidatePath(`/u/${userId}`);
}

export async function setBackdrop(site: string | null): Promise<void> {
  const userId = await requireOwnUserId();

  const [clipsBySite, myAnswers] = await Promise.all([
    prisma.snippet.groupBy({ by: ["site"], _count: { id: true } }),
    prisma.answer.findMany({
      where: { userId },
      select: { snippet: { select: { site: true } } },
    }),
  ]);

  const answersBySite = new Map<string, number>();
  for (const a of myAnswers) {
    answersBySite.set(a.snippet.site, (answersBySite.get(a.snippet.site) ?? 0) + 1);
  }

  const unlockedSites = new Set(
    clipsBySite
      .filter((row) => backdropUnlocked(answersBySite.get(row.site) ?? 0, row._count.id))
      .map((row) => row.site),
  );

  if (!backdropAllowed(site, unlockedSites)) {
    throw new Error("You have not unlocked that site");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { backdropSite: site },
  });
  revalidatePath(`/u/${userId}`);
}
