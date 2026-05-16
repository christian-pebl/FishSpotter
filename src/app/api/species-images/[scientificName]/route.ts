import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export type SpeciesImagePayload = {
  url: string;
  thumbUrl: string | null;
  attribution: string;
  sourceUrl: string;
  license: string;
  lifeStage: string | null;
  sex: string | null;
  width: number | null;
  height: number | null;
  source: string;
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
  });

  const images: SpeciesImagePayload[] = rows.map((r) => ({
    url: r.url,
    thumbUrl: r.thumbUrl,
    attribution: r.attribution,
    sourceUrl: r.sourceUrl,
    license: r.license,
    lifeStage: r.lifeStage,
    sex: r.sex,
    width: r.width,
    height: r.height,
    source: r.source,
  }));

  return NextResponse.json({ images });
}
