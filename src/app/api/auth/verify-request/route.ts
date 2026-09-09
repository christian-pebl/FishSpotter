/**
 * POST /api/auth/verify-request, resend a verification email (S3-06).
 *
 * Authenticated. If the calling user's email isn't yet verified, mints a fresh
 * token and sends the email. Rate-limited per user (checkAuthRateLimit: 5 in
 * 15 minutes) so a stuck loop can't burn the SendGrid quota.
 *
 * Answers 200 ONLY when the provider accepted the message. When email is not
 * configured, or SendGrid rejects the send, it answers 503 carrying
 * EMAIL_UNAVAILABLE_MESSAGE, so the client can tell the person the truth and
 * how to get help. Until 8 Sep 2026 it answered 200 regardless, and a new
 * spotter pressed "resend" for days while the app said "Email sent".
 *
 * Earlier outstanding tokens are left alone. They used to be stamped consumed
 * on every resend ("kept as audit trail"), which killed the link in an email
 * that was merely slow to arrive, and made a resend indistinguishable from a
 * click in the delivery figures on /admin/email. A token is 256 random bits
 * and expires in 24 hours; several live at once is not a risk.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email/dispatch";
import { isEmailConfigured } from "@/lib/email/client";
import {
  EMAIL_UNAVAILABLE_CODE,
  EMAIL_UNAVAILABLE_MESSAGE,
  resendStatusFor,
  sendOutcome,
} from "@/lib/email/outcome";
import { assertSameOrigin } from "@/lib/csrf";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function unavailable() {
  return NextResponse.json(
    { ok: false, code: EMAIL_UNAVAILABLE_CODE, error: EMAIL_UNAVAILABLE_MESSAGE },
    { status: 503 },
  );
}

export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Checked before the rate limit: an unconfigured provider gives the same
  // answer every time, and five honest 503s must not turn into a 429 that
  // hides the reason behind "try again later".
  if (!isEmailConfigured()) {
    // eslint-disable-next-line no-console
    console.error("[verify-request] email is not configured; nothing can be sent");
    return unavailable();
  }

  if (!(await checkAuthRateLimit(`verify-resend:${session.user.id}`))) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, displayName: true, name: true, emailVerified: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.emailVerified) return NextResponse.json({ ok: true, already: true });

  const result = await sendVerificationEmail(
    user.id,
    user.email,
    user.displayName ?? user.name ?? "Spotter",
  );
  const outcome = sendOutcome(result);
  if (resendStatusFor(outcome) !== 200) {
    // eslint-disable-next-line no-console
    console.error("[verify-request] verification email not delivered", {
      userId: user.id,
      outcome,
      error: result.error,
    });
    return unavailable();
  }
  return NextResponse.json({ ok: true });
}
