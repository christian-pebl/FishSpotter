import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTopSpeciesForBucket } from "./obis";
import type { BucketKey } from "./buckets";

const bucket: BucketKey = { latBucket: 50.4, lonBucket: -4.1, depthBucket: 20, month: 6 };

function resp(json: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: async () => json,
  };
}

// Controls what the mocked /occurrence endpoint returns for the next call(s).
// "error" makes the endpoint return a non-ok response.
let occurrence: unknown | "error";

beforeEach(() => {
  occurrence = { results: [] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (urlStr: string) => {
      const url = String(urlStr);
      // Taxon resolution: Actinopterygii + Chondrichthyes → AphiaIDs.
      if (url.includes("/taxon/")) {
        return resp({ results: [{ taxonID: url.includes("Chondrichthyes") ? 2 : 1 }] });
      }
      if (url.includes("/occurrence")) {
        if (occurrence === "error") return resp({}, false, 502);
        return resp(occurrence);
      }
      return resp({}, false, 404);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function rows(spec: Record<string, number>) {
  const out: Array<{ species: string; id: string }> = [];
  let i = 0;
  for (const [name, n] of Object.entries(spec)) {
    for (let k = 0; k < n; k++) out.push({ species: name, id: `id-${i++}` });
  }
  return out;
}

describe("fetchTopSpeciesForBucket", () => {
  it("aggregates counts into ranked species with probabilities (status OK)", async () => {
    // 30 records hits MIN_USEFUL_RECORDS exactly, so no escalation is needed.
    occurrence = { total: 30, results: rows({ "Species A": 20, "Species B": 7, "Species C": 3 }) };
    const r = await fetchTopSpeciesForBucket(bucket);

    if (r.status !== "OK") throw new Error(`expected OK, got ${r.status}`);
    expect(r.totalRecords).toBe(30);
    // Sorted by count descending.
    expect(r.species.map((s) => s.scientificName)).toEqual(["Species A", "Species B", "Species C"]);
    expect(r.species[0].count).toBe(20);
    expect(r.species[0].probability).toBeCloseTo(20 / 30, 6);
    expect(r.species[2].probability).toBeCloseTo(3 / 30, 6);
  });

  it("counts rows that only carry scientificName, and skips nameless rows", async () => {
    const mixed = [
      ...Array.from({ length: 28 }, (_, i) => ({ species: "Species A", id: `a-${i}` })),
      { scientificName: "Species B", id: "b-1" }, // no `species` field → fallback
      { id: "blank-1" }, // no name at all → skipped
      { species: "  ", id: "blank-2" }, // whitespace-only → skipped
    ];
    occurrence = { results: mixed };
    const r = await fetchTopSpeciesForBucket(bucket);

    if (r.status !== "OK") throw new Error(`expected OK, got ${r.status}`);
    expect(r.totalRecords).toBe(29); // 28 + 1, the two blanks dropped
    expect(r.species.find((s) => s.scientificName === "Species B")?.count).toBe(1);
  });

  it("caps the result at the top 10 species", async () => {
    const many: Record<string, number> = {};
    for (let i = 0; i < 15; i++) many[`Species ${i}`] = 3; // 45 records, 15 distinct
    occurrence = { results: rows(many) };
    const r = await fetchTopSpeciesForBucket(bucket);

    expect(r.status).toBe("OK");
    expect(r.species).toHaveLength(10);
  });

  it("returns INSUFFICIENT_DATA when every query comes back empty", async () => {
    occurrence = { results: [] };
    const r = await fetchTopSpeciesForBucket(bucket);

    if (r.status !== "INSUFFICIENT_DATA") throw new Error(`expected INSUFFICIENT_DATA, got ${r.status}`);
    expect(r.totalRecords).toBe(0);
    expect(r.species).toEqual([]);
  });

  it("returns an ERROR result (never throws) when OBIS responds non-ok", async () => {
    occurrence = "error";
    const r = await fetchTopSpeciesForBucket(bucket);

    expect(r.status).toBe("ERROR");
    if (r.status === "ERROR") expect(r.errorMessage).toMatch(/OBIS 502/);
    expect(r.species).toEqual([]);
  });
});
