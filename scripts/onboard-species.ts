/**
 * One-command species onboarding: runs every per-species DATA step in order so a
 * newly-added catalogue species lands with photos, a vetted gallery, provenance,
 * AND diagnostic-mark rings — the bits that used to be a 5-script manual chain
 * (and that whiting fell through, shipping with reference photos but no ID rings
 * because nobody ran the marks step for it).
 *
 * It orchestrates the existing, individually-tested scripts — it does NOT
 * re-implement them:
 *   1. refresh-images          fetch iNat photos + apply any curated override
 *   2. build-species-galleries Gemini-vet the gallery + set the teaching hero   [GEMINI]
 *   3. place-diagnostic-marks  Gemini-place the DiagnosticMark rings from drafts [GEMINI]
 *   4. enrich-image-meta       backfill observedOn / placeGuess provenance
 *   5. seed-aliases            sync the alias table so scoring accepts synonyms
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/onboard-species.ts --species "Merlangius merlangus"
 *   ... --species "X" --skip-gallery   skip the quota-heavy Gemini gallery pass
 *   ... --species "X" --dry-run        print the plan, run nothing
 *   ... --species "X" --continue       keep going if a step fails (default: stop)
 *
 * Needs .env.local (DB) and, for the Gemini steps, GEMINI_API_KEY. The marks
 * step only runs for a species that has a draft in scripts/data/p2-mark-drafts.ts
 * — add one there first (label + description per feature); the add-a-species
 * runbook explains. Without a draft the species is onboarded with photos but the
 * marks step is skipped with a clear notice (so it can't silently no-op).
 */
import { spawnSync } from "node:child_process";
import speciesTraitsData from "../src/data/species-traits.json";
import { P2_MARK_DRAFTS } from "./data/p2-mark-drafts";

type Catalogue = Record<string, { commonName?: string }>;
const CATALOGUE = speciesTraitsData as unknown as Catalogue;

function parseArgs() {
  const argv = process.argv.slice(2);
  let species: string | undefined;
  let dryRun = false;
  let skipGallery = false;
  let skipMarks = false;
  let keepGoing = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--species" && argv[i + 1]) species = argv[++i];
    else if (a === "--dry-run") dryRun = true;
    else if (a === "--skip-gallery") skipGallery = true;
    else if (a === "--skip-marks") skipMarks = true;
    else if (a === "--continue") keepGoing = true;
  }
  return { species, dryRun, skipGallery, skipMarks, keepGoing };
}

type Step = { name: string; script: string; args: string[]; needsGemini?: boolean };

function buildSteps(species: string, opts: { skipGallery: boolean; skipMarks: boolean }): Step[] {
  const steps: Step[] = [
    { name: "refresh-images", script: "scripts/refresh-images.ts", args: ["--species", species] },
  ];
  if (!opts.skipGallery) {
    steps.push({
      name: "build-species-galleries",
      script: "scripts/build-species-galleries.ts",
      args: ["--species", species],
      needsGemini: true,
    });
  }
  if (!opts.skipMarks) {
    if (P2_MARK_DRAFTS[species]) {
      steps.push({
        name: "place-diagnostic-marks (author)",
        script: "scripts/place-diagnostic-marks.ts",
        args: ["--mode", "author", "--species", species, "--apply"],
        needsGemini: true,
      });
    } else {
      console.warn(
        `\n  ⚠  No mark draft for "${species}" in scripts/data/p2-mark-drafts.ts — skipping the marks step.\n` +
          `     Add a draft (label + description per diagnostic feature) and re-run, or the species\n` +
          `     will have reference photos but no ID rings. See docs/runbooks/add-a-species.md.\n`,
      );
    }
  }
  // Catalogue-wide but idempotent (only touch NULL/new rows), so cheap to run here.
  steps.push({ name: "enrich-image-meta", script: "scripts/enrich-image-meta.ts", args: [] });
  steps.push({ name: "seed-aliases", script: "scripts/seed-aliases.ts", args: [] });
  return steps;
}

function runStep(step: Step): boolean {
  const args = ["tsx", "--env-file=.env.local", step.script, ...step.args];
  console.log(`\n▶ ${step.name}${step.needsGemini ? "  (Gemini)" : ""}\n  npx ${args.join(" ")}`);
  const res = spawnSync("npx", args, { stdio: "inherit" });
  if (res.status === 0) return true;
  console.error(`\n✗ ${step.name} exited with ${res.status ?? res.signal ?? "an error"}`);
  return false;
}

function main() {
  const { species, dryRun, skipGallery, skipMarks, keepGoing } = parseArgs();
  if (!species) {
    console.error('Usage: scripts/onboard-species.ts --species "Genus species" [--skip-gallery] [--skip-marks] [--dry-run] [--continue]');
    process.exit(2);
  }
  if (!(species in CATALOGUE)) {
    console.error(
      `"${species}" is not in the catalogue (src/data/species-traits.json). Add the trait entry first ` +
        `(docs/runbooks/add-a-species.md) — onboarding only runs the DATA steps, not the in-repo edits.`,
    );
    process.exit(2);
  }

  const steps = buildSteps(species, { skipGallery, skipMarks });
  console.log(`Onboarding "${species}" (${CATALOGUE[species]?.commonName ?? species}) — ${steps.length} step(s):`);
  steps.forEach((s, i) => console.log(`  ${i + 1}. ${s.name}`));

  if (dryRun) {
    console.log("\n--dry-run: nothing executed.");
    return;
  }

  const failed: string[] = [];
  for (const step of steps) {
    const ok = runStep(step);
    if (!ok) {
      failed.push(step.name);
      if (!keepGoing) {
        console.error(`\nStopping (pass --continue to run remaining steps). Failed: ${step.name}`);
        process.exit(1);
      }
    }
  }

  if (failed.length) {
    console.error(`\nDone with ${failed.length} failed step(s): ${failed.join(", ")}`);
    process.exit(1);
  }
  console.log(`\n✓ Onboarded "${species}". The diagnostic-mark rings are DRAFTS pending expert sign-off.`);
}

main();
