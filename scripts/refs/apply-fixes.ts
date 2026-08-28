/**
 * Apply the remediation proposals to src/data/species-references.json.
 *
 * Separate from `refs:merge` because these REMOVE and CORRECT rather than add,
 * and a bad removal is quieter than a bad addition. Each proposal file is
 * applied by its own handler, and every action is printed.
 *
 * Handles, where the file exists:
 *   fix-diet-matches.json  unbind / rebind feeding links whose diet record was
 *                          a family, genus or category-label match rather than
 *                          the prey species
 *   fix-titles.json        replace the resolver's fabricated template titles
 *                          with the documents' real ones
 *   fix-unbind.json        unbind / rebind / flag-as-conflict the bindings the
 *                          authority audit found stretched beyond their source
 *
 *   npm run refs:apply-fixes [-- --dry-run]
 */

import { promises as fs } from "fs";
import path from "path";
import { referenceFileSchema, type ReferenceFile } from "../../src/lib/references/schema";

const REPO = process.cwd();
const REFS = path.join(REPO, "src", "data", "species-references.json");
const VERIFICATION = path.join(REPO, "src", "data", "reference-verification.json");
const PROPOSALS =
  process.env.REFS_PROPOSAL_DIR ??
  "C:/Users/CHRIST~1/AppData/Local/Temp/claude/C--Users-Christian-Abulhawa-FishSpotter/fd129041-a352-420d-8f39-33d362f0250f/scratchpad/refs-trawl";

const DRY = process.argv.includes("--dry-run");
const TODAY = new Date().toISOString().slice(0, 10);

async function readJson<T>(name: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(PROPOSALS, name), "utf8")) as T;
  } catch {
    return null;
  }
}

/** Drop a claim entirely, and drop any source it was the last user of. */
function unbindClaim(file: ReferenceFile, species: string, claimKey: string): boolean {
  const entry = file.species[species];
  if (!entry?.claims[claimKey]) return false;
  delete entry.claims[claimKey];
  // Keep sourceIds honest: a source nothing cites should not sit in the list,
  // because the numbered citation list on the page is built from it.
  const stillCited = new Set<string>();
  for (const c of Object.values(entry.claims)) c.sourceIds.forEach((id) => stillCited.add(id));
  entry.sourceIds = entry.sourceIds.filter(
    (id) => stillCited.has(id) || id.startsWith("worms:"),
  );
  return true;
}

type DietFix = {
  links?: Array<{
    species?: string;
    claimKey?: string;
    action?: string;
    matchLevel?: string;
    territory?: string;
    betterQuote?: string;
    reason?: string;
  }>;
};
type TitleFix = {
  titles?: Record<
    string,
    {
      /** The title as it stood when the agent read the registry: a drift guard. */
      currentTitle?: string;
      realTitle?: string;
      proposedTitle?: string;
      /** False means the agent decided this one must NOT be applied. */
      changed?: boolean;
      reason?: string;
    }
  >;
};
type UnbindFix = {
  actions?: Array<{
    species?: string;
    claimKey?: string;
    action?: string;
    reason?: string;
    appSays?: string;
    sourceSays?: string;
    betterQuote?: string;
    betterLocator?: string;
  }>;
};

async function main() {
  const file: ReferenceFile = referenceFileSchema.parse(JSON.parse(await fs.readFile(REFS, "utf8")));
  const log: string[] = [];
  const stats = { unbound: 0, rebound: 0, conflicts: 0, titles: 0, missing: 0 };

  // ---------------------------------------------------------- diet matches
  const diet = await readJson<DietFix>("fix-diet-matches.json");
  if (diet?.links) {
    for (const l of diet.links) {
      if (!l.species || !l.claimKey) continue;
      if (l.action === "unbind") {
        if (unbindClaim(file, l.species, l.claimKey)) {
          stats.unbound++;
          log.push(`unbind  ${l.species} ${l.claimKey}  (${l.matchLevel} match) :: ${l.reason ?? ""}`);
        } else {
          stats.missing++;
        }
      } else if (l.action === "rebind" && l.betterQuote) {
        const claim = file.species[l.species]?.claims[l.claimKey];
        if (claim && claim.support[0]) {
          claim.support[0].quote = l.betterQuote.slice(0, 240);
          claim.support[0].locator = "Food items (species-level record)";
          claim.support[0].readOn = TODAY;
          claim.claimSupported = false;
          stats.rebound++;
          log.push(`rebind  ${l.species} ${l.claimKey}`);
        } else {
          stats.missing++;
        }
      }
    }
  } else {
    log.push("(no fix-diet-matches.json)");
  }

  // ---------------------------------------------------------- real titles
  const titles = await readJson<TitleFix>("fix-titles.json");
  if (titles?.titles) {
    let drifted = 0;
    let notApplicable = 0;
    for (const [id, t] of Object.entries(titles.titles)) {
      // `changed: false` is the agent's explicit refusal, not an oversight. Two
      // of these resolve to a repository name and a publisher error page rather
      // than the article, so applying them would replace a decent title with a
      // meaningless one.
      if (!t.changed) {
        notApplicable++;
        continue;
      }
      const source = file.sources[id];
      if (!source) {
        notApplicable++;
        continue;
      }
      /**
       * Drift guard, requested by the agent that produced this file. The
       * registry went 172 -> 249 -> 230 sources while it worked, because other
       * agents and the orphan prune were editing it in parallel. Applying a
       * title to a source that has since changed underneath would overwrite
       * someone else's correction with a stale one.
       */
      if (t.currentTitle && t.currentTitle !== source.title) {
        drifted++;
        continue;
      }
      const proposed = t.proposedTitle ?? t.realTitle;
      if (!proposed || proposed === source.title) continue;
      source.title = proposed;
      stats.titles++;
    }
    log.push(
      `titles  replaced ${stats.titles} fabricated title(s) with the document's own` +
        (drifted ? `; ${drifted} skipped because the registry moved underneath` : "") +
        (notApplicable ? `; ${notApplicable} not applicable` : ""),
    );
  } else {
    log.push("(no fix-titles.json)");
  }

  // ---------------------------------------------------------- stretched bindings
  const unbind = await readJson<UnbindFix>("fix-unbind.json");
  if (unbind?.actions) {
    for (const a of unbind.actions) {
      if (!a.species || !a.claimKey) continue;
      const entry = file.species[a.species];
      if (!entry) {
        stats.missing++;
        continue;
      }
      if (a.action === "unbind") {
        if (unbindClaim(file, a.species, a.claimKey)) {
          stats.unbound++;
          log.push(`unbind  ${a.species} ${a.claimKey} :: ${a.reason ?? ""}`);
        } else stats.missing++;
      } else if (a.action === "conflict") {
        const text = `The app says: ${a.appSays ?? "(not recorded)"} The source says: ${a.sourceSays ?? a.reason ?? ""}`;
        const claim = entry.claims[a.claimKey];
        if (claim) {
          claim.conflict = text;
          claim.claimSupported = false;
          stats.conflicts++;
          log.push(`conflict ${a.species} ${a.claimKey}`);
        } else stats.missing++;
      } else if (a.action === "rebind" && a.betterQuote) {
        const claim = entry.claims[a.claimKey];
        if (claim && claim.support[0]) {
          claim.support[0].quote = a.betterQuote.slice(0, 240);
          if (a.betterLocator) claim.support[0].locator = a.betterLocator;
          claim.support[0].readOn = TODAY;
          claim.claimSupported = false;
          stats.rebound++;
          log.push(`rebind  ${a.species} ${a.claimKey}`);
        } else stats.missing++;
      }
    }
  } else {
    log.push("(no fix-unbind.json)");
  }

  /**
   * Prune sources that no claim cites any more.
   *
   * Unbinding leaves them behind: the merge added the source, the binding was
   * then removed, and the registry keeps a citation for a statement nobody
   * makes. They are listed rather than dropped silently, because several are
   * genuine finds whose binding was rejected on a technicality and which should
   * come back properly rather than be forgotten. WoRMS entries are kept
   * regardless: they back the taxonomic identity line, which is not a claim.
   */
  const cited = new Set<string>();
  for (const entry of Object.values(file.species)) {
    for (const claim of Object.values(entry.claims)) claim.sourceIds.forEach((id) => cited.add(id));
  }
  const orphans = Object.keys(file.sources).filter(
    (id) => !cited.has(id) && !id.startsWith("worms:"),
  );
  for (const id of orphans) delete file.sources[id];
  for (const entry of Object.values(file.species)) {
    entry.sourceIds = entry.sourceIds.filter((id) => file.sources[id]);
  }

  const parsed = referenceFileSchema.parse(file);

  for (const line of log.slice(0, 60)) console.log("  " + line);
  if (log.length > 60) console.log(`  ... and ${log.length - 60} more`);
  console.log(
    `\nunbound ${stats.unbound}, rebound ${stats.rebound}, conflicts flagged ${stats.conflicts}, titles ${stats.titles}` +
      (stats.missing ? `, ${stats.missing} action(s) referred to a claim that no longer exists` : ""),
  );

  // Verification rows for sources that no longer exist would fail the catalogue
  // test, and would quietly assert we had checked something since removed. Keep
  // the two files in step.
  const verificationRaw = JSON.parse(await fs.readFile(VERIFICATION, "utf8")) as Record<
    string,
    unknown
  >;
  let verificationPruned = 0;
  for (const id of Object.keys(verificationRaw)) {
    if (!parsed.sources[id]) {
      delete verificationRaw[id];
      verificationPruned++;
    }
  }

  if (DRY) {
    console.log("\n[dry run] nothing written");
  } else {
    await fs.writeFile(REFS, JSON.stringify(parsed, null, 2) + "\n", "utf8");
    const sortedVerification = Object.fromEntries(
      Object.entries(verificationRaw).sort(([a], [b]) => a.localeCompare(b)),
    );
    await fs.writeFile(VERIFICATION, JSON.stringify(sortedVerification, null, 2) + "\n", "utf8");
    console.log(`\nWrote ${path.relative(REPO, REFS)}`);
    if (verificationPruned) {
      console.log(`Dropped ${verificationPruned} verification row(s) for sources that no longer exist.`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
