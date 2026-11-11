import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { bucketAnswersByNormalized } from "@/lib/answer-histogram";
import { consensusSummary } from "@/lib/consensus";
import { prisma } from "@/lib/prisma";

// Blind submission. The community histogram IS the answer on this app (the
// crowd is the authority and the consensus payout follows it), so it is only
// ever sent to a spotter who has already committed their own guess on this
// clip. Everyone else, signed in or not, gets GATED_BODY: the same shape the
// client falls back to when the fetch fails, plus `gated: true`.
//
// Until 11 Nov 2026 the un-answered response carried the full histogram and a
// public CDN header, so anyone could read "Ballan wrasse 86%" before guessing.
//
// CACHING: nothing on this route may be stored by a shared cache.
//  - Vercel's CDN keys on the URL, not the cookie (a request carrying a cookie
//    was served the anonymous entry, measured 11 Nov 2026), and it refuses to
//    cache a response whose Vary names Cookie. So a publicly cached gated body
//    would be handed to a spotter who has just answered, and their reveal
//    would show an empty breakdown for as long as the entry lived.
//  - The histogram response is per-viewer by definition.
// The anonymous path costs no database query instead: with no session there is
// nothing to look up, so it returns before Prisma is touched.
export const dynamic = "force-dynamic";

const NO_SHARED_CACHE = { "Cache-Control": "private, no-store" } as const;

const GATED_BODY = { gated: true, total: 0, stats: [] } as const;

function gated() {
  return NextResponse.json(GATED_BODY, { headers: NO_SHARED_CACHE });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Signed-out visitors can never have a persisted answer (their reveal comes
  // from POST /api/answers/preview, after they commit a guess), so there is
  // nothing to check and nothing to show.
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return gated();

  const [snippet, myAnswer] = await Promise.all([
    prisma.snippet.findUnique({ where: { id }, select: { id: true } }),
    prisma.answer.findFirst({
      where: { userId, snippetId: id },
      select: { id: true },
    }),
  ]);
  if (!snippet) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: NO_SHARED_CACHE },
    );
  }
  if (!myAnswer) return gated();

  const answers = await prisma.answer.findMany({
    where: { snippetId: id },
    select: { chosenOption: true, isCorrect: true },
  });

  const total = answers.length;
  // No PEBL reference any more, the crowd is the authority. The histogram is
  // pure community answers.
  const stats = bucketAnswersByNormalized(answers)
    .map(({ option, count }) => ({
      option,
      count,
      percent: total ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json(
    {
      total,
      stats,
      hasReference: false,
      consensus: consensusSummary(stats, total),
    },
    { headers: NO_SHARED_CACHE },
  );
}
