import { NextResponse } from "next/server";
import { isAuthorisedBearer } from "@/lib/cron-auth";
import { checkPrizeDeskRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { loadPrizeWinnerRows, toPrizeDeskSummary } from "@/lib/prize-desk";

// Token-gated (PRIZE_DESK_TOKEN, deliberately its own secret rather than
// reusing METRICS_TOKEN or CRON_SECRET, so access rotates independently),
// remote-safe mirror of /admin/prizes for a Claude Code session that has no
// browser and no DB credentials (CLAUDE.md's "stats via Claude Code" pattern,
// extended 1 Aug 2026 to the prize desk).
//
// UNLIKE /api/metrics/summary, this is NOT aggregate-only: the whole point of
// the desk is contacting a specific spotter, so real emails travel in the
// response. Treat PRIZE_DESK_TOKEN like a password — anyone holding it can
// read every winner's email. That's why the rate limit here (12/hour) is far
// tighter than metrics' (60/hour), and why this never logs its own response
// body. requireAdminSession() is NOT used — there is no browser session on a
// bearer-token request; the token itself is the credential.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  if (!isAuthorisedBearer(req, process.env.PRIZE_DESK_TOKEN)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate-limit on the token itself (not IP — same rationale as metrics: a
  // token-gated route has no meaningful per-visitor identity). Checked after
  // auth so a wrong token can't burn budget probing.
  if (!(await checkPrizeDeskRateLimit(process.env.PRIZE_DESK_TOKEN as string))) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a while." },
      { status: 429 },
    );
  }

  const rows = await loadPrizeWinnerRows(prisma, new Date());
  const summary = toPrizeDeskSummary(rows);

  return NextResponse.json({ generatedAt: new Date().toISOString(), ...summary });
}
