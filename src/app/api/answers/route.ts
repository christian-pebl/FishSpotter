import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { matchAnswer } from "@/lib/answer-matching";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/csrf";
import { checkAnswerRateLimit } from "@/lib/rate-limit";
import { computeStreakFromAnswers, toDateKey } from "@/lib/streak";

const MAX_ANSWER_LENGTH = 80;

// S2-T16: the Levenshtein-based correction-chip path is gone. The MCQ
// picker (S2-T14) eliminates the spelling ambiguity it existed to
// solve, and the alias system (S2-T01) catches the residual common
// synonyms when the DEGENERATE free-text fallback fires. `skipCorrection`
// stays in the schema for backwards-compat — clients can still send it
// during transitional deploys; we just ignore it.
const AnswerSchema = z.object({
  snippetId: z.string().min(1).max(64),
  chosenOption: z.string().min(1).max(MAX_ANSWER_LENGTH),
  skipCorrection: z.boolean().optional(),
});

export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // S6-T6: anti-cheat per-user rate limit. 200 answers/hour is well
  // above human spotting cadence and stops scripted scrape-and-submit
  // bots from corrupting the leaderboard.
  if (!checkAnswerRateLimit(session.user.id)) {
    return NextResponse.json(
      { error: "Too many answers in a short window. Slow down a bit." },
      { status: 429 },
    );
  }

  let parsed;
  try {
    parsed = AnswerSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { snippetId, chosenOption } = parsed;
  const option = chosenOption.trim();
  if (option.length === 0) {
    return NextResponse.json({ error: "Answer required" }, { status: 400 });
  }

  const snippet = await prisma.snippet.findUnique({
    where: { id: snippetId },
    select: { id: true, staffAnswer: true },
  });
  if (!snippet) {
    return NextResponse.json({ error: "Snippet not found" }, { status: 404 });
  }

  // S2-T01 + S7-T1: alias-aware matching with nullable staffAnswer.
  // When the snippet has no reference identification yet, returns
  // { isCorrect: null, points: POINTS_PENDING_REF } — the user still
  // earns a flat participation bonus. Phase 2 (S7-T2) will retro-credit
  // additional points once community consensus forms.
  const { isCorrect, points } = await matchAnswer(snippet.staffAnswer, option);

  // S2-T04: compute the streak inline so the client doesn't have to make
  // a follow-up GET /api/streak. Sample the user's existing answers
  // BEFORE the upsert; after, decide whether the new answer adds a date
  // and recompute only in that case (most calls during a session won't
  // change the streak).
  const beforeAnswers = await prisma.answer.findMany({
    where: { userId: session.user.id },
    select: { createdAt: true },
  });
  const previousStreak = computeStreakFromAnswers(beforeAnswers);

  const answer = await prisma.answer.upsert({
    where: {
      userId_snippetId: {
        userId: session.user.id,
        snippetId,
      },
    },
    create: {
      userId: session.user.id,
      snippetId,
      chosenOption: option,
      freeText: null,
      isCorrect,
      points,
    },
    update: {
      chosenOption: option,
      freeText: null,
      isCorrect,
      points,
    },
  });

  // Did the upsert introduce a date the user hadn't logged before? An
  // update on an existing answer doesn't move createdAt, so editing a
  // previous answer cannot bump the streak.
  const answerDateKey = toDateKey(answer.createdAt);
  const alreadyHadDate = beforeAnswers.some(
    (a) => toDateKey(a.createdAt) === answerDateKey,
  );
  const currentStreak = alreadyHadDate
    ? previousStreak
    : computeStreakFromAnswers([...beforeAnswers, { createdAt: answer.createdAt }]);

  return NextResponse.json({
    answer,
    isCorrect,
    points,
    streak: {
      previous: previousStreak.currentStreak,
      current: currentStreak.currentStreak,
    },
  });
}
