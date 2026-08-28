import type { DistributionGrid } from "@/lib/biodiversity/distribution";
import { summariseRange, rangeSentence, type RegionStatus } from "@/lib/biodiversity/range";
import { COASTLINE_RINGS } from "@/data/ne-atlantic-coastline";
import { FARMS } from "@/lib/farms/catalogue";

/**
 * "Where you'd find it": a plain-English range sentence, with a six-region
 * presence map underneath as its supporting evidence.
 *
 * This replaced a per-cell OBIS density heatmap, which failed in two ways at
 * once. It was unreadable (counts are heavy-tailed, so 93-97% of cells rendered
 * at the minimum opacity and the "fewer / more records" legend described a
 * gradient that did not exist on screen), and where it did show a hotspot the
 * hotspot was survey effort rather than the animal: 51% of every grey seal
 * record in-window came from a single cell off Brest. See `range.ts` for why
 * region coverage is the honest signal and raw cell density is not.
 *
 * Still pure SVG, no JS, no map library.
 */

// viewBox width carries the cos(midLat) correction for the window below, so a
// degree of longitude is not drawn as wide as a degree of latitude at 54N.
const VB_W = 290;
const VB_H = 340;

// The fixed geographic window. MUST match the window the coastline was
// generated for (see the header of ne-atlantic-coastline.ts): land, region
// boxes and site pins all share this one projection.
const VIEW = { minLat: 47, maxLat: 62, minLon: -16, maxLon: 6 };

// Three steps on a LIGHTNESS ramp, not a hue ramp, so the map still reads for
// colourblind viewers (house rule). Deliberately only three: a reader can count
// three shades against a legend, but cannot read a continuous opacity scale.
const FILL: Record<RegionStatus, { fill: string; opacity: number }> = {
  common: { fill: "#2B7A78", opacity: 0.82 },
  occasional: { fill: "#3AAFA9", opacity: 0.3 },
  notRecorded: { fill: "#8C9EA0", opacity: 0.14 },
};

const STATUS_LABEL: Record<RegionStatus, string> = {
  common: "Often seen",
  occasional: "Now and then",
  notRecorded: "Not recorded",
};

// PEBL's filming sites, from the farm catalogue rather than a hardcoded point
// (the map previously marked one North Devon spot and called it "the PEBL
// filming site"; there are six, from Norfolk to Skye).
const SITES = Object.values(FARMS)
  .filter((f) => typeof f.location.lat === "number" && typeof f.location.lon === "number")
  .map((f) => ({ name: f.name, lat: f.location.lat as number, lon: f.location.lon as number }));

export function DistributionMap({ grid }: { grid: DistributionGrid | null }) {
  const summary = summariseRange(grid);
  const sentence = rangeSentence(summary);

  const x = (lon: number) => ((lon - VIEW.minLon) / (VIEW.maxLon - VIEW.minLon)) * VB_W;
  const y = (lat: number) => ((VIEW.maxLat - lat) / (VIEW.maxLat - VIEW.minLat)) * VB_H;

  const landPath = (ring: [number, number][]) =>
    ring.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(" ") + " Z";

  // Only show the legend steps this species actually uses, so a species found
  // everywhere does not carry a "Not recorded" key it never demonstrates.
  const usedStatuses = (["common", "occasional", "notRecorded"] as RegionStatus[]).filter((s) =>
    summary.regions.some((r) => r.status === s),
  );

  const altText = summary.assessable
    ? `${sentence} Map of the seas around Britain and Ireland, shaded by how often this species is recorded in each: ${summary.regions
        .map((r) => `${r.region.short}, ${STATUS_LABEL[r.status].toLowerCase()}`)
        .join("; ")}.`
    : "Map of the seas around Britain and Ireland. There are not enough survey records for this species to shade them.";

  return (
    <figure className="m-0">
      {/* The sentence IS the claim. The map below is its evidence, not a puzzle
          the reader has to solve to find out what the page is telling them. */}
      <p className="mb-3 text-sm leading-relaxed text-navy-900">{sentence}</p>

      <div className="flex justify-center">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="h-auto w-full max-w-[300px] rounded-modal"
          role="img"
          aria-label={altText}
        >
          <defs>
            <clipPath id="rangemap-frame">
              <rect x={0} y={0} width={VB_W} height={VB_H} rx={10} />
            </clipPath>
          </defs>

          <rect x={0} y={0} width={VB_W} height={VB_H} rx={10} fill="#EAF4F5" />

          <g clipPath="url(#rangemap-frame)">
            {/* Sea regions, drawn as the exact boxes the classifier used. */}
            {summary.assessable &&
              summary.regions.flatMap(({ region, status }) => {
                const style = FILL[status];
                return region.boxes.map((b, bi) => (
                  <rect
                    key={`${region.id}-${bi}`}
                    x={x(b.lon[0])}
                    y={y(b.lat[1])}
                    width={x(b.lon[1]) - x(b.lon[0])}
                    height={y(b.lat[0]) - y(b.lat[1])}
                    fill={style.fill}
                    fillOpacity={style.opacity}
                  />
                ));
              })}

            {/* Land LAST of the fills, so the sea shading never prints over
                Britain (the old map drew density cells on top of the coast). */}
            {COASTLINE_RINGS.map((ring, i) => (
              <path
                key={i}
                d={landPath(ring)}
                fill="#F2EEE2"
                stroke="#9FB5B3"
                strokeWidth={0.9}
                strokeLinejoin="round"
              />
            ))}

            {/* Region names, each with a halo (paintOrder puts the stroke behind
                the glyphs) so a name stays readable whether it lands on pale sea
                or on the darkest "often seen" fill. */}
            <g fontSize={8.5} fontWeight={600} textAnchor="middle">
              {summary.regions.map(({ region }) => (
                <text
                  key={region.id}
                  x={x(region.labelAt[0])}
                  y={y(region.labelAt[1])}
                  fill="#17252A"
                  stroke="#EAF4F5"
                  strokeWidth={2.2}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                >
                  {region.short}
                </text>
              ))}
            </g>

            {/* PEBL filming sites. */}
            <g>
              {SITES.map((s) => (
                <g key={s.name}>
                  <circle cx={x(s.lon)} cy={y(s.lat)} r={3.6} fill="#FFFFFF" fillOpacity={0.9} />
                  <circle cx={x(s.lon)} cy={y(s.lat)} r={3.6} fill="none" stroke="#17252A" strokeWidth={1.4} />
                </g>
              ))}
            </g>
          </g>
        </svg>
      </div>

      <figcaption className="mt-2.5 text-[11px] leading-relaxed text-navy-900/55">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {usedStatuses.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: FILL[s].fill, opacity: FILL[s].opacity }}
              />
              {STATUS_LABEL[s]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-white ring-1 ring-navy-900" />
            Where PEBL films
          </span>
        </span>
        <span className="mt-1.5 block">
          Based on marine survey records (OBIS). Blank seas can mean nobody has
          looked there, not that the animal is absent.
        </span>
      </figcaption>
    </figure>
  );
}
