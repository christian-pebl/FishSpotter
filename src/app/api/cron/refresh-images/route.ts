import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { refreshSpeciesImages } from "@/lib/biodiversity/refresh-images";

export const dynamic = "force-dynamic";
// Vercel function budget. Cron and manual triggers both fit inside this.
export const maxDuration = 60;

// Hard caps per invocation. With ~1.1s throttle per iNat call and ~2 buckets
// per species on average, 12 species ≈ 30s. Stay well under maxDuration so a
// slow iNat day doesn't kill the request.
const MAX_SPECIES_PER_RUN = 12;
const BUDGET_MS = 50_000;

function authorised(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${expected}`);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Manual triggers can pass `?force=1` to refresh every species regardless
  // of freshness — useful for the initial population. The weekly cron leaves
  // it unset and relies on stale-only.
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  const result = await refreshSpeciesImages({
    prisma,
    staleOnly: !force,
    maxSpecies: MAX_SPECIES_PER_RUN,
    budgetMs: BUDGET_MS,
  });

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
