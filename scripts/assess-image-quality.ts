/**
 * Fish-image quality assessment CLI. Claude orchestrates; Gemini does the
 * vision (see src/lib/biodiversity/gemini-vision.ts). Reports how suitable a
 * candidate photo is as a FishSpotter teaching reference — the gap iNat's
 * "research grade" flag does not measure.
 *
 * Read-only: it never writes to the DB. Use it to decide which cached photo to
 * pin as a `curated` override in src/data/species-images.json before authoring
 * diagnostic marks.
 *
 * Requires GEMINI_API_KEY in .env.local (gitignored). Optional GEMINI_MODEL.
 *
 * Examples:
 *   # one image by URL (no DB needed)
 *   npx tsx --env-file=.env.local scripts/assess-image-quality.ts -- \
 *     --species "Aurelia aurita" --url "https://.../photo.jpg"
 *
 *   # rank every cached SpeciesImage row for a species, recommend the best
 *   npm run images:assess -- --species "Labrus mixtus"
 *
 *   # sweep the whole catalogue (bounded; --limit caps species)
 *   npm run images:assess -- --all --limit 10
 *
 *   # machine-readable
 *   npm run images:assess -- --species "Gadus morhua" --json
 */
import { PrismaClient } from "@prisma/client";
import { assessImageQuality, type ImageQuality } from "../src/lib/biodiversity/gemini-vision";
import speciesTraitsData from "../src/data/species-traits.json";

const prisma = new PrismaClient();

type Catalogue = Record<string, { commonName?: string } & Record<string, unknown>>;
const CATALOGUE = speciesTraitsData as unknown as Catalogue;

function commonNameFor(sci: string): string | undefined {
  return CATALOGUE[sci]?.commonName;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  let species: string | undefined;
  let url: string | undefined;
  let all = false;
  let json = false;
  let limit: number | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--species" && argv[i + 1]) species = argv[++i];
    else if (a === "--url" && argv[i + 1]) url = argv[++i];
    else if (a === "--all") all = true;
    else if (a === "--json") json = true;
    else if (a === "--limit" && argv[i + 1]) limit = Number(argv[++i]);
  }
  return { species, url, all, json, limit };
}

const REC_RANK: Record<string, number> = { ideal: 0, usable: 1, poor: 2, reject: 3 };

function fmtRow(q: ImageQuality): string {
  const flags: string[] = [];
  if (q.nonPhotographic) flags.push("DRAWING");
  if (q.subjectType === "wrong-subject") flags.push("WRONG-SUBJECT");
  if (q.subjectType === "multiple-specimens") flags.push(`${q.individualCount} INDIVIDUALS`);
  if (q.condition === "dead-or-beachcast") flags.push("DEAD");
  if (q.condition === "preserved-or-museum") flags.push("PRESERVED");
  const tag = flags.length ? `  [${flags.join(", ")}]` : "";
  return (
    `  score ${String(q.teachingScore).padStart(3)}  ${q.recommendation.toUpperCase().padEnd(6)}` +
    `  view=${q.view} foc=${q.focus} lgt=${q.lighting} frm=${q.framing} ` +
    `occ=${q.occlusionFree} feat=${q.diagnosticFeaturesVisible}${tag}\n    ${q.notes}`
  );
}

async function assessSpecies(sci: string, json: boolean) {
  const rows = await prisma.speciesImage.findMany({
    where: { scientificName: sci },
    orderBy: { ordering: "asc" },
  });
  if (rows.length === 0) {
    console.log(`\n${sci}: no cached SpeciesImage rows (run db:refresh-images first).`);
    return [];
  }

  if (!json) console.log(`\n=== ${commonNameFor(sci) ?? sci} (${sci}) — ${rows.length} cached photos ===`);

  const results: Array<{ row: (typeof rows)[number]; q: ImageQuality | null; error?: string }> = [];
  for (const row of rows) {
    const r = await assessImageQuality({
      scientificName: sci,
      commonName: commonNameFor(sci),
      imageUrl: row.url,
    });
    if (r.ok) {
      results.push({ row, q: r.quality });
      if (!json) {
        console.log(
          `\n[${row.curated ? "CURATED" : "auto"}] ${row.source} ${row.license}  ${row.url}`,
        );
        console.log(fmtRow(r.quality));
      }
    } else {
      results.push({ row, q: null, error: r.error });
      if (!json) console.log(`\n${row.url}\n  ERROR: ${r.error}`);
    }
  }

  // Best candidate = highest teachingScore among non-rejects, recommendation
  // as tiebreaker.
  const ranked = [...results]
    .filter((x) => x.q)
    .sort((a, b) => {
      const ra = REC_RANK[a.q!.recommendation] - REC_RANK[b.q!.recommendation];
      if (ra !== 0) return ra;
      return b.q!.teachingScore - a.q!.teachingScore;
    });

  if (!json && ranked.length > 0) {
    const best = ranked[0];
    const curatedAlready = best.row.curated;
    console.log(
      `\n  >>> Best for teaching: score ${best.q!.teachingScore} (${best.q!.recommendation})` +
        `${curatedAlready ? " — already curated" : " — pin this as a curated override"}`,
    );
    if (!curatedAlready && best.q!.recommendation !== "reject") {
      console.log(
        `      src/data/species-images.json overrides["${sci}"]:\n` +
          `        { "url": "${best.row.url}", "curated": true }`,
      );
    }
    if (best.q!.recommendation === "reject") {
      console.log(`      WARNING: even the best photo is a reject — curate a new photo manually.`);
    }
  }

  return results.map((x) => ({
    scientificName: sci,
    url: x.row.url,
    source: x.row.source,
    license: x.row.license,
    curated: x.row.curated,
    quality: x.q,
    error: x.error ?? null,
  }));
}

async function main() {
  const args = parseArgs();

  // Single ad-hoc URL: no DB needed.
  if (args.url) {
    if (!args.species) {
      console.error("--url requires --species so Gemini knows the target species.");
      process.exit(1);
    }
    const r = await assessImageQuality({
      scientificName: args.species,
      commonName: commonNameFor(args.species),
      imageUrl: args.url,
    });
    if (args.json) console.log(JSON.stringify(r, null, 2));
    else if (r.ok) {
      console.log(`\n${args.species}  ${args.url}  (model ${r.model})`);
      console.log(fmtRow(r.quality));
    } else console.log(`ERROR (${r.model}): ${r.error}`);
    return;
  }

  let speciesList: string[];
  if (args.all) {
    const grouped = await prisma.speciesImage.groupBy({ by: ["scientificName"] });
    speciesList = grouped.map((g) => g.scientificName).sort();
    if (args.limit) speciesList = speciesList.slice(0, args.limit);
  } else if (args.species) {
    speciesList = [args.species];
  } else {
    console.error(
      "Usage: --url <u> --species <s> | --species <s> | --all [--limit N]  (add --json for a dump)",
    );
    process.exit(1);
  }

  const out: unknown[] = [];
  for (const sci of speciesList) {
    out.push(...(await assessSpecies(sci, args.json)));
  }
  if (args.json) console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
