import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { walletState } from "@/lib/shop/wallet";

// The signed-in user's Pebble balances: what the header's Pebble bag shows on
// load. Returns both EARNED (lifetime sum of Answer.points, the leaderboard
// score) and the spendable WALLET (earned - shop spend). Private, never cached.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ total: 0, earned: 0, spent: 0, wallet: 0, authed: false });
  }
  const [pointsAgg, purchases] = await Promise.all([
    prisma.answer.aggregate({
      _sum: { points: true },
      where: { userId: session.user.id },
    }),
    prisma.pebblePurchase.findMany({
      where: { userId: session.user.id },
      select: { pebbleCost: true },
    }),
  ]);
  const earned = pointsAgg._sum.points ?? 0;
  const { spent, wallet } = walletState(earned, purchases);
  // `total` retained for backwards-compat with any older client; it now equals
  // the spendable wallet (what the bag renders).
  return NextResponse.json({ total: wallet, earned, spent, wallet, authed: true });
}
