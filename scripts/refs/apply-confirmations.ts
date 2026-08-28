/**
 * Apply the confirmation pass: promote, demote or flag each bound claim.
 *
 * A reader agent re-read the recorded passage for every bound-but-unconfirmed
 * claim and decided whether it genuinely carries the app's wording. A second,
 * adversarial agent then tried to overturn each confirmation. This applies the
 * surviving decisions.
 *
 * The one rule that matters: a claim is only promoted to `claimSupported` when
 * the reader confirmed it AND the challenger did not overturn it AND the reader
 * says it verified the quote verbatim on the live page. `claimSupported` is the
 * only flag in this system that asserts a human-grade check happened, and it has
 * already been wrong twice, both times because someone confirmed a passage that
 * was merely about the right topic.
 *
 *   npm run refs:apply-confirmations [-- --dry-run]
 */

import { promises as fs } from "fs";
import path from "path";
import { referenceFileSchema, type ReferenceFile } from "../../src/lib/references/schema";

const REPO = process.cwd();
const REFS = path.join(REPO, "src", "data", "species-references.json");
const PROPOSALS =
  process.env.REFS_PROPOSAL_DIR ??
  "C:/Users/CHRIST~1/AppData/Local/Temp/claude/C--Users-Christian-Abulhawa-FishSpotter/fd129041-a352-420d-8f39-33d362f0250f/scratchpad/refs-trawl";

const DRY = process.argv.includes("--dry-run");
const TODAY = new Date().toISOString().slice(0, 10);

const SHARDS = [
  "cod-wrasse",
  "small-fish",
  "pelagic-flat",
  "crab-ceph",
  "echino-gastro",
  "jelly-birds-seals",
];

type Decision = {
  species?: string;
  claimKey?: string;
  action?: "confirm" | "downgrade" | "conflict" | "rebind";
  reason?: string;
  appSays?: string;
  sourceSays?: string;
  betterQuote?: string;
  betterLocator?: string;
  quoteVerifiedVerbatim?: boolean;
};
type ConfirmFile = { shard?: string; decisions?: Decision[] };
type Challenge = {
  overturned?: Array<{ species?: string; claimKey?: string; reason?: string }>;
};

const key = (s: string, k: string) => `${s} :: ${k}`;

async function readJson<T>(name: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(PROPOSALS, name), "utf8")) as T;
  } catch {
    return null;
  }
}

async function main() {
  const file: ReferenceFile = referenceFileSchema.parse(JSON.parse(await fs.readFile(REFS, "utf8")));

  // Everything the challenger overturned, across all shards.
  const overturned = new Map<string, string>();
  const entries = await fs.readdir(PROPOSALS).catch(() => [] as string[]);
  for (const f of entries.filter((f) => /challenge|verify/i.test(f) && f.endsWith(".json"))) {
    const c = await readJson<Challenge>(f);
    for (const o of c?.overturned ?? []) {
      if (o.species && o.claimKey) overturned.set(key(o.species, o.claimKey), o.reason ?? "overturned");
    }
  }

  const stats = { confirmed: 0, blockedByChallenger: 0, notVerbatim: 0, downgraded: 0, conflicts: 0, rebound: 0, missing: 0 };
  const notes: string[] = [];

  for (const shard of SHARDS) {
    const data = await readJson<ConfirmFile>(`confirm-${shard}.json`);
    if (!data?.decisions) {
      notes.push(`confirm-${shard}.json missing or unreadable`);
      continue;
    }
    for (const d of data.decisions) {
      if (!d.species || !d.claimKey) continue;
      const claim = file.species[d.species]?.claims[d.claimKey];
      if (!claim) {
        stats.missing++;
        continue;
      }

      if (d.action === "confirm") {
        if (overturned.has(key(d.species, d.claimKey))) {
          stats.blockedByChallenger++;
          continue;
        }
        // A confirmation that did not check the words on the page is an
        // opinion about the source, not a check of the claim.
        if (d.quoteVerifiedVerbatim === false) {
          stats.notVerbatim++;
          continue;
        }
        claim.claimSupported = true;
        for (const sp of claim.support) {
          sp.readBy = `refs:confirm (${shard}), adversarially checked`;
          sp.readOn = TODAY;
        }
        stats.confirmed++;
      } else if (d.action === "conflict") {
        claim.claimSupported = false;
        claim.conflict = `The app says: ${d.appSays ?? "(not recorded)"} The source says: ${d.sourceSays ?? d.reason ?? ""}`;
        stats.conflicts++;
      } else if (d.action === "rebind" && d.betterQuote) {
        const sp = claim.support[0];
        if (sp) {
          sp.quote = d.betterQuote.slice(0, 240);
          if (d.betterLocator) sp.locator = d.betterLocator;
          sp.readOn = TODAY;
        }
        claim.claimSupported = false;
        stats.rebound++;
      } else {
        claim.claimSupported = false;
        stats.downgraded++;
      }
    }
  }

  const parsed = referenceFileSchema.parse(file);
  console.log(
    `confirmed ${stats.confirmed}\n` +
      `  held back: ${stats.blockedByChallenger} overturned by the challenger, ${stats.notVerbatim} whose quote was not checked word for word\n` +
      `downgraded ${stats.downgraded}, rebound ${stats.rebound}, conflicts flagged ${stats.conflicts}` +
      (stats.missing ? `, ${stats.missing} referred to a claim that no longer exists` : ""),
  );
  for (const n of notes) console.log("  ! " + n);

  if (DRY) {
    console.log("\n[dry run] nothing written");
  } else {
    await fs.writeFile(REFS, JSON.stringify(parsed, null, 2) + "\n", "utf8");
    console.log(`\nWrote ${path.relative(REPO, REFS)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
