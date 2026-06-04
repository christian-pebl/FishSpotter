/**
 * Auto-place diagnostic-mark rings with Gemini + a self-correcting verify loop.
 *
 * The mark COORDINATES seeded by scripts/seed-fish-marks.ts (and the invert
 * sibling) were hand-estimated first drafts and mostly sit off the feature they
 * label (see implementation/2026-06-04/species-image-audit.md). The mark TEXT is
 * sound. This tool fixes placement, and authors fresh marks for species that
 * have none, by asking Gemini to LOCALISE each named feature on the curated
 * photo, then grading the result with the same validator the audit uses and
 * re-prompting any ring still off-target.
 *
 * Two modes:
 *   relocate  - re-localise the species' EXISTING marks (P3/P4 fix). Re-points
 *               them to the current curated hero photo if they drifted onto an
 *               old one (so it also finishes a P1 photo swap).
 *   author    - CREATE marks from a feature list. The list comes from
 *               scripts/data/p2-mark-drafts.ts if present for the species, else
 *               from the species' existing marks' (label, description) text.
 *
 * Writes via Prisma (like seed-fish-marks.ts), tagged createdBy=PLACE_AUTHOR.
 * Respects the curated-photo gate: attaches only to the lowest-ordering curated
 * SpeciesImage. Everything is a DRAFT pending expert sign-off.
 *
 * Dry-run is the DEFAULT; pass --apply to write.
 *   npx tsx --env-file=.env.local scripts/place-diagnostic-marks.ts -- --mode relocate --all
 *   ...-- --mode relocate --species "Pollachius pollachius" --apply
 *   ...-- --mode author --all --apply
 * Resumable: relocate skips a species already grading overallAligned=true unless --force.
 */
import { PrismaClient } from "@prisma/client";
import { appendFileSync } from "fs";
import speciesTraitsData from "../src/data/species-traits.json";
import {
  GEMINI_MODEL,
  geminiJson,
  validateHero,
  loadImage,
  buildOverlaySvg,
  type MarkRow,
  type HeroValidation,
} from "./lib/mark-overlay";
import { P2_MARK_DRAFTS } from "./data/p2-mark-drafts";
import { REDRAFTS } from "./data/mark-redraft";
import sharp from "sharp";

// Author-mode draft source: P2 (heroless species) plus the redraft sets (trim /
// re-anchor). On a key collision REDRAFTS wins (it is the curated replacement).
const DRAFTS: Record<string, Feature[]> = { ...P2_MARK_DRAFTS, ...REDRAFTS };

const prisma = new PrismaClient();
const PLACE_AUTHOR = "gemini-place@pebl-cic.co.uk";
const LOG_PATH = "implementation/2026-06-04/placement-log.json";
const MAX_VERIFY_ROUNDS = 4;

type Catalogue = Record<string, { commonName?: string }>;
const CATALOGUE = speciesTraitsData as unknown as Catalogue;
const commonNameFor = (sci: string) => CATALOGUE[sci]?.commonName ?? sci;

function parseArgs() {
  const argv = process.argv.slice(2);
  let mode: "relocate" | "author" = "relocate";
  let species: string | undefined;
  let all = false;
  let apply = false;
  let force = false;
  let redraft = false;
  let limit: number | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mode" && argv[i + 1]) mode = argv[++i] as "relocate" | "author";
    else if (a === "--species" && argv[i + 1]) species = argv[++i];
    else if (a === "--all") all = true;
    else if (a === "--apply") apply = true;
    else if (a === "--force") force = true;
    else if (a === "--redraft") redraft = true;
    else if (a === "--limit" && argv[i + 1]) limit = Number(argv[++i]);
  }
  return { mode, species, all, apply, force, redraft, limit };
}

const clamp = (n: number, lo: number, hi: number) =>
  !Number.isFinite(n) ? lo : Math.max(lo, Math.min(hi, n));

// Gemini localisation output: one entry per requested feature. We ask for a
// box_2d in Gemini's NATIVE detection format ([ymin,xmin,ymax,xmax], 0-1000),
// which it is specifically tuned for and localises far more accurately than a
// free-form centre+radius. We convert the box to a centred ring below.
const LOCALIZE_SCHEMA = {
  type: "object",
  properties: {
    marks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          number: { type: "integer" },
          label: { type: "string" },
          visible: { type: "boolean" },
          // "point" = a small localized feature (eye, barbel, single spot, one
          // fin); "region" = a broad feature (overall colour, body shape, a
          // stripe running the length). Drives the ring-size cap.
          featureSize: { type: "string", enum: ["point", "region"] },
          box_2d: { type: "array", items: { type: "integer" } }, // [ymin,xmin,ymax,xmax] 0-1000
          confidence: { type: "integer" },
        },
        required: ["number", "label", "visible", "featureSize", "box_2d", "confidence"],
      },
    },
  },
  required: ["marks"],
} as const;

type LocalizeMark = {
  number: number;
  label: string;
  visible: boolean;
  featureSize: "point" | "region";
  box_2d: number[];
  confidence: number;
};

type Feature = { label: string; description: string };

function localizePrompt(common: string, sci: string, features: Feature[]): string {
  const list = features.map((f, i) => `  ${i + 1}. "${f.label}" — ${f.description}`).join("\n");
  return [
    `You are placing labelled circles on a reference photo of ${common} (${sci}) for an`,
    `underwater species-ID teaching tool. For each diagnostic feature below, return the`,
    `circle that best points at it ON THIS PHOTO.`,
    ``,
    `Features:`,
    list,
    ``,
    `STEP 1: First, silently locate the animal's HEAD and TAIL and note which way it`,
    `faces (left/right, angled, partly cropped). Every feature must be placed relative`,
    `to that orientation.`,
    ``,
    `STEP 2: For each feature return box_2d, a TIGHT bounding box around JUST that`,
    `feature as it appears in THIS image, format [ymin, xmin, ymax, xmax], every value`,
    `an integer 0-1000 (y from the top, x from the left). Also classify featureSize:`,
    `- "point" = a small localised feature: an eye, a chin barbel, a single spot or`,
    `  blotch, one fin, a gill-cover edge, a lip. Box it TIGHTLY around just that part,`,
    `  NOT the whole animal. A point box should be small (roughly a tenth of the body).`,
    `- "region" = a broad feature: overall body colour, body shape/outline, a stripe or`,
    `  scute-row running much of the body length. Box the whole region it covers.`,
    ``,
    `Rules:`,
    `- Centre each box on the actual feature for THIS orientation (e.g. a "tail spot" on`,
    `  a left-facing fish is on the LEFT edge; a "chin barbel" is under the head end).`,
    `- Do NOT box empty background or the wrong part of the animal. Boxes may overlap.`,
    `- If a feature is genuinely not visible in this photo, set visible=false but still`,
    `  give your best-guess box.`,
    `- confidence 0..100 = how sure you are the box is on the right spot.`,
    `Return one entry per feature, in the same order.`,
  ].join("\n");
}

function correctionPrompt(
  common: string,
  sci: string,
  features: Feature[],
  bad: Array<{ number: number; note: string }>,
): string {
  const list = bad
    .map((b) => {
      const f = features[b.number - 1];
      return `  ${b.number}. "${f?.label}" — ${f?.description}\n     Reviewer said: ${b.note}`;
    })
    .join("\n");
  return [
    `This is the SAME photo of ${common} (${sci}) with your circles already drawn on it`,
    `(numbered teal rings). A reviewer judged these circles to be MISPLACED:`,
    list,
    ``,
    `Looking at where each numbered ring currently sits versus where the feature actually`,
    `is, return a CORRECTED box_2d ([ymin, xmin, ymax, xmax], integers 0-1000, y from top,`,
    `x from left) for ONLY these numbered features. Move each box onto the real feature`,
    `and size it to bound just that feature. Also set featureSize ("point" for a small`,
    `localised part like an eye/barbel/spot/single fin, "region" for a broad whole-body`,
    `feature) so a point feature gets a small tight box, not the whole animal.`,
  ].join("\n");
}

async function localize(
  common: string,
  sci: string,
  features: Feature[],
  imageUrl: string,
): Promise<{ marks: LocalizeMark[]; width: number; height: number } | null> {
  const { buf, width, height } = await loadImage(imageUrl);
  const png = await sharp(buf).png().toBuffer();
  const r = await geminiJson(
    localizePrompt(common, sci, features),
    png.toString("base64"),
    "image/png",
    LOCALIZE_SCHEMA,
  );
  if (!r.ok) {
    console.error(`      localise failed: ${r.error}`);
    return null;
  }
  return { marks: (r.data as { marks: LocalizeMark[] }).marks, width, height };
}

async function correct(
  common: string,
  sci: string,
  features: Feature[],
  marks: MarkRow[],
  imageUrl: string,
  bad: Array<{ number: number; note: string }>,
): Promise<LocalizeMark[] | null> {
  // Composite current rings so Gemini sees what was wrong, then ask for fixes.
  const { buf, width, height } = await loadImage(imageUrl);
  const svg = buildOverlaySvg(width, height, marks);
  const composite = await sharp(buf)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
  const r = await geminiJson(
    correctionPrompt(common, sci, features, bad),
    composite.toString("base64"),
    "image/png",
    LOCALIZE_SCHEMA,
  );
  if (!r.ok) {
    console.error(`      correction failed: ${r.error}`);
    return null;
  }
  return (r.data as { marks: LocalizeMark[] }).marks;
}

// Convert Gemini's box_2d ([ymin,xmin,ymax,xmax], 0-1000) into a centred ring.
// cx/cy are fractions of width/height; overlayRadius is a fraction of the
// shorter side (matches AnnotatedSpeciesPhoto's scale reference), so we need the
// real W/H to size the ring to enclose the box's longer dimension.
function toMarkRow(f: Feature, loc: LocalizeMark | undefined, W: number, H: number): MarkRow {
  const box = loc?.box_2d;
  if (!box || box.length < 4) {
    return { label: f.label, description: f.description, overlayX: 0.5, overlayY: 0.5, overlayRadius: 0.12 };
  }
  const [ymin, xmin, ymax, xmax] = box;
  const cxFrac = (xmin + xmax) / 2000;
  const cyFrac = (ymin + ymax) / 2000;
  const boxWpx = (Math.abs(xmax - xmin) / 1000) * W;
  const boxHpx = (Math.abs(ymax - ymin) / 1000) * H;
  // Ring sits snug INSIDE the box's longer side, normalised to min(W,H).
  // Graders consistently flag box-enclosing rings as "oversized"/overlapping, so
  // we sit just inside the feature rather than around its bounding box.
  const rNorm = (0.45 * Math.max(boxWpx, boxHpx)) / Math.min(W, H);
  // Cap by feature class: a point feature (eye/barbel/spot) must stay small even
  // if Gemini boxed it loosely; a region feature may be larger but never swallow
  // the animal. 0.03 floor so a ring is always visible.
  const cap = loc?.featureSize === "point" ? 0.1 : 0.26;
  return {
    label: f.label,
    description: f.description,
    overlayX: clamp(cxFrac, 0, 1),
    overlayY: clamp(cyFrac, 0, 1),
    overlayRadius: clamp(rNorm, 0.03, cap),
  };
}

type PlacementResult = {
  scientificName: string;
  commonName: string;
  mode: string;
  heroImageId: string | null;
  heroImageUrl: string | null;
  features: number;
  rounds: number;
  before: MarkRow[];
  after: MarkRow[];
  finalGrade: HeroValidation | null;
  applied: boolean;
  skipped?: string;
  dupLabels?: string[]; // exact-duplicate labels among existing marks (content bug)
};

/** Resolve the lowest-ordering curated photo for a species. */
async function curatedHero(sci: string) {
  return prisma.speciesImage.findFirst({
    where: { scientificName: sci, curated: true },
    orderBy: [{ ordering: "asc" }, { createdAt: "asc" }],
    select: { id: true, url: true, width: true, height: true },
  });
}

async function placeForSpecies(
  sci: string,
  mode: "relocate" | "author",
  opts: { apply: boolean; force: boolean; redraft: boolean },
): Promise<PlacementResult> {
  const common = commonNameFor(sci);
  const existing = await prisma.diagnosticMark.findMany({
    where: { scientificName: sci },
    orderBy: { order: "asc" },
  });
  const hero = await curatedHero(sci);

  const base: PlacementResult = {
    scientificName: sci,
    commonName: common,
    mode,
    heroImageId: hero?.id ?? null,
    heroImageUrl: hero?.url ?? null,
    features: 0,
    rounds: 0,
    before: existing.map((m) => ({
      label: m.label,
      description: m.description,
      overlayX: m.overlayX,
      overlayY: m.overlayY,
      overlayRadius: m.overlayRadius,
    })),
    after: [],
    finalGrade: null,
    applied: false,
  };

  if (!hero) return { ...base, skipped: "no curated photo" };

  // Surface exact-duplicate labels (a content bug the placer can't fix, e.g.
  // bass had "Spiny gill cover" twice) so they go on the manual review list.
  const seenLabels = new Map<string, number>();
  const dupLabels: string[] = [];
  for (const m of existing) {
    const k = m.label.trim().toLowerCase();
    seenLabels.set(k, (seenLabels.get(k) ?? 0) + 1);
    if (seenLabels.get(k) === 2) dupLabels.push(m.label.trim());
  }
  if (dupLabels.length) base.dupLabels = dupLabels;

  // Feature list: author uses the drafts (P2 + redraft), else existing mark text.
  let features: Feature[];
  const isRedraft = opts.redraft && !!REDRAFTS[sci];
  if (mode === "author") {
    const draft = DRAFTS[sci];
    if (!draft) return { ...base, skipped: "no draft for this species" };
    // Normally author only creates for a species with NO marks. With --redraft on
    // a REDRAFTS species we replace its existing (draft) marks with the clean set.
    if (existing.length > 0 && !isRedraft) {
      return { ...base, skipped: "already has marks (use relocate, or --redraft to replace)" };
    }
    features = draft;
  } else {
    if (existing.length === 0) return { ...base, skipped: "no marks to relocate (use author)" };
    features = existing.map((m) => ({ label: m.label, description: m.description }));
  }
  base.features = features.length;

  // Resumable: skip a relocate that's already aligned on the current hero.
  if (mode === "relocate" && !opts.force) {
    const current: MarkRow[] = existing.map((m) => ({
      label: m.label,
      description: m.description,
      overlayX: m.overlayX,
      overlayY: m.overlayY,
      overlayRadius: m.overlayRadius,
    }));
    const pre = await validateHero(common, sci, hero.url, current);
    if (pre.overallAligned && (pre.perMark ?? []).every((p) => p.alignment !== "off")) {
      return { ...base, after: current, finalGrade: pre, skipped: "already aligned" };
    }
  }

  // Round 0: localise everything fresh.
  const loc = await localize(common, sci, features, hero.url);
  if (!loc) return { ...base, skipped: "localise error" };
  const W = loc.width;
  const H = loc.height;
  const marks: MarkRow[] = features.map((f, i) =>
    toMarkRow(f, loc.marks.find((l) => l.number === i + 1) ?? loc.marks[i], W, H),
  );

  // Verify + correct loop. Correct every off/near ring; on the final round,
  // give still-off rings one FRESH independent localise (a clean look often
  // beats another iterative nudge) and re-grade once.
  let grade: HeroValidation | null = null;
  let rounds = 0;
  for (let round = 0; round < MAX_VERIFY_ROUNDS; round++) {
    rounds = round + 1;
    grade = await validateHero(common, sci, hero.url, marks);
    if (grade.error) {
      console.error(`      verify error: ${grade.error}`);
      break;
    }
    const perMark = grade.perMark ?? [];
    const bad = perMark
      .filter((p) => p.alignment === "off" || p.alignment === "near")
      .map((p) => ({ number: p.number, note: p.note }));
    if (bad.length === 0) break;

    if (round === MAX_VERIFY_ROUNDS - 1) {
      // Last round: re-localise any STILL-off ring from scratch, then re-grade.
      const stillOff = perMark.filter((p) => p.alignment === "off").map((p) => p.number);
      if (stillOff.length > 0) {
        const fresh = await localize(common, sci, features, hero.url);
        if (fresh) {
          for (const n of stillOff) {
            const idx = n - 1;
            const fm = fresh.marks.find((l) => l.number === n) ?? fresh.marks[idx];
            if (idx >= 0 && idx < marks.length) marks[idx] = toMarkRow(features[idx], fm, W, H);
          }
          grade = await validateHero(common, sci, hero.url, marks);
          rounds++;
        }
      }
      break;
    }
    const fixes = await correct(common, sci, features, marks, hero.url, bad);
    if (!fixes) break;
    for (const fx of fixes) {
      const idx = fx.number - 1;
      if (idx >= 0 && idx < marks.length) marks[idx] = toMarkRow(features[idx], fx, W, H);
    }
  }

  base.after = marks;
  base.finalGrade = grade;
  base.rounds = rounds;

  if (!opts.apply) return base;

  // Write.
  if (mode === "author") {
    // --redraft: clear the old (draft) marks for this species before recreating
    // the canonical/re-anchored set, so we don't stack duplicates.
    if (isRedraft && existing.length > 0) {
      await prisma.diagnosticMark.deleteMany({ where: { scientificName: sci } });
    }
    await prisma.diagnosticMark.createMany({
      data: marks.map((m, idx) => ({
        scientificName: sci,
        speciesImageId: hero.id,
        order: idx,
        label: m.label,
        description: m.description,
        overlayX: m.overlayX,
        overlayY: m.overlayY,
        overlayRadius: m.overlayRadius,
        createdBy: PLACE_AUTHOR,
      })),
    });
  } else {
    // relocate: update coords in place, and re-point to the current curated hero
    // (handles a P1 photo swap where marks still FK the old photo).
    await prisma.$transaction(
      existing.map((m, idx) =>
        prisma.diagnosticMark.update({
          where: { id: m.id },
          data: {
            speciesImageId: hero.id,
            overlayX: marks[idx].overlayX,
            overlayY: marks[idx].overlayY,
            overlayRadius: marks[idx].overlayRadius,
          },
        }),
      ),
    );
  }
  base.applied = true;
  return base;
}

async function main() {
  const args = parseArgs();

  let speciesList: string[];
  if (args.all) {
    if (args.mode === "author") {
      speciesList = (args.redraft ? Object.keys(REDRAFTS) : Object.keys(P2_MARK_DRAFTS)).sort();
    } else {
      const g = await prisma.diagnosticMark.groupBy({ by: ["scientificName"] });
      speciesList = g.map((x) => x.scientificName).sort();
    }
    if (args.limit) speciesList = speciesList.slice(0, args.limit);
  } else if (args.species) {
    speciesList = [args.species];
  } else {
    console.error(
      "Usage: --mode relocate|author (--all | --species 'X') [--apply] [--force] [--limit N]",
    );
    process.exit(1);
  }

  console.error(
    `[place] mode=${args.mode} ${speciesList.length} species | ${args.apply ? "APPLY" : "DRY-RUN"} | ${GEMINI_MODEL}\n`,
  );

  const results: PlacementResult[] = [];
  for (const sci of speciesList) {
    process.stderr.write(`  ${commonNameFor(sci)} (${sci})... `);
    try {
      const res = await placeForSpecies(sci, args.mode, {
        apply: args.apply,
        force: args.force,
        redraft: args.redraft,
      });
      results.push(res);
      if (res.skipped) console.error(`SKIP (${res.skipped})`);
      else
        console.error(
          `${res.features} marks, ${res.rounds} round(s) -> aligned=${res.finalGrade?.overallAligned} ` +
            `clarity=${res.finalGrade?.overallClarity}${res.applied ? " [WRITTEN]" : ""}`,
        );
    } catch (e) {
      // One species erroring (e.g. a persistent CDN 429) must not abort the
      // sweep — log and move on; a later --all re-run picks it up (skip-aligned).
      console.error(`ERROR (${(e as Error).message}) — skipped`);
      results.push({
        scientificName: sci,
        commonName: commonNameFor(sci),
        mode: args.mode,
        heroImageId: null,
        heroImageUrl: null,
        features: 0,
        rounds: 0,
        before: [],
        after: [],
        finalGrade: null,
        applied: false,
        skipped: `error: ${(e as Error).message}`,
      });
    }
  }

  const stamp = { ranAt: process.env.AUDIT_STAMP ?? null, mode: args.mode, apply: args.apply, results };
  appendFileSync(LOG_PATH, JSON.stringify(stamp, null, 2) + "\n");
  console.error(`\nAppended ${results.length} results to ${LOG_PATH}`);

  const aligned = results.filter((r) => r.finalGrade?.overallAligned).length;
  const skipped = results.filter((r) => r.skipped).length;
  console.error(
    `SUMMARY: ${aligned} aligned | ${skipped} skipped | ${results.length - skipped} processed`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
