import speciesImagesManifest from "@/data/species-images.json";

type ManifestSpecies = Record<string, { fetchName?: string }>;

const SPECIES = (speciesImagesManifest as unknown as { species: ManifestSpecies }).species;

/**
 * The taxon name to send to an external biodiversity API (iNaturalist,
 * Wikimedia) for a given catalogue key.
 *
 * Usually the key itself. Some catalogue entries are deliberately GROUP-level
 * because the members cannot be told apart on a video clip: "Majoidea" covers
 * the UK spider crabs (great / spiny / scorpion). Querying an external API at
 * that rank returns the whole superfamily including non-UK members (Japanese
 * spider crab, Libinia), and iNaturalist holds no research-grade observations
 * at superfamily rank at all, so the pull comes back empty. The manifest pins
 * those entries to a representative species via `fetchName`; rows are still
 * stored under the catalogue key.
 */
export function fetchNameFor(scientificName: string): string {
  return SPECIES[scientificName]?.fetchName ?? scientificName;
}
