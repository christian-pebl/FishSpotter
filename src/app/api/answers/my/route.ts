import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TAXON_SELECT = {
  id: true,
  name: true,
  scientificName: true,
  funFact: true,
  description: true,
  heroImageUrl: true,
  habitatNote: true,
  isFunctionalGroup: true,
} as const;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ answers: [] });
  }

  const { searchParams } = new URL(req.url);
  const snippetId = searchParams.get("snippetId");
  if (snippetId) {
    const one = await prisma.answer.findUnique({
      where: { userId_snippetId: { userId: session.user.id, snippetId } },
      include: {
        taxon: { select: TAXON_SELECT },
        snippet: {
          select: {
            labelStatus: true,
            staffTaxon: { select: TAXON_SELECT },
          },
        },
      },
    });
    if (!one) return NextResponse.json({ answer: null });
    return NextResponse.json({
      answer: {
        chosenOption: one.chosenOption,
        isCorrect: one.isCorrect,
        pointsAwarded: one.pointsAwarded,
        resolvedTaxon: one.taxon,
        staffTaxon: one.snippet.staffTaxon,
        labelStatus: one.snippet.labelStatus,
      },
    });
  }

  const answers = await prisma.answer.findMany({
    where: { userId: session.user.id },
    select: { snippetId: true, chosenOption: true, isCorrect: true, pointsAwarded: true, createdAt: true },
  });
  return NextResponse.json({ answers });
}
