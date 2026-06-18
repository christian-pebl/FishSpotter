/**
 * Pebbles — the FishSpotter community-science economy (sea-currency redesign).
 *
 * The old model scored each guess against a PEBL "reference" (Snippet.staffAnswer):
 * correct=2 / pending=1 / wrong=0. That model is retired. PEBL no longer hands
 * down an official correct answer — **the crowd is the authority**. Every ID is a
 * community hypothesis, and a spotter earns Pebbles (🪨) on two pillars only:
 *
 *   1. DISCOVERY — being first to ever watch + ID a clip (First Sighting), paid
 *      immediately at submit time because it is knowable the moment you submit.
 *   2. CONSENSUS — your call matching what the community independently converges
 *      on, paid as a retro-credit by the consensus cron once a clip's spotters
 *      agree. Foresight is rewarded: calling it early (pioneer) out-pays joining
 *      a forming consensus, which out-pays confirming a settled one.
 *
 * Two multipliers shape the consensus payout:
 *   - RARITY (OBIS SpeciesProbability at the clip's site/month/depth bucket): a
 *     rare species the crowd agrees on is worth more.
 *   - CURRENT (a reliability streak): consecutive *vindicated* calls — IDs that
 *     matched the eventual community consensus — build a momentum multiplier.
 *
 * Anti-herding note: the histogram of community answers is gated server-side
 * until a spotter has committed their own ID (blind submission), so the consensus
 * reward measures *independent* agreement, not bandwagoning. See
 * src/app/api/snippets/[id]/stats and the route's blind-submission comment.
 *
 * This module is a pure leaf (no Prisma, no React) so the whole economy is unit
 * tested in pebbles.test.ts and reused by both the answers route (immediate) and
 * the consensus cron (retro).
 */

// ---------------------------------------------------------------------------
// Pillar 1 — Discovery (immediate, paid at submit)
// ---------------------------------------------------------------------------

/** Flat Pebbles every submission earns — you logged an observation. Never zero. */
export const PEBBLE_BASE_SIGHTING = 5;

/**
 * Bonus for being early to a clip, indexed by the spotter's 0-based arrival
 * order on that snippet. Index 0 = the **First Sighting** (first person ever to
 * ID the clip); 1 and 2 are the "early spotter" taper. This pays people to clear
 * the backlog of un-watched clips — exactly what a monitoring app wants.
 */
export const PEBBLE_EARLY_SPOTTER = [25, 12, 6] as const;

// ---------------------------------------------------------------------------
// Pillar 2 — Consensus (retro, paid by the consensus cron)
// ---------------------------------------------------------------------------

/** Distinct spotters who must converge on one normalised name to "reach" consensus. */
export const CONSENSUS_THRESHOLD_USERS = 3;

export type ConsensusTier = "pioneer" | "joiner" | "confirmer";

/**
 * Base Pebbles for matching the community consensus, by how early you called it.
 * The tier is decided by your arrival order on the clip (see consensusTier).
 */
export const PEBBLE_CONSENSUS: Record<ConsensusTier, number> = {
  pioneer: 30, // among the first spotters on the clip, and right
  joiner: 15, // matched while the consensus was still forming
  confirmer: 8, // agreed after it was already the clear leader
};

/**
 * Classify a winning-group answer into a payout tier by its arrival order on the
 * clip — `arrivalIndex` is how many answers (across ALL options) predate it,
 * 0-based and ordered by createdAt. The first `threshold` spotters to call
 * anything are pioneers; the next `threshold` are joiners; the rest confirm.
 */
export function consensusTier(
  arrivalIndex: number,
  threshold: number = CONSENSUS_THRESHOLD_USERS,
): ConsensusTier {
  if (arrivalIndex < threshold) return "pioneer";
  if (arrivalIndex < threshold * 2) return "joiner";
  return "confirmer";
}

// ---------------------------------------------------------------------------
// Rarity multiplier — from the OBIS SpeciesProbability bucket
// ---------------------------------------------------------------------------

export type RarityTier =
  | "common"
  | "frequent"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

export interface RarityResult {
  tier: RarityTier;
  multiplier: number;
}

/**
 * Map a species' local occurrence probability (its share of OBIS occurrences in
 * the clip's lat/lon/depth/month bucket) to a rarity tier + multiplier.
 *
 * `bucketHasData` distinguishes "we have OBIS data for this place and the species
 * is absent from it" (a genuine off-the-charts sighting → legendary) from "we
 * have no data for this place at all" (unknown → neutral ×1, we do NOT inflate on
 * missing data). The iNaturalist global-rarity fallback for the no-data case is a
 * Phase-2 follow-up; until then no-data resolves to common.
 */
export function rarityForProbability(
  probability: number | null,
  bucketHasData: boolean,
): RarityResult {
  if (!bucketHasData) return { tier: "common", multiplier: 1 };
  if (probability == null || probability <= 0) {
    return { tier: "legendary", multiplier: 5 };
  }
  if (probability >= 0.2) return { tier: "common", multiplier: 1 };
  if (probability >= 0.08) return { tier: "frequent", multiplier: 1.3 };
  if (probability >= 0.03) return { tier: "uncommon", multiplier: 1.7 };
  if (probability >= 0.01) return { tier: "rare", multiplier: 2.5 };
  return { tier: "epic", multiplier: 3.5 };
}

// ---------------------------------------------------------------------------
// Current — the reliability streak multiplier
// ---------------------------------------------------------------------------

/** Cap so a hot streak can't run away on the leaderboard. */
export const CURRENT_MAX_MULTIPLIER = 2.5;

/**
 * Multiplier for a Current (reliability) streak of length `streak` — the number
 * of consecutive vindicated calls. A streak of 0 or 1 is neutral (×1); each
 * further vindicated call adds +0.2, capped at ×2.5 (reached at a streak of 8).
 */
export function currentMultiplier(streak: number): number {
  if (streak <= 1) return 1;
  return Math.min(1 + 0.2 * (streak - 1), CURRENT_MAX_MULTIPLIER);
}

/**
 * Compute a spotter's Current streak from their answers (newest first) and the
 * map of each snippet's *reached* consensus leader (snippetId → winning match
 * key). Walking from the most recent call:
 *   - a snippet with no reached consensus yet is PENDING → skipped (neither
 *     breaks nor extends the streak), so an unresolved recent guess doesn't
 *     zero out a proven track record;
 *   - a call matching its snippet's reached leader is VINDICATED → +1;
 *   - a call on a snippet whose consensus landed on a *different* name is a
 *     MISS → the streak ends there.
 */
export function reliabilityStreak(
  answersNewestFirst: ReadonlyArray<{ snippetId: string; matchKey: string }>,
  reachedLeaderBySnippet: ReadonlyMap<string, string>,
): number {
  let streak = 0;
  for (const a of answersNewestFirst) {
    const leader = reachedLeaderBySnippet.get(a.snippetId);
    if (leader === undefined) continue; // pending — skip
    if (leader === a.matchKey) streak++;
    else break; // a vindicated streak is broken by a confirmed miss
  }
  return streak;
}

// ---------------------------------------------------------------------------
// Payout assembly
// ---------------------------------------------------------------------------

export interface ImmediateAward {
  pebbles: number;
  firstSighting: boolean;
  /** 0-based arrival order on the clip (0 = first ever). */
  ordinal: number;
}

/**
 * Immediate (submit-time) award: base sighting + the early-spotter/First-Sighting
 * bonus for this spotter's arrival order on the clip. `spotterOrdinal` is how
 * many distinct spotters had already called the clip before this one (0 = first).
 */
export function immediateAward(spotterOrdinal: number): ImmediateAward {
  const early = PEBBLE_EARLY_SPOTTER[spotterOrdinal] ?? 0;
  return {
    pebbles: PEBBLE_BASE_SIGHTING + early,
    firstSighting: spotterOrdinal === 0,
    ordinal: spotterOrdinal,
  };
}

/** Full consensus (retro) payout for one vindicated answer. */
export function consensusPayout(
  tier: ConsensusTier,
  rarityMultiplier: number,
  currentMult: number,
): number {
  return Math.round(PEBBLE_CONSENSUS[tier] * rarityMultiplier * currentMult);
}

// ---------------------------------------------------------------------------
// Diversity — contested-clip detection (UI signal, no extra payout in Phase 1)
// ---------------------------------------------------------------------------

/**
 * A clip is "contested" when the community genuinely splits — the runner-up is
 * within one spotter of the leader, or holds at least 35% of the calls — given
 * enough spotters to be meaningful. Contested clips are the scientifically
 * interesting ones (and the candidates for expert footage review); the reveal
 * flags them so disagreement reads as a feature, not noise.
 */
export function isContested(
  stats: ReadonlyArray<{ count: number }>,
  totalSpotters: number,
): boolean {
  if (totalSpotters < CONSENSUS_THRESHOLD_USERS || stats.length < 2) return false;
  const [leader, runnerUp] = stats;
  if (!runnerUp || runnerUp.count === 0) return false;
  return leader.count - runnerUp.count <= 1 || runnerUp.count / totalSpotters >= 0.35;
}
