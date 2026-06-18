import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { bucketAnswersByNormalized } from "@/lib/answer-histogram";
import { consensusSummary } from "@/lib/consensus";
import { prisma } from "@/lib/prisma";

// Public CDN cache for the PRE-ANSWER payload only. The community histogram
// (total + stats) is the same for every user and changes slowly, so the
// un-gated shape is safe at the edge. Short TTL because the histogram does drift
// as people answer: s-maxage caches for 30s, stale-while-revalidate serves a
// stale copy for another 60s while it refreshes.
//
// PRIVACY: once the user has answered we add staffAnswer / hasReference (the
// reference answer) and, on no-reference clips, the live consensus lean. Those
// are gated on THIS user having committed, so the post-answer response is
// returned with no public Cache-Control header (the CDN must not share it).
const CACHE_CONTROL_PUBLIC =
  "public, s-maxage=30, stale-while-revalidate=60";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const snippet = await prisma.snippet.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!snippet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await getServerSession(authOptions);
  const userHasAnswered = !!(
    session?.user?.id &&
    (await prisma.answer.findFirst({
      where: { userId: session.user.id, snippetId: id },
      select: { id: true },
    }))
  );

  const answers = await prisma.answer.findMany({
    where: { snippetId: id },
    select: { chosenOption: true, isCorrect: true },
  });

  const total = answers.length;
  // No PEBL reference any more — the crowd is the authority. The histogram is
  // pure community answers.
  const stats = bucketAnswersByNormalized(answers)
    .map(({ option, count }) => ({
      option,
      count,
      percent: total ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Blind submission: the live consensus lean is gated on THIS user having
  // committed their own guess, so nobody sees the crowd before deciding.
  // Pre-answer the response is just the user-independent histogram (total +
  // stats) and gets the public CDN header; post-answer it carries the
  // per-user-gated consensus state, so no public cache header (the CDN must not
  // store/share it).
  return NextResponse.json(
    {
      total,
      stats,
      ...(userHasAnswered
        ? { hasReference: false, consensus: consensusSummary(stats, total) }
        : {}),
    },
    userHasAnswered
      ? undefined
      : { headers: { "Cache-Control": CACHE_CONTROL_PUBLIC } },
  );
}
