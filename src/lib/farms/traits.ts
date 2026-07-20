// Vocabulary for the seaweed-farm catalogue, mirroring the pattern in
// src/lib/idguide/traits.ts: `as const` enum arrays are the single source of
// truth for both the TypeScript types and the zod schema in catalogue.ts.

export const FARM_TAG = [
  "lead-farm",
  "community-owned",
  "biostimulants",
  "oyster-restoration",
  "hatchery",
  "crofting",
  "bioplastics-pedigree",
  "imta",
] as const;
export type FarmTag = (typeof FARM_TAG)[number];

export const FARM_COUNTRY = ["Scotland", "England", "Wales"] as const;
export type FarmCountry = (typeof FARM_COUNTRY)[number];

export type FarmLocation = {
  place: string;
  country: FarmCountry;
  lat?: number;
  lon?: number;
};

export type FarmPerson = {
  name: string;
  role?: string;
  quote?: string;
  /** Where the quote came from, so we never blur provenance. */
  quoteSource?: "interview" | "website" | "press";
};

export type FarmInterview = {
  personName: string;
  /** Short, editorially-selected lines pulled from the unedited interview transcript. */
  soundbites: string[];
};

export type FarmImage = {
  /** Public path, e.g. "/farm-media/kaly/hero.webp". Locally hosted, not hotlinked. */
  src: string;
  alt: string;
  orientation?: "landscape" | "portrait";
};

/**
 * Real imagery of the farm and its operations, sourced from the farm's own
 * website (permission granted). Locally hosted under public/farm-media/<slug>/
 * so nothing hotlinks and nothing breaks if the farm redesigns its site.
 */
export type FarmMedia = {
  hero?: FarmImage;
  gallery?: FarmImage[];
  /** Photographer / attribution line shown under the imagery. */
  credit?: string;
};

export type SeaweedFarm = {
  slug: string;
  name: string;
  legalName?: string;
  location: FarmLocation;
  /**
   * Snippet.deployment values (exact DB strings) whose clips were filmed at
   * this farm. Empty when the farm has no live monitoring clips yet: the
   * farm profile still exists, it just isn't linked from any feed card.
   */
  deploymentNames: string[];
  founded: {
    year?: number;
    story: string;
  };
  people: FarmPerson[];
  /** Short mission statement, preferring the farm's own words. */
  mission: string;
  /** The biostimulant / regenerative-agriculture / climate story in plain language. */
  whyItMatters: string;
  scale?: string;
  tags: FarmTag[];
  products: string[];
  website: string;
  social?: {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
    twitter?: string;
  };
  interview?: FarmInterview;
  media?: FarmMedia;
};

export type FarmCatalogue = Record<string, SeaweedFarm>;
