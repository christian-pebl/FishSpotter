import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

// Per-snippet "who answered what" breakdown: each spotter's name, their pick,
// and verdict.
//
// ADMIN-ONLY (@pebl-cic.co.uk). The public surfaces (reveal card, leaderboard)
// show only ANONYMOUS aggregate stats — how many answered each option, the most
// popular calls. Seeing WHICH spotter said WHAT is a staff review tool, so
// non-admins get { gated: true } and the UI renders nothing. No public
// Cache-Control: the payload is identity-bearing and per-request gated.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ gated: true });

  const snippet = await prisma.snippet.findUnique({
    where: { id },
    select: { id: true, staffAnswer: true },
  });
  if (!snippet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meId = (admin.session?.user as { id?: string } | undefined)?.id ?? null;

  const rows = await prisma.answer.findMany({
    where: { snippetId: id },
    select: {
      id: true,
      chosenOption: true,
      isCorrect: true,
      points: true,
      userId: true,
      user: { select: { displayName: true, name: true } },
    },
    // Correct / high-scoring first, then chronological, so the spread reads
    // top-down: who got it, then the common misses.
    orderBy: [{ points: "desc" }, { createdAt: "asc" }],
  });

  const answers = rows.map((r) => ({
    id: r.id,
    isYou: r.userId === meId,
    userId: r.userId,
    name: r.user.displayName ?? r.user.name ?? `Spotter ${r.userId.slice(0, 6)}`,
    chosenOption: r.chosenOption,
    isCorrect: r.isCorrect,
    points: r.points,
  }));

  return NextResponse.json({
    gated: false,
    total: answers.length,
    staffAnswer: snippet.staffAnswer,
    hasReference: snippet.staffAnswer !== null,
    answers,
  });
}
