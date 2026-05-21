/**
 * GET /api/account/export — GDPR Art. 20 right-to-portability
 * (S6-T14). Authenticated. Returns a JSON file with everything we
 * hold on the signed-in user. Streaming a ZIP would be nicer but
 * JSON is plenty for the scope (account + answers only, no
 * binary uploads).
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const [user, answers] = await Promise.all([
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
  ]);
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const payload = {
    exportedAt: new Date().toISOString(),
    notice:
      "This file contains all personal data PEBL FishSpotter holds about you. See /privacy for retention and contact details.",
    account: user,
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
