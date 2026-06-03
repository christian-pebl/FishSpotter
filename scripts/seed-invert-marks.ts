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

  // ---- CRAB tile ----
  {
    scientificName: "Carcinus maenas",
    commonName: "Shore Crab",
    _photo: "iNat (c) Poul Erik Rasmussen CC-BY-NC, obs 10247967 - green crab in situ, claws raised.",
    marks: [
      {
        label: "Five teeth each side",
        description:
          "Count five sharp teeth along each side of the shell, behind the eyes (plus three blunt bumps between the eyes). The classic shore-crab tell.",
        overlayX: 0.5,
        overlayY: 0.42,
        overlayRadius: 0.12,
      },
      {
        label: "Pointed walking legs",
        description:
          "The legs end in simple points, never flattened into swimming paddles - that rules out the velvet and harbour crabs.",
        overlayX: 0.66,
        overlayY: 0.66,
        overlayRadius: 0.12,
      },
    ],
  },
  {
    scientificName: "Cancer pagurus",
    commonName: "Edible Crab",
    _photo: "iNat (c) selmahakonsen CC-BY-NC, obs 103138094 - pale carapace, pie-crust edge clear.",
    marks: [
      {
        label: "Pie-crust shell edge",
        description:
          "The front margin of the broad oval shell is crimped like the edge of a pie - unmistakable once you've seen it.",
        overlayX: 0.5,
        overlayY: 0.38,
        overlayRadius: 0.22,
      },
      {
        label: "Broad oval shell",
        description:
          "A wide, smooth oval shell (reddish-brown in life) with big black-tipped pincers. The biggest crab you'll meet on the shore.",
        overlayX: 0.5,
        overlayY: 0.54,
        overlayRadius: 0.2,
      },
    ],
  },
  {
    scientificName: "Necora puber",
    commonName: "Velvet Swimming Crab",
    _photo: "iNat (c) João Pedro Silva CC-BY-NC, obs 8504554 - face close-up, red eyes + velvet.",
    marks: [
      {
        label: "Bright red eyes",
        description: "Vivid red eyes are the instant giveaway - no other common UK crab has them.",
        overlayX: 0.82,
        overlayY: 0.4,
        overlayRadius: 0.12,
      },
      {
        label: "Velvety carapace",
        description: "The shell is coated in fine velvety fur, dull brown. The last legs (not shown here) are flattened swimming paddles.",
        overlayX: 0.45,
        overlayY: 0.18,
        overlayRadius: 0.16,
      },
    ],
  },
  {
    scientificName: "Liocarcinus depurator",
    commonName: "Harbour Crab",
    _photo: "iNat (c) kathinkadalseg CC-BY-NC, obs 143420977 - clean dorsal, paddles visible.",
    marks: [
      {
        label: "Flattened swimming paddles",
        description:
          "The last pair of legs end in flat, paddle-shaped segments (tips often tinged violet) for swimming - shared with the velvet crab, absent in the shore crab.",
        overlayX: 0.32,
        overlayY: 0.74,
        overlayRadius: 0.1,
      },
      {
        label: "Five side teeth",
        description: "Five teeth down each side of the shell behind the eyes; reddish overall. A small swimming crab of muddy sand.",
        overlayX: 0.45,
        overlayY: 0.4,
        overlayRadius: 0.1,
      },
    ],
  },
  {
    scientificName: "Hyas araneus",
    commonName: "Great Spider Crab",
    _photo: "iNat (c) Tse Chung Yi CC-BY-NC, obs 22709550 - held, long legs + teardrop carapace.",
    marks: [
      {
        label: "Long spindly legs",
        description: "Long, thin, spider-like legs - far longer relative to the body than any of the true crabs here.",
        overlayX: 0.3,
        overlayY: 0.45,
        overlayRadius: 0.13,
      },
      {
        label: "Teardrop shell, pointed snout",
        description:
          "The shell is teardrop-shaped, narrowing to a forked point at the front, and is often coated in seaweed and hydroids.",
        overlayX: 0.48,
        overlayY: 0.42,
        overlayRadius: 0.1,
      },
    ],
  },
  {
    scientificName: "Pagurus bernhardus",
    commonName: "Hermit Crab",
    _photo: "iNat (c) Bianca Bahlert CC-BY-NC, obs 192944870 - hermit peeking from a shell.",
    marks: [
      {
        label: "Lives in a borrowed shell",
        description:
          "Not a true crab: a soft-bodied animal living inside an empty snail shell (a periwinkle when small, a whelk when bigger). The shell is the giveaway.",
        overlayX: 0.35,
        overlayY: 0.45,
        overlayRadius: 0.2,
      },
      {
        label: "Legs and claws poke out",
        description: "Only the legs and unequal claws show, the right claw the larger - used to block the shell entrance when threatened.",
        overlayX: 0.58,
        overlayY: 0.62,
        overlayRadius: 0.14,
      },
    ],
  },

  // ---- SQUID tile (cephalopods) ----
  {
    scientificName: "Sepia officinalis",
    commonName: "Common Cuttlefish",
    _photo: "iNat (c) Falk Viczian CC-BY-NC, obs 253522038 (Greece) - classic cuttlefish profile, W-pupil.",
    marks: [
      {
        label: "W-shaped pupil",
        description: "The eye has a distinctive wavy, W-shaped pupil - a cuttlefish signature you won't see on a fish.",
        overlayX: 0.56,
        overlayY: 0.4,
        overlayRadius: 0.08,
      },
      {
        label: "Fin runs the whole body",
        description: "A narrow fin skirts the entire length of the broad, flattened body on both sides (a squid's fins sit only at the tail).",
        overlayX: 0.28,
        overlayY: 0.8,
        overlayRadius: 0.16,
      },
      {
        label: "Broad mottled body",
        description: "Broad, flattened oval body, mottled brown and able to flash zebra patterns. Our largest cuttlefish; the white cuttlebone often washes up.",
        overlayX: 0.28,
        overlayY: 0.42,
        overlayRadius: 0.16,
      },
    ],
  },
  {
    scientificName: "Loligo forbesii",
    commonName: "Veined Squid",
    _photo: "iNat (c) Cathy Hollingdale CC-BY-NC, obs 289003834 - torpedo squid in midwater.",
    marks: [
      {
        label: "Torpedo body",
        description: "A slender, streamlined torpedo body - the classic squid shape, schooling in midwater. The main squid of UK fisheries.",
        overlayX: 0.5,
        overlayY: 0.38,
        overlayRadius: 0.18,
      },
      {
        label: "Long rear fins",
        description: "Two triangular fins at the tail run about 70% of the body length (longer than the European squid's, which reach only about half).",
        overlayX: 0.62,
        overlayY: 0.4,
        overlayRadius: 0.1,
      },
    ],
  },
  {
    scientificName: "Loligo vulgaris",
    commonName: "European Squid",
    _photo: "iNat (c) Ana Santos CC-BY-NC, obs 121757465 - clean profile squid.",
    marks: [
      {
        label: "Triangular tail fins",
        description: "Two triangular fins at the tail, together reaching a bit over half the body length (shorter than the veined squid's ~70%).",
        overlayX: 0.22,
        overlayY: 0.42,
        overlayRadius: 0.14,
      },
      {
        label: "Big eye + ten arms",
        description: "A large eye and ten arms (two of them long, retractable catching tentacles). Reddish, fast, schooling over the open shelf.",
        overlayX: 0.76,
        overlayY: 0.44,
        overlayRadius: 0.12,
      },
    ],
  },
  {
    scientificName: "Sepiola atlantica",
    commonName: "Atlantic Bobtail",
    _photo: "iNat (c) unorthodox_sketch CC-BY-NC, obs 282915767 - close-up, ear fins + specks.",
    marks: [
      {
        label: "Small ear-like fins",
        description: "Two small, rounded ear-like fins near the head (not running down the body) mark out the little bobtail.",
        overlayX: 0.28,
        overlayY: 0.28,
        overlayRadius: 0.12,
      },
      {
        label: "Stubby body, iridescent specks",
        description: "A tiny (about 2 cm), stubby rounded body flecked with iridescent specks. Buries in clean sand by day with only the eyes showing.",
        overlayX: 0.55,
        overlayY: 0.45,
        overlayRadius: 0.2,
      },
    ],
  },
  {
    scientificName: "Eledone cirrhosa",
    commonName: "Curled Octopus",
    _photo: "iNat (c) hippocampuskuda CC-BY-NC, obs 187791384 - orange octopus on mussel bed.",
    marks: [
      {
        label: "Eight arms, no fins",
        description: "Soft, bulbous body and eight long arms, no fins. Orange-brown; our commonest octopus, on rocky and shelly bottoms.",
        overlayX: 0.3,
        overlayY: 0.72,
        overlayRadius: 0.18,
      },
      {
        label: "Single row of suckers",
        description: "A SINGLE row of suckers runs down each arm - the key difference from the common octopus, which has two rows.",
        overlayX: 0.24,
        overlayY: 0.68,
        overlayRadius: 0.1,
      },
    ],
  },
  {
    scientificName: "Octopus vulgaris",
    commonName: "Common Octopus",
    _photo: "iNat (c) Juliana Lemos CC-BY-NC, obs 110195205 - octopus in its den, suckers visible.",
    marks: [
      {
        label: "Bulbous, warty body",
        description: "A large bulbous head and eight arms with warty, mottled skin that changes colour in a blink. Dens in rock holes; mostly southern and western in the UK.",
        overlayX: 0.5,
        overlayY: 0.38,
        overlayRadius: 0.18,
      },
      {
        label: "Two rows of suckers",
        description: "TWO rows of suckers run down each arm (vs the single row of the curled octopus) - the clincher between the two.",
        overlayX: 0.62,
        overlayY: 0.72,
        overlayRadius: 0.12,
      },
    ],
  },

  // ---- STARFISH tile (echinoderms) ----
  {
    scientificName: "Asterina gibbosa",
    commonName: "Cushion Star",
    _photo: "iNat (c) MARIA SYNATIKA CC-BY-NC, obs 237325709 - cushion star on rock.",
    marks: [
      {
        label: "Five short stubby arms",
        description: "Five short, fat arms rather than long points - giving a plump, cushiony feel.",
        overlayX: 0.32,
        overlayY: 0.42,
        overlayRadius: 0.13,
      },
      {
        label: "Pentagon outline",
        description: "The whole animal is a small (to 5 cm) greenish, knobbly pentagon, not a pointed star. Found under stones on the lower shore.",
        overlayX: 0.47,
        overlayY: 0.5,
        overlayRadius: 0.2,
      },
    ],
  },
  {
    scientificName: "Marthasterias glacialis",
    commonName: "Spiny Starfish",
    _photo: "iNat (c) faluke CC-BY-NC, obs 138316126 - orange spiny starfish.",
    marks: [
      {
        label: "Long arms, rows of spines",
        description: "Five long, tapering arms carrying three rows of conspicuous spines (each spine ringed blue at its base). Can reach 70 cm across.",
        overlayX: 0.3,
        overlayY: 0.55,
        overlayRadius: 0.16,
      },
      {
        label: "Conspicuous spines",
        description: "The prominent, evenly-spaced white spines separate it from the smoother common starfish.",
        overlayX: 0.48,
        overlayY: 0.45,
        overlayRadius: 0.14,
      },
    ],
  },
  {
    scientificName: "Asterias rubens",
    commonName: "Common Starfish",
    _photo: "iNat (c) Darren Obbard CC-BY, obs 151512394 - classic orange five-armed star.",
    marks: [
      {
        label: "Five tapering arms",
        description: "The classic orange star: five stout arms tapering to points. Turns up almost anywhere, often near mussel beds.",
        overlayX: 0.45,
        overlayY: 0.48,
        overlayRadius: 0.22,
      },
      {
        label: "Pale spine line down each arm",
        description: "A single pale line of low, knobbly spines runs down the middle of each arm - no big spike rows like the spiny starfish.",
        overlayX: 0.3,
        overlayY: 0.4,
        overlayRadius: 0.12,
      },
    ],
  },
  {
    scientificName: "Ophiothrix fragilis",
    commonName: "Common Brittlestar",
    _photo: "iNat (c) Chris Isaacs CC-BY-NC, obs 222410557 - brittlestars in a dense bed.",
    marks: [
      {
        label: "Long thin spiny arms",
        description: "Five long, thread-thin arms fringed with fine spines - far more delicate than a true starfish's arms, and they snap off at a touch.",
        overlayX: 0.4,
        overlayY: 0.4,
        overlayRadius: 0.16,
      },
      {
        label: "Small disc, dense beds",
        description: "A small round central disc sits at the centre of the arms. Hugely variable in colour; often carpets the seabed in writhing beds like this.",
        overlayX: 0.5,
        overlayY: 0.46,
        overlayRadius: 0.1,
      },
    ],
  },

  // ---- SNAIL / SLUG tile (gastropods) ----
  {
    scientificName: "Patella vulgata",
    commonName: "Common Limpet",
    _photo: "iNat (c) Marie Lou Legrand CC-BY-NC, obs 261125117 - limpet on rock, top-down.",
    marks: [
      {
        label: "Radiating ridges",
        description: "A low cone of grey shell with ridges radiating from the peak. Steeper-coned high on the shore, flatter lower down.",
        overlayX: 0.42,
        overlayY: 0.45,
        overlayRadius: 0.18,
      },
      {
        label: "Clamped to bare rock",
        description: "No spire and no pattern - just a plain cone clamped tight to the rock, grazing algae and homing to the same scar.",
        overlayX: 0.42,
        overlayY: 0.46,
        overlayRadius: 0.1,
      },
    ],
  },
  {
    scientificName: "Nucella lapillus",
    commonName: "Dog Whelk",
    _photo: "iNat (c) julievanroestel CC-BY-NC, obs 41289736 - cluster of dog whelks, colour variation.",
    marks: [
      {
        label: "Short pointed spire",
        description: "A thick, short-spired shell with spiral ridges and an oval mouth drawn out into a little spout. Drills holes in barnacles and mussels.",
        overlayX: 0.5,
        overlayY: 0.26,
        overlayRadius: 0.14,
      },
      {
        label: "Colour varies with diet",
        description: "White, grey, banded brown or even orange - the colour follows what it has been eating, so a cluster looks like a mixed bag.",
        overlayX: 0.52,
        overlayY: 0.55,
        overlayRadius: 0.12,
      },
    ],
  },
  {
    scientificName: "Calliostoma zizyphinum",
    commonName: "Painted Top Shell",
    _photo: "iNat (c) Christine Morrow CC-BY-NC, obs 96235358 - conical top shell.",
    marks: [
      {
        label: "Sharp cone, straight sides",
        description: "A glossy, sharply conical shell with straight sides and a flat base, like a smooth spinning top. Pinkish flecks over 10-12 whorls.",
        overlayX: 0.45,
        overlayY: 0.45,
        overlayRadius: 0.2,
      },
      {
        label: "Pointed apex, no navel",
        description: "Comes to a fine point at the top, and (unlike the flat top shell) has no open navel hole on the underside.",
        overlayX: 0.42,
        overlayY: 0.28,
        overlayRadius: 0.1,
      },
    ],
  },
  {
    scientificName: "Steromphala umbilicalis",
    commonName: "Flat Top Shell",
    _photo: "iNat (c) Sophie Crocker CC-BY-NC, obs 300191612 - underside showing the navel hole.",
    marks: [
      {
        label: "Squat rounded whorl",
        description: "A squat, bluntly conical shell with purple zigzag streaks - flatter and rounder than the pointed painted top shell.",
        overlayX: 0.45,
        overlayY: 0.48,
        overlayRadius: 0.2,
      },
      {
        label: "Open navel hole underneath",
        description: "The giveaway: a distinct open navel (umbilicus) hole at the centre of the underside. The painted top shell has none.",
        overlayX: 0.32,
        overlayY: 0.52,
        overlayRadius: 0.08,
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
