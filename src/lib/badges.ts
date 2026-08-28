/**
 * Spotter badges, the earned half of the profile.
 *
 * Design rule (Christian, 28 Aug 2026): everything on a profile is EARNED, not
 * bought. Pebbles are a score, not a currency; there is no wallet and nothing to
 * spend. Some things unlock on a pebble threshold (activity), but the badges
 * that actually signal judgement unlock on CONSENSUS, which cannot be farmed by
 * volume because it depends on other people independently agreeing with you.
 *
 * Deliberately NOT a badge: anything keyed on join date. A "founding spotter"
 * marker rewards a calendar accident and permanently penalises everyone who
 * finds the app later, with no way back in. Every badge here stays winnable by
 * someone who signs up today.
 *
 * Pure leaf (no Prisma, no React) so the ladders are unit tested in
 * badges.test.ts and shared by the profile, the record service and the tests.
 * The RECORD (what a spotter actually did) is computed in
 * src/lib/spotter-record.ts; this file only turns a record into awards.
 */

import type { RarityTier } from "@/lib/pebbles";

export type BadgeId =
  | "confirmed"
  | "pioneer"
  | "deep-pioneer"
  | "pathfinder"
  | "current";

/** How rare a badge reads, which drives its colour treatment in the UI. */
export type BadgeWeight = "standard" | "strong" | "elite";

export interface BadgeDef {
  id: BadgeId;
  /** Base name, shown without a tier number at tier 1. */
  name: string;
  /** One line explaining how it was earned. Shown on hover/tap. */
  hint: string;
  /** Ascending thresholds. Crossing index i awards tier i+1. */
  tiers: readonly number[];
  weight: BadgeWeight;
}

/**
 * The ladders.
 *
 * `confirmed` is the volume ladder and runs furthest, because it is the easiest
 * to move. `pioneer` and `deep-pioneer` are short because they are meant to stay
 * scarce: as of 28 Aug 2026 only 19 of 86 spotters had ever been first to name
 * an animal the crowd then confirmed, and the leader had 7.
 */
export const BADGES: Readonly<Record<BadgeId, BadgeDef>> = {
  confirmed: {
    id: "confirmed",
    name: "Confirmed",
    hint: "Calls the community independently agreed with.",
    tiers: [1, 5, 10, 25, 50, 100],
    weight: "standard",
  },
  pathfinder: {
    id: "pathfinder",
    name: "Pathfinder",
    hint: "Clips you were the very first spotter to open up.",
    tiers: [1, 5, 25],
    weight: "standard",
  },
  current: {
    id: "current",
    name: "Current",
    hint: "Consecutive calls the community went on to confirm.",
    tiers: [3, 5, 8],
    weight: "strong",
  },
  pioneer: {
    id: "pioneer",
    name: "Pioneer",
    hint: "You named the animal first, and the community then agreed with you.",
    tiers: [1, 3, 10],
    weight: "strong",
  },
  "deep-pioneer": {
    id: "deep-pioneer",
    name: "Deep Water Pioneer",
    hint: "A pioneer call on a genuinely uncommon animal.",
    tiers: [1, 3],
    weight: "elite",
  },
} as const;

export interface AwardedBadge {
  id: BadgeId;
  name: string;
  hint: string;
  weight: BadgeWeight;
  /** 1-based tier reached. */
  tier: number;
  /** Total tiers available, for "3 of 6" style progress. */
  maxTier: number;
  /** The spotter's raw count on this ladder. */
  count: number;
  /** Count needed for the next tier, or null when maxed. */
  nextAt: number | null;
}

/** The highest tier index reached for a count, or 0 for "not yet earned". */
export function tierFor(count: number, tiers: readonly number[]): number {
  let tier = 0;
  for (const t of tiers) {
    if (count >= t) tier++;
    else break;
  }
  return tier;
}

/** Award one badge, or null when the spotter has not reached tier 1. */
export function awardBadge(id: BadgeId, count: number): AwardedBadge | null {
  const def = BADGES[id];
  const tier = tierFor(count, def.tiers);
  if (tier === 0) return null;
  return {
    id: def.id,
    name: def.name,
    hint: def.hint,
    weight: def.weight,
    tier,
    maxTier: def.tiers.length,
    count,
    nextAt: tier < def.tiers.length ? def.tiers[tier] : null,
  };
}

/** Counts a spotter has on each ladder. */
export interface BadgeCounts {
  confirmed: number;
  pathfinder: number;
  current: number;
  pioneer: number;
  "deep-pioneer": number;
}

/**
 * Every badge a spotter has earned, ordered rarest-first so the strongest
 * credential leads the row rather than the easiest one.
 */
export function awardBadges(counts: BadgeCounts): AwardedBadge[] {
  const WEIGHT_ORDER: Record<BadgeWeight, number> = {
    elite: 0,
    strong: 1,
    standard: 2,
  };
  return (Object.keys(BADGES) as BadgeId[])
    .map((id) => awardBadge(id, counts[id]))
    .filter((b): b is AwardedBadge => b !== null)
    .sort(
      (a, b) =>
        WEIGHT_ORDER[a.weight] - WEIGHT_ORDER[b.weight] ||
        b.tier - a.tier ||
        a.name.localeCompare(b.name),
    );
}

// ---------------------------------------------------------------------------
// Rarity ordering, shared by "rarest find" and the Deep Water Pioneer gate
// ---------------------------------------------------------------------------

/** Ascending order of the OBIS rarity tiers from src/lib/pebbles.ts. */
export const RARITY_ORDER: readonly RarityTier[] = [
  "common",
  "frequent",
  "uncommon",
  "rare",
  "epic",
  "legendary",
] as const;

/** A pioneer call at or above this tier counts as a Deep Water Pioneer. */
export const DEEP_PIONEER_MIN_RARITY: RarityTier = "rare";

export function rarityRank(tier: RarityTier): number {
  const i = RARITY_ORDER.indexOf(tier);
  return i === -1 ? 0 : i;
}

/** True when `tier` is at least as rare as `min`. */
export function atLeastAsRare(tier: RarityTier, min: RarityTier): boolean {
  return rarityRank(tier) >= rarityRank(min);
}

/** The rarer of two tiers. */
export function rarerOf(a: RarityTier, b: RarityTier): RarityTier {
  return rarityRank(a) >= rarityRank(b) ? a : b;
}
