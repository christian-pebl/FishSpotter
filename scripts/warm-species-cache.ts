/**
 * Pre-populate the species depth + distribution caches for every catalogue
 * species, so the first real visitor to a profile doesn't wait ~15s on OBIS.
 * Read-through getters do the fetch + upsert; this just walks the catalogue.
 * Idempotent (skips species whose cache is still fresh). Throttled for OBIS.
 *
 *   npx tsx --env-file=.env.local scripts/warm-species-cache.ts
 */
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { prisma } from "@/lib/prisma";
import { getCachedDepth, getCachedDistribution } from "@/lib/biodiversity/species-cache";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const names = Object.keys(CATALOGUE);
  console.log(`Warming depth + distribution cache for ${names.length} species...`);
  let i = 0;
  for (const sci of names) {
    i++;
    const [depth, dist] = await Promise.all([getCachedDepth(sci), getCachedDistribution(sci)]);
    console.log(
      `[${i}/${names.length}] ${sci}: depth ${depth ? depth.label : "—"}, dist ${dist ? `${dist.cells.length} cells` : "—"}`,
    );
    await sleep(300);
  }
  await prisma.$disconnect();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
