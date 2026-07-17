/**
 * POST /api/guest/claim — a guest attaches a real email to save their account.
 *
 * Zero-friction play mints a username-only guest (see the guest branch in
 * src/lib/auth.ts). Their Answer rows + leaderboard rank already persist; this
 * route lets them CLAIM that account by adding an email, so they can return to
 * it. We set the email, flip isGuest -> false, and mail a one-time link to set
 * a password (reusing the password-reset token flow). The client then calls
 * session.update() so the live JWT drops isGuest and the save-prompt stops.
 *
 * Email-only by design: no password is required at the prompt (lowest friction).
 */

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
import {
  PASSWORD_RESET_TOKEN_TTL_MS,
  generateToken,
  hashToken,
} from "@/lib/auth/tokens";

export const dynamic = "force-dynamic";

const Schema = z.object({ email: z.string().email().max(254) });

function setupUrl(plainToken: string): string {
  const base = process.env.NEXTAUTH_URL ?? "https://fish-spotter.vercel.app";
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
  if (!checkAuthRateLimit(`claim:${ip}`)) {
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
    // Already a full account — nothing to claim.
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

  // Mail a one-time link to set a password (finishes the account). Fire-and-
  // forget style: a mail-provider blip shouldn't lose the claim — the email is
  // now saved and they can use "forgot password" to finish later.
  try {
    const plain = generateToken();
    const token = hashToken(plain);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);
    await prisma.passwordResetToken.create({
      data: { userId: updated.id, token, expiresAt },
    });
    await sendEmail({
      to: email,
      subject: "Finish setting up your PEBL FishSpotter account",
      react: PasswordResetEmail({
        displayName: updated.displayName ?? updated.name ?? "Spotter",
        resetUrl: setupUrl(plain),
      }),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[guest/claim] setup email failed", err);
  }

  return NextResponse.json({ ok: true });
}
