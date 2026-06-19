import type { DistributionGrid } from "@/lib/biodiversity/distribution";
import { COASTLINE_RINGS } from "@/data/ne-atlantic-coastline";

/**
 * Occurrence-density map for the species profile + guide ("where is it seen").
 * Pure SVG: a recognisable UK / NE-Atlantic basemap (simplified coastline) with
 * OBIS record density shaded over the seas in brand teal, a graticule + corner
 * labels for orientation, and the PEBL filming site marked. On-brand, no JS.
 *
 * The basemap always renders (so the reader can orient even when a species has
 * little OBIS data); the density cells overlay only when present.
 */

// viewBox sized to the bbox's distortion-corrected aspect (lon * cos(lat) : lat).
const VB_W = 264;
const VB_H = 340;

// The fixed geographic window. Matches UK_NE_ATLANTIC and the coastline data, so
// land + cells + graticule all share one projection.
const VIEW_BBOX = { minLat: 45, maxLat: 62, minLon: -16, maxLon: 6 };

// PEBL filming site (all current footage), for orientation — North Devon coast.
const SITE = { lat: 51.05, lon: -4.4 };

const GRATICULE_LAT = [55, 50]; // labelled parallels inside the bbox
const GRATICULE_LON = [-10, 0]; // labelled meridians

const fmtLat = (l: number) => `${Math.abs(l)}°${l >= 0 ? "N" : "S"}`;
const fmtLon = (l: number) => `${Math.abs(l)}°${l >= 0 ? "E" : "W"}`;

/**
 * Geohash cell size in degrees for a given precision. OBIS returns the density
 * grid as geohash cells, so the on-screen footprint must match the real cell
 * span (lon° × lat°) or the squares overlap horizontally / gap vertically.
 * Bits alternate lon, lat starting with lon, 5 bits per character.
 */
function geohashCellDegrees(precision: number): { lonDeg: number; latDeg: number } {
  const bits = Math.max(1, Math.round(precision)) * 5;
  const lonBits = Math.ceil(bits / 2);
  const latBits = Math.floor(bits / 2);
  return { lonDeg: 360 / 2 ** lonBits, latDeg: 180 / 2 ** latBits };
}

export function DistributionMap({ grid }: { grid: DistributionGrid | null }) {
  const bbox = grid?.bbox ?? VIEW_BBOX;
  const x = (lon: number) => ((lon - bbox.minLon) / (bbox.maxLon - bbox.minLon)) * VB_W;
  const y = (lat: number) => ((bbox.maxLat - lat) / (bbox.maxLat - bbox.minLat)) * VB_H;

  // Cell footprint = the real geohash cell span projected into the viewBox, so
  // cells tile edge-to-edge at any precision instead of overlapping. The fills
  // are semi-transparent, so we size to exactly one cell span (no overdraw) —
  // any overlap would compound into dark seams.
  const { lonDeg, latDeg } = geohashCellDegrees(grid?.precision ?? 3);
  const cw = (lonDeg / (bbox.maxLon - bbox.minLon)) * VB_W;
  const ch = (latDeg / (bbox.maxLat - bbox.minLat)) * VB_H;

  const cells = grid?.cells ?? [];
  const hasData = cells.length > 0;

  const landPath = (ring: [number, number][]) =>
    ring.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(" ") + " Z";

  const label = hasData
    ? `Where it's seen: ${grid!.total.toLocaleString()} records across ${cells.length} areas of UK and north-east Atlantic waters.`
    : "Map of UK and north-east Atlantic waters, with the PEBL filming site marked. Occurrence data for this species is not available yet.";

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="h-auto w-full max-w-[300px] rounded-modal"
        role="img"
        aria-label={label}
      >
        <defs>
          <clipPath id="distmap-frame">
            <rect x={0} y={0} width={VB_W} height={VB_H} rx={10} />
          </clipPath>
        </defs>

        {/* sea */}
        <rect x={0} y={0} width={VB_W} height={VB_H} rx={10} fill="#D7EDEF" />

        {/* land + graticule + density, clipped to the rounded frame so nothing
            spills past the corners */}
        <g clipPath="url(#distmap-frame)">
          {/* land (simplified coastline) */}
          {COASTLINE_RINGS.map((ring, i) => (
            <path key={i} d={landPath(ring)} fill="#ECE7D7" stroke="#BFD0CE" strokeWidth={0.8} strokeLinejoin="round" />
          ))}

          {/* graticule */}
          <g stroke="#2B7A78" strokeOpacity={0.16} strokeWidth={0.5}>
            {GRATICULE_LAT.map((lat) => (
              <line key={`la${lat}`} x1={0} x2={VB_W} y1={y(lat)} y2={y(lat)} />
            ))}
            {GRATICULE_LON.map((lon) => (
              <line key={`lo${lon}`} y1={0} y2={VB_H} x1={x(lon)} x2={x(lon)} />
            ))}
          </g>

          {/* density cells (teal, opacity by intensity) */}
          {cells.map((c, i) => (
            <rect
              key={i}
              x={x(c.lon) - cw / 2}
              y={y(c.lat) - ch / 2}
              width={cw}
              height={ch}
              rx={2}
              fill="#2B7A78"
              fillOpacity={0.3 + 0.65 * c.intensity}
            />
          ))}
        </g>

        {/* PEBL filming site marker */}
        <g>
          <circle cx={x(SITE.lon)} cy={y(SITE.lat)} r={4.5} fill="none" stroke="#17252A" strokeWidth={1.6} />
          <circle cx={x(SITE.lon)} cy={y(SITE.lat)} r={1.5} fill="#17252A" />
        </g>

        {/* corner + graticule labels */}
        <g fill="#17252A" fillOpacity={0.5} fontSize={9}>
          {GRATICULE_LAT.map((lat) => (
            <text key={`tla${lat}`} x={3} y={y(lat) - 2}>{fmtLat(lat)}</text>
          ))}
          {GRATICULE_LON.map((lon) => (
            <text key={`tlo${lon}`} x={x(lon) + 2} y={VB_H - 4}>{fmtLon(lon)}</text>
          ))}
        </g>
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-navy-900/55">
        {hasData ? (
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: "#2B7A78", opacity: 0.35 }} />
            fewer
            <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: "#2B7A78" }} />
            more records
          </span>
        ) : (
          <span>Occurrence data not available yet</span>
        )}
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full ring-1 ring-navy-900" /> PEBL site
        </span>
      </figcaption>
    </figure>
  );
}
