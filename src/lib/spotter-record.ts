/**
 * A spotter's RECORD, what they actually did, derived from the consensus layer.
 *
 * This is the data behind the profile's badges (src/lib/badges.ts). Nothing here
 * is stored: every figure is derived from Answer + the reached consensus leader,
 * so it can never drift out of sync with the payouts and there is no table to
 * backfill. The leader for a clip is determined with the exact same
 * `groupPendingAnswers` / `pickLeaderGroup` pair the rescore cron uses, so a
 * badge can never disagree with the pebbles that were paid.
 *
 * Definitions, which are deliberately stricter than the payout tiers:
 *
 *   confirmed   an answer of yours on a clip whose community consensus landed on
 *               the same animal you named.
 *   pioneer     you were the FIRST person to name that animal on that clip, and
 *               three or more spotters later independently arrived at it. Note
 *               this is stricter than `consensusTier`'s "pioneer" payout, which
 *               only requires being among the first three to answer the clip at
 *               all. Being early is not the same as being first AND right.
 *   pathfinder  you were the very first spotter to answer a clip nobody had
 *               touched. This is the exploration counterweight: consensus alone
 *               would reward only piling onto clips other people already found.
 *   current     your live reliability streak (see reliabilityStreak).
 *   firstToName the first spotter ever, anywhere on FishSpotter, to put a name
 *               to that animal with the crowd behind you. One holder per animal,
 *               forever.
 *
 * Cost note: this walks every Answer row, the same stance the rescore cron takes
 * (464 rows as of 28 Aug 2026). If the table balloons, both need the same
 * "needs rescore" watermark treatment rather than a per-profile cache.
 */

import type { PrismaClient } from "@prisma/client";
import {
  reliabilityStreak,
  rarityForProbability,
  type RarityTier,
} from "@/lib/pebbles";
import {
  groupPendingAnswers,
  pickLeaderGroup,
} from "@/lib/consensus";
import {
  CATALOGUE_ALIASES,
  loadAliases,
  scientificFromLocalName,
} from "@/lib/answer-matching";
import { normalizeForMatch } from "@/lib/normalize-answer";
import { bucketFor } from "@/lib/biodiversity/buckets";
import { rarityDataAvailable } from "@/lib/rarity-scope";
import {
  atLeastAsRare,
  rarityRank,
  DEEP_PIONEER_MIN_RARITY,
  type BadgeCounts,
} from "@/lib/badges";

/**
 * Confirmation rate is withheld below this many resolved calls, for the same
 * reason the profile withholds accuracy: a percentage at n=2 is a coin flip
 * dressed up as a judgement.
 */
export const MIN_RESOLVED_FOR_RATE = 5;

export interface FirstNamed {
  /** Display label, as the spotter actually typed/picked it. */
  label: string;
  /** Resolved binomial, when the alias table could resolve one. */
  scientificName: string | null;
}

export interface SpotterRecord {
  /** Calls the community agreed with. */
  confirmedCalls: number;
  /** Calls on clips that have reached consensus at all (the rate denominator). */
  resolvedCalls: number;
  /** 0..1, or null while below MIN_RESOLVED_FOR_RATE. */
  confirmationRate: number | null;
  pioneerCalls: number;
  deepPioneerCalls: number;
  pathfinderClips: number;
  current: number;
  rarestFind: { tier: RarityTier; label: string } | null;
  firstToName: FirstNamed[];
  counts: BadgeCounts;
}

/** Parsed SpeciesProbability.speciesJson entry (mirrors consensus.ts). */
type ProbEntry = { scientificName: string; count: number; probability: number };

export async function readSpotterRecord(
  prisma: PrismaClient,
  userId: string,
): Promise<SpotterRecord> {
  const rawAnswers = await prisma.answer.findMany({
    select: {
      id: true,
      userId: true,
      snippetId: true,
      chosenOption: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  type Raw = (typeof rawAnswers)[number];
  const bySnippet = new Map<string, Raw[]>();
  for (const a of rawAnswers) {
    const list = bySnippet.get(a.snippetId);
    if (list) list.push(a);
    else bySnippet.set(a.snippetId, [a]);
  }

  const byArrival = (a: Raw, b: Raw) => {
    const t = a.createdAt.getTime() - b.createdAt.getTime();
    return t !== 0 ? t : a.id.localeCompare(b.id);
  };

  /** snippetId -> winning normalised name (only where consensus was reached). */
  const reachedLeaderBySnippet = new Map<string, string>();
  /** snippetId -> the winning camp's answers, earliest first. */
  const winningCampBySnippet = new Map<string, Raw[]>();
  /** snippetId -> the userId of the very first spotter to answer it at all. */
  const firstAnswererBySnippet = new Map<string, string>();

  for (const [snippetId, answers] of bySnippet) {
    const ordered = [...answers].sort(byArrival);
    if (ordered[0]) firstAnswererBySnippet.set(snippetId, ordered[0].userId);

    const leader = pickLeaderGroup(groupPendingAnswers(answers.map((a) => ({ ...a }))));
    if (!leader) continue;
    reachedLeaderBySnippet.set(snippetId, leader.normalisedName);
    const winningIds = new Set(leader.answers.map((a) => a.id));
    winningCampBySnippet.set(
      snippetId,
      ordered.filter((a) => winningIds.has(a.id)),
    );
  }

  // --- the spotter's own tallies -------------------------------------------
  const mine = rawAnswers.filter((a) => a.userId === userId);

  let resolvedCalls = 0;
  let confirmedCalls = 0;
  let pioneerCalls = 0;
  /** Snippets where this spotter's call was confirmed, for the rarity pass. */
  const confirmedSnippetIds: string[] = [];
  /** Of those, the ones they pioneered. */
  const pioneeredSnippetIds = new Set<string>();

  for (const a of mine) {
    const leader = reachedLeaderBySnippet.get(a.snippetId);
    if (leader === undefined) continue;
    resolvedCalls++;
    if (normalizeForMatch(a.chosenOption) !== leader) continue;
    confirmedCalls++;
    confirmedSnippetIds.push(a.snippetId);
    const camp = winningCampBySnippet.get(a.snippetId);
    if (camp && camp[0]?.userId === userId) {
      pioneerCalls++;
      pioneeredSnippetIds.add(a.snippetId);
    }
  }

  let pathfinderClips = 0;
  for (const first of firstAnswererBySnippet.values()) {
    if (first === userId) pathfinderClips++;
  }

  // --- Current (live reliability streak) -----------------------------------
  const myNewestFirst = mine
    .slice()
    .sort((a, b) => byArrival(b, a))
    .map((a) => ({
      snippetId: a.snippetId,
      matchKey: normalizeForMatch(a.chosenOption),
    }));
  const current = reliabilityStreak(myNewestFirst, reachedLeaderBySnippet);

  // --- first-ever to name each animal --------------------------------------
  // Across every clip that reached consensus, the earliest confirmed call on a
  // given name anywhere on the app. Exactly one spotter can ever hold each.
  const earliestByName = new Map<string, Raw>();
  for (const [snippetId, camp] of winningCampBySnippet) {
    const name = reachedLeaderBySnippet.get(snippetId);
    const first = camp[0];
    if (!name || !first) continue;
    const held = earliestByName.get(name);
    if (!held || byArrival(first, held) < 0) earliestByName.set(name, first);
  }

  const aliases = [...CATALOGUE_ALIASES, ...(await loadAliases())];

  const firstToName: FirstNamed[] = [];
  for (const [, first] of earliestByName) {
    if (first.userId !== userId) continue;
    firstToName.push({
      label: first.chosenOption,
      scientificName: scientificFromLocalName(first.chosenOption, aliases),
    });
  }
  firstToName.sort((a, b) => a.label.localeCompare(b.label));

  // --- rarity of the confirmed calls ---------------------------------------
  const rarityBySnippet = await rarityTiers(
    prisma,
    confirmedSnippetIds,
    winningCampBySnippet,
    aliases,
  );

  let rarestFind: { tier: RarityTier; label: string } | null = null;
  let bestRank = -1;
  let deepPioneerCalls = 0;
  for (const snippetId of confirmedSnippetIds) {
    const tier = rarityBySnippet.get(snippetId);
    if (!tier) continue;
    const rank = rarityRank(tier);
    if (rank > bestRank) {
      bestRank = rank;
      rarestFind = {
        tier,
        label: winningCampBySnippet.get(snippetId)?.[0]?.chosenOption ?? "",
      };
    }
    if (
      pioneeredSnippetIds.has(snippetId) &&
      atLeastAsRare(tier, DEEP_PIONEER_MIN_RARITY)
    ) {
      deepPioneerCalls++;
    }
  }

  const counts: BadgeCounts = {
    confirmed: confirmedCalls,
    pathfinder: pathfinderClips,
    current,
    pioneer: pioneerCalls,
    "deep-pioneer": deepPioneerCalls,
  };

  return {
    confirmedCalls,
    resolvedCalls,
    confirmationRate:
      resolvedCalls >= MIN_RESOLVED_FOR_RATE ? confirmedCalls / resolvedCalls : null,
    pioneerCalls,
    deepPioneerCalls,
    pathfinderClips,
    current,
    rarestFind,
    firstToName,
    counts,
  };
}

/**
 * Rarity tier per snippet for the winning species, batched. Mirrors the lookup
 * in rescoreConsensus (OBIS SpeciesProbability at the clip's lat/lon/depth/month
 * bucket) but resolves every bucket in one query rather than one per clip, since
 * this runs on a page render rather than in a nightly cron.
 */
async function rarityTiers(
  prisma: PrismaClient,
  snippetIds: string[],
  winningCampBySnippet: Map<string, Array<{ chosenOption: string }>>,
  aliases: Awaited<ReturnType<typeof loadAliases>>,
): Promise<Map<string, RarityTier>> {
  const out = new Map<string, RarityTier>();
  if (snippetIds.length === 0) return out;

  const snippets = await prisma.snippet.findMany({
    where: { id: { in: Array.from(new Set(snippetIds)) } },
    select: { id: true, lat: true, lon: true, depthM: true, recordingDatetime: true },
  });

  const bucketBySnippet = new Map<string, ReturnType<typeof bucketFor>>();
  const wanted: Array<{
    latBucket: number;
    lonBucket: number;
    depthBucket: number;
    month: number;
  }> = [];
  const seen = new Set<string>();
  for (const s of snippets) {
    const bucket = bucketFor(s);
    bucketBySnippet.set(s.id, bucket);
    if (!bucket) continue;
    const key = `${bucket.latBucket}|${bucket.lonBucket}|${bucket.depthBucket}|${bucket.month}`;
    if (seen.has(key)) continue;
    seen.add(key);
    wanted.push(bucket);
  }
  if (wanted.length === 0) return out;

  const rows = await prisma.speciesProbability.findMany({
    where: { OR: wanted },
    select: {
      latBucket: true,
      lonBucket: true,
      depthBucket: true,
      month: true,
      status: true,
      totalRecords: true,
      speciesJson: true,
    },
  });
  const rowByKey = new Map(
    rows.map((r) => [
      `${r.latBucket}|${r.lonBucket}|${r.depthBucket}|${r.month}`,
      r,
    ]),
  );

  for (const snippetId of new Set(snippetIds)) {
    const bucket = bucketBySnippet.get(snippetId);
    if (!bucket) continue;
    const row = rowByKey.get(
      `${bucket.latBucket}|${bucket.lonBucket}|${bucket.depthBucket}|${bucket.month}`,
    );
    const repOption = winningCampBySnippet.get(snippetId)?.[0]?.chosenOption ?? "";
    const sci = scientificFromLocalName(repOption, aliases);
    // See rarity-scope.ts: OBIS is fish-only, so an invertebrate's absence from
    // the bucket is a fact about the data source, not a rare sighting.
    const bucketHasData =
      !!row &&
      row.status === "OK" &&
      row.totalRecords > 0 &&
      rarityDataAvailable(sci, true);

    let probability: number | null = null;
    if (bucketHasData && row && sci) {
      try {
        const entries = JSON.parse(row.speciesJson) as ProbEntry[];
        const match = entries.find((e) => e.scientificName === sci);
        probability = match ? match.probability : null;
      } catch {
        probability = null;
      }
    }
    // No resolvable species means we cannot claim it is absent from the bucket,
    // so it must not inflate to legendary: treat it as unknown (common).
    if (!sci) {
      out.set(snippetId, "common");
      continue;
    }
    out.set(snippetId, rarityForProbability(probability, bucketHasData).tier);
  }

  return out;
}
