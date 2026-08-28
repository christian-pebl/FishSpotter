/**
 * Remove the throwaway guests the tour QA harness creates (scripts/tour-qa.ts).
 *
 * The tour deliberately commits a REAL identification, so each QA run leaves a
 * guest user plus an Answer row in the database. Those answers count toward the
 * community histogram and the consensus payout, so they have to come back out
 * or the QA quietly biases the very numbers the tour is teaching about.
 *
 * Dry by default. Add --apply to delete.
 *   node node_modules/tsx/dist/cli.mjs --env-file=.env.local scripts/tour-qa-cleanup.ts
 */
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

async function main() {
  const guests = await prisma.user.findMany({
    where: { isGuest: true, displayName: { startsWith: "TourQA" } },
    select: { id: true, displayName: true, onboardedAt: true },
  });

  if (guests.length === 0) {
    console.log("No TourQA guests found. Nothing to do.");
    return;
  }

  const ids = guests.map((g) => g.id);
  const answers = await prisma.answer.findMany({
    where: { userId: { in: ids } },
    select: { id: true, userId: true, snippetId: true, chosenOption: true, points: true },
  });

  console.log(`${guests.length} QA guest(s), ${answers.length} answer(s):`);
  for (const g of guests) {
    const mine = answers.filter((a) => a.userId === g.id);
    console.log(
      `  ${g.displayName}  onboardedAt=${g.onboardedAt ? "set" : "null"}  answers=${mine.length}` +
        (mine.length ? ` (${mine.map((a) => `${a.chosenOption} +${a.points}`).join(", ")})` : ""),
    );
  }

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to delete.");
    return;
  }

  // Answers first: a consensus event can reference them, and User has cascade
  // deletes but the histogram should stop counting these before the row goes.
  const delAnswers = await prisma.answer.deleteMany({ where: { userId: { in: ids } } });
  const delUsers = await prisma.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`\nDeleted ${delAnswers.count} answer(s) and ${delUsers.count} guest(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
