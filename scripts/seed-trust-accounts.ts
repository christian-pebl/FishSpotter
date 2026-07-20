import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Known-real accounts that bootstrap the trust graph (Pebbles anti-gaming
// Plan 1 Phase 1, docs/pebbles-anti-gaming-and-prizes-plan.md). Re-run any
// time to add more seeds later -- idempotent (updateMany is a no-op for rows
// already flagged).
const SEED_EMAILS = [
  "christian@pebl-cic.co.uk",
  "anjali@pebl-cic.co.uk",
  "daniabulhawa@gmail.com",
];

const APPLY = process.argv.includes("--apply");

async function main() {
  const matches = await prisma.user.findMany({
    where: { email: { in: SEED_EMAILS } },
    select: { id: true, email: true, isTrustSeed: true, emailVerified: true },
  });

  console.log(
    `${APPLY ? "APPLYING" : "DRY RUN"} -- ${matches.length}/${SEED_EMAILS.length} seed emails found in DB\n`,
  );
  for (const m of matches) {
    const verifiedFlag = m.emailVerified ? "" : "  <-- NOT VERIFIED (fine as a trust seed, but blocks them personally claiming a prize)";
    console.log(`  ${m.email}  isTrustSeed=${m.isTrustSeed}  emailVerified=${!!m.emailVerified}${verifiedFlag}`);
  }
  const missing = SEED_EMAILS.filter((e) => !matches.some((m) => m.email === e));
  for (const e of missing) console.log(`  ${e}  <-- NOT FOUND, skipped`);

  if (!APPLY) {
    console.log("\nDry run only -- re-run with --apply to write isTrustSeed=true.");
    return;
  }

  const result = await prisma.user.updateMany({
    where: { email: { in: SEED_EMAILS } },
    data: { isTrustSeed: true },
  });
  console.log(`\nFlagged ${result.count} account(s) as trust seeds.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
