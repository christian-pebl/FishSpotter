/**
 * Trace-coverage audit (read-only).
 *
 * Answers one question: does EVERY snippet now have a series of centre points
 * that will actually draw a fish TRACE in the feed, or do some only show the
 * concentric-ring "locate the fish" highlight with no line?
 *
 * It mirrors FeedCard's trail source-selection + draw rules exactly:
 *   - source  = manualTrack (preferred) else bbox            (FeedCard `bboxes` memo)
 *   - usable  = a point whose coords are all finite          (`hasUsableBox`)
 *   - centre  = (x_norm + w_norm/2, y_norm + h_norm/2)
 *   - a line is drawn only when >= 2 usable centres accumulate, and points are
 *     deduped at ~3px, so a near-stationary track yields no visible line
 *     (`buildSmoothPath` returns "" for < 2 points).
 *
 * Per snippet it reports the rendered outcome:
 *   traces       : >= 2 usable centres that move enough -> a real trace draws.
 *   near-static  : >= 2 centres but they barely move -> ring only, no line.
 *   single-point : exactly 1 usable centre -> ring only (a static dot).
 *   no-data      : no usable manual/bbox points -> NO overlay at all
 *                  (no trace AND no ping button, since both gate on hasBboxes).
 *
 * Run: npx tsx --env-file=.env.local scripts/audit-traces.ts
 * Flags: --all (list every snippet), --json, --source-manual-only.
 */

import { PrismaClient } from "@prisma/client";
import { isSnippetExcluded } from "../src/lib/snippet-blocklist";

const prisma = new PrismaClient();

// Movement floor (normalized 0..1 of the rendered frame) below which the trail
// dedup never accumulates a 2nd point, so no line is visible. The renderer's
// real step is ~3px / renderedMax (~0.002-0.004); 0.01 (1% of frame) is a safe,
// slightly-conservative "a human would see a line" bar.
const MOVE_FLOOR = 0.01;

interface Pt { frame_clip?: number; x_norm?: number; y_norm?: number; w_norm?: number; h_norm?: number }

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function parse(json: string | null): Pt[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as Pt[]) : [];
  } catch {
    return [];
  }
}

// manualTrack points have no w/h (treated as 0); bbox points need all four.
function usableCentres(points: Pt[], isManual: boolean): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const p of points) {
    const w = isManual ? 0 : p.w_norm;
    const h = isManual ? 0 : p.h_norm;
    if (finite(p.x_norm) && finite(p.y_norm) && finite(w) && finite(h)) {
      out.push({ x: p.x_norm + w / 2, y: p.y_norm + h / 2 });
    }
  }
  return out;
}

// Diameter (max pairwise distance) of the centre cloud + cumulative path length.
function spread(centres: { x: number; y: number }[]) {
  let diameter = 0;
  let path = 0;
  for (let i = 0; i < centres.length; i++) {
    if (i > 0) path += Math.hypot(centres[i].x - centres[i - 1].x, centres[i].y - centres[i - 1].y);
    for (let j = i + 1; j < centres.length; j++) {
      diameter = Math.max(diameter, Math.hypot(centres[i].x - centres[j].x, centres[i].y - centres[j].y));
    }
  }
  return { diameter, path };
}

type Outcome = "traces" | "near-static" | "single-point" | "no-data" | "excluded";

async function main() {
  const argv = process.argv.slice(2);
  const showAll = argv.includes("--all");
  const asJson = argv.includes("--json");

  const snippets = await prisma.snippet.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, externalId: true, site: true, deployment: true, manualTrackJson: true, bboxJson: true },
  });

  const rows = snippets.map((s) => {
    const manual = parse(s.manualTrackJson);
    const bbox = parse(s.bboxJson);
    const usesManual = manual.length > 0;
    const source = usesManual ? "manual" : bbox.length > 0 ? "bbox" : "none";
    const centres = usesManual ? usableCentres(manual, true) : usableCentres(bbox, false);
    const { diameter, path } = spread(centres);

    let outcome: Outcome;
    if (isSnippetExcluded(s.externalId)) outcome = "excluded";
    else if (centres.length === 0) outcome = "no-data";
    else if (centres.length === 1) outcome = "single-point";
    else if (diameter < MOVE_FLOOR) outcome = "near-static";
    else outcome = "traces";

    return {
      externalId: s.externalId,
      where: `${s.site} ${s.deployment}`.trim(),
      source,
      rawPoints: usesManual ? manual.length : bbox.length,
      usablePoints: centres.length,
      diameter: +diameter.toFixed(4),
      pathLen: +path.toFixed(3),
      outcome,
    };
  });

  if (asJson) {
    console.log(JSON.stringify(rows, null, 2));
    await prisma.$disconnect();
    return;
  }

  const by = (o: Outcome) => rows.filter((r) => r.outcome === o);
  const traces = by("traces");
  // "excluded" snippets are intentionally hidden from the app, so they are not
  // a trace-coverage problem.
  const problems = rows.filter((r) => r.outcome !== "traces" && r.outcome !== "excluded");

  const list = showAll ? rows : problems;
  if (list.length) {
    console.log(`\n${showAll ? "All snippets" : "Snippets that will NOT draw a trace"}:`);
    console.log("outcome       source  raw  usable  diameter  externalId");
    console.log("-".repeat(78));
    for (const r of list.sort((a, b) => a.outcome.localeCompare(b.outcome) || a.externalId.localeCompare(b.externalId))) {
      console.log(
        `${r.outcome.padEnd(13)} ${r.source.padEnd(6)} ${String(r.rawPoints).padStart(3)}  ${String(r.usablePoints).padStart(6)}  ${r.diameter.toFixed(4).padStart(8)}  ${r.externalId}`,
      );
    }
  }

  console.log(`\nTotals (${rows.length} snippets):`);
  console.log(`  traces       ${traces.length}  (>=2 moving centre points -> a line draws)`);
  console.log(`  near-static  ${by("near-static").length}  (>=2 points but barely move -> ring only)`);
  console.log(`  single-point ${by("single-point").length}  (1 point -> ring only)`);
  console.log(`  no-data      ${by("no-data").length}  (no points -> no trace AND no ring/ping)`);
  console.log(`  excluded     ${by("excluded").length}  (intentionally hidden from the app)`);
  const manualCount = rows.filter((r) => r.source === "manual").length;
  console.log(`\n  source: ${manualCount} use a manual centre-track, ${rows.filter((r) => r.source === "bbox").length} fall back to auto bbox, ${rows.filter((r) => r.source === "none").length} have neither.`);
  if (problems.length === 0) {
    console.log(`\n  ✓ Every snippet will draw a trace.`);
  } else {
    console.log(`\n  ${problems.length} snippet(s) will NOT show a trace (listed above).`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
