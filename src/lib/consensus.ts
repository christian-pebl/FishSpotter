/**
 * Consensus scoring — the core of the Pebbles economy (sea-currency redesign).
 *
 * There is no PEBL "reference" answer any more: the crowd is the authority.
 * Every clip accumulates community IDs, and once CONSENSUS_THRESHOLD_USERS
 * distinct spotters converge on one normalised name, that name is the clip's
 * leader. The `consensus-rescore` cron then retro-credits every spotter in the
 * winning camp, paying foresight over bandwagoning:
 *
 *   - pioneer  (among the first spotters on the clip)        — PEBBLE_CONSENSUS.pioneer
 *   - joiner   (matched while the consensus was forming)     — PEBBLE_CONSENSUS.joiner
 *   - confirmer(agreed after it was the clear leader)        — PEBBLE_CONSENSUS.confirmer
 *
 * each scaled by RARITY (the winning species' OBIS probability at the clip's
 * site/month/depth bucket) and the spotter's CURRENT reliability streak.
 *
 * Idempotency: each Answer is credited at most once, tracked on the
 * ConsensusEvent's `creditedAnswerIds`. Re-running the cron only credits new
 * late-joiners; the amount frozen at first credit is never recomputed. isCorrect
 * is (re)set each run to reflect the current leader so the leaderboard's "matched
 * consensus" count and tiebreak stay accurate. If a clip's leader later flips to
 * a different name, earlier good-faith credits are NOT clawed back (we only ever
 * credit the current leader's camp going forward).
 *
 * The grouping key is `normalizeForMatch(chosenOption)`, so "Pollack",
 * "pollack ", and "POLLACK" collapse; spelling variants ("Pollack"/"Pollock") do
 * not (alias-aware grouping is a future enhancement).
 */

import type { PrismaClient } from "@prisma/client";
import {
  CONSENSUS_THRESHOLD_USERS,
  consensusTier,
  consensusPayout,
  currentMultiplier,
  reliabilityStreak,
  rarityForProbability,
} from "@/lib/pebbles";
import {
  CATALOGUE_ALIASES,
  loadAliases,
  scientificFromLocalName,
} from "@/lib/answer-matching";
import { CATALOGUE } from "@/lib/idguide/catalogue";
import { normalizeForMatch } from "@/lib/normalize-answer";
import { bucketFor } from "@/lib/biodiversity/buckets";

export type ConsensusRescoreResult = {
  /** Number of (snippet, name) consensus groups inspected. */
  groupsInspected: number;
  /** New consensus events created (previously below threshold). */
  newEvents: number;
  /** Existing events touched because new matchers joined. */
  updatedEvents: number;
  /** Total Answer rows credited a consensus payout in this run. */
  answersCredited: number;
  /** Total Pebbles distributed in this run. */
  pebblesAwarded: number;
  /** UnlockedSpecies rows added this run (consensus filled a pokedex). */
  speciesUnlocked: number;
};

type AnswerRow = {
  id: string;
  userId: string;
  chosenOption: string;
};

type ConsensusGroup = {
  snippetId: string;
  normalisedName: string;
  /** Distinct user IDs matching this group. */
  userIds: Set<string>;
  /** Answer rows in this group, one per user. */
  answers: AnswerRow[];
};

/**
 * Build the consensus groups from raw answers. Pure function so the cron tests
 * don't need a DB. Groups by (snippetId, normalizeForMatch(chosenOption)).
 */
export function groupPendingAnswers(
  answers: Array<AnswerRow & { snippetId: string }>,
): ConsensusGroup[] {
  const grouped = new Map<string, ConsensusGroup>();
  for (const a of answers) {
    const norm = normalizeForMatch(a.chosenOption);
    if (!norm) continue;
    const key = `${a.snippetId}__${norm}`;
    let group = grouped.get(key);
    if (!group) {
      group = {
        snippetId: a.snippetId,
        normalisedName: norm,
        userIds: new Set(),
        answers: [],
      };
      grouped.set(key, group);
    }
    // One Answer per (userId, snippetId) is enforced by the schema's
    // @@unique([userId, snippetId]) so we don't need to dedupe further.
    group.userIds.add(a.userId);
    group.answers.push({ id: a.id, userId: a.userId, chosenOption: a.chosenOption });
  }
  return Array.from(grouped.values());
}

/**
 * Filter groups that have reached the consensus threshold.
 */
export function eligibleGroups(groups: ConsensusGroup[]): ConsensusGroup[] {
  return groups.filter((g) => g.userIds.size >= CONSENSUS_THRESHOLD_USERS);
}

export type ConsensusSummary = {
  /** distinct spotters needed to reach consensus */
  threshold: number;
  /** distinct spotters who have called this clip so far */
  spotters: number;
  /** the option the most spotters agree on, or null if no answers yet */
  leader: { option: string; users: number } | null;
  /** has the leading option reached the threshold of distinct spotters? */
  reached: boolean;
};

/**
 * Live consensus state for ONE snippet, for the reveal UI ("the community is
 * converging on Y, N of M spotters"). Pure. `stats` is the per-option answer
 * histogram, sorted densest-first.
 */
export function consensusSummary(
  stats: Array<{ option: string; count: number }>,
  totalSpotters: number,
  threshold: number = CONSENSUS_THRESHOLD_USERS,
): ConsensusSummary {
  const top = stats[0];
  const leader = top ? { option: top.option, users: top.count } : null;
  return {
    threshold,
    spotters: totalSpotters,
    leader,
    reached: !!leader && leader.users >= threshold,
  };
}

/** Parsed SpeciesProbability.speciesJson entry. */
type ProbEntry = { scientificName: string; count: number; probability: number };

/**
 * Run the rescore against the DB. Idempotent: re-running with no new matchers
 * is a no-op (already-credited answers are skipped).
 */
export async function rescoreConsensus(
  prisma: PrismaClient,
): Promise<ConsensusRescoreResult> {
  // The crowd is the authority: pull EVERY answer (no staffAnswer filter). At
  // project scale (tens of thousands of rows) this is cheap; if it balloons we
  // add a "needs rescore" watermark and process incrementally.
  const rawAnswers = await prisma.answer.findMany({
    select: { id: true, userId: true, snippetId: true, chosenOption: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Per-snippet: stable arrival order across ALL options + per-name groups.
  type Raw = (typeof rawAnswers)[number];
  const bySnippet = new Map<string, Raw[]>();
  for (const a of rawAnswers) {
    const list = bySnippet.get(a.snippetId);
    if (list) list.push(a);
    else bySnippet.set(a.snippetId, [a]);
  }

  // arrivalIndexById: 0-based position of each answer among its snippet's answers,
  // ordered by (createdAt, id) so ties are deterministic across runs.
  const arrivalIndexById = new Map<string, number>();
  // reachedLeaderBySnippet: snippetId -> winning normalised key (only when reached).
  const reachedLeaderBySnippet = new Map<string, string>();
  // winningAnswersBySnippet: snippetId -> the winning camp's answer rows.
  const winningAnswersBySnippet = new Map<string, ConsensusGroup>();

  let groupsInspected = 0;
  for (const [snippetId, answers] of bySnippet) {
    const ordered = [...answers].sort((a, b) => {
      const t = a.createdAt.getTime() - b.createdAt.getTime();
      return t !== 0 ? t : a.id.localeCompare(b.id);
    });
    ordered.forEach((a, i) => arrivalIndexById.set(a.id, i));

    const groups = groupPendingAnswers(answers.map((a) => ({ ...a })));
    groupsInspected += groups.length;
    // Leader = most distinct spotters; deterministic tiebreak by name key.
    const leader = groups
      .slice()
      .sort((a, b) =>
        b.userIds.size - a.userIds.size ||
        a.normalisedName.localeCompare(b.normalisedName),
      )[0];
    if (leader && leader.userIds.size >= CONSENSUS_THRESHOLD_USERS) {
      reachedLeaderBySnippet.set(snippetId, leader.normalisedName);
      winningAnswersBySnippet.set(snippetId, leader);
    }
  }

  const result: ConsensusRescoreResult = {
    groupsInspected,
    newEvents: 0,
    updatedEvents: 0,
    answersCredited: 0,
    pebblesAwarded: 0,
    speciesUnlocked: 0,
  };

  if (reachedLeaderBySnippet.size === 0) return result;

  // Each user's answers newest-first (for the Current reliability streak).
  const userAnswersNewestFirst = new Map<
    string,
    Array<{ snippetId: string; matchKey: string }>
  >();
  for (const a of rawAnswers) {
    const list = userAnswersNewestFirst.get(a.userId) ?? [];
    list.push({ snippetId: a.snippetId, matchKey: normalizeForMatch(a.chosenOption) });
    userAnswersNewestFirst.set(a.userId, list);
  }
  // rawAnswers is ascending; reverse each to newest-first.
  for (const list of userAnswersNewestFirst.values()) list.reverse();

  // Snippet metadata (for the rarity bucket) for the reached snippets only.
  const reachedIds = Array.from(reachedLeaderBySnippet.keys());
  const snippets = await prisma.snippet.findMany({
    where: { id: { in: reachedIds } },
    select: { id: true, lat: true, lon: true, depthM: true, recordingDatetime: true },
  });
  const snippetById = new Map(snippets.map((s) => [s.id, s]));

  const aliases = [...CATALOGUE_ALIASES, ...(await loadAliases())];

  for (const [snippetId, group] of winningAnswersBySnippet) {
    // --- Rarity for this clip's winning species (looked up once) -------------
    const repOption = group.answers[0]?.chosenOption ?? "";
    const sci = scientificFromLocalName(repOption, aliases);
    let rarityMult = 1;
    const snip = snippetById.get(snippetId);
    if (sci && snip) {
      const bucket = bucketFor(snip);
      if (bucket) {
        const row = await prisma.speciesProbability.findUnique({
          where: {
            latBucket_lonBucket_depthBucket_month: {
              latBucket: bucket.latBucket,
              lonBucket: bucket.lonBucket,
              depthBucket: bucket.depthBucket,
              month: bucket.month,
            },
          },
          select: { status: true, totalRecords: true, speciesJson: true },
        });
        const bucketHasData = !!row && row.status === "OK" && row.totalRecords > 0;
        let probability: number | null = null;
        if (bucketHasData && row) {
          try {
            const entries = JSON.parse(row.speciesJson) as ProbEntry[];
            const match = entries.find((e) => e.scientificName === sci);
            probability = match ? match.probability : null;
          } catch {
            probability = null;
          }
        }
        rarityMult = rarityForProbability(probability, bucketHasData).multiplier;
      }
    }

    // --- Who still needs crediting -----------------------------------------
    const existing = await prisma.consensusEvent.findUnique({
      where: {
        snippetId_normalisedName: {
          snippetId,
          normalisedName: group.normalisedName,
        },
      },
      select: { id: true, creditedAnswerIds: true },
    });
    const alreadyCredited = new Set(existing?.creditedAnswerIds ?? []);
    const winningIds = group.answers.map((a) => a.id);
    const toCredit = group.answers.filter((a) => !alreadyCredited.has(a.id));

    // isCorrect bookkeeping runs every tick (idempotent), even with no new
    // matchers, so a newly-formed miss/win is reflected on the leaderboard.
    const isCorrectOps = [
      prisma.answer.updateMany({
        where: { id: { in: winningIds } },
        data: { isCorrect: true },
      }),
      prisma.answer.updateMany({
        where: { snippetId, id: { notIn: winningIds } },
        data: { isCorrect: false },
      }),
    ];

    if (toCredit.length === 0 && existing) {
      await prisma.$transaction(isCorrectOps);
      continue;
    }

    // Per-answer payout: tier (arrival order) × rarity × the spotter's Current.
    const credits = toCredit.map((a) => {
      const arrival = arrivalIndexById.get(a.id) ?? 0;
      const tier = consensusTier(arrival);
      const streak = reliabilityStreak(
        userAnswersNewestFirst.get(a.userId) ?? [],
        reachedLeaderBySnippet,
      );
      const amount = consensusPayout(tier, rarityMult, currentMultiplier(streak));
      return { id: a.id, amount };
    });

    await prisma.$transaction([
      ...isCorrectOps,
      ...credits.map((c) =>
        prisma.answer.update({
          where: { id: c.id },
          data: { points: { increment: c.amount } },
        }),
      ),
      existing
        ? prisma.consensusEvent.update({
            where: { id: existing.id },
            data: { creditedAnswerIds: [...alreadyCredited, ...toCredit.map((a) => a.id)] },
          })
        : prisma.consensusEvent.create({
            data: {
              snippetId,
              normalisedName: group.normalisedName,
              creditedAnswerIds: toCredit.map((a) => a.id),
            },
          }),
    ]);

    if (existing) result.updatedEvents++;
    else result.newEvents++;
    result.answersCredited += credits.length;
    result.pebblesAwarded += credits.reduce((s, c) => s + c.amount, 0);

    // Retro-unlock the pokedex for the winning camp when the consensus resolves
    // to a catalogue species. Coarse consensuses ("Fish") resolve to null and
    // unlock nothing, by design.
    if (sci && CATALOGUE[sci]) {
      const { count } = await prisma.unlockedSpecies.createMany({
        data: group.answers.map((a) => ({ userId: a.userId, scientificName: sci })),
        skipDuplicates: true,
      });
      result.speciesUnlocked += count;
    }
  }

  return result;
}
