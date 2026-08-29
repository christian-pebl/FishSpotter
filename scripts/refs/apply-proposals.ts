/**
 * Apply the per-species verification proposals to the repo.
 *
 * This is the gate between "an agent read a page and wrote down what it said"
 * and "the app tells a reader this is true". It is deliberately suspicious of
 * its own input:
 *
 *   Every quote is re-checked against the CACHED SOURCE TEXT before it is
 *   written. A support entry whose quote is not in the file it names is
 *   dropped, and a claim left with no surviving passage is downgraded to
 *   unsupported rather than trusted.
 *
 * That check is the whole point. A verification pipeline that takes an agent's
 * word for what a page says is the FUSE annex-4 failure again: a gate that
 * imports its own subject can only ever prove self-consistency. Here the
 * subject is the downloaded page, and the gate is a string search over it.
 *
 * Writes:
 *   src/data/species-references.json  claims, passages, and the trust flag
 *   src/data/species-facts.json       the four sourced fact tiles
 *   src/data/species-traits.json      a corrected field note (the wizard's
 *                                     trait TOKENS are deliberately left alone:
 *                                     they cut the ID funnel's candidate list
 *                                     and are no longer what the tiles render)
 *   src/data/species-diet.json        the authored "I eat" / "Eats me" bullets
 *   .refs-cache/apply-report.json     what was applied, dropped and why
 *
 * Diagnostic marks live in the database, so corrections to them are reported
 * for a separate, explicit step rather than written here: a script that reads
 * a proposal file should not quietly rewrite production rows.
 *
 *   npx tsx --env-file=.env.local scripts/refs/apply-proposals.ts
 *     --dry-run     report only (default is to write)
 *     --species "X" one species
 */

import fs from "node:fs";
import path from "node:path";
import { referenceFileSchema, type Claim, type ReferenceFile, type Source } from "../../src/lib/references/schema";
import { safeName } from "./lib/cache";

const ROOT = process.cwd();
const REFS = path.join(ROOT, "src", "data", "species-references.json");
const TRAITS = path.join(ROOT, "src", "data", "species-traits.json");
const FACTS = path.join(ROOT, "src", "data", "species-facts.json");
const DIETS = path.join(ROOT, "src", "data", "species-diet.json");
const PROPOSALS = path.join(ROOT, ".refs-cache", "proposals");
const TEXT = path.join(ROOT, ".refs-cache", "text");
const REPORT = path.join(ROOT, ".refs-cache", "apply-report.json");

const TODAY = new Date().toISOString().slice(0, 10);
const READ_BY = "claim-verification-sweep";

type Support = { sourceId: string; locator: string; quote?: string };
type Fact = { text: string; support?: Support[] };
type ProposalClaim = {
  key: string;
  verdict: "supported" | "corrected" | "unsupported";
  correctedRaw?: string;
  correctedLabel?: string;
  correctedText?: string;
  support?: Support[];
  note?: string;
};
type DietBullet = { text: string; slug?: string; support?: Support[] };
type Proposal = {
  species: string;
  facts?: Partial<Record<"depth" | "size" | "habitat" | "behaviour", Fact>>;
  claims: ProposalClaim[];
  diet?: { eats?: DietBullet[]; eatenBy?: DietBullet[] };
  newSources?: (Source & { id: string })[];
};

/** Cached source text, loaded once and normalised for comparison. */
const cacheText = new Map<string, string | null>();
function sourceText(sourceId: string): string | null {
  if (cacheText.has(sourceId)) return cacheText.get(sourceId)!;
  const p = path.join(TEXT, `${safeName(sourceId)}.txt`);
  const v = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
  cacheText.set(sourceId, v);
  return v;
}

/**
 * Compare quote to page with the differences that do not change meaning
 * flattened: whitespace runs, the dash and quote characters a CMS rewrites,
 * and case. Anything beyond that is a real difference and must fail.
 */
const normalise = (s: string) =>
  s
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** A quote may cut its middle with "..."; each fragment must appear, in order. */
function quoteIsInSource(quote: string, text: string): boolean {
  const hay = normalise(text);
  const parts = quote
    .split(/\s*(?:\.\.\.|…|\[\.\.\.\])\s*/)
    .map((p) => normalise(p))
    .filter((p) => p.length >= 8);
  if (parts.length === 0) return false;
  let from = 0;
  for (const part of parts) {
    const at = hay.indexOf(part, from);
    if (at === -1) return false;
    from = at + part.length;
  }
  return true;
}

type Dropped = { species: string; key: string; sourceId: string; reason: string; quote?: string };

function checkSupport(species: string, key: string, support: Support[] | undefined, dropped: Dropped[]): Support[] {
  const kept: Support[] = [];
  for (const sp of support ?? []) {
    if (!sp.sourceId || !sp.locator) {
      dropped.push({ species, key, sourceId: sp.sourceId ?? "?", reason: "incomplete support entry" });
      continue;
    }
    const text = sourceText(sp.sourceId);
    if (text === null) {
      // Not cached: the reader may have fetched it live, which is allowed, but
      // it cannot be re-checked here so it must not carry a claim on its own.
      dropped.push({ species, key, sourceId: sp.sourceId, reason: "source not in the local cache, quote unverifiable", quote: sp.quote });
      continue;
    }
    if (!sp.quote) {
      dropped.push({ species, key, sourceId: sp.sourceId, reason: "no quote recorded" });
      continue;
    }
    if (!quoteIsInSource(sp.quote, text)) {
      dropped.push({ species, key, sourceId: sp.sourceId, reason: "quote not found in the cached source", quote: sp.quote.slice(0, 120) });
      continue;
    }
    kept.push(sp);
  }
  return kept;
}

const toClaim = (support: Support[], supported: boolean): Claim => ({
  sourceIds: [...new Set(support.map((s) => s.sourceId))],
  support: support.map((s) => ({ sourceId: s.sourceId, locator: s.locator, quote: s.quote, readBy: READ_BY, readOn: TODAY })),
  claimSupported: supported,
});

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const only = argv.includes("--species") ? argv[argv.indexOf("--species") + 1] : undefined;

  if (!fs.existsSync(PROPOSALS)) {
    console.error("No .refs-cache/proposals directory. Nothing to apply.");
    process.exit(1);
  }

  const refs: ReferenceFile = referenceFileSchema.parse(JSON.parse(fs.readFileSync(REFS, "utf8")));
  const traits = JSON.parse(fs.readFileSync(TRAITS, "utf8")) as Record<
    string,
    { size: string; habitat: string[]; behavior: string[]; fieldNote?: string }
  >;
  const facts = JSON.parse(fs.readFileSync(FACTS, "utf8")) as Record<
    string,
    Partial<Record<"depth" | "size" | "habitat" | "behaviour", { text: string }>>
  >;
  const diets = JSON.parse(fs.readFileSync(DIETS, "utf8")) as Record<
    string,
    { eats: { text: string; slug?: string }[]; eatenBy: { text: string; slug?: string }[] }
  >;

  const files = fs.readdirSync(PROPOSALS).filter((f) => f.endsWith(".json"));
  const dropped: Dropped[] = [];
  const markEdits: { species: string; key: string; label?: string; text?: string; note?: string }[] = [];
  const traitEdits: { species: string; field: string; from: string; to: string; note?: string }[] = [];
  const removed: { species: string; key: string; note?: string }[] = [];
  const tally = { proposals: 0, facts: 0, supported: 0, corrected: 0, unsupported: 0, dietBullets: 0, newSources: 0 };

  for (const f of files) {
    let p: Proposal;
    try {
      p = JSON.parse(fs.readFileSync(path.join(PROPOSALS, f), "utf8"));
    } catch (e) {
      console.error(`  ! ${f}: unreadable JSON, skipped (${e instanceof Error ? e.message : e})`);
      continue;
    }
    if (only && p.species !== only) continue;
    if (!traits[p.species]) {
      console.error(`  ! ${f}: "${p.species}" is not a catalogue species, skipped`);
      continue;
    }
    tally.proposals++;

    // New sources first: a claim cannot cite a source the registry lacks.
    for (const s of p.newSources ?? []) {
      if (!s.id) continue;
      if (!refs.sources[s.id]) {
        const { id, ...rest } = s;
        refs.sources[id] = rest as Source;
        tally.newSources++;
      }
    }

    refs.species[p.species] ??= { sourceIds: [], claims: {} };
    const entry = refs.species[p.species];

    for (const c of p.claims ?? []) {
      const kept = checkSupport(p.species, c.key, c.support, dropped);
      // A claim whose every passage failed the re-check is not supported,
      // whatever the proposal said about it.
      const verdict = c.verdict !== "unsupported" && kept.length === 0 ? "unsupported" : c.verdict;

      if (verdict === "unsupported") {
        delete entry.claims[c.key];
        removed.push({ species: p.species, key: c.key, note: c.note });
        tally.unsupported++;
        continue;
      }

      if (verdict === "corrected") {
        if (c.key === "fieldNote" && c.correctedText) {
          const t = traits[p.species];
          traitEdits.push({ species: p.species, field: "fieldNote", from: t.fieldNote ?? "", to: c.correctedText, note: c.note });
          t.fieldNote = c.correctedText;
        } else if (c.key.startsWith("mark:")) {
          // Marks are DB rows. Report, do not write.
          markEdits.push({ species: p.species, key: c.key, label: c.correctedLabel, text: c.correctedText, note: c.note });
        }
        tally.corrected++;
      } else {
        tally.supported++;
      }

      entry.claims[c.key] = toClaim(kept, true);
    }

    // ---- the four fact tiles
    const speciesFacts: Record<string, { text: string }> = {};
    for (const key of ["depth", "size", "habitat", "behaviour"] as const) {
      const f = p.facts?.[key];
      const claimKey = `trait:${key === "behaviour" ? "behavior" : key}`;
      if (!f?.text) {
        delete entry.claims[claimKey];
        removed.push({ species: p.species, key: claimKey, note: "no sourced phrase proposed for this tile" });
        continue;
      }
      const kept = checkSupport(p.species, claimKey, f.support, dropped);
      if (kept.length === 0) {
        delete entry.claims[claimKey];
        removed.push({ species: p.species, key: claimKey, note: `tile dropped, no verifiable passage: ${f.text}` });
        continue;
      }
      speciesFacts[key] = { text: f.text };
      entry.claims[claimKey] = toClaim(kept, true);
      tally.facts++;
    }
    facts[p.species] = speciesFacts;

    // ---- the authored diet bullets
    const eats: { text: string; slug?: string }[] = [];
    const eatenBy: { text: string; slug?: string }[] = [];
    for (const side of ["eats", "eatenBy"] as const) {
      const out = side === "eats" ? eats : eatenBy;
      for (const b of p.diet?.[side] ?? []) {
        if (!b.text) continue;
        const key = `diet:${side}:${out.length}`;
        const kept = checkSupport(p.species, key, b.support, dropped);
        // A bullet with no surviving passage is not published. There is no
        // "probably eats" tier: the section only carries what a source says.
        if (kept.length === 0) {
          removed.push({ species: p.species, key, note: `bullet dropped, no verifiable passage: ${b.text}` });
          continue;
        }
        out.push(b.slug ? { text: b.text, slug: b.slug } : { text: b.text });
        entry.claims[key] = toClaim(kept, true);
        tally.dietBullets++;
      }
    }
    // Clear any stale higher-index bullet claims from an earlier, longer run.
    for (const key of Object.keys(entry.claims)) {
      const m = /^diet:(eats|eatenBy):(\d+)$/.exec(key);
      if (!m) continue;
      const len = m[1] === "eats" ? eats.length : eatenBy.length;
      if (Number(m[2]) >= len) delete entry.claims[key];
    }
    diets[p.species] = { eats, eatenBy };

    // The species' source list is exactly the sources its surviving claims cite.
    entry.sourceIds = [...new Set(Object.values(entry.claims).flatMap((c) => c.sourceIds))].sort();

    // The per-edge claims are superseded by the authored bullets, and the
    // trophic tier came off the guide with the rest of the farm-web framing.
    for (const key of Object.keys(entry.claims)) {
      if (key.startsWith("edge:") || key === "trophic:tier" || key === "farm:role") delete entry.claims[key];
    }
  }

  const report = { ranOn: TODAY, tally, traitEdits, markEdits, removed, droppedSupport: dropped };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));

  if (!dryRun) {
    fs.writeFileSync(REFS, JSON.stringify(refs, null, 2) + "\n");
    fs.writeFileSync(TRAITS, JSON.stringify(traits, null, 2) + "\n");
    fs.writeFileSync(FACTS, JSON.stringify(facts, null, 2) + "\n");
    fs.writeFileSync(DIETS, JSON.stringify(diets, null, 2) + "\n");
  }

  console.log(`${dryRun ? "DRY RUN, nothing written" : "Applied"}: ${tally.proposals} proposals`);
  console.log(`  fact tiles     ${tally.facts}`);
  console.log(`  supported      ${tally.supported}`);
  console.log(`  corrected      ${tally.corrected}`);
  console.log(`  removed        ${tally.unsupported}`);
  console.log(`  diet bullets   ${tally.dietBullets}`);
  console.log(`  new sources    ${tally.newSources}`);
  console.log(`  trait edits    ${traitEdits.length}`);
  console.log(`  mark edits     ${markEdits.length} (reported, applied separately)`);
  console.log(`  dropped quotes ${dropped.length}  <- these failed the re-check against the cached page`);
  if (dropped.length) {
    for (const d of dropped.slice(0, 15)) console.log(`     ${d.species} ${d.key} [${d.sourceId}] ${d.reason}`);
    if (dropped.length > 15) console.log(`     ... and ${dropped.length - 15} more, see .refs-cache/apply-report.json`);
  }
  console.log(`\nFull report: .refs-cache/apply-report.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
