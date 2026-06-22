/**
 * Per-species depth distribution from OBIS occurrence records.
 *
 * Powers the "typically seen at ~X m" line Anjali asked for (in the species
 * tile / profile). This is deliberately NOT derived from our own
 * `SpeciesProbability` buckets: every FishSpotter snippet sits at ~20 m, so our
 * buckets carry no depth variance. Instead we ask OBIS directly at what depths a
 * species is recorded across its range, which is the ecological statement the
 * feature wants to make.
 *
 * `summariseDepths` is a pure function (unit-tested). `fetchSpeciesDepths` is the
 * OBIS I/O. Nothing here writes the DB; wiring + caching is a later step.
 */

import { fetchWithTimeout } from "@/lib/http";

const OBIS_BASE = "https://api.obis.org/v3";

// Sanity window for a depth reading, in metres. Negatives (elevation) and
// absurd values (bad records / land) are dropped.
const MIN_DEPTH_M = 0;
const MAX_DEPTH_M = 11_000;

// Below this many usable readings the summary is not trustworthy -> return null
// (the UI then simply omits the depth line rather than asserting a bad range).
const MIN_USEFUL_READINGS = 8;

const PAGE_SIZE = 10_000;

export type DepthSummary = {
  /** number of usable depth readings the summary is built from */
  n: number;
  medianM: number;
  /** 10th / 90th percentile - the "typical band" */
  p10M: number;
  p90M: number;
  minM: number;
  maxM: number;
  /** human label, e.g. "5-25 m" (typical band) */
  label: string;
};

function rounded(m: number): number {
  // Round to a tidy step so labels read cleanly: nearest 1 m below 30, else 5 m.
  return m < 30 ? Math.round(m) : Math.round(m / 5) * 5;
}

/** Linear-interpolated percentile over a pre-sortable array. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Pure: turn raw depth readings (metres) into a typical-depth summary, or null
 * if there aren't enough trustworthy readings.
 */
export function summariseDepths(depths: number[]): DepthSummary | null {
  const xs = depths
    .filter((d) => typeof d === "number" && Number.isFinite(d) && d >= MIN_DEPTH_M && d <= MAX_DEPTH_M)
    .sort((a, b) => a - b);

  if (xs.length < MIN_USEFUL_READINGS) return null;

  const median = percentile(xs, 0.5);
  const p10 = percentile(xs, 0.1);
  const p90 = percentile(xs, 0.9);

  const lo = rounded(p10);
  const hi = rounded(p90);
  const label = lo === hi ? `~${lo} m` : `${lo}-${hi} m`;

  return {
    n: xs.length,
    medianM: median,
    p10M: p10,
    p90M: p90,
    minM: xs[0],
    maxM: xs[xs.length - 1],
    label,
  };
}

type ObisDepthRow = {
  depth?: number | null;
  minimumDepthInMeters?: number | null;
  maximumDepthInMeters?: number | null;
  bathymetry?: number | null;
};

/** Best single depth value for one occurrence record, or null. */
export function depthOfRecord(r: ObisDepthRow): number | null {
  if (typeof r.depth === "number" && Number.isFinite(r.depth)) return r.depth;
  const lo = r.minimumDepthInMeters;
  const hi = r.maximumDepthInMeters;
  if (typeof lo === "number" && typeof hi === "number") return (lo + hi) / 2;
  if (typeof lo === "number") return lo;
  if (typeof hi === "number") return hi;
  // Bathymetry (seabed depth at the record's location) is a last-resort proxy:
  // it bounds, rather than measures, where the animal was. Still useful for a
  // typical-depth band when nothing better exists.
  if (typeof r.bathymetry === "number" && Number.isFinite(r.bathymetry)) return r.bathymetry;
  return null;
}

/**
 * Fetch raw depth readings for a species from OBIS occurrence records.
 * Read-only network call. Returns the usable depth values (may be empty).
 */
export async function fetchSpeciesDepths(
  scientificName: string,
  opts: { maxPages?: number; signal?: AbortSignal } = {},
): Promise<number[]> {
  const maxPages = opts.maxPages ?? 2;
  const depths: number[] = [];
  let after: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`${OBIS_BASE}/occurrence`);
    url.searchParams.set("scientificname", scientificName);
    url.searchParams.set("size", String(PAGE_SIZE));
    url.searchParams.set(
      "fields",
      "id,depth,minimumDepthInMeters,maximumDepthInMeters,bathymetry",
    );
    if (after) url.searchParams.set("after", after);

    const res = await fetchWithTimeout(url.toString(), {
      headers: { Accept: "application/json" },
      signal: opts.signal,
    });
    if (!res.ok) throw new Error(`OBIS ${res.status} ${res.statusText} for "${scientificName}"`);
    const data = (await res.json()) as { results?: (ObisDepthRow & { id?: string | number })[] };
    const rows = data.results ?? [];
    if (rows.length === 0) break;

    for (const r of rows) {
      const d = depthOfRecord(r);
      if (d != null) depths.push(d);
    }

    if (rows.length < PAGE_SIZE) break;
    const last = rows[rows.length - 1];
    if (last.id == null) break;
    after = String(last.id);
  }

  return depths;
}

/** Convenience: fetch + summarise in one call. */
export async function fetchDepthSummary(
  scientificName: string,
  opts?: { maxPages?: number; signal?: AbortSignal },
): Promise<DepthSummary | null> {
  const depths = await fetchSpeciesDepths(scientificName, opts);
  return summariseDepths(depths);
}
