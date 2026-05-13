// Minimal typed client for the OBIS (Ocean Biodiversity Information System) v3 API.
// Docs: https://api.obis.org/v3
//
// We only need the /checklist endpoint here — it returns a species list with
// occurrence counts for a given geometry / depth / time range. That gives us
// a "what's been recorded near here" prior for the ID guide.

const OBIS_BASE = "https://api.obis.org/v3";

export interface ObisChecklistRow {
  /** Scientific name as resolved by OBIS (typically WoRMS-accepted). */
  scientificName: string;
  /** Number of occurrence records for this species under the supplied filters. */
  records: number;
  /** WoRMS Aphia ID for the taxon. */
  taxonID?: number;
  /** Taxonomic rank (species, genus, family, ...). */
  taxonRank?: string;
  /** Other free-form fields OBIS may add — surfaced as unknown to keep the type safe. */
  [extra: string]: unknown;
}

export interface ObisChecklistResponse {
  results: ObisChecklistRow[];
  total: number;
}

export interface ObisChecklistQuery {
  /** WKT polygon string. Required if `nodeid` not supplied. */
  geometry?: string;
  /** Inclusive lower depth bound, in metres. */
  depthfrom?: number;
  /** Inclusive upper depth bound, in metres. */
  depthto?: number;
  /** ISO date string, e.g. "2010-01-01". */
  startdate?: string;
  /** ISO date string. */
  enddate?: string;
  /** Page size (default 50, max 5000). */
  size?: number;
}

/**
 * Build the absolute URL for an OBIS /checklist call with the given query.
 * Pure function — easy to unit-test without network.
 */
export function buildChecklistUrl(q: ObisChecklistQuery, base = OBIS_BASE): string {
  const params = new URLSearchParams();
  if (q.geometry) params.set("geometry", q.geometry);
  if (q.depthfrom != null) params.set("depthfrom", String(q.depthfrom));
  if (q.depthto != null) params.set("depthto", String(q.depthto));
  if (q.startdate) params.set("startdate", q.startdate);
  if (q.enddate) params.set("enddate", q.enddate);
  if (q.size != null) params.set("size", String(q.size));
  return `${base}/checklist?${params.toString()}`;
}

/**
 * Build a square WKT bounding box around (lat, lon) with `halfDegree` margin.
 * Returns a closed polygon (first point == last).
 */
export function bboxWkt(lat: number, lon: number, halfDegree = 0.5): string {
  const lonW = lon - halfDegree;
  const lonE = lon + halfDegree;
  const latS = lat - halfDegree;
  const latN = lat + halfDegree;
  return `POLYGON((${lonW} ${latS}, ${lonE} ${latS}, ${lonE} ${latN}, ${lonW} ${latN}, ${lonW} ${latS}))`;
}

/**
 * Fetch a complete checklist for the supplied query, paging until exhausted or
 * the cap is reached. Returns ALL rows in one array (typical results: 50–500 rows
 * for marine deployments).
 */
export async function fetchObisChecklist(
  q: ObisChecklistQuery,
  opts: { fetchImpl?: typeof fetch; cap?: number; pageSize?: number } = {},
): Promise<ObisChecklistRow[]> {
  const f = opts.fetchImpl ?? fetch;
  const cap = opts.cap ?? 5000;
  const pageSize = opts.pageSize ?? 500;

  const all: ObisChecklistRow[] = [];
  let from = 0;
  while (all.length < cap) {
    const url = buildChecklistUrl({ ...q, size: pageSize });
    // OBIS v3 uses `from` for offset paging
    const fullUrl = `${url}&from=${from}`;
    const res = await f(fullUrl);
    if (!res.ok) {
      throw new Error(`OBIS request failed: ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as ObisChecklistResponse;
    if (!body.results || body.results.length === 0) break;
    all.push(...body.results);
    if (body.results.length < pageSize) break;
    from += pageSize;
  }
  return all.slice(0, cap);
}
