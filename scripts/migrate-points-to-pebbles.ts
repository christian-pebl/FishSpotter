/**
 * One-shot migration for the sea-currency redesign: scale historical
 * Answer.points into the new Pebbles range so the leaderboard stays continuous
 * (no one loses progress) without inflating the numbers wildly.
 *
 * Old scale: correct=2 / pending=1 / wrong=0. New immediate awards start at
 * base=5 and First Sighting=30, with consensus retro-credits on top. Multiplying
 * legacy points by 10 lands old totals in the same order of magnitude as the new
 * ones (Christian's steer: "multiply existing but only by ~10, don't make the
 * point count that crazy").
 *
 *   npx tsx --env-file=.env.local scripts/migrate-points-to-pebbles.ts           # dry run
 *   npx tsx --env-file=.env.local scripts/migrate-points-to-pebbles.ts --apply   # write
 *
 * NOT idempotent — running --apply twice would scale by 100. Run it exactly once,
 * after deploying the new economy, and only on a database whose Answer.points are
 * still on the legacy 0/1/2 scale.
 */

import { PrismaClient } from "@prisma/client";

const FACTOR = 10;

async function main() {
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();
  try {
    const [count, sumBefore, maxRow] = await Promise.all([
      prisma.answer.count(),
      prisma.answer.aggregate({ _sum: { points: true } }),
      prisma.answer.aggregate({ _max: { points: true } }),
    ]);
    const totalBefore = sumBefore._sum.points ?? 0;
    const maxBefore = maxRow._max.points ?? 0;

    console.log(`Answers: ${count}`);
    console.log(`Sum(points) before: ${totalBefore}  (max row: ${maxBefore})`);
    console.log(`Factor: x${FACTOR}`);
    console.log(`Sum(points) after:  ${totalBefore * FACTOR}`);

    if (maxBefore > 50) {
      console.warn(
        `\n⚠️  A row already has ${maxBefore} points — that's above the legacy ` +
          `0/1/2 scale. This DB may already be migrated or on the new economy. ` +
          `Aborting to avoid double-scaling. Inspect before forcing.`,
      );
      if (apply) process.exitCode = 1;
      return;
    }

    if (!apply) {
      console.log("\nDry run — re-run with --apply to write.");
      return;
    }

    // Single SQL UPDATE so it's atomic and fast regardless of row count.
    const updated = await prisma.$executeRawUnsafe(
      `UPDATE "Answer" SET "points" = "points" * ${FACTOR}`,
    );
    console.log(`\n✅ Scaled ${updated} Answer rows by x${FACTOR}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
