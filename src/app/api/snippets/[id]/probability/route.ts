import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bucketFor } from "@/lib/biodiversity/buckets";
import { fetchTopSpeciesForBucket } from "@/lib/biodiversity/obis";
import { normaliseCommonName } from "@/lib/biodiversity/gbif-match";

export const dynamic = "force-dynamic";

const CACHE_TTL_DAYS = 90;

type ApiResponse =
  | {
      status: "OK";
      source: string;
      totalRecords: number;
      species: Array<{ scientificName: string; count: number; probability: number }>;
      staffAnswerScientific: string | null;
      fetchedAt: string;
    }
  | { status: "INSUFFICIENT_DATA" | "ERROR" | "PENDING"; errorMessage?: string };

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
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

  if (!cached) {
    // Fire-and-forget background fetch so subsequent requests find the row.
    // populateBucket persists ERROR/INSUFFICIENT_DATA states internally, so a
    // top-level catch is only a safety net for unexpected throws.
    void populateBucket(bucket).catch(() => {});
    return NextResponse.json({ status: "PENDING" });
  }

  if (cached.status === "ERROR") {
    return NextResponse.json({ status: "ERROR", errorMessage: cached.errorMessage ?? undefined });
  }
  if (cached.status === "INSUFFICIENT_DATA") {
    return NextResponse.json({ status: "INSUFFICIENT_DATA" });
  }

  // OK
  const species = JSON.parse(cached.speciesJson) as Array<{
    scientificName: string;
    count: number;
    probability: number;
  }>;

  const nameMap = await prisma.speciesNameMap.findUnique({
    where: { commonName: normaliseCommonName(snippet.staffAnswer) },
  });

  return NextResponse.json({
    status: "OK",
    source: cached.source,
    totalRecords: cached.totalRecords,
    species,
    staffAnswerScientific: nameMap?.scientificName ?? null,
    fetchedAt: cached.fetchedAt.toISOString(),
  });
}

async function populateBucket(bucket: ReturnType<typeof bucketFor> & object) {
  const result = await fetchTopSpeciesForBucket(bucket);
  const now = new Date();
  const staleAfter = new Date(now.getTime() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const base = {
    latBucket: bucket.latBucket,
    lonBucket: bucket.lonBucket,
    depthBucket: bucket.depthBucket,
    month: bucket.month,
    source: "obis",
    fetchedAt: now,
    staleAfter,
  };

  if (result.status === "OK") {
    await prisma.speciesProbability.upsert({
      where: {
        latBucket_lonBucket_depthBucket_month: {
          latBucket: bucket.latBucket,
          lonBucket: bucket.lonBucket,
          depthBucket: bucket.depthBucket,
          month: bucket.month,
        },
      },
      update: {
        status: "OK",
        errorMessage: null,
        totalRecords: result.totalRecords,
        speciesJson: JSON.stringify(result.species),
        fetchedAt: now,
        staleAfter,
      },
      create: {
        ...base,
        status: "OK",
        totalRecords: result.totalRecords,
        speciesJson: JSON.stringify(result.species),
      },
    });
  } else if (result.status === "INSUFFICIENT_DATA") {
    await prisma.speciesProbability.upsert({
      where: {
        latBucket_lonBucket_depthBucket_month: {
          latBucket: bucket.latBucket,
          lonBucket: bucket.lonBucket,
          depthBucket: bucket.depthBucket,
          month: bucket.month,
        },
      },
      update: {
        status: "INSUFFICIENT_DATA",
        errorMessage: null,
        totalRecords: 0,
        speciesJson: "[]",
        fetchedAt: now,
        staleAfter,
      },
      create: { ...base, status: "INSUFFICIENT_DATA", totalRecords: 0 },
    });
  } else {
    await prisma.speciesProbability.upsert({
      where: {
        latBucket_lonBucket_depthBucket_month: {
          latBucket: bucket.latBucket,
          lonBucket: bucket.lonBucket,
          depthBucket: bucket.depthBucket,
          month: bucket.month,
        },
      },
      update: {
        status: "ERROR",
        errorMessage: result.errorMessage,
        totalRecords: 0,
        speciesJson: "[]",
        fetchedAt: now,
        staleAfter,
      },
      create: {
        ...base,
        status: "ERROR",
        errorMessage: result.errorMessage,
        totalRecords: 0,
      },
    });
  }
}
