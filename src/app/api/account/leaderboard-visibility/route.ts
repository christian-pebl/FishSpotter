/**
 * PATCH /api/account/leaderboard-visibility, toggle leaderboardOptIn.
 *
 * ICO Children's Code: declared 13-17 minors default to OFF the public
 * leaderboard at signup and can switch it on here. Under-13s, and anyone not
 * yet asked their age, can only switch it off (src/lib/age.ts,
 * canChooseLeaderboardVisibility). Mirrors the digest opt-in route.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { canChooseLeaderboardVisibility } from "@/lib/age";

export const dynamic = "force-dynamic";

const Schema = z.object({ leaderboardOptIn: z.boolean() });

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
  if (parsed.leaderboardOptIn) {
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { ageBracket: true },
    });
    if (!canChooseLeaderboardVisibility(me?.ageBracket)) {
      return NextResponse.json(
        { error: "Under-13s are never shown publicly." },
        { status: 403 },
      );
    }
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: { leaderboardOptIn: parsed.leaderboardOptIn },
  });
  return NextResponse.json({ ok: true, leaderboardOptIn: parsed.leaderboardOptIn });
}
