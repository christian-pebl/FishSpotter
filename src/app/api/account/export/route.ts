/**
 * GET /api/account/export, GDPR Art. 20 right-to-portability
 * (S6-T14). Authenticated. Returns a JSON file with everything we
 * hold on the signed-in user. Streaming a ZIP would be nicer but
 * JSON is plenty for the scope (account + answers only, no
 * binary uploads).
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPlaceholderEmail } from "@/lib/age";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const [user, answers, consents] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        name: true,
        emailVerified: true,
        onboardedAt: true,
        digestOptIn: true,
        newClipsOptIn: true,
        leaderboardOptIn: true,
        ageBracket: true,
        ageDeclaredAt: true,
        isGuest: true,
        createdAt: true,
      },
    }),
    prisma.answer.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        snippetId: true,
        chosenOption: true,
        isCorrect: true,
        createdAt: true,
      },
    }),
    // A parent's address belongs to the parent, so the child's export says
    // only that a consent exists and when.
    prisma.parentalConsent.findMany({
      where: { childId: userId },
      select: { purpose: true, status: true, requestedAt: true, grantedAt: true },
    }),
  ]);
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const payload = {
    exportedAt: new Date().toISOString(),
    notice:
      "This file contains all personal data PEBL FishSpotter holds about you. See /privacy for retention and contact details.",
    account: {
      ...user,
      // A guest or under-13 account holds a placeholder, not an address.
      email: user.isGuest || isPlaceholderEmail(user.email) ? null : user.email,
    },
    parentalConsents: consents,
    answers,
  };
  const body = JSON.stringify(payload, null, 2);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="fishspotter-export-${userId}.json"`,
    },
  });
}
