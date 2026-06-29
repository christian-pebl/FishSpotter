import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { speciesSlug } from "@/lib/species-slug";
import { excludeBlockedSnippetsWhere } from "@/lib/snippet-blocklist";

export const revalidate = 3600; // hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXTAUTH_URL ?? "https://fish-spotter.vercel.app").replace(/\/$/, "");
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/feed`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/feed/browse`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/leaderboard`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${base}/species`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
  // Species catalogue is in-memory (not DB-backed), so these entries are always
  // safe to emit, including when the DB is unreachable below.
  const speciesEntries: MetadataRoute.Sitemap = Object.keys(CATALOGUE).map((scientificName) => ({
    url: `${base}/species/${speciesSlug(scientificName)}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));
  try {
    const snippets = await prisma.snippet.findMany({
      where: excludeBlockedSnippetsWhere(),
      select: { id: true, externalId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    const snippetEntries: MetadataRoute.Sitemap = snippets.map((s: { id: string; createdAt: Date }) => ({
      url: `${base}/feed/${s.id}`,
      lastModified: s.createdAt,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    }));
    return [...staticEntries, ...speciesEntries, ...snippetEntries];
  } catch {
    // DB not reachable (e.g. preview build with no secrets): still
    // emit the static + species sections so the sitemap stays valid.
    return [...staticEntries, ...speciesEntries];
  }
}
