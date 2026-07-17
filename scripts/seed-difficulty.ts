/**
 * Difficulty ladder (Jul 2026): seed Snippet.difficultyScore from apparent
 * organism size — the strongest intrinsic signal available today (Phase 0
 * validation: 73/77 active clips have a real bbox track, 262x spread in
 * median box area, and the ranking passes a gut check — small crabs/
 * gastropods sink to the bottom, larger/closer subjects rise to the top).
 * Confusability (confusion-matrix.ts) was considered too, but with only
 * ~24 wrong answers recorded so far and half the references still coarse
 * placeholders ("Fish"/"Crab"), it isn't a reliable signal yet — this is
 * revisited once there's real per-clip answer volume (see
 * src/lib/feed-ordering.ts doc comment).
 *
 * Score convention: 1 = easiest (largest apparent size, corpus-relative
 * percentile), 0 = hardest. Clips with no usable bbox signal (manual-track-
 * only zero-size points, or neither) are left at the schema default (0.5,
 * neutral) rather than guessed.
 *
 * Writes via $executeRaw rather than the typed Prisma Client API — this
 * script was authored while the generated client hadn't yet been
 * regenerated for the new column (a native-binary file lock from other
 * concurrent dev processes blocked `prisma generate`). Raw SQL sidesteps
 * that entirely and remains correct once the client catches up; fold this
 * back to `prisma.snippet.update()` then if you're touching this file again.
 *
 * Idempotent — safe to re-run any time (e.g. after `npm run db:sync` adds
 * new clips); recomputes percentiles fresh across the full active corpus.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-difficulty.ts
 *      npx tsx --env-file=.env.local scripts/seed-difficulty.ts -- --dry-run
 */
import { PrismaClient } from "@prisma/client";
import { safeParseJson } from "../src/lib/safe-json";

const prisma = new PrismaClient();

interface BBoxFrame {
  frame_clip: number;
  x_norm: number;
  y_norm: number;
  w_norm: number;
  h_norm: number;
}

function medianBoxArea(boxes: BBoxFrame[]): number | null {
  const areas = boxes
    .map((b) => b.w_norm * b.h_norm)
    .filter((a) => Number.isFinite(a) && a > 0)
    .sort((a, b) => a - b);
  if (areas.length === 0) return null;
  const mid = Math.floor(areas.length / 2);
  return areas.length % 2 === 0 ? (areas[mid - 1] + areas[mid]) / 2 : areas[mid];
}

/** Percentile rank of `value` within `sorted` (ascending), 0..1. */
function percentileRank(value: number, sorted: number[]): number {
  if (sorted.length <= 1) return 0.5;
  let below = 0;
  for (const v of sorted) {
    if (v < value) below += 1;
    else break;
  }
  return below / (sorted.length - 1);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const snippets = await prisma.snippet.findMany({
    where: { excluded: false },
    select: { id: true, externalId: true, bboxJson: true },
  });

  const withArea: Array<{ id: string; externalId: string; area: number }> = [];
  let noSignal = 0;

  for (const s of snippets) {
    const boxes = (safeParseJson(s.bboxJson) as BBoxFrame[] | null) ?? [];
    const area = boxes.length > 0 ? medianBoxArea(boxes) : null;
    if (area != null) {
      withArea.push({ id: s.id, externalId: s.externalId, area });
    } else {
      noSignal += 1;
    }
  }

  const sortedAreas = withArea.map((r) => r.area).sort((a, b) => a - b);

  const updates = withArea.map((r) => ({
    id: r.id,
    externalId: r.externalId,
    // Percentile of size = percentile of "easiness"; area rank IS the score.
    difficultyScore: percentileRank(r.area, sortedAreas),
  }));

  console.log(
    `\n${snippets.length} active snippets: ${updates.length} scored from bbox size, ` +
      `${noSignal} left at the neutral default (0.5) — no usable bbox signal.\n`,
  );

  if (dryRun) {
    console.log("Dry run — sample of computed scores:\n");
    for (const u of updates.slice(0, 10)) {
      console.log(`  ${u.difficultyScore.toFixed(3)}  ${u.externalId}`);
    }
    console.log(`  ... (${Math.max(0, updates.length - 10)} more)\n`);
    return;
  }

  let written = 0;
  for (const u of updates) {
    await prisma.$executeRaw`UPDATE "Snippet" SET "difficultyScore" = ${u.difficultyScore} WHERE id = ${u.id}`;
    written += 1;
  }

  console.log(`Wrote difficultyScore for ${written} snippet(s).\n`);
}

main()
  .catch((err) => {
    console.error("seed-difficulty failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
