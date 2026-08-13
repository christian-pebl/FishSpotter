/**
 * POST /api/account/feed-seen. Stamps lastFeedSeenAt (2026-08-13).
 *
 * Called when a spotter dismisses the "N new clips since your last visit"
 * banner. Deliberately an EXPLICIT dismiss rather than an automatic stamp on
 * feed load: a stamp-on-load would burn the notice on an accidental reload,
 * and the whole point of the banner is that a returning spotter actually
 * registers that there is new footage.
 *
 * Separate from the email watermark (lastNewClipsNotifiedAt) so dismissing the
 * banner never silently suppresses the email.
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
  await prisma.user.update({
    where: { id: session.user.id },
    data: { lastFeedSeenAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
