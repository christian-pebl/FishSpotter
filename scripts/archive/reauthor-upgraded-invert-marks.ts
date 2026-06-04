/**
 * Re-author DiagnosticMark rows for the 8 invertebrates whose curated reference
 * photo was upgraded in the 3 Jun 2026 Gemini quality pass (their old photos -
 * dead carapaces, head-only macros, a crowd of whelks, beached jellyfish - were
 * demoted, dropping their draft marks to dormant). Coords read off the NEW
 * curated photo per species; tune in /admin/species/[name].
 *
 * Sibling of scripts/reauthor-upgraded-fish-marks.ts. Attaches to the
 * lowest-ordering CURATED SpeciesImage; idempotent (skips if it already has marks).
 *
 * Run: npx tsx --env-file=.env.local scripts/reauthor-upgraded-invert-marks.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SEED_AUTHOR = "seed-script@pebl-cic.co.uk";

type MarkDraft = { label: string; description: string; overlayX: number; overlayY: number; overlayRadius: number };
type SpeciesDraft = { scientificName: string; commonName: string; _photo: string; marks: MarkDraft[] };

const DRAFTS: SpeciesDraft[] = [
  {
    scientificName: "Cancer pagurus", commonName: "Edible Crab",
    _photo: "iNat (c) Emil B CC-BY-NC, obs 53236001 - live crab frontal in a crevice, claws lower corners.",
    marks: [
      { label: "Pie-crust shell edge", description: "The front edge of the broad reddish shell is crimped like the crust of a pie - the classic edible (brown) crab mark.", overlayX: 0.40, overlayY: 0.38, overlayRadius: 0.16 },
      { label: "Black-tipped claws", description: "Both heavy pincers end in black tips.", overlayX: 0.78, overlayY: 0.80, overlayRadius: 0.10 },
    ],
  },
  {
    scientificName: "Necora puber", commonName: "Velvet Swimming Crab",
    _photo: "iNat (c) floris_heemskerk CC-BY-NC, obs 246025525 - live frontal on seabed, red eyes.",
    marks: [
      { label: "Red eyes", description: "Bright red eyes - unmistakable on this otherwise drab crab.", overlayX: 0.50, overlayY: 0.40, overlayRadius: 0.11 },
      { label: "Velvety furred shell", description: "The shell is covered in fine velvety fur; the last pair of legs are flattened into blue-lined swimming paddles.", overlayX: 0.50, overlayY: 0.48, overlayRadius: 0.16 },
    ],
  },
  {
    scientificName: "Liocarcinus depurator", commonName: "Harbour Crab",
    _photo: "iNat (c) Daniel Rodrigues CC-BY-NC, obs 69142489 - top-down on sand, paddles at top corners.",
    marks: [
      { label: "Paddle back legs", description: "The last pair of legs are flattened into swimming paddles - it is a swimming crab.", overlayX: 0.84, overlayY: 0.33, overlayRadius: 0.11 },
      { label: "Broad reddish shell", description: "A broad reddish-orange shell with the eyes set at the front.", overlayX: 0.50, overlayY: 0.48, overlayRadius: 0.14 },
    ],
  },
  {
    scientificName: "Hyas araneus", commonName: "Great Spider Crab",
    _photo: "iNat (c) Ian Manning CC-BY, obs 117902959 - live top-down on rock, long legs.",
    marks: [
      { label: "Triangular pear-shaped shell", description: "The shell narrows to a point at the front, giving a triangular, pear-shaped outline.", overlayX: 0.42, overlayY: 0.48, overlayRadius: 0.15 },
      { label: "Long spindly legs", description: "Long, thin spider-like legs, often draped in weed or debris as camouflage.", overlayX: 0.58, overlayY: 0.32, overlayRadius: 0.13 },
    ],
  },
  {
    scientificName: "Nucella lapillus", commonName: "Dog Whelk",
    _photo: "iNat (c) ananda_intham CC-BY-NC, obs 97540430 - single banded shell on rock.",
    marks: [
      { label: "Pointed spire", description: "A short, pointed conical spire (the squat periwinkle has no point).", overlayX: 0.50, overlayY: 0.45, overlayRadius: 0.12 },
      { label: "Thick-lipped aperture", description: "An oval opening with a thickened lip and spiral ridges; shell colour varies, often boldly banded.", overlayX: 0.56, overlayY: 0.66, overlayRadius: 0.15 },
    ],
  },
  {
    scientificName: "Steromphala umbilicalis", commonName: "Flat Top Shell",
    _photo: "iNat (c) Alex Press CC-BY, obs 222317579 - single small shell on rock.",
    marks: [
      { label: "Squat rounded shell", description: "A low, rounded top-shell whorl, not a tall pointed spire.", overlayX: 0.40, overlayY: 0.57, overlayRadius: 0.10 },
      { label: "Reddish-purple streaks", description: "Diagonal reddish-purple streaks over a grey-green shell; an open navel-hole (umbilicus) sits at the base.", overlayX: 0.40, overlayY: 0.54, overlayRadius: 0.07 },
    ],
  },
  {
    scientificName: "Cyanea capillata", commonName: "Lion's Mane Jellyfish",
    _photo: "iNat CC0, obs 228419200 - bell upper-left, tentacle mane trailing right.",
    marks: [
      { label: "Orange domed bell", description: "A solid orange-tan domed bell.", overlayX: 0.30, overlayY: 0.43, overlayRadius: 0.15 },
      { label: "Mane of fine tentacles", description: "A dense trailing mass of many fine, hair-like tentacles - the 'lion's mane'.", overlayX: 0.65, overlayY: 0.55, overlayRadius: 0.22 },
    ],
  },
  {
    scientificName: "Cyanea lamarckii", commonName: "Blue Jellyfish",
    _photo: "iNat (c) Nathan Jackson CC-BY-NC, obs 348032033 - blue bell centred, tentacles around.",
    marks: [
      { label: "Blue-tinted bell", description: "A domed bell with a distinctive blue-violet tint and radial markings.", overlayX: 0.50, overlayY: 0.45, overlayRadius: 0.20 },
      { label: "Fine trailing tentacles", description: "A fringe of many fine tentacles; smaller and bluer than the orange lion's mane.", overlayX: 0.40, overlayY: 0.72, overlayRadius: 0.15 },
    ],
  },
];

async function main() {
  for (const d of DRAFTS) {
    const photos = await prisma.speciesImage.findMany({
      where: { scientificName: d.scientificName, curated: true },
      orderBy: [{ ordering: "asc" }, { createdAt: "asc" }],
      select: { id: true, url: true, _count: { select: { diagnosticMarks: true } } },
    });
    if (photos.length === 0) { console.log(`SKIP ${d.commonName}: no curated photo`); continue; }
    const target = photos[0];
    if (target._count.diagnosticMarks > 0) { console.log(`SKIP ${d.commonName}: curated photo already has ${target._count.diagnosticMarks} mark(s)`); continue; }
    await prisma.diagnosticMark.createMany({
      data: d.marks.map((m, i) => ({ scientificName: d.scientificName, speciesImageId: target.id, order: i + 1, label: m.label, description: m.description, overlayX: m.overlayX, overlayY: m.overlayY, overlayRadius: m.overlayRadius, createdBy: SEED_AUTHOR })),
    });
    console.log(`OK   ${d.commonName}: +${d.marks.length} marks on ${target.url.split("/").slice(-2).join("/")}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
