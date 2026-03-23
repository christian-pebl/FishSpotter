import Link from "next/link";
import { prisma } from "@/lib/prisma";

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
    select: { id: true, displayName: true, name: true, email: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const leaderboard = Object.entries(byUser)
    .map(([userId, { correct, total }]) => ({
      userId,
      displayName: userMap[userId]?.displayName ?? userMap[userId]?.name ?? userMap[userId]?.email?.split("@")[0] ?? "Anonymous",
      correct,
      total,
      score: correct * 1 + (total - correct) * 0.5,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  return (
    <div className="flex-1 overflow-y-auto">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
        <section className="pebl-surface rounded-[28px] px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--primary)]">Community overview</p>
          <h1 className="mt-2 font-brand-heading text-3xl text-[color:var(--foreground)]">PEBL spotter leaderboard</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
            Reward regular participation, celebrate accurate observations, and highlight the community members helping shape the marine monitoring record.
          </p>
        </section>
        <ul className="space-y-2">
          {leaderboard.map((entry: { userId: string; displayName: string; correct: number; total: number; score: number }, i: number) => (
            <li
              key={entry.userId}
              className="pebl-surface flex items-center gap-4 rounded-[22px] p-4"
            >
              <span className="w-10 rounded-full bg-[color:var(--surface-muted)] px-2 py-2 text-center font-mono text-sm text-[color:var(--primary)]">#{i + 1}</span>
              <span className="flex-1 font-medium text-[color:var(--foreground)]">{entry.displayName}</span>
              <span className="font-semibold text-[color:var(--primary)]">{entry.score.toFixed(1)} pts</span>
              <span className="text-sm text-[color:var(--muted)]">{entry.correct}/{entry.total} correct</span>
            </li>
          ))}
        </ul>
        {leaderboard.length === 0 && (
          <p className="text-sm text-[color:var(--muted)]">No entries yet. Sign in and submit an observation to appear on the PEBL leaderboard.</p>
        )}
      </main>
    </div>
  );
}
