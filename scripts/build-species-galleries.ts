/**
 * Build a 6-8 photo reference GALLERY per species, vetted by Gemini vision.
 *
 * The runtime gallery (SpeciesGallery -> /api/species-images/[name]) shows
 * every SpeciesImage row for a species, curated first. Until now that pool was
 * whatever the iNat cron grabbed by vote count, unfiltered — so most species
 * had 1-5 rows and some were dead/mixed-school/off-subject shots. This script
 * fills each gallery to a clean TARGET (default 8) of teaching-grade photos:
 *
 *   1. Keep every CURATED row untouched (the diagnostic-mark reference photo +
 *      any editorial pins stay first, with their marks intact).
 *   2. Build a candidate pool: existing non-curated cached rows + a fresh iNat
 *      vote-ranked pull (+ a Wikimedia top-up when iNat is thin), deduped by
 *      observation and minus anything already blocklisted.
 *   3. Assess EVERY candidate with Gemini (src/lib/biodiversity/gemini-vision).
 *      Claude orchestrates; Gemini does the vision — same tool as images:assess.
 *   4. Keep the best (alive, photographic, in-frame, diagnostic features legible)
 *      up to TARGET total, written as curated=false rows ordered by score.
 *   5. Delete the non-curated, mark-free rows that didn't make the cut (junk
 *      cleanup) and add the dead/wrong/drawing rejects to photo-blocklist.json
 *      so the weekly cron can never re-add them.
 *
 * Photos live in the DB, not git (same as the rest of the image cache); the
 * blocklist additions ARE committed.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/build-species-galleries.ts --all
 *   ... --species "Gadus morhua"
 *   ... --all --limit 10            # first 10 species (alpha by key)
 *   ... --all --slice 0:20          # species [0,20) — sharding for parallel runs
 *   ... --target 8 --pool 24 --min 4
 *   ... --dry-run                   # assess + report, write nothing
 *   ... --no-delete                 # add photos but keep existing rows
 *
 * Requires GEMINI_API_KEY in .env.local. Optional GEMINI_MODEL.
 */
import { PrismaClient } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";
import speciesTraitsData from "../src/data/species-traits.json";
import { assessImageQuality, type ImageQuality } from "../src/lib/biodiversity/gemini-vision";
import { fetchPhotosForSpecies, type InatPhoto } from "../src/lib/biodiversity/inaturalist";
import { fetchPhotosFromWikimedia, type WikimediaPhoto } from "../src/lib/biodiversity/wikimedia";

const prisma = new PrismaClient();

const BLOCKLIST_PATH = path.join(process.cwd(), "src", "data", "photo-blocklist.json");

type Catalogue = Record<string, { commonName?: string; shapeClass?: string }>;
const CATALOGUE = speciesTraitsData as unknown as Catalogue;

// ---- config / args -------------------------------------------------------
function parseArgs() {
  const argv = process.argv.slice(2);
  const o = {
    species: undefined as string | undefined,
    all: false,
    limit: undefined as number | undefined,
    slice: undefined as [number, number] | undefined,
    target: 8,
    pool: 24, // max fresh iNat observations to assess per species
    min: 4, // floor: if too few pass the strict bar, relax to reach this many
    dryRun: false,
    noDelete: false,
    speciesConc: 3,
    assessConc: 5,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--species" && argv[i + 1]) o.species = argv[++i];
    else if (a === "--all") o.all = true;
    else if (a === "--limit" && argv[i + 1]) o.limit = Number(argv[++i]);
    else if (a === "--slice" && argv[i + 1]) {
      const [s, e] = argv[++i].split(":").map(Number);
      o.slice = [s || 0, Number.isFinite(e) ? e : Number.MAX_SAFE_INTEGER];
    } else if (a === "--target" && argv[i + 1]) o.target = Number(argv[++i]);
    else if (a === "--pool" && argv[i + 1]) o.pool = Number(argv[++i]);
    else if (a === "--min" && argv[i + 1]) o.min = Number(argv[++i]);
    else if (a === "--dry-run") o.dryRun = true;
    else if (a === "--no-delete") o.noDelete = true;
    else if (a === "--species-conc" && argv[i + 1]) o.speciesConc = Number(argv[++i]);
    else if (a === "--assess-conc" && argv[i + 1]) o.assessConc = Number(argv[++i]);
  }
  return o;
}

// ---- tiny concurrency pool ----------------------------------------------
async function mapPool<T, R>(items: T[], conc: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(conc, items.length) }, worker));
  return out;
}

// ---- blocklist (merged + written once at the end) ------------------------
type Blocklist = { _README: string; blocked: Record<string, { reason: string; scientificName: string }> };
const pendingBlocks: Array<{ sourceUrl: string; reason: string; scientificName: string }> = [];

async function flushBlocklist(): Promise<number> {
  if (pendingBlocks.length === 0) return 0;
  const raw = await fs.readFile(BLOCKLIST_PATH, "utf8");
  const bl = JSON.parse(raw) as Blocklist;
  let added = 0;
  for (const b of pendingBlocks) {
    if (!bl.blocked[b.sourceUrl]) {
      bl.blocked[b.sourceUrl] = { reason: b.reason, scientificName: b.scientificName };
      added++;
    }
  }
  // Sort keys for a stable, review-friendly diff.
  const sorted: Blocklist = { _README: bl._README, blocked: {} };
  for (const k of Object.keys(bl.blocked).sort()) sorted.blocked[k] = bl.blocked[k];
  await fs.writeFile(BLOCKLIST_PATH, JSON.stringify(sorted, null, 2) + "\n", "utf8");
  return added;
}

// ---- candidate model -----------------------------------------------------
type Cand = {
  url: string;
  thumbUrl: string | null;
  attribution: string;
  sourceUrl: string;
  license: string;
  source: "inaturalist" | "wikimedia";
  width: number | null;
  height: number | null;
  lifeStage: string | null;
  sex: string | null;
  q?: ImageQuality;
  err?: string;
};

const REC_RANK: Record<string, number> = { ideal: 0, usable: 1, poor: 2, reject: 3 };

function inatToCand(p: InatPhoto): Cand {
  return {
    url: p.mediumUrl,
    thumbUrl: p.url,
    attribution: p.attribution,
    sourceUrl: p.sourceUrl,
    license: p.license,
    source: "inaturalist",
    width: p.width,
    height: p.height,
    lifeStage: p.lifeStage,
    sex: p.sex,
  };
}

function wmToCand(p: WikimediaPhoto): Cand {
  return {
    url: p.url,
    thumbUrl: p.thumbUrl,
    attribution: p.attribution,
    sourceUrl: p.sourceUrl,
    license: p.license,
    source: "wikimedia",
    width: p.width,
    height: p.height,
    lifeStage: null,
    sex: null,
  };
}

/** A photo good enough to teach from: alive, real photo, not a mixed school, in frame. */
function passesStrict(q: ImageQuality): boolean {
  if (q.nonPhotographic) return false;
  if (q.subjectType === "wrong-subject" || q.subjectType === "no-organism") return false;
  if (q.condition === "dead-or-beachcast" || q.condition === "preserved-or-museum") return false;
  if (q.recommendation === "reject" || q.recommendation === "poor") return false;
  return true;
}
/** Relaxed bar used only to reach the minimum count: still alive + a real photo. */
function passesRelaxed(q: ImageQuality): boolean {
  if (q.nonPhotographic) return false;
  if (q.subjectType === "wrong-subject" || q.subjectType === "no-organism") return false;
  if (q.condition === "dead-or-beachcast" || q.condition === "preserved-or-museum") return false;
  if (q.recommendation === "reject") return false;
  return true;
}
function isReject(q: ImageQuality): { reject: boolean; reason: string } {
  if (q.nonPhotographic) return { reject: true, reason: "drawing" };
  if (q.subjectType === "wrong-subject") return { reject: true, reason: "wrong-subject" };
  if (q.condition === "dead-or-beachcast") return { reject: true, reason: "dead" };
  if (q.condition === "preserved-or-museum") return { reject: true, reason: "preserved" };
  if (q.recommendation === "reject") return { reject: true, reason: "low-quality" };
  return { reject: false, reason: "" };
}

function rankCands(a: Cand, b: Cand): number {
  const ra = REC_RANK[a.q!.recommendation] - REC_RANK[b.q!.recommendation];
  if (ra !== 0) return ra;
  // Prefer single specimens, then lateral views, then raw score.
  const sa = a.q!.subjectType === "single-specimen" ? 0 : 1;
  const sb = b.q!.subjectType === "single-specimen" ? 0 : 1;
  if (sa !== sb) return sa - sb;
  return b.q!.teachingScore - a.q!.teachingScore;
}

type SpeciesReport = {
  sci: string;
  commonName: string;
  curatedKept: number;
  added: number;
  deleted: number;
  blocklisted: number;
  finalTotal: number;
  note: string;
};

async function buildOne(
  sci: string,
  opts: ReturnType<typeof parseArgs>,
  log: (m: string) => void,
): Promise<SpeciesReport> {
  const commonName = CATALOGUE[sci]?.commonName ?? sci;
  const rep: SpeciesReport = {
    sci,
    commonName,
    curatedKept: 0,
    added: 0,
    deleted: 0,
    blocklisted: 0,
    finalTotal: 0,
    note: "",
  };

  // Existing rows + which sourceUrls are already blocklisted.
  const existing = await prisma.speciesImage.findMany({
    where: { scientificName: sci },
    include: { diagnosticMarks: { select: { id: true } } },
  });
  const curatedRows = existing.filter((r) => r.curated);
  rep.curatedKept = curatedRows.length;
  const keepSourceUrls = new Set(curatedRows.map((r) => r.sourceUrl));
  // Non-curated rows that carry marks must also be preserved (defensive: marks
  // should only live on curated rows, but never orphan a FK).
  for (const r of existing) if (r.diagnosticMarks.length > 0) keepSourceUrls.add(r.sourceUrl);

  const blRaw = JSON.parse(await fs.readFile(BLOCKLIST_PATH, "utf8")) as Blocklist;
  const blocked = new Set(Object.keys(blRaw.blocked));

  // --- assemble candidate pool ---
  const poolMap = new Map<string, Cand>();
  // (a) existing non-curated cached rows (re-assess; good ones get reselected)
  for (const r of existing) {
    if (keepSourceUrls.has(r.sourceUrl)) continue;
    if (blocked.has(r.sourceUrl)) continue;
    if (!poolMap.has(r.sourceUrl)) {
      poolMap.set(r.sourceUrl, {
        url: r.url,
        thumbUrl: r.thumbUrl,
        attribution: r.attribution,
        sourceUrl: r.sourceUrl,
        license: r.license,
        source: (r.source === "wikimedia" ? "wikimedia" : "inaturalist") as Cand["source"],
        width: r.width,
        height: r.height,
        lifeStage: r.lifeStage,
        sex: r.sex,
      });
    }
  }
  // (b) fresh iNat vote-ranked pull
  try {
    const fresh = await fetchPhotosForSpecies({ scientificName: sci, perPage: opts.pool });
    for (const p of fresh) {
      if (keepSourceUrls.has(p.sourceUrl) || blocked.has(p.sourceUrl)) continue;
      if (!poolMap.has(p.sourceUrl)) poolMap.set(p.sourceUrl, inatToCand(p));
    }
  } catch (e) {
    log(`  iNat fetch failed: ${(e as Error).message}`);
  }
  // (c) Wikimedia top-up only if the pool is thin
  if (poolMap.size < opts.target * 2) {
    try {
      const wm = await fetchPhotosFromWikimedia({ scientificName: sci, limit: 8 });
      for (const p of wm) {
        if (keepSourceUrls.has(p.sourceUrl) || blocked.has(p.sourceUrl)) continue;
        if (!poolMap.has(p.sourceUrl)) poolMap.set(p.sourceUrl, wmToCand(p));
      }
    } catch (e) {
      log(`  Wikimedia top-up failed: ${(e as Error).message}`);
    }
  }

  let pool = [...poolMap.values()].slice(0, opts.pool + 8);
  if (pool.length === 0) {
    rep.note = "no candidates";
    rep.finalTotal = curatedRows.length;
    return rep;
  }

  // --- assess every candidate with Gemini ---
  await mapPool(pool, opts.assessConc, async (c) => {
    const r = await assessImageQuality({ scientificName: sci, commonName, imageUrl: c.url });
    if (r.ok) c.q = r.quality;
    else c.err = r.error;
    return null;
  });
  pool = pool.filter((c) => c.q); // drop download/model errors

  // --- choose the keepers ---
  const slots = Math.max(0, opts.target - curatedRows.length);
  let chosen = pool.filter((c) => passesStrict(c.q!)).sort(rankCands).slice(0, slots);
  // Relax to hit the floor if strict came up short.
  const floor = Math.max(0, opts.min - curatedRows.length);
  if (chosen.length < floor) {
    const chosenUrls = new Set(chosen.map((c) => c.sourceUrl));
    const extra = pool
      .filter((c) => !chosenUrls.has(c.sourceUrl) && passesRelaxed(c.q!))
      .sort(rankCands)
      .slice(0, floor - chosen.length);
    chosen = [...chosen, ...extra];
  }

  // --- rejects -> blocklist (only clear, durable junk) ---
  for (const c of pool) {
    const { reject, reason } = isReject(c.q!);
    if (reject && reason !== "low-quality") {
      pendingBlocks.push({ sourceUrl: c.sourceUrl, reason, scientificName: sci });
      rep.blocklisted++;
    }
  }

  if (opts.dryRun) {
    rep.added = chosen.length;
    rep.finalTotal = curatedRows.length + chosen.length;
    rep.note = `[dry-run] would keep ${curatedRows.length} curated + add ${chosen.length}`;
    log(
      `  dry-run picks:\n` +
        chosen
          .map(
            (c) =>
              `    ${String(c.q!.teachingScore).padStart(3)} ${c.q!.recommendation.padEnd(6)} ${c.q!.view.padEnd(8)} ${c.source} ${c.sourceUrl}`,
          )
          .join("\n"),
    );
    return rep;
  }

  // --- write: upsert chosen, then delete the non-curated/mark-free leftovers ---
  const chosenUrls = new Set(chosen.map((c) => c.sourceUrl));
  let ordering = 10;
  for (const c of chosen) {
    await prisma.speciesImage.upsert({
      where: { scientificName_sourceUrl: { scientificName: sci, sourceUrl: c.sourceUrl } },
      create: {
        scientificName: sci,
        url: c.url,
        thumbUrl: c.thumbUrl,
        attribution: c.attribution,
        sourceUrl: c.sourceUrl,
        license: c.license,
        lifeStage: c.lifeStage,
        sex: c.sex,
        width: c.width,
        height: c.height,
        ordering: ordering++,
        source: c.source,
        curated: false,
      },
      update: {
        url: c.url,
        thumbUrl: c.thumbUrl,
        attribution: c.attribution,
        license: c.license,
        width: c.width,
        height: c.height,
        ordering: ordering++,
        source: c.source,
        refreshedAt: new Date(),
      },
    });
    rep.added++;
  }

  if (!opts.noDelete) {
    const toDelete = existing.filter(
      (r) => !r.curated && r.diagnosticMarks.length === 0 && !chosenUrls.has(r.sourceUrl),
    );
    if (toDelete.length > 0) {
      await prisma.speciesImage.deleteMany({ where: { id: { in: toDelete.map((r) => r.id) } } });
      rep.deleted = toDelete.length;
    }
  }

  rep.finalTotal = await prisma.speciesImage.count({ where: { scientificName: sci } });
  return rep;
}

async function main() {
  const opts = parseArgs();
  let speciesList: string[];
  if (opts.species) speciesList = [opts.species];
  else if (opts.all) {
    speciesList = Object.keys(CATALOGUE)
      .filter((k) => !k.startsWith("_"))
      .sort();
    if (opts.slice) speciesList = speciesList.slice(opts.slice[0], opts.slice[1]);
    if (opts.limit) speciesList = speciesList.slice(0, opts.limit);
  } else {
    console.error("Usage: --species <s> | --all [--slice a:b] [--limit N] [--target 8] [--dry-run]");
    process.exit(1);
  }

  console.log(
    `Building galleries for ${speciesList.length} species (target ${opts.target}, pool ${opts.pool}, ` +
      `${opts.dryRun ? "DRY-RUN" : "writing"})\n`,
  );

  const reports = await mapPool(speciesList, opts.speciesConc, async (sci) => {
    const lines: string[] = [];
    const log = (m: string) => lines.push(m);
    let rep: SpeciesReport;
    try {
      rep = await buildOne(sci, opts, log);
    } catch (e) {
      rep = {
        sci,
        commonName: CATALOGUE[sci]?.commonName ?? sci,
        curatedKept: 0,
        added: 0,
        deleted: 0,
        blocklisted: 0,
        finalTotal: -1,
        note: `ERROR: ${(e as Error).message}`,
      };
    }
    console.log(
      `[${rep.commonName}] kept ${rep.curatedKept} curated, +${rep.added} new, -${rep.deleted} del, ` +
        `${rep.blocklisted} blocked -> ${rep.finalTotal} total${rep.note ? "  " + rep.note : ""}`,
    );
    if (lines.length) console.log(lines.join("\n"));
    return rep;
  });

  const added = await flushBlocklist();

  // Summary.
  const totalFinal = reports.reduce((s, r) => s + Math.max(0, r.finalTotal), 0);
  const under = reports.filter((r) => r.finalTotal >= 0 && r.finalTotal < opts.min);
  const errored = reports.filter((r) => r.finalTotal < 0);
  console.log(`\n=== SUMMARY ===`);
  console.log(`Species processed: ${reports.length}`);
  console.log(`Photos added: ${reports.reduce((s, r) => s + r.added, 0)}`);
  console.log(`Rows deleted: ${reports.reduce((s, r) => s + r.deleted, 0)}`);
  console.log(`Blocklist entries added: ${added}`);
  console.log(`Total gallery rows now: ${totalFinal}`);
  if (under.length) console.log(`Still under ${opts.min}: ${under.map((r) => `${r.commonName}(${r.finalTotal})`).join(", ")}`);
  if (errored.length) console.log(`ERRORED: ${errored.map((r) => `${r.commonName}: ${r.note}`).join("; ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
