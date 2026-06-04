import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
  _req: Request,
  { params }: { params: Promise<{ scientificName: string }> },
): Promise<NextResponse<{ images: SpeciesImagePayload[] } | { error: string }>> {
  const { scientificName } = await params;
  // Defensive: scientific names are "Genus species", letters + space only.
  // Reject anything else so this can't be turned into a probe surface.
  const decoded = decodeURIComponent(scientificName).trim();
  if (!/^[A-Za-z][A-Za-z\- ]{0,80}$/.test(decoded)) {
    return NextResponse.json({ error: "Invalid scientific name" }, { status: 400 });
  }

  const rows = await prisma.speciesImage.findMany({
    where: { scientificName: decoded },
    orderBy: [{ curated: "desc" }, { ordering: "asc" }, { createdAt: "asc" }],
    take: 20,
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
    url: r.url,
    thumbUrl: r.thumbUrl,
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

  return NextResponse.json({ images });
}
