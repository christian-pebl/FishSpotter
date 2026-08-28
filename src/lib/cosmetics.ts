/**
 * Profile cosmetics: frames, site backdrops and species crests.
 *
 * All three are UNLOCKS, never purchases. There is no currency in FishSpotter
 * (the short-lived Pebbles shop was retired 20 Jul 2026, see src/lib/prize.ts),
 * so nothing here is bought and nothing is deducted. You either did the thing or
 * you did not.
 *
 * The split is deliberate, and follows the badge rule in src/lib/badges.ts:
 *
 *   FRAME     gated on JUDGEMENT. Derived from the consensus record, so the
 *             frame around your name is a claim other spotters made about you,
 *             not one you made about yourself. Cannot be farmed by volume, and
 *             cannot be chosen: you wear the best one you have earned.
 *   BACKDROP  gated on PLACE. Spend real attention on a site and you may fly its
 *             colours. Chosen, because which farm you care about is taste.
 *   CREST     gated on your COLLECTION. Pick any animal you have unlocked.
 *             Chosen, and the choice is itself the flex.
 *
 * Christian's steer (28 Aug 2026) was that an avatar reads gimmicky. The crest
 * is the restrained version: no character art, just the catalogue silhouette of
 * a real animal you actually found.
 *
 * Pure leaf (no Prisma, no React) so the ladders and unlock rules are unit
 * tested in cosmetics.test.ts and shared by the profile, the picker and the
 * server actions that validate a chosen value.
 */

import type { BadgeCounts } from "@/lib/badges";

// ---------------------------------------------------------------------------
// Frames — earned, not chosen
// ---------------------------------------------------------------------------

export type FrameId = "none" | "kelp" | "coral" | "deep";

export interface FrameDef {
  id: FrameId;
  name: string;
  /** How it was earned, shown in the picker's locked/unlocked list. */
  requirement: string;
}

/*
 * The Tailwind treatment for each frame lives in
 * src/components/profile/cosmetic-styles.ts, NOT here. Tailwind's content globs
 * do not scan src/lib, so a class string in this file generates no CSS and the
 * cosmetic renders invisible. See the note in that file.
 */

/**
 * Ordered weakest to strongest. A spotter always wears the LAST one they
 * qualify for, so a frame can never understate a record.
 */
export const FRAMES: readonly FrameDef[] = [
  {
    id: "none",
    name: "No frame",
    requirement: "",
  },
  {
    id: "kelp",
    name: "Kelp frame",
    requirement: "10 calls confirmed by the community",
  },
  {
    id: "coral",
    name: "Coral frame",
    requirement: "Name an animal first and have the community agree",
  },
  {
    id: "deep",
    name: "Deep Water frame",
    requirement: "A pioneer call on a genuinely uncommon animal",
  },
] as const;

export function getFrame(id: FrameId): FrameDef {
  return FRAMES.find((f) => f.id === id) ?? FRAMES[0];
}

/** Thresholds, kept next to the requirement copy above so they cannot drift. */
export const FRAME_KELP_CONFIRMED = 10;

/**
 * The best frame a record has earned. Checked strongest-first so the answer is
 * the spotter's high-water mark rather than their most recent activity.
 */
export function frameFor(counts: BadgeCounts): FrameId {
  if (counts["deep-pioneer"] >= 1) return "deep";
  if (counts.pioneer >= 1) return "coral";
  if (counts.confirmed >= FRAME_KELP_CONFIRMED) return "kelp";
  return "none";
}

// ---------------------------------------------------------------------------
// Backdrops — one per survey site, unlocked by working that site
// ---------------------------------------------------------------------------

/**
 * Answers needed at a site to fly its colours, CAPPED BY the number of clips
 * that site actually has. Two sites currently hold fewer clips than the flat
 * threshold (Freshwater West has 1, East Pickard Bay has 4), and a target you
 * cannot reach is the same unfairness as telling a spotter there are "59 to
 * find" when we do not know all 59 are in the footage. See backdropTarget.
 */
export const BACKDROP_UNLOCK_ANSWERS = 5;

/** The clip-count floor below which a site is not worth its own backdrop. */
export const BACKDROP_MIN_CLIPS = 1;

export function backdropTarget(clipsAtSite: number): number {
  return Math.max(BACKDROP_MIN_CLIPS, Math.min(BACKDROP_UNLOCK_ANSWERS, clipsAtSite));
}

export function backdropUnlocked(answersAtSite: number, clipsAtSite: number): boolean {
  return clipsAtSite > 0 && answersAtSite >= backdropTarget(clipsAtSite);
}

/**
 * Shorten a site for display. Snippet.site is a full descriptor
 * ("Ramsey Sound, Pembrokeshire, Wales, UK"); the profile only has room for the
 * place itself.
 */
export function shortSiteName(site: string): string {
  return site.split(",")[0]?.trim() || site;
}

// ---------------------------------------------------------------------------
// Crest — pick any animal from your own collection
// ---------------------------------------------------------------------------

/**
 * Validate a chosen crest against what the spotter has actually unlocked. The
 * server action must not trust the client: the crest is a public claim to have
 * found that animal, so an unlocked-species check is the whole point.
 */
export function crestAllowed(
  scientificName: string | null,
  unlocked: ReadonlySet<string>,
): boolean {
  if (scientificName === null) return true; // clearing the crest is always fine
  return unlocked.has(scientificName);
}

/** Same rule for a backdrop: only a site the spotter has genuinely worked. */
export function backdropAllowed(
  site: string | null,
  unlockedSites: ReadonlySet<string>,
): boolean {
  if (site === null) return true;
  return unlockedSites.has(site);
}
