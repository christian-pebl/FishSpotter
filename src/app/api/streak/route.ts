import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeStreakFromAnswers } from "@/lib/streak";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ currentStreak: 0, lastActivityDate: null });
  }

  const answers = await prisma.answer.findMany({
    where: { userId: session.user.id },
    select: { createdAt: true },
  });

  return NextResponse.json(computeStreakFromAnswers(answers));
}
