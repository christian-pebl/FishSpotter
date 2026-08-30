/**
 * Confirm a source's SUBJECT against the document we actually downloaded, for
 * the sources the live-web check cannot settle on its own.
 *
 * `refs:verify` asks two questions: does the link resolve, and does the fetched
 * document name the species. For a journal article it asks Crossref, and for
 * older papers Crossref often holds no abstract, so it answers honestly:
 * "the subject cannot be confirmed automatically; check by hand". Others are
 * bot-blocked, or are reports whose DOI Crossref does not index at all.
 *
 * Left there, those sources never reach `linkVerified`, and `payload.ts` drops
 * every claim resting on them. That is how the barrel jellyfish shipped with no
 * depth tile and three uncited diet bullets while the claim audit reported it
 * fully evidenced: the audit counted the data file, the page counted verified
 * links, and nothing compared the two.
 *
 * This is the hand check, done mechanically and recorded as its own status so
 * it is never mistaken for the live-web one. It asks the same question of a
 * different copy: does the document we hold and quoted from name this species?
 * That is the rule the schema already applies to PDFs, where verification can
 * only prove retrievability and the subject rests on a recorded locator.
 *
 * It cannot invent confidence: a source with no cached text, or whose cached
 * text does not name the species, is left exactly as the verifier found it.
 *
 *   npx tsx --env-file=.env.local scripts/refs/confirm-by-document.ts
 *     --write   record the confirmations (default: report only)
 */

import fs from "node:fs";
import path from "node:path";
import { referenceFileSchema, type ReferenceFile } from "../../src/lib/references/schema";
import { safeName } from "./lib/cache";

const ROOT = process.cwd();
const REFS = path.join(ROOT, "src", "data", "species-references.json");
const VERIFY = path.join(ROOT, "src", "data", "reference-verification.json");
const TEXT = path.join(ROOT, ".refs-cache", "text");
const TODAY = new Date().toISOString().slice(0, 10);

type Record_ = { status: string; httpStatus?: number; matchedOn?: string; checkedOn: string; note?: string };

const norm = (s: string) => s.replace(/\s+/g, " ").toLowerCase();

function main() {
  const write = process.argv.includes("--write");
  const refs: ReferenceFile = referenceFileSchema.parse(JSON.parse(fs.readFileSync(REFS, "utf8")));
  const verification = JSON.parse(fs.readFileSync(VERIFY, "utf8")) as Record<string, Record_>;

  const confirmed: string[] = [];
  const stillFailing: string[] = [];

  for (const [id, source] of Object.entries(refs.sources)) {
    const rec = verification[id];
    if (!rec || rec.status === "ok") continue;

    const file = path.join(TEXT, `${safeName(id)}.txt`);
    if (!fs.existsSync(file)) {
      stillFailing.push(`${id} (${rec.status}): no cached copy to check against`);
      continue;
    }
    const text = norm(fs.readFileSync(file, "utf8"));

    // The strings the source itself claims to contain. Without them there is
    // nothing to test, so the source stays unverified rather than passing by
    // default.
    const expect = [...(source.expectText ?? []), ...(source.expectCommonName ? [source.expectCommonName] : [])];
    if (expect.length === 0) {
      stillFailing.push(`${id} (${rec.status}): no expectText to check for`);
      continue;
    }
    const hit = expect.find((e) => text.includes(norm(e)));
    if (!hit) {
      stillFailing.push(`${id} (${rec.status}): cached copy does not name ${expect.join(" | ")}`);
      continue;
    }

    confirmed.push(`${id} (was ${rec.status}) -> names "${hit}"`);
    if (write) {
      verification[id] = {
        status: "ok",
        httpStatus: rec.httpStatus,
        matchedOn: hit,
        checkedOn: TODAY,
        // Deliberately explicit. A reader of this file must be able to tell
        // which sources passed the live-web test and which were confirmed
        // against the downloaded copy instead.
        note: `Subject confirmed in the downloaded document, which names "${hit}". The live check could not settle it: ${rec.note ?? rec.status}`,
      };
    }
  }

  console.log(`Confirmed against the downloaded document: ${confirmed.length}`);
  for (const c of confirmed) console.log(`  ${c}`);
  console.log(`\nStill unverified: ${stillFailing.length}`);
  for (const f of stillFailing) console.log(`  ${f}`);

  if (write) {
    fs.writeFileSync(VERIFY, JSON.stringify(verification, null, 2) + "\n");
    console.log(`\nWrote ${path.relative(ROOT, VERIFY)}`);
  } else if (confirmed.length) {
    console.log("\nRun with --write to record these.");
  }
}

main();
