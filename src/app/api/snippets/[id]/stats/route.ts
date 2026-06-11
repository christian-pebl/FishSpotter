import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { bucketAnswersByNormalized } from "@/lib/answer-histogram";
import { consensusSummary } from "@/lib/consensus";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const snippet = await prisma.snippet.findUnique({
    where: { id },
    select: { id: true, staffAnswer: true },
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
  // S7-T1: staffAnswer may be null when the snippet has no reference ID
  // yet. Pass undefined to the histogram so it doesn't try to favour a
  // canonical that doesn't exist.
  const stats = bucketAnswersByNormalized(
    answers,
    snippet.staffAnswer ?? undefined,
  )
    .map(({ option, count }) => ({
      option,
      count,
      percent: total ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // After the user has answered, return staffAnswer (which may be null)
  // so the client can distinguish "no reference yet" from "haven't loaded
  // staff answer yet". hasReference is a convenience flag. For no-reference
  // (community) clips we also return the live consensus state so the reveal can
  // show "the community is converging on Y" instead of correct/incorrect.
  // Gated on userHasAnswered so a spotter never sees the crowd's lean before
  // committing their own guess.
  return NextResponse.json({
    total,
    stats,
    ...(userHasAnswered
      ? {
          staffAnswer: snippet.staffAnswer,
          hasReference: snippet.staffAnswer !== null,
          ...(snippet.staffAnswer === null
            ? { consensus: consensusSummary(stats, total) }
            : {}),
        }
      : {}),
  });
}
