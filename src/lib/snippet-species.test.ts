import { describe, it, expect } from "vitest";
import { buildSpeciesIndex, snippetIdsForSpecies, type SpeciesTallyRow } from "@/lib/snippet-species";
import { CONSENSUS_THRESHOLD_USERS } from "@/lib/pebbles";

// Minimal alias set: the builder only needs the catalogue links it resolves
// against. These are real catalogue binomials + common names.
const ALIASES = [
  { canonical: "Pagurus bernhardus", aliases: ["Hermit Crab"] },
  { canonical: "Callionymus lyra", aliases: ["Dragonet"] },
  { canonical: "Necora puber", aliases: ["Velvet Swimming Crab"] },
];

function row(snippetId: string, chosenOption: string, spotters: number): SpeciesTallyRow {
  return { snippetId, chosenOption, spotters };
}

describe("buildSpeciesIndex", () => {
  it("settles a clip on the option the most spotters agree on", () => {
    const index = buildSpeciesIndex(
      [row("s1", "Hermit Crab", 4), row("s1", "Velvet Swimming Crab", 1)],
      ALIASES,
    );
    expect(index.options.map((o) => o.slug)).toEqual(["pagurus-bernhardus"]);
    expect(snippetIdsForSpecies(index, "pagurus-bernhardus")).toEqual(["s1"]);
  });

  it("leaves a clip out until the consensus threshold is reached", () => {
    const under = CONSENSUS_THRESHOLD_USERS - 1;
    const index = buildSpeciesIndex([row("s1", "Hermit Crab", under)], ALIASES);
    expect(index.options).toEqual([]);

    const at = buildSpeciesIndex(
      [row("s1", "Hermit Crab", CONSENSUS_THRESHOLD_USERS)],
      ALIASES,
    );
    expect(at.options).toHaveLength(1);
  });

  it("collapses surface forms onto one camp before counting spotters", () => {
    // Three different typings of the same animal, one spotter each. Counted
    // separately none reaches the threshold; counted as one camp they do.
    const index = buildSpeciesIndex(
      [row("s1", "Hermit crab", 1), row("s1", "hermit crabs", 1), row("s1", "HERMIT CRAB", 1)],
      ALIASES,
    );
    expect(index.options.map((o) => o.slug)).toEqual(["pagurus-bernhardus"]);
  });

  it("labels from the catalogue, not from whichever surface form won", () => {
    const index = buildSpeciesIndex([row("s1", "hermit crabs", 3)], ALIASES);
    expect(index.options[0].commonName).toBe("Hermit Crab");
    expect(index.options[0].scientificName).toBe("Pagurus bernhardus");
  });

  it("drops a settled leader that is a shape word, not a species", () => {
    // "flatfish" is a real consensus in the live DB. It is deliberately not an
    // alias canonical, so it must not become an option in a Species filter.
    const index = buildSpeciesIndex(
      [row("s1", "Flatfish", 5), row("s2", "Dragonet", 3)],
      ALIASES,
    );
    expect(index.options.map((o) => o.slug)).toEqual(["callionymus-lyra"]);
    expect(index.snippetIdsBySlug.has("s1")).toBe(false);
  });

  it("counts clips per species and sorts options by common name", () => {
    const index = buildSpeciesIndex(
      [
        row("s1", "Velvet Swimming Crab", 3),
        row("s2", "Hermit Crab", 3),
        row("s3", "Hermit Crab", 4),
        row("s4", "Dragonet", 3),
      ],
      ALIASES,
    );
    expect(index.options.map((o) => [o.commonName, o.clips])).toEqual([
      ["Dragonet", 1],
      ["Hermit Crab", 2],
      ["Velvet Swimming Crab", 1],
    ]);
  });

  it("ignores blank and zero-spotter rows", () => {
    const index = buildSpeciesIndex(
      [row("s1", "   ", 9), row("s1", "Hermit Crab", 0), row("s1", "Dragonet", 3)],
      ALIASES,
    );
    expect(index.options.map((o) => o.slug)).toEqual(["callionymus-lyra"]);
  });

  it("breaks a tie on the normalised name, so the winner is stable", () => {
    const a = buildSpeciesIndex(
      [row("s1", "Hermit Crab", 3), row("s1", "Dragonet", 3)],
      ALIASES,
    );
    const b = buildSpeciesIndex(
      [row("s1", "Dragonet", 3), row("s1", "Hermit Crab", 3)],
      ALIASES,
    );
    expect(a.options.map((o) => o.slug)).toEqual(b.options.map((o) => o.slug));
    expect(a.options.map((o) => o.slug)).toEqual(["callionymus-lyra"]);
  });

  it("returns an empty list for an unknown slug", () => {
    const index = buildSpeciesIndex([row("s1", "Hermit Crab", 3)], ALIASES);
    expect(snippetIdsForSpecies(index, "not-a-species")).toEqual([]);
  });
});
