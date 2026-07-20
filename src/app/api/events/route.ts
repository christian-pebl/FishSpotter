import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/csrf";
import { readConsent } from "@/lib/cookies/consent";
import { checkEventRateLimit } from "@/lib/rate-limit";
import {
  EVENT_TYPES,
  MAX_EVENTS_PER_BATCH,
  MAX_WATCH_SECONDS,
  MAX_ATTRIBUTION_LEN,
} from "@/lib/events";

// First-party engagement ingest (Climate Action Fund impact measurement).
// Privacy-first by construction:
//   - GATED ON ANALYTICS CONSENT: no consent → we silently accept and store
//     nothing (204), so the client never has to special-case it.
//   - Stores no IP or user-agent. sessionId is a random per-tab id. The only
//     attribution captured is a referrer hostname + UTM params on
//     session_start, so Reddit/etc. traffic can be tied to the funnel.
export const dynamic = "force-dynamic";

const attr = z.string().max(MAX_ATTRIBUTION_LEN).optional();

const EventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  sessionId: z.string().min(8).max(64),
  snippetId: z.string().max(64).optional(),
  value: z.number().finite().min(0).max(MAX_WATCH_SECONDS).optional(),
  referrer: attr,
  utmSource: attr,
  utmMedium: attr,
  utmCampaign: attr,
});

const BatchSchema = z.object({
  events: z.array(EventSchema).min(1).max(MAX_EVENTS_PER_BATCH),
});

export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  // Hard gate: only record when the visitor has opted into analytics.
  const consent = await readConsent();
  if (consent?.analytics !== true) {
    return new NextResponse(null, { status: 204 });
  }

  let parsed;
  try {
    parsed = BatchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  // Rate-limit per account when signed in, else per tab session.
  const rateKey = userId ?? parsed.events[0]?.sessionId ?? "anon";
  if (!(await checkEventRateLimit(rateKey))) {
    return new NextResponse(null, { status: 429 });
  }

  await prisma.event.createMany({
    data: parsed.events.map((e) => ({
      userId,
      sessionId: e.sessionId,
      type: e.type,
      snippetId: e.snippetId ?? null,
      value: e.value ?? null,
      referrer: e.referrer ?? null,
      utmSource: e.utmSource ?? null,
      utmMedium: e.utmMedium ?? null,
      utmCampaign: e.utmCampaign ?? null,
    })),
  });

  return new NextResponse(null, { status: 204 });
}
