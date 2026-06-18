import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// The signed-in user's running Pebble total (sum of Answer.points) — the
// absolute count the header's Pebble bag shows on load. Private, never cached.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ total: 0, authed: false });
  }
  const totals = await prisma.answer.aggregate({
    _sum: { points: true },
    where: { userId: session.user.id },
  });
  return NextResponse.json({ total: totals._sum.points ?? 0, authed: true });
}
