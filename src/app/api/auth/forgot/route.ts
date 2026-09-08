/**
 * POST /api/auth/forgot, password-reset request (S3-04).
 *
 * Returns 200 with the same `{ ok: true }` body regardless of whether
 * the email exists, standard email-enumeration mitigation. Real users
 * receive an email with a one-time, hash-at-rest token (1h TTL).
 *
 * One exception, which leaks nothing: when the email provider is not
 * configured at all, the answer is a 503 carrying EMAIL_UNAVAILABLE_MESSAGE
 * for EVERY address, before any lookup. "Check your inbox" for a link that
 * cannot be sent is the failure the 8 Sep 2026 support message described,
 * and an unconfigured provider is the same for everyone, so saying so tells
 * an attacker nothing about which accounts exist. A per-send provider failure
 * for a real account is still answered with the generic 200 (a 503 only for
 * existing addresses would be an oracle), and logged for /admin/email.
 */

import { SITE_URL } from "@/lib/site-url";
import { NextResponse } from "next/server";
import { z } from "zod";
import { PasswordResetEmail } from "@/lib/email/templates/PasswordResetEmail";
import { sendEmail } from "@/lib/email/send";
import { isEmailConfigured } from "@/lib/email/client";
import {
  EMAIL_UNAVAILABLE_CODE,
  EMAIL_UNAVAILABLE_MESSAGE,
  wasSent,
} from "@/lib/email/outcome";
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
    SITE_URL;
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

  // Before the rate limit and before any lookup: see the header comment.
  if (!isEmailConfigured()) {
    // eslint-disable-next-line no-console
    console.error("[auth/forgot] email is not configured; no reset link can be sent");
    return NextResponse.json(
      { ok: false, code: EMAIL_UNAVAILABLE_CODE, error: EMAIL_UNAVAILABLE_MESSAGE },
      { status: 503 },
    );
  }

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

  const result = await sendEmail({
    to: email,
    subject: "Reset your PEBL FishSpotter password",
    react: PasswordResetEmail({
      displayName: user.displayName ?? user.name ?? "Spotter",
      resetUrl: resetUrl(plain),
    }),
  });
  if (!wasSent(result)) {
    // The token row is kept: an operator can construct the link from it by
    // hand for a spotter who writes in.
    // eslint-disable-next-line no-console
    console.error("[auth/forgot] reset email not delivered", {
      userId: user.id,
      error: result.error,
    });
  }

  return NextResponse.json({ ok: true });
}
