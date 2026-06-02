/**
 * Seed starter DiagnosticMark rows for the invert pilot (Section 2c,
 * 2 Jun 2026). Sibling of seed-gadoid-marks.ts.
 *
 * Marks only RENDER on a `curated` SpeciesImage (Q3A-T4 photo-quality gate),
 * so this attaches to the lowest-ordering *curated* photo for each species and
 * warns+skips if the species has no curated photo yet. Curate one first by
 * adding it to the `overrides` block in src/data/species-images.json and
 * running `npm run db:refresh-images -- --species "<name>"`.
 *
 * Coords are first-draft, read off the specific curated photo named in each
 * entry's _photo note; admins tune them in /admin/species/[name].
 *
 * Idempotent: skips any species that already has >=1 DiagnosticMark.
 * Run: npx tsx --env-file=.env.local scripts/seed-invert-marks.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SEED_AUTHOR = "seed-script@pebl-cic.co.uk";

type MarkDraft = { label: string; description: string; overlayX: number; overlayY: number; overlayRadius: number };
type SpeciesDraft = { scientificName: string; commonName: string; _photo: string; marks: MarkDraft[] };

const INVERT_DRAFTS: SpeciesDraft[] = [
  {
    scientificName: "Aurelia aurita",
    commonName: "Moon Jellyfish",
    _photo: "Luc Viatour CC-BY-SA (two side-on jellies, larger one left). Coords target the left specimen.",
    marks: [
      {
        label: "Four gonad rings",
        description:
          "The four pale horseshoe loops on top of the bell are the gonads. They are the single most reliable moon-jelly tell; no other UK jelly shows this four-ring clover.",
        overlayX: 0.28,
        overlayY: 0.24,
        overlayRadius: 0.1,
      },
      {
        label: "Four frilly oral arms",
        description:
          "Four ribbon-like mouth-arms hang from the centre of the bell. They are short and frilly, not the long stinging tentacles of a lion's mane.",
        overlayX: 0.27,
        overlayY: 0.52,
        overlayRadius: 0.09,
      },
      {
        label: "Short tentacle fringe",
        description:
          "Only a fine fringe of very short tentacles rings the bell margin (vs the dense trailing mane of Cyanea). Harmless to touch.",
        overlayX: 0.4,
        overlayY: 0.4,
        overlayRadius: 0.06,
      },
    ],
  },
];

async function main() {
  console.log(`Seeding diagnostic marks for ${INVERT_DRAFTS.length} pilot invert(s)...\n`);
  let inserted = 0,
    skippedExisting = 0,
    skippedNoCurated = 0;

  for (const draft of INVERT_DRAFTS) {
    const { scientificName, commonName, marks } = draft;

    const existing = await prisma.diagnosticMark.count({ where: { scientificName } });
    if (existing > 0) {
      console.log(`  ${commonName} (${scientificName}) - ${existing} mark(s) already authored, skipping.`);
      skippedExisting++;
      continue;
    }

    // Marks only render on a curated photo (Q3A-T4). Attach to the
    // lowest-ordering curated row; without one the marks would never show.
    const photo = await prisma.speciesImage.findFirst({
      where: { scientificName, curated: true },
      orderBy: [{ ordering: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    if (!photo) {
      console.log(
        `  ${commonName} (${scientificName}) - no CURATED photo. Add one to species-images.json overrides + run db:refresh-images first.`,
      );
      skippedNoCurated++;
      continue;
    }

    await prisma.diagnosticMark.createMany({
      data: marks.map((m, idx) => ({
        scientificName,
        speciesImageId: photo.id,
        order: idx,
        label: m.label,
        description: m.description,
        overlayX: m.overlayX,
        overlayY: m.overlayY,
        overlayRadius: m.overlayRadius,
        createdBy: SEED_AUTHOR,
      })),
    });
    inserted += marks.length;
    console.log(`  ${commonName} (${scientificName}) - inserted ${marks.length} draft mark(s).`);
  }

  console.log(
    `\nDone. ${inserted} mark(s) inserted, ${skippedExisting} already authored, ${skippedNoCurated} missing a curated photo.`,
  );
  if (inserted > 0)
    console.log(`\nNext: tune ring positions in /admin/species. Drafts tagged createdBy=${SEED_AUTHOR}.`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
