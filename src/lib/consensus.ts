/**
 * Q3A-T8 (S7-T1 phase 2): consensus retro-bonus.
 *
 * When CONSENSUS_THRESHOLD_USERS or more distinct users converge on the
 * same normalised name for a no-reference snippet, each matcher's
 * Answer.points is retro-credited with POINTS_CONSENSUS_BONUS. Runs as
 * a daily cron at /api/cron/consensus-rescore; safe to invoke
 * idempotently (already-credited Answer rows are tracked on the
 * ConsensusEvent row and skipped on subsequent runs).
 *
 * The grouping key is `normalizeForMatch(chosenOption)` (the same helper
 * as `matchAnswer()` uses), so "Pollack", "pollack ", and "POLLACK" all
 * collapse to one consensus group. Spelling variants like "Pollack" vs
 * "Pollock" do NOT collapse (different match keys). Alias-aware
 * grouping is a future enhancement; for v1 strict normalised-equal is
 * sufficient.
 */

import type { PrismaClient } from "@prisma/client";
import {
  CONSENSUS_THRESHOLD_USERS,
  POINTS_CONSENSUS_BONUS,
} from "@/lib/answer-matching";
import { normalizeForMatch } from "@/lib/normalize-answer";

export type ConsensusRescoreResult = {
  /** Number of (snippet, name) consensus groups inspected. */
  groupsInspected: number;
  /** New consensus events created (previously below threshold). */
  newEvents: number;
  /** Existing events touched because new matchers joined. */
  updatedEvents: number;
  /** Total Answer rows credited the +2 bonus in this run. */
  answersCredited: number;
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
 * Build the consensus groups from raw pending answers. Pure function so
 * the cron tests don't need a DB.
 *
 * "Pending" = Snippet.staffAnswer IS NULL AND Answer.isCorrect IS NULL.
 * The caller passes these in pre-filtered.
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
 * Live consensus state for ONE no-reference snippet, for the reveal UI
 * ("the community is converging on Y, N of M spotters"). Pure.
 *
 * `stats` is the per-option answer histogram for the snippet, sorted
 * densest-first. Answer carries `@@unique([userId, snippetId])`, so one row per
 * user per snippet means each option's answer count IS its distinct-spotter
 * count, and `total` answers == distinct spotters on the clip.
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

/**
 * Run the rescore against the DB. Idempotent: re-running with no new
 * matchers is a no-op.
 */
export async function rescoreConsensus(
  prisma: PrismaClient,
): Promise<ConsensusRescoreResult> {
  // Pull every pending answer on a no-reference snippet. At project scale
  // (tens of thousands of answers max) this is cheap; if it ever balloons
  // we add a snippet-side index on staffAnswer + a JOIN-on-isNull query.
  const rawAnswers = await prisma.answer.findMany({
    where: {
      isCorrect: null,
      snippet: { staffAnswer: null },
    },
    select: { id: true, userId: true, snippetId: true, chosenOption: true },
  });

  const groups = groupPendingAnswers(rawAnswers);
  const eligible = eligibleGroups(groups);

  const result: ConsensusRescoreResult = {
    groupsInspected: groups.length,
    newEvents: 0,
    updatedEvents: 0,
    answersCredited: 0,
  };

  for (const group of eligible) {
    const existing = await prisma.consensusEvent.findUnique({
      where: {
        snippetId_normalisedName: {
          snippetId: group.snippetId,
          normalisedName: group.normalisedName,
        },
      },
      select: { id: true, creditedAnswerIds: true },
    });

    const allAnswerIds = group.answers.map((a) => a.id);
    const alreadyCredited = new Set(existing?.creditedAnswerIds ?? []);
    const toCredit = allAnswerIds.filter((id) => !alreadyCredited.has(id));

    if (toCredit.length === 0 && existing) {
      // Re-run with no new matchers. Skip.
      continue;
    }

    // Transaction: credit the answers AND update the event row atomically
    // so a partial failure can't leave creditedAnswerIds out of sync with
    // the actual points distributed.
    await prisma.$transaction([
      prisma.answer.updateMany({
        where: { id: { in: toCredit } },
        data: { points: { increment: POINTS_CONSENSUS_BONUS } },
      }),
      existing
        ? prisma.consensusEvent.update({
            where: { id: existing.id },
            data: { creditedAnswerIds: [...alreadyCredited, ...toCredit] },
          })
        : prisma.consensusEvent.create({
            data: {
              snippetId: group.snippetId,
              normalisedName: group.normalisedName,
              creditedAnswerIds: toCredit,
            },
          }),
    ]);

    if (existing) result.updatedEvents++;
    else result.newEvents++;
    result.answersCredited += toCredit.length;
  }

  return result;
}
