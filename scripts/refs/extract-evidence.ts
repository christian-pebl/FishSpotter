/**
 * Bind claims to the passages that actually carry them.
 *
 * For every species with a verified MarLIN and/or FishBase source, this fetches
 * the page once (cached to .refs-cache/), locates the section relevant to each
 * claim by rule, and records a locator plus a short attributed quote.
 *
 * It is deliberately deterministic. Both sites publish stable, named sections,
 * so "which passage is about habitat" is a lookup, not an inference. What it
 * does NOT do is decide whether the passage supports the specific wording the
 * app uses: that is entailment, it needs judgement, and it is the job of
 * `refs:judge` (or a human). So every binding written here lands as
 * claimSupported=false with the evidence attached, ready to be checked.
 *
 * Claims this pass can reach: fieldNote, mark:*, trait:size, trait:habitat,
 * trait:behavior, diet:eats. Claims it cannot (diet:eatenBy, trophic:tier,
 * farm:role, edge:*) are reported at the end rather than quietly skipped,
 * because those need diet-composition and aquaculture-ecology literature that
 * a species summary page does not carry.
 *
 *   npm run refs:extract [-- --species "X"] [-- --limit N] [-- --dry-run]
 */

import { promises as fs } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import speciesTraitsData from "../../src/data/species-traits.json";
import { referenceFileSchema, type Claim, type ReferenceFile, type Support } from "../../src/lib/references/schema";
import { fetchText, sleep } from "./lib/http";
import { fishbaseBlock, marlinParam, parseMarlinSections, quotable } from "./lib/parse-sources";
import { pageText } from "./lib/http";

const REFS = path.join(process.cwd(), "src", "data", "species-references.json");
const CACHE = path.join(process.cwd(), ".refs-cache");
const TODAY = new Date().toISOString().slice(0, 10);
const DELAY_MS = 900;
/** Stamped onto every passage this script reads, so provenance is never vague. */
const READER = "refs:extract (deterministic section parse)";

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const ONLY = argv.includes("--species") ? argv[argv.indexOf("--species") + 1] : undefined;
const LIMIT = argv.includes("--limit") ? Number(argv[argv.indexOf("--limit") + 1]) : undefined;

type Traits = { commonName: string; shapeClass: string; fieldNote?: string };
const CATALOGUE = speciesTraitsData as unknown as Record<string, Traits>;

async function cached(key: string, url: string): Promise<string | null> {
  await fs.mkdir(CACHE, { recursive: true });
  const file = path.join(CACHE, `${key.replace(/[^a-z0-9]+/gi, "_")}.html`);
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    await sleep(DELAY_MS);
    // FishBase is slow (~30s); the default timeout clips it.
    const res = await fetchText(url, { timeoutMs: 90_000 });
    if (!res.ok) return null;
    await fs.writeFile(file, res.text, "utf8");
    return res.text;
  }
}

type Evidence = { sourceId: string; locator: string; quote: string };

async function main() {
  const file: ReferenceFile = referenceFileSchema.parse(JSON.parse(await fs.readFile(REFS, "utf8")));

  const prisma = new PrismaClient();
  const marks = await prisma.diagnosticMark.findMany({
    select: { id: true, scientificName: true },
    orderBy: [{ scientificName: "asc" }, { order: "asc" }],
  });
  await prisma.$disconnect();
  const marksBySpecies = new Map<string, string[]>();
  for (const m of marks) {
    const list = marksBySpecies.get(m.scientificName) ?? [];
    list.push(m.id);
    marksBySpecies.set(m.scientificName, list);
  }

  let names = Object.keys(file.species);
  if (ONLY) names = names.filter((n) => n === ONLY || CATALOGUE[n]?.commonName === ONLY);
  if (LIMIT) names = names.slice(0, LIMIT);

  console.log(`Extracting evidence for ${names.length} species${DRY ? " (dry run)" : ""}\n`);

  let bound = 0;
  const noMorphology: string[] = [];
  const noDiet: string[] = [];

  for (const [i, name] of names.entries()) {
    const entry = file.species[name];
    const traits = CATALOGUE[name];
    if (!entry || !traits) continue;

    const marlinId = entry.sourceIds.find((s) => s.startsWith("marlin:"));
    const fishbaseId = entry.sourceIds.find((s) => s.startsWith("fishbase:"));

    let marlinSections: Map<string, string> | null = null;
    if (marlinId) {
      const url = file.sources[marlinId]?.url;
      const html = url ? await cached(marlinId, url) : null;
      if (html) marlinSections = parseMarlinSections(html);
    }
    let fishbaseText: string | null = null;
    if (fishbaseId) {
      const url = file.sources[fishbaseId]?.url;
      const html = url ? await cached(fishbaseId, url) : null;
      if (html) fishbaseText = pageText(html);
    }

    // ---- gather the candidate passages, best source first per claim ----
    const morphology: Evidence[] = [];
    const habitat: Evidence[] = [];
    const behaviour: Evidence[] = [];
    const size: Evidence[] = [];
    const diet: Evidence[] = [];

    if (fishbaseText && fishbaseId) {
      const desc = fishbaseBlock(fishbaseText, "Short description");
      if (desc) morphology.push({ sourceId: fishbaseId, locator: "Short description", quote: quotable(desc) });
      const sz = fishbaseBlock(fishbaseText, "Size / Weight / Age");
      if (sz) size.push({ sourceId: fishbaseId, locator: "Size / Weight / Age", quote: quotable(sz) });
      const bio = fishbaseBlock(fishbaseText, "Biology");
      if (bio) {
        habitat.push({ sourceId: fishbaseId, locator: "Biology", quote: quotable(bio) });
        behaviour.push({ sourceId: fishbaseId, locator: "Biology", quote: quotable(bio) });
        diet.push({ sourceId: fishbaseId, locator: "Biology", quote: quotable(bio) });
      }
      const env = fishbaseBlock(fishbaseText, "Environment: milieu / climate zone / depth range / distribution range");
      if (env) habitat.push({ sourceId: fishbaseId, locator: "Environment / depth range", quote: quotable(env) });
    }

    if (marlinSections && marlinId) {
      const idf = marlinSections.get("identifying features");
      if (idf) morphology.push({ sourceId: marlinId, locator: "Identifying features", quote: quotable(idf) });
      const desc = marlinSections.get("description");
      if (desc) morphology.push({ sourceId: marlinId, locator: "Description", quote: quotable(desc) });

      const hab = marlinSections.get("habitat");
      if (hab) habitat.push({ sourceId: marlinId, locator: "Habitat", quote: quotable(hab) });
      const habPref = marlinSections.get("habitat preferences");
      if (habPref) {
        const parts = ["Biological zone preferences", "Substratum / habitat preferences", "Physiographic preferences"]
          .map((p) => {
            const v = marlinParam(habPref, p);
            return v ? `${p}: ${v}` : null;
          })
          .filter(Boolean)
          .join("; ");
        if (parts) habitat.push({ sourceId: marlinId, locator: "Habitat preferences", quote: quotable(parts) });
      }

      const bio = marlinSections.get("biology");
      if (bio) {
        const behaviourParts = ["Environmental position", "Sociability", "Mobility", "Body flexibility"]
          .map((p) => {
            const v = marlinParam(bio, p);
            return v ? `${p}: ${v}` : null;
          })
          .filter(Boolean)
          .join("; ");
        if (behaviourParts) {
          behaviour.push({ sourceId: marlinId, locator: "Biology", quote: quotable(behaviourParts) });
        }
        const dietParts = ["Characteristic feeding method", "Typically feeds on", "Diet/food source"]
          .map((p) => {
            const v = marlinParam(bio, p);
            return v ? `${p}: ${v}` : null;
          })
          .filter(Boolean)
          .join("; ");
        if (dietParts) diet.push({ sourceId: marlinId, locator: "Biology", quote: quotable(dietParts) });

        const sizeParts = ["Female size range", "Male size range"]
          .map((p) => {
            const v = marlinParam(bio, p);
            return v ? `${p}: ${v}` : null;
          })
          .filter(Boolean)
          .join("; ");
        if (sizeParts) size.push({ sourceId: marlinId, locator: "Biology", quote: quotable(sizeParts) });
      }
    }

    // ---- write the bindings ----
    const claims: Record<string, Claim> = { ...entry.claims };
    const bind = (key: string, ev: Evidence[]) => {
      if (ev.length === 0) return;
      // Never overwrite a binding a human has already evidenced.
      if (claims[key]?.claimSupported) return;
      const support: Support[] = ev.map((e) => ({
        sourceId: e.sourceId,
        locator: e.locator,
        quote: e.quote,
        readBy: READER,
        readOn: TODAY,
      }));
      claims[key] = {
        sourceIds: Array.from(new Set(ev.map((e) => e.sourceId))),
        support,
        claimSupported: false,
      };
      bound++;
    };

    if (traits.fieldNote) bind("fieldNote", morphology);
    for (const markId of marksBySpecies.get(name) ?? []) bind(`mark:${markId}`, morphology);
    bind("trait:size", size);
    bind("trait:habitat", habitat);
    bind("trait:behavior", behaviour);
    bind("diet:eats", diet);

    if (morphology.length === 0) noMorphology.push(name);
    if (diet.length === 0) noDiet.push(name);

    file.species[name] = { ...entry, claims };
    console.log(
      `[${i + 1}/${names.length}] ${traits.commonName.padEnd(28)} morph:${morphology.length} habitat:${habitat.length} behav:${behaviour.length} size:${size.length} diet:${diet.length}`,
    );
  }

  const parsed = referenceFileSchema.parse(file);
  if (DRY) {
    console.log(`\n[dry run] would bind ${bound} claim(s)`);
  } else {
    await fs.writeFile(REFS, JSON.stringify(parsed, null, 2) + "\n", "utf8");
    console.log(`\nBound ${bound} claim(s) to read passages. Wrote ${path.relative(process.cwd(), REFS)}`);
  }

  console.log(
    `\nEvery binding is claimSupported=false: the passage is recorded, the entailment is not yet judged.`,
  );
  if (noMorphology.length) {
    console.log(`\n${noMorphology.length} species have no morphology passage (their field note and marks stay unbound):`);
    for (const n of noMorphology) console.log(`  - ${CATALOGUE[n]?.commonName ?? n}`);
  }
  if (noDiet.length) {
    console.log(`\n${noDiet.length} species have no diet passage:`);
    for (const n of noDiet) console.log(`  - ${CATALOGUE[n]?.commonName ?? n}`);
  }
  console.log(
    `\nStill out of reach for this pass, by design: diet:eatenBy, trophic:tier, farm:role and the ${237} feeding links.\nThose need diet-composition and aquaculture-ecology literature, not a species summary page.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
