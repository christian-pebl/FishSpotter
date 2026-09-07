import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIpKey } from "@/lib/client-ip";
import { checkPublicStatsRateLimit } from "@/lib/rate-limit";
import { loadPublicStats } from "@/lib/public-stats";

// Public, read-only headline numbers: clips, species, identifications,
// spotters and the farm roll-up, the same figures the landing page prints,
// as JSON with no token. Built so a newsletter, the PEBL website or a Claude
// session can quote the live numbers without a database credential. Every
// field is a count or a farm name; nothing here identifies a person or a
// clip. The detailed roundup stays token-gated on /api/metrics/summary.
//
// Cached at the CDN for five minutes (and served stale for an hour while it
// revalidates), so a burst of readers costs one query. The per-IP cap behind
// that only ever bites a caller varying the query string to dodge the cache.
export const dynamic = "force-dynamic";

const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=3600";

export async function GET(req: Request) {
  if (!(await checkPublicStatsRateLimit(clientIpKey(req)))) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a while." },
      { status: 429 },
    );
  }

  const stats = await loadPublicStats(prisma);
  return NextResponse.json(stats, {
    headers: {
      "Cache-Control": CACHE_CONTROL,
      "Access-Control-Allow-Origin": "*",
    },
  });
}
