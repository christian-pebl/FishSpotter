import { NextResponse } from "next/server";
import { isAuthorisedCron } from "@/lib/cron-auth";
import { rescoreConsensus } from "@/lib/consensus";
import { recomputeTrustScores } from "@/lib/trust";
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
  // Trust runs AFTER consensus so every reached camp already has a fresh
  // ConsensusEvent row (achievedAt) for this run's decay weighting (Pebbles
  // anti-gaming Plan 1 Phase 1, docs/pebbles-anti-gaming-and-prizes-plan.md).
  const trust = await recomputeTrustScores(prisma);
  return NextResponse.json({ ok: true, ...result, trust });
}
