/**
 * Build numbered contact sheets of candidate photos for a species, so a human
 * (or Claude) can vet twenty at a glance instead of one at a time.
 *
 * Same candidate pool as build-species-galleries.ts: existing non-curated rows
 * + a paged iNat pull + a Wikimedia Commons pull, minus the blocklist and
 * anything curated. Writes:
 *   <out>/<slug>-sheet-N.jpg   numbered grids
 *   <out>/<slug>.json          tile number -> candidate metadata
 */
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { fetchPhotosForSpecies } from "../src/lib/biodiversity/inaturalist";
import { fetchPhotosFromWikimedia } from "../src/lib/biodiversity/wikimedia";
import { fetchNameFor } from "../src/lib/biodiversity/fetch-name";
import speciesTraitsData from "../src/data/species-traits.json";

const prisma = new PrismaClient();
const CATALOGUE = speciesTraitsData as unknown as Record<string, { commonName?: string }>;
const BLOCKLIST_PATH = path.join(process.cwd(), "src", "data", "photo-blocklist.json");

const COLS = 5;
const ROWS = 4;
const TILE = 300;
const PER_SHEET = COLS * ROWS;

type Cand = {
  n: number;
  url: string;
  assessUrl: string;
  thumbUrl: string | null;
  sourceUrl: string;
  attribution: string;
  license: string;
  source: "inaturalist" | "wikimedia";
  width: number | null;
  height: number | null;
  lifeStage: string | null;
  sex: string | null;
  observedOn: string | null;
  placeGuess: string | null;
  existing: boolean;
};

function arg(f: string) {
  const i = process.argv.indexOf(f);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function poolCandidates(sci: string, poolSize: number): Promise<Cand[]> {
  const existing = await prisma.speciesImage.findMany({
    where: { scientificName: sci },
    include: { diagnosticMarks: { select: { id: true } } },
  });
  const keep = new Set(existing.filter((r) => r.curated || r.diagnosticMarks.length > 0).map((r) => r.sourceUrl));
  const bl = JSON.parse(await fs.readFile(BLOCKLIST_PATH, "utf8")) as { blocked: Record<string, unknown> };
  const blocked = new Set(Object.keys(bl.blocked));

  const map = new Map<string, Omit<Cand, "n">>();
  for (const r of existing) {
    if (keep.has(r.sourceUrl) || blocked.has(r.sourceUrl)) continue;
    map.set(r.sourceUrl, {
      url: r.url, assessUrl: r.url, thumbUrl: r.thumbUrl, sourceUrl: r.sourceUrl,
      attribution: r.attribution, license: r.license,
      source: (r.source === "wikimedia" ? "wikimedia" : "inaturalist"),
      width: r.width, height: r.height, lifeStage: r.lifeStage, sex: r.sex,
      observedOn: r.observedOn, placeGuess: r.placeGuess, existing: true,
    });
  }
  try {
    for (const p of await fetchPhotosForSpecies({ scientificName: fetchNameFor(sci), perPage: poolSize })) {
      if (keep.has(p.sourceUrl) || blocked.has(p.sourceUrl) || map.has(p.sourceUrl)) continue;
      map.set(p.sourceUrl, {
        url: p.mediumUrl, assessUrl: p.mediumUrl, thumbUrl: p.url, sourceUrl: p.sourceUrl,
        attribution: p.attribution, license: p.license, source: "inaturalist",
        width: p.width, height: p.height, lifeStage: p.lifeStage, sex: p.sex,
        observedOn: p.observedOn, placeGuess: p.placeGuess, existing: false,
      });
    }
  } catch (e) { console.error("  iNat:", (e as Error).message); }
  try {
    for (const p of await fetchPhotosFromWikimedia({ scientificName: fetchNameFor(sci), limit: 20 })) {
      if (keep.has(p.sourceUrl) || blocked.has(p.sourceUrl) || map.has(p.sourceUrl)) continue;
      map.set(p.sourceUrl, {
        url: p.url, assessUrl: p.thumbUrl ?? p.url, thumbUrl: p.thumbUrl, sourceUrl: p.sourceUrl,
        attribution: p.attribution, license: p.license, source: "wikimedia",
        width: p.width, height: p.height, lifeStage: null, sex: null,
        observedOn: null, placeGuess: null, existing: false,
      });
    }
  } catch (e) { console.error("  Wikimedia:", (e as Error).message); }

  return [...map.values()].map((c, i) => ({ ...c, n: i + 1 }));
}

async function tileFor(c: Cand): Promise<Buffer | null> {
  try {
    const res = await fetch(c.assessUrl, { headers: { "User-Agent": "FishSpotter/1.0 (hello@pebl-cic.co.uk)" } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const img = await sharp(buf).resize(TILE, TILE, { fit: "cover", position: "centre" }).jpeg({ quality: 82 }).toBuffer();
    // Number badge, top-left, so a pick can be named unambiguously.
    const badge = Buffer.from(
      `<svg width="${TILE}" height="${TILE}">
         <rect x="0" y="0" width="62" height="34" fill="#17252A" fill-opacity="0.88"/>
         <text x="8" y="25" font-family="Arial,Helvetica,sans-serif" font-size="24" font-weight="bold" fill="#FFFFFF">${c.n}</text>
       </svg>`,
    );
    return await sharp(img).composite([{ input: badge, top: 0, left: 0 }]).jpeg({ quality: 82 }).toBuffer();
  } catch {
    return null;
  }
}

async function main() {
  const sci = arg("--species");
  if (!sci) { console.error('need --species "Genus species"'); process.exit(1); }
  const out = arg("--out") ?? "implementation/photo-review/sheets";
  const poolSize = Number(arg("--pool") ?? 90);
  await fs.mkdir(out, { recursive: true });

  const commonName = CATALOGUE[sci]?.commonName ?? sci;
  const cands = await poolCandidates(sci, poolSize);
  console.log(`${sci} (${commonName}): ${cands.length} candidates`);

  const tiles = await Promise.all(cands.map((c) => tileFor(c)));
  const usable = cands.filter((_, i) => tiles[i]);
  const usableTiles = tiles.filter(Boolean) as Buffer[];
  console.log(`  downloadable: ${usable.length}`);

  const slug = sci.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const sheets: string[] = [];
  for (let s = 0; s * PER_SHEET < usable.length; s++) {
    const chunk = usableTiles.slice(s * PER_SHEET, (s + 1) * PER_SHEET);
    const rows = Math.ceil(chunk.length / COLS);
    const canvas = sharp({
      create: { width: COLS * TILE, height: rows * TILE, channels: 3, background: { r: 20, g: 30, b: 35 } },
    });
    const composites = chunk.map((buf, i) => ({
      input: buf,
      left: (i % COLS) * TILE,
      top: Math.floor(i / COLS) * TILE,
    }));
    const file = path.join(out, `${slug}-sheet-${s + 1}.jpg`);
    await canvas.composite(composites).jpeg({ quality: 84 }).toFile(file);
    sheets.push(file);
    console.log(`  ${file}  (tiles ${s * PER_SHEET + 1}-${s * PER_SHEET + chunk.length})`);
  }

  await fs.writeFile(
    path.join(out, `${slug}.json`),
    JSON.stringify({ scientificName: sci, commonName, sheets, candidates: usable }, null, 1),
  );
  await prisma.$disconnect();
}
main();
