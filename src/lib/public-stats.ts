/**
 * The public headline numbers, as JSON.
 *
 * `GET /api/stats` serves this with no token, so a newsletter, the PEBL
 * website, a funder report or a Claude session can quote the live figures
 * without a database credential or a screenshot of the landing page. It
 * carries only counts that are already public on the landing page and the
 * archive, plus the farm roll-up. The detailed roundup (reach, retention,
 * consensus, per-site breakdowns) stays behind `METRICS_TOKEN` on
 * `/api/metrics/summary`, see `src/lib/metrics/roundup.ts`.
 *
 * The definitions mirror `src/app/page.tsx` so the JSON and the landing page
 * can never disagree: clips are the live, non-blocked snippets; species is
 * the size of the identification guide; identifications is every Answer
 * row; spotters is the distinct users behind those rows.
 *
 * `buildPublicStats` is pure (the queries are in `loadPublicStats`) so the
 * farm roll-up and the payload shape are unit-tested without a database.
 */

import type { PrismaClient } from "@prisma/client";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { FARMS } from "@/lib/farms/catalogue";
import { farmForSite } from "@/lib/site-label";
import { excludeBlockedSnippetsWhere } from "@/lib/snippet-blocklist";

export interface PublicStats {
  generatedAt: string;
  clips: number;
  species: number;
  identifications: number;
  spotters: number;
  sites: number;
  farmsWithClips: number;
  farmsMonitored: number;
  farmNames: string[];
  countries: string[];
  definitions: Record<string, string>;
}

/**
 * One line per figure, shipped in the payload rather than only in a doc, so
 * whoever quotes a number can see what it counts. "Species" in particular is
 * the size of the guide, not how many species the community has identified,
 * and a farm only counts as filmed once it has a clip on the feed.
 */
export const PUBLIC_STATS_DEFINITIONS: Record<string, string> = {
  clips: "Live clips on the feed. Excluded and blocklisted snippets are not counted.",
  species: "Species in the identification guide (the catalogue), not the number identified so far.",
  identifications: "Every identification submitted since launch, one per spotter per clip.",
  spotters: "Distinct people who have submitted at least one identification, guests included.",
  sites: "Distinct filming sites with at least one live clip, farm and non-farm.",
  farmsWithClips: "Seaweed and shellfish farms with at least one live clip on the feed.",
  farmsMonitored: "Farms PEBL films, including any not yet on the feed.",
  farmNames: "The farms with live clips, in catalogue order.",
  countries: "Countries of the farms with live clips.",
};

export interface PublicStatsInput {
  clips: number;
  identifications: number;
  spotters: number;
  /** `Snippet.site` of every live clip; duplicates are fine. */
  sites: readonly string[];
  now?: Date;
}

export function buildPublicStats(input: PublicStatsInput): PublicStats {
  const farmSlugs = new Set<string>();
  const sites = new Set<string>();
  for (const site of input.sites) {
    if (!site) continue;
    sites.add(site);
    const farm = farmForSite(site);
    if (farm) farmSlugs.add(farm.slug);
  }
  // Catalogue order, so the lists read the same on every call.
  const farms = Object.entries(FARMS)
    .filter(([slug]) => farmSlugs.has(slug))
    .map(([, farm]) => farm);

  return {
    generatedAt: (input.now ?? new Date()).toISOString(),
    clips: input.clips,
    species: Object.keys(CATALOGUE).length,
    identifications: input.identifications,
    spotters: input.spotters,
    sites: sites.size,
    farmsWithClips: farms.length,
    farmsMonitored: Object.keys(FARMS).length,
    farmNames: farms.map((farm) => farm.name),
    countries: Array.from(new Set(farms.map((farm) => farm.location.country))),
    definitions: PUBLIC_STATS_DEFINITIONS,
  };
}

export async function loadPublicStats(prisma: PrismaClient, now?: Date): Promise<PublicStats> {
  const where = excludeBlockedSnippetsWhere();
  const [clips, identifications, spotterGroups, siteGroups] = await Promise.all([
    prisma.snippet.count({ where }),
    prisma.answer.count(),
    prisma.answer.groupBy({ by: ["userId"] }),
    prisma.snippet.groupBy({ by: ["site"], where }),
  ]);
  return buildPublicStats({
    clips,
    identifications,
    spotters: spotterGroups.length,
    sites: siteGroups.map((group) => group.site),
    now,
  });
}
