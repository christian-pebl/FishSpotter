/**
 * Q4-B1 (execution): apply approved reference-ID backfills / nullifies and
 * retro-score the affected Answer rows.
 *
 * This is the WRITE counterpart to scripts/audit-reference-ids.ts. Run the
 * audit first, get Christian's sign-off on the proposed actions, then fill
 * in the two maps below and run this.
 *
 * SAFETY: dry-run by default. It prints exactly what it WOULD change and
 * touches nothing. Pass `--apply` to actually write. Every write happens
 * inside a single transaction so a mid-run failure rolls back cleanly.
 *
 *   npm run db:backfill-references              # dry-run (safe, default)
 *   npm run db:backfill-references -- --apply   # write
 *
 * What it does, per affected snippet:
 *   - NULLIFY: set Snippet.staffAnswer = null. Every Answer for that snippet
 *     becomes isCorrect = null, points = 1 (POINTS_PENDING_REF) : the
 *     no-reference pending path. (Consensus retro-bonus may later add +2.)
 *   - BACKFILL: set Snippet.staffAnswer = <binomial>. Every Answer is
 *     re-matched alias-aware against the new reference: matched -> isCorrect
 *     true / points 2; else isCorrect false / points 0.
 *
 * The matcher logic mirrors src/lib/answer-matching.ts (matchWithAliases).
 * It is replicated here rather than imported because that module imports via
 * the "@/" path alias, which tsx does not resolve in scripts.
 */

import { PrismaClient } from "@prisma/client";
import { normalizeAnswer, normalizeForMatch } from "../src/lib/normalize-answer";

const prisma = new PrismaClient();

// Keep in sync with src/lib/answer-matching.ts.
const POINTS_CORRECT_REF = 2;
const POINTS_PENDING_REF = 1;
const POINTS_INCORRECT = 0;

// ---------------------------------------------------------------------------
// EDIT THESE TWO after the audit is approved.
// ---------------------------------------------------------------------------

// Snippet.staffAnswer values (exact surface form, case-insensitive match on
// the normalised key) to clear to NULL. The audit flagged these as having no
// species information. Comparison is by normalizeAnswer() so "Fish"/"fish"
// both match.
const NULLIFY: string[] = [
  "Fish",
  "Crab",
  "Jellyfish",
];

// Map of existing staffAnswer label -> approved species-level binomial.
// Leave empty until Christian supplies the binomials. Example shape:
//   "Common Whiting": "Merlangius merlangus",
//   "Juvenile Cod":   "Gadus morhua",
// "Flatfish", "Scooter", "Gastropod" are NOT species-level; either resolve
// them to a binomial here or move them into NULLIFY.
const BACKFILL: Record<string, string> = {};

// ---------------------------------------------------------------------------

interface AliasEntry {
  canonical: string;
  aliases: string[];
}

/** Pure matcher : mirrors matchWithAliases in src/lib/answer-matching.ts. */
function match(
  staffAnswer: string | null,
  userOption: string,
  aliases: AliasEntry[],
): { isCorrect: boolean | null; points: number } {
  if (staffAnswer === null) {
    return { isCorrect: null, points: POINTS_PENDING_REF };
  }
  const normalizedStaff = normalizeAnswer(staffAnswer);
  const keyStaff = normalizeForMatch(staffAnswer);
  const keyOption = normalizeForMatch(userOption);

  if (keyStaff === keyOption) {
    return { isCorrect: true, points: POINTS_CORRECT_REF };
  }
  const entry = aliases.find((e) => {
    if (normalizeAnswer(e.canonical) === normalizedStaff) return true;
    return e.aliases.some((a) => normalizeAnswer(a) === normalizedStaff);
  });
  if (!entry) return { isCorrect: false, points: POINTS_INCORRECT };

  const acceptable = [entry.canonical, ...entry.aliases];
  const matched = acceptable.some((f) => normalizeForMatch(f) === keyOption);
  return matched
    ? { isCorrect: true, points: POINTS_CORRECT_REF }
    : { isCorrect: false, points: POINTS_INCORRECT };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const aliases = await prisma.speciesAlias.findMany({
    select: { canonical: true, aliases: true },
  });

  const nullifyKeys = new Set(NULLIFY.map((l) => normalizeAnswer(l)));
  const backfillByKey = new Map<string, string>();
  for (const [label, binomial] of Object.entries(BACKFILL)) {
    backfillByKey.set(normalizeAnswer(label), binomial);
  }

  // Pull every snippet that has a reference, with its answers.
  const snippets = await prisma.snippet.findMany({
    where: { staffAnswer: { not: null } },
    select: {
      id: true,
      externalId: true,
      staffAnswer: true,
      answers: { select: { id: true, chosenOption: true, isCorrect: true, points: true } },
    },
  });

  type Plan = {
    snippetId: string;
    externalId: string;
    from: string;
    to: string | null;
    kind: "nullify" | "backfill";
    answerUpdates: { id: string; isCorrect: boolean | null; points: number }[];
  };
  const plans: Plan[] = [];

  for (const s of snippets) {
    if (s.staffAnswer === null) continue;
    const key = normalizeAnswer(s.staffAnswer);
    let to: string | null | undefined;
    let kind: "nullify" | "backfill" | undefined;

    if (nullifyKeys.has(key)) {
      to = null;
      kind = "nullify";
    } else if (backfillByKey.has(key)) {
      to = backfillByKey.get(key)!;
      kind = "backfill";
    } else {
      continue; // not in scope
    }

    const answerUpdates = s.answers.map((a) => {
      const r = match(to ?? null, a.chosenOption, aliases);
      return { id: a.id, isCorrect: r.isCorrect, points: r.points };
    });
    plans.push({ snippetId: s.id, externalId: s.externalId, from: s.staffAnswer, to, kind, answerUpdates });
  }

  if (plans.length === 0) {
    console.log(
      "\nNothing to do. NULLIFY / BACKFILL maps matched no snippets.\n" +
        "Run `npm run db:audit-references` and populate the maps in this script.\n",
    );
    return;
  }

  const totalAnswers = plans.reduce((n, p) => n + p.answerUpdates.length, 0);
  console.log(`\n${apply ? "APPLYING" : "DRY-RUN"}: ${plans.length} snippet(s), ${totalAnswers} answer(s) to re-score\n`);
  for (const p of plans) {
    console.log(
      `  [${p.kind}] ${p.externalId}: "${p.from}" -> ${p.to === null ? "NULL" : `"${p.to}"`}  ` +
        `(${p.answerUpdates.length} answer(s))`,
    );
  }

  if (!apply) {
    console.log("\nDry-run only. Re-run with `-- --apply` to write these changes.\n");
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const p of plans) {
      await tx.snippet.update({ where: { id: p.snippetId }, data: { staffAnswer: p.to } });
      for (const u of p.answerUpdates) {
        await tx.answer.update({
          where: { id: u.id },
          data: { isCorrect: u.isCorrect, points: u.points },
        });
      }
    }
  });

  console.log(`\nDone. Updated ${plans.length} snippet(s) and re-scored ${totalAnswers} answer(s).`);
  console.log("Note: consensus retro-bonus for newly no-reference snippets applies on the next cron tick.\n");
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
