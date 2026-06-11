/**
 * Read-only viability check for the per-species depth feature.
 * Fetches OBIS depth readings for each catalogue species and prints the typical
 * band + reading count, so we know how many species can actually show a
 * "found at ~X m" line before building any UI. Writes nothing.
 *
 *   npx tsx --env-file=.env.local scripts/_depth-coverage.ts [--limit N]
 */
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { fetchSpeciesDepths, summariseDepths } from "@/lib/biodiversity/depth";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const limit = arg("limit") ? parseInt(arg("limit")!, 10) : Infinity;
  const entries = Object.entries(CATALOGUE).slice(0, limit);

  let withBand = 0;
  let thin = 0;
  const rows: string[] = [];

  for (const [sci, sp] of entries) {
    const common = (sp as { commonName?: string }).commonName ?? "";
    try {
      const depths = await fetchSpeciesDepths(sci, { maxPages: 2 });
      const s = summariseDepths(depths);
      if (s) {
        withBand++;
        rows.push(`OK    ${sci} (${common}) -> ${s.label}  [n=${s.n}, median ${Math.round(s.medianM)} m]`);
      } else {
        thin++;
        rows.push(`THIN  ${sci} (${common}) -> only ${depths.length} usable readings`);
      }
    } catch (e) {
      rows.push(`ERR   ${sci} (${common}) -> ${(e as Error).message}`);
    }
    await sleep(400); // be polite to OBIS
  }

  for (const r of rows) console.log(r);
  console.log(`\nCoverage: ${withBand}/${entries.length} species got a usable depth band; ${thin} too thin.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
