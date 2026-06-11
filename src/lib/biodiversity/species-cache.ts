/**
 * Read-through cache for the species profile's OBIS-derived sections.
 *
 * A cold profile render calls OBIS (depth ~2 paged calls + distribution grid),
 * which is ~15s. These getters serve a cached DepthSummary / DistributionGrid
 * when fresh, and only hit OBIS on a miss or once the 90-day TTL passes,
 * persisting the result (including a legitimate null = "OBIS had no data") so
 * the next render is instant. On an OBIS error we keep the existing (stale)
 * value rather than poisoning the cache with null.
 */
import { prisma } from "@/lib/prisma";
import { fetchDepthSummary, type DepthSummary } from "./depth";
import { fetchDistribution, type DistributionGrid } from "./distribution";

const TTL_DAYS = 90;
const ttl = () => new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);

export async function getCachedDepth(scientificName: string): Promise<DepthSummary | null> {
  const row = await prisma.speciesDepthCache.findUnique({ where: { scientificName } });
  if (row && row.staleAfter > new Date()) {
    return row.summaryJson ? (JSON.parse(row.summaryJson) as DepthSummary) : null;
  }
  let summary: DepthSummary | null;
  try {
    summary = await fetchDepthSummary(scientificName);
  } catch {
    // Keep whatever we had (possibly stale) rather than caching a transient miss.
    return row?.summaryJson ? (JSON.parse(row.summaryJson) as DepthSummary) : null;
  }
  await prisma.speciesDepthCache.upsert({
    where: { scientificName },
    create: { scientificName, summaryJson: summary ? JSON.stringify(summary) : null, staleAfter: ttl() },
    update: { summaryJson: summary ? JSON.stringify(summary) : null, fetchedAt: new Date(), staleAfter: ttl() },
  });
  return summary;
}

export async function getCachedDistribution(scientificName: string): Promise<DistributionGrid | null> {
  const row = await prisma.speciesDistributionCache.findUnique({ where: { scientificName } });
  if (row && row.staleAfter > new Date()) {
    return row.gridJson ? (JSON.parse(row.gridJson) as DistributionGrid) : null;
  }
  let grid: DistributionGrid | null;
  try {
    grid = await fetchDistribution(scientificName);
  } catch {
    return row?.gridJson ? (JSON.parse(row.gridJson) as DistributionGrid) : null;
  }
  await prisma.speciesDistributionCache.upsert({
    where: { scientificName },
    create: { scientificName, gridJson: grid ? JSON.stringify(grid) : null, staleAfter: ttl() },
    update: { gridJson: grid ? JSON.stringify(grid) : null, fetchedAt: new Date(), staleAfter: ttl() },
  });
  return grid;
}
