/**
 * POST /api/vitals — web-vitals sink (S4-16).
 *
 * Lightweight: validates the body, logs to the server console
 * (Vercel Functions logs aggregate these), and returns 204. A
 * future ticket can persist to a `Vital` Prisma table once the
 * sample shape is settled. For now this surface gives us the
 * monitoring hook without committing to a schema.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const Schema = z.object({
  name: z.string().min(1).max(20),
  value: z.number().finite(),
  id: z.string().min(1).max(64),
  path: z.string().min(1).max(200),
  ua: z.string().max(220).optional(),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  // eslint-disable-next-line no-console
  console.log("[vitals]", JSON.stringify(parsed));
  return new NextResponse(null, { status: 204 });
}
