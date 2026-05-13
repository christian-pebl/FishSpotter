import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const snippet = await prisma.snippet.findUnique({
    where: { id },
    select: {
      id: true,
      staffAnswer: true,
      labelStatus: true,
      staffTaxonId: true,
      staffTaxon: {
        select: {
          id: true, name: true, scientificName: true,
          funFact: true, description: true, heroImageUrl: true, habitatNote: true,
          isFunctionalGroup: true,
        },
      },
    },
  });
  if (!snippet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const answers = await prisma.answer.findMany({
    where: { snippetId: id },
    select: {
      chosenOption: true,
      isCorrect: true,
      taxonId: true,
      taxon: { select: { id: true, name: true } },
    },
  });

  const total = answers.length;

  // Aggregate by taxon when known, falling back to chosenOption text for legacy answers.
  const byKey = new Map<string, { label: string; count: number; taxonId: string | null }>();
  for (const a of answers) {
    const key = a.taxonId ?? `text:${a.chosenOption.toLowerCase()}`;
    const label = a.taxon?.name ?? a.chosenOption;
    const existing = byKey.get(key);
    if (existing) existing.count += 1;
    else byKey.set(key, { label, count: 1, taxonId: a.taxonId ?? null });
  }
  const stats = Array.from(byKey.values())
    .map((v) => ({
      option: v.label,
      taxonId: v.taxonId,
      count: v.count,
      percent: total ? Math.round((v.count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    total,
    stats,
    staffAnswer: snippet.staffAnswer, // legacy
    labelStatus: snippet.labelStatus,
    staffTaxon: snippet.staffTaxon,
  });
}
