/**
 * Retro-score pending answers when a staffAnswer is backfilled.
 *
 * When a Snippet that had no reference identification (staffAnswer=null)
 * later gets one backfilled, any existing Answer rows that were in the
 * pending state (isCorrect=null, points=POINTS_PENDING_REF=1) are NOT
 * automatically rescored. This script finds all such answers and scores
 * them using the same alias-aware matchAnswer() logic as the live quiz.
 *
 * Idempotent: only touches Answer rows where isCorrect IS NULL. Rows
 * already scored (isCorrect=true or isCorrect=false) are skipped.
 *
 * Usage:
 *   npm run db:retro-score             # apply updates
 *   npm run db:retro-score -- --dry-run  # preview only, no writes
 */

import { PrismaClient } from "@prisma/client";
import { matchWithAliases, type AliasEntry } from "@/lib/answer-matching";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

async function loadAliases(): Promise<AliasEntry[]> {
  const rows = await prisma.speciesAlias.findMany({
    select: { canonical: true, aliases: true },
  });
  return rows;
}

async function main() {
  if (DRY_RUN) {
    console.log("[dry-run] No writes will be made.");
  }

  // Load alias table once — only 26 rows, cheaper than per-answer queries.
  const aliases = await loadAliases();
  console.log(`Loaded ${aliases.length} alias entries.`);

  // Find all snippets that have a reference AND at least one pending answer.
  const snippets = await prisma.snippet.findMany({
    where: {
      staffAnswer: { not: null },
      answers: {
        some: { isCorrect: null },
      },
    },
    select: {
      id: true,
      externalId: true,
      staffAnswer: true,
      answers: {
        where: { isCorrect: null },
        select: {
          id: true,
          chosenOption: true,
          points: true,
        },
      },
    },
  });

  if (snippets.length === 0) {
    console.log("No snippets with pending answers found. Nothing to do.");
    return;
  }

  console.log(
    `Found ${snippets.length} snippet(s) with pending answers to rescore.`,
  );

  let totalAnswers = 0;
  let totalCorrect = 0;
  let totalIncorrect = 0;

  for (const snippet of snippets) {
    // staffAnswer is guaranteed non-null by the query filter above,
    // but TypeScript doesn't know that — assert it.
    const staffAnswer = snippet.staffAnswer as string;
    const pending = snippet.answers;

    console.log(
      `\nSnippet ${snippet.externalId} (staffAnswer="${staffAnswer}"): ${pending.length} pending answer(s)`,
    );

    type UpdateRow = {
      id: string;
      isCorrect: boolean;
      points: number;
      chosenOption: string;
    };

    const updates: UpdateRow[] = pending.map((answer) => {
      const result = matchWithAliases(staffAnswer, answer.chosenOption, aliases);
      // matchWithAliases with a non-null staffAnswer always returns a
      // boolean isCorrect (never null), but the type allows null — narrow it.
      const isCorrect = result.isCorrect === true;
      return {
        id: answer.id,
        isCorrect,
        points: result.points,
        chosenOption: answer.chosenOption,
      };
    });

    for (const u of updates) {
      const verdict = u.isCorrect ? "correct" : "incorrect";
      console.log(
        `  Answer ${u.id}: "${u.chosenOption}" -> ${verdict} (${u.points} pts)`,
      );
    }

    const correctCount = updates.filter((u) => u.isCorrect).length;
    const incorrectCount = updates.length - correctCount;
    totalAnswers += updates.length;
    totalCorrect += correctCount;
    totalIncorrect += incorrectCount;

    if (DRY_RUN) {
      console.log(`  [dry-run] Would update ${updates.length} answer(s).`);
      continue;
    }

    // Batch all updates for this snippet in a single transaction.
    await prisma.$transaction(
      updates.map((u) =>
        prisma.answer.update({
          where: { id: u.id },
          data: {
            isCorrect: u.isCorrect,
            points: u.points,
          },
        }),
      ),
    );
    console.log(`  Updated ${updates.length} answer(s).`);
  }

  console.log("\n--- Summary ---");
  console.log(`Snippets processed: ${snippets.length}`);
  console.log(`Answers rescored:   ${totalAnswers}`);
  console.log(`  Correct:          ${totalCorrect}`);
  console.log(`  Incorrect:        ${totalIncorrect}`);
  if (DRY_RUN) {
    console.log("[dry-run] No changes written to the database.");
  }
}

main()
  .catch((err) => {
    console.error("Retro-score failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
