/**
 * A spotter's RECORD: the three categories on their profile, each with a count,
 * a rank on that category's leaderboard, and the species behind it.
 *
 * Nothing here is stored. Every figure is derived from Answer plus the reached
 * consensus leader, using the exact same `groupPendingAnswers` / `pickLeaderGroup`
 * pair the rescore cron uses, so a milestone can never disagree with the Pebbles
 * that were paid, and there is no table to backfill.
 *
 * Definitions, deliberately stricter than the payout tiers:
 *
 *   consensus   your answer on a clip whose community consensus landed on the
 *               same animal you named.
 *   pioneer     you were the FIRST person to name that animal on that clip, and
 *               the community then converged on it. Stricter than
 *               `consensusTier`'s "pioneer" payout, which only requires being
 *               among the first three to answer the clip at all. Being early is
 *               not the same as being first AND right.
 *   pathfinder  you were the very first spotter to answer a clip nobody had
 *               touched, whatever it later turned out to be.
 *
 * Ranks are computed across every spotter in the same pass, which costs nothing
 * extra because the whole Answer table is already in memory.
 *
 * Cost note: this walks every Answer row, the same stance the rescore cron takes
 * (464 rows as of 28 Aug 2026). If the table balloons, both need the same
 * "needs rescore" watermark treatment rather than a per-profile cache.
 */

import type { PrismaClient } from "@prisma/client";
import {
  CATEGORIES,
  CATEGORY_ORDER,
  milestoneProgress,
  milestonesReached,
  nextMilestone,
  rankWithin,
  ZERO_COUNTS,
  type CategoryCounts,
  type CategoryId,
} from "@/lib/badges";
import { groupPendingAnswers, pickLeaderGroup } from "@/lib/consensus";
import {
  CATALOGUE_ALIASES,
  loadAliases,
  scientificFromLocalName,
} from "@/lib/answer-matching";
import { normalizeForMatch } from "@/lib/normalize-answer";

/** One species entry in a category's expandable list. */
export interface RecordSpecies {
  /** Resolved binomial when the alias table could resolve one. */
  scientificName: string | null;
  /** Display label, as the spotter or the community named it. */
  label: string;
  /** Curated thumbnail, when the species has one cached. */
  thumbUrl: string | null;
  /** How many clips in this category carry this species. */
  count: number;
}

export interface CategoryRecord {
  id: CategoryId;
  name: string;
  blurb: string;
  detail: string;
  count: number;
  /** 1-based rank among spotters with a non-zero count, or null at zero. */
  rank: number | null;
  /** How many spotters have a non-zero count on this category. */
  rankOf: number;
  milestones: readonly number[];
  /** How many of the three are held. */
  reached: number;
  /** The next target, or null once all three are held. */
  nextAt: number | null;
  /** 0..1 towards the next milestone, measured from the previous one. */
  progress: number;
  species: RecordSpecies[];
}

export interface SpotterRecord {
  counts: CategoryCounts;
  categories: CategoryRecord[];
  /** Clips of yours the community has resolved either way (the honesty line). */
  resolvedCalls: number;
}

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
  const byArrival = (a: Raw, b: Raw) => {
    const t = a.createdAt.getTime() - b.createdAt.getTime();
    return t !== 0 ? t : a.id.localeCompare(b.id);
  };

  const bySnippet = new Map<string, Raw[]>();
  for (const a of rawAnswers) {
    const list = bySnippet.get(a.snippetId);
    if (list) list.push(a);
    else bySnippet.set(a.snippetId, [a]);
  }

  /** snippetId -> winning normalised name, only where consensus was reached. */
  const leaderBySnippet = new Map<string, string>();
  /** snippetId -> the winning camp's answers, earliest first. */
  const campBySnippet = new Map<string, Raw[]>();
  /** snippetId -> the first spotter to answer it at all. */
  const firstAnswererBySnippet = new Map<string, Raw>();

  for (const [snippetId, answers] of bySnippet) {
    const ordered = [...answers].sort(byArrival);
    if (ordered[0]) firstAnswererBySnippet.set(snippetId, ordered[0]);

    const leader = pickLeaderGroup(groupPendingAnswers(answers.map((a) => ({ ...a }))));
    if (!leader) continue;
    leaderBySnippet.set(snippetId, leader.normalisedName);
    const winningIds = new Set(leader.answers.map((a) => a.id));
    campBySnippet.set(
      snippetId,
      ordered.filter((a) => winningIds.has(a.id)),
    );
  }

  // --- counts for EVERY spotter, so ranks come free -------------------------
  const countsByUser = new Map<string, CategoryCounts>();
  const bump = (uid: string, key: CategoryId) => {
    const c = countsByUser.get(uid) ?? { ...ZERO_COUNTS };
    c[key]++;
    countsByUser.set(uid, c);
  };

  /** The clips backing this spotter's own three categories. */
  const mySnippets: Record<CategoryId, string[]> = {
    pioneer: [],
    consensus: [],
    pathfinder: [],
  };
  let resolvedCalls = 0;

  for (const a of rawAnswers) {
    const leader = leaderBySnippet.get(a.snippetId);
    if (leader === undefined) continue;
    if (a.userId === userId) resolvedCalls++;
    if (normalizeForMatch(a.chosenOption) !== leader) continue;

    bump(a.userId, "consensus");
    if (a.userId === userId) mySnippets.consensus.push(a.snippetId);

    const camp = campBySnippet.get(a.snippetId);
    if (camp && camp[0]?.id === a.id) {
      bump(a.userId, "pioneer");
      if (a.userId === userId) mySnippets.pioneer.push(a.snippetId);
    }
  }

  for (const [snippetId, first] of firstAnswererBySnippet) {
    bump(first.userId, "pathfinder");
    if (first.userId === userId) mySnippets.pathfinder.push(snippetId);
  }

  const counts = countsByUser.get(userId) ?? { ...ZERO_COUNTS };

  // --- species behind each category ----------------------------------------
  const aliases = [...CATALOGUE_ALIASES, ...(await loadAliases())];
  const myAnswerBySnippet = new Map<string, Raw>();
  for (const a of rawAnswers) {
    if (a.userId === userId) myAnswerBySnippet.set(a.snippetId, a);
  }

  /**
   * The animal a clip represents for this spotter. Prefer the community's
   * verdict; fall back to what the spotter themselves said, which matters for
   * pathfinder clips that have not reached consensus yet.
   */
  const labelFor = (snippetId: string): string => {
    const camp = campBySnippet.get(snippetId);
    if (camp?.[0]) return camp[0].chosenOption;
    return myAnswerBySnippet.get(snippetId)?.chosenOption ?? "";
  };

  const grouped: Record<CategoryId, Map<string, { label: string; count: number }>> = {
    pioneer: new Map(),
    consensus: new Map(),
    pathfinder: new Map(),
  };
  for (const id of CATEGORY_ORDER) {
    for (const snippetId of mySnippets[id]) {
      const label = labelFor(snippetId);
      if (!label) continue;
      const key = normalizeForMatch(label) || label;
      const entry = grouped[id].get(key);
      if (entry) entry.count++;
      else grouped[id].set(key, { label, count: 1 });
    }
  }

  // Thumbnails for every species mentioned, in one query.
  const sciByKey = new Map<string, string>();
  for (const id of CATEGORY_ORDER) {
    for (const [key, { label }] of grouped[id]) {
      if (sciByKey.has(key)) continue;
      const sci = scientificFromLocalName(label, aliases);
      if (sci) sciByKey.set(key, sci);
    }
  }
  const wantedSci = Array.from(new Set(sciByKey.values()));
  const thumbBySci = new Map<string, string>();
  if (wantedSci.length > 0) {
    const images = await prisma.speciesImage.findMany({
      where: { scientificName: { in: wantedSci }, curated: true },
      select: { scientificName: true, url: true, webpUrl: true, ordering: true },
      orderBy: { ordering: "asc" },
    });
    for (const img of images) {
      if (!thumbBySci.has(img.scientificName)) {
        thumbBySci.set(img.scientificName, img.webpUrl ?? img.url);
      }
    }
  }

  const categories: CategoryRecord[] = CATEGORY_ORDER.map((id) => {
    const def = CATEGORIES[id];
    const count = counts[id];
    const allCounts = Array.from(countsByUser.values()).map((c) => c[id]);
    const rank = rankWithin(count, allCounts);

    const species: RecordSpecies[] = Array.from(grouped[id].entries())
      .map(([key, { label, count: n }]) => {
        const sci = sciByKey.get(key) ?? null;
        return {
          scientificName: sci,
          label,
          thumbUrl: sci ? (thumbBySci.get(sci) ?? null) : null,
          count: n,
        };
      })
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    return {
      id,
      name: def.name,
      blurb: def.blurb,
      detail: def.detail,
      count,
      rank: rank?.rank ?? null,
      rankOf: rank?.of ?? 0,
      milestones: def.milestones,
      reached: milestonesReached(count, def.milestones),
      nextAt: nextMilestone(count, def.milestones),
      progress: milestoneProgress(count, def.milestones),
      species,
    };
  });

  return { counts, categories, resolvedCalls };
}
