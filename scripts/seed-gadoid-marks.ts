/**
 * Seed starter DiagnosticMark rows for the gadoid pilot (S9-T1 follow-up).
 *
 * Drops three first-draft marks per pilot gadoid (pollack, bib, cod) onto
 * the species' first cached reference photo. Coords are sensible defaults
 * for a left-facing lateral fish shot — admins are expected to drag them
 * into place in /admin/species/[name] after seeding.
 *
 * Idempotent: skips any species that already has >=1 DiagnosticMark row.
 * Skips with a warning when a species has no SpeciesImage rows yet
 * (run `npm run db:refresh-images` first in that case).
 *
 * Whiting (Merlangius merlangus) and haddock (Melanogrammus aeglefinus)
 * are in the pilot list in CLAUDE.md but NOT in the 26-species catalogue
 * at src/data/species-traits.json, so they're omitted here. If they get
 * added to the catalogue + SpeciesImage cache, add their drafts to
 * GADOID_DRAFTS below and re-run.
 *
 * Run: npm run db:seed-gadoid-marks
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SEED_AUTHOR = "seed-script@pebl-cic.co.uk";

type MarkDraft = {
  label: string;
  description: string;
  overlayX: number;
  overlayY: number;
  overlayRadius: number;
};

type SpeciesDraft = {
  scientificName: string;
  commonName: string;
  marks: MarkDraft[];
};

/**
 * Default coords assume a standard left-facing lateral fish photo with
 * the head at roughly x≈0.18, the pectoral fin at x≈0.32, and the lateral
 * line at y≈0.42 across the upper half of the body. Admins will drag any
 * mark whose photo breaks those assumptions (head-on shot, right-facing,
 * close-up of the head, etc.).
 */
const GADOID_DRAFTS: SpeciesDraft[] = [
  {
    scientificName: "Pollachius pollachius",
    commonName: "Pollack",
    marks: [
      {
        label: "Kinked lateral line",
        description:
          "The dark line down the flank bends sharply upward over the pectoral fin — pollack's most reliable single ID against bib and cod.",
        overlayX: 0.42,
        overlayY: 0.42,
        overlayRadius: 0.08,
      },
      {
        label: "Projecting lower jaw",
        description:
          "Lower jaw juts out beyond the upper, giving a slight under-bite silhouette. Cod and bib have an even or upper-jawed bite.",
        overlayX: 0.14,
        overlayY: 0.58,
        overlayRadius: 0.06,
      },
      {
        label: "No chin barbel",
        description:
          "Smooth chin — no whisker. This rules out cod and bib at a glance; both gadoids have a clear chin barbel.",
        overlayX: 0.18,
        overlayY: 0.68,
        overlayRadius: 0.05,
      },
    ],
  },
  {
    scientificName: "Trisopterus luscus",
    commonName: "Bib (Pouting)",
    marks: [
      {
        label: "Single chin barbel",
        description:
          "A short whisker under the chin — present on bib and cod, absent on pollack and whiting. Cod's is noticeably longer.",
        overlayX: 0.18,
        overlayY: 0.70,
        overlayRadius: 0.05,
      },
      {
        label: "Dark pectoral blotch",
        description:
          "Black patch where the pectoral fin meets the body, strongest in juveniles and often the first thing you notice in a school.",
        overlayX: 0.34,
        overlayY: 0.62,
        overlayRadius: 0.06,
      },
      {
        label: "Deep, tall body",
        description:
          "Bib is much deeper-bodied than pollack or whiting — almost a bream-like profile. Body depth is roughly a third of body length.",
        overlayX: 0.50,
        overlayY: 0.50,
        overlayRadius: 0.14,
      },
    ],
  },
  {
    scientificName: "Gadus morhua",
    commonName: "Atlantic cod",
    marks: [
      {
        label: "Prominent chin barbel",
        description:
          "Long single whisker under the chin — distinctly longer than bib's. The most reliable feature for separating cod from a deep-bodied pouting.",
        overlayX: 0.18,
        overlayY: 0.70,
        overlayRadius: 0.06,
      },
      {
        label: "Pale lateral line",
        description:
          "A distinct off-white stripe runs along the flank, easiest to see against cod's mottled olive-brown back. Curves only gently — no sharp kink as in pollack.",
        overlayX: 0.50,
        overlayY: 0.42,
        overlayRadius: 0.08,
      },
      {
        label: "Mottled olive-brown back",
        description:
          "Peppered, mottled camouflage on a green-brown base. Cleaner-coloured pollack and bib won't show this speckled texture.",
        overlayX: 0.55,
        overlayY: 0.32,
        overlayRadius: 0.10,
      },
    ],
  },
];

async function main() {
  console.log(`Seeding diagnostic marks for ${GADOID_DRAFTS.length} pilot gadoid(s)…\n`);

  let inserted = 0;
  let skippedExisting = 0;
  let skippedNoPhoto = 0;

  for (const draft of GADOID_DRAFTS) {
    const { scientificName, commonName, marks } = draft;

    // Idempotency guard: don't trample admin-edited marks.
    const existingCount = await prisma.diagnosticMark.count({
      where: { scientificName },
    });
    if (existingCount > 0) {
      console.log(
        `  ${commonName} (${scientificName}) — ${existingCount} mark(s) already authored, skipping.`,
      );
      skippedExisting++;
      continue;
    }

    // Pick the lowest-ordering SpeciesImage row — the same photo that
    // AnnotatedSpeciesPhoto renders in the wizard. If there's no image
    // cached, the marks would have nowhere to attach; warn and skip.
    const photo = await prisma.speciesImage.findFirst({
      where: { scientificName },
      orderBy: [{ ordering: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    if (!photo) {
      console.log(
        `  ${commonName} (${scientificName}) — no SpeciesImage rows cached. Run \`npm run db:refresh-images -- --species "${scientificName}"\` first.`,
      );
      skippedNoPhoto++;
      continue;
    }

    const rows = marks.map((mark, idx) => ({
      scientificName,
      speciesImageId: photo.id,
      order: idx,
      label: mark.label,
      description: mark.description,
      overlayX: mark.overlayX,
      overlayY: mark.overlayY,
      overlayRadius: mark.overlayRadius,
      createdBy: SEED_AUTHOR,
    }));

    await prisma.diagnosticMark.createMany({ data: rows });
    inserted += rows.length;
    console.log(`  ${commonName} (${scientificName}) — inserted ${rows.length} draft mark(s).`);
  }

  console.log(
    `\nDone. ${inserted} mark(s) inserted, ${skippedExisting} species already authored, ${skippedNoPhoto} species missing photos.`,
  );
  if (inserted > 0) {
    console.log(
      `\nNext: open /admin/species and tune the ring positions on each photo. Drafts are tagged createdBy=${SEED_AUTHOR}.`,
    );
  }
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
