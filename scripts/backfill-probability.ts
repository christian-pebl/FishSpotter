/**
 * Populates the OBIS probability cache and the GBIF name map.
 *
 * Modes:
 *   npx tsx --env-file=.env.local scripts/backfill-probability.ts
 *     → fills missing/errored buckets, then resolves missing common names.
 *
 *   npx tsx --env-file=.env.local scripts/backfill-probability.ts --stale-only
 *     → only refreshes buckets whose staleAfter has passed (or errored).
 *
 *   npx tsx --env-file=.env.local scripts/backfill-probability.ts --limit 5
 *     → caps the number of buckets touched this run (handy for spot checks).
 *
 *   npx tsx --env-file=.env.local scripts/backfill-probability.ts --names-only
 *     → skips OBIS entirely; only resolves staffAnswer → scientific name.
 */
import { PrismaClient } from "@prisma/client";
import {
  refreshNameMap,
  refreshProbabilityBuckets,
} from "../src/lib/biodiversity/refresh";

const prisma = new PrismaClient();

type Flags = {
  staleOnly: boolean;
  limit?: number;
  namesOnly: boolean;
  bucketsOnly: boolean;
};

function parseFlags(argv: string[]): Flags {
  const flags: Flags = {
    staleOnly: false,
    namesOnly: false,
    bucketsOnly: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--stale-only") flags.staleOnly = true;
    else if (a === "--names-only") flags.namesOnly = true;
    else if (a === "--buckets-only") flags.bucketsOnly = true;
    else if (a === "--limit") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`--limit expects a positive number, got ${argv[i]}`);
      }
      flags.limit = n;
    } else if (a === "--help" || a === "-h") {
      console.log(
        [
          "Usage: backfill-probability.ts [flags]",
          "  --stale-only     refresh only stale/errored buckets",
          "  --limit N        cap buckets touched this run",
          "  --names-only     skip OBIS, only resolve common names",
          "  --buckets-only   skip GBIF, only refresh buckets",
        ].join("\n"),
      );
      process.exit(0);
    }
  }
  return flags;
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const log = (msg: string) => console.log(msg);

  try {
    if (!flags.namesOnly) {
      console.log("\n=== OBIS probability buckets ===");
      const summary = await refreshProbabilityBuckets({
        staleOnly: flags.staleOnly,
        maxBuckets: flags.limit,
        log,
      });
      console.log(
        `\n${summary.attempted} attempted | ${summary.ok} OK · ${summary.insufficient} insufficient · ${summary.errored} errored | ${summary.fresh} skipped fresh · ${(summary.durationMs / 1000).toFixed(1)}s`,
      );
    }

    if (!flags.bucketsOnly) {
      console.log("\n=== GBIF name map ===");
      const summary = await refreshNameMap({ log });
      console.log(
        `\n${summary.attempted} attempted | ${summary.resolved} resolved · ${summary.unresolved} unresolved | ${(summary.durationMs / 1000).toFixed(1)}s`,
      );
    }

    console.log("\nDone.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
