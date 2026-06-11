import type { DistributionGrid } from "@/lib/biodiversity/distribution";

/**
 * Occurrence-density map for the species profile ("where is it seen").
 * Pure server SVG from the OBIS density grid (distribution.ts). Equirectangular
 * projection within the UK/NE-Atlantic bbox, longitude scaled by cos(midLat) to
 * cut distortion. Cells shade teal by record density; a graticule + corner
 * labels + the PEBL filming site give orientation. On-brand, no JS.
 */

// viewBox sized to the bbox's distortion-corrected aspect (lon * cos(lat) : lat).
const VB_W = 264;
const VB_H = 340;

// PEBL filming site (all current footage), for orientation.
const SITE = { lat: 51.05, lon: -4.4 };

const GRATICULE_LAT = [55, 50]; // labelled parallels inside the bbox
const GRATICULE_LON = [-10, 0]; // labelled meridians

function fmtLat(l: number) {
  return `${Math.abs(l)}°${l >= 0 ? "N" : "S"}`;
}
function fmtLon(l: number) {
  return `${Math.abs(l)}°${l >= 0 ? "E" : "W"}`;
}

export function DistributionMap({ grid }: { grid: DistributionGrid | null }) {
  if (!grid || grid.cells.length === 0) {
    return (
      <p className="text-xs text-navy-900/55">
        Occurrence-density data is not available for this species yet.
      </p>
    );
  }
  const { minLat, maxLat, minLon, maxLon } = grid.bbox ?? {
    minLat: 45, maxLat: 62, minLon: -16, maxLon: 6,
  };
  const x = (lon: number) => ((lon - minLon) / (maxLon - minLon)) * VB_W;
  const y = (lat: number) => ((maxLat - lat) / (maxLat - minLat)) * VB_H;

  // Cell footprint ~ the grid spacing, so cells tile rather than dot.
  const cw = VB_W / 13;
  const ch = VB_H / 13;

  const label = `Occurrence-density map: ${grid.total} records across ${grid.cells.length} areas in UK and north-east Atlantic waters.`;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="h-auto w-full max-w-[280px] rounded-modal"
        role="img"
        aria-label={label}
      >
        {/* sea */}
        <rect x={0} y={0} width={VB_W} height={VB_H} className="fill-surface-muted" rx={10} />

        {/* graticule */}
        <g stroke="#2B7A78" strokeOpacity={0.22} strokeWidth={0.6}>
          {GRATICULE_LAT.map((lat) => (
            <line key={`la${lat}`} x1={0} x2={VB_W} y1={y(lat)} y2={y(lat)} />
          ))}
          {GRATICULE_LON.map((lon) => (
            <line key={`lo${lon}`} y1={0} y2={VB_H} x1={x(lon)} x2={x(lon)} />
          ))}
        </g>

        {/* density cells (teal, opacity by intensity) */}
        <g>
          {grid.cells.map((c, i) => (
            <rect
              key={i}
              x={x(c.lon) - cw / 2}
              y={y(c.lat) - ch / 2}
              width={cw}
              height={ch}
              rx={2}
              fill="#3AAFA9"
              fillOpacity={0.25 + 0.7 * c.intensity}
            />
          ))}
        </g>

        {/* PEBL filming site marker */}
        <g>
          <circle cx={x(SITE.lon)} cy={y(SITE.lat)} r={4.5} fill="none" stroke="#17252A" strokeWidth={1.6} />
          <circle cx={x(SITE.lon)} cy={y(SITE.lat)} r={1.4} fill="#17252A" />
        </g>

        {/* corner + graticule labels */}
        <g fill="#17252A" fillOpacity={0.55} fontSize={9}>
          {GRATICULE_LAT.map((lat) => (
            <text key={`tla${lat}`} x={3} y={y(lat) - 2}>{fmtLat(lat)}</text>
          ))}
          {GRATICULE_LON.map((lon) => (
            <text key={`tlo${lon}`} x={x(lon) + 2} y={VB_H - 4}>{fmtLon(lon)}</text>
          ))}
        </g>
      </svg>
      <figcaption className="mt-2 flex items-center gap-2 text-[11px] text-navy-900/55">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: "#3AAFA9", opacity: 0.3 }} />
          fewer
          <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: "#3AAFA9" }} />
          more records
        </span>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full ring-1 ring-navy-900" /> PEBL site
        </span>
      </figcaption>
    </figure>
  );
}
