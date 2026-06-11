/**
 * Read-only viability check for the per-species distribution map (WS-J).
 * Fetches the OBIS occurrence-density grid for each catalogue species and prints
 * how many UK/NE-Atlantic cells + total records it has, so we know how many
 * species can show a meaningful "where is it seen" map before building UI.
 * Writes nothing.
 *
 *   npx tsx --env-file=.env.local scripts/_distribution-coverage.ts [--limit N] [--precision 3]
 */
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { fetchDistribution } from "@/lib/biodiversity/distribution";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const limit = arg("limit") ? parseInt(arg("limit")!, 10) : Infinity;
  const precision = arg("precision") ? parseInt(arg("precision")!, 10) : 3;
  const entries = Object.entries(CATALOGUE).slice(0, limit);

  let mappable = 0;
  let thin = 0;
  for (const [sci, sp] of entries) {
    const common = (sp as { commonName?: string }).commonName ?? "";
    try {
      const g = await fetchDistribution(sci, { precision });
      // Need a few cells for a map to read as a range rather than a dot.
      if (g.cells.length >= 3) {
        mappable++;
        console.log(`OK    ${sci} (${common}) -> ${g.cells.length} UK cells, ${g.total} records, peak n=${g.maxN}`);
      } else {
        thin++;
        console.log(`THIN  ${sci} (${common}) -> ${g.cells.length} UK cells`);
      }
    } catch (e) {
      console.log(`ERR   ${sci} (${common}) -> ${(e as Error).message}`);
    }
    await sleep(400);
  }
  console.log(`\nCoverage: ${mappable}/${entries.length} species mappable (>=3 UK cells); ${thin} thin.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
