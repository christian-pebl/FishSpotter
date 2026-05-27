import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// S7-T1: ranking now sums Answer.points instead of using a hand-rolled
// (and audit-flagged) `correct + 0.5*wrong` formula. The page route at
// /leaderboard uses the same scoring; this JSON endpoint mirrors it so
// any external integrators see consistent numbers.
export async function GET() {
  const answers = await prisma.answer.findMany({
    select: { userId: true, isCorrect: true, points: true },
  });

  const byUser: Record<
    string,
    { correct: number; total: number; points: number }
  > = {};
  for (const a of answers) {
    if (!byUser[a.userId])
      byUser[a.userId] = { correct: 0, total: 0, points: 0 };
    byUser[a.userId].total += 1;
    byUser[a.userId].points += a.points;
    if (a.isCorrect === true) byUser[a.userId].correct += 1;
  }

  const users = await prisma.user.findMany({
    where: { id: { in: Object.keys(byUser) } },
    select: { id: true, displayName: true, name: true },
  });
  type UserRow = { id: string; displayName: string | null; name: string | null };
  const userMap = Object.fromEntries(users.map((u: UserRow) => [u.id, u]));

  const leaderboard = Object.entries(byUser)
    .map(([userId, { correct, total, points }]) => ({
      userId,
      displayName:
        userMap[userId]?.displayName ??
        userMap[userId]?.name ??
        `User ${userId.slice(0, 6)}`,
      correct,
      total,
      points,
      score: points,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  return NextResponse.json({ leaderboard });
}
