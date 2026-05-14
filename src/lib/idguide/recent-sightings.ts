import { prisma } from "@/lib/prisma";

/** Returns up to `limit` distinct staffAnswer values from snippets within ±0.5° of (lat, lon). */
export async function fetchRecentNearbySightings(
  lat: number | null | undefined,
  lon: number | null | undefined,
  excludeSnippetId?: string,
  limit = 8
): Promise<string[]> {
  if (lat == null || lon == null) return [];

  const snippets = await prisma.snippet.findMany({
    where: {
      lat: { gte: lat - 0.5, lte: lat + 0.5 },
      lon: { gte: lon - 0.5, lte: lon + 0.5 },
      ...(excludeSnippetId ? { NOT: { id: excludeSnippetId } } : {}),
    },
    orderBy: { recordingDatetime: "desc" },
    select: { staffAnswer: true },
    take: 60,
  });

  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of snippets) {
    const v = s.staffAnswer.trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}
