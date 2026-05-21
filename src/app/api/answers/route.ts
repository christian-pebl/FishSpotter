import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { isCorrectAnswer } from "@/lib/answer-matching";
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

  // S2-T01: alias-aware matching. Accepts scientific binomial, common
  // name, editorial synonyms, and simple singular/plural variants.
  // Falls back to the direct normalised equality when SpeciesAlias is
  // empty (i.e. the seed hasn't been run yet on this environment).
  const isCorrect = await isCorrectAnswer(snippet.staffAnswer, option);

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
    },
    update: {
      chosenOption: option,
      freeText: null,
      isCorrect,
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
    streak: {
      previous: previousStreak.currentStreak,
      current: currentStreak.currentStreak,
    },
  });
}
