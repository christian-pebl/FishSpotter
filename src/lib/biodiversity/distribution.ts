/**
 * Per-species occurrence density from OBIS, for the "where is it seen" map on
 * the species profile (WS-J).
 *
 * Uses OBIS's server-side gridded endpoint (`/occurrence/grid/{precision}`),
 * which returns a GeoJSON FeatureCollection of geohash cells each carrying a
 * count (`properties.n`) — already aggregated, so one request per species
 * instead of paging tens of thousands of raw points.
 *
 * The transforms (`cellFromFeature`, `gridFromFeatureCollection`) are pure and
 * unit-tested. `fetchSpeciesGrid` is the OBIS I/O. Nothing here writes the DB;
 * caching + the SVG/basemap rendering is a later (UI) step.
 */

import { fetchWithTimeout } from "@/lib/http";

const OBIS_BASE = "https://api.obis.org/v3";

export type BBox = { minLat: number; maxLat: number; minLon: number; maxLon: number };

// Default viewport: UK + NE Atlantic shelf, where this product's footage lives.
// Cells outside this are dropped so the map reads as "around here", not global.
export const UK_NE_ATLANTIC: BBox = { minLat: 45, maxLat: 62, minLon: -16, maxLon: 6 };

export type DensityCell = {
  /** cell centroid */
  lat: number;
  lon: number;
  /** raw occurrence count in the cell */
  n: number;
  /** n / maxN across the returned cells, 0..1, for shading */
  intensity: number;
};

export type DistributionGrid = {
  precision: number;
  bbox: BBox | null;
  cells: DensityCell[];
  total: number;
  maxN: number;
};

type GeoJsonFeature = {
  geometry?: { type?: string; coordinates?: number[][][] } | null;
  properties?: { n?: number } | null;
};
type GeoJsonFC = { features?: GeoJsonFeature[] };

function inBBox(lat: number, lon: number, bbox: BBox | null): boolean {
  if (!bbox) return true;
  return lat >= bbox.minLat && lat <= bbox.maxLat && lon >= bbox.minLon && lon <= bbox.maxLon;
}

/**
 * Pure: a GeoJSON polygon cell -> {lat, lon (centroid), n}, or null if the
 * geometry/count is unusable. Centroid = bbox centre of the polygon ring (cells
 * are small geohash boxes, so this is exact enough for shading).
 */
export function cellFromFeature(f: GeoJsonFeature): { lat: number; lon: number; n: number } | null {
  const n = f.properties?.n;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null;
  const ring = f.geometry?.coordinates?.[0];
  if (!ring || ring.length === 0) return null;

  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const pt of ring) {
    const [lon, lat] = pt;
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  if (!Number.isFinite(minLat) || !Number.isFinite(minLon)) return null;
  return { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2, n };
}

/**
 * Pure: FeatureCollection -> density grid, filtered to bbox and intensity-
 * normalised. Cells are sorted densest-first.
 */
export function gridFromFeatureCollection(
  fc: GeoJsonFC,
  opts: { bbox?: BBox | null; precision?: number } = {},
): DistributionGrid {
  const bbox = opts.bbox === undefined ? UK_NE_ATLANTIC : opts.bbox;
  const raw: { lat: number; lon: number; n: number }[] = [];
  for (const f of fc.features ?? []) {
    const c = cellFromFeature(f);
    if (c && inBBox(c.lat, c.lon, bbox)) raw.push(c);
  }
  const maxN = raw.reduce((m, c) => Math.max(m, c.n), 0);
  const total = raw.reduce((s, c) => s + c.n, 0);
  const cells: DensityCell[] = raw
    .map((c) => ({ ...c, intensity: maxN > 0 ? c.n / maxN : 0 }))
    .sort((a, b) => b.n - a.n);
  return { precision: opts.precision ?? 3, bbox, cells, total, maxN };
}

/**
 * Fetch the OBIS occurrence-density grid for a species. Read-only network call.
 * `precision` is the geohash length: 3 ≈ ~150 km cells (coarse, robust),
 * 4 ≈ ~40 km (finer). Returns the raw GeoJSON FeatureCollection.
 */
export async function fetchSpeciesGrid(
  scientificName: string,
  opts: { precision?: number; signal?: AbortSignal } = {},
): Promise<GeoJsonFC> {
  const precision = opts.precision ?? 3;
  const url = new URL(`${OBIS_BASE}/occurrence/grid/${precision}`);
  url.searchParams.set("scientificname", scientificName);
  const res = await fetchWithTimeout(url.toString(), {
    headers: { Accept: "application/json" },
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`OBIS grid ${res.status} ${res.statusText} for "${scientificName}"`);
  return (await res.json()) as GeoJsonFC;
}

/** Convenience: fetch + grid in one call, filtered to bbox (default UK/NE-Atlantic). */
export async function fetchDistribution(
  scientificName: string,
  opts: { precision?: number; bbox?: BBox | null; signal?: AbortSignal } = {},
): Promise<DistributionGrid> {
  const fc = await fetchSpeciesGrid(scientificName, { precision: opts.precision, signal: opts.signal });
  return gridFromFeatureCollection(fc, { bbox: opts.bbox, precision: opts.precision });
}
