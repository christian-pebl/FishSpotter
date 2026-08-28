/**
 * Move the depth tile off computed OBIS records and onto STATED depth ranges.
 *
 * Why this exists. The tile used to say "Usually seen at 16-270 m (median
 * 42 m)", computed by PEBL from OBIS occurrence records. An audit on 28 Aug
 * 2026 established that this is survey-gear geometry rather than animal depth:
 * OBIS's depth is the midpoint of a sampling interval, missingness is not
 * random, and for an air-breather it is the depth of the OBSERVER. Two live
 * pages were telling the public that a grey seal and a great cormorant are
 * "usually seen at ~0 m". Guards now suppress the worst of it, but a computed
 * number was never the right thing to show.
 *
 * FishBase and MarLIN both publish an explicit depth range, and 62 of the 72
 * catalogue species have one. So the tile becomes what every other fact on the
 * page already is: a statement read from a source, carrying a citation, and
 * simply absent where no source states one.
 *
 * Writes:
 *   src/data/species-depth.json          what to display, per species
 *   src/data/species-references.json     a `trait:depth` claim + its passage
 *
 *   npm run refs:apply-depth [-- --dry-run]
 */

import { promises as fs } from "fs";
import path from "path";
import speciesTraitsData from "../../src/data/species-traits.json";
import {
  referenceFileSchema,
  sourceSchema,
  type ReferenceFile,
  type Source,
} from "../../src/lib/references/schema";

const REPO = process.cwd();
const REFS = path.join(REPO, "src", "data", "species-references.json");
const OUT = path.join(REPO, "src", "data", "species-depth.json");
const PROPOSALS =
  process.env.REFS_PROPOSAL_DIR ??
  "C:/Users/CHRIST~1/AppData/Local/Temp/claude/C--Users-Christian-Abulhawa-FishSpotter/fd129041-a352-420d-8f39-33d362f0250f/scratchpad/refs-trawl";

const DRY = process.argv.includes("--dry-run");
const CATALOGUE = speciesTraitsData as unknown as Record<string, { commonName: string }>;

type DepthEntry = {
  species?: string;
  sourceId?: string;
  locator?: string;
  quote?: string;
  /** The tight band, e.g. "40-100 m". */
  displayLabel?: string;
  /** The full range with the usual band in brackets, e.g. "40-200 m (usually 40-100 m)". */
  altDisplayLabel?: string;
  confidence?: string;
  readBy?: string;
  readOn?: string;
};
type DepthFix = {
  depths?: DepthEntry[];
  noSource?: string[];
  newSources?: Record<string, Partial<Source>>;
};

async function main() {
  const raw = await fs.readFile(path.join(PROPOSALS, "fix-depth.json"), "utf8");
  const fix = JSON.parse(raw) as DepthFix;
  const file: ReferenceFile = referenceFileSchema.parse(JSON.parse(await fs.readFile(REFS, "utf8")));

  // Sources the depth agent found that are not in the registry yet (SCOS, the
  // Cefas guide). Same rule as the merge: no url or no expectText, no entry.
  let sourcesAdded = 0;
  for (const [id, s] of Object.entries(fix.newSources ?? {})) {
    if (file.sources[id]) continue;
    if (!s.url || !s.expectText?.length) continue;
    const parsed = sourceSchema.safeParse(s);
    if (!parsed.success) continue;
    file.sources[id] = parsed.data;
    sourcesAdded++;
  }

  const display: Record<string, { label: string; detail?: string; sourceId: string }> = {};
  const skipped: string[] = [];
  let bound = 0;

  for (const d of fix.depths ?? []) {
    const { species, sourceId, locator, quote, displayLabel } = d;
    if (!species || !(species in CATALOGUE)) continue;
    if (d.confidence !== "stated") {
      skipped.push(`${CATALOGUE[species].commonName}: no source states a depth range`);
      continue;
    }
    if (!sourceId || !locator || !quote || !displayLabel) {
      skipped.push(`${CATALOGUE[species].commonName}: incomplete proposal`);
      continue;
    }
    if (!file.sources[sourceId]) {
      // The registry moved under several agents today; a depth citing a source
      // that no longer exists must not be written.
      skipped.push(`${CATALOGUE[species].commonName}: source ${sourceId} is not in the registry`);
      continue;
    }

    display[species] = {
      label: displayLabel,
      detail: d.altDisplayLabel && d.altDisplayLabel !== displayLabel ? d.altDisplayLabel : undefined,
      sourceId,
    };

    const entry = file.species[species];
    if (!entry) continue;
    const existing = entry.claims["trait:depth"];
    if (existing?.claimSupported) continue;
    entry.claims["trait:depth"] = {
      sourceIds: [sourceId],
      support: [
        {
          sourceId,
          locator,
          quote: quote.slice(0, 240),
          readBy: d.readBy ?? "refs:apply-depth",
          readOn: d.readOn ?? new Date().toISOString().slice(0, 10),
        },
      ],
      // The passage states a depth range and the tile renders that range, so
      // this is one of the few places the entailment is direct. It still is not
      // marked supported here: a script that copies a number is not a reader.
      claimSupported: false,
      conflict: existing?.conflict,
    };
    entry.sourceIds = Array.from(new Set([...entry.sourceIds, sourceId]));
    bound++;
  }

  const parsed = referenceFileSchema.parse(file);
  console.log(
    `depth ranges from a stated source: ${Object.keys(display).length}/${Object.keys(CATALOGUE).length}` +
      `\nclaims bound: ${bound}, sources added: ${sourcesAdded}`,
  );
  if (skipped.length) {
    console.log(`\n${skipped.length} species keep NO depth tile, which is the correct outcome:`);
    for (const s of skipped) console.log(`  - ${s}`);
  }

  if (DRY) {
    console.log("\n[dry run] nothing written");
    return;
  }
  await fs.writeFile(
    OUT,
    JSON.stringify(
      Object.fromEntries(Object.entries(display).sort(([a], [b]) => a.localeCompare(b))),
      null,
      2,
    ) + "\n",
    "utf8",
  );
  await fs.writeFile(REFS, JSON.stringify(parsed, null, 2) + "\n", "utf8");
  console.log(`\nWrote src/data/species-depth.json and ${path.relative(REPO, REFS)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
