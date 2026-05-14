import { BucketKey, DEPTH_BUCKET_NULL, monthsAround } from "./buckets";

const OBIS_BASE = "https://api.obis.org/v3";

// Class taxon IDs in OBIS (WoRMS AphiaIDs):
// Actinopterygii = 10194 (ray-finned fishes)
// Chondrichthyes = 1828 (cartilaginous fishes — sharks, rays)
const FISH_TAXON_IDS = [10194, 1828];

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

type ObisChecklistRow = { species?: string; scientificName?: string; records?: number };

function buildBbox(lat: number, lon: number, halfWidthDeg: number): string {
  const minLon = lon - halfWidthDeg;
  const maxLon = lon + halfWidthDeg;
  const minLat = lat - halfWidthDeg;
  const maxLat = lat + halfWidthDeg;
  // WKT polygon, lon lat order, closed ring
  return `POLYGON((${minLon} ${minLat}, ${maxLon} ${minLat}, ${maxLon} ${maxLat}, ${minLon} ${maxLat}, ${minLon} ${minLat}))`;
}

async function fetchChecklist(params: {
  bbox: string;
  taxonIds: number[];
  months: number[];
  depthMin?: number;
  depthMax?: number;
}): Promise<ObisChecklistRow[]> {
  const url = new URL(`${OBIS_BASE}/checklist`);
  url.searchParams.set("geometry", params.bbox);
  url.searchParams.set("taxonid", params.taxonIds.join(","));
  url.searchParams.set("months", params.months.join(","));
  if (params.depthMin != null) url.searchParams.set("startdepth", String(params.depthMin));
  if (params.depthMax != null) url.searchParams.set("enddepth", String(params.depthMax));
  url.searchParams.set("size", "200");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`OBIS ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { results?: ObisChecklistRow[] };
  return json.results ?? [];
}

function aggregateTopSpecies(rows: ObisChecklistRow[]): TopSpecies[] {
  const total = rows.reduce((sum, r) => sum + (r.records ?? 0), 0);
  if (total === 0) return [];
  const sorted = rows
    .map((r) => ({
      scientificName: (r.species ?? r.scientificName ?? "").trim(),
      count: r.records ?? 0,
    }))
    .filter((r) => r.scientificName.length > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N);
  return sorted.map((r) => ({
    scientificName: r.scientificName,
    count: r.count,
    probability: r.count / total,
  }));
}

export async function fetchTopSpeciesForBucket(bucket: BucketKey): Promise<ObisResult> {
  const months = monthsAround(bucket.month);

  const tryQuery = async (halfWidth: number, withDepth: boolean): Promise<ObisChecklistRow[]> => {
    const bbox = buildBbox(bucket.latBucket, bucket.lonBucket, halfWidth);
    const useDepth = withDepth && bucket.depthBucket !== DEPTH_BUCKET_NULL;
    return fetchChecklist({
      bbox,
      taxonIds: FISH_TAXON_IDS,
      months,
      depthMin: useDepth ? Math.max(0, bucket.depthBucket - 10) : undefined,
      depthMax: useDepth ? bucket.depthBucket + 20 : undefined,
    });
  };

  try {
    // 1. Tight bbox + depth.
    let rows = await tryQuery(0.1, true);
    let totalRecords = rows.reduce((s, r) => s + (r.records ?? 0), 0);

    // 2. Drop depth filter if too sparse.
    if (totalRecords < MIN_USEFUL_RECORDS) {
      rows = await tryQuery(0.1, false);
      totalRecords = rows.reduce((s, r) => s + (r.records ?? 0), 0);
    }

    // 3. Widen bbox if still sparse.
    if (totalRecords < MIN_USEFUL_RECORDS) {
      rows = await tryQuery(0.5, false);
      totalRecords = rows.reduce((s, r) => s + (r.records ?? 0), 0);
    }

    if (totalRecords === 0) {
      return { status: "INSUFFICIENT_DATA", totalRecords: 0, species: [] };
    }

    const species = aggregateTopSpecies(rows);
    return { status: "OK", totalRecords, species };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown OBIS error";
    return { status: "ERROR", errorMessage: message, species: [] };
  }
}
