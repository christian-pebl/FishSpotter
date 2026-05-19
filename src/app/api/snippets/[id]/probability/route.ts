import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bucketFor } from "@/lib/biodiversity/buckets";
import { normaliseCommonName } from "@/lib/biodiversity/gbif-match";

export const dynamic = "force-dynamic";

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
    return NextResponse.json({ status: "INSUFFICIENT_DATA" });
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
    return NextResponse.json({ status: "INSUFFICIENT_DATA" });
  }

  if (cached.status === "ERROR") {
    return NextResponse.json({ status: "ERROR", errorMessage: cached.errorMessage ?? undefined });
  }
  if (cached.status === "INSUFFICIENT_DATA") {
    return NextResponse.json({ status: "INSUFFICIENT_DATA" });
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

  const staffAnswerScientific = userHasAnswered
    ? (
        await prisma.speciesNameMap.findUnique({
          where: { commonName: normaliseCommonName(snippet.staffAnswer) },
        })
      )?.scientificName ?? null
    : undefined;

  return NextResponse.json({
    status: "OK",
    source: cached.source,
    totalRecords: cached.totalRecords,
    species,
    fetchedAt: cached.fetchedAt.toISOString(),
    ...(staffAnswerScientific !== undefined ? { staffAnswerScientific } : {}),
  });
}
