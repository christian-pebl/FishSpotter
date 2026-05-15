import { BucketKey, DEPTH_BUCKET_NULL, monthsAround } from "./buckets";

const OBIS_BASE = "https://api.obis.org/v3";

// Names we resolve to AphiaIDs at startup. Resolving by name avoids hardcoding
// numbers that may not match the bug-hunter's expectations vs the live taxonomy.
const FISH_CLASS_NAMES = ["Actinopterygii", "Chondrichthyes"] as const;

// How many years to look back when aggregating seasonality. 16 years captures
// a generation of survey effort without exploding the response size.
const SEASONALITY_YEARS = 16;

// Page size for /v3/occurrence requests. Max OBIS allows is 10000.
const PAGE_SIZE = 10000;

// Safety cap so a hot bucket never burns the function budget. At PAGE_SIZE
// this is 50k records per query attempt.
const MAX_PAGES = 5;

const MIN_USEFUL_RECORDS = 30;
const TOP_N = 10;

export type TopSpecies = {
  scientificName: string;
  count: number;
  probability: number;
};

export type ObisResult =
  | { status: "OK"; totalRecords: number; species: TopSpecies[] }
  | { status: "INSUFFICIENT_DATA"; totalRecords: number; species: [] }
  | { status: "ERROR"; errorMessage: string; species: [] };

type ObisOccurrenceRow = {
  species?: string | null;
  scientificName?: string | null;
  speciesid?: number | null;
  aphiaID?: number | null;
};

type ObisOccurrencePage = {
  total?: number;
  results?: ObisOccurrenceRow[];
};

type ObisTaxonRow = {
  taxonID?: number;
  acceptedNameUsageID?: number;
  scientificName?: string;
  rank?: string;
};

let cachedFishTaxonIds: number[] | null = null;
let cachedFishTaxonIdsPromise: Promise<number[]> | null = null;

async function resolveFishTaxonIds(): Promise<number[]> {
  if (cachedFishTaxonIds) return cachedFishTaxonIds;
  if (cachedFishTaxonIdsPromise) return cachedFishTaxonIdsPromise;

  cachedFishTaxonIdsPromise = (async () => {
    const ids: number[] = [];
    for (const name of FISH_CLASS_NAMES) {
      const url = new URL(`${OBIS_BASE}/taxon/${encodeURIComponent(name)}`);
      const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`OBIS taxon lookup for "${name}" failed: ${res.status} ${res.statusText}`);

      type TaxonLookupResponse = { results?: ObisTaxonRow[] };
      const json = (await res.json()) as TaxonLookupResponse | ObisTaxonRow;
      const row =
        "results" in (json as TaxonLookupResponse)
          ? (json as TaxonLookupResponse).results?.[0]
          : (json as ObisTaxonRow);
      const id = row?.acceptedNameUsageID ?? row?.taxonID;
      if (!id || !Number.isFinite(id)) {
        throw new Error(`OBIS taxon lookup for "${name}" returned no AphiaID`);
      }
      ids.push(id);
    }
    cachedFishTaxonIds = ids;
    return ids;
  })();

  try {
    return await cachedFishTaxonIdsPromise;
  } catch (err) {
    cachedFishTaxonIdsPromise = null;
    throw err;
  }
}

function buildBbox(lat: number, lon: number, halfWidthDeg: number): string {
  const minLon = lon - halfWidthDeg;
  const maxLon = lon + halfWidthDeg;
  const minLat = lat - halfWidthDeg;
  const maxLat = lat + halfWidthDeg;
  return `POLYGON((${minLon} ${minLat}, ${maxLon} ${minLat}, ${maxLon} ${maxLat}, ${minLon} ${maxLat}, ${minLon} ${minLat}))`;
}

function dateRange(years: number): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now.getFullYear() - years, 0, 1).toISOString().slice(0, 10);
  return { start, end };
}

async function fetchOccurrencePage(
  params: URLSearchParams,
  after?: string,
): Promise<ObisOccurrencePage> {
  const url = new URL(`${OBIS_BASE}/occurrence`);
  for (const [k, v] of params) url.searchParams.set(k, v);
  if (after) url.searchParams.set("after", after);
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`OBIS ${res.status} ${res.statusText}`);
  return (await res.json()) as ObisOccurrencePage;
}

async function aggregateOccurrences(args: {
  bbox: string;
  taxonIds: number[];
  months: number[];
  depthMin?: number;
  depthMax?: number;
}): Promise<{ counts: Map<string, number>; totalRecords: number }> {
  const { start, end } = dateRange(SEASONALITY_YEARS);
  const params = new URLSearchParams({
    geometry: args.bbox,
    taxonid: args.taxonIds.join(","),
    months: args.months.join(","),
    startdate: start,
    enddate: end,
    size: String(PAGE_SIZE),
    // Restrict to what we actually need to keep response size sane.
    fields: "species,scientificName,id",
  });
  if (args.depthMin != null) params.set("startdepth", String(args.depthMin));
  if (args.depthMax != null) params.set("enddepth", String(args.depthMax));

  const counts = new Map<string, number>();
  let totalRecords = 0;
  let after: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await fetchOccurrencePage(params, after);
    const rows = data.results ?? [];
    if (rows.length === 0) break;

    for (const r of rows) {
      const name = (r.species ?? r.scientificName ?? "").trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
      totalRecords++;
    }

    if (rows.length < PAGE_SIZE) break;
    // OBIS cursor pagination: use the last result's id as `after`.
    const last = rows[rows.length - 1] as { id?: string | number };
    if (last.id == null) break;
    after = String(last.id);
  }

  return { counts, totalRecords };
}

function topSpeciesFromCounts(counts: Map<string, number>, totalRecords: number): TopSpecies[] {
  if (totalRecords === 0) return [];
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N)
    .map(([scientificName, count]) => ({
      scientificName,
      count,
      probability: count / totalRecords,
    }));
}

export async function fetchTopSpeciesForBucket(bucket: BucketKey): Promise<ObisResult> {
  try {
    const taxonIds = await resolveFishTaxonIds();
    const months = monthsAround(bucket.month);

    const tryQuery = async (halfWidth: number, withDepth: boolean) => {
      const bbox = buildBbox(bucket.latBucket, bucket.lonBucket, halfWidth);
      const useDepth = withDepth && bucket.depthBucket !== DEPTH_BUCKET_NULL;
      return aggregateOccurrences({
        bbox,
        taxonIds,
        months,
        depthMin: useDepth ? Math.max(0, bucket.depthBucket - 10) : undefined,
        depthMax: useDepth ? bucket.depthBucket + 20 : undefined,
      });
    };

    // 1. Tight bbox + depth.
    let { counts, totalRecords } = await tryQuery(0.1, true);

    // 2. Drop depth filter if too sparse.
    if (totalRecords < MIN_USEFUL_RECORDS) {
      ({ counts, totalRecords } = await tryQuery(0.1, false));
    }

    // 3. Widen bbox if still sparse.
    if (totalRecords < MIN_USEFUL_RECORDS) {
      ({ counts, totalRecords } = await tryQuery(0.5, false));
    }

    if (totalRecords === 0) {
      return { status: "INSUFFICIENT_DATA", totalRecords: 0, species: [] };
    }
    return { status: "OK", totalRecords, species: topSpeciesFromCounts(counts, totalRecords) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown OBIS error";
    return { status: "ERROR", errorMessage: message, species: [] };
  }
}
