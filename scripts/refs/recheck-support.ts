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
 * A trust flag that no longer has a passage behind it is worse than an unset
 * one, so this clears `claimSupported` rather than leaving it standing.
 *
 *   npx tsx --env-file=.env.local scripts/refs/recheck-support.ts
 *     --fix   clear claimSupported where no passage survives (default: report)
 */

import fs from "node:fs";
import path from "node:path";
import { referenceFileSchema, type ReferenceFile } from "../../src/lib/references/schema";
import { safeName } from "./lib/cache";

const ROOT = process.cwd();
const REFS = path.join(ROOT, "src", "data", "species-references.json");
const TEXT = path.join(ROOT, ".refs-cache", "text");

const cache = new Map<string, string | null>();
function sourceText(id: string): string | null {
  if (cache.has(id)) return cache.get(id)!;
  const p = path.join(TEXT, `${safeName(id)}.txt`);
  const v = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
  cache.set(id, v);
  return v;
}

const normalise = (s: string) =>
  s
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

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
      const kept: typeof claim.support = [];
      for (const sp of claim.support) {
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
      if (kept.length === claim.support.length) continue;
      if (!fix) continue;
      claim.support = kept;
      // The flag means "a passage was read and carries this". With no surviving
      // passage that is no longer true, whoever set it and whenever.
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

  if (fix) {
    fs.writeFileSync(REFS, JSON.stringify(refs, null, 2) + "\n");
    console.log(`\nDropped ${failures.length} passage(s); ${downgraded.length} claim(s) lost their evidenced flag.`);
    for (const d of downgraded) console.log(`  ${d}`);
  } else if (failures.length) {
    console.log("\nRun with --fix to drop them and clear any claim left with no passage.");
  }
}

main();
