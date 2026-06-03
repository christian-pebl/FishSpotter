/**
 * Re-author DiagnosticMark rows for four fish whose curated reference photo was
 * upgraded on 3 Jun 2026 (Rock goby, sea bass, butterfish, horse mackerel). The
 * old photos carried draft marks that went dormant when those photos were
 * demoted (marks render only on the curated photo). Coords here are first-draft,
 * read off the NEW curated photo per species; tune in /admin/species/[name].
 *
 * Attaches to the lowest-ordering CURATED SpeciesImage and is idempotent: skips
 * a species if its curated photo already has >=1 mark. (The dormant marks live on
 * the now-non-curated old rows and are left untouched.)
 *
 * Run: npx tsx --env-file=.env.local scripts/reauthor-upgraded-fish-marks.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SEED_AUTHOR = "seed-script@pebl-cic.co.uk";

type MarkDraft = { label: string; description: string; overlayX: number; overlayY: number; overlayRadius: number };
type SpeciesDraft = { scientificName: string; commonName: string; _photo: string; marks: MarkDraft[] };

const DRAFTS: SpeciesDraft[] = [
  {
    scientificName: "Gobius paganellus",
    commonName: "Rock goby",
    _photo: "Wikimedia PD (Etrusko25) - single fish on seabed, head lower-right, tail left.",
    marks: [
      { label: "Pale-edged first dorsal", description: "A pale or orange band along the top edge of the front dorsal fin - the rock goby's clearest mark.", overlayX: 0.40, overlayY: 0.31, overlayRadius: 0.08 },
      { label: "Two dorsal fins", description: "Two separate dorsal fins along the back (a goby trait); body stocky and mottled dark.", overlayX: 0.50, overlayY: 0.35, overlayRadius: 0.14 },
      { label: "Blunt head, belly sucker", description: "Stocky blunt head; the pelvic fins are fused into a round sucker on the belly (shared by all gobies).", overlayX: 0.79, overlayY: 0.71, overlayRadius: 0.10 },
    ],
  },
  {
    scientificName: "Dicentrarchus labrax",
    commonName: "European sea bass",
    _photo: "iNat (c) Alison Mayor CC-BY-NC, obs 314191521 - live fish, head right, tail left.",
    marks: [
      { label: "Two dorsal fins (front spiny)", description: "Two separate dorsal fins; the front one is spiny. Clean silver body with no spots.", overlayX: 0.48, overlayY: 0.27, overlayRadius: 0.12 },
      { label: "Spiny gill cover", description: "A sharp spine on the rear edge of the gill cover (operculum) - mind it when handling.", overlayX: 0.68, overlayY: 0.54, overlayRadius: 0.06 },
      { label: "Pointed head, large mouth", description: "Pointed head with a large terminal mouth (vs the blunt, thick-lipped grey mullet).", overlayX: 0.82, overlayY: 0.55, overlayRadius: 0.08 },
    ],
  },
  {
    scientificName: "Pholis gunnellus",
    commonName: "Butterfish",
    _photo: "iNat (c) Calum McLennan CC-BY-NC, obs 152712921 - head right, ribbon body curving down-left.",
    marks: [
      { label: "Dorsal eye-spot row", description: "A row of dark, white-ringed eye-spots along the base of the long dorsal fin - unmistakable.", overlayX: 0.28, overlayY: 0.27, overlayRadius: 0.12 },
      { label: "Long ribbon body", description: "A long, strongly side-flattened ribbon body with one continuous low dorsal fin running its length.", overlayX: 0.32, overlayY: 0.50, overlayRadius: 0.15 },
      { label: "Small blunt head", description: "Small blunt head; the fish is slippery and eel-like, hence the name butterfish (or gunnel).", overlayX: 0.74, overlayY: 0.40, overlayRadius: 0.07 },
    ],
  },
  {
    scientificName: "Trachurus trachurus",
    commonName: "Atlantic horse mackerel",
    _photo: "iNat (c) whodden CC-BY-NC, obs 60196271 - single fish, head right, tail left, dark background.",
    marks: [
      { label: "Lateral-line scutes", description: "A row of bony plates (scutes) along the lateral line - the key give-away of horse mackerel (a scad, family Carangidae).", overlayX: 0.50, overlayY: 0.55, overlayRadius: 0.16 },
      { label: "Large eye", description: "A noticeably large eye for the head - one of the first things you notice.", overlayX: 0.82, overlayY: 0.54, overlayRadius: 0.06 },
      { label: "Forked tail, slim body", description: "A slim, faintly striped silver body ending in a deeply forked tail.", overlayX: 0.16, overlayY: 0.50, overlayRadius: 0.10 },
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
