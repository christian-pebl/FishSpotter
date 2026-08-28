/**
 * PATCH /api/account/new-clips. Toggles newClipsOptIn (2026-08-13).
 *
 * Mirrors /api/account/digest. Called from account settings AND from the
 * end-of-feed card, which is the moment a spotter most wants this on: they
 * have just run out of clips.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const Schema = z.object({ newClipsOptIn: z.boolean() });

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
    parsed = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  // Opting IN also resets the outbound watermark to now, so switching the
  // setting on never triggers a backfill email about clips that landed while
  // it was off. Opting out leaves the stamp alone.
  await prisma.user.update({
    where: { id: session.user.id },
    data: parsed.newClipsOptIn
      ? { newClipsOptIn: true, lastNewClipsNotifiedAt: new Date() }
      : { newClipsOptIn: false },
  });
  return NextResponse.json({ ok: true, newClipsOptIn: parsed.newClipsOptIn });
}
