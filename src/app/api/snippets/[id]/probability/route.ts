import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bucketFor } from "@/lib/biodiversity/buckets";
import { normaliseCommonName } from "@/lib/biodiversity/gbif-match";

// Public CDN cache for the PRE-ANSWER payload only. The cached SpeciesProbability
// row (90-day TTL) is identical for every user and carries no auth/cookie input,
// so the un-gated response shape (status / source / totalRecords / species /
// fetchedAt, with NO staffAnswerScientific) is safe to serve from the edge.
// s-maxage caches at the CDN for an hour; stale-while-revalidate keeps it warm
// for a day while a fresh copy is fetched in the background.
//
// PRIVACY: the post-answer response adds `staffAnswerScientific` (the reference
// answer), which is gated on whether THIS user has answered. That value must
// never land in a shared CDN entry, so the gated response is returned with no
// public Cache-Control header at all (default private/no-store from the function).
const CACHE_CONTROL_PUBLIC =
  "public, s-maxage=3600, stale-while-revalidate=86400";

type ApiResponse =
  | {
      status: "OK";
      source: string;
      totalRecords: number;
      species: Array<{ scientificName: string; count: number; probability: number }>;
      staffAnswerScientific?: string | null;
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
      staffAnswer: true,
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
  // A request that misses the cache surfaces as INSUFFICIENT_DATA — the user
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

  const session = await getServerSession(authOptions);
  const userHasAnswered = !!(
    session?.user?.id &&
    (await prisma.answer.findFirst({
      where: { userId: session.user.id, snippetId: id },
      select: { id: true },
    }))
  );

  // S7-T1: when the snippet has no reference identification, return
  // null explicitly so the client knows there's nothing to assess.
  const staffAnswerScientific = userHasAnswered
    ? snippet.staffAnswer
      ? (
          await prisma.speciesNameMap.findUnique({
            where: { commonName: normaliseCommonName(snippet.staffAnswer) },
          })
        )?.scientificName ?? null
      : null
    : undefined;

  // staffAnswerScientific is undefined ONLY before the user has answered. In that
  // case the payload is user-independent and gets the public CDN header. Once the
  // field is present (post-answer) it is a per-user-private reference value, so we
  // return no public cache header and the CDN must not store/share it.
  const isPreAnswer = staffAnswerScientific === undefined;
  return NextResponse.json(
    {
      status: "OK",
      source: cached.source,
      totalRecords: cached.totalRecords,
      species,
      fetchedAt: cached.fetchedAt.toISOString(),
      ...(isPreAnswer ? {} : { staffAnswerScientific }),
    },
    isPreAnswer
      ? { headers: { "Cache-Control": CACHE_CONTROL_PUBLIC } }
      : undefined,
  );
}
