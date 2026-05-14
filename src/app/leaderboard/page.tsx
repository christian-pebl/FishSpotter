import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboard",
};

export default async function LeaderboardPage() {
  const answers = await prisma.answer.findMany({
    select: { userId: true, isCorrect: true },
  });
  const byUser: Record<string, { correct: number; total: number }> = {};
  for (const a of answers) {
    if (!byUser[a.userId]) byUser[a.userId] = { correct: 0, total: 0 };
    byUser[a.userId].total += 1;
    if (a.isCorrect) byUser[a.userId].correct += 1;
  }
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
        <section className="pebl-surface rounded-[28px] px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--primary)]">Community overview</p>
          <h1 className="mt-2 font-brand-heading text-3xl font-bold text-[color:var(--foreground)]">PEBL spotter leaderboard</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
            Reward regular participation, celebrate accurate observations, and highlight the community members helping shape the marine monitoring record.
          </p>
        </section>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">No entries yet. Sign in and submit an observation to appear on the PEBL leaderboard.</p>
        ) : (
          <div className="pebl-surface overflow-hidden rounded-[22px]">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Top spotters ranked by score</caption>
              <thead>
                <tr className="border-b border-[color:var(--border)] text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">
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
      </main>
    </div>
  );
}
