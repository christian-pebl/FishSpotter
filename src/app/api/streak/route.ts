import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { datesFromAnswers, readStreak } from "@/lib/streak-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ currentStreak: 0, lastActivityDate: null });
  }

  const answers = await prisma.answer.findMany({
    where: { userId: session.user.id },
    select: { createdAt: true },
    // Hardening: bound the per-user history scan (see POST /api/answers).
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  // Freeze-aware (read-only): held/spent Tide Freezes keep the streak alive
  // across a missed day; a read never spends one.
  const currentStreak = await readStreak(
    prisma,
    session.user.id,
    datesFromAnswers(answers),
  );
  return NextResponse.json({ currentStreak });
}
