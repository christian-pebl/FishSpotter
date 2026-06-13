import { NextResponse } from "next/server";
import { isAuthorisedCron } from "@/lib/cron-auth";
import { rescoreConsensus } from "@/lib/consensus";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
// Cheap query at project scale (tens of thousands of answers max). Keep
// the function budget conservative so a slow DB doesn't blow past Vercel.
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!isAuthorisedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await rescoreConsensus(prisma);
  return NextResponse.json({ ok: true, ...result });
}
