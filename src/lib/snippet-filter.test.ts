import { describe, it, expect } from "vitest";
import {
  describeSnippetFilter,
  feedUrlForFilter,
  hasSnippetFilter,
  parseSnippetFilter,
  resolveSpeciesFilter,
  snippetFilterWhere,
} from "@/lib/snippet-filter";
import { buildSpeciesIndex } from "@/lib/snippet-species";

const ALIASES = [{ canonical: "Pagurus bernhardus", aliases: ["Hermit Crab"] }];
const INDEX = buildSpeciesIndex(
  [
    { snippetId: "s1", chosenOption: "Hermit Crab", spotters: 3 },
    { snippetId: "s2", chosenOption: "Hermit Crab", spotters: 3 },
  ],
  ALIASES,
);

describe("parseSnippetFilter", () => {
  it("keeps the three narrowing params and ignores the rest", () => {
    expect(
      parseSnippetFilter({ site: "Ramsey", species: "pagurus-bernhardus", sort: "oldest", page: "3" }),
    ).toEqual({ site: "Ramsey", species: "pagurus-bernhardus" });
  });

  it("falls back to no filter on a malformed bag", () => {
    expect(parseSnippetFilter({ site: ["a", "b"] })).toEqual({});
  });
});

describe("resolveSpeciesFilter", () => {
  it("passes a known slug through", () => {
    const f = { species: "pagurus-bernhardus" };
    expect(resolveSpeciesFilter(f, INDEX)).toEqual(f);
  });

  it("drops a slug the index does not know, rather than emptying the grid", () => {
    expect(resolveSpeciesFilter({ species: "gone", site: "Ramsey" }, INDEX)).toEqual({
      site: "Ramsey",
    });
  });
});

describe("snippetFilterWhere", () => {
  it("always applies the blocklist", () => {
    expect(snippetFilterWhere({}, INDEX)).toMatchObject({ excluded: false });
  });

  it("narrows to the clips settled on the species", () => {
    const where = snippetFilterWhere({ species: "pagurus-bernhardus" }, INDEX);
    expect(where.id).toEqual({ in: ["s1", "s2"] });
  });

  it("combines species and site", () => {
    const where = snippetFilterWhere({ species: "pagurus-bernhardus", site: "Ramsey" }, INDEX);
    expect(where.id).toEqual({ in: ["s1", "s2"] });
    expect(where.site).toBe("Ramsey");
  });

  it("still honours the legacy q deep-link from /farms", () => {
    const where = snippetFilterWhere({ q: "Kelp Crofters" }, INDEX);
    expect(where.OR).toHaveLength(3);
  });
});

describe("feedUrlForFilter", () => {
  it("is the bare feed when nothing is filtered", () => {
    expect(feedUrlForFilter({})).toBe("/feed");
    expect(hasSnippetFilter({})).toBe(false);
  });

  it("carries every active filter across to the feed", () => {
    const url = feedUrlForFilter({ species: "pagurus-bernhardus", site: "Ramsey Sound Farm" });
    expect(url).toContain("species=pagurus-bernhardus");
    expect(url).toContain("site=Ramsey+Sound+Farm");
  });
});

describe("describeSnippetFilter", () => {
  it("names the species from the catalogue, then the site", () => {
    expect(
      describeSnippetFilter({ species: "pagurus-bernhardus", site: "Ramsey Sound Farm" }, INDEX),
    ).toEqual(["Hermit Crab", "Ramsey Sound Farm"]);
  });
});
