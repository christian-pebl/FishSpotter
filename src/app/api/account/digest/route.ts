/**
 * PATCH /api/account/digest, toggle digestOptIn (S3-12 / S3-16).
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { canReceiveOptionalEmail } from "@/lib/age";

export const dynamic = "force-dynamic";

const Schema = z.object({ digestOptIn: z.boolean() });

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
  // Optional emails need a declared age of 13 or over (src/lib/age.ts).
  if (parsed.digestOptIn) {
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { ageBracket: true },
    });
    if (!canReceiveOptionalEmail(me?.ageBracket)) {
      return NextResponse.json(
        { error: "These emails are for spotters aged 13 and over who have told us their age." },
        { status: 403 },
      );
    }
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: { digestOptIn: parsed.digestOptIn },
  });
  return NextResponse.json({ ok: true, digestOptIn: parsed.digestOptIn });
}
