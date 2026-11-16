import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bucketFor } from "@/lib/biodiversity/buckets";

// Public CDN cache. The cached SpeciesProbability row (90-day TTL) is identical
// for every user and carries no auth/cookie input, so the whole response is safe
// to serve from the edge. s-maxage caches at the CDN for an hour;
// stale-while-revalidate keeps it warm for a day while a fresh copy is fetched
// in the background.
//
// This route carries NO per-user and NO reference data, and must stay that way:
// the edge keys on the URL alone (a request with a session cookie is served the
// same cached copy; measured on production, 16 Nov 2026). Until then it also
// returned `staffAnswerScientific` to a spotter who had answered, which the edge
// never delivered to them, so the reveal gallery stayed empty. That name now
// comes from GET /api/snippets/[id]/stats, which is private and answered-only.
const CACHE_CONTROL_PUBLIC =
  "public, s-maxage=3600, stale-while-revalidate=86400";

type ApiResponse =
  | {
      status: "OK";
      source: string;
      totalRecords: number;
      species: Array<{ scientificName: string; count: number; probability: number }>;
      fetchedAt: string;
    }
  | { status: "INSUFFICIENT_DATA" | "ERROR"; errorMessage?: string };

function safeParseSpecies(raw: string): Array<{
  scientificName: string;
  count: number;
  probability: number;
}> {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is { scientificName: string; count: number; probability: number } =>
        s &&
        typeof s === "object" &&
        typeof s.scientificName === "string" &&
        typeof s.count === "number" &&
        typeof s.probability === "number",
    );
  } catch {
    return [];
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse | { error: string }>> {
  const { id } = await params;
  const snippet = await prisma.snippet.findUnique({
    where: { id },
    select: {
      id: true,
      lat: true,
      lon: true,
      depthM: true,
      recordingDatetime: true,
    },
  });
  if (!snippet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bucket = bucketFor(snippet);
  if (!bucket) {
    return NextResponse.json(
      { status: "INSUFFICIENT_DATA" },
      { headers: { "Cache-Control": CACHE_CONTROL_PUBLIC } },
    );
  }

  const cached = await prisma.speciesProbability.findUnique({
    where: {
      latBucket_lonBucket_depthBucket_month: {
        latBucket: bucket.latBucket,
        lonBucket: bucket.lonBucket,
        depthBucket: bucket.depthBucket,
        month: bucket.month,
      },
    },
  });

  // Batch-only: buckets are populated by scripts/backfill-probability.ts.
  // A request that misses the cache surfaces as INSUFFICIENT_DATA, the user
  // sees the same fallback copy and we avoid a fire-and-forget fetch that
  // serverless function termination would kill mid-write.
  if (!cached) {
    return NextResponse.json(
      { status: "INSUFFICIENT_DATA" },
      { headers: { "Cache-Control": CACHE_CONTROL_PUBLIC } },
    );
  }

  if (cached.status === "ERROR") {
    return NextResponse.json(
      { status: "ERROR", errorMessage: cached.errorMessage ?? undefined },
      { headers: { "Cache-Control": CACHE_CONTROL_PUBLIC } },
    );
  }
  if (cached.status === "INSUFFICIENT_DATA") {
    return NextResponse.json(
      { status: "INSUFFICIENT_DATA" },
      { headers: { "Cache-Control": CACHE_CONTROL_PUBLIC } },
    );
  }

  const species = safeParseSpecies(cached.speciesJson);

  return NextResponse.json(
    {
      status: "OK",
      source: cached.source,
      totalRecords: cached.totalRecords,
      species,
      fetchedAt: cached.fetchedAt.toISOString(),
    },
    { headers: { "Cache-Control": CACHE_CONTROL_PUBLIC } },
  );
}
