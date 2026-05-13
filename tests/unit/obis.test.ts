import { describe, it, expect, vi } from "vitest";
import {
  buildChecklistUrl,
  bboxWkt,
  fetchObisChecklist,
  type ObisChecklistResponse,
} from "@/lib/obis";

describe("OBIS client", () => {
  describe("bboxWkt", () => {
    it("builds a closed square polygon around (lat, lon)", () => {
      const wkt = bboxWkt(51.06, -4.36, 0.5);
      // Each corner present; closed (first == last)
      expect(wkt).toMatch(/^POLYGON\(\(/);
      expect(wkt).toMatch(/\)\)$/);
      const corners = wkt
        .replace(/^POLYGON\(\(/, "")
        .replace(/\)\)$/, "")
        .split(",")
        .map((s) => s.trim());
      expect(corners.length).toBe(5);
      expect(corners[0]).toBe(corners[4]);
    });
  });

  describe("buildChecklistUrl", () => {
    it("includes only the parameters that are set", () => {
      const u = buildChecklistUrl({});
      expect(u).toContain("/checklist?");
      expect(u).not.toContain("geometry=");
      expect(u).not.toContain("depthfrom=");
    });

    it("includes geometry, depth, dates, and size when provided", () => {
      const u = buildChecklistUrl({
        geometry: "POLYGON((0 0,1 0,1 1,0 1,0 0))",
        depthfrom: 10,
        depthto: 30,
        startdate: "2020-06-01",
        enddate: "2024-08-31",
        size: 500,
      });
      expect(u).toContain("geometry=POLYGON%28%280+0%2C1+0%2C1+1%2C0+1%2C0+0%29%29");
      expect(u).toContain("depthfrom=10");
      expect(u).toContain("depthto=30");
      expect(u).toContain("startdate=2020-06-01");
      expect(u).toContain("enddate=2024-08-31");
      expect(u).toContain("size=500");
    });
  });

  describe("fetchObisChecklist", () => {
    it("returns rows from a single page when results < pageSize", async () => {
      const fakeFetch = vi.fn(async () =>
        new Response(
          JSON.stringify({
            total: 2,
            results: [
              { scientificName: "Pagurus bernhardus", records: 100 },
              { scientificName: "Trisopterus minutus", records: 50 },
            ],
          } satisfies ObisChecklistResponse),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

      const rows = await fetchObisChecklist({ geometry: "POLYGON(())" }, {
        fetchImpl: fakeFetch as unknown as typeof fetch,
        pageSize: 500,
      });
      expect(rows).toHaveLength(2);
      expect(rows[0].scientificName).toBe("Pagurus bernhardus");
      expect(fakeFetch).toHaveBeenCalledTimes(1);
    });

    it("pages through results and stops when a page is short", async () => {
      const pageOne: ObisChecklistResponse = {
        total: 3,
        results: [
          { scientificName: "A", records: 1 },
          { scientificName: "B", records: 2 },
        ],
      };
      const pageTwo: ObisChecklistResponse = {
        total: 3,
        results: [{ scientificName: "C", records: 3 }],
      };
      const fakeFetch = vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(pageOne), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify(pageTwo), { status: 200 }));

      const rows = await fetchObisChecklist({ geometry: "x" }, {
        fetchImpl: fakeFetch as unknown as typeof fetch,
        pageSize: 2,
      });
      expect(rows.map((r) => r.scientificName)).toEqual(["A", "B", "C"]);
      expect(fakeFetch).toHaveBeenCalledTimes(2);
    });

    it("throws on non-OK response", async () => {
      const fakeFetch = vi.fn(async () => new Response("nope", { status: 500, statusText: "Server Error" }));
      await expect(
        fetchObisChecklist({ geometry: "x" }, { fetchImpl: fakeFetch as unknown as typeof fetch }),
      ).rejects.toThrow(/OBIS request failed: 500/);
    });

    it("respects cap", async () => {
      const page: ObisChecklistResponse = {
        total: 100,
        results: Array.from({ length: 50 }, (_, i) => ({ scientificName: `sp${i}`, records: 1 })),
      };
      const fakeFetch = vi.fn(async () => new Response(JSON.stringify(page), { status: 200 }));
      const rows = await fetchObisChecklist({ geometry: "x" }, {
        fetchImpl: fakeFetch as unknown as typeof fetch,
        pageSize: 50,
        cap: 75,
      });
      expect(rows.length).toBe(75);
    });
  });
});
