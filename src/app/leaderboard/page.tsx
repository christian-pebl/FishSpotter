import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { bucketAnswersByNormalized } from "@/lib/answer-histogram";
import { MIN_ANSWERS_FOR_RANKING, rankSpotters } from "@/lib/leaderboard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboard",
};

type LeaderRow = {
  userId: string;
  displayName: string;
  correct: number;
  total: number;
  score: number;
  rank: number;
};

export default async function LeaderboardPage() {
  const session = await getServerSession(authOptions);
  const myUserId = session?.user?.id ?? null;

  const answers = await prisma.answer.findMany({
    select: { userId: true, isCorrect: true, chosenOption: true },
  });

  // Per-user counts for the ranking table.
  const byUser: Record<string, { correct: number; total: number }> = {};
  for (const a of answers) {
    if (!byUser[a.userId]) byUser[a.userId] = { correct: 0, total: 0 };
    byUser[a.userId].total += 1;
    if (a.isCorrect) byUser[a.userId].correct += 1;
  }
  const totalAnswers = answers.length;

  // "Most common species answers" histogram, normalised + bucketed
  // (S2-T02 / S2-T20). Pure helper in @/lib/answer-histogram.
  const topAnswers = bucketAnswersByNormalized(
    answers.filter((a) => a.chosenOption).map((a) => ({ chosenOption: a.chosenOption })),
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
    select: { id: true, displayName: true, name: true },
  });
  type UserRow = { id: string; displayName: string | null; name: string | null };
  const userMap = Object.fromEntries(users.map((u: UserRow) => [u.id, u]));

  // Pure scoring + shared-rank tie handling lives in @/lib/leaderboard so
  // it's unit-testable without spinning up Prisma. See audit §05 F-LB-02
  // (P0 scoring formula) and F-LB-06 (tie handling).
  const rankedRaw = rankSpotters(
    Object.entries(byUser).map(([userId, { correct, total }]) => ({
      userId,
      correct,
      total,
    })),
  );
  const ranked: LeaderRow[] = rankedRaw.map((r) => ({
    ...r,
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
    <div className="flex-1 overflow-y-auto">
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8"
      >
        <section className="pebl-surface rounded-hero px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-[color:var(--primary)]">
            Community overview
          </p>
          <h1 className="mt-2 font-brand-heading text-3xl font-bold text-[color:var(--foreground)]">
            PEBL spotter leaderboard
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
            Reward regular participation, celebrate accurate observations, and highlight the community members helping shape the marine monitoring record.
          </p>
          <p className="mt-3 max-w-2xl text-xs leading-5 text-[color:var(--muted)]">
            Score = correct identifications. Each clip counts once per spotter. Minimum {MIN_ANSWERS_FOR_RANKING} answers to enter the ranking.
          </p>
        </section>

        {leaderboard.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">
            No spotters have hit the {MIN_ANSWERS_FOR_RANKING}-answer threshold yet. Sign in and start identifying clips to be the first.
          </p>
        ) : (
          <div className="pebl-surface overflow-hidden rounded-card">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Top spotters ranked by correct identifications. Minimum {MIN_ANSWERS_FOR_RANKING} answers to qualify.
              </caption>
              <thead>
                <tr className="border-b border-[color:var(--border)] text-xs uppercase tracking-eyebrow text-[color:var(--muted)]">
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
                  return (
                    <tr
                      key={entry.userId}
                      aria-current={isMe ? "true" : undefined}
                      className={
                        "border-b border-[color:var(--border)] last:border-b-0" +
                        (isMe ? " bg-surface-muted" : "")
                      }
                    >
                      <td className="px-4 py-3 font-mono text-[color:var(--primary)]">
                        #{entry.rank}
                      </td>
                      <td className="px-4 py-3 font-medium text-[color:var(--foreground)]">
                        {entry.displayName}
                        {isMe && (
                          <span className="ml-2 inline-block rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow text-teal-700">
                            You
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[color:var(--primary)]">
                        {entry.score}
                      </td>
                      <td className="px-4 py-3 text-right text-[color:var(--muted)] hidden sm:table-cell">
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
            <div className="font-medium text-[color:var(--foreground)]">
              Your rank: <span className="font-mono text-[color:var(--primary)]">#{myEntry.rank}</span>
            </div>
            <div className="text-[color:var(--muted)]">
              {myEntry.score} correct · {myEntry.correct}/{myEntry.total}
            </div>
          </div>
        )}

        {ineligible && (
          <div className="pebl-surface rounded-card px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-[color:var(--primary)]">
              Your progress
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
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
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-[color:var(--primary)]">
              Get started
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
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
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-[color:var(--primary)]">
            Community guesses
          </p>
          <h2 className="mt-1 font-brand-heading text-2xl font-bold text-[color:var(--foreground)]">
            Most common species answers
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
            What spotters are naming most often across the live feed. {totalAnswers > 0 ? `${totalAnswers} total observations.` : ""}
          </p>
          {topAnswers.length === 0 ? (
            <p className="mt-4 text-sm text-[color:var(--muted)]">No observations recorded yet.</p>
          ) : (
            <ul className="mt-4 space-y-1.5">
              {topAnswers.map((row, i) => (
                <li key={row.option} className="flex items-center gap-3 text-sm">
                  <span className="w-6 text-right font-mono text-xs text-[color:var(--muted)]">#{i + 1}</span>
                  <span className="w-40 truncate text-[color:var(--foreground)]">{row.option}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--surface-muted)]">
                    <div
                      className="h-full rounded-full bg-[color:var(--primary)]"
                      style={{ width: `${Math.max(2, row.percent)}%` }}
                    />
                  </div>
                  <span className="w-16 text-right tabular-nums text-xs text-[color:var(--muted)]">
                    {row.count} · {row.percent}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
