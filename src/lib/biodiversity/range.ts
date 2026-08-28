/**
 * Turns an OBIS occurrence grid into a claim a beginner can read: which seas
 * around Britain and Ireland this species is actually found in.
 *
 * WHY THIS EXISTS (and why the old per-cell heatmap was removed)
 * -------------------------------------------------------------
 * OBIS record counts measure SURVEY EFFORT at least as much as they measure
 * animals. Shading individual cells by raw count therefore paints the biggest
 * monitoring programme, not the species. The worst measured case: 51% of every
 * grey seal record in the whole UK / NE-Atlantic window comes from ONE cell off
 * Brest (48.5N, -4.9E, 118,590 records). A per-cell heatmap makes the grey seal
 * look like a Brittany animal; there are ~120,000 of them on Scottish and Farne
 * colonies. Almost every species in the catalogue is Channel-dominated the same
 * way, for the same reason.
 *
 * What IS robust is COVERAGE: the share of a sea region's surveyed cells in
 * which the species turns up at all. A single huge survey inflates one cell's
 * count; it cannot spread the species across a region it does not live in. So
 * this module counts cells, not records, and uses records only as a floor to
 * stop a handful of stray observations reading as "common".
 *
 * The thresholds below were not eyeballed. They were grid-searched against 16
 * species whose real UK ranges are documented and contrasting (northern saithe
 * and lion's mane, southern red mullet and tub gurnard, Channel-only common
 * octopus, ubiquitous shore crab and moon jelly), scored on 55 hand-encoded
 * "must be common here" / "must not be common here" constraints. The chosen
 * rule satisfies all 55 while still producing 12 distinct patterns across the
 * 16 species, i.e. it discriminates rather than calling everything common.
 * The ground truth is standard range knowledge, not an authoritative source, so
 * treat this as a well-calibrated summary rather than a citation.
 */

import type { DistributionGrid } from "./distribution";

export type RegionStatus = "common" | "occasional" | "notRecorded";

export type SeaRegion = {
  id: string;
  /** short label for the map face, where space is tight */
  short: string;
  /** prose label, reads correctly inside a sentence */
  prose: string;
  /**
   * One or more inclusive-min / exclusive-max degree boxes. Most regions are a
   * single box; the North Sea needs a second one to reach down the Belgian and
   * Dutch shelf, which a single rectangle cannot cover without swallowing the
   * Channel. The boxes never overlap each other or another region's.
   */
  boxes: { lat: [number, number]; lon: [number, number] }[];
  /**
   * How many cells in this region have ANY marine animal records at all, from a
   * single OBIS `Animalia` grid pull (30.3M records, 180 cells in-window,
   * measured 2026-08-28). This is the denominator for coverage: it is a
   * data-derived sea-and-survey mask, so a species is judged against where
   * anyone has ever looked, not against raw area.
   */
  capacity: number;
  /** label anchor in open water, for the map */
  labelAt: [number, number];
};

/**
 * Six lay-named seas, drawn as exactly non-overlapping lat/lon boxes so the map
 * can render the very same boxes the classifier used. Cells outside them (Bay
 * of Biscay, mid-Atlantic, Norwegian Sea) are ignored: this is a claim about
 * "around Britain and Ireland", not a world range.
 */
export const SEA_REGIONS: SeaRegion[] = [
  { id: "channel", short: "Channel", prose: "the English Channel", capacity: 18, labelAt: [-3.4, 49.9],
    boxes: [{ lat: [48, 52], lon: [-6, 2.5] }] },
  { id: "celtic", short: "Celtic Sea", prose: "the Celtic Sea", capacity: 21, labelAt: [-9.6, 49.6],
    boxes: [{ lat: [48, 52], lon: [-16, -6] }] },
  { id: "northsea", short: "North Sea", prose: "the North Sea", capacity: 44, labelAt: [2.6, 56.4],
    boxes: [{ lat: [52, 62], lon: [-2.5, 6] }, { lat: [51, 52], lon: [2.5, 6] }] },
  { id: "irishsea", short: "Irish Sea", prose: "the Irish Sea", capacity: 6, labelAt: [-5.3, 54.0],
    boxes: [{ lat: [52, 55.5], lon: [-6.5, -2.5] }] },
  { id: "wireland", short: "W of Ireland", prose: "the waters west of Ireland", capacity: 12, labelAt: [-12.3, 53.8],
    boxes: [{ lat: [52, 55.5], lon: [-16, -6.5] }] },
  { id: "wscotland", short: "W of Scotland", prose: "the waters west of Scotland", capacity: 45, labelAt: [-11.5, 58.0],
    boxes: [{ lat: [55.5, 62], lon: [-16, -2.5] }] },
];

/**
 * Chosen by grid search (see the module comment). Coverage is the real test;
 * the record floor only rejects "common" claims built on a few stray dots.
 * The floor is adaptive because a fixed 800 would erase every genuinely scarce
 * species (common octopus has 157 records in the whole window, and "Channel
 * only" is the true and useful thing to say about it).
 */
const COVERAGE_MIN = 0.25;
const RECORD_FLOOR_ABS = 800;
/**
 * The floor scales off the MEDIAN region's record count, not the species total.
 *
 * The first version used 5% of the total, and that quietly reimported the very
 * effort bias this module exists to defuse: a species whose total is dominated
 * by one survey spike gets a floor set BY that spike, so every honestly-covered
 * region fails it. Thick-lipped grey mullet is the case that caught it. Its
 * North Sea cell holds 10,579 of its 10,899 records (97%), which set a floor of
 * 545, so the Channel (15 of 18 cells covered, 225 records) and the Irish Sea
 * (5 of 6 cells, 38 records) both fell below it, and a common British coastal
 * fish was published as "Scarce everywhere". A median is unmoved by one spike.
 */
const RECORD_FLOOR_SHARE = 0.5;
const RECORD_FLOOR_MIN = 10;

/** Below this the honest answer is "we cannot say", not a confident-looking map. */
const MIN_RECORDS_TO_ASSESS = 20;

export type RegionAssessment = {
  region: SeaRegion;
  status: RegionStatus;
  /** cells in this region holding at least one record */
  cells: number;
  /** raw record count, kept for debugging; deliberately NOT shown to readers */
  records: number;
};

export type RangeSummary = {
  regions: RegionAssessment[];
  /** in-window records across the six regions */
  total: number;
  /** false when OBIS has too little to say anything honest */
  assessable: boolean;
};

function regionFor(lat: number, lon: number): SeaRegion | null {
  return (
    SEA_REGIONS.find((r) =>
      r.boxes.some(
        (b) => lat >= b.lat[0] && lat < b.lat[1] && lon >= b.lon[0] && lon < b.lon[1],
      ),
    ) ?? null
  );
}

/** Pure: occurrence grid -> per-region presence assessment. */
export function summariseRange(grid: DistributionGrid | null): RangeSummary {
  const agg = new Map<string, { cells: number; records: number }>();
  for (const r of SEA_REGIONS) agg.set(r.id, { cells: 0, records: 0 });

  let total = 0;
  for (const c of grid?.cells ?? []) {
    const r = regionFor(c.lat, c.lon);
    if (!r) continue;
    const a = agg.get(r.id);
    if (!a) continue;
    a.cells += 1;
    a.records += c.n;
    total += c.n;
  }

  // Median over regions that hold anything, so one huge survey cannot raise the
  // bar for every other region (see RECORD_FLOOR_SHARE).
  const present = SEA_REGIONS.map((r) => agg.get(r.id)?.records ?? 0).filter((v) => v > 0).sort((a, b) => a - b);
  const median = present.length
    ? present.length % 2
      ? present[(present.length - 1) / 2]
      : (present[present.length / 2 - 1] + present[present.length / 2]) / 2
    : 0;
  const floor = Math.min(RECORD_FLOOR_ABS, Math.max(RECORD_FLOOR_MIN, RECORD_FLOOR_SHARE * median));

  const regions: RegionAssessment[] = SEA_REGIONS.map((region) => {
    const a = agg.get(region.id) ?? { cells: 0, records: 0 };
    let status: RegionStatus;
    if (a.cells === 0) {
      status = "notRecorded";
    } else {
      const coverage = region.capacity > 0 ? a.cells / region.capacity : 0;
      status = coverage >= COVERAGE_MIN && a.records >= floor ? "common" : "occasional";
    }
    return { region, status, cells: a.cells, records: a.records };
  });

  const assessable = total >= MIN_RECORDS_TO_ASSESS && regions.some((r) => r.cells > 0);
  return { regions, total, assessable };
}

/** Plain list: "a", "a and b", "a, b and c". */
function joinProse(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * The headline claim, in plain words. This is the thing a reader actually takes
 * away; the map underneath is supporting evidence for it, which is the opposite
 * of the old design where the picture had to make the claim on its own.
 *
 * Deliberately a small set of fixed phrasings rather than free text, so the
 * whole vocabulary can be reviewed once.
 */
export function rangeSentence(summary: RangeSummary): string {
  if (!summary.assessable) {
    return "There are not enough survey records yet to say where this one turns up.";
  }
  const common = summary.regions.filter((r) => r.status === "common");
  const absent = summary.regions.filter((r) => r.status === "notRecorded");
  const absentClause = absent.length
    ? ` It has not been recorded in ${joinProse(absent.map((r) => r.region.prose))}.`
    : "";

  if (common.length === SEA_REGIONS.length) {
    return "Found all around Britain and Ireland, so you have a chance of seeing it anywhere on the coast.";
  }
  if (common.length === 0) {
    return `Scarce everywhere, with only scattered records around Britain and Ireland.${absentClause}`;
  }
  if (common.length >= 4) {
    // Naming five common regions is a wall of text. When a species is nearly
    // everywhere, the informative part is the exceptions, so name those.
    const lessOften = summary.regions.filter((r) => r.status === "occasional");
    const exceptClause = lessOften.length
      ? `, though less often in ${joinProse(lessOften.map((r) => r.region.prose))}`
      : "";
    return `Found around most of Britain and Ireland${exceptClause}.${absentClause}`;
  }
  return `Mostly seen in ${joinProse(common.map((r) => r.region.prose))}, and only here and there elsewhere.${absentClause}`;
}
