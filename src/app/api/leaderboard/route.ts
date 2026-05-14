import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
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

  return NextResponse.json({ leaderboard });
}
