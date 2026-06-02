/**
 * Seed starter DiagnosticMark rows for the FISH catalogue (extends the S9-T1
 * gadoid pilot to the wider catalogue). Sibling of seed-invert-marks.ts.
 *
 * Marks only RENDER on a `curated` SpeciesImage (Q3A-T4 gate), so this attaches
 * to the lowest-ordering *curated* photo per species and warns+skips if none is
 * curated yet. Curate one first via the `overrides` block in
 * src/data/species-images.json + `npm run db:refresh-images -- --species`.
 *
 * Diagnostics are grounded in the downloaded UK guides (EA fish key, Sussex
 * IFCA, ZSL estuarine) + Hayward & Ryland; coords are first-draft, read off the
 * specific curated photo named in each entry's _photo note. Admins tune them in
 * /admin/species/[name].
 *
 * Pollack (Pollachius pollachius) is intentionally absent here — it was seeded
 * by scripts/seed-gadoid-marks.ts. Idempotent: skips species that already have
 * >=1 DiagnosticMark.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-fish-marks.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SEED_AUTHOR = "seed-script@pebl-cic.co.uk";

type MarkDraft = { label: string; description: string; overlayX: number; overlayY: number; overlayRadius: number };
type SpeciesDraft = { scientificName: string; commonName: string; _photo: string; marks: MarkDraft[] };

const FISH_DRAFTS: SpeciesDraft[] = [
  // ---- Gadoids (finishing the S9-T1 pilot; pollack already seeded) ----
  {
    scientificName: "Pollachius virens",
    commonName: "Saithe",
    _photo: "iNat (c) Patrick CC-BY-NC, obs 147539728 (Norway) - single fish on rock, head left.",
    marks: [
      {
        label: "Straight lateral line",
        description:
          "The pale line down the flank is nearly straight, with no sharp upward kink over the pectoral fin (that kink is pollack's tell).",
        overlayX: 0.5,
        overlayY: 0.4,
        overlayRadius: 0.16,
      },
      {
        label: "Level jaw",
        description: "Upper and lower jaws are about equal (pollack's lower jaw juts out). Barbel tiny or absent.",
        overlayX: 0.16,
        overlayY: 0.48,
        overlayRadius: 0.06,
      },
      {
        label: "Dark greenish back",
        description: "A dark green-brown back over silvery sides, schooling. Also called coalfish or coley.",
        overlayX: 0.4,
        overlayY: 0.28,
        overlayRadius: 0.12,
      },
    ],
  },
  {
    scientificName: "Trisopterus luscus",
    commonName: "Bib (Pouting)",
    _photo: "iNat (c) eli_eli_oh CC-BY-NC, obs 255674112 (Weymouth UK) - single fish in hand, head upper-right.",
    marks: [
      {
        label: "Chin barbel",
        description: "A single whisker under the chin (shared with cod and poor cod; absent in pollack and saithe).",
        overlayX: 0.66,
        overlayY: 0.52,
        overlayRadius: 0.06,
      },
      {
        label: "Dark pectoral spot",
        description: "A dark blotch at the base of the pectoral fin - strongest in bib, and often the first thing you notice.",
        overlayX: 0.47,
        overlayY: 0.52,
        overlayRadius: 0.06,
      },
      {
        label: "Deep coppery body",
        description: "Much deeper-bodied than pollack or saithe, coppery with faint vertical bars - almost a bream-like profile.",
        overlayX: 0.35,
        overlayY: 0.6,
        overlayRadius: 0.16,
      },
    ],
  },
  {
    scientificName: "Trisopterus minutus",
    commonName: "Poor Cod",
    _photo: "iNat (c) JaRo Guiding CC-BY-NC, obs 133802022 (Norway) - single fish on a hook, head up.",
    marks: [
      {
        label: "Chin barbel",
        description: "A short whisker under the chin, like bib's. Poor cod is the smaller, slimmer of the two.",
        overlayX: 0.5,
        overlayY: 0.52,
        overlayRadius: 0.05,
      },
      {
        label: "Large eye",
        description: "A noticeably large eye for the size of the head - poor cod is a small (to ~15 cm), big-eyed gadoid.",
        overlayX: 0.5,
        overlayY: 0.45,
        overlayRadius: 0.07,
      },
      {
        label: "Slimmer body than bib",
        description: "Coppery but more slender and tapering than the deep-bodied bib; three dorsal fins.",
        overlayX: 0.42,
        overlayY: 0.62,
        overlayRadius: 0.12,
      },
    ],
  },
  {
    scientificName: "Gadus morhua",
    commonName: "Atlantic Cod",
    _photo: "iNat (c) Sam R CC-BY-NC, obs 104496451 (Iceland) - live cod held, head lower-right.",
    marks: [
      {
        label: "Long chin barbel",
        description: "A long single whisker under the chin - distinctly longer than bib's; the most reliable cod feature.",
        overlayX: 0.74,
        overlayY: 0.7,
        overlayRadius: 0.06,
      },
      {
        label: "Pale lateral line",
        description: "A distinct off-white stripe curves along the flank, easiest to see against the mottled back. No sharp kink.",
        overlayX: 0.48,
        overlayY: 0.42,
        overlayRadius: 0.14,
      },
      {
        label: "Mottled olive-brown back",
        description: "Peppered, mottled camouflage on a green-brown base - cleaner-coloured pollack and saithe lack this speckling.",
        overlayX: 0.4,
        overlayY: 0.3,
        overlayRadius: 0.14,
      },
    ],
  },

  // ---- Wrasses ----
  {
    scientificName: "Labrus bergylta",
    commonName: "Ballan Wrasse",
    _photo: "iNat (c) Oscar Wainwright CC-BY-NC, obs 213042263 - fish in net, head left.",
    marks: [
      {
        label: "Thick fleshy lips",
        description: "Big, rubbery lips for picking shellfish off the rock - a wrasse hallmark, strongest in the chunky ballan.",
        overlayX: 0.22,
        overlayY: 0.48,
        overlayRadius: 0.06,
      },
      {
        label: "Single long dorsal fin",
        description: "One continuous dorsal fin runs almost the whole back (spiny at the front, soft behind) - not split like a bass or gadoid.",
        overlayX: 0.55,
        overlayY: 0.3,
        overlayRadius: 0.16,
      },
      {
        label: "Stout mottled body",
        description: "A deep, robust green-to-brown body, often pale-spotted and highly variable. Our largest wrasse.",
        overlayX: 0.6,
        overlayY: 0.55,
        overlayRadius: 0.16,
      },
    ],
  },
  {
    scientificName: "Labrus mixtus",
    commonName: "Cuckoo Wrasse",
    _photo: "iNat (c) Soleil L. K. Johansson CC-BY-NC, obs 245568411 - vivid MALE, head left.",
    marks: [
      {
        label: "Electric blue head & stripes",
        description: "The breeding male is unmistakable: brilliant blue head and wavy blue stripes streaking back over an orange body.",
        overlayX: 0.25,
        overlayY: 0.45,
        overlayRadius: 0.14,
      },
      {
        label: "Orange flanks",
        description: "Bright orange flanks under the blue lines (males). A slim, pointed-headed wrasse.",
        overlayX: 0.55,
        overlayY: 0.55,
        overlayRadius: 0.16,
      },
      {
        label: "Females look different",
        description: "Females are pinkish-orange with three dark blotches across the rear of the back - no blue. Worth knowing both.",
        overlayX: 0.7,
        overlayY: 0.28,
        overlayRadius: 0.1,
      },
    ],
  },
  {
    scientificName: "Symphodus melops",
    commonName: "Corkwing Wrasse",
    _photo: "iNat (c) Xavier Rufray CC-BY-NC, obs 63891382 - fish in weed, head right.",
    marks: [
      {
        label: "Blue-green lines on the face",
        description: "A maze of blue-green wavy lines over the cheek and gill cover, vivid on breeding males.",
        overlayX: 0.64,
        overlayY: 0.42,
        overlayRadius: 0.1,
      },
      {
        label: "Dark spot on the tail base",
        description: "A small dark spot in the centre of the tail base - present in both sexes; the most reliable corkwing tell.",
        overlayX: 0.12,
        overlayY: 0.44,
        overlayRadius: 0.07,
      },
      {
        label: "Comma behind the eye",
        description: "A short dark comma-shaped mark just behind the eye (clearest on males).",
        overlayX: 0.58,
        overlayY: 0.36,
        overlayRadius: 0.05,
      },
    ],
  },
  {
    scientificName: "Ctenolabrus rupestris",
    commonName: "Goldsinny Wrasse",
    _photo: "iNat (c) franciscodocampo CC-BY, obs 72524462 - fish on rock, head right.",
    marks: [
      {
        label: "Dark spot on upper tail base",
        description: "A bold black spot at the TOP of the tail base - the goldsinny's signature mark.",
        overlayX: 0.12,
        overlayY: 0.3,
        overlayRadius: 0.07,
      },
      {
        label: "Dark spot at front of dorsal",
        description: "A second dark blotch at the very front of the dorsal fin. The two black spots together clinch it.",
        overlayX: 0.55,
        overlayY: 0.22,
        overlayRadius: 0.06,
      },
      {
        label: "Small reddish-brown body",
        description: "Our smallest common wrasse (to ~15 cm), slender and reddish-brown, hugging rocky crevices.",
        overlayX: 0.45,
        overlayY: 0.46,
        overlayRadius: 0.16,
      },
    ],
  },
];

async function main() {
  console.log(`Seeding diagnostic marks for ${FISH_DRAFTS.length} fish...\n`);
  let inserted = 0,
    skippedExisting = 0,
    skippedNoCurated = 0;

  for (const draft of FISH_DRAFTS) {
    const { scientificName, commonName, marks } = draft;
    const existing = await prisma.diagnosticMark.count({ where: { scientificName } });
    if (existing > 0) {
      console.log(`  ${commonName} (${scientificName}) - ${existing} mark(s) already authored, skipping.`);
      skippedExisting++;
      continue;
    }
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
  if (inserted > 0) console.log(`\nNext: tune ring positions in /admin/species. Drafts tagged createdBy=${SEED_AUTHOR}.`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
