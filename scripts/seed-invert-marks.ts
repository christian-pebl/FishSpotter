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
  {
    scientificName: "Chrysaora hysoscella",
    commonName: "Compass Jellyfish",
    _photo: "iNat (c) scush CC-BY-NC, obs 89541182 - single bell top-down-ish, tentacles below.",
    marks: [
      {
        label: "Radiating compass marks",
        description:
          "Dark brown V-shapes radiate from the centre of the bell like the points of a compass - the single best tell for this species.",
        overlayX: 0.42,
        overlayY: 0.4,
        overlayRadius: 0.2,
      },
      {
        label: "Dark central ring",
        description: "A small dark ring sits at the very top of the bell, where all the V-marks meet.",
        overlayX: 0.43,
        overlayY: 0.3,
        overlayRadius: 0.07,
      },
      {
        label: "Long trailing tentacles",
        description: "Twenty-four long, fine tentacles trail from the bell margin, plus four frilly mouth-arms. It stings.",
        overlayX: 0.4,
        overlayY: 0.7,
        overlayRadius: 0.12,
      },
    ],
  },
  {
    scientificName: "Cyanea capillata",
    commonName: "Lion's Mane Jellyfish",
    _photo: "iNat (c) belzebub CC-BY-NC, obs 97842642 - stranded specimen, reddish-brown bell + tentacle mass.",
    marks: [
      {
        label: "Reddish-brown bell",
        description:
          "A broad, domed bell in warm reddish-brown - the UK's largest jelly. Cooler-coloured blue jelly (C. lamarckii) is the smaller lookalike.",
        overlayX: 0.52,
        overlayY: 0.4,
        overlayRadius: 0.18,
      },
      {
        label: "Dense mane of tentacles",
        description:
          "Hundreds of long, fine tentacles hang in a thick 'mane' beneath the bell (vs the short fringe of a moon jelly). Painful sting.",
        overlayX: 0.45,
        overlayY: 0.62,
        overlayRadius: 0.16,
      },
    ],
  },
  {
    scientificName: "Rhizostoma octopus",
    commonName: "Barrel Jellyfish",
    _photo: "iNat (c) gorgonopsia CC-BY-NC, obs 324932796 - held specimen, solid bell + frilly arms.",
    marks: [
      {
        label: "Solid domed bell",
        description:
          "A thick, firm, dome-shaped bell (the 'dustbin-lid' jelly) with a violet rim - much more solid than the floppy saucer jellies.",
        overlayX: 0.42,
        overlayY: 0.4,
        overlayRadius: 0.16,
      },
      {
        label: "Eight frilly arms, no tentacles",
        description:
          "Eight thick, cauliflower-frilly mouth-arms hang below, and there are NO long trailing tentacles. Mostly harmless.",
        overlayX: 0.45,
        overlayY: 0.66,
        overlayRadius: 0.18,
      },
    ],
  },
  {
    scientificName: "Cyanea lamarckii",
    commonName: "Blue Jellyfish",
    _photo: "iNat (c) Manja CC-BY-NC, obs 51094208 - top-down, vivid purple radiating bell.",
    marks: [
      {
        label: "Blue-purple bell",
        description:
          "Vivid blue to purple, the colour deepening towards the centre of the bell. Like a small lion's mane but cool-coloured, not reddish-brown.",
        overlayX: 0.45,
        overlayY: 0.45,
        overlayRadius: 0.18,
      },
      {
        label: "Radiating canals",
        description: "Dark lines radiate from the centre, with a mass of fine trailing tentacles beneath. Mild sting.",
        overlayX: 0.45,
        overlayY: 0.43,
        overlayRadius: 0.1,
      },
    ],
  },
  {
    scientificName: "Pelagia noctiluca",
    commonName: "Mauve Stinger",
    _photo: "iNat (c) Melissa Carlson CC-BY-NC, obs 228592978 - open-water swimmer, warty bell + long tentacles.",
    marks: [
      {
        label: "Warty stinging bell",
        description:
          "The mauve-purple bell is peppered all over with dark stinging warts - unique among the common UK jellies. Glows blue at night.",
        overlayX: 0.45,
        overlayY: 0.18,
        overlayRadius: 0.16,
      },
      {
        label: "Frilly oral arms",
        description: "Four long, frilly mouth-arms hang from the centre, between the bell and the tentacles.",
        overlayX: 0.45,
        overlayY: 0.4,
        overlayRadius: 0.12,
      },
      {
        label: "Long trailing tentacles",
        description: "Eight long, slender tentacles trail well below the bell. A notable stinger; fully oceanic, arrives in swarms.",
        overlayX: 0.45,
        overlayY: 0.66,
        overlayRadius: 0.16,
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
