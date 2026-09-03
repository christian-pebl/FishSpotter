import { describe, expect, it } from "vitest";
import { siteOptionsInScope, speciesOptionsInScope } from "@/lib/archive-facets";
import { buildSpeciesIndex } from "@/lib/snippet-species";

const ALIASES = [
  { canonical: "Pagurus bernhardus", aliases: ["Hermit Crab"] },
  { canonical: "Cancer pagurus", aliases: ["Edible Crab"] },
];

// Three settled clips: two hermit crabs (s1 at Skye, s2 at Dale Bay) and one
// edible crab (s3 at Dale Bay). s4 has no settled species.
const INDEX = buildSpeciesIndex(
  [
    { snippetId: "s1", chosenOption: "Hermit Crab", spotters: 3 },
    { snippetId: "s2", chosenOption: "hermit crab", spotters: 4 },
    { snippetId: "s3", chosenOption: "Edible Crab", spotters: 3 },
    { snippetId: "s4", chosenOption: "Fish", spotters: 3 },
  ],
  ALIASES,
);

describe("siteOptionsInScope", () => {
  it("offers only sites that still hold a clip, alphabetically", () => {
    expect(
      siteOptionsInScope([
        { site: "Skye", clips: 1 },
        { site: "Dale Bay", clips: 2 },
        { site: "Norfolk", clips: 0 },
      ]),
    ).toEqual([
      { site: "Dale Bay", clips: 2 },
      { site: "Skye", clips: 1 },
    ]);
  });

  it("keeps the selected site even when the other filter leaves it empty", () => {
    // Otherwise the dropdown would snap to "All locations" while the URL still
    // says Norfolk, and the reader could not see what to change.
    expect(siteOptionsInScope([{ site: "Skye", clips: 1 }], "Norfolk")).toEqual([
      { site: "Norfolk", clips: 0 },
      { site: "Skye", clips: 1 },
    ]);
    expect(siteOptionsInScope([{ site: "Norfolk", clips: 0 }], "Norfolk")).toEqual([
      { site: "Norfolk", clips: 0 },
    ]);
  });
});

describe("speciesOptionsInScope", () => {
  it("counts each species only over the clips in scope", () => {
    const daleBay = new Set(["s2", "s3", "s4"]);
    expect(speciesOptionsInScope(INDEX, daleBay)).toEqual([
      expect.objectContaining({ slug: "cancer-pagurus", clips: 1 }),
      expect.objectContaining({ slug: "pagurus-bernhardus", clips: 1 }),
    ]);
  });

  it("drops a species with no clip in scope, unless it is the one selected", () => {
    const skye = new Set(["s1"]);
    expect(speciesOptionsInScope(INDEX, skye).map((o) => o.slug)).toEqual(["pagurus-bernhardus"]);
    expect(speciesOptionsInScope(INDEX, skye, "cancer-pagurus")).toEqual([
      expect.objectContaining({ slug: "cancer-pagurus", clips: 0 }),
      expect.objectContaining({ slug: "pagurus-bernhardus", clips: 1 }),
    ]);
  });

  it("reproduces the index's own totals when everything is in scope", () => {
    const all = new Set(["s1", "s2", "s3", "s4"]);
    expect(speciesOptionsInScope(INDEX, all)).toEqual(INDEX.options);
  });
});
