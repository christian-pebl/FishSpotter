/**
 * Score every LIVE Spot It tile silhouette for how well it represents its
 * group, using the Gemini vision tool (src/lib/biodiversity/gemini-vision.ts).
 * Produces measurable 0..100 metrics so the icon set can be tracked over time.
 *
 *   npx tsx --env-file=.env.local scripts/score-silhouettes.ts
 *   npm run score:silhouettes -- --json
 *
 * Writes a JSON baseline to implementation/2026-06-17/silhouette-scores.json.
 * Re-run after editing any SVG and diff the baseline to see the delta.
 *
 * Read-only w.r.t. the DB and the app. Needs GEMINI_API_KEY in .env.local.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { assessSilhouette, type SilhouetteScore } from "@/lib/biodiversity/gemini-vision";
import { SUB_SPLITS } from "@/lib/idflow/body-forms";
import { SHAPE_CLASS, type ShapeClass } from "@/lib/idguide/traits";

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "implementation", "2026-06-17");
const SIL = join(ROOT, "public", "silhouettes");
const JSON_ONLY = process.argv.includes("--json");

// Rung-1 shape-gate tile labels (mirrors ShapeGate.tsx TILES; inlined to avoid
// importing the client component into a node script).
const SHAPE_LABEL: Record<ShapeClass, string> = {
  fish: "Fish",
  flatfish: "Flatfish",
  crab: "Crab",
  jellyfish: "Jellyfish",
  starfish: "Starfish",
  gastropod: "Snail / slug",
  squid: "Squid",
};

type Item = {
  id: string; // unique key for the baseline
  rung: "1-shape" | "2-form";
  file: string; // absolute path to the SVG
  label: string; // tile label
  groupContext: string;
  siblings: string[];
};

function buildInventory(): Item[] {
  const items: Item[] = [];

  // Rung 1: the 7 shape-class tiles.
  const shapeLabels = SHAPE_CLASS.map((c) => SHAPE_LABEL[c]);
  for (const cls of SHAPE_CLASS) {
    const file = join(SIL, `${cls}.svg`);
    if (!existsSync(file)) continue;
    items.push({
      id: `shape:${cls}`,
      rung: "1-shape",
      file,
      label: SHAPE_LABEL[cls],
      groupContext: "the top-level shape category in the gate (what kind of animal it is)",
      siblings: shapeLabels.filter((l) => l !== SHAPE_LABEL[cls]),
    });
  }

  // Rung 2: every option of every sub-split that has a real SVG.
  for (const cls of Object.keys(SUB_SPLITS) as ShapeClass[]) {
    const split = SUB_SPLITS[cls]!;
    const labels = split.options.map((o) => o.label);
    for (const o of split.options) {
      const file = join(SIL, "forms", `${o.value}.svg`);
      if (!existsSync(file)) continue;
      items.push({
        id: `form:${cls}:${o.value}`,
        rung: "2-form",
        file,
        label: o.label,
        groupContext: `a sub-type of "${SHAPE_LABEL[cls]}" (the "${split.prompt}" picker)`,
        siblings: labels.filter((l) => l !== o.label),
      });
    }
  }
  return items;
}

/** Render an SVG to a base64 PNG: dark shape on white, isolating the shape so
 * the score reflects the silhouette's intrinsic legibility (the app tints it
 * teal-on-dark, which only reduces shape contrast). */
async function renderPng(file: string): Promise<string> {
  const svg = readFileSync(file, "utf8").replace(/currentColor/g, "#17252A");
  const png = await sharp(Buffer.from(svg))
    .resize(360, 360, { fit: "contain", background: "#ffffff" })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
  return png.toString("base64");
}

async function main() {
  const items = buildInventory();
  if (!JSON_ONLY) console.log(`Scoring ${items.length} live silhouettes...\n`);

  const rows: Array<{ item: Item; score?: SilhouetteScore; error?: string }> = [];
  let inTok = 0;
  let outTok = 0;

  for (const item of items) {
    let base64: string;
    try {
      base64 = await renderPng(item.file);
    } catch (e) {
      rows.push({ item, error: `render: ${(e as Error).message}` });
      continue;
    }
    // Pace calls to stay under the Gemini per-minute rate limit (avoids 429
    // backoff churn that otherwise makes the run unpredictably slow).
    await new Promise((r) => setTimeout(r, 1500));
    const res = await assessSilhouette({
      label: item.label,
      groupContext: item.groupContext,
      siblings: item.siblings,
      imageBase64: base64,
      mimeType: "image/png",
    });
    if (res.ok) {
      rows.push({ item, score: res.score });
      inTok += res.usage.input;
      outTok += res.usage.output;
      if (!JSON_ONLY) {
        const s = res.score;
        console.log(
          `${String(s.score).padStart(3)} ${s.verdict.padEnd(9)} ${item.label.padEnd(22)} ` +
            `rec=${s.recognizability} acc=${s.diagnosticAccuracy} clr=${s.clarity} dst=${s.distinctiveness} ` +
            `readsAs="${s.readsAs}"${s.confusableWith && s.confusableWith !== "none" ? ` !${s.confusableWith}` : ""}`,
        );
      }
    } else {
      rows.push({ item, error: res.error });
      if (!JSON_ONLY) console.log(`ERR ${item.label}: ${res.error}`);
    }
  }

  const out = {
    generatedFor: "silhouettes",
    model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash",
    count: rows.length,
    tokens: { input: inTok, output: outTok },
    items: rows.map((r) => ({
      id: r.item.id,
      rung: r.item.rung,
      label: r.item.label,
      file: r.item.file.replace(ROOT, "").replace(/\\/g, "/"),
      ...(r.score ? { ...r.score } : { error: r.error }),
    })),
  };
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const dest = join(OUT_DIR, "silhouette-scores.json");
  // Don't clobber a good baseline with an all-error run (e.g. a Gemini 503
  // outage): only write when at least one item scored.
  const okCount = rows.filter((r) => r.score).length;
  if (okCount === 0) {
    console.error("All items errored (likely a Gemini outage); baseline NOT overwritten.");
    process.exit(1);
  }
  writeFileSync(dest, JSON.stringify(out, null, 2) + "\n", "utf8");

  if (JSON_ONLY) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    const scored = rows.filter((r) => r.score).map((r) => r.score!.score);
    const mean = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : 0;
    console.log(`\nMean score ${mean} over ${scored.length} silhouettes. Tokens ${inTok}+${outTok}.`);
    console.log(`Baseline -> ${dest.replace(ROOT, "")}`);
  }
}

main();
