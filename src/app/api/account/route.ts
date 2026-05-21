/**
 * PATCH /api/account     — update display name (S3-12)
 * DELETE /api/account    — GDPR Art. 17 erasure (S3-12)
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  displayName: z.string().min(1).max(32),
});

export async function PATCH(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let parsed;
  try {
    parsed = PatchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  // Same sanitiser used at sign-up so display names stay tidy.
  const clean = parsed.displayName.trim().replace(/[^\p{L}\p{N}\s._-]/gu, "");
  if (!clean) {
    return NextResponse.json({ error: "Display name can't be empty." }, { status: 400 });
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: { displayName: clean },
  });
  return NextResponse.json({ ok: true, displayName: clean });
}

export async function DELETE(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  await prisma.user.delete({ where: { id: userId } });
  // eslint-disable-next-line no-console
  console.log(`[gdpr] User ${userId} deleted at ${new Date().toISOString()}`);
  return NextResponse.json({ ok: true });
}
