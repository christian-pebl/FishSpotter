/**
 * Repair SpeciesImage.thumbUrl values that point at a non-standard Commons
 * thumbnail width (we used 480px). Commons now refuses those with HTTP 400, so
 * any photo without its own hosted WebP copy showed a broken thumbnail.
 *
 * Each row is rewritten to the widest standard width (THUMB_STRIP_WIDTH first,
 * then narrower ones) that Commons actually serves, checked with a GET before
 * anything is written. A row with no working width is left alone and reported.
 *
 * Dry run is the default:
 *   npx tsx --env-file=.env.local scripts/fix-wikimedia-thumb-widths.ts
 *   npx tsx --env-file=.env.local scripts/fix-wikimedia-thumb-widths.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { COMMONS_STANDARD_WIDTHS, THUMB_STRIP_WIDTH } from "../src/lib/biodiversity/wikimedia";

const APPLY = process.argv.includes("--apply");
const UA = "FishSpotter/1.0 (species guide thumbnail repair)";
const WIDTH_RE = /\/(\d+)px-([^/]+)$/;

const prisma = new PrismaClient();

async function serves(url: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    await res.body?.cancel();
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    return res.ok;
  }
  return false;
}

async function main() {
  const standard = new Set<number>(COMMONS_STANDARD_WIDTHS);
  const rows = await prisma.speciesImage.findMany({
    where: { source: "wikimedia", thumbUrl: { contains: "px-" } },
    select: { id: true, scientificName: true, thumbUrl: true, webpThumbUrl: true },
  });
  const bad = rows.filter((r) => {
    const m = r.thumbUrl ? WIDTH_RE.exec(r.thumbUrl) : null;
    return m && !standard.has(Number(m[1]));
  });
  console.log(`${bad.length} of ${rows.length} Commons thumbnails use a non-standard width (${APPLY ? "applying" : "dry run"})`);

  const tryWidths = COMMONS_STANDARD_WIDTHS.filter((w) => w <= THUMB_STRIP_WIDTH).reverse();
  let fixed = 0;
  const stuck: string[] = [];
  for (const r of bad) {
    let next: string | null = null;
    for (const w of tryWidths) {
      const candidate = r.thumbUrl!.replace(WIDTH_RE, `/${w}px-$2`);
      if (await serves(candidate)) {
        next = candidate;
        break;
      }
    }
    if (!next) {
      stuck.push(`${r.scientificName}: ${r.thumbUrl}`);
      continue;
    }
    console.log(`${APPLY ? "FIX " : "DRY "}${r.scientificName}${r.webpThumbUrl ? "" : " (no WebP copy, was broken)"}: ${next.split("/").pop()}`);
    if (APPLY) await prisma.speciesImage.update({ where: { id: r.id }, data: { thumbUrl: next } });
    fixed++;
    await new Promise((res) => setTimeout(res, 300));
  }
  console.log(`\n${APPLY ? "Fixed" : "Would fix"} ${fixed}; no working width for ${stuck.length}`);
  for (const s of stuck) console.log(`  - ${s}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
