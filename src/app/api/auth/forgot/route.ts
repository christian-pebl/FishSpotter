/**
 * POST /api/auth/forgot — password-reset request (S3-04).
 *
 * Returns 200 with the same `{ ok: true }` body regardless of whether
 * the email exists — standard email-enumeration mitigation. Real users
 * receive an email with a one-time, hash-at-rest token (1h TTL).
 * If SENDGRID_API_KEY isn't configured, the token is still persisted; an
 * operator can read the DB row to construct the URL during the
 * transitional period before email (SendGrid) setup is complete.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { PasswordResetEmail } from "@/lib/email/templates/PasswordResetEmail";
import { sendEmail } from "@/lib/email/send";
import {
  PASSWORD_RESET_TOKEN_TTL_MS,
  generateToken,
  hashToken,
} from "@/lib/auth/tokens";
import { assertSameOrigin } from "@/lib/csrf";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { clientIpKey } from "@/lib/client-ip";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const Schema = z.object({ email: z.string().email().max(254) });

function resetUrl(plainToken: string): string {
  const base =
    process.env.NEXTAUTH_URL ?? "https://fish-spotter.vercel.app";
  return `${base.replace(/\/$/, "")}/auth/reset/${plainToken}`;
}

export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  let parsed;
  try {
    parsed = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const email = parsed.email.trim().toLowerCase();

  const ip = clientIpKey(req);
  if (!(await checkAuthRateLimit(`forgot:${ip}:${email}`))) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Enumeration mitigation: same body for unknown emails.
    return NextResponse.json({ ok: true });
  }

  const plain = generateToken();
  const token = hashToken(plain);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  await sendEmail({
    to: email,
    subject: "Reset your PEBL FishSpotter password",
    react: PasswordResetEmail({
      displayName: user.displayName ?? user.name ?? "Spotter",
      resetUrl: resetUrl(plain),
    }),
  });

  return NextResponse.json({ ok: true });
}
