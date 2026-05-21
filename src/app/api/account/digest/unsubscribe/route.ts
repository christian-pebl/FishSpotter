/**
 * GET /api/account/digest/unsubscribe?u={userId}&t={hmac} — one-click
 * unsubscribe from the weekly digest (S3-16, PECR Reg. 22).
 *
 * No session required by design: the user is in their email client.
 * Token derivation lives in src/lib/email/unsubscribe.ts so route
 * files only export HTTP handlers (Next.js requirement).
 */

import { NextResponse } from "next/server";
import { digestUnsubscribeToken } from "@/lib/email/unsubscribe";
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
    expected = digestUnsubscribeToken(userId);
  } catch {
    return NextResponse.json({ error: "Service misconfigured" }, { status: 503 });
  }
  if (expected !== token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  await prisma.user.update({
    where: { id: userId },
    data: { digestOptIn: false },
  });
  return NextResponse.redirect(new URL("/?unsubscribed=1", req.url));
}
