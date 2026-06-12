import { NextResponse } from "next/server";
import { z } from "zod";
import { matchAnswer } from "@/lib/answer-matching";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/csrf";
import { bucketAnswersByNormalized } from "@/lib/answer-histogram";
import { consensusSummary } from "@/lib/consensus";

// P0 "play before the wall": a public, READ-ONLY grade so a signed-out spotter
// sees the real reveal (right/wrong, the reference, the community split) before
// being asked to make an account. It mirrors POST /api/answers but writes
// nothing — no Answer row, no streak, no pokédex, no userId. The persisted path
// (which feeds the leaderboard / consensus / anti-spam) still requires auth, so
// nothing here can corrupt the dataset.
//
// Anti-cheat contract is preserved: the caller must submit a guess
// (`chosenOption`) to reach the reference, exactly as the authed flow gates
// staffAnswer behind having answered.

const MAX_ANSWER_LENGTH = 80;

const PreviewSchema = z.object({
  snippetId: z.string().min(1).max(64),
  chosenOption: z.string().min(1).max(MAX_ANSWER_LENGTH),
});

export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  let parsed;
  try {
    parsed = PreviewSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const option = parsed.chosenOption.trim();
  if (option.length === 0) {
    return NextResponse.json({ error: "Answer required" }, { status: 400 });
  }

  const snippet = await prisma.snippet.findUnique({
    where: { id: parsed.snippetId },
    select: { id: true, staffAnswer: true },
  });
  if (!snippet) {
    return NextResponse.json({ error: "Snippet not found" }, { status: 404 });
  }

  // Same alias-aware matcher the persisted route uses, so a guest's verdict is
  // identical to what they'll be credited once they sign up and the answer is
  // carried in.
  const { isCorrect, points } = await matchAnswer(snippet.staffAnswer, option);

  // Community histogram — identical aggregation to GET /api/snippets/[id]/stats
  // so the reveal's distribution matches the authed experience.
  const answers = await prisma.answer.findMany({
    where: { snippetId: snippet.id },
    select: { chosenOption: true, isCorrect: true },
  });
  const total = answers.length;
  const stats = bucketAnswersByNormalized(answers, snippet.staffAnswer ?? undefined)
    .map(({ option: opt, count }) => ({
      option: opt,
      count,
      percent: total ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    isCorrect,
    points,
    chosenOption: option,
    total,
    stats,
    staffAnswer: snippet.staffAnswer,
    hasReference: snippet.staffAnswer !== null,
    ...(snippet.staffAnswer === null
      ? { consensus: consensusSummary(stats, total) }
      : {}),
  });
}
