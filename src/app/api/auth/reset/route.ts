/**
 * POST /api/auth/reset — consume a password-reset token (S3-05).
 *
 * Body: { token, newPassword }. Validates the SHA-256 hash exists in
 * PasswordResetToken with consumedAt IS NULL and expiresAt > now,
 * hashes the new password with bcrypt(12) to match the signup code
 * path, marks the token consumed in the same transaction.
 *
 * Limitation: under the JWT session strategy, this does not revoke
 * active sessions on other devices until JWT expiry. Documented for
 * Sprint 6+ when the Session table goes active.
 */

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { hashToken } from "@/lib/auth/tokens";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD = 8;

const Schema = z.object({
  token: z.string().min(32).max(128),
  newPassword: z.string().min(MIN_PASSWORD).max(128),
});

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

  const hashed = hashToken(parsed.token);
  const row = await prisma.passwordResetToken.findUnique({
    where: { token: hashed },
  });
  if (!row || row.consumedAt || row.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 410 });
  }

  const passwordHash = await bcrypt.hash(parsed.newPassword, BCRYPT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
