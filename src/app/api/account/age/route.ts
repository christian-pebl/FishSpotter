/**
 * POST /api/account/age, declare an age band, once.
 *
 * Asked by AgeCheck of any signed-in account with no band on record (every
 * account made before 16 Sep 2026, and OAuth signups). The band cannot be
 * changed here afterwards: a child who could re-answer could undo every rule
 * that depends on it. Corrections go through hello@pebl-cic.co.uk.
 *
 * What each answer does, beyond storing the band:
 *   18_plus   nothing else.
 *   13_17     leaves the public leaderboard (the under-18 default; they can
 *             switch it back on in account settings).
 *   under_13  COPPA: we hold personal information a child gave without a
 *             parent's consent, so it goes now. Their own email address,
 *             password, pending email links and any social sign-in link are
 *             removed, and so are any comments they wrote, since free text
 *             can carry a name or address, and any usage events, which rest
 *             on a consent a child cannot give. A display name they typed is
 *             swapped for a generated nickname, since a typed name can be a
 *             child's real one. Their finds and points stay, so the child
 *             loses nothing; a parent's consent saves the account from here
 *             (src/lib/parental-consent.ts).
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { AGE_BANDS, isPlaceholderEmail, parseAgeBand } from "@/lib/age";
import { stripContactOps } from "@/lib/child-contact";
import { generateNickname, isGeneratedNickname } from "@/lib/nickname";

export const dynamic = "force-dynamic";

const Schema = z.object({ ageBracket: z.enum(AGE_BANDS) });

export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let parsed;
  try {
    parsed = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Choose one of the options." }, { status: 400 });
  }
  if (!(await checkAuthRateLimit(`age:${userId}`))) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  }

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, ageBracket: true, displayName: true },
  });
  if (!me) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const existing = parseAgeBand(me.ageBracket);
  if (existing) {
    // Already answered (perhaps on another device). Nothing changes; the
    // client refreshes its session and the question goes away.
    return NextResponse.json({ ok: true, ageBand: existing, alreadySet: true });
  }

  const band = parsed.ageBracket;
  const now = new Date();

  if (band === "under_13") {
    const hadEmail = !isPlaceholderEmail(me.email);
    const newNickname = isGeneratedNickname(me.displayName ?? "") ? null : generateNickname();
    await prisma.$transaction(
      stripContactOps(prisma, userId, {
        asChild: true,
        data: {
          ageBracket: band,
          ageDeclaredAt: now,
          leaderboardOptIn: false,
          // Their address is gone now, so a pending removal notice is done.
          ageNoticeSentAt: null,
          ...(newNickname ? { displayName: newNickname, name: newNickname } : {}),
        },
      }),
    );
    return NextResponse.json({
      ok: true,
      ageBand: band,
      removedEmail: hadEmail,
      newNickname,
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      ageBracket: band,
      ageDeclaredAt: now,
      ...(band === "13_17" ? { leaderboardOptIn: false } : {}),
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, ageBand: band });
}
