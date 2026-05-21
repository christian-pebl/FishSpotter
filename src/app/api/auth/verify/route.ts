/**
 * POST /api/auth/verify — consume an email-verification token (S3-07).
 *
 * Body: { token }. Validates the SHA-256 hash in VerificationToken
 * (not consumed, not expired), sets User.emailVerified = now, marks
 * the token consumed. Returns 200 with { ok: true } on success and
 * 410 Gone for invalid / expired / already-consumed tokens.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { hashToken } from "@/lib/auth/tokens";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const Schema = z.object({ token: z.string().min(32).max(128) });

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
  const row = await prisma.verificationToken.findUnique({
    where: { token: hashed },
  });
  if (!row || row.consumedAt || row.expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "This verification link is invalid or has expired." },
      { status: 410 },
    );
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
