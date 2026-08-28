/**
 * Merge the reference-trawl proposals into src/data/species-references.json.
 *
 * The trawl agents deliberately do not write the reference file: several run in
 * parallel, and a shared JSON with concurrent writers is how you lose an
 * afternoon. They each write a shard file; this applies them, once, with
 * validation, in one place.
 *
 * What this REFUSES to take on trust:
 *   - a source with no url or no expectText is dropped. Without expectText the
 *     verifier cannot prove the page is about the species, so it is not a
 *     citation, it is a link.
 *   - a binding naming a species not in the catalogue, or a source that does
 *     not exist after the merge, is dropped.
 *   - `supportsClaim: true` becomes `claimSupported: true` ONLY when the
 *     shard's adversarial verifier did not reject or downgrade that binding.
 *     The trawler's own confidence is not evidence about the trawler.
 *   - every merged source lands UNVERIFIED. `refs:verify` must pass before the
 *     UI will show it, because the payload filters on linkVerified. That is the
 *     safety property: a bad merge cannot put a citation on a page by itself.
 *
 *   npm run refs:merge [-- --dry-run]
 */

import { promises as fs } from "fs";
import path from "path";
import speciesTraitsData from "../../src/data/species-traits.json";
import {
  referenceFileSchema,
  sourceSchema,
  type Claim,
  type ReferenceFile,
  type Source,
} from "../../src/lib/references/schema";

const REPO = process.cwd();
const REFS = path.join(REPO, "src", "data", "species-references.json");
const PROPOSALS =
  process.env.REFS_PROPOSAL_DIR ??
  "C:/Users/CHRIST~1/AppData/Local/Temp/claude/C--Users-Christian-Abulhawa-FishSpotter/fd129041-a352-420d-8f39-33d362f0250f/scratchpad/refs-trawl";

const DRY = process.argv.includes("--dry-run");
const TODAY = new Date().toISOString().slice(0, 10);

const CATALOGUE = speciesTraitsData as unknown as Record<string, { commonName: string }>;

type ProposalSource = Partial<Source> & { id?: string; tier?: number; httpStatus?: number };
type ProposalBinding = {
  species?: string;
  claimKey?: string;
  sourceId?: string;
  locator?: string;
  quote?: string;
  supportsClaim?: boolean;
};
type ProposalConflict = {
  species?: string;
  claimKey?: string;
  appSays?: string;
  sourceSays?: string;
  sourceId?: string;
};
type Shard = {
  shard?: string;
  sources?: ProposalSource[];
  bindings?: ProposalBinding[];
  conflicts?: ProposalConflict[];
};
type Verdict = {
  shard?: string;
  rejected?: Array<{ species?: string; claimKey?: string; sourceId?: string; reason?: string }>;
  downgraded?: Array<{ species?: string; claimKey?: string; reason?: string }>;
};

const rejectKey = (species: string, claimKey: string) => `${species}\u0000${claimKey}`;

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function main() {
  const file: ReferenceFile = referenceFileSchema.parse(JSON.parse(await fs.readFile(REFS, "utf8")));
  const entries = await fs.readdir(PROPOSALS).catch(() => [] as string[]);

  /**
   * Shards are named explicitly, NOT globbed.
   *
   * The agents leave working files in the same directory, and one of them
   * (`parts.json`) was a verbatim copy of a shard's own output. A glob merged
   * it as a second shard, double-counting 33 sources and 66 bindings. Only
   * these names are proposals.
   */
  const SHARD_KEYS = [
    "fish-1", "fish-2", "fish-3", "flatfish",
    "crab", "squid", "starfish", "gastropod", "jellyfish", "urchin", "other",
  ];
  const shardFiles = SHARD_KEYS.map((k) => `${k}.json`).filter((f) => entries.includes(f));
  const verdictFiles = entries.filter((f) => f.endsWith(".json") && f.includes("verify"));

  /**
   * Which shards actually had an adversarial pass. A binding may only be marked
   * `claimSupported` if its own shard was verified: otherwise the only evidence
   * that the trawler was right is the trawler, which is the exact failure this
   * whole system exists to avoid.
   */
  const verifiedShards = new Set(
    verdictFiles.map((f) => f.replace(/[-.]verify\.json$/, "").replace(/\.json$/, "")),
  );

  // Everything the verifiers threw out, keyed so a binding can be looked up.
  const rejected = new Set<string>();
  const downgraded = new Set<string>();
  for (const vf of verdictFiles) {
    const v = await readJson<Verdict>(path.join(PROPOSALS, vf));
    for (const r of v?.rejected ?? []) {
      if (r.species && r.claimKey) rejected.add(rejectKey(r.species, r.claimKey));
    }
    for (const d of v?.downgraded ?? []) {
      if (d.species && d.claimKey) downgraded.add(rejectKey(d.species, d.claimKey));
    }
  }
  console.log(
    `Read ${shardFiles.length} shard file(s) and ${verdictFiles.length} verdict file(s): ${rejected.size} rejection(s), ${downgraded.size} downgrade(s)\n`,
  );

  const unverified = shardFiles
    .map((f) => f.replace(/\.json$/, ""))
    .filter((k) => !verifiedShards.has(k));
  if (unverified.length) {
    console.log(
      `No adversarial pass for: ${unverified.join(", ")} - nothing from those shards can be marked supported.\n`,
    );
  }

  const stats = {
    sourcesAdded: 0,
    sourcesSkipped: 0,
    bindingsAdded: 0,
    bindingsSkipped: 0,
    bindingsRejected: 0,
    supported: 0,
    conflicts: 0,
  };
  const skipped: string[] = [];

  for (const sf of shardFiles) {
    const shard = await readJson<Shard>(path.join(PROPOSALS, sf));
    if (!shard) {
      skipped.push(`${sf}: unreadable JSON`);
      continue;
    }
    const name = shard.shard ?? sf.replace(/\.json$/, "");

    // ---- sources
    for (const s of shard.sources ?? []) {
      if (!s.id) {
        stats.sourcesSkipped++;
        skipped.push(`${name}: a source has no id`);
        continue;
      }
      if (!s.url || !s.expectText?.length) {
        stats.sourcesSkipped++;
        skipped.push(`${name}: source ${s.id} has no url or no expectText, so it cannot be proved`);
        continue;
      }
      // Keep an existing entry rather than letting an agent restate it.
      if (file.sources[s.id]) continue;
      const parsed = sourceSchema.safeParse({
        kind: s.kind,
        title: s.title,
        authors: s.authors,
        publisher: s.publisher,
        year: s.year,
        url: s.url,
        licence: s.licence,
        identifier: s.identifier,
        expectText: s.expectText,
        expectCommonName: s.expectCommonName,
        verifyMode: s.verifyMode ?? (s.url.toLowerCase().endsWith(".pdf") ? "pdf" : undefined),
      });
      if (!parsed.success) {
        stats.sourcesSkipped++;
        skipped.push(`${name}: source ${s.id} failed schema: ${parsed.error.issues[0]?.message}`);
        continue;
      }
      file.sources[s.id] = parsed.data;
      stats.sourcesAdded++;
    }

    // ---- bindings
    for (const b of shard.bindings ?? []) {
      const { species, claimKey, sourceId, locator, quote } = b;
      if (!species || !claimKey || !sourceId || !locator || !quote) {
        stats.bindingsSkipped++;
        skipped.push(`${name}: incomplete binding ${species ?? "?"} ${claimKey ?? "?"}`);
        continue;
      }
      if (!(species in CATALOGUE)) {
        stats.bindingsSkipped++;
        skipped.push(`${name}: ${species} is not a catalogue species`);
        continue;
      }
      if (!file.sources[sourceId]) {
        stats.bindingsSkipped++;
        skipped.push(`${name}: ${species} ${claimKey} cites unknown source ${sourceId}`);
        continue;
      }
      if (rejected.has(rejectKey(species, claimKey))) {
        stats.bindingsRejected++;
        continue;
      }

      const entry = file.species[species];
      if (!entry) {
        stats.bindingsSkipped++;
        skipped.push(`${name}: ${species} has no reference entry`);
        continue;
      }
      // Never overwrite a binding a human already evidenced.
      const existing = entry.claims[claimKey];
      if (existing?.claimSupported) continue;
      // Idempotent: the same passage from the same source is not new evidence,
      // so a re-run adds nothing rather than stacking duplicate support rows.
      if (existing?.support.some((sp) => sp.sourceId === sourceId && sp.locator === locator)) continue;

      // The trawler's own "supportsClaim" survives only if an adversarial pass
      // actually ran on this shard AND left this binding alone.
      const supported =
        Boolean(b.supportsClaim) &&
        verifiedShards.has(name) &&
        !downgraded.has(rejectKey(species, claimKey));

      const claim: Claim = {
        sourceIds: Array.from(new Set([...(existing?.sourceIds ?? []), sourceId])),
        support: [
          ...(existing?.support ?? []),
          {
            sourceId,
            locator,
            quote: quote.slice(0, 240),
            readBy: `refs:trawl (${name})`,
            readOn: TODAY,
          },
        ],
        claimSupported: supported,
        conflict: existing?.conflict,
      };
      entry.claims[claimKey] = claim;
      entry.sourceIds = Array.from(new Set([...entry.sourceIds, sourceId]));
      stats.bindingsAdded++;
      if (supported) stats.supported++;
    }

    // ---- conflicts: the most valuable output, so they are applied even when
    // the claim has no binding, and they never overwrite an existing conflict.
    for (const c of shard.conflicts ?? []) {
      if (!c.species || !c.claimKey || !c.sourceSays) continue;
      if (!(c.species in CATALOGUE)) continue;
      const entry = file.species[c.species];
      if (!entry) continue;
      const text = `The app says: ${c.appSays ?? "(not recorded)"} The source says: ${c.sourceSays}`;
      const existing = entry.claims[c.claimKey];
      if (existing) {
        if (!existing.conflict) {
          existing.conflict = text;
          stats.conflicts++;
        }
      } else if (c.sourceId && file.sources[c.sourceId]) {
        entry.claims[c.claimKey] = {
          sourceIds: [c.sourceId],
          support: [],
          claimSupported: false,
          conflict: text,
        };
        entry.sourceIds = Array.from(new Set([...entry.sourceIds, c.sourceId]));
        stats.conflicts++;
      }
    }

    console.log(
      `  ${name.padEnd(12)} +${(shard.sources ?? []).length} source(s) proposed, ${(shard.bindings ?? []).length} binding(s), ${(shard.conflicts ?? []).length} conflict(s)`,
    );
  }

  const parsed = referenceFileSchema.parse(file);
  console.log(
    `\nsources added   ${stats.sourcesAdded} (skipped ${stats.sourcesSkipped})` +
      `\nbindings added  ${stats.bindingsAdded} (skipped ${stats.bindingsSkipped}, rejected by the verifier ${stats.bindingsRejected})` +
      `\nmarked supported ${stats.supported}` +
      `\nconflicts recorded ${stats.conflicts}`,
  );

  if (skipped.length) {
    console.log(`\n${skipped.length} item(s) refused:`);
    for (const s of skipped.slice(0, 40)) console.log(`  - ${s}`);
    if (skipped.length > 40) console.log(`  ... and ${skipped.length - 40} more`);
  }

  if (DRY) {
    console.log("\n[dry run] nothing written");
  } else {
    await fs.writeFile(REFS, JSON.stringify(parsed, null, 2) + "\n", "utf8");
    console.log(`\nWrote ${path.relative(REPO, REFS)}`);
    console.log("Every new source is UNVERIFIED. Run `npm run refs:verify` before any of it can render.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
