/**
 * Re-author diagnostic marks for the 7 species whose CURATED mark-bearing photo
 * was a poor/dead/multi specimen (found by the Gemini quality sweep, 3 Jun 2026).
 *
 * Each species already has a GOOD curated lead photo at ordering=1 (0 marks);
 * the marks were stranded on the old bad photo, and AnnotatedSpeciesPhoto renders
 * "the first photo WITH marks", so the wizard showed the bad one. This moves each
 * species' marks onto the good lead photo with fresh coordinates (placed by eye
 * off the actual photo, orientation verified — see PLAN), keeps the existing
 * label/description text, and deletes the old dead photo (all 7 are already in
 * photo-blocklist.json so the cron won't re-add them).
 *
 * Idempotent: skips a species if its good lead photo already has marks.
 *
 *   npx tsx --env-file=.env.local scripts/reauthor-quality-flagged-marks.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CREATED_BY = "image-quality-reauthor@pebl-cic.co.uk";

// photoId of the good lead photo + per-order [overlayX, overlayY, overlayRadius]
// (normalised 0..1; radius is fraction of min(width,height)). Coords placed by
// viewing each photo; orientation noted in the comment.
const PLAN: Record<
  string,
  { goodPhotoId: string; coords: Record<number, [number, number, number]> }
> = {
  // Bib — head RIGHT, chin barbel under mouth, deep coppery body.
  "Trisopterus luscus": {
    goodPhotoId: "398792216",
    coords: { 0: [0.66, 0.71, 0.045], 1: [0.52, 0.6, 0.06], 2: [0.38, 0.45, 0.13] },
  },
  // Shanny — head LEFT, smooth crown, thick lips/big eyes, mottled body.
  "Lipophrys pholis": {
    goodPhotoId: "300356277",
    coords: { 0: [0.17, 0.42, 0.06], 1: [0.13, 0.47, 0.06], 2: [0.45, 0.45, 0.12] },
  },
  // Poor cod — head RIGHT, big eye, chin barbel, slim body.
  "Trisopterus minutus": {
    goodPhotoId: "172596109",
    coords: { 0: [0.89, 0.74, 0.04], 1: [0.86, 0.61, 0.05], 2: [0.45, 0.55, 0.12] },
  },
  // Veined squid — arms RIGHT / body LEFT, long rear fins.
  "Loligo forbesii": {
    goodPhotoId: "532577319",
    coords: { 0: [0.42, 0.52, 0.13], 1: [0.22, 0.6, 0.1] },
  },
  // Painted top shell — sharp cone, pointed apex at top.
  "Calliostoma zizyphinum": {
    goodPhotoId: "289703286",
    coords: { 0: [0.42, 0.55, 0.16], 1: [0.5, 0.24, 0.06] },
  },
  // Barrel jelly — domed bell RIGHT, frilly arms LEFT.
  "Rhizostoma octopus": {
    goodPhotoId: "516082202",
    coords: { 0: [0.72, 0.42, 0.16], 1: [0.28, 0.56, 0.15] },
  },
  // Cuckoo wrasse (male) — head RIGHT, blue head/stripes, orange flanks.
  "Labrus mixtus": {
    goodPhotoId: "122379066",
    coords: { 0: [0.62, 0.46, 0.11], 1: [0.45, 0.52, 0.1], 2: [0.32, 0.5, 0.08] },
  },
};

async function main() {
  for (const [sci, plan] of Object.entries(PLAN)) {
    const good = await prisma.speciesImage.findFirst({
      where: { scientificName: sci, url: { contains: `${plan.goodPhotoId}/` } },
    });
    if (!good) {
      console.log(`SKIP ${sci}: good photo ${plan.goodPhotoId} not found`);
      continue;
    }
    const existing = await prisma.diagnosticMark.findMany({
      where: { scientificName: sci },
      orderBy: { order: "asc" },
    });
    if (existing.some((m) => m.speciesImageId === good.id)) {
      console.log(`SKIP ${sci}: good photo already has marks (idempotent)`);
      continue;
    }
    if (existing.length === 0) {
      console.log(`SKIP ${sci}: no existing marks to move`);
      continue;
    }

    // Old (bad) photos that currently hold the marks — delete after moving.
    const oldPhotoIds = [...new Set(existing.map((m) => m.speciesImageId))].filter(
      (id) => id !== good.id,
    );

    const creates = existing.map((m) => {
      const c = plan.coords[m.order];
      if (!c) throw new Error(`${sci}: no coords for order ${m.order}`);
      return prisma.diagnosticMark.create({
        data: {
          scientificName: sci,
          speciesImageId: good.id,
          order: m.order,
          label: m.label,
          description: m.description,
          overlayX: c[0],
          overlayY: c[1],
          overlayRadius: c[2],
          createdBy: CREATED_BY,
        },
      });
    });

    await prisma.$transaction([
      prisma.diagnosticMark.deleteMany({ where: { scientificName: sci } }),
      ...creates,
      ...oldPhotoIds.map((id) => prisma.speciesImage.delete({ where: { id } })),
    ]);

    console.log(
      `OK ${sci}: moved ${existing.length} marks to photo ${plan.goodPhotoId}, deleted ${oldPhotoIds.length} old photo(s)`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
