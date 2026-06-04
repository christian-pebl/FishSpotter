/**
 * One-off audit (read-only): inventory of species reference photos + annotated
 * "guide hero" photos (DiagnosticMark rings), with an optional Gemini-vision
 * pass that validates whether the guide circles are accurately placed on the
 * features they label and are clear.
 *
 * Phase 1 (default): DB inventory only. No external calls.
 *   npx tsx --env-file=.env.local scripts/audit-species-images.ts
 *
 * Phase 2 (--validate): for every species that HAS marks, download the
 *   annotated photo, composite the rings on it exactly as the app renders them
 *   (AnnotatedSpeciesPhoto geometry, via sharp), and ask Gemini to grade each
 *   ring's placement + clarity. Free-tier Gemini is ~20 req/day, so use
 *   --limit / --species to shard across days.
 *   npx tsx --env-file=.env.local scripts/audit-species-images.ts -- --validate
 *   ...-- --validate --species "Pollachius pollachius"
 *   ...-- --validate --limit 10
 *
 * Always writes a JSON dump to ./audit-species-images.json for the report.
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import speciesTraitsData from "../src/data/species-traits.json";
import {
  GEMINI_MODEL,
  validateHero,
  type MarkRow,
  type HeroValidation,
} from "./lib/mark-overlay";

const prisma = new PrismaClient();

type Catalogue = Record<string, { commonName?: string } & Record<string, unknown>>;
const CATALOGUE = speciesTraitsData as unknown as Catalogue;

function parseArgs() {
  const argv = process.argv.slice(2);
  let validate = false;
  let json = false;
  let species: string | undefined;
  let limit: number | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--validate") validate = true;
    else if (a === "--json") json = true;
    else if (a === "--species" && argv[i + 1]) species = argv[++i];
    else if (a === "--limit" && argv[i + 1]) limit = Number(argv[++i]);
  }
  return { validate, json, species, limit };
}

// Audit rows carry the mark's display order on top of the shared MarkRow shape.
type AuditMark = MarkRow & { order: number };

type SpeciesAudit = {
  scientificName: string;
  commonName: string;
  shapeClass: string;
  totalPhotos: number;
  curatedPhotos: number;
  sources: Record<string, number>;
  hasAnnotatedHero: boolean;
  markCount: number;
  heroImageUrl: string | null;
  heroImageDims: string | null;
  marks: AuditMark[];
  validation?: HeroValidation;
};

async function main() {
  const args = parseArgs();

  // Pull every catalogue species, plus any SpeciesImage scientificNames not in
  // the catalogue (so nothing is missed).
  const catKeys = Object.keys(CATALOGUE);
  const imgGroups = await prisma.speciesImage.groupBy({ by: ["scientificName"] });
  const allNames = Array.from(new Set([...catKeys, ...imgGroups.map((g) => g.scientificName)])).sort();

  const audits: SpeciesAudit[] = [];

  for (const sci of allNames) {
    const photos = await prisma.speciesImage.findMany({
      where: { scientificName: sci },
      select: { id: true, url: true, width: true, height: true, curated: true, source: true },
    });
    const marks = await prisma.diagnosticMark.findMany({
      where: { scientificName: sci },
      orderBy: { order: "asc" },
      select: {
        order: true,
        label: true,
        description: true,
        overlayX: true,
        overlayY: true,
        overlayRadius: true,
        speciesImageId: true,
      },
    });

    const sources: Record<string, number> = {};
    for (const p of photos) sources[p.source] = (sources[p.source] ?? 0) + 1;

    const heroImageId = marks[0]?.speciesImageId ?? null;
    const heroImage = heroImageId ? photos.find((p) => p.id === heroImageId) ?? null : null;

    audits.push({
      scientificName: sci,
      commonName: CATALOGUE[sci]?.commonName ?? "(not in catalogue)",
      shapeClass: (CATALOGUE[sci]?.shapeClass as string) ?? "?",
      totalPhotos: photos.length,
      curatedPhotos: photos.filter((p) => p.curated).length,
      sources,
      hasAnnotatedHero: marks.length > 0,
      markCount: marks.length,
      heroImageUrl: heroImage?.url ?? null,
      heroImageDims:
        heroImage?.width && heroImage?.height ? `${heroImage.width}x${heroImage.height}` : null,
      marks: marks.map((m) => ({
        order: m.order,
        label: m.label,
        description: m.description,
        overlayX: m.overlayX,
        overlayY: m.overlayY,
        overlayRadius: m.overlayRadius,
      })),
    });
  }

  // Phase 2: Gemini validation of annotated heroes.
  if (args.validate) {
    let targets = audits.filter((a) => a.hasAnnotatedHero && a.heroImageUrl);
    if (args.species) targets = targets.filter((a) => a.scientificName === args.species);
    if (args.limit) targets = targets.slice(0, args.limit);
    console.error(`[validate] ${targets.length} annotated heroes to check via Gemini (${GEMINI_MODEL})`);
    for (const a of targets) {
      console.error(`  - ${a.commonName} (${a.scientificName})...`);
      a.validation = await validateHero(a.commonName, a.scientificName, a.heroImageUrl!, a.marks);
      if (a.validation.error) console.error(`      ERROR: ${a.validation.error}`);
      else
        console.error(
          `      clarity=${a.validation.overallClarity} aligned=${a.validation.overallAligned} -> ${a.validation.recommendation}`,
        );
    }
  }

  writeFileSync("audit-species-images.json", JSON.stringify(audits, null, 2));
  console.error(`\nWrote audit-species-images.json (${audits.length} species)`);

  // Console summary table.
  const withPhotos = audits.filter((a) => a.totalPhotos > 0).length;
  const noPhotos = audits.filter((a) => a.totalPhotos === 0).length;
  const withHero = audits.filter((a) => a.hasAnnotatedHero).length;
  console.error(
    `\nSUMMARY: ${audits.length} species | ${withPhotos} have photos | ${noPhotos} have NO photos | ${withHero} have an annotated hero`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
