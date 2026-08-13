/**
 * GET /api/account/new-clips/unsubscribe?u={userId}&t={hmac}. One-click
 * unsubscribe from new-clip alerts (PECR Reg. 22).
 *
 * No session required by design: the user is in their email client. Mirrors
 * the digest unsubscribe route exactly, but on its own token namespace so it
 * cannot silence the weekly digest as a side effect.
 */

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { newClipsUnsubscribeToken } from "@/lib/email/unsubscribe";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("u");
  const token = searchParams.get("t");
  if (!userId || !token) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }
  let expected: string;
  try {
    expected = newClipsUnsubscribeToken(userId);
  } catch {
    return NextResponse.json({ error: "Service misconfigured" }, { status: 503 });
  }
  const expectedBuf = Buffer.from(expected);
  const tokenBuf = Buffer.from(token);
  if (
    expectedBuf.length !== tokenBuf.length ||
    !timingSafeEqual(expectedBuf, tokenBuf)
  ) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  await prisma.user.update({
    where: { id: userId },
    data: { newClipsOptIn: false },
  });
  return NextResponse.redirect(new URL("/?unsubscribed=clips", req.url));
}
