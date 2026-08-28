/**
 * Clean site navigation out of already-stored quotes.
 *
 * The extractor recorded the first 235 characters of a labelled block, and on
 * FishBase that block OPENS with in-page navigation. 165 stored passages began
 * "Identification keys | Morphology | Morphometrics ..." rather than with the
 * sentence that carries the claim, which is the first thing a reader sees when
 * they tap a citation.
 *
 * The parser now strips this at source; this repairs what is already recorded,
 * in place, without re-fetching or re-deciding anything.
 *
 *   npm run refs:clean-quotes [-- --dry-run]
 */

import { promises as fs } from "fs";
import path from "path";
import { referenceFileSchema, type ReferenceFile } from "../../src/lib/references/schema";
import { startAtProse } from "./lib/parse-sources";

const REFS = path.join(process.cwd(), "src", "data", "species-references.json");
const DRY = process.argv.includes("--dry-run");

/** In-page furniture that is never part of a supporting passage. */
function cleanQuote(q: string): string {
  return q
    .replace(/^(?:[A-Za-z][A-Za-z .\/'-]*\|)+[A-Za-z .\/'-]*/, "")
    .replace(/Glossary \(e\.g\.[^)]*\)/gi, " ")
    .replace(/More info \| Plus d'info\. \| Mais info/gi, " ")
    .replace(/Upload your references[^.]*?Collaborators/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:)])/g, "$1")
    .replace(/^[\s|.,;:-]+/, "")
    .trim();
}

/** Furniture first, then skip a leading run of meristic counts. */
function tidy(q: string): string {
  return startAtProse(cleanQuote(q));
}

async function main() {
  const file: ReferenceFile = referenceFileSchema.parse(JSON.parse(await fs.readFile(REFS, "utf8")));
  let changed = 0;
  let emptied = 0;
  const samples: string[] = [];

  for (const [sci, entry] of Object.entries(file.species)) {
    for (const [key, claim] of Object.entries(entry.claims)) {
      for (const sp of claim.support) {
        if (!sp.quote) continue;
        const next = tidy(sp.quote);
        if (next === sp.quote) continue;
        // A quote that cleans to nothing was ALL furniture: drop it rather than
        // leave an empty blockquote pretending to be evidence.
        if (next.length < 15) {
          delete sp.quote;
          emptied++;
          continue;
        }
        if (samples.length < 5) samples.push(`${sci} ${key}\n    was: ${sp.quote.slice(0, 90)}\n    now: ${next.slice(0, 90)}`);
        sp.quote = next;
        changed++;
      }
    }
  }

  const parsed = referenceFileSchema.parse(file);
  console.log(`cleaned ${changed} quote(s); ${emptied} were entirely navigation and were dropped\n`);
  for (const s of samples) console.log("  " + s + "\n");

  if (DRY) {
    console.log("[dry run] nothing written");
  } else {
    await fs.writeFile(REFS, JSON.stringify(parsed, null, 2) + "\n", "utf8");
    console.log(`Wrote ${path.relative(process.cwd(), REFS)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
