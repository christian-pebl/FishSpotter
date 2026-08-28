/**
 * The three things a spotter is measured on, and the milestones under each.
 *
 * Christian's structure (28 Aug 2026): three categories, each showing your count,
 * your rank on that category's leaderboard, and the species behind it. Nine
 * milestones in total, three per category.
 *
 *   PIONEER     you named the animal FIRST and the community then agreed.
 *   CONSENSUS   your call matched what the community settled on.
 *   PATHFINDER  you were the first spotter to open a clip at all.
 *
 * The ordering is deliberate: pioneer leads because it is the hardest and the
 * scarcest, and pathfinder trails because turning up first is effort rather than
 * judgement. Pathfinder still earns its place as the exploration counterweight,
 * since consensus alone would only ever reward piling onto clips other people
 * already found.
 *
 * Nothing here is keyed on join date. A marker for having been early rewards a
 * calendar accident and permanently shuts the door on anyone who finds the app
 * later; every milestone stays winnable by someone signing up today.
 *
 * Pure leaf (no Prisma, no React), unit tested in badges.test.ts.
 */

export type CategoryId = "pioneer" | "consensus" | "pathfinder";

export interface CategoryDef {
  id: CategoryId;
  name: string;
  /** One line under the count, explaining what it counts. */
  blurb: string;
  /** Longer line for the expanded panel. */
  detail: string;
  /** Exactly three ascending milestones. */
  milestones: readonly [number, number, number];
}

/**
 * Milestone ladders, set by Christian.
 *
 * NOTE these are long-horizon targets, deliberately above what the current clip
 * library can supply. Measured 28 Aug 2026 the leaders sat at pioneer 6,
 * consensus 26 and pathfinder 27, and only 40 clips had reached consensus at
 * all, so the upper rungs need the library to grow before anyone can reach them.
 * That is a stated choice, not an oversight: see the note in the profile PR.
 */
export const CATEGORIES: Readonly<Record<CategoryId, CategoryDef>> = {
  pioneer: {
    id: "pioneer",
    name: "Pioneer",
    blurb: "Named it first, and the community agreed",
    detail:
      "You were the first spotter to put a name to the animal on these clips, and three or more others independently arrived at the same answer.",
    milestones: [10, 25, 50],
  },
  consensus: {
    id: "consensus",
    name: "Consensus",
    blurb: "Calls the community agreed with",
    detail:
      "Clips where the community settled on the same animal you named. This is the measure of being right, rather than of being busy.",
    milestones: [20, 50, 100],
  },
  pathfinder: {
    id: "pathfinder",
    name: "Pathfinder",
    blurb: "Clips you opened up first",
    detail:
      "Clips nobody had answered before you did. Someone has to look at the footage nobody has touched, and this is the only thing that counts it.",
    milestones: [30, 75, 150],
  },
} as const;

/** Display order: hardest first. */
export const CATEGORY_ORDER: readonly CategoryId[] = [
  "pioneer",
  "consensus",
  "pathfinder",
] as const;

/** How many milestones a count has passed (0..3). */
export function milestonesReached(
  count: number,
  milestones: readonly number[],
): number {
  let reached = 0;
  for (const m of milestones) {
    if (count >= m) reached++;
    else break;
  }
  return reached;
}

/** The next milestone to aim at, or null once all three are held. */
export function nextMilestone(
  count: number,
  milestones: readonly number[],
): number | null {
  for (const m of milestones) {
    if (count < m) return m;
  }
  return null;
}

/**
 * Progress towards the next milestone as 0..1, measured from the previous
 * milestone rather than from zero, so a bar does not sit almost-full for the
 * whole of a long rung. Returns 1 once every milestone is held.
 */
export function milestoneProgress(
  count: number,
  milestones: readonly number[],
): number {
  const next = nextMilestone(count, milestones);
  if (next === null) return 1;
  const reached = milestonesReached(count, milestones);
  const floor = reached === 0 ? 0 : milestones[reached - 1];
  const span = next - floor;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (count - floor) / span));
}

/** Counts a spotter holds on each category. */
export type CategoryCounts = Record<CategoryId, number>;

export const ZERO_COUNTS: CategoryCounts = {
  pioneer: 0,
  consensus: 0,
  pathfinder: 0,
};

/**
 * Rank a spotter within one category: 1-based, ties share a rank, and spotters
 * with a zero count are excluded entirely (being ranked 48th of 48 for having
 * done nothing is a punishment, not a credential). Returns null when the
 * spotter has no count on this category.
 */
export function rankWithin(
  myCount: number,
  allCounts: readonly number[],
): { rank: number; of: number } | null {
  if (myCount <= 0) return null;
  const ranked = allCounts.filter((c) => c > 0);
  if (ranked.length === 0) return null;
  const ahead = ranked.filter((c) => c > myCount).length;
  return { rank: ahead + 1, of: ranked.length };
}
