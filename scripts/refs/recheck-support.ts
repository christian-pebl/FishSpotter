/**
 * Re-check EVERY recorded passage in the reference catalogue against the cached
 * source text, including claims no current pipeline stage would touch.
 *
 * apply-proposals.ts checks the passages it writes. That leaves a gap: claims
 * written by earlier passes, under keys nothing re-proposes (the species-level
 * `diet:eats` / `diet:eatenBy` the workshop cards use), are never re-read. Two
 * of them were quoting Mortensen 1927 through a cache file that turned out to
 * be the Internet Archive's item page rather than the book, so one quote was
 * real, one was not, and nothing in the pipeline could tell the difference.
 *
 * A trust flag with no passage behind it is worse than an unset one, so this
 * clears it. Three things have to go together, or the unbacked citation simply
 * moves one field along and the catalogue test finds it there instead:
 *
 *   1. the failed passage comes out of `support`;
 *   2. the source it justified comes out of the claim's `sourceIds`;
 *   3. a source now cited by nothing comes out of the registry, and its
 *      verification row with it.
 *
 *   npx tsx --env-file=.env.local scripts/refs/recheck-support.ts
 *     --fix   apply the three removals above (default: report only)
 */

import fs from "node:fs";
import path from "node:path";
import { referenceFileSchema, type ReferenceFile } from "../../src/lib/references/schema";
import { safeName } from "./lib/cache";

const ROOT = process.cwd();
const REFS = path.join(ROOT, "src", "data", "species-references.json");
const VERIFY = path.join(ROOT, "src", "data", "reference-verification.json");
const TEXT = path.join(ROOT, ".refs-cache", "text");

const cache = new Map<string, string | null>();
function sourceText(id: string): string | null {
  if (cache.has(id)) return cache.get(id)!;
  const p = path.join(TEXT, `${safeName(id)}.txt`);
  cache.set(id, fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null);
  return cache.get(id)!;
}

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
    .map(normalise)
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

function main() {
  const fix = process.argv.includes("--fix");
  const refs: ReferenceFile = referenceFileSchema.parse(JSON.parse(fs.readFileSync(REFS, "utf8")));

  let checked = 0;
  const failures: { species: string; key: string; sourceId: string; reason: string; quote: string }[] = [];
  const downgraded: string[] = [];

  for (const [species, entry] of Object.entries(refs.species)) {
    for (const [key, claim] of Object.entries(entry.claims)) {
      const before = claim.support;
      const kept: typeof claim.support = [];
      for (const sp of before) {
        checked++;
        const text = sourceText(sp.sourceId);
        if (text === null) {
          failures.push({ species, key, sourceId: sp.sourceId, reason: "no cached copy", quote: (sp.quote ?? "").slice(0, 80) });
          continue;
        }
        if (!sp.quote) {
          failures.push({ species, key, sourceId: sp.sourceId, reason: "no quote recorded", quote: "" });
          continue;
        }
        if (!quoteIsInSource(sp.quote, text)) {
          failures.push({ species, key, sourceId: sp.sourceId, reason: "quote not in the cached source", quote: sp.quote.slice(0, 80) });
          continue;
        }
        kept.push(sp);
      }
      if (!fix || kept.length === before.length) continue;

      claim.support = kept;
      // Drop the citation the failed passage justified. A source that never
      // carried a passage on this claim is left alone; only one whose passages
      // all just failed is removed.
      const hadPassage = new Set(before.map((s) => s.sourceId));
      const surviving = new Set(kept.map((s) => s.sourceId));
      claim.sourceIds = claim.sourceIds.filter((id) => !hadPassage.has(id) || surviving.has(id));

      if (kept.length === 0 && claim.claimSupported) {
        claim.claimSupported = false;
        downgraded.push(`${species} ${key}`);
      }
    }
  }

  console.log(`Re-checked ${checked} recorded passages against the local cache.`);
  console.log(`  failed: ${failures.length}`);
  for (const f of failures.slice(0, 30)) {
    console.log(`    ${f.species} ${f.key} [${f.sourceId}] ${f.reason}`);
    if (f.quote) console.log(`      "${f.quote}"`);
  }
  if (failures.length > 30) console.log(`    ... and ${failures.length - 30} more`);

  if (!fix) {
    if (failures.length) console.log("\nRun with --fix to drop them and clear any claim left with no passage.");
    return;
  }

  // Normalise every claim's citation list to the sources that actually carry a
  // passage on it, whether or not anything failed on THIS run. A previous run
  // dropped passages without touching sourceIds, which left four paywalled
  // papers cited by claims that could no longer quote them: the failure had
  // simply moved one field along, where the catalogue test found it.
  let relisted = 0;
  let hollow = 0;
  for (const entry of Object.values(refs.species)) {
    for (const [key, claim] of Object.entries(entry.claims)) {
      // A claim with no passage and no trust flag carries nothing. It is not a
      // weaker citation, it is a citation to a page nobody opened, and it keeps
      // its source alive in the registry: that is how a paywalled PDF stayed
      // listed with no page locator anywhere.
      if (!claim.claimSupported && claim.support.length === 0) {
        delete entry.claims[key];
        hollow++;
        continue;
      }
      const withPassage = [...new Set(claim.support.map((s) => s.sourceId))];
      if (claim.support.length === 0) continue;
      if (withPassage.length === claim.sourceIds.length && withPassage.every((id) => claim.sourceIds.includes(id))) continue;
      claim.sourceIds = withPassage;
      relisted++;
    }
  }
  if (relisted) console.log(`Relisted ${relisted} claim(s) whose citations outran their passages.`);
  if (hollow) console.log(`Removed ${hollow} hollow claim(s): no passage and no trust flag.`);

  // A species-level source list must not keep a source alive on its own. The
  // WoRMS anchor is the exception: it backs no individual claim by design.
  for (const entry of Object.values(refs.species)) {
    const claimed = new Set(Object.values(entry.claims).flatMap((c) => c.sourceIds));
    entry.sourceIds = (entry.sourceIds ?? []).filter(
      (id) => claimed.has(id) || refs.sources[id]?.kind === "worms",
    );
  }

  const cited = new Set<string>();
  for (const entry of Object.values(refs.species)) {
    for (const id of entry.sourceIds ?? []) cited.add(id);
    for (const claim of Object.values(entry.claims)) {
      for (const id of claim.sourceIds) cited.add(id);
      for (const s of claim.support) cited.add(s.sourceId);
    }
  }
  const orphaned = Object.keys(refs.sources).filter((id) => !cited.has(id));
  for (const id of orphaned) delete refs.sources[id];
  if (orphaned.length) {
    const verify = JSON.parse(fs.readFileSync(VERIFY, "utf8")) as Record<string, unknown>;
    for (const id of orphaned) delete verify[id];
    fs.writeFileSync(VERIFY, JSON.stringify(verify, null, 2) + "\n");
  }

  fs.writeFileSync(REFS, JSON.stringify(refs, null, 2) + "\n");
  console.log(`\nDropped ${failures.length} passage(s); ${downgraded.length} claim(s) lost their evidenced flag.`);
  for (const d of downgraded) console.log(`  ${d}`);
  console.log(`Pruned ${orphaned.length} source(s) nothing cites any more.`);
  for (const o of orphaned) console.log(`  ${o}`);
}

main();
