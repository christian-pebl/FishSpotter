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

  // ---- Gobies, blenny, butterfish, sculpin ----
  {
    scientificName: "Gobiusculus flavescens",
    commonName: "Two-spotted Goby",
    _photo: "iNat (c) Anna Renman CC-BY-NC, obs 295621345 - single fish, head lower-right, tail upper-left.",
    marks: [
      {
        label: "Dark spot behind pectoral fin",
        description: "The first of the two namesake dark spots sits just behind the pectoral fin.",
        overlayX: 0.5,
        overlayY: 0.55,
        overlayRadius: 0.07,
      },
      {
        label: "Dark spot at the tail base",
        description: "The second spot sits at the tail base. Two spots + orange-brown with blue speckles = two-spotted goby.",
        overlayX: 0.25,
        overlayY: 0.32,
        overlayRadius: 0.07,
      },
      {
        label: "Hovers in midwater shoals",
        description: "Unlike other gobies it does not perch on the bottom - it hovers in loose midwater groups over kelp and weed.",
        overlayX: 0.45,
        overlayY: 0.45,
        overlayRadius: 0.14,
      },
    ],
  },
  {
    scientificName: "Pomatoschistus microps",
    commonName: "Common Goby",
    _photo: "iNat (c) Klaus Kevin Kristensen CC-BY, obs 62920685 - goby on the bottom, head left.",
    marks: [
      {
        label: "Small mottled sandy goby",
        description: "A tiny (to ~6 cm) sandy-mottled goby. Very like the sand goby; common goby favours brackish estuaries and pools.",
        overlayX: 0.45,
        overlayY: 0.5,
        overlayRadius: 0.16,
      },
      {
        label: "Pelvic-fin sucker",
        description: "Like all gobies, the pelvic fins are fused into a little sucker disc it uses to perch on the bottom.",
        overlayX: 0.3,
        overlayY: 0.62,
        overlayRadius: 0.06,
      },
      {
        label: "Perched, rounded head",
        description: "Rests propped on the bottom with a blunt rounded head and large eyes set high.",
        overlayX: 0.3,
        overlayY: 0.48,
        overlayRadius: 0.08,
      },
    ],
  },
  {
    scientificName: "Gobius paganellus",
    commonName: "Rock Goby",
    _photo: "iNat (c) donnymidas CC-BY-NC, obs 348145838 (Wembury UK) - dorsal fin raised, head left.",
    marks: [
      {
        label: "Pale band on first dorsal fin",
        description: "A pale orange/yellow band runs along the top edge of the first dorsal fin - the rock goby's tell.",
        overlayX: 0.45,
        overlayY: 0.3,
        overlayRadius: 0.1,
      },
      {
        label: "Robust dark body",
        description: "A chunky, dark, mottled goby (to ~12 cm), much bigger and darker than the little sand/common gobies. Rocky shores.",
        overlayX: 0.45,
        overlayY: 0.52,
        overlayRadius: 0.16,
      },
      {
        label: "Blunt head, thick lips",
        description: "A broad blunt head with thick lips, eyes set high.",
        overlayX: 0.25,
        overlayY: 0.48,
        overlayRadius: 0.08,
      },
    ],
  },
  {
    scientificName: "Pomatoschistus minutus",
    commonName: "Sand Goby",
    _photo: "iNat (c) Klaus Kevin Kristensen CC-BY, obs 63918708 - pale goby on the bottom, head right.",
    marks: [
      {
        label: "Pale sandy body",
        description: "Almost translucent, pale sandy-mottled - matches clean sand. Slightly larger and paler than the common goby.",
        overlayX: 0.42,
        overlayY: 0.48,
        overlayRadius: 0.16,
      },
      {
        label: "Pelvic-fin sucker",
        description: "Perches on the sand on the fused pelvic-fin sucker shared by all gobies.",
        overlayX: 0.42,
        overlayY: 0.6,
        overlayRadius: 0.07,
      },
      {
        label: "Rows of small saddles",
        description: "Faint rows of small dark saddles/spots along the back; a row of spots on the first dorsal in males.",
        overlayX: 0.45,
        overlayY: 0.4,
        overlayRadius: 0.1,
      },
    ],
  },
  {
    scientificName: "Pholis gunnellus",
    commonName: "Butterfish",
    _photo: "iNat (c) nicolasperrott CC-BY-NC, obs 159932101 - whole fish on white, head left.",
    marks: [
      {
        label: "Row of dark eye-spots",
        description: "A line of white-ringed black eye-spots runs along the base of the dorsal fin - the unmistakable butterfish mark.",
        overlayX: 0.45,
        overlayY: 0.55,
        overlayRadius: 0.18,
      },
      {
        label: "Long ribbon body",
        description: "A long, flattened, ribbon-like body, slippery to hold (hence butterfish/gunnel). Drapes over rocks.",
        overlayX: 0.55,
        overlayY: 0.65,
        overlayRadius: 0.14,
      },
      {
        label: "Tiny pointed head",
        description: "A small, blunt head on the slender ribbon - not eel-like teeth, just a gentle weed-grazer.",
        overlayX: 0.12,
        overlayY: 0.4,
        overlayRadius: 0.06,
      },
    ],
  },
  {
    scientificName: "Lipophrys pholis",
    commonName: "Shanny",
    _photo: "iNat (c) Stefan CC-BY-NC, obs 14654155 - head-on portrait.",
    marks: [
      {
        label: "No head tentacles",
        description: "The crown is smooth - NO branched tentacles above the eyes (that rules in the shanny vs the tompot blenny).",
        overlayX: 0.48,
        overlayY: 0.3,
        overlayRadius: 0.16,
      },
      {
        label: "Thick lips, big high-set eyes",
        description: "A blunt, scaleless head with thick lips and large eyes set high and forward - a true blenny.",
        overlayX: 0.48,
        overlayY: 0.5,
        overlayRadius: 0.14,
      },
      {
        label: "Mottled green-brown body",
        description: "A smooth, scaleless, mottled green-brown body that wedges into crevices and rock pools.",
        overlayX: 0.22,
        overlayY: 0.55,
        overlayRadius: 0.12,
      },
    ],
  },
  {
    scientificName: "Taurulus bubalis",
    commonName: "Long-spined Sea Scorpion",
    _photo: "iNat (c) ice33 CC-BY-NC, obs 326793769 - small fish on a grey bag.",
    marks: [
      {
        label: "Long cheek spine",
        description: "A long spine on the cheek (preopercular) reaches back past the gill opening - the tell vs the short-spined sea scorpion.",
        overlayX: 0.38,
        overlayY: 0.45,
        overlayRadius: 0.08,
      },
      {
        label: "Big spiny head, fan pectorals",
        description: "A broad, spiny, knobbly head and large fan-like pectoral fins; a stout, tapering body.",
        overlayX: 0.48,
        overlayY: 0.42,
        overlayRadius: 0.14,
      },
      {
        label: "Mottled camouflage",
        description: "Highly variable blotchy camouflage (green, brown, reddish), sitting motionless among weed and rock.",
        overlayX: 0.55,
        overlayY: 0.5,
        overlayRadius: 0.12,
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
