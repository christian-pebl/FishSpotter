/**
 * GET /api/snippets/[id]/quiz
 *
 * Returns the multiple-choice candidate set for the quiz UI (S2-T05).
 *
 * Auth-gated so the response can legitimately include the staff answer
 * as one of the candidates — anonymous callers get 401. This is the
 * private replacement for `/probability`'s public OBIS species list
 * (which is spoiler-gated after S1-T11). The client never knows which
 * of the returned candidates is the staff answer.
 *
 * Response shape (typed for the FeedCard MCQ render in S2-T14):
 *
 *   {
 *     candidates: [{ scientificName, commonName, thumbUrl, attribution }],
 *     fallback: "OBIS" | "CATALOGUE" | "DEGENERATE",
 *   }
 *
 * Candidate count is deterministic per snippetId — the shuffle is
 * seeded on the snippet id so reloading the page doesn't reshuffle.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { selectCandidates } from "@/lib/biodiversity/candidates";
import { bucketFor } from "@/lib/biodiversity/buckets";
import { normaliseCommonName } from "@/lib/biodiversity/gbif-match";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface ProbabilityRow {
  scientificName: string;
  count?: number;
  probability: number;
}

function safeParseSpecies(raw: string): ProbabilityRow[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is ProbabilityRow =>
        s &&
        typeof s === "object" &&
        typeof s.scientificName === "string" &&
        typeof s.probability === "number",
    );
  } catch {
    return [];
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Sign in to load the quiz options." },
      { status: 401 },
    );
  }

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
  if (!snippet) {
    return NextResponse.json({ error: "Snippet not found" }, { status: 404 });
  }

  // Resolve the staff scientific name. May be null when GBIF lookup
  // hasn't run or failed — the candidate selector handles that path
  // by falling back to the catalogue.
  const nameMap = await prisma.speciesNameMap.findUnique({
    where: { commonName: normaliseCommonName(snippet.staffAnswer) },
    select: { scientificName: true },
  });
  const staffScientific = nameMap?.scientificName ?? null;

  // OBIS probability lookup for the bucket. Null is fine — selector
  // falls back to catalogue.
  let probability: ProbabilityRow[] | null = null;
  const bucket = bucketFor(snippet);
  if (bucket) {
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
    if (cached && cached.status === "OK") {
      const parsed = safeParseSpecies(cached.speciesJson);
      if (parsed.length > 0) {
        probability = parsed.slice(0, 10);
      }
    }
  }

  // Build the image lookup. We need thumbs for the staff option AND for
  // every potential distractor — fetch the union (probability species ∪
  // staffScientific ∪ catalogue when in fallback territory). One DB hit.
  //
  // Cheap shortcut: pull the SpeciesImage rows for everything that could
  // plausibly show up, ordered by `ordering` ASC so the lowest ordering
  // wins per species.
  const candidateScientificNames = new Set<string>();
  if (probability) for (const p of probability) candidateScientificNames.add(p.scientificName);
  if (staffScientific) candidateScientificNames.add(staffScientific);
  // Also load images for the full catalogue in case CATALOGUE fallback fires.
  const { default: catalogue } = await import("@/data/species-traits.json");
  for (const sci of Object.keys(catalogue as Record<string, unknown>)) {
    candidateScientificNames.add(sci);
  }

  const imageRows = await prisma.speciesImage.findMany({
    where: { scientificName: { in: Array.from(candidateScientificNames) } },
    select: { scientificName: true, thumbUrl: true, url: true, attribution: true, ordering: true },
    orderBy: [{ scientificName: "asc" }, { ordering: "asc" }],
  });

  // First row per scientificName wins (lowest ordering due to ORDER BY).
  const imageIndex = new Map<string, { thumbUrl: string; attribution: string }>();
  for (const row of imageRows) {
    if (imageIndex.has(row.scientificName)) continue;
    const thumb = row.thumbUrl ?? row.url;
    if (!thumb) continue;
    imageIndex.set(row.scientificName, {
      thumbUrl: thumb,
      attribution: row.attribution,
    });
  }

  const result = selectCandidates({
    probability,
    staffAnswer: snippet.staffAnswer,
    staffScientific,
    imageIndex,
    seed: snippet.id,
  });

  return NextResponse.json(result);
}
