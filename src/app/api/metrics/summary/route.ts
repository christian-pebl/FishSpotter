import { NextResponse } from "next/server";
import { isAuthorisedBearer } from "@/lib/cron-auth";
import { checkMetricsRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { computeRoundup } from "@/lib/metrics/roundup";

// Token-gated (METRICS_TOKEN, deliberately separate from CRON_SECRET so
// access can be rotated independently of the crons), aggregate-only JSON
// dump of the same numbers `npm run db:stats` prints. Built so a remote
// Claude Code session — no .env.local, no DB credentials, network policy
// blocks the live app directly — can still answer "what are the latest
// stats?" without a human opening /admin/metrics by hand. See
// implementation/2026-08-01/metrics-access-plan.md for the full design.
//
// No individual is identifiable in the response: every field is a count, a
// sum, a median, or a share. The one spotter-level cut (First-Sighting
// concentration) reports a percentage, never a user id or name.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_WINDOW_DAYS = 365;

export async function GET(req: Request) {
  if (!isAuthorisedBearer(req, process.env.METRICS_TOKEN)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate-limit on the token itself (not IP — a token-gated route has no
  // meaningful per-visitor identity, and this is deliberately callable from
  // anywhere). Checked after auth so a wrong token can't burn budget probing.
  if (!(await checkMetricsRateLimit(process.env.METRICS_TOKEN as string))) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a while." },
      { status: 429 },
    );
  }

  const url = new URL(req.url);
  const daysParam = url.searchParams.get("days");
  let windowDays = 30;
  if (daysParam !== null) {
    const parsed = Number(daysParam);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_WINDOW_DAYS) {
      return NextResponse.json(
        { error: `days must be a number between 1 and ${MAX_WINDOW_DAYS}` },
        { status: 400 },
      );
    }
    windowDays = Math.floor(parsed);
  }

  const roundup = await computeRoundup(prisma, { windowDays });
  return NextResponse.json(roundup);
}
