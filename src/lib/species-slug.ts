import { CATALOGUE } from "@/lib/idguide/catalogue";

/**
 * URL slug for a species profile, derived from its scientific binomial.
 * "Labrus mixtus" -> "labrus-mixtus". Stable + reversible against the catalogue.
 */
export function speciesSlug(scientificName: string): string {
  return scientificName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type ResolvedSpecies = {
  scientificName: string;
  traits: (typeof CATALOGUE)[string];
};

/** Resolve a slug back to its catalogue entry, or null if unknown. */
export function resolveSpeciesSlug(slug: string): ResolvedSpecies | null {
  const target = slug.toLowerCase();
  for (const [scientificName, traits] of Object.entries(CATALOGUE)) {
    if (speciesSlug(scientificName) === target) return { scientificName, traits };
  }
  return null;
}

/** Every species slug (for generateStaticParams / index pages). */
export function allSpeciesSlugs(): string[] {
  return Object.keys(CATALOGUE).map(speciesSlug);
}
