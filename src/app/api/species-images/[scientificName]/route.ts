import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// The SpeciesImage cache is refreshed weekly by the images cron, and the
// response is identical for every user (no auth/cookie input), so it is safe
// to serve from the CDN edge. This is the single biggest photo-load lever:
// CandidateGate fires this endpoint once per candidate (up to 24 in parallel),
// and without a cache every tile is an uncached Postgres round-trip on every
// grid render. s-maxage caches at the edge; stale-while-revalidate keeps it
// warm for a week while a fresh copy is fetched in the background.
const CACHE_CONTROL =
  "public, s-maxage=86400, stale-while-revalidate=604800";

// S9-T1 PR3: marks are surfaced inline with the photos so the
// IdGuideWizard's final reveal can render diagnostic-feature rings
// without a second round-trip. Existing consumers (SpeciesGallery)
// ignore the new fields.
export type SpeciesMarkPayload = {
  label: string;
  description: string;
  overlayX: number;
  overlayY: number;
  overlayRadius: number;
  order: number;
};

export type SpeciesImagePayload = {
  id: string;
  url: string;
  thumbUrl: string | null;
  attribution: string;
  sourceUrl: string;
  license: string;
  lifeStage: string | null;
  sex: string | null;
  width: number | null;
  height: number | null;
  observedOn: string | null;
  placeGuess: string | null;
  source: string;
  marks: SpeciesMarkPayload[];
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ scientificName: string }> },
): Promise<NextResponse<{ images: SpeciesImagePayload[] } | { error: string }>> {
  const { scientificName } = await params;
  // Defensive: scientific names are "Genus species", letters + space only.
  // Reject anything else so this can't be turned into a probe surface.
  const decoded = decodeURIComponent(scientificName).trim();
  if (!/^[A-Za-z][A-Za-z\- ]{0,80}$/.test(decoded)) {
    return NextResponse.json({ error: "Invalid scientific name" }, { status: 400 });
  }

  // `?limit=N` caps the row count (clamped 1..20). CandidateGate only needs the
  // single lead thumbnail per candidate, so it calls `?limit=1` to fetch one
  // row instead of 20, 24 times over. Full consumers (the reveal gallery /
  // AnnotatedSpeciesPhoto) omit it and get the complete set.
  const sp = new URL(req.url).searchParams;
  const limitParamRaw = Number(sp.get("limit"));
  const take =
    Number.isFinite(limitParamRaw) && limitParamRaw > 0
      ? Math.min(Math.floor(limitParamRaw), 20)
      : 20;

  const rows = await prisma.speciesImage.findMany({
    where: { scientificName: decoded },
    orderBy: [{ curated: "desc" }, { ordering: "asc" }, { createdAt: "asc" }],
    take,
    include: {
      diagnosticMarks: {
        orderBy: { order: "asc" },
        select: {
          label: true,
          description: true,
          overlayX: true,
          overlayY: true,
          overlayRadius: true,
          order: true,
        },
      },
    },
  });

  // Q3A-T4: diagnostic marks only render on curated reference photos.
  // Marks attached to non-curated photos (typically iNat research-grade
  // shots picked at random) are excluded from the response, so the
  // wizard's AnnotatedSpeciesPhoto falls through to the thumb-strip +
  // field-note path. The marks rows stay in DB and reappear if the photo
  // is later flagged curated, so this is reversible.
  const images: SpeciesImagePayload[] = rows.map((r) => ({
    id: r.id,
    // Route C: prefer the PEBL-hosted WebP derivative (smaller, served from our
    // own edge), falling back to the iNat/Wikimedia origin when a row hasn't
    // been transcoded yet. Transparent to every consumer of this endpoint.
    url: r.webpUrl ?? r.url,
    thumbUrl: r.webpThumbUrl ?? r.thumbUrl,
    attribution: r.attribution,
    sourceUrl: r.sourceUrl,
    license: r.license,
    lifeStage: r.lifeStage,
    sex: r.sex,
    width: r.width,
    height: r.height,
    observedOn: r.observedOn,
    placeGuess: r.placeGuess,
    source: r.source,
    marks: r.curated ? r.diagnosticMarks : [],
  }));

  return NextResponse.json(
    { images },
    { headers: { "Cache-Control": CACHE_CONTROL } },
  );
}
