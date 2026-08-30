/**
 * Health check for the species-guide reference photos (`npm run check:photos`).
 *
 * The sibling of `check:codecs` and `check:durations`, and it exists for the
 * same reason they do: each of the things it looks for has already shipped to
 * production at least once.
 *
 *   - A photo of the WRONG SPECIES. Commons full-text search returns congeners
 *     whose description mentions the target, so `Atherina boyeri` (big-scale
 *     sand smelt) served for months in the `Atherina presbyter` gallery. A
 *     vision check cannot save us: it is asked "is this a good photo of X?",
 *     which is a leading question about two near-identical fish.
 *   - A 14.3MB, 6000x4000 archive original painted into a grid tile a few
 *     hundred pixels wide.
 *   - A gallery emptied by a tool whose vision pass failed open.
 *
 * Read-only. Exits non-zero on a real failure so it can gate CI; thin coverage
 * is reported but never fails, because some ceilings are genuine (the sea
 * potato's entire open-licence record is empty tests washed up on a beach).
 *
 *   npm run check:photos
 *   npm run check:photos -- --min 8        # coverage bar to report against
 *   npm run check:photos -- --max-kb 900   # flag payloads above this
 *   npm run check:photos -- --skip-liveness
 *   npm run check:photos -- --species "Gadus morhua"
 */
import { PrismaClient } from "@prisma/client";
import speciesTraitsData from "../src/data/species-traits.json";
import { titleNamesACongener } from "../src/lib/biodiversity/wikimedia";
import { fetchNameFor } from "../src/lib/biodiversity/fetch-name";

const prisma = new PrismaClient();

type Catalogue = Record<string, { commonName?: string }>;
const CATALOGUE = speciesTraitsData as unknown as Catalogue;

const UA = "FishSpotter/1.0 (https://fish-spotter.vercel.app; hello@pebl-cic.co.uk)";

/**
 * Wikimedia rate-limits a burst from one IP hard, and a 429 from THIS script is
 * not a broken photo: a run that fetched 666 URLs in two minutes flagged 46 of
 * them, and every one returned 200 when asked on its own. So Commons gets its
 * own serial, delayed lane, and a real visitor (ten images, residential IP,
 * browser headers) never comes close to the limit.
 */
const WIKIMEDIA_HOST = "upload.wikimedia.org";
const WIKIMEDIA_DELAY_MS = 1200;
const OTHER_CONCURRENCY = 8;
/**
 * Guard against truncation only. Do NOT raise this to mean "too small to be a
 * real photo": a first cut used 5KB and failed seven perfectly good rows,
 * because a 500x281 WebP of a simple subject is 4.4KB and a 286x177 one is
 * 2KB. Whether the bytes are an image is a question about their HEADER, not
 * their length, which is what `looksLikeImage` answers.
 */
const MIN_REAL_BYTES = 256;

/**
 * True when the bytes start with a JPEG, PNG, WebP or GIF signature.
 *
 * A 200 is not proof of a photo. Wikimedia answers a rate-limited request with
 * an HTML error page under a 200-ish status, and a CDN can serve a placeholder
 * the same way; both render as a broken tile. Checking the magic bytes asks the
 * question we actually care about and is indifferent to how well the image
 * happens to compress.
 */
export function looksLikeImage(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true; // JPEG
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return true; // PNG
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return true;
  if (buf.subarray(0, 3).toString("ascii") === "GIF") return true;
  return false;
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const OPTS = {
  min: Number(arg("--min") ?? 8),
  maxKb: Number(arg("--max-kb") ?? 900),
  species: arg("--species"),
  skipLiveness: process.argv.includes("--skip-liveness"),
};

async function mapPool<T, R>(items: T[], conc: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(conc, items.length) }, async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

async function probe(url: string): Promise<{ code: number; bytes: number; isImage: boolean }> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    const buf = Buffer.from(await res.arrayBuffer());
    return { code: res.status, bytes: buf.byteLength, isImage: looksLikeImage(buf) };
  } catch {
    return { code: 0, bytes: 0, isImage: false };
  }
}

function commonsTitle(sourceUrl: string): string | null {
  const m = /\/wiki\/(File:.+)$/i.exec(sourceUrl);
  return m ? decodeURIComponent(m[1]).replace(/_/g, " ") : null;
}

async function main() {
  const where = OPTS.species ? { scientificName: OPTS.species } : {};
  const rows = await prisma.speciesImage.findMany({
    where,
    select: {
      scientificName: true,
      url: true,
      webpUrl: true,
      sourceUrl: true,
      source: true,
      curated: true,
      license: true,
      attribution: true,
    },
    orderBy: [{ scientificName: "asc" }, { curated: "desc" }, { ordering: "asc" }],
  });

  const failures: string[] = [];
  const warnings: string[] = [];

  // --- coverage (reported, never fatal) ---
  const names = OPTS.species ? [OPTS.species] : Object.keys(CATALOGUE).filter((k) => !k.startsWith("_")).sort();
  const gallery = new Map<string, number>();
  for (const r of rows) if (!r.curated) gallery.set(r.scientificName, (gallery.get(r.scientificName) ?? 0) + 1);
  const short = names.filter((n) => (gallery.get(n) ?? 0) < OPTS.min);
  console.log(`Species: ${names.length}; photo rows: ${rows.length}`);
  console.log(`At or above ${OPTS.min} gallery photos: ${names.length - short.length}/${names.length}`);
  if (short.length) {
    console.log(
      `Under ${OPTS.min}: ` +
        short.map((n) => `${CATALOGUE[n]?.commonName ?? n} (${gallery.get(n) ?? 0})`).join(", "),
    );
  }

  // --- attribution: a CC photo without its credit is a licence breach ---
  for (const r of rows) {
    if (!r.license?.trim()) failures.push(`missing licence: ${r.scientificName} ${r.sourceUrl}`);
    if (!r.attribution?.trim()) failures.push(`missing attribution: ${r.scientificName} ${r.sourceUrl}`);
  }

  // --- identity: no Commons file whose own title names a congener ---
  for (const r of rows) {
    if (r.source !== "wikimedia") continue;
    const title = commonsTitle(r.sourceUrl);
    if (!title) continue;
    if (titleNamesACongener(title, r.scientificName) || titleNamesACongener(title, fetchNameFor(r.scientificName))) {
      failures.push(`wrong species: ${r.scientificName} gallery holds ${title}`);
    }
  }

  // --- liveness + payload ---
  if (!OPTS.skipLiveness) {
    const targets = rows.map((r) => ({ sci: r.scientificName, url: r.webpUrl ?? r.url }));
    const commons = targets.filter((t) => t.url.includes(WIKIMEDIA_HOST));
    const others = targets.filter((t) => !t.url.includes(WIKIMEDIA_HOST));
    console.log(`\nFetching ${targets.length} photo URLs (${commons.length} via Commons, serially)...`);

    const otherResults = await mapPool(others, OTHER_CONCURRENCY, (t) => probe(t.url));
    const commonsResults: Array<{ code: number; bytes: number; isImage: boolean }> = [];
    for (const t of commons) {
      commonsResults.push(await probe(t.url));
      await new Promise((r) => setTimeout(r, WIKIMEDIA_DELAY_MS));
    }

    const all = [
      ...others.map((t, i) => ({ ...t, ...otherResults[i] })),
      ...commons.map((t, i) => ({ ...t, ...commonsResults[i] })),
    ];
    for (const x of all) {
      if (x.code !== 200) {
        failures.push(`http ${x.code}: ${x.sci} ${x.url}`);
      } else if (!x.isImage || x.bytes < MIN_REAL_BYTES) {
        failures.push(`not an image (${x.bytes}B, no image signature): ${x.sci} ${x.url}`);
      } else if (x.bytes > OPTS.maxKb * 1024) {
        warnings.push(`${(x.bytes / 1024 / 1024).toFixed(2)}MB: ${x.sci} ${x.url}`);
      }
    }
    const total = all.reduce((s, x) => s + x.bytes, 0);
    console.log(`Mean payload: ${(total / all.length / 1024).toFixed(0)} KB`);
  }

  if (warnings.length) {
    console.log(`\nOversized (over ${OPTS.maxKb} KB), these are archive originals, repoint them at a scaled render:`);
    for (const w of warnings) console.log(`  ${w}`);
  }
  if (failures.length) {
    console.log(`\nFAILED (${failures.length}):`);
    for (const f of failures) console.log(`  ${f}`);
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log("\nEvery reference photo resolves, is credited, and is the species it claims to be.");
  await prisma.$disconnect();
}

// Only run when invoked as the script. `looksLikeImage` is unit-tested, and
// importing it must not open a database connection or start fetching several
// hundred photos as a side effect.
const invokedDirectly = process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/check-photos.ts");
if (invokedDirectly) {
  main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
}
