/**
 * POST /api/guest/claim, a guest attaches a real email to save their account.
 *
 * Zero-friction play mints a username-only guest (see the guest branch in
 * src/lib/auth.ts). Their Answer rows + leaderboard rank already persist; this
 * route lets them CLAIM that account by adding an email, so they can return to
 * it. We set the email, flip isGuest -> false, and mail a one-time link to set
 * a password (reusing the password-reset token flow). The client then calls
 * session.update() so the live JWT drops isGuest and the save-prompt stops.
 *
 * Email-only by design: no password is required at the prompt (lowest friction).
 *
 * The response carries `emailSent`. The claim itself succeeds whether or not
 * the link went out (the address is saved, and "forgot password" finishes the
 * job later), but the prompt must not say "check your inbox" for a message
 * that never left, so it reads this flag and says what actually happened.
 */

import { SITE_URL } from "@/lib/site-url";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/csrf";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { clientIpKey } from "@/lib/client-ip";
import { PasswordResetEmail } from "@/lib/email/templates/PasswordResetEmail";
import { sendEmail } from "@/lib/email/send";
import { wasSent } from "@/lib/email/outcome";
import {
  PASSWORD_RESET_TOKEN_TTL_MS,
  generateToken,
  hashToken,
} from "@/lib/auth/tokens";

export const dynamic = "force-dynamic";

const Schema = z.object({ email: z.string().email().max(254) });

function setupUrl(plainToken: string): string {
  const base = SITE_URL;
  return `${base.replace(/\/$/, "")}/auth/reset/${plainToken}`;
}

export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed;
  try {
    parsed = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const email = parsed.email.trim().toLowerCase();

  const ip = clientIpKey(req);
  if (!(await checkAuthRateLimit(`claim:${ip}`))) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  }

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, isGuest: true },
  });
  if (!me) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }
  if (!me.isGuest) {
    // Already a full account, nothing to claim.
    return NextResponse.json({ ok: true, alreadyClaimed: true });
  }

  // Collision: the email already belongs to another account. We don't merge
  // (guest answers would have to move across users); point them at sign-in.
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      {
        error:
          "That email already has a FishSpotter account. Sign in to use it.",
        code: "email_in_use",
      },
      { status: 409 },
    );
  }

  const updated = await prisma.user.update({
    where: { id: me.id },
    data: { email, isGuest: false, emailVerified: null },
    select: { id: true, displayName: true, name: true },
  });

  // Mail a one-time link to set a password (finishes the account). A mail
  // failure must not lose the claim: the email is saved and "forgot password"
  // can finish the job later, so the outcome is reported, not thrown.
  let emailSent = false;
  try {
    const plain = generateToken();
    const token = hashToken(plain);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);
    await prisma.passwordResetToken.create({
      data: { userId: updated.id, token, expiresAt },
    });
    const result = await sendEmail({
      to: email,
      subject: "Finish setting up your PEBL FishSpotter account",
      react: PasswordResetEmail({
        displayName: updated.displayName ?? updated.name ?? "Spotter",
        resetUrl: setupUrl(plain),
      }),
    });
    emailSent = wasSent(result);
    if (!emailSent) {
      // eslint-disable-next-line no-console
      console.error("[guest/claim] setup email not delivered", {
        userId: updated.id,
        error: result.error,
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[guest/claim] setup email failed", err);
  }

  return NextResponse.json({ ok: true, emailSent });
}
