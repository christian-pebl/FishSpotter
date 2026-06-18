/**
 * Score every species' CURATED LEAD reference photo (the one shown on the
 * Rung-3 candidate tile, the species flash-card, and first in the gallery) for
 * how well it represents the species, using the Gemini vision tool.
 *
 *   npx tsx --env-file=.env.local scripts/score-photos.ts
 *   npm run score:photos -- --json
 *   npm run score:photos -- --limit 10        # spot-check
 *
 * Writes a JSON baseline to implementation/2026-06-17/photo-scores.json. Re-run
 * after swapping a curated photo and diff the baseline to see the delta.
 *
 * Read-only w.r.t. the DB. Needs GEMINI_API_KEY in .env.local.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { assessImageQuality, type ImageQuality } from "@/lib/biodiversity/gemini-vision";

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "implementation", "2026-06-17");
const JSON_ONLY = process.argv.includes("--json");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  return i >= 0 ? Number(process.argv[i + 1]) : Infinity;
})();

async function main() {
  const sciNames = Object.keys(CATALOGUE);
  // The lead photo per species = curated rows, lowest ordering first (mirrors
  // the /api/species-images?limit=1 path the Rung-3 tile uses).
  const rowsDb = await prisma.speciesImage.findMany({
    where: { scientificName: { in: sciNames }, curated: true },
    select: { scientificName: true, url: true, webpUrl: true, ordering: true, attribution: true, license: true },
    orderBy: { ordering: "asc" },
  });
  const lead = new Map<string, { url: string; attribution: string | null; license: string | null }>();
  for (const r of rowsDb) {
    if (!lead.has(r.scientificName)) {
      lead.set(r.scientificName, { url: r.url, attribution: r.attribution, license: r.license });
    }
  }

  let species = sciNames
    .map((sci) => ({ sci, common: CATALOGUE[sci].commonName, shapeClass: CATALOGUE[sci].shapeClass, lead: lead.get(sci) }))
    .sort((a, b) => a.shapeClass.localeCompare(b.shapeClass) || a.common.localeCompare(b.common));
  if (Number.isFinite(LIMIT)) species = species.slice(0, LIMIT);

  if (!JSON_ONLY) console.log(`Scoring ${species.length} curated lead photos...\n`);

  const rows: Array<{
    sci: string;
    common: string;
    shapeClass: string;
    url?: string;
    quality?: ImageQuality;
    error?: string;
  }> = [];
  let inTok = 0;
  let outTok = 0;

  for (const sp of species) {
    if (!sp.lead) {
      rows.push({ sci: sp.sci, common: sp.common, shapeClass: sp.shapeClass, error: "no curated lead photo" });
      if (!JSON_ONLY) console.log(`--- ${sp.common}: no curated lead photo`);
      continue;
    }
    // Pace calls to stay under the Gemini per-minute rate limit.
    await new Promise((r) => setTimeout(r, 1500));
    const res = await assessImageQuality({ scientificName: sp.sci, commonName: sp.common, imageUrl: sp.lead.url });
    if (res.ok) {
      rows.push({ sci: sp.sci, common: sp.common, shapeClass: sp.shapeClass, url: sp.lead.url, quality: res.quality });
      inTok += res.usage.input;
      outTok += res.usage.output;
      if (!JSON_ONLY) {
        const q = res.quality;
        console.log(
          `${String(q.teachingScore).padStart(3)} ${q.recommendation.padEnd(7)} ${sp.common.padEnd(26)} ` +
            `${q.subjectType}/${q.condition}/${q.view} foc=${q.focus} lgt=${q.lighting} frm=${q.framing} ` +
            `occ=${q.occlusionFree} feat=${q.diagnosticFeaturesVisible}`,
        );
      }
    } else {
      rows.push({ sci: sp.sci, common: sp.common, shapeClass: sp.shapeClass, url: sp.lead.url, error: res.error });
      if (!JSON_ONLY) console.log(`ERR ${sp.common}: ${res.error}`);
    }
  }

  const out = {
    generatedFor: "photos",
    model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash",
    count: rows.length,
    tokens: { input: inTok, output: outTok },
    items: rows,
  };
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const dest = join(OUT_DIR, "photo-scores.json");
  // Don't clobber a good baseline with an all-error run (e.g. a Gemini outage).
  const okCount = rows.filter((r) => r.quality).length;
  if (okCount === 0) {
    console.error("All items errored (likely a Gemini outage); baseline NOT overwritten.");
    process.exit(1);
  }
  writeFileSync(dest, JSON.stringify(out, null, 2) + "\n", "utf8");

  if (JSON_ONLY) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    const scored = rows.filter((r) => r.quality).map((r) => r.quality!.teachingScore);
    const mean = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : 0;
    console.log(`\nMean teachingScore ${mean} over ${scored.length} photos. Tokens ${inTok}+${outTok}.`);
    console.log(`Baseline -> ${dest.replace(ROOT, "")}`);
  }
  await prisma.$disconnect();
}

main();
