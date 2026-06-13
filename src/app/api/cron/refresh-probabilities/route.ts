import { NextResponse } from "next/server";
import { isAuthorisedCron } from "@/lib/cron-auth";
import {
  refreshNameMap,
  refreshProbabilityBuckets,
} from "@/lib/biodiversity/refresh";

export const dynamic = "force-dynamic";
// Vercel serverless function budget — keep the loop bounded so we always exit
// cleanly even on a slow OBIS day.
export const maxDuration = 60;

// Cap per invocation so the function stays well inside `maxDuration`.
// With ~1.1s throttle + 1-3s OBIS query, 20 buckets ≈ 30-50s.
const MAX_BUCKETS_PER_RUN = 20;

export async function GET(req: Request) {
  if (!isAuthorisedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const buckets = await refreshProbabilityBuckets({
    staleOnly: true,
    maxBuckets: MAX_BUCKETS_PER_RUN,
  });
  const names = await refreshNameMap({});

  return NextResponse.json({
    ok: true,
    buckets,
    names,
  });
}
