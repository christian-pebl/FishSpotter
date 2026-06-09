/**
 * Enable + verify row-level security on every `public` table.
 *
 * Applies prisma/rls.sql (a dynamic, idempotent loop that turns RLS on for all
 * current and future public tables), then audits pg_class and reports the RLS
 * state of every table. Exits non-zero if ANY public table still has RLS off,
 * so it doubles as a security gate you can run in CI.
 *
 * Why this exists: FishSpotter talks to the DB only via Prisma (owner role,
 * bypasses RLS). The Supabase anon key is public (ships in the browser), so an
 * RLS-off public table is readable by anyone through PostgREST. Enabling RLS
 * with no policy shuts that door without affecting the app. See prisma/rls.sql.
 *
 *   npm run db:enable-rls            # apply + verify
 *   npm run db:enable-rls -- --check # verify only (no writes); non-zero if any table is unprotected
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type RlsRow = { table: string; rls: boolean };

async function main() {
  const checkOnly = process.argv.includes("--check");

  if (!checkOnly) {
    const sql = readFileSync(join(process.cwd(), "prisma", "rls.sql"), "utf8");
    await prisma.$executeRawUnsafe(sql);
    console.log("Applied prisma/rls.sql (RLS enabled on all public tables).\n");
  }

  const rows = await prisma.$queryRawUnsafe<RlsRow[]>(
    `SELECT c.relname AS table, c.relrowsecurity AS rls
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
       AND c.relname NOT LIKE '\\_prisma\\_%'
     ORDER BY c.relname`,
  );

  const unprotected = rows.filter((r) => !r.rls);
  for (const r of rows) {
    console.log(`  ${r.rls ? "RLS ON " : "RLS OFF"}  public.${r.table}`);
  }
  console.log(
    `\n${rows.length} public tables — ${rows.length - unprotected.length} protected, ${unprotected.length} unprotected.`,
  );

  if (unprotected.length > 0) {
    console.error(
      `\nFAIL: ${unprotected.length} table(s) still have RLS disabled: ` +
        unprotected.map((r) => r.table).join(", "),
    );
    process.exitCode = 1;
  } else {
    console.log("\nOK: every public table has RLS enabled.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
