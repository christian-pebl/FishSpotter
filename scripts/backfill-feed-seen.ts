/**
 * One-time backfill of User.lastFeedSeenAt (2026-08-13).
 *
 * The "N new clips since your last visit" banner measures from
 * `lastFeedSeenAt`, falling back to `User.createdAt` when it is null. That
 * fallback is correct for anyone who signs up from now on: clips added after
 * they join genuinely are new to them.
 *
 * It is wrong for the cohort that already existed when the feature shipped.
 * Those spotters have been visiting all along, so measuring from their signup
 * date would greet six long-standing accounts (including the operator's) with
 * "47 new clips since your last visit" for footage they had already seen.
 *
 * Stamping every existing user with `now()` starts everyone from the rollout
 * moment. Once stamped, the createdAt fallback never applies to them again, so
 * this only ever needs to run once.
 *
 * Only touches rows where lastFeedSeenAt IS NULL, so a re-run is a no-op and
 * can never clobber a real dismissal. Dry-run is the default.
 *
 *   npx tsx --env-file=.env.local scripts/backfill-feed-seen.ts
 *   npx tsx --env-file=.env.local scripts/backfill-feed-seen.ts -- --apply
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");

  const pending = await prisma.user.count({ where: { lastFeedSeenAt: null } });
  const alreadyStamped = await prisma.user.count({
    where: { lastFeedSeenAt: { not: null } },
  });

  console.log(`users with no feed-seen watermark: ${pending}`);
  console.log(`users already stamped (left alone): ${alreadyStamped}`);

  if (!apply) {
    console.log("\nDRY RUN. Re-run with -- --apply to write.");
    return;
  }

  const stamp = new Date();
  const result = await prisma.user.updateMany({
    where: { lastFeedSeenAt: null },
    data: { lastFeedSeenAt: stamp },
  });
  console.log(`\nstamped ${result.count} users at ${stamp.toISOString()}`);
}

main()
  .catch((e) => {
    console.error("backfill failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
