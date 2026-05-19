import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboard",
};

export default async function LeaderboardPage() {
  const answers = await prisma.answer.findMany({
    select: { userId: true, isCorrect: true, chosenOption: true },
  });
  const byUser: Record<string, { correct: number; total: number }> = {};
  const byOption: Record<string, number> = {};
  for (const a of answers) {
    if (!byUser[a.userId]) byUser[a.userId] = { correct: 0, total: 0 };
    byUser[a.userId].total += 1;
    if (a.isCorrect) byUser[a.userId].correct += 1;
    if (a.chosenOption) {
      const key = a.chosenOption.trim();
      if (key) byOption[key] = (byOption[key] ?? 0) + 1;
    }
  }
  const totalAnswers = answers.length;
  const topAnswers = Object.entries(byOption)
    .map(([option, count]) => ({
      option,
      count,
      percent: totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
  const users = await prisma.user.findMany({
    where: { id: { in: Object.keys(byUser) } },
    select: { id: true, displayName: true, name: true },
  });
  type UserRow = { id: string; displayName: string | null; name: string | null };
  const userMap = Object.fromEntries(users.map((u: UserRow) => [u.id, u]));
  const leaderboard = Object.entries(byUser)
    .map(([userId, { correct, total }]) => ({
      userId,
      displayName:
        userMap[userId]?.displayName ??
        userMap[userId]?.name ??
        `User ${userId.slice(0, 6)}`,
      correct,
      total,
      score: correct * 1 + (total - correct) * 0.5,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  return (
    <div className="flex-1 overflow-y-auto">
      <main id="main" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        <section className="pebl-surface rounded-hero px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-[color:var(--primary)]">Community overview</p>
          <h1 className="mt-2 font-brand-heading text-3xl font-bold text-[color:var(--foreground)]">PEBL spotter leaderboard</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
            Reward regular participation, celebrate accurate observations, and highlight the community members helping shape the marine monitoring record.
          </p>
        </section>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">No entries yet. Sign in and submit an observation to appear on the PEBL leaderboard.</p>
        ) : (
          <div className="pebl-surface overflow-hidden rounded-card">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Top spotters ranked by score</caption>
              <thead>
                <tr className="border-b border-[color:var(--border)] text-xs uppercase tracking-eyebrow text-[color:var(--muted)]">
                  <th scope="col" className="px-4 py-3 w-12">Rank</th>
                  <th scope="col" className="px-4 py-3">Spotter</th>
                  <th scope="col" className="px-4 py-3 text-right">Score</th>
                  <th scope="col" className="px-4 py-3 text-right hidden sm:table-cell">Correct</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, i) => (
                  <tr
                    key={entry.userId}
                    className="border-b border-[color:var(--border)] last:border-b-0"
                  >
                    <td className="px-4 py-3 font-mono text-[color:var(--primary)]">#{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-[color:var(--foreground)]">{entry.displayName}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[color:var(--primary)]">{entry.score.toFixed(1)} pts</td>
                    <td className="px-4 py-3 text-right text-[color:var(--muted)] hidden sm:table-cell">{entry.correct}/{entry.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <section className="pebl-surface rounded-card px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-[color:var(--primary)]">Community guesses</p>
          <h2 className="mt-1 font-brand-heading text-2xl font-bold text-[color:var(--foreground)]">Most common species answers</h2>
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
