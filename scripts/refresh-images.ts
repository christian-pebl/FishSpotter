/**
 * Local CLI runner for the species-image refresh. Shares its implementation
 * with `/api/cron/refresh-images` via src/lib/biodiversity/refresh-images.ts.
 *
 * Examples:
 *   npx tsx --env-file=.env.local scripts/refresh-images.ts
 *   npx tsx --env-file=.env.local scripts/refresh-images.ts -- --species "Labrus mixtus"
 *   npx tsx --env-file=.env.local scripts/refresh-images.ts -- --stale-only
 */
import { PrismaClient } from "@prisma/client";
import { refreshSpeciesImages } from "../src/lib/biodiversity/refresh-images";

const prisma = new PrismaClient();

function parseArgs() {
  const argv = process.argv.slice(2);
  let scientificName: string | undefined;
  let staleOnly = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--species" && argv[i + 1]) scientificName = argv[i + 1];
    if (argv[i] === "--stale-only") staleOnly = true;
  }
  return { scientificName, staleOnly };
}

async function main() {
  const args = parseArgs();
  console.log(
    `Refreshing images${args.scientificName ? ` for ${args.scientificName}` : ""}` +
      `${args.staleOnly ? " (stale only)" : ""}...`,
  );
  try {
    const result = await refreshSpeciesImages({
      prisma,
      scientificName: args.scientificName,
      staleOnly: args.staleOnly,
      onProgress: (m) => console.log(m),
    });
    console.log(
      `\nDone. processed=${result.processedSpecies} rowsUpserted=${result.rowsUpserted} emptyBuckets=${result.emptyBuckets} errors=${result.errors.length} skippedFresh=${result.skippedFresh} remaining=${result.remaining}`,
    );
    if (result.errors.length > 0) {
      console.log("\nFailures:");
      for (const e of result.errors) console.log(`  ${e.scientificName}: ${e.message}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
