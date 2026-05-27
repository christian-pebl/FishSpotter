import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { rescoreConsensus } from "@/lib/consensus";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
// Cheap query at project scale (tens of thousands of answers max). Keep
// the function budget conservative so a slow DB doesn't blow past Vercel.
export const maxDuration = 60;

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
  const result = await rescoreConsensus(prisma);
  return NextResponse.json({ ok: true, ...result });
}
