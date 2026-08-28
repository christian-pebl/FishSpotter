/**
 * Generator for src/data/ne-atlantic-coastline.ts, the basemap behind the
 * species range map. Reads Natural Earth 50m physical land (public domain),
 * clips it to the map window, simplifies, and emits [lon, lat] rings.
 *
 *   curl -sL -o ne_50m_land.json  *     https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/50m/physical/ne_50m_land.json
 *   node scripts/build-coastline.mjs ne_50m_land.json
 *
 * Re-run only if the map window changes. The window here MUST stay in step
 * with VIEW in src/components/species/DistributionMap.tsx, or the land and the
 * sea-region boxes end up on different projections.
 */
import { readFileSync, writeFileSync } from "node:fs";

const SRC = process.argv[2];
const OUT = "src/data/ne-atlantic-coastline.ts";

// Must match VIEW in DistributionMap.tsx.
const W = { minLon: -16, maxLon: 6, minLat: 47, maxLat: 62 };

// Douglas-Peucker, in degrees. ~1 deg lon renders at ~13px, so 0.03 deg is
// well under a pixel of error at the map's real display size.
const TOLERANCE = 0.03;
// Drop specks, but keep Anglesey / Isle of Man / Skye / Orkney / Shetland.
const MIN_AREA = 0.02;

function clip(ring, edge, keep, intersect) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const ain = keep(a);
    const bin = keep(b);
    if (ain) out.push(a);
    if (ain !== bin) out.push(intersect(a, b, edge));
  }
  return out;
}

function clipToWindow(ring) {
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  let r = ring;
  r = clip(r, W.minLon, (p) => p[0] >= W.minLon, (a, b, e) => lerp(a, b, (e - a[0]) / (b[0] - a[0])));
  if (!r.length) return r;
  r = clip(r, W.maxLon, (p) => p[0] <= W.maxLon, (a, b, e) => lerp(a, b, (e - a[0]) / (b[0] - a[0])));
  if (!r.length) return r;
  r = clip(r, W.minLat, (p) => p[1] >= W.minLat, (a, b, e) => lerp(a, b, (e - a[1]) / (b[1] - a[1])));
  if (!r.length) return r;
  r = clip(r, W.maxLat, (p) => p[1] <= W.maxLat, (a, b, e) => lerp(a, b, (e - a[1]) / (b[1] - a[1])));
  return r;
}

function perpDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy);
  if (d === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / d;
}

function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= tol) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplify(pts.slice(idx), tol)];
}

const area = (r) => {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i];
    const q = r[(i + 1) % r.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a / 2);
};

const geo = JSON.parse(readFileSync(SRC, "utf8"));
const raw = [];
for (const f of geo.features) {
  const g = f.geometry;
  if (!g) continue;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  for (const poly of polys) raw.push(poly[0]); // exterior ring only
}

const rings = [];
for (const ring of raw) {
  const lons = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  if (Math.max(...lons) < W.minLon || Math.min(...lons) > W.maxLon) continue;
  if (Math.max(...lats) < W.minLat || Math.min(...lats) > W.maxLat) continue;
  const clipped = clipToWindow(ring.map((p) => [p[0], p[1]]));
  if (clipped.length < 4) continue;
  if (area(clipped) < MIN_AREA) continue;
  const s = simplify(clipped, TOLERANCE);
  if (s.length < 4) continue;
  rings.push(s.map((p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]));
}

rings.sort((a, b) => area(b) - area(a));
const points = rings.reduce((n, r) => n + r.length, 0);

const body = rings
  .map((r) => "  [" + r.map((p) => `[${p[0]}, ${p[1]}]`).join(", ") + "],")
  .join("\n");

writeFileSync(
  OUT,
  `/**
 * Coastline for the species range map: Great Britain, Ireland, the Northern
 * Isles, the larger offshore islands and the NW European continental shore, as
 * [lon, lat] rings.
 *
 * GENERATED, do not hand-edit. Source: Natural Earth 50m physical land
 * (public domain, naturalearthdata.com), clipped to the map window
 * (lon ${W.minLon}..${W.maxLon}, lat ${W.minLat}..${W.maxLat}) and simplified with
 * Douglas-Peucker at ${TOLERANCE} degrees, which is well under one pixel of
 * error at the size this map actually renders. Rings smaller than ${MIN_AREA}
 * square degrees are dropped, which keeps Anglesey, Man, Skye, the Outer
 * Hebrides, Orkney and Shetland while discarding specks.
 *
 * This replaced a hand-placed ${41}-point outline that read as a beige blob at
 * 300px wide. ${rings.length} rings, ${points} points.
 *
 * Rendered with the same linear lon/lat -> viewBox projection as the sea
 * regions (the viewBox aspect carries the cos(midLat) correction), so these
 * coordinates drop straight onto the map.
 */

export type LonLat = [number, number];

export const COASTLINE_RINGS: LonLat[][] = [
${body}
];
`,
  "utf8",
);

console.log(`${rings.length} rings, ${points} points -> ${OUT}`);
console.log("largest:", rings.slice(0, 6).map((r) => `${r.length}pts area=${area(r).toFixed(2)}`).join("  "));
