import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function daysDiff(a: string, b: string): number {
  const d1 = parseDateKey(a).getTime();
  const d2 = parseDateKey(b).getTime();
  return Math.round((d1 - d2) / (24 * 60 * 60 * 1000));
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ currentStreak: 0, lastActivityDate: null });
  }

  const answers = await prisma.answer.findMany({
    where: { userId: session.user.id },
    select: { createdAt: true },
  });

  const dateSet = new Set<string>();
  for (const a of answers) {
    dateSet.add(toDateKey(a.createdAt));
  }
  const sortedDates = Array.from(dateSet).sort().reverse();
  if (sortedDates.length === 0) {
    return NextResponse.json({ currentStreak: 0, lastActivityDate: null });
  }

  const today = toDateKey(new Date());
  const yesterday = toDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));

  let streak = 0;
  const last = sortedDates[0];
  if (last !== today && last !== yesterday) {
    return NextResponse.json({
      currentStreak: 0,
      lastActivityDate: last,
    });
  }

  streak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    if (daysDiff(sortedDates[i - 1], sortedDates[i]) === 1) {
      streak++;
    } else {
      break;
    }
  }

  return NextResponse.json({
    currentStreak: streak,
    lastActivityDate: sortedDates[0],
  });
}
