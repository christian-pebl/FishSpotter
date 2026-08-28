import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// The signed-in user's Pebble total: what the header's Pebble bag shows on
// load. With the shop retired (20 Jul 2026) there is no spend, so the one
// number is lifetime EARNED (sum of Answer.points) — the same total that
// ranks the leaderboard and fills the prize progress bar. Private, never
// cached. `total` is the canonical field; `earned` is kept as an alias for
// any older client.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ total: 0, earned: 0, authed: false });
  }
  const pointsAgg = await prisma.answer.aggregate({
    _sum: { points: true },
    where: { userId: session.user.id },
  });
  const earned = pointsAgg._sum.points ?? 0;
  return NextResponse.json({ total: earned, earned, authed: true });
}
