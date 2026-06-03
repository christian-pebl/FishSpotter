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
 *   # ALSO pull fresh iNaturalist candidates and see if any beats the cache
 *   npm run images:assess -- --species "Gadus morhua" --fetch 20
 *
 *   # sweep the whole catalogue (bounded; --limit caps species)
 *   npm run images:assess -- --all --limit 10
 *
 *   # machine-readable
 *   npm run images:assess -- --species "Gadus morhua" --json
 */
import { PrismaClient } from "@prisma/client";
import { assessImageQuality, type ImageQuality } from "../src/lib/biodiversity/gemini-vision";
import { fetchPhotosForSpecies } from "../src/lib/biodiversity/inaturalist";
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
  let fetchFresh = false;
  let fetchN = 12;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--species" && argv[i + 1]) species = argv[++i];
    else if (a === "--url" && argv[i + 1]) url = argv[++i];
    else if (a === "--all") all = true;
    else if (a === "--json") json = true;
    else if (a === "--limit" && argv[i + 1]) limit = Number(argv[++i]);
    else if (a === "--fetch") {
      fetchFresh = true;
      // optional numeric arg: --fetch 20
      if (argv[i + 1] && /^\d+$/.test(argv[i + 1])) fetchN = Number(argv[++i]);
    }
  }
  return { species, url, all, json, limit, fetchFresh, fetchN };
}

const REC_RANK: Record<string, number> = { ideal: 0, usable: 1, poor: 2, reject: 3 };

// Running token usage across the whole run, for cost tracking. Printed to
// stderr at the end so --json stdout stays pure JSON.
const usage = { count: 0, input: 0, output: 0, thinking: 0, total: 0 };

type AssessReturn = Awaited<ReturnType<typeof assessImageQuality>>;
/** Accumulate token usage from a successful assessment, then pass it through. */
function track(r: AssessReturn): AssessReturn {
  if (r.ok) {
    usage.count++;
    usage.input += r.usage.input;
    usage.output += r.usage.output;
    usage.thinking += r.usage.thinking;
    usage.total += r.usage.total;
  }
  return r;
}

function printUsage() {
  console.error(
    `\n[usage] ${usage.count} assessments | input ${usage.input.toLocaleString()} ` +
      `+ output ${usage.output.toLocaleString()} (thinking ${usage.thinking.toLocaleString()}) ` +
      `= ${usage.total.toLocaleString()} tokens`,
  );
}

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

/** One assessed photo, whether from the DB cache or a fresh iNat pull. */
type Cand = {
  url: string;
  attribution: string;
  sourceUrl: string;
  license: string;
  source: string;
  curated: boolean;
  cached: boolean; // already a SpeciesImage row vs freshly fetched
  q: ImageQuality | null;
  error?: string;
};

function printCand(c: Cand) {
  const origin = c.cached ? `[${c.curated ? "CURATED" : "cached"}]` : "[FRESH]";
  if (c.q) {
    console.log(`\n${origin} ${c.source} ${c.license}  ${c.url}`);
    console.log(fmtRow(c.q));
  } else {
    console.log(`\n${origin} ${c.url}\n  ERROR: ${c.error}`);
  }
}

/** Paste-ready overrides block for species-images.json (upserted curated). */
function overrideBlock(sci: string, c: Cand): string {
  const entry = {
    url: c.url,
    attribution: c.attribution,
    sourceUrl: c.sourceUrl,
    license: c.license,
  };
  return (
    `      Add to src/data/species-images.json "overrides":\n` +
    `        ${JSON.stringify({ [sci]: [entry] })}`
  );
}

async function assessSpecies(
  sci: string,
  json: boolean,
  opts: { fetchFresh?: boolean; fetchN?: number } = {},
): Promise<Cand[]> {
  const rows = await prisma.speciesImage.findMany({
    where: { scientificName: sci },
    orderBy: { ordering: "asc" },
  });

  if (rows.length === 0 && !opts.fetchFresh) {
    if (!json) console.log(`\n${sci}: no cached photos (run db:refresh-images, or add --fetch).`);
    return [];
  }

  if (!json) {
    console.log(
      `\n=== ${commonNameFor(sci) ?? sci} (${sci}) — ${rows.length} cached` +
        `${opts.fetchFresh ? ` + up to ${opts.fetchN} fresh from iNaturalist` : ""} ===`,
    );
  }

  const cands: Cand[] = [];

  // 1. Cached SpeciesImage rows.
  for (const row of rows) {
    const r = track(
      await assessImageQuality({
        scientificName: sci,
        commonName: commonNameFor(sci),
        imageUrl: row.url,
      }),
    );
    const c: Cand = {
      url: row.url,
      attribution: row.attribution,
      sourceUrl: row.sourceUrl,
      license: row.license,
      source: row.source,
      curated: row.curated,
      cached: true,
      q: r.ok ? r.quality : null,
      error: r.ok ? undefined : r.error,
    };
    cands.push(c);
    if (!json) printCand(c);
  }

  // 2. Fresh iNaturalist candidates (--fetch) — the "can we do better?" pass.
  if (opts.fetchFresh) {
    const cachedSources = new Set(rows.map((r) => r.sourceUrl));
    let fresh: Awaited<ReturnType<typeof fetchPhotosForSpecies>> = [];
    try {
      fresh = await fetchPhotosForSpecies({ scientificName: sci, perPage: opts.fetchN ?? 12 });
    } catch (e) {
      if (!json) console.log(`  (iNat fetch failed: ${(e as Error).message})`);
    }
    const seen = new Set<string>();
    for (const p of fresh) {
      if (cachedSources.has(p.sourceUrl) || seen.has(p.sourceUrl)) continue; // skip dupes
      seen.add(p.sourceUrl);
      const r = track(
        await assessImageQuality({
          scientificName: sci,
          commonName: commonNameFor(sci),
          imageUrl: p.mediumUrl,
        }),
      );
      const c: Cand = {
        url: p.mediumUrl,
        attribution: p.attribution,
        sourceUrl: p.sourceUrl,
        license: p.license,
        source: "inaturalist-fresh",
        curated: false,
        cached: false,
        q: r.ok ? r.quality : null,
        error: r.ok ? undefined : r.error,
      };
      cands.push(c);
      if (!json) printCand(c);
    }
  }

  // Best = lowest recommendation rank, then highest teachingScore.
  const ranked = [...cands]
    .filter((x) => x.q)
    .sort((a, b) => {
      const ra = REC_RANK[a.q!.recommendation] - REC_RANK[b.q!.recommendation];
      if (ra !== 0) return ra;
      return b.q!.teachingScore - a.q!.teachingScore;
    });

  if (!json) {
    if (ranked.length === 0) {
      console.log(`\n  (no usable assessment — all photos errored or none found)`);
    } else {
      const best = ranked[0];
      const tag = best.cached
        ? best.curated
          ? "already curated"
          : "cached, not yet curated"
        : "FRESH from iNat (not yet in the DB)";
      console.log(
        `\n  >>> Best for teaching: score ${best.q!.teachingScore} (${best.q!.recommendation}) — ${tag}`,
      );
      if (best.q!.recommendation === "reject") {
        console.log(`      WARNING: even the best is a reject — source a photo manually.`);
      } else if (!(best.cached && best.curated)) {
        console.log(overrideBlock(sci, best));
      }
    }
  }

  return cands;
}

async function main() {
  const args = parseArgs();

  // Single ad-hoc URL: no DB needed.
  if (args.url) {
    if (!args.species) {
      console.error("--url requires --species so Gemini knows the target species.");
      process.exit(1);
    }
    const r = track(
      await assessImageQuality({
        scientificName: args.species,
        commonName: commonNameFor(args.species),
        imageUrl: args.url,
      }),
    );
    if (args.json) console.log(JSON.stringify(r, null, 2));
    else if (r.ok) {
      console.log(`\n${args.species}  ${args.url}  (model ${r.model})`);
      console.log(fmtRow(r.quality));
    } else console.log(`ERROR (${r.model}): ${r.error}`);
    printUsage();
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
      "Usage: --url <u> --species <s> | --species <s> [--fetch [N]] | --all [--limit N] [--fetch [N]]  (add --json for a dump)",
    );
    process.exit(1);
  }

  const fetchOpts = args.fetchFresh
    ? { fetchFresh: true, fetchN: args.fetchN }
    : {};
  const out: unknown[] = [];
  for (const sci of speciesList) {
    const cands = await assessSpecies(sci, args.json, fetchOpts);
    out.push(
      ...cands.map((c) => ({
        scientificName: sci,
        url: c.url,
        attribution: c.attribution,
        sourceUrl: c.sourceUrl,
        source: c.source,
        license: c.license,
        curated: c.curated,
        cached: c.cached,
        quality: c.q,
        error: c.error ?? null,
      })),
    );
  }
  if (args.json) console.log(JSON.stringify(out, null, 2));
  printUsage();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
