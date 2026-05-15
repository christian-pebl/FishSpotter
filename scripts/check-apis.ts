/**
 * Verifies that every external API and the local DB are reachable and
 * returning the schema this codebase assumes. Run before the first backfill
 * and any time the deployment environment changes.
 *
 *   npx tsx --env-file=.env.local scripts/check-apis.ts
 *
 * Exits non-zero if any probe fails so it's safe to chain into a release flow.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Probe = {
  label: string;
  run: () => Promise<{ detail: string; warn?: string }>;
};

const OBIS = "https://api.obis.org/v3";
const GBIF = "https://api.gbif.org/v1";

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

async function probeObisTaxon(name: string): Promise<number> {
  const json = (await fetchJson(`${OBIS}/taxon/${encodeURIComponent(name)}`)) as {
    results?: Array<{ taxonID?: number; acceptedNameUsageID?: number; scientificName?: string }>;
    taxonID?: number;
    acceptedNameUsageID?: number;
  };
  const row = json.results?.[0] ?? json;
  const id = row.acceptedNameUsageID ?? row.taxonID;
  if (!id) throw new Error(`no AphiaID returned for "${name}"`);
  return id;
}

const PROBES: Probe[] = [
  {
    label: "A. OBIS reachable + Chondrichthyes AphiaID",
    run: async () => {
      const id = await probeObisTaxon("Chondrichthyes");
      return { detail: `Chondrichthyes AphiaID = ${id}` };
    },
  },
  {
    label: "B. OBIS Actinopterygii AphiaID",
    run: async () => {
      const id = await probeObisTaxon("Actinopterygii");
      return { detail: `Actinopterygii AphiaID = ${id}` };
    },
  },
  {
    label: "C. OBIS /occurrence schema (Skomer-ish, July, fish)",
    run: async () => {
      const [chId, actId] = await Promise.all([
        probeObisTaxon("Chondrichthyes"),
        probeObisTaxon("Actinopterygii"),
      ]);
      const params = new URLSearchParams({
        geometry: "POLYGON((-5.1 51.6, -5.0 51.6, -5.0 51.7, -5.1 51.7, -5.1 51.6))",
        taxonid: `${actId},${chId}`,
        months: "7",
        startdate: "2018-01-01",
        enddate: new Date().toISOString().slice(0, 10),
        size: "5",
      });
      const json = (await fetchJson(`${OBIS}/occurrence?${params}`)) as {
        total?: number;
        results?: Array<Record<string, unknown>>;
      };
      const total = typeof json.total === "number" ? json.total : "unknown";
      const first = json.results?.[0];
      const keys = first ? Object.keys(first).sort() : [];
      const hasSpecies = first
        ? "species" in first || "scientificName" in first
        : true;
      const hasCursor = first ? "id" in first : true;
      const warn = !hasSpecies
        ? "first row lacks species/scientificName — aggregation will be empty"
        : !hasCursor
          ? "first row lacks id — pagination cursor won't advance"
          : undefined;
      return {
        detail: `total=${total}, sample keys: ${keys.slice(0, 8).join(", ")}${keys.length > 8 ? "…" : ""}`,
        warn,
      };
    },
  },
  {
    label: "D. GBIF /species/match canonical name",
    run: async () => {
      const json = (await fetchJson(`${GBIF}/species/match?name=pollack&verbose=false`)) as {
        matchType?: string;
        canonicalName?: string;
        acceptedCanonicalName?: string;
        scientificName?: string;
      };
      const canonical = json.acceptedCanonicalName ?? json.canonicalName;
      if (!canonical) {
        throw new Error(`no canonicalName returned (got scientificName="${json.scientificName}")`);
      }
      const expected = "Pollachius pollachius";
      const warn = canonical !== expected ? `expected "${expected}", got "${canonical}"` : undefined;
      return { detail: `pollack → ${canonical} (${json.matchType})`, warn };
    },
  },
  {
    label: "E. Database connectivity",
    run: async () => {
      const [snippets, probabilities, names] = await Promise.all([
        prisma.snippet.count(),
        prisma.speciesProbability.count(),
        prisma.speciesNameMap.count(),
      ]);
      return {
        detail: `${snippets} snippets, ${probabilities} cached buckets, ${names} cached names`,
      };
    },
  },
];

async function main() {
  console.log(`Checking ${PROBES.length} probes…\n`);
  let failures = 0;
  let warnings = 0;

  for (const probe of PROBES) {
    process.stdout.write(`• ${probe.label} … `);
    try {
      const { detail, warn } = await probe.run();
      if (warn) {
        warnings++;
        console.log(`WARN\n    ${detail}\n    ⚠ ${warn}`);
      } else {
        console.log(`OK\n    ${detail}`);
      }
    } catch (err) {
      failures++;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`FAIL\n    ✗ ${msg}`);
    }
  }

  await prisma.$disconnect();

  console.log(
    `\n${PROBES.length - failures - warnings} ok · ${warnings} warn · ${failures} fail`,
  );
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  prisma.$disconnect().finally(() => process.exit(1));
});
