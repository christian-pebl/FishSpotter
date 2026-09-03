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

const SITE = "Dale Bay, Pembrokeshire, Wales, UK";

describe("parseSnippetFilter", () => {
  it("keeps the three narrowing params and ignores the rest", () => {
    expect(
      parseSnippetFilter({ site: "Ramsey", species: "pagurus-bernhardus", sort: "oldest", page: "3" }),
    ).toEqual({ site: "Ramsey", species: "pagurus-bernhardus" });
  });

  // The regression. A GET form submits every control, blanks included, so this
  // is exactly what the archive's Apply button sent for "a location, all
  // species". Live on 3 Sep 2026 it served the whole archive.
  it("reads what the filter form actually submits: a blank control means unset", () => {
    expect(parseSnippetFilter({ species: "", site: SITE, sort: "newest" })).toEqual({ site: SITE });
    expect(parseSnippetFilter({ species: "cancer-pagurus", site: "", sort: "newest" })).toEqual({
      species: "cancer-pagurus",
    });
    expect(parseSnippetFilter({ species: "", site: "", q: "", sort: "" })).toEqual({});
  });

  it("drops only the field that is malformed, never the whole filter", () => {
    expect(parseSnippetFilter({ site: ["a", "b"], species: "pagurus-bernhardus" })).toEqual({
      species: "pagurus-bernhardus",
    });
    expect(parseSnippetFilter({ q: "x".repeat(61), site: SITE })).toEqual({ site: SITE });
  });

  it("trims whitespace, so a hand-typed link still matches the site exactly", () => {
    expect(parseSnippetFilter({ site: `  ${SITE}  ` })).toEqual({ site: SITE });
    expect(parseSnippetFilter({ site: "   " })).toEqual({});
  });

  it("falls back to no filter on a malformed bag", () => {
    expect(parseSnippetFilter({ site: ["a", "b"] })).toEqual({});
  });

  it("accepts every location name the archive currently holds", () => {
    // The longest live site name is 46 characters; the old 60 cap was tighter
    // than it looked once a country or a lake name joins the list.
    const long = "Veerse Meer (Lake Veere), Zeeland, Netherlands";
    expect(parseSnippetFilter({ site: long })).toEqual({ site: long });
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

  it("narrows to one site by exact name", () => {
    expect(snippetFilterWhere({ site: SITE }, INDEX).site).toBe(SITE);
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

  it("is the same where-clause from the form's params as from a clean link", () => {
    const clean = snippetFilterWhere(parseSnippetFilter({ site: SITE }), INDEX);
    const form = snippetFilterWhere(
      parseSnippetFilter({ species: "", site: SITE, sort: "newest" }),
      INDEX,
    );
    expect(form).toEqual(clean);
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

  it("launches the feed on the set the form submitted, not the whole archive", () => {
    const filter = parseSnippetFilter({ species: "", site: SITE, sort: "newest" });
    expect(hasSnippetFilter(filter)).toBe(true);
    expect(feedUrlForFilter(filter)).toBe(
      "/feed?site=Dale+Bay%2C+Pembrokeshire%2C+Wales%2C+UK",
    );
  });
});

describe("describeSnippetFilter", () => {
  it("names the species from the catalogue, then the site", () => {
    expect(
      describeSnippetFilter({ species: "pagurus-bernhardus", site: "Ramsey Sound Farm" }, INDEX),
    ).toEqual(["Hermit Crab", "Ramsey Sound Farm"]);
  });

  it("prints a farm site with its farm's name, like every other surface", () => {
    expect(
      describeSnippetFilter({ site: "Ramsey Sound, Pembrokeshire, Wales, UK" }, INDEX),
    ).toEqual(["Câr-y-Môr · Ramsey Sound, Pembrokeshire, Wales, UK"]);
  });
});
