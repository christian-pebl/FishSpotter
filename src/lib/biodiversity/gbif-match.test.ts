import { afterEach, describe, expect, it, vi } from "vitest";
import { normaliseCommonName, resolveCommonName } from "./gbif-match";

function mockFetchOnce(json: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      status,
      statusText: ok ? "OK" : "Error",
      json: async () => json,
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normaliseCommonName", () => {
  it("trims and lowercases", () => {
    expect(normaliseCommonName("  Atlantic Cod  ")).toBe("atlantic cod");
  });
});

describe("resolveCommonName", () => {
  it("returns null for an empty query without fetching", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const r = await resolveCommonName("   ");
    expect(r).toEqual({ scientificName: null, confidence: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("strips authorship from scientificName (the probability-join bug)", async () => {
    // GBIF returns authorship; OBIS rows carry the bare binomial, so the join
    // only works if we strip the "(Linnaeus, 1758)" suffix.
    mockFetchOnce({
      scientificName: "Pollachius pollachius (Linnaeus, 1758)",
      matchType: "EXACT",
    });
    const r = await resolveCommonName("pollack");
    expect(r.scientificName).toBe("Pollachius pollachius");
    expect(r.confidence).toBe("EXACT");
  });

  it("prefers canonicalName over the authored scientificName", async () => {
    mockFetchOnce({
      scientificName: "Gadus morhua Linnaeus, 1758",
      canonicalName: "Gadus morhua",
      matchType: "EXACT",
    });
    const r = await resolveCommonName("cod");
    expect(r.scientificName).toBe("Gadus morhua");
  });

  it("prefers acceptedCanonicalName above all", async () => {
    mockFetchOnce({
      scientificName: "Old name",
      canonicalName: "Old name",
      acceptedCanonicalName: "Accepted name",
      matchType: "EXACT",
    });
    const r = await resolveCommonName("x");
    expect(r.scientificName).toBe("Accepted name");
  });

  it("strips parenthetical authorship from acceptedScientificName (the common fallback)", async () => {
    mockFetchOnce({
      acceptedScientificName: "Cancer pagurus (Linnaeus, 1758)",
      matchType: "FUZZY",
    });
    const r = await resolveCommonName("edible crab");
    expect(r.scientificName).toBe("Cancer pagurus");
    expect(r.confidence).toBe("FUZZY");
  });

  it("documents a limitation: bare (non-parenthetical) authorship only loses the year", async () => {
    // stripAuthorship cuts from the first '(' or ','. A name like
    // "Genus species Author, year" therefore keeps "... Author". This rarely
    // bites in practice because GBIF supplies canonicalName (preferred above),
    // but the test pins the behaviour so a future change is a conscious one.
    mockFetchOnce({
      acceptedScientificName: "Cancer pagurus Linnaeus, 1758",
      matchType: "FUZZY",
    });
    const r = await resolveCommonName("edible crab");
    expect(r.scientificName).toBe("Cancer pagurus Linnaeus");
  });

  it("returns null when matchType is NONE", async () => {
    mockFetchOnce({ matchType: "NONE" });
    const r = await resolveCommonName("zxqwv");
    expect(r).toEqual({ scientificName: null, confidence: "NONE" });
  });

  it("returns null when nothing resolves to a canonical name", async () => {
    mockFetchOnce({ matchType: "HIGHERRANK" });
    const r = await resolveCommonName("fish");
    expect(r.scientificName).toBeNull();
  });

  it("throws on a non-ok HTTP response", async () => {
    mockFetchOnce({}, false, 503);
    await expect(resolveCommonName("cod")).rejects.toThrow(/GBIF match 503/);
  });
});
