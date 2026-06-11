import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { MIN_ANSWERS_FOR_RANKING, rankSpotters } from "@/lib/leaderboard";
import { prisma } from "@/lib/prisma";
import { MarineBackdrop } from "@/components/MarineBackdrop";
import { BackToFeed } from "@/components/BackToFeed";

// S4-02: switch from force-dynamic to ISR. Anonymous requests cache for
// 60s; signed-in requests are dynamic (Next sees the cookie read from
// getServerSession and bypasses the cache) — best of both worlds. The
// page only does 3 queries regardless of Answer table size:
//   1) groupBy({by: userId}) for the ranking table
//   2) groupBy({by: chosenOption}) for the histogram
//   3) findMany Users by id IN (...)
// This replaces the previous Answer.findMany() scan over all rows.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Leaderboard",
};

type LeaderRow = {
  userId: string;
  displayName: string;
  correct: number;
  total: number;
  points: number;
  score: number;
  rank: number;
};

export default async function LeaderboardPage() {
  const session = await getServerSession(authOptions);
  const myUserId = session?.user?.id ?? null;

  // S4-02 + S7-T1: SQL-side aggregation. Four parallel groupBy / count
  // calls + one findMany of users by id IN (...). Total of 5 queries
  // regardless of how many answers exist in the database — the
  // previous Answer.findMany() scan was the dominant cost.
  //
  // perUserPoints sums Answer.points per user (S7-T1 scoring model).
  // perUserCorrect is kept separately because the table still shows a
  // "Correct" column (X/Y) — points and correct are no longer the same
  // number now that pending answers are worth 1 point each.
  const [
    perUserTotal,
    perUserCorrect,
    perUserPoints,
    perOptionAggregates,
    totalAnswers,
  ] = await Promise.all([
    prisma.answer.groupBy({
      by: ["userId"],
      _count: { _all: true },
    }),
    prisma.answer.groupBy({
      by: ["userId"],
      where: { isCorrect: true },
      _count: { _all: true },
    }),
    prisma.answer.groupBy({
      by: ["userId"],
      _sum: { points: true },
    }),
    prisma.answer.groupBy({
      by: ["chosenOption"],
      _count: { _all: true },
      orderBy: { _count: { chosenOption: "desc" } },
      take: 60, // wider than the displayed 12 to absorb normalised
      // bucketing collapse.
    }),
    prisma.answer.count(),
  ]);

  type CountRow = { userId: string; _count: { _all: number } };
  type SumRow = { userId: string; _sum: { points: number | null } };
  const correctByUser: Record<string, number> = {};
  for (const row of perUserCorrect as CountRow[]) {
    correctByUser[row.userId] = row._count._all;
  }
  const pointsByUser: Record<string, number> = {};
  for (const row of perUserPoints as SumRow[]) {
    pointsByUser[row.userId] = row._sum.points ?? 0;
  }
  const byUser: Record<
    string,
    { correct: number; total: number; points: number }
  > = {};
  for (const row of perUserTotal as CountRow[]) {
    byUser[row.userId] = {
      total: row._count._all,
      correct: correctByUser[row.userId] ?? 0,
      points: pointsByUser[row.userId] ?? 0,
    };
  }

  // "Most common species answers" histogram. The DB-side groupBy
  // returns (chosenOption, count); bucketCountsByNormalized then
  // collapses case + whitespace + article variants in O(distinct).
  const { bucketCountsByNormalized } = await import(
    "@/lib/answer-histogram"
  );
  type PerOptionRow = { chosenOption: string; _count: { _all: number } };
  const topAnswers = bucketCountsByNormalized(
    (perOptionAggregates as PerOptionRow[])
      .filter((row) => row.chosenOption)
      .map((row) => ({ chosenOption: row.chosenOption, count: row._count._all })),
  )
    .map(({ option, count }) => ({
      option,
      count,
      percent:
        totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const users = await prisma.user.findMany({
    where: { id: { in: Object.keys(byUser) } },
    select: { id: true, displayName: true, name: true, leaderboardOptIn: true },
  });
  type UserRow = {
    id: string;
    displayName: string | null;
    name: string | null;
    leaderboardOptIn: boolean;
  };
  const userMap = Object.fromEntries(users.map((u: UserRow) => [u.id, u]));

  // ICO Children's Code: users who have opted out of the public leaderboard
  // (default for declared 13-17 minors) are excluded from the ranking other
  // people see. The viewer always sees THEIR OWN row so their personal rank
  // card / "You" highlight keeps working. Ranks recompute over the filtered
  // set so they stay contiguous.
  for (const userId of Object.keys(byUser)) {
    if (userId === myUserId) continue;
    if (userMap[userId]?.leaderboardOptIn === false) {
      delete byUser[userId];
    }
  }

  // Pure scoring + shared-rank tie handling lives in @/lib/leaderboard so
  // it's unit-testable without spinning up Prisma. See audit §05 F-LB-02
  // (P0 scoring formula) and F-LB-06 (tie handling). S7-T1: score is now
  // the sum of Answer.points, not just the correct count.
  const rankedRaw = rankSpotters(
    Object.entries(byUser).map(([userId, { correct, total, points }]) => ({
      userId,
      correct,
      total,
      points,
    })),
  );
  const ranked: LeaderRow[] = rankedRaw.map((r) => ({
    ...r,
    // points is required on LeaderRow but optional on RankedSpotter (for
    // legacy callers). The DB query above always populates it, so coerce.
    points: r.points ?? 0,
    displayName:
      userMap[r.userId]?.displayName ??
      userMap[r.userId]?.name ??
      `User ${r.userId.slice(0, 6)}`,
  }));

  const leaderboard = ranked.slice(0, 50);
  const myEntry = myUserId ? ranked.find((r) => r.userId === myUserId) ?? null : null;
  const myEntryVisible = !!myEntry && leaderboard.some((r) => r.userId === myUserId);

  const myCounts = myUserId ? byUser[myUserId] : null;
  const noAnswersYet = !!myUserId && !myCounts;
  const ineligible =
    !!myUserId && !!myCounts && myCounts.total < MIN_ANSWERS_FOR_RANKING;
  const answersToQualify =
    ineligible && myCounts ? MIN_ANSWERS_FOR_RANKING - myCounts.total : 0;

  return (
    <MarineBackdrop>
    <div className="flex-1 overflow-y-auto">
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8"
      >
        <BackToFeed />
        <section className="pebl-surface rounded-card px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-teal-600">
            Community overview
          </p>
          <h1 className="mt-2 font-brand-heading text-h1 text-navy-900">
            Spotter leaderboard
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-navy-900/72">
            Every clip you identify earns points and climbs the board. Keep a streak going, sharpen your eye against the reference IDs, and see how you stack up against fellow spotters.
          </p>
          <p className="mt-3 max-w-2xl text-xs leading-5 text-navy-900/72">
            Score = 2 points per correct ID against a reference, 1 point for a submission on a clip without a reference yet, 0 for an unmatched guess. Each clip counts once per spotter. Minimum {MIN_ANSWERS_FOR_RANKING} answers to enter the ranking.
          </p>
        </section>

        {leaderboard.length === 0 ? (
          <p className="text-sm text-navy-900/72">
            No spotters have hit the {MIN_ANSWERS_FOR_RANKING}-answer threshold yet. Sign in and start identifying clips to be the first.
          </p>
        ) : (
          <div className="pebl-surface overflow-hidden rounded-card">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Top spotters ranked by correct identifications. Minimum {MIN_ANSWERS_FOR_RANKING} answers to qualify.
              </caption>
              <thead>
                <tr className="border-b border-navy-900/12 text-xs uppercase tracking-eyebrow text-navy-900/72">
                  <th scope="col" className="px-4 py-3 w-12">Rank</th>
                  <th scope="col" className="px-4 py-3">Spotter</th>
                  <th scope="col" className="px-4 py-3 text-right">Score</th>
                  <th scope="col" className="px-4 py-3 text-right hidden sm:table-cell">
                    Correct
                  </th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => {
                  const isMe = entry.userId === myUserId;
                  // Q4-A-4: differentiate the top-3 rows so the most
                  // motivating moment in the scoring system reads at a
                  // glance. Left-border accent + subtle tinted background
                  // for ranks 1-3. Medal text colour on the rank cell.
                  const medal =
                    entry.rank === 1
                      ? {
                          row: "bg-amber-50/70 border-l-4 border-amber-400",
                          rank: "text-amber-700",
                          label: "Gold",
                          icon: (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                              <path d="M6 1l1.2 3.7H11L8 6.9l1.1 3.6L6 8.4l-3.1 2.1L4 6.9 1 4.7h3.8z"/>
                            </svg>
                          ),
                        }
                      : entry.rank === 2
                        ? {
                            row: "bg-zinc-100/70 border-l-4 border-zinc-400",
                            rank: "text-zinc-600",
                            label: "Silver",
                            icon: (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.8"/>
                              </svg>
                            ),
                          }
                        : entry.rank === 3
                          ? {
                              row: "bg-orange-50/70 border-l-4 border-orange-400",
                              rank: "text-orange-700",
                              label: "Bronze",
                              icon: (
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                                  <path d="M6 2l4.5 8H1.5z"/>
                                </svg>
                              ),
                            }
                          : null;
                  return (
                    <tr
                      key={entry.userId}
                      // P-31: "row" is the correct ARIA value for a selected
                      // table-row. React's built-in aria-current type definition
                      // doesn't include "row" yet, so we cast to satisfy TS.
                      aria-current={isMe ? ("row" as "page") : undefined}
                      className={
                        "border-b border-navy-900/12 last:border-b-0" +
                        (medal ? ` ${medal.row}` : "") +
                        // Keep the "You" left-border even when stacked with a medal accent.
                        (isMe ? " bg-surface-muted" : "")
                      }
                    >
                      <td
                        className={
                          "px-4 py-3 font-mono " +
                          (medal ? `font-bold ${medal.rank}` : "text-teal-600")
                        }
                      >
                        {medal && (
                          <>
                            {medal.icon}
                            <span className="sr-only">{medal.label} medal. </span>
                          </>
                        )}
                        #{entry.rank}
                      </td>
                      <td className="px-4 py-3 font-medium text-navy-900">
                        {entry.displayName}
                        {isMe && (
                          <span className="ml-2 inline-block rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow text-teal-700">
                            You
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-teal-600">
                        {entry.score}
                      </td>
                      <td className="px-4 py-3 text-right text-navy-900/72 hidden sm:table-cell">
                        {entry.correct}/{entry.total}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {myEntry && !myEntryVisible && (
          <div className="pebl-surface rounded-card flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <div className="font-medium text-navy-900">
              Your rank: <span className="font-mono text-teal-600">#{myEntry.rank}</span>
            </div>
            <div className="text-navy-900/72">
              {myEntry.score} points · {myEntry.correct}/{myEntry.total} correct
            </div>
          </div>
        )}

        {ineligible && (
          <div className="pebl-surface rounded-card px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-teal-600">
              Your progress
            </p>
            <p className="mt-2 text-sm leading-7 text-navy-900">
              {myCounts!.correct} correct out of {myCounts!.total} so far.{" "}
              <strong>{answersToQualify}</strong> more {answersToQualify === 1 ? "answer" : "answers"} to qualify for the leaderboard.
            </p>
            <Link
              href="/feed"
              className="pebl-button-primary mt-4 inline-flex items-center justify-center px-5 py-2.5 text-sm"
            >
              Head to the live feed
            </Link>
          </div>
        )}

        {noAnswersYet && (
          <div className="pebl-surface rounded-card px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-teal-600">
              Get started
            </p>
            <p className="mt-2 text-sm leading-7 text-navy-900">
              You haven&apos;t submitted any identifications yet. Submit {MIN_ANSWERS_FOR_RANKING} to enter the ranking.
            </p>
            <Link
              href="/feed"
              className="pebl-button-primary mt-4 inline-flex items-center justify-center px-5 py-2.5 text-sm"
            >
              Head to the live feed
            </Link>
          </div>
        )}

        <section className="pebl-surface rounded-card px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-teal-600">
            Most-named species
          </p>
          <h2 className="mt-1 font-brand-heading text-h2 text-navy-900">
            Most common species answers
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-navy-900/72">
            What spotters are naming most often across the live feed. {totalAnswers > 0 ? `${totalAnswers} total observations.` : ""}
          </p>
          {topAnswers.length === 0 ? (
            <p className="mt-4 text-sm text-navy-900/72">No observations recorded yet.</p>
          ) : (
            <ul className="mt-4 space-y-1.5">
              {topAnswers.map((row, i) => (
                <li key={row.option} className="flex items-center gap-3 text-sm">
                  <span className="w-6 text-right font-mono text-xs text-navy-900/72">#{i + 1}</span>
                  <span className="w-40 truncate text-navy-900">{row.option}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--surface-muted)]">
                    <div
                      className="h-full rounded-full bg-teal-600"
                      style={{ width: `${Math.max(2, row.percent)}%` }}
                    />
                  </div>
                  <span className="w-16 text-right tabular-nums text-xs text-navy-900/72">
                    {row.count} · {row.percent}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
    </MarineBackdrop>
  );
}
