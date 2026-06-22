import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { immediateAward } from "@/lib/pebbles";
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

/**
 * Atomically compute the arrival ordinal and upsert the answer, awarding the
 * Discovery bonus only on a user's FIRST submission for the clip. Runs at
 * SERIALIZABLE isolation and retries on Postgres serialization failures
 * (Prisma code P2034) so concurrent first-spotters can't double-award.
 */
async function runSerializableAward(
  userId: string,
  snippetId: string,
  option: string,
) {
  const MAX_TX_ATTEMPTS = 3;
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const priorSpotters = await tx.answer.findMany({
            where: { snippetId },
            select: { userId: true },
          });
          const hasMine = priorSpotters.some((p) => p.userId === userId);
          // Arrival order on the clip (0 = first ever). Only meaningful on a
          // first submission; a re-guess keeps its original award — re-submitting
          // can't farm Pebbles.
          const ordinal = priorSpotters.length;
          const award = hasMine ? null : immediateAward(ordinal);

          const answer = await tx.answer.upsert({
            where: { userId_snippetId: { userId, snippetId } },
            create: {
              userId,
              snippetId,
              chosenOption: option,
              freeText: null,
              isCorrect: null,
              points: award ? award.pebbles : 0,
            },
            // Re-guess: update the call but LOCK the original award (no re-pay)
            // and leave isCorrect for the consensus cron to (re)settle.
            update: { chosenOption: option, freeText: null },
          });

          return { answer, award };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      if (
        attempt < MAX_TX_ATTEMPTS &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2034"
      ) {
        continue;
      }
      throw err;
    }
  }
}

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
  if (!(await checkAnswerRateLimit(session.user.id))) {
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
    select: { id: true },
  });
  if (!snippet) {
    return NextResponse.json({ error: "Snippet not found" }, { status: 404 });
  }

  // Sea-currency redesign: there is no PEBL reference answer any more — the
  // crowd is the authority. Every submission is a community hypothesis. At
  // submit time we award the DISCOVERY pillar only (base sighting + the
  // First-Sighting / early-spotter bonus, knowable now); the CONSENSUS payout
  // is retro-credited by the consensus-rescore cron once the clip's spotters
  // converge (see src/lib/consensus.ts). isCorrect stays null until then.
  //
  // Anti-herding: the community histogram is gated behind the user's own answer
  // (see GET /api/snippets/[id]/stats), so this submission is made blind.
  // S2-T04: compute the streak inline so the client doesn't have to make
  // a follow-up GET /api/streak. (Day-streak is a re-engagement badge only; it
  // does NOT award Pebbles — the "Tide" multiplier was cut from the economy.)
  // Read the user's own history first; it's independent of the arrival-order
  // race below, so it stays outside the transaction.
  const beforeAnswers = await prisma.answer.findMany({
    where: { userId: session.user.id },
    select: { createdAt: true },
  });
  const previousStreak = computeStreakFromAnswers(beforeAnswers);

  // The arrival ordinal (which sets the First-Sighting / early-spotter bonus)
  // is a read-then-write: two users submitting on the same clip at the same
  // instant could both read the same `priorSpotters.length` and both claim the
  // bonus. Run the read + upsert at SERIALIZABLE isolation so Postgres detects
  // the conflict, and retry the handful of times a genuine collision needs.
  // The (userId, snippetId) unique constraint already prevents duplicate rows;
  // this protects the *bonus*, the only racy part.
  const { answer, award } = await runSerializableAward(session.user.id, snippetId, option);

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

  // Running Pebble total so the client bag can sync its absolute count and
  // animate the freshly-earned delta into the pouch.
  const totals = await prisma.answer.aggregate({
    _sum: { points: true },
    where: { userId: session.user.id },
  });

  return NextResponse.json({
    answer,
    isCorrect: answer.isCorrect ?? null,
    points: answer.points,
    pebbles: {
      earned: award ? award.pebbles : 0,
      total: totals._sum.points ?? 0,
      firstSighting: award?.firstSighting ?? false,
    },
    streak: {
      previous: previousStreak.currentStreak,
      current: currentStreak.currentStreak,
    },
    unlock: null,
  });
}
