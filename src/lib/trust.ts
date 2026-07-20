/**
 * Trust — the seeded, crowd-internal reputation layer (Pebbles anti-gaming
 * Plan 1 Phase 1, docs/pebbles-anti-gaming-and-prizes-plan.md).
 *
 * The Pebbles economy's "truth" is an unweighted crowd-of-3
 * (CONSENSUS_THRESHOLD_USERS): a ring of 3+ colluding accounts can
 * self-consensus on a rare species and farm the rarity multiplier. The fix
 * must not reintroduce expert per-clip labelling — that is the exact ongoing
 * cost the crowd model exists to avoid. Instead: a handful of manually-vetted,
 * known-real accounts (User.isTrustSeed) anchor a trust graph, and trust
 * propagates outward through co-occurrence in WINNING consensus camps (i.e.
 * people who were both right, together, about the same clip). An isolated
 * ring that only ever agrees with itself has zero graph path to any seed and
 * mathematically earns zero trust (see propagateTrust's docstring for the
 * proof).
 *
 * This module is a pure leaf (algorithm functions take plain data, no
 * Prisma) plus one DB-touching orchestrator, recomputeTrustScores, mirroring
 * the pebbles.ts (pure) / consensus.ts's rescoreConsensus (DB orchestrator)
 * split. Called daily from the consensus-rescore cron, AFTER rescoreConsensus
 * so every reached camp already has a fresh ConsensusEvent row to read a
 * decay timestamp from.
 *
 * Trust is hidden — never shown to spotters, never removes Pebbles or status.
 * It only ever gates prize eligibility (isPrizeEligible), a strictly upside
 * gate.
 *
 * Forward note for Phase 2 (not built here): rescoreConsensus will need to
 * consume a per-user trust weight to trust-weight the actual payout. Since
 * this module imports FROM consensus.ts, Phase 2 should pass trust weights
 * into rescoreConsensus as a plain argument from the cron route rather than
 * having consensus.ts import this module — that direction would cycle.
 */

import type { PrismaClient } from "@prisma/client";
import { groupPendingAnswers, pickLeaderGroup } from "./consensus";

const MS_PER_DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Winning camps — who was right, together, on each snippet
// ---------------------------------------------------------------------------

export type WinningCamp = {
  snippetId: string;
  normalisedName: string;
  userIds: string[];
};

type AnswerLike = { id: string; userId: string; snippetId: string; chosenOption: string };

/**
 * Derive each snippet's winning consensus camp from raw answers, using the
 * exact same leader-selection rule rescoreConsensus uses for Pebble payouts
 * (pickLeaderGroup) so the trust graph and the payout logic can never
 * disagree about who won a given clip. Pure.
 */
export function deriveWinningCamps(answers: readonly AnswerLike[]): WinningCamp[] {
  const bySnippet = new Map<string, AnswerLike[]>();
  for (const a of answers) {
    const list = bySnippet.get(a.snippetId);
    if (list) list.push(a);
    else bySnippet.set(a.snippetId, [a]);
  }

  const camps: WinningCamp[] = [];
  for (const [snippetId, snippetAnswers] of bySnippet) {
    const groups = groupPendingAnswers(snippetAnswers);
    const leader = pickLeaderGroup(groups);
    if (leader) {
      camps.push({
        snippetId,
        normalisedName: leader.normalisedName,
        userIds: Array.from(leader.userIds),
      });
    }
  }
  return camps;
}

/** Stable string key for a (snippetId, normalisedName) camp, e.g. for looking up its ConsensusEvent. */
export function campKey(snippetId: string, normalisedName: string): string {
  return `${snippetId}__${normalisedName}`;
}

// ---------------------------------------------------------------------------
// Co-occurrence graph — who has been right, together, and how recently
// ---------------------------------------------------------------------------

/** Days for a camp's contribution to the trust graph to decay to half strength. */
export const TRUST_HALF_LIFE_DAYS = 90;

export type CoOccurrenceGraph = ReadonlyMap<string, ReadonlyMap<string, number>>;

/**
 * Build a symmetric, time-decayed co-occurrence graph: every pair of distinct
 * users who shared a winning camp gets an edge weighted by
 * 0.5 ** (ageDays / halfLifeDays) (true half-life decay — NOT
 * exp(-age/half), which is e-folding decay and reaches 0.5 at ~0.69x the
 * configured period, not at the period itself). Multiple shared camps
 * between the same pair sum. Only users who actually appear in at least one
 * camp get an entry, which is what lets propagateTrust divide by out-weight
 * safely (no dense product, no 0/0 for users who never won a camp). Pure.
 */
export function buildCoOccurrenceGraph(
  camps: readonly WinningCamp[],
  campTimestamp: (camp: WinningCamp) => Date,
  now: Date,
  halfLifeDays: number = TRUST_HALF_LIFE_DAYS,
): Map<string, Map<string, number>> {
  const graph = new Map<string, Map<string, number>>();
  const addEdge = (a: string, b: string, w: number) => {
    let row = graph.get(a);
    if (!row) {
      row = new Map<string, number>();
      graph.set(a, row);
    }
    row.set(b, (row.get(b) ?? 0) + w);
  };

  for (const camp of camps) {
    const ageDays = Math.max(0, (now.getTime() - campTimestamp(camp).getTime()) / MS_PER_DAY);
    const w = Math.pow(0.5, ageDays / halfLifeDays);
    const ids = camp.userIds;
    for (let a = 0; a < ids.length; a++) {
      for (let b = a + 1; b < ids.length; b++) {
        if (ids[a] === ids[b]) continue;
        addEdge(ids[a], ids[b], w);
        addEdge(ids[b], ids[a], w);
      }
    }
  }
  return graph;
}

// ---------------------------------------------------------------------------
// Propagation — personalized PageRank with seed-only teleport
// ---------------------------------------------------------------------------

export const TRUST_DAMPING = 0.85;
export const TRUST_ITERATIONS = 30;

export interface PropagateOptions {
  damping?: number;
  iterations?: number;
}

/**
 * Personalized PageRank / EigenTrust-lite trust propagation. Teleport is
 * SEED-ONLY (p_i = 1/|seeds| for seeds, 0 otherwise) — deliberately not
 * classic PageRank's uniform-everyone teleport, which would hand every
 * account (including a Sybil ring) a nonzero trust floor just for existing.
 *
 * Proof an isolated ring earns exactly zero: let R be any set of users with
 * zero graph edges to anyone outside R (i.e. R never shared a winning camp
 * with anyone reachable from a seed — not merely "never talks to a seed
 * directly"; one shared camp with a single seed-connected outsider breaks
 * the isolation and correctly earns nonzero trust). By induction on the
 * iteration: t^(0)_i = 0 for every non-seed, including every i in R (base
 * case, since teleport is 0 for non-seeds). If t^(k)_j = 0 for all j in R,
 * then t^(k+1)_i = damping * sum_j M_ij * t^(k)_j + (1-damping)*0 for i in R
 * — every nonzero term in that sum requires j in R (R is disconnected from
 * outside), and every such term is exactly 0 by the inductive hypothesis. So
 * t^(k+1)_i = 0. This is an EXACT fixed point (IEEE754 0.0, not an
 * approximation), regardless of how densely R agrees with itself.
 *
 * Total propagated mass conserves to ~1 only when every node has at least
 * one graph edge; isolated nodes (very plausible at small scale — a seed who
 * hasn't yet landed in a winning camp, a never-active account) hold mass
 * that isn't redistributed (no "dangling node" fix is implemented). This is
 * deliberate: the caller only ever consumes trust as a RATIO relative to the
 * seed baseline (see computeFinalTrustScores), so absolute scale never
 * matters and the added complexity of dangling-mass redistribution buys
 * nothing here.
 *
 * Fixed iteration count (not a convergence-tolerance loop) — deterministic
 * and bounded. Pure.
 */
export function propagateTrust(
  graph: CoOccurrenceGraph,
  allUserIds: readonly string[],
  seedUserIds: readonly string[],
  options: PropagateOptions = {},
): Map<string, number> {
  const damping = options.damping ?? TRUST_DAMPING;
  const iterations = options.iterations ?? TRUST_ITERATIONS;

  const teleport = new Map<string, number>();
  if (seedUserIds.length > 0) {
    const share = 1 / seedUserIds.length;
    for (const id of seedUserIds) teleport.set(id, share);
  }

  // Out-weight per source node, computed once from the sparse graph so a
  // node with no edges is simply absent here (never a 0-weight divisor).
  const outWeight = new Map<string, number>();
  for (const [j, edges] of graph) {
    let sum = 0;
    for (const w of edges.values()) sum += w;
    outWeight.set(j, sum);
  }

  let t = new Map<string, number>();
  for (const id of allUserIds) t.set(id, teleport.get(id) ?? 0);

  for (let step = 0; step < iterations; step++) {
    const next = new Map<string, number>();
    for (const id of allUserIds) next.set(id, (1 - damping) * (teleport.get(id) ?? 0));

    for (const [j, edges] of graph) {
      const tj = t.get(j) ?? 0;
      if (tj === 0) continue;
      const wj = outWeight.get(j) ?? 0;
      if (wj === 0) continue;
      for (const [i, w] of edges) {
        next.set(i, (next.get(i) ?? 0) + damping * (w / wj) * tj);
      }
    }
    t = next;
  }

  return t;
}

// ---------------------------------------------------------------------------
// Normalization + smoothing — raw propagated mass -> a stable, storable score
// ---------------------------------------------------------------------------

/** Stored trust score seeds are pinned to, and the anchor non-seed scores are scaled against. */
const NORMALIZED_SEED_TARGET = 100;
/** Display/storage bound so a cold-start numerical wobble can't produce an absurd stored value. */
const TRUST_SCORE_MAX = 200;
/** Weight given to this run's freshly-computed value in the cross-run EMA blend. */
const TRUST_SMOOTHING = 0.3;

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export interface TrustUser {
  userId: string;
  isTrustSeed: boolean;
  /** Previously stored trustScore. */
  trustScore: number;
  trustUpdatedAt: Date | null;
}

export type ComputeFinalTrustScoresResult = Map<string, number> | { skipped: "no-seeds" };

/**
 * Turn raw propagated mass into the score actually stored on User.trustScore:
 * normalize non-seeds relative to the MEDIAN raw score among seeds (median,
 * not mean, so one weakly-connected seed among only a few can't drag the
 * whole scale), clamp to [0, TRUST_SCORE_MAX], then EMA-blend with the
 * previously stored value UNLESS this is the user's first-ever computation
 * (trustUpdatedAt === null — blending against a meaningless previous-of-zero
 * would wrongly suppress everyone's first honest score).
 *
 * Every seed is PINNED to exactly NORMALIZED_SEED_TARGET as the last,
 * unconditional step — never fed through the blend. This matters concretely:
 * flagging an already-active user as a seed later must not produce a
 * blended ~40 from their pre-seed history, it must read 100 immediately.
 *
 * Zero seeds short-circuits to { skipped: "no-seeds" } rather than dividing
 * by a zero median (which would write NaN into every user's trustScore) —
 * a real deploy-ordering risk since seeding accounts and shipping this code
 * are two independent manual steps.
 */
export function computeFinalTrustScores(
  rawScores: ReadonlyMap<string, number>,
  users: readonly TrustUser[],
): ComputeFinalTrustScoresResult {
  const seeds = users.filter((u) => u.isTrustSeed);
  if (seeds.length === 0) return { skipped: "no-seeds" };

  const seedMedianRaw = median(seeds.map((s) => rawScores.get(s.userId) ?? 0));

  const result = new Map<string, number>();
  for (const u of users) {
    if (u.isTrustSeed) {
      result.set(u.userId, NORMALIZED_SEED_TARGET);
      continue;
    }
    const raw = rawScores.get(u.userId) ?? 0;
    const scaled = seedMedianRaw > 0 ? (NORMALIZED_SEED_TARGET * raw) / seedMedianRaw : 0;
    const clamped = Math.min(TRUST_SCORE_MAX, Math.max(0, scaled));
    const finalScore =
      u.trustUpdatedAt === null
        ? clamped
        : TRUST_SMOOTHING * clamped + (1 - TRUST_SMOOTHING) * u.trustScore;
    result.set(u.userId, finalScore);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Prize eligibility gate — strictly upside, never removes Pebbles or status
// ---------------------------------------------------------------------------

/**
 * Seeds sit at 100, so this reads as "at least 40% as vouched-for as a trust
 * anchor." Not yet calibrated against real data — check /admin/trust after
 * the first real cron run.
 */
export const PRIZE_TRUST_BAR = 40;
export const PRIZE_MIN_ACCOUNT_AGE_DAYS = 14;
export const PRIZE_MIN_ACTIVE_DAYS = 5;
export const PRIZE_MIN_ACTIVITY_SPAN_DAYS = 14;

export interface PrizeEligibilityInput {
  emailVerified: Date | null;
  createdAt: Date;
  trustScore: number;
  /** This user's Answer.createdAt timestamps, any order. */
  answerDates: readonly Date[];
}

export interface PrizeEligibilityResult {
  eligible: boolean;
  /** Human-readable names of every unmet gate; empty when eligible. */
  reasons: string[];
}

/**
 * A user is prize-eligible only with: verified email + trust above the bar +
 * account age + activity SPREAD over a time window (not a burst). Gates only
 * ever withhold upside — this never removes Pebbles or status, and it is not
 * persisted anywhere (nothing consumes it yet; Plan 1 Phase 1 ships the
 * predicate, not a redemption flow).
 *
 * `now` is an explicit, required parameter (not read internally) so this
 * stays genuinely pure and every boundary case is deterministically testable.
 *
 * Known, deliberately-accepted gap: 4 distinct days clustered in a burst plus
 * one token answer PRIZE_MIN_ACTIVITY_SPAN_DAYS later clears both activity
 * gates (5 distinct days, >=14 day span) while being 80% burst. Not worth
 * closing in Phase 1 — trust-graph connectivity (the real bottleneck for an
 * attacker) isn't affected by day-spacing games.
 */
export function isPrizeEligible(input: PrizeEligibilityInput, now: Date): PrizeEligibilityResult {
  const reasons: string[] = [];

  if (!input.emailVerified) reasons.push("email not verified");

  const accountAgeDays = (now.getTime() - input.createdAt.getTime()) / MS_PER_DAY;
  if (accountAgeDays < PRIZE_MIN_ACCOUNT_AGE_DAYS) reasons.push("account too new");

  if (input.trustScore < PRIZE_TRUST_BAR) reasons.push("trust score below bar");

  if (input.answerDates.length === 0) {
    reasons.push("no activity yet");
  } else {
    const distinctDays = new Set(input.answerDates.map((d) => d.toISOString().slice(0, 10))).size;
    if (distinctDays < PRIZE_MIN_ACTIVE_DAYS) {
      reasons.push("activity too bursty (too few distinct days)");
    }

    const times = input.answerDates.map((d) => d.getTime());
    const spanDays = (Math.max(...times) - Math.min(...times)) / MS_PER_DAY;
    if (spanDays < PRIZE_MIN_ACTIVITY_SPAN_DAYS) {
      reasons.push("activity too bursty (too short a span)");
    }
  }

  return { eligible: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// DB orchestrator — called daily from the consensus-rescore cron
// ---------------------------------------------------------------------------

export type RecomputeTrustScoresResult =
  | { skipped: "no-seeds"; usersUpdated: 0 }
  | { skipped: null; usersUpdated: number };

/**
 * Recompute every user's trustScore from scratch (cheap to re-pull
 * everything at this project's scale, matching rescoreConsensus's existing
 * philosophy). Must run AFTER rescoreConsensus in the same cron invocation:
 * every camp deriveWinningCamps would identify as a leader is guaranteed to
 * already have a ConsensusEvent row by then (rescoreConsensus always creates
 * one on first reaching threshold), which is what this reads achievedAt from
 * for decay weighting.
 */
export async function recomputeTrustScores(
  prisma: PrismaClient,
): Promise<RecomputeTrustScoresResult> {
  const users = await prisma.user.findMany({
    select: { id: true, isTrustSeed: true, trustScore: true, trustUpdatedAt: true },
  });
  const seedUserIds = users.filter((u) => u.isTrustSeed).map((u) => u.id);
  if (seedUserIds.length === 0) {
    return { skipped: "no-seeds", usersUpdated: 0 };
  }

  const rawAnswers = await prisma.answer.findMany({
    select: { id: true, userId: true, snippetId: true, chosenOption: true },
  });
  const camps = deriveWinningCamps(rawAnswers);

  const events = await prisma.consensusEvent.findMany({
    select: { snippetId: true, normalisedName: true, achievedAt: true },
  });
  const achievedAtByCamp = new Map<string, Date>();
  for (const e of events) {
    achievedAtByCamp.set(campKey(e.snippetId, e.normalisedName), e.achievedAt);
  }

  const now = new Date();
  const graph = buildCoOccurrenceGraph(
    camps,
    (camp) => achievedAtByCamp.get(campKey(camp.snippetId, camp.normalisedName)) ?? now,
    now,
  );

  const allUserIds = users.map((u) => u.id);
  const raw = propagateTrust(graph, allUserIds, seedUserIds);
  const final = computeFinalTrustScores(
    raw,
    users.map((u) => ({
      userId: u.id,
      isTrustSeed: u.isTrustSeed,
      trustScore: u.trustScore,
      trustUpdatedAt: u.trustUpdatedAt,
    })),
  );
  if ("skipped" in final) {
    return { skipped: final.skipped, usersUpdated: 0 };
  }

  await prisma.$transaction(
    users.map((u) =>
      prisma.user.update({
        where: { id: u.id },
        data: { trustScore: final.get(u.id) ?? 0, trustUpdatedAt: now },
      }),
    ),
  );

  return { skipped: null, usersUpdated: users.length };
}
