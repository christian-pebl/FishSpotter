/**
 * POST /api/account/onboarding — record that the user has dismissed
 * the first-run tour (S3-11). Idempotent: re-posting from a stale
 * client is a no-op.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await prisma.user.updateMany({
    where: { id: session.user.id, onboardedAt: null },
    data: { onboardedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
