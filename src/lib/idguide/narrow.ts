import {
  BEHAVIOR,
  BODY_SHAPE,
  COLORATION,
  FEATURES,
  FIN_SHAPE,
  HABITAT,
  MARKINGS,
  SIZE,
  type SpeciesCatalogue,
  type SpeciesTraits,
  type TraitSelection,
} from "./traits";

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

const ALLOWED_VALUES: Record<(typeof TRAIT_KEYS)[number], ReadonlySet<string>> = {
  bodyShape: new Set(BODY_SHAPE),
  size: new Set(SIZE),
  coloration: new Set(COLORATION),
  markings: new Set(MARKINGS),
  finShape: new Set(FIN_SHAPE),
  features: new Set(FEATURES),
  behavior: new Set(BEHAVIOR),
  habitat: new Set(HABITAT),
};

function speciesValuesFor(traits: SpeciesTraits, key: keyof TraitSelection): string[] {
  if (key === "size") return [traits.size];
  const value = traits[key];
  return Array.isArray(value) ? value : [];
}

function hasAnyOverlap(speciesValues: string[], required: readonly string[]): boolean {
  return required.some((v) => speciesValues.includes(v));
}

function sanitise(input: unknown): TraitSelection {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  const out: TraitSelection = {};
  for (const key of TRAIT_KEYS) {
    const raw = source[key];
    if (!Array.isArray(raw)) continue;
    const allowed = ALLOWED_VALUES[key];
    const cleaned = raw.filter((v): v is string => typeof v === "string" && allowed.has(v));
    if (cleaned.length > 0) {
      // Cast through unknown to satisfy the per-key value union.
      (out as Record<string, string[]>)[key] = cleaned;
    }
  }
  return out;
}

export function narrowCandidates(args: {
  catalogue: SpeciesCatalogue;
  mustHave?: unknown;
  mustNotHave?: unknown;
  probabilityByScientific?: Record<string, number>;
  limit?: number;
}): Candidate[] {
  const { catalogue, probabilityByScientific = {} } = args;
  const mustHave = sanitise(args.mustHave);
  const mustNotHave = sanitise(args.mustNotHave);
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
    // Require at least half of considered traits to match — anything weaker
    // makes a single overlap enough to surface unrelated species.
    if (considered > 0 && matched * 2 < considered) continue;

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
