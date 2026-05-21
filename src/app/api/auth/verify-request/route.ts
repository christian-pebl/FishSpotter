/**
 * POST /api/auth/verify-request — resend a verification email (S3-06).
 *
 * Authenticated. If the calling user's email isn't yet verified,
 * mints a fresh token, marks any prior outstanding tokens consumed
 * (kept as audit trail), sends the email. Rate-limited to 3/hour
 * per user so we don't burn the Resend free-tier on a stuck loop.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email/dispatch";
import { assertSameOrigin } from "@/lib/csrf";
import { checkAuthRateLimit } from "@/lib/rate-limit";
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
  if (!checkAuthRateLimit(`verify-resend:${session.user.id}`)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, displayName: true, name: true, emailVerified: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.emailVerified) return NextResponse.json({ ok: true, already: true });

  await prisma.verificationToken.updateMany({
    where: { userId: user.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  await sendVerificationEmail(
    user.id,
    user.email,
    user.displayName ?? user.name ?? "Spotter",
  );
  return NextResponse.json({ ok: true });
}
