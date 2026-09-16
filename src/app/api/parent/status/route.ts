/**
 * GET /api/parent/status, where the signed-in spotter's parent requests stand.
 *
 * { account: "none" | "pending" | "granted", prize: ... }. Read by the save
 * prompt and the prize card, which cannot rely on the session for this: the
 * parent answers on their own device, so the child's token never learns of it.
 * Carries no address, only states.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadConsentSummary } from "@/lib/parental-consent";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await loadConsentSummary(prisma, userId, new Date());
  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
}
