import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ taxa: [], totals: { spotted: 0, contributed: 0, total: 0 } });
  }

  // All taxa (used for the "locked" tiles)
  const allTaxa = await prisma.taxon.findMany({
    select: {
      id: true,
      name: true,
      scientificName: true,
      isFunctionalGroup: true,
      heroImageUrl: true,
      funFact: true,
    },
    orderBy: [{ isFunctionalGroup: "desc" }, { name: "asc" }],
  });

  // User's correct answers (spotted) — joined to staff taxon of the snippet
  const correctAnswers = await prisma.answer.findMany({
    where: {
      userId: session.user.id,
      isCorrect: true,
      snippet: { staffTaxonId: { not: null } },
    },
    select: {
      createdAt: true,
      snippet: { select: { staffTaxonId: true, site: true } },
    },
  });

  // User's answers on unlabelled clips (contributed) — by resolved taxon
  const contributedAnswers = await prisma.answer.findMany({
    where: {
      userId: session.user.id,
      taxonId: { not: null },
      snippet: { labelStatus: "UNLABELLED" },
    },
    select: {
      createdAt: true,
      taxonId: true,
      snippet: { select: { site: true } },
    },
  });

  const spottedMap = new Map<string, { count: number; lastSeen: Date; lastSite: string }>();
  for (const a of correctAnswers) {
    const tid = a.snippet.staffTaxonId!;
    const ex = spottedMap.get(tid);
    if (!ex) spottedMap.set(tid, { count: 1, lastSeen: a.createdAt, lastSite: a.snippet.site });
    else {
      ex.count++;
      if (a.createdAt > ex.lastSeen) {
        ex.lastSeen = a.createdAt;
        ex.lastSite = a.snippet.site;
      }
    }
  }

  const contributedMap = new Map<string, { count: number; lastSeen: Date; lastSite: string }>();
  for (const a of contributedAnswers) {
    if (!a.taxonId) continue;
    if (spottedMap.has(a.taxonId)) continue; // already spotted via verified clip
    const ex = contributedMap.get(a.taxonId);
    if (!ex) contributedMap.set(a.taxonId, { count: 1, lastSeen: a.createdAt, lastSite: a.snippet.site });
    else {
      ex.count++;
      if (a.createdAt > ex.lastSeen) {
        ex.lastSeen = a.createdAt;
        ex.lastSite = a.snippet.site;
      }
    }
  }

  const taxa = allTaxa.map((t) => {
    const sp = spottedMap.get(t.id);
    const co = contributedMap.get(t.id);
    return {
      ...t,
      status: sp ? "spotted" : co ? "contributed" : "locked",
      count: (sp?.count ?? 0) + (co?.count ?? 0),
      lastSeen: sp?.lastSeen ?? co?.lastSeen ?? null,
      lastSite: sp?.lastSite ?? co?.lastSite ?? null,
    };
  });

  return NextResponse.json({
    taxa,
    totals: {
      spotted: spottedMap.size,
      contributed: contributedMap.size,
      total: allTaxa.length,
    },
  });
}
