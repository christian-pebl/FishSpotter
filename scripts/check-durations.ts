/**
 * Reads every Snippet.videoUrl from the database, probes its duration with
 * ffprobe, and reports any clip shorter than the minimum.
 *
 * WHY THIS EXISTS
 * ---------------
 * An audit on 28 Aug 2026 found 57 of 163 live clips under 6 seconds, the
 * shortest 1.77s, and 31 of those came from a single export. Nothing in the
 * pipeline had ever looked at how long a clip ran, so a tightly cut track
 * shipped as a clip that loops before a spotter can look at it. This is the
 * same shape as the codec, metadata and burnt-in-overlay incidents: the defect
 * was invisible at upload time and only measurable afterwards.
 *
 * Unlike `check:codecs` this does NOT exit non-zero on a finding. A clip too
 * short to enjoy is a quality problem, not a broken one (it still plays), and
 * three clips in the catalogue genuinely cannot be lengthened because their
 * source IS the extract. Failing the build on those would train people to
 * ignore it. Use `--strict` to make it a hard gate in a context that wants one.
 *
 * Run: npm run check:durations
 *      npm run check:durations -- --min 7 --strict
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(exec);

const CONCURRENCY = 8;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const MIN_SECONDS = arg("min") ? parseFloat(arg("min")!) : 7;
const STRICT = process.argv.includes("--strict");

async function duration(url: string): Promise<number> {
  const { stdout } = await run(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${url}"`,
  );
  const seconds = parseFloat(stdout.trim());
  if (Number.isNaN(seconds)) throw new Error(`unparseable duration: "${stdout.trim()}"`);
  return seconds;
}

/** Run fn over items with a fixed worker pool, preserving nothing but effects. */
async function pooled<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

async function main() {
  if (!process.env.POSTGRES_PRISMA_URL) {
    console.log("POSTGRES_PRISMA_URL not set, duration check skipped.");
    return;
  }
  const { prisma } = await import("../src/lib/prisma");

  // Excluded snips are hidden from every user-facing surface, so their length
  // is not a product problem and would only add noise here.
  const snippets = await prisma.snippet.findMany({
    where: { excluded: false },
    select: { id: true, externalId: true, videoUrl: true, site: true },
    orderBy: { externalId: "asc" },
  });

  const short: { externalId: string; seconds: number; site: string }[] = [];
  const failed: { externalId: string; error: string }[] = [];

  await pooled(snippets, CONCURRENCY, async (s) => {
    try {
      const seconds = await duration(s.videoUrl);
      if (seconds < MIN_SECONDS) {
        short.push({ externalId: s.externalId, seconds, site: s.site });
      }
    } catch (err) {
      failed.push({ externalId: s.externalId, error: (err as Error).message });
    }
  });

  short.sort((a, b) => a.seconds - b.seconds);

  if (short.length) {
    console.log(`Clips under ${MIN_SECONDS}s (${short.length} of ${snippets.length}):`);
    for (const s of short) {
      console.log(`  ${s.seconds.toFixed(2)}s  ${s.externalId}  [${s.site}]`);
    }
  } else {
    console.log(`All ${snippets.length} live clips are at least ${MIN_SECONDS}s.`);
  }

  if (failed.length) {
    console.error(`\nCould not probe ${failed.length} clip(s):`);
    for (const f of failed) console.error(`  ${f.externalId}: ${f.error}`);
  }

  await prisma.$disconnect();
  // A probe failure is always an error: it means a live URL did not answer.
  if (failed.length || (STRICT && short.length)) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
