import { describe, it, expect } from "vitest";
import { cellFromFeature, gridFromFeatureCollection, UK_NE_ATLANTIC } from "./distribution";

// A square geohash-ish cell around (lat, lon) of half-size d, as OBIS returns it:
// geometry.coordinates[0] = ring of [lon, lat] corners.
function cell(lat: number, lon: number, n: number, d = 0.5) {
  return {
    properties: { n },
    geometry: {
      type: "Polygon",
      coordinates: [[
        [lon - d, lat - d],
        [lon + d, lat - d],
        [lon + d, lat + d],
        [lon - d, lat + d],
        [lon - d, lat - d],
      ]],
    },
  };
}

describe("cellFromFeature", () => {
  it("returns centroid + count for a valid polygon", () => {
    const c = cellFromFeature(cell(51, -4, 1279));
    expect(c).toEqual({ lat: 51, lon: -4, n: 1279 });
  });
  it("rejects zero/negative/absent counts", () => {
    expect(cellFromFeature(cell(51, -4, 0))).toBeNull();
    expect(cellFromFeature({ properties: {}, geometry: { type: "Polygon", coordinates: [[[0, 0]]] } })).toBeNull();
  });
  it("rejects missing geometry", () => {
    expect(cellFromFeature({ properties: { n: 5 }, geometry: null })).toBeNull();
  });
});

describe("gridFromFeatureCollection", () => {
  it("filters to the bbox, normalises intensity, sorts densest-first", () => {
    const fc = {
      features: [
        cell(51, -4, 100), // in UK bbox
        cell(55, -2, 200), // in UK bbox (densest)
        cell(10, -60, 999), // tropical Atlantic - outside UK bbox, dropped
      ],
    };
    const g = gridFromFeatureCollection(fc, { bbox: UK_NE_ATLANTIC });
    expect(g.cells).toHaveLength(2);
    expect(g.maxN).toBe(200);
    expect(g.total).toBe(300);
    expect(g.cells[0]).toMatchObject({ lat: 55, lon: -2, n: 200, intensity: 1 });
    expect(g.cells[1].intensity).toBeCloseTo(0.5, 5);
  });

  it("returns global cells when bbox is null", () => {
    const fc = { features: [cell(51, -4, 100), cell(10, -60, 50)] };
    const g = gridFromFeatureCollection(fc, { bbox: null });
    expect(g.cells).toHaveLength(2);
    expect(g.total).toBe(150);
  });

  it("handles an empty collection", () => {
    const g = gridFromFeatureCollection({ features: [] });
    expect(g.cells).toHaveLength(0);
    expect(g.maxN).toBe(0);
    expect(g.total).toBe(0);
  });
});
