import { z } from "zod";
import seaweedFarmsData from "@/data/seaweed-farms.json";
import { FARM_TAG, FARM_COUNTRY, type FarmCatalogue } from "./traits";

// Single source of truth for loading + validating the seaweed-farm catalogue.
// Mirrors src/lib/idguide/catalogue.ts: one schema built from the `as const`
// enum arrays in traits.ts, one validation point, one typed export. Import
// FARMS from here, never the raw JSON (house convention, see CLAUDE.md).

const farmPersonSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1).optional(),
  quote: z.string().min(1).optional(),
  quoteSource: z.enum(["interview", "website", "press"]).optional(),
});

const farmSchema = z
  .object({
    slug: z.string().min(1),
    name: z.string().min(1),
    legalName: z.string().min(1).optional(),
    location: z.object({
      place: z.string().min(1),
      country: z.enum(FARM_COUNTRY),
      lat: z.number().optional(),
      lon: z.number().optional(),
    }),
    deploymentNames: z.array(z.string().min(1)),
    founded: z.object({
      year: z.number().int().min(1900).max(2100).optional(),
      story: z.string().min(1),
    }),
    people: z.array(farmPersonSchema),
    mission: z.string().min(1),
    whyItMatters: z.string().min(1),
    scale: z.string().min(1).optional(),
    tags: z.array(z.enum(FARM_TAG)),
    products: z.array(z.string().min(1)),
    website: z.string().url(),
    social: z
      .object({
        instagram: z.string().url().optional(),
        facebook: z.string().url().optional(),
        linkedin: z.string().url().optional(),
        twitter: z.string().url().optional(),
      })
      .optional(),
    interview: z
      .object({
        personName: z.string().min(1),
        soundbites: z.array(z.string().min(1)).min(1),
      })
      .optional(),
  })
  .strict();

export const FarmCatalogueSchema = z.record(z.string(), farmSchema);

export type ValidatedFarm = z.infer<typeof farmSchema>;

function loadFarms(): FarmCatalogue {
  const result = FarmCatalogueSchema.safeParse(seaweedFarmsData);
  if (!result.success) {
    // Loud, non-fatal: a strict test is the CI gate; this is the production
    // tripwire so a bad edit is at least visible in logs rather than silently
    // dropping a farm.
    console.error(
      "[farms] seaweed-farms.json failed schema validation:",
      result.error.issues
        .slice(0, 10)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    );
  }
  return seaweedFarmsData as unknown as FarmCatalogue;
}

/** The validated, typed farm catalogue, keyed by slug. Import this, never the raw JSON. */
export const FARMS: FarmCatalogue = loadFarms();

/** Resolve a farm by its URL slug, or null if unknown. */
export function resolveFarmSlug(slug: string): FarmCatalogue[string] | null {
  return FARMS[slug] ?? null;
}

/**
 * Resolve a farm by a Snippet.deployment value. Returns null for deployments
 * that aren't one of the six monitored seaweed farms (e.g. unrelated PEBL
 * projects like Project Seagrass or the Netherlands oyster site); callers
 * must treat null as "don't show a farm link", not an error.
 */
export function resolveFarmByDeployment(deployment: string): FarmCatalogue[string] | null {
  for (const farm of Object.values(FARMS)) {
    if (farm.deploymentNames.includes(deployment)) return farm;
  }
  return null;
}

/** Every farm slug (for generateStaticParams / index pages). */
export function allFarmSlugs(): string[] {
  return Object.keys(FARMS);
}
