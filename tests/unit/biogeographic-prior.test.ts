import { describe, it, expect } from "vitest";
import { BiogeographicPrior } from "@/lib/biogeographic-prior";

describe("BiogeographicPrior", () => {
  it("returns neutral 0.5 + no_data when no checklist supplied", () => {
    const p = new BiogeographicPrior(null);
    expect(p.hasData()).toBe(false);
    const r = p.forScientificName("Pagurus bernhardus");
    expect(r.score).toBe(0.5);
    expect(r.status).toBe("no_data");
  });

  it("handles invalid JSON gracefully", () => {
    const p = new BiogeographicPrior("{not json");
    expect(p.hasData()).toBe(false);
    expect(p.forScientificName("anything").status).toBe("no_data");
  });

  it("returns 'uncommon' (mild penalty) for a species not in the checklist", () => {
    const p = new BiogeographicPrior(JSON.stringify({ "Pagurus bernhardus": 1000 }));
    const r = p.forScientificName("Some unrelated species");
    expect(r.status).toBe("uncommon");
    expect(r.score).toBe(0.4);
  });

  it("returns 'uncommon' when scientificName is null/undefined", () => {
    const p = new BiogeographicPrior(JSON.stringify({ "Pagurus bernhardus": 1000 }));
    expect(p.forScientificName(null).status).toBe("uncommon");
    expect(p.forScientificName(undefined).status).toBe("uncommon");
  });

  it("scores in 0.5–1.0 range for taxa in the checklist", () => {
    const p = new BiogeographicPrior(
      JSON.stringify({
        "Pagurus bernhardus": 1000,
        "Trisopterus minutus": 500,
        "Some rare species": 1,
      }),
    );
    const top = p.forScientificName("Pagurus bernhardus");
    const rare = p.forScientificName("Some rare species");
    expect(top.score).toBeGreaterThan(0.5);
    expect(top.score).toBeLessThanOrEqual(1.0);
    expect(rare.score).toBeGreaterThan(0.5);
    expect(top.score).toBeGreaterThan(rare.score);
  });

  it("labels top-quartile entries as 'common'", () => {
    // 8 species, 75th percentile cut → top 2 are 'common'
    const occ: Record<string, number> = {};
    for (let i = 0; i < 8; i++) occ[`sp${i}`] = (i + 1) * 100;
    const p = new BiogeographicPrior(JSON.stringify(occ));
    expect(p.forScientificName("sp7").status).toBe("common"); // highest
    expect(p.forScientificName("sp0").status).toBe("occasional"); // lowest
  });

  it("returns the OBIS records count when available", () => {
    const p = new BiogeographicPrior(JSON.stringify({ "Pagurus bernhardus": 1247 }));
    const r = p.forScientificName("Pagurus bernhardus");
    expect(r.records).toBe(1247);
  });

  it("monotonic: higher records → ≥ score (within rounding)", () => {
    const p = new BiogeographicPrior(JSON.stringify({ a: 1, b: 10, c: 100, d: 1000 }));
    const sa = p.forScientificName("a").score;
    const sb = p.forScientificName("b").score;
    const sc = p.forScientificName("c").score;
    const sd = p.forScientificName("d").score;
    expect(sa).toBeLessThanOrEqual(sb);
    expect(sb).toBeLessThanOrEqual(sc);
    expect(sc).toBeLessThanOrEqual(sd);
  });
});
