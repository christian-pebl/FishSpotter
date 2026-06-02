/**
 * Q4-B1: reference-ID backfill audit.
 *
 * Diagnostic only : this script never writes. It reads every Snippet,
 * groups by `staffAnswer`, joins each distinct label against the
 * SpeciesNameMap resolution cache, and proposes a per-label action so
 * Christian can decide what to backfill / nullify before any data change:
 *
 *   keep       : already a usable species-level reference (resolves to a
 *                two-word binomial with EXACT/FUZZY confidence).
 *   keep-coarse: a shape-class word the matcher scores as a coarse reference
 *                ("Fish", "Crab", "Jellyfish" ... i.e. a SHAPE_CLASS value).
 *                Scored-by-rung (Workstream E) awards +1 for a correct-shape
 *                guess against these, so they are NO LONGER nullify candidates.
 *                Optionally backfill to a species later to unlock the full +2.
 *   backfill   : identifiable but coarse (resolves only to a higher rank,
 *                or is a recognisable common name that didn't resolve).
 *                Needs a human to supply the species-level binomial.
 *   nullify    : truly indeterminate with NO shape class ("Unknown",
 *                "Shrimp", "Various" ...). Should become a no-reference
 *                snippet so the +1 pending / consensus path applies.
 *   none       : staffAnswer is already null (no reference yet).
 *   review     : doesn't fit a bucket cleanly; eyeball it.
 *
 * Run: npm run db:audit-references            (human table)
 *      npm run db:audit-references -- --json   (machine-readable dump)
 *
 * After Christian approves the `backfill` / `nullify` proposals, a
 * separate one-off update script applies them + the retro-score SQL from
 * CLAUDE.md ("Scoring model"). This script intentionally stays read-only.
 */

import { PrismaClient } from "@prisma/client";
import { normalizeAnswer } from "../src/lib/normalize-answer";
import { SHAPE_CLASS } from "../src/lib/idguide/traits";

const prisma = new PrismaClient();

// Shape-class words the matcher scores as a valid COARSE reference. These are
// exactly the SHAPE_CLASS enum values that buildShapeClassByForm() maps to
// themselves in answer-matching.ts, so a guess of the right shape earns
// POINTS_SHAPE_CLASS (+1) against them. Under scored-by-rung these are NOT
// nullify candidates — they are kept as coarse references. Keep this in sync
// with the enum (importing it guarantees that).
const SHAPE_CLASS_WORDS = new Set(SHAPE_CLASS.map((s) => normalizeAnswer(s)));

// Labels that carry NO shape class either : truly indeterminate, or a coarse
// group with no gate tile (shrimp/prawn). These should become no-reference
// snippets rather than be scored against.
const TRULY_INDETERMINATE = new Set([
  "shrimp",
  "prawn",
  "unknown",
  "unidentified",
  "unidentifiable",
  "indeterminate",
  "various",
  "multiple",
  "none",
  "na",
  "n a",
]);

type Action = "keep" | "keep-coarse" | "backfill" | "nullify" | "none" | "review";

interface LabelRow {
  staffAnswer: string | null;
  count: number;
  resolvedScientific: string | null;
  confidence: string | null;
  action: Action;
  reason: string;
}

function classify(
  staffAnswer: string | null,
  resolved: { scientificName: string | null; confidence: string | null } | undefined,
): { action: Action; reason: string } {
  if (staffAnswer === null) {
    return { action: "none", reason: "already no-reference (pending path applies)" };
  }

  const norm = normalizeAnswer(staffAnswer);
  if (SHAPE_CLASS_WORDS.has(norm)) {
    return {
      action: "keep-coarse",
      reason: `shape-class reference ("${norm}") — scores +1 for a correct-shape guess; optionally backfill to a species for +2`,
    };
  }
  if (norm === "" || TRULY_INDETERMINATE.has(norm)) {
    return { action: "nullify", reason: "indeterminate label, no shape class — make it a no-reference snippet" };
  }

  const sci = resolved?.scientificName ?? null;
  const conf = resolved?.confidence ?? null;

  if (sci) {
    const isBinomial = sci.trim().split(/\s+/).length >= 2;
    if (isBinomial && (conf === "EXACT" || conf === "FUZZY")) {
      return { action: "keep", reason: `resolves to ${sci} (${conf})` };
    }
    if (conf === "HIGHERRANK" || !isBinomial) {
      return { action: "backfill", reason: `resolves only to higher rank: ${sci} (${conf ?? "?"})` };
    }
    return { action: "review", reason: `resolved ${sci} but confidence ${conf ?? "?"}` };
  }

  // Unresolved but not obviously generic : a recognisable common name the
  // name-map hasn't matched. Worth a human backfill to a binomial.
  return { action: "backfill", reason: "recognisable label but unresolved in SpeciesNameMap" };
}

async function main() {
  const wantJson = process.argv.includes("--json");

  const snippets = await prisma.snippet.findMany({
    select: { staffAnswer: true },
  });

  // Group by normalised key so case/whitespace variants ("Common Whiting"
  // and "Common whiting") collapse to one row. Null is its own bucket.
  // Track the most common raw surface form for display.
  const counts = new Map<string | null, number>();
  const labelForms = new Map<string, Map<string, number>>();
  for (const s of snippets) {
    if (s.staffAnswer === null) {
      counts.set(null, (counts.get(null) ?? 0) + 1);
      continue;
    }
    const key = normalizeAnswer(s.staffAnswer);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const forms = labelForms.get(key) ?? new Map<string, number>();
    forms.set(s.staffAnswer.trim(), (forms.get(s.staffAnswer.trim()) ?? 0) + 1);
    labelForms.set(key, forms);
  }
  const displayLabel = (key: string): string => {
    const forms = labelForms.get(key);
    if (!forms) return key;
    return [...forms.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };

  // Resolution cache keyed by normalised common name.
  const nameMap = await prisma.speciesNameMap.findMany({
    select: { commonName: true, scientificName: true, confidence: true },
  });
  const resolveByNorm = new Map<string, { scientificName: string | null; confidence: string | null }>();
  for (const m of nameMap) {
    resolveByNorm.set(normalizeAnswer(m.commonName), {
      scientificName: m.scientificName,
      confidence: m.confidence,
    });
  }

  const rows: LabelRow[] = [];
  for (const [key, count] of counts) {
    const resolved = key === null ? undefined : resolveByNorm.get(key);
    const label = key === null ? null : displayLabel(key);
    const { action, reason } = classify(label, resolved);
    rows.push({
      staffAnswer: label,
      count,
      resolvedScientific: resolved?.scientificName ?? null,
      confidence: resolved?.confidence ?? null,
      action,
      reason,
    });
  }

  // Most-frequent first; null bucket sorts on its count like any other.
  rows.sort((a, b) => b.count - a.count);

  if (wantJson) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  const totalSnippets = snippets.length;
  const byAction = rows.reduce<Record<Action, { labels: number; snippets: number }>>(
    (acc, r) => {
      acc[r.action] = acc[r.action] ?? { labels: 0, snippets: 0 };
      acc[r.action].labels += 1;
      acc[r.action].snippets += r.count;
      return acc;
    },
    {} as Record<Action, { labels: number; snippets: number }>,
  );

  console.log(`\nReference-ID audit: ${totalSnippets} snippet(s), ${rows.length} distinct label(s)\n`);
  console.log(
    "ACTION      n   LABEL".padEnd(50) +
      "RESOLVED / REASON",
  );
  console.log("-".repeat(98));
  for (const r of rows) {
    const label = r.staffAnswer === null ? "(null, no reference)" : r.staffAnswer;
    const left = `${r.action.toUpperCase().padEnd(11)} ${String(r.count).padStart(2)}  ${label}`;
    console.log(`${left.padEnd(50)}${r.reason}`);
  }

  console.log("\nSummary by proposed action (labels / snippets):");
  for (const action of ["keep", "keep-coarse", "backfill", "nullify", "review", "none"] as Action[]) {
    const a = byAction[action];
    if (a) console.log(`  ${action.padEnd(11)} ${a.labels} label(s)  /  ${a.snippets} snippet(s)`);
  }
  console.log(
    "\nNext: `keep` and `keep-coarse` need no action (coarse refs already score\n" +
      "+1 by shape under scored-by-rung). Review the `backfill` rows (supply a\n" +
      "species binomial to unlock +2) and `nullify` rows (set staffAnswer = NULL,\n" +
      "then retro-score the existing Answer rows — see CLAUDE.md > Scoring model).\n",
  );
}

main()
  .catch((err) => {
    console.error("Audit failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
