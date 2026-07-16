/**
 * POST /api/vitals (web-vitals sink, S4-16).
 *
 * Validates the body, logs to the server console (Vercel Functions logs
 * aggregate these), persists each sample to the `Vital` Prisma table, and
 * returns 204. The DB write is best-effort: if the table does not exist yet
 * (migration not run) or the write otherwise fails, the route still logs and
 * returns 204 so a beacon never 500s and the client is never blocked on it.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/csrf";
import { clientIpKey } from "@/lib/client-ip";
import { checkVitalsRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const Schema = z.object({
  name: z.string().min(1).max(20),
  value: z.number().finite(),
  id: z.string().min(1).max(64),
  path: z.string().min(1).max(200),
  ua: z.string().max(220).optional(),
});

export async function POST(req: Request) {
  // Primary defense: only accept first-party beacons. A non-browser flood
  // carries no Origin/Referer and is rejected here before any DB work.
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  let parsed;
  try {
    parsed = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Secondary cap for browser-originated floods. Over-limit drops silently to
  // 204 (write skipped) so the beacon never blocks or errors the client.
  if (!checkVitalsRateLimit(clientIpKey(req))) {
    return new NextResponse(null, { status: 204 });
  }

  // eslint-disable-next-line no-console
  console.log("[vitals]", JSON.stringify(parsed));

  // Best-effort persistence. Wrapped so a missing table (migration not yet
  // run) or any transient DB error degrades to "logged but not stored"
  // rather than failing the beacon. The metric's client `id` is validated
  // for shape but not stored (the Vital row has its own cuid primary key).
  try {
    await prisma.vital.create({
      data: {
        name: parsed.name,
        value: parsed.value,
        path: parsed.path,
        ua: parsed.ua ?? null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[vitals] persist failed (returning 204 anyway):", err);
  }

  return new NextResponse(null, { status: 204 });
}
