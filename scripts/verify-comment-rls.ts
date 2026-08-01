/**
 * INV-3 end-to-end proof: a Comment row written by the app (Prisma, table-owner
 * role, bypasses RLS) must NOT be readable through Supabase PostgREST with the
 * PUBLIC anon key, which ships in the browser bundle.
 *
 * An empty table returns [] whether RLS works or not, so this inserts a real row
 * first, checks the anon read, then always cleans up.
 *
 * Read-only in effect: the row it creates is deleted in the finally block.
 *
 *   npx tsx --env-file=.env.local scripts/verify-comment-rls.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const CANARY = "RLS-CANARY-" + Date.now();

async function anonRead(table: string): Promise<{ status: number; body: string }> {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?select=*`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  return { status: res.status, body: (await res.text()).slice(0, 300) };
}

async function main() {
  let createdId: string | null = null;
  let ok = true;

  try {
    const user = await prisma.user.findFirst({ select: { id: true } });
    const snippet = await prisma.snippet.findFirst({ select: { id: true } });
    if (!user || !snippet) {
      console.error("No user/snippet in DB to attach a canary to. Aborting.");
      process.exit(1);
    }

    const created = await prisma.comment.create({
      data: {
        userId: user.id,
        snippetId: snippet.id,
        reason: "note",
        body: CANARY,
        adminNote: "CANARY-SECRET-adminNote-must-never-be-readable",
      },
      select: { id: true },
    });
    createdId = created.id;
    console.log(`Inserted canary comment ${createdId} via Prisma (owner role).`);

    // Prisma can see it — proves the row really is in the table.
    const viaPrisma = await prisma.comment.count({ where: { body: CANARY } });
    console.log(`Prisma sees it: ${viaPrisma} row(s). ${viaPrisma === 1 ? "OK" : "UNEXPECTED"}`);
    if (viaPrisma !== 1) ok = false;

    // The anon key must not.
    for (const table of ["Comment", "CommentReport"]) {
      const { status, body } = await anonRead(table);
      const leaked = body.includes(CANARY) || body.includes("CANARY-SECRET");
      console.log(`anon GET /rest/v1/${table} -> HTTP ${status} ${body}`);
      if (leaked) {
        console.error(`  LEAK: anon key can read ${table} contents.`);
        ok = false;
      } else {
        console.log(`  OK: no row content exposed for ${table}.`);
      }
    }
  } finally {
    if (createdId) {
      await prisma.comment.delete({ where: { id: createdId } });
      console.log(`Cleaned up canary ${createdId}.`);
    }
    await prisma.$disconnect();
  }

  console.log(ok ? "\nINV-3 VERIFIED: RLS blocks the public anon key." : "\nINV-3 FAILED.");
  process.exit(ok ? 0 : 1);
}

main();
