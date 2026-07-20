import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { MIN_ANSWERS_FOR_RANKING, rankSpotters } from "@/lib/leaderboard";
import { ownedCosmeticKinds, type CosmeticKind } from "@/lib/shop/catalogue";
import { prisma } from "@/lib/prisma";

// The leaderboard body, extracted from the old /leaderboard page so it can be a
// tab inside the Pebbles hub (/pebbles) alongside the shop. Returns the sections
// only; the hub owns the MarineBackdrop + <main> + BackToFeed chrome.
//
// Ranking stays on lifetime EARNED Pebbles (sum of Answer.points); shop spending
// draws down the separate spendable wallet and never touches this score.

type LeaderRow = {
  userId: string;
  displayName: string;
  correct: number;
  total: number;
  points: number;
  score: number;
  rank: number;
};

export async function LeaderboardPanel() {
  const session = await getServerSession(authOptions);
  const myUserId = session?.user?.id ?? null;

  const [perUserTotal, perUserCorrect, perUserPoints, perOptionAggregates, totalAnswers] =
    await Promise.all([
      prisma.answer.groupBy({ by: ["userId"], _count: { _all: true } }),
      prisma.answer.groupBy({ by: ["userId"], where: { isCorrect: true }, _count: { _all: true } }),
      prisma.answer.groupBy({ by: ["userId"], _sum: { points: true } }),
      prisma.answer.groupBy({
        by: ["chosenOption"],
        _count: { _all: true },
        orderBy: { _count: { chosenOption: "desc" } },
        take: 60,
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
  const byUser: Record<string, { correct: number; total: number; points: number }> = {};
  for (const row of perUserTotal as CountRow[]) {
    byUser[row.userId] = {
      total: row._count._all,
      correct: correctByUser[row.userId] ?? 0,
      points: pointsByUser[row.userId] ?? 0,
    };
  }

  const { bucketCountsByNormalized } = await import("@/lib/answer-histogram");
  type PerOptionRow = { chosenOption: string; _count: { _all: number } };
  const topAnswers = bucketCountsByNormalized(
    (perOptionAggregates as PerOptionRow[])
      .filter((row) => row.chosenOption)
      .map((row) => ({ chosenOption: row.chosenOption, count: row._count._all })),
  )
    .map(({ option, count }) => ({
      option,
      count,
      percent: totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0,
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

  // ICO Children's Code: opted-out users are excluded from the ranking others
  // see; the viewer always sees their own row.
  for (const userId of Object.keys(byUser)) {
    if (userId === myUserId) continue;
    if (userMap[userId]?.leaderboardOptIn === false) {
      delete byUser[userId];
    }
  }

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
    points: r.points ?? 0,
    displayName:
      userMap[r.userId]?.displayName ??
      userMap[r.userId]?.name ??
      `User ${r.userId.slice(0, 6)}`,
  }));

  const leaderboard = ranked.slice(0, 50);

  // Shop cosmetics are status signals, so they render where the audience is:
  // on the ranking rows, not just the buyer's own profile. One indexed query
  // for the visible rows, grouped to kinds via the shared catalogue helper.
  const cosmeticsByUser = new Map<string, Set<CosmeticKind>>();
  if (leaderboard.length > 0) {
    const purchases = await prisma.pebblePurchase.findMany({
      where: { userId: { in: leaderboard.map((r) => r.userId) } },
      select: { userId: true, itemId: true },
    });
    const itemIdsByUser = new Map<string, string[]>();
    for (const p of purchases as Array<{ userId: string; itemId: string }>) {
      const ids = itemIdsByUser.get(p.userId) ?? [];
      ids.push(p.itemId);
      itemIdsByUser.set(p.userId, ids);
    }
    for (const [userId, itemIds] of itemIdsByUser) {
      cosmeticsByUser.set(userId, ownedCosmeticKinds(itemIds));
    }
  }

  const myEntry = myUserId ? ranked.find((r) => r.userId === myUserId) ?? null : null;
  const myEntryVisible = !!myEntry && leaderboard.some((r) => r.userId === myUserId);

  const myCounts = myUserId ? byUser[myUserId] : null;
  const noAnswersYet = !!myUserId && !myCounts;
  const ineligible = !!myUserId && !!myCounts && myCounts.total < MIN_ANSWERS_FOR_RANKING;
  const answersToQualify = ineligible && myCounts ? MIN_ANSWERS_FOR_RANKING - myCounts.total : 0;

  return (
    <>
      <section className="pebl-surface rounded-card px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-eyebrow text-teal-600">Leaderboard</p>
        <h2 className="mt-2 font-brand-heading text-h2 text-navy-900">Spotter leaderboard</h2>
        <p className="mt-2 text-sm text-navy-900/72">
          <strong className="text-navy-900">{totalAnswers.toLocaleString()}</strong>{" "}
          {totalAnswers === 1 ? "identification" : "identifications"} ·{" "}
          <strong className="text-navy-900">{Object.keys(byUser).length.toLocaleString()}</strong>{" "}
          {Object.keys(byUser).length === 1 ? "spotter" : "spotters"}
        </p>
      </section>

      {leaderboard.length === 0 ? (
        <p className="text-sm text-navy-900/72">No spotters have qualified yet.</p>
      ) : (
        <div className="pebl-surface overflow-hidden rounded-card">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Top spotters ranked by Pebbles earned. Minimum {MIN_ANSWERS_FOR_RANKING} identifications
              to qualify.
            </caption>
            <thead>
              <tr className="border-b border-navy-900/12 text-xs uppercase tracking-eyebrow text-navy-900/72">
                <th scope="col" className="px-4 py-3 w-12">Rank</th>
                <th scope="col" className="px-4 py-3">Spotter</th>
                <th scope="col" className="px-4 py-3 text-right">Pebbles</th>
                <th scope="col" className="px-4 py-3 text-right hidden sm:table-cell">Consensus</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => {
                const isMe = entry.userId === myUserId;
                const cosmetics = cosmeticsByUser.get(entry.userId);
                const hasNameplate = cosmetics?.has("nameplate") ?? false;
                const hasAccent = cosmetics?.has("profile-accent") ?? false;
                const medal =
                  entry.rank === 1
                    ? {
                        row: "bg-amber-50/70 border-l-4 border-amber-400",
                        rank: "text-amber-700",
                        label: "Gold",
                        icon: (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                            <path d="M6 1l1.2 3.7H11L8 6.9l1.1 3.6L6 8.4l-3.1 2.1L4 6.9 1 4.7h3.8z" />
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
                              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.8" />
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
                                <path d="M6 2l4.5 8H1.5z" />
                              </svg>
                            ),
                          }
                        : null;
                return (
                  <tr
                    key={entry.userId}
                    aria-current={isMe ? ("row" as "page") : undefined}
                    className={
                      "border-b border-navy-900/12 last:border-b-0" +
                      (medal ? ` ${medal.row}` : "") +
                      (isMe ? " bg-surface-muted" : "")
                    }
                  >
                    <td
                      className={
                        "px-4 py-3 font-mono " + (medal ? `font-bold ${medal.rank}` : "text-teal-600")
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
                      <Link
                        href={`/u/${entry.userId}`}
                        className={
                          "rounded-sm hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500" +
                          (hasNameplate
                            ? " inline-flex items-center gap-1 font-semibold text-amber-700 hover:text-amber-600"
                            : " hover:text-teal-700")
                        }
                      >
                        {entry.displayName}
                        {hasNameplate && (
                          <svg
                            viewBox="0 0 14 14"
                            className="h-3 w-3 shrink-0 text-amber-500"
                            fill="currentColor"
                            role="img"
                            aria-label="Gold nameplate"
                          >
                            <path d="M7 1l1.6 3.5 3.8.4-2.8 2.6.8 3.7L7 9.4 3.4 11.8l.8-3.7L1.4 5.5l3.8-.4z" />
                          </svg>
                        )}
                      </Link>
                      {hasAccent && (
                        <span
                          className="ml-2 inline-block h-1.5 w-6 rounded-full bg-gradient-to-r from-orange-400 via-orange-300 to-teal-400 align-middle"
                          role="img"
                          aria-label="Coral accent"
                        />
                      )}
                      {isMe && (
                        <span className="ml-2 inline-block rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow text-teal-700">
                          You
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-teal-600">{entry.score}</td>
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
            {myEntry.score.toLocaleString()} Pebbles · {myEntry.correct}/{myEntry.total} consensus
          </div>
        </div>
      )}

      {(ineligible || noAnswersYet) && (
        <div className="pebl-surface rounded-card flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <p className="text-sm text-navy-900">
            <strong>{ineligible ? answersToQualify : MIN_ANSWERS_FOR_RANKING}</strong> more to qualify
            for the ranking.
          </p>
          <Link
            href="/feed"
            className="pebl-button-primary inline-flex items-center justify-center px-5 py-2.5 text-sm"
          >
            Head to the live feed
          </Link>
        </div>
      )}

      <section className="pebl-surface rounded-card px-6 py-6">
        <h2 className="font-brand-heading text-h2 text-navy-900">Most-named species</h2>
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
    </>
  );
}
