import type { SpeciesCatalogue, SpeciesTraits, TraitSelection } from "./traits";

export type Candidate = {
  scientificName: string;
  commonName: string;
  matchedTraits: number;
  totalTraitsConsidered: number;
  ecologicalProbability: number; // 0..1, 0 if unknown
};

const TRAIT_KEYS = [
  "bodyShape",
  "size",
  "coloration",
  "markings",
  "finShape",
  "features",
  "behavior",
  "habitat",
] as const satisfies ReadonlyArray<keyof TraitSelection>;

function speciesValuesFor(traits: SpeciesTraits, key: keyof TraitSelection): string[] {
  if (key === "size") return [traits.size];
  const value = traits[key];
  return Array.isArray(value) ? value : [];
}

function hasAnyOverlap(speciesValues: string[], required: readonly string[]): boolean {
  return required.some((v) => speciesValues.includes(v));
}

export function narrowCandidates(args: {
  catalogue: SpeciesCatalogue;
  mustHave?: TraitSelection;
  mustNotHave?: TraitSelection;
  probabilityByScientific?: Record<string, number>;
  limit?: number;
}): Candidate[] {
  const { catalogue, mustHave = {}, mustNotHave = {}, probabilityByScientific = {} } = args;
  const limit = args.limit ?? 12;

  const out: Candidate[] = [];

  for (const [scientificName, traits] of Object.entries(catalogue)) {
    let matched = 0;
    let considered = 0;
    let excluded = false;

    for (const key of TRAIT_KEYS) {
      const required = mustHave[key];
      const forbidden = mustNotHave[key];
      const speciesVals = speciesValuesFor(traits, key);

      if (required && required.length > 0) {
        considered++;
        if (hasAnyOverlap(speciesVals, required)) {
          matched++;
        }
      }

      if (forbidden && forbidden.length > 0 && hasAnyOverlap(speciesVals, forbidden)) {
        excluded = true;
        break;
      }
    }

    if (excluded) continue;
    // If any must-have was specified, require >= half of considered traits to match.
    if (considered > 0 && matched === 0) continue;

    out.push({
      scientificName,
      commonName: traits.commonName,
      matchedTraits: matched,
      totalTraitsConsidered: considered,
      ecologicalProbability: probabilityByScientific[scientificName] ?? 0,
    });
  }

  out.sort((a, b) => {
    if (b.matchedTraits !== a.matchedTraits) return b.matchedTraits - a.matchedTraits;
    if (b.ecologicalProbability !== a.ecologicalProbability) {
      return b.ecologicalProbability - a.ecologicalProbability;
    }
    return a.commonName.localeCompare(b.commonName);
  });

  return out.slice(0, limit);
}
