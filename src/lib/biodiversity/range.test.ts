import { describe, it, expect } from "vitest";
import { summariseRange, rangeSentence, SEA_REGIONS } from "./range";
import type { DistributionGrid } from "./distribution";

/** Build a grid from [lat, lon, n] triples. `intensity` is unused by range.ts. */
function grid(cells: [number, number, number][]): DistributionGrid {
  const maxN = cells.reduce((m, c) => Math.max(m, c[2]), 0);
  return {
    precision: 3,
    bbox: { minLat: 45, maxLat: 62, minLon: -16, maxLon: 6 },
    cells: cells.map(([lat, lon, n]) => ({ lat, lon, n, intensity: maxN ? n / maxN : 0 })),
    total: cells.reduce((s, c) => s + c[2], 0),
    maxN,
  };
}

/** `count` distinct cells inside a region, each carrying `n` records. */
function fill(regionId: string, count: number, n: number): [number, number, number][] {
  const r = SEA_REGIONS.find((x) => x.id === regionId);
  if (!r) throw new Error(`no region ${regionId}`);
  const out: [number, number, number][] = [];
  // Walk the region's first box on a fine step so every cell is a distinct point.
  const b = r.boxes[0];
  const latStep = (b.lat[1] - b.lat[0]) / (count + 1);
  const lonStep = (b.lon[1] - b.lon[0]) / (count + 1);
  for (let i = 1; i <= count; i++) {
    out.push([b.lat[0] + latStep * i, b.lon[0] + lonStep * i, n]);
  }
  return out;
}

const statusOf = (g: DistributionGrid, id: string) =>
  summariseRange(g).regions.find((r) => r.region.id === id)?.status;

describe("summariseRange", () => {
  it("assigns each cell to exactly one region (the boxes tile without overlap)", () => {
    // One cell per region, well inside each box.
    const cells = SEA_REGIONS.flatMap((r) => fill(r.id, 1, 50));
    const s = summariseRange(grid(cells));
    expect(s.regions.filter((r) => r.cells === 1)).toHaveLength(SEA_REGIONS.length);
    expect(s.regions.reduce((n, r) => n + r.cells, 0)).toBe(SEA_REGIONS.length);
  });

  it("calls a region notRecorded only when it holds zero cells", () => {
    const s = summariseRange(grid(fill("channel", 10, 500)));
    expect(statusOf(grid(fill("channel", 10, 500)), "channel")).not.toBe("notRecorded");
    expect(s.regions.filter((r) => r.status === "notRecorded")).toHaveLength(SEA_REGIONS.length - 1);
  });

  it("needs coverage, not just records, to call a region common", () => {
    // A single cell holding a huge count is a survey programme, not a range.
    expect(statusOf(grid(fill("northsea", 1, 100_000)), "northsea")).toBe("occasional");
    // Spread across the region at the same total, it is a real presence.
    expect(statusOf(grid(fill("northsea", 20, 5_000)), "northsea")).toBe("common");
  });

  it("does not let a handful of stray records read as common", () => {
    // The Channel has good coverage (6 of its 18 cells) but trivial counts,
    // against a species that is genuinely abundant elsewhere. Coverage alone
    // would call it common; the record floor correctly says otherwise.
    const cells = [...fill("wscotland", 30, 400), ...fill("channel", 6, 2)];
    expect(statusOf(grid(cells), "wscotland")).toBe("common");
    expect(statusOf(grid(cells), "channel")).toBe("occasional");
  });

  it("keeps signal for genuinely scarce species via the adaptive floor", () => {
    // The whole species is ~130 records, so a fixed 800-record floor would erase
    // it. Concentrated in the Channel, "Channel only" is the true claim.
    const cells = [...fill("channel", 8, 15), ...fill("northsea", 2, 3)];
    expect(statusOf(grid(cells), "channel")).toBe("common");
    expect(statusOf(grid(cells), "northsea")).toBe("occasional");
  });

  /**
   * REGRESSION. Thick-lipped grey mullet shipped as "Scarce everywhere", which
   * is false: it is a common British coastal fish. Its North Sea cell holds 97%
   * of its records, and the old floor (5% of the species TOTAL) was therefore
   * set by that one spike at 545, which the well-covered Channel (225 records
   * over 15 of 18 cells) and Irish Sea (38 over 5 of 6) both failed. A floor
   * built on the median region is immune to the spike.
   */
  it("does not let one survey spike raise the floor for every other region", () => {
    // Thick-lipped grey mullet's real measured shape, 28 Aug 2026.
    const cells: [number, number, number][] = [
      ...fill("northsea", 7, 1511), // 10,577 records over 7 of 44 cells: the spike
      ...fill("channel", 15, 15), //     225 records over 15 of 18 cells
      ...fill("irishsea", 5, 8), //       40 records over 5 of 6 cells
      ...fill("wscotland", 4, 11), //     44 records over 4 of 45 cells
      ...fill("celtic", 4, 2), //          8 records over 4 of 21 cells
      ...fill("wireland", 3, 2), //        6 records over 3 of 12 cells
    ];
    const s = summariseRange(grid(cells));
    expect(statusOf(grid(cells), "channel")).toBe("common");
    expect(statusOf(grid(cells), "irishsea")).toBe("common");
    // The spike itself has poor coverage, so it is not a range claim.
    expect(statusOf(grid(cells), "northsea")).toBe("occasional");
    expect(rangeSentence(s)).not.toMatch(/Scarce everywhere/);
  });

  it("refuses to assess when OBIS has almost nothing", () => {
    const s = summariseRange(grid(fill("celtic", 1, 3)));
    expect(s.assessable).toBe(false);
    expect(rangeSentence(s)).toMatch(/not enough survey records/i);
  });

  it("handles a null grid", () => {
    const s = summariseRange(null);
    expect(s.assessable).toBe(false);
    expect(s.total).toBe(0);
    expect(s.regions).toHaveLength(SEA_REGIONS.length);
  });

  /**
   * The Belgian / Dutch shelf sits south of 52N and east of 2.5E, which a single
   * North Sea rectangle cannot reach without also swallowing the Channel. It was
   * silently dropped until the North Sea gained a second box; the gap showed up
   * as an unshaded block off the Low Countries when the map was first rendered.
   */
  it("counts the southern North Sea off the Low Countries", () => {
    const s = summariseRange(grid([[51.3, 3.5, 900], [51.3, 4.9, 900]]));
    const ns = s.regions.find((r) => r.region.id === "northsea");
    expect(ns?.cells).toBe(2);
    expect(s.total).toBe(1800);
  });

  it("never puts one cell in two regions", () => {
    // Sample the whole window on a fine grid; every point matches 0 or 1 region.
    for (let lat = 47.25; lat < 62; lat += 0.5) {
      for (let lon = -15.75; lon < 6; lon += 0.5) {
        const hits = SEA_REGIONS.filter((r) =>
          r.boxes.some(
            (b) => lat >= b.lat[0] && lat < b.lat[1] && lon >= b.lon[0] && lon < b.lon[1],
          ),
        );
        expect(hits.length, `${lat},${lon} matched ${hits.map((h) => h.id).join("+")}`).toBeLessThan(2);
      }
    }
  });

  it("ignores cells outside the six regions (Biscay, mid-Atlantic)", () => {
    const s = summariseRange(grid([[46, -4, 9999], [50, -30, 9999]]));
    expect(s.total).toBe(0);
    expect(s.regions.every((r) => r.cells === 0)).toBe(true);
  });

  /**
   * REGRESSION, and the reason this module exists. The grey seal's single
   * densest cell (48.5N, -4.9E, 118,590 records, off Brest) held 51% of every
   * in-window record, so the old per-cell heatmap drew its darkest square in
   * Brittany. Coverage must put the seal in Scottish waters instead.
   */
  it("does not let one huge Brittany survey cell define the grey seal's range", () => {
    const cells: [number, number, number][] = [
      [48.5, -4.9, 118_590], // the Iroise monitoring spike, one cell
      ...fill("wscotland", 34, 200), // real spread across Scottish waters
      ...fill("northsea", 22, 650),
    ];
    const s = summariseRange(grid(cells));
    expect(statusOf(grid(cells), "wscotland")).toBe("common");
    expect(statusOf(grid(cells), "northsea")).toBe("common");
    // The Brittany cell alone must not carry the Channel.
    expect(statusOf(grid(cells), "channel")).toBe("occasional");
    expect(rangeSentence(s)).not.toMatch(/English Channel/);
  });
});

describe("rangeSentence", () => {
  it("says 'all around' when every region is common", () => {
    const cells = SEA_REGIONS.flatMap((r) => fill(r.id, Math.ceil(r.capacity * 0.6), 500));
    expect(rangeSentence(summariseRange(grid(cells)))).toMatch(/all around Britain and Ireland/);
  });

  it("names the regions when a species is localised", () => {
    const cells = [...fill("channel", 10, 400), ...fill("celtic", 12, 400), ...fill("northsea", 2, 20)];
    const sentence = rangeSentence(summariseRange(grid(cells)));
    expect(sentence).toMatch(/Mostly seen in the English Channel and the Celtic Sea/);
  });

  it("calls out seas with no records at all", () => {
    const cells = [...fill("channel", 10, 400), ...fill("celtic", 12, 400)];
    expect(rangeSentence(summariseRange(grid(cells)))).toMatch(
      /has not been recorded in .*the North Sea/,
    );
  });

  it("lists prose regions without an Oxford comma", () => {
    const cells = [...fill("channel", 10, 300), ...fill("celtic", 12, 300), ...fill("irishsea", 4, 300)];
    const sentence = rangeSentence(summariseRange(grid(cells)));
    expect(sentence).toContain("the English Channel, the Celtic Sea and the Irish Sea");
  });
});
