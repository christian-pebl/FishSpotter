import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rankSpotters } from "@/lib/leaderboard";

// S4-02 + Batch D1: the anonymous JSON payload is identical for every caller
// and changes slowly, so cache it for 60s (mirrors the /leaderboard page
// route, which moved to ISR). This replaces force-dynamic.
export const revalidate = 60;

// S7-T1: ranking sums Answer.points instead of the old (audit-flagged)
// `correct + 0.5*wrong` formula. Ranking itself now goes through the shared
// rankSpotters() helper (previously this route hand-rolled its own `.sort()`
// with no minimum-answers floor and no accuracy tiebreak, so it could
// silently disagree with the /leaderboard page on ordering and on who
// qualifies). This is the single source of truth for both.
//
// Batch D1: the previous implementation did `answer.findMany({ select: ... })`
// over the ENTIRE Answer table and aggregated in JS (a full-table scan). It
// now does SQL-side aggregation, matching the page route:
//   1) groupBy({ by: userId }) summing points + counting all rows (ranking)
//   2) groupBy({ by: userId, where: isCorrect:true }) counting correct rows
//   3) findMany Users by id IN (...) for display names + opt-in filtering
// Three queries regardless of how many answers exist.
export async function GET() {
  type CountRow = { userId: string; _sum: { points: number | null }; _count: { _all: number } };
  type CorrectRow = { userId: string; _count: { _all: number } };

  const [perUser, perUserCorrect] = await Promise.all([
    prisma.answer.groupBy({
      by: ["userId"],
      _sum: { points: true },
      _count: { _all: true },
    }),
    prisma.answer.groupBy({
      by: ["userId"],
      where: { isCorrect: true },
      _count: { _all: true },
    }),
  ]);

  const correctByUser: Record<string, number> = {};
  for (const row of perUserCorrect as CorrectRow[]) {
    correctByUser[row.userId] = row._count._all;
  }

  const byUser: Record<
    string,
    { correct: number; total: number; points: number }
  > = {};
  for (const row of perUser as CountRow[]) {
    byUser[row.userId] = {
      total: row._count._all,
      correct: correctByUser[row.userId] ?? 0,
      points: row._sum.points ?? 0,
    };
  }

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

  // ICO Children's Code: this public JSON endpoint has no session, so it
  // excludes every user who opted out of the public leaderboard (default
  // for declared 13-17 minors).
  for (const userId of Object.keys(byUser)) {
    if (userMap[userId]?.leaderboardOptIn === false) {
      delete byUser[userId];
    }
  }

  const ranked = rankSpotters(
    Object.entries(byUser).map(([userId, { correct, total, points }]) => ({
      userId,
      correct,
      total,
      points,
    })),
  );

  const leaderboard = ranked.slice(0, 50).map((r) => ({
    // userId is kept: the /u/[id] profile route already makes the cuid a
    // public identifier (it is the URL segment), so omitting it here would
    // hide nothing, and a client could legitimately link a row to a profile.
    userId: r.userId,
    displayName:
      userMap[r.userId]?.displayName ??
      userMap[r.userId]?.name ??
      `User ${r.userId.slice(0, 6)}`,
    correct: r.correct,
    total: r.total,
    points: r.points ?? 0,
    score: r.score,
    rank: r.rank,
  }));

  return NextResponse.json({ leaderboard });
}
