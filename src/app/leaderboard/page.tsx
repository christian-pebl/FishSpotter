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
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        <h1 className="text-2xl font-bold mb-2">Top spotters</h1>
        <p className="text-slate-400 mb-6">
          Points for correct answers and participation. Top spotters may receive local vouchers or PEBL discounts – details TBC.
        </p>
        <ul className="space-y-2">
          {leaderboard.map((entry: { userId: string; displayName: string; correct: number; total: number; score: number }, i: number) => (
            <li
              key={entry.userId}
              className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
            >
              <span className="text-slate-500 w-8 font-mono">#{i + 1}</span>
              <span className="font-medium flex-1">{entry.displayName}</span>
              <span className="text-cyan-400">{entry.score.toFixed(1)} pts</span>
              <span className="text-slate-500 text-sm">{entry.correct}/{entry.total} correct</span>
            </li>
          ))}
        </ul>
        {leaderboard.length === 0 && (
          <p className="text-slate-500">No entries yet. Sign in and submit answers to appear here.</p>
        )}
      </main>
    </div>
  );
}
