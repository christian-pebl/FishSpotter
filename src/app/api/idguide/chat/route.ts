import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { authOptions } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { checkChatRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { CATALOGUE as FULL_CATALOGUE } from "@/lib/idguide/catalogue";
import type { SpeciesCatalogue } from "@/lib/idguide/traits";
import { narrowCandidates } from "@/lib/idguide/narrow";
import {
  buildDynamicSystemBlock,
  buildStableSystemBlock,
  pickLocalCatalogue,
  type EcologicalContext,
} from "@/lib/idguide/prompt";
import { fetchRecentNearbySightings } from "@/lib/idguide/recent-sightings";
import { bucketFor } from "@/lib/biodiversity/buckets";
import { normaliseCommonName } from "@/lib/biodiversity/gbif-match";

export const dynamic = "force-dynamic";


const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const MAX_TURNS = 8;
const MAX_USER_MESSAGE_CHARS = 600;
// Bound the total messages array (user + assistant turns) so the Anthropic
// request size stays in check. The user-turn cap (MAX_TURNS) is still enforced
// separately below as a soft, streamed reply; this is a hard ceiling on the
// whole transcript.
const MAX_MESSAGES = 40;
const MAX_TOOL_ROUNDS = 4;
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const ClientMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  // Per-message content cap mirrors the existing 600-char limit (previously
  // only checked on user turns); a min length of 1 keeps empty messages out.
  content: z.string().min(1).max(MAX_USER_MESSAGE_CHARS),
});

const ChatRequestSchema = z.object({
  snippetId: z.string().min(1),
  // Non-empty (matches the old length === 0 rejection) and hard-capped at
  // MAX_MESSAGES so the Anthropic request size is bounded.
  messages: z.array(ClientMessageSchema).min(1).max(MAX_MESSAGES),
});

const NARROW_TOOL: Anthropic.Tool = {
  name: "narrow_candidates",
  description:
    "Filter the locally plausible species catalogue by traits the user has described. Returns matching species ranked by trait match and local ecological probability. Use this whenever the user gives a new observable trait — do not reason about the catalogue from memory.",
  // The tool schema is the second-largest stable chunk of input on every
  // call. Mark it as cacheable so the prefix (system + tools) is one big
  // cache hit after the first request in a 5-minute window.
  cache_control: { type: "ephemeral" },
  input_schema: {
    type: "object",
    properties: {
      must_have: {
        type: "object",
        description: "Traits the user has confirmed about the fish",
        properties: {
          bodyShape: { type: "array", items: { type: "string" } },
          size: { type: "array", items: { type: "string" } },
          coloration: { type: "array", items: { type: "string" } },
          markings: { type: "array", items: { type: "string" } },
          finShape: { type: "array", items: { type: "string" } },
          features: { type: "array", items: { type: "string" } },
          behavior: { type: "array", items: { type: "string" } },
          habitat: { type: "array", items: { type: "string" } },
        },
      },
      must_not_have: {
        type: "object",
        description: "Traits the user has ruled out",
        properties: {
          bodyShape: { type: "array", items: { type: "string" } },
          size: { type: "array", items: { type: "string" } },
          coloration: { type: "array", items: { type: "string" } },
          markings: { type: "array", items: { type: "string" } },
          finShape: { type: "array", items: { type: "string" } },
          features: { type: "array", items: { type: "string" } },
          behavior: { type: "array", items: { type: "string" } },
          habitat: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

type CachedProbability = {
  topSpecies: Array<{ scientificName: string; probability: number }>;
  probabilityByScientific: Record<string, number>;
};

async function loadEcologicalContext(snippetId: string): Promise<{
  ctx: EcologicalContext;
  prob: CachedProbability;
  localCatalogue: SpeciesCatalogue;
} | null> {
  const snippet = await prisma.snippet.findUnique({
    where: { id: snippetId },
    select: {
      id: true,
      site: true,
      deployment: true,
      lat: true,
      lon: true,
      depthM: true,
      recordingDatetime: true,
    },
  });
  if (!snippet) return null;

  const bucket = bucketFor(snippet);
  const month = bucket?.month ?? null;

  let topSpecies: CachedProbability["topSpecies"] = [];
  if (bucket) {
    const cached = await prisma.speciesProbability.findUnique({
      where: {
        latBucket_lonBucket_depthBucket_month: {
          latBucket: bucket.latBucket,
          lonBucket: bucket.lonBucket,
          depthBucket: bucket.depthBucket,
          month: bucket.month,
        },
      },
    });
    if (cached && cached.status === "OK") {
      try {
        const parsed = JSON.parse(cached.speciesJson);
        if (Array.isArray(parsed)) {
          topSpecies = parsed
            .filter(
              (s): s is { scientificName: string; probability: number } =>
                s &&
                typeof s === "object" &&
                typeof s.scientificName === "string" &&
                typeof s.probability === "number",
            )
            .slice(0, 10);
        }
      } catch {
        // Bad cache row — fall back to an empty list rather than 500.
      }
    }
  }

  const nearbyCommon = await fetchRecentNearbySightings(snippet.lat, snippet.lon, snippet.id, 8);

  // Resolve nearby common names to scientific where we already have them cached.
  const nearbyScientific: string[] = [];
  for (const name of nearbyCommon) {
    const map = await prisma.speciesNameMap.findUnique({
      where: { commonName: normaliseCommonName(name) },
    });
    if (map?.scientificName) nearbyScientific.push(map.scientificName);
  }

  const localCatalogue = pickLocalCatalogue({
    catalogue: FULL_CATALOGUE,
    topSpecies,
    recentNearbyScientific: nearbyScientific,
  });

  const probabilityByScientific: Record<string, number> = {};
  for (const s of topSpecies) probabilityByScientific[s.scientificName] = s.probability;

  const ctx: EcologicalContext = {
    site: snippet.site,
    deployment: snippet.deployment,
    lat: snippet.lat,
    lon: snippet.lon,
    depthM: snippet.depthM,
    month,
    monthName: month ? MONTH_NAMES[month - 1] : null,
    topSpecies,
    recentNearby: nearbyCommon,
  };

  return {
    ctx,
    prob: { topSpecies, probabilityByScientific },
    localCatalogue,
  };
}

function encodeSse(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export async function POST(req: Request) {
  if (!assertSameOrigin(req)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to use the ID guide chat." }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Chat unavailable" }, { status: 503 });
  }

  if (!checkChatRateLimit(session.user.id)) {
    return NextResponse.json(
      { error: "You've hit the hourly chat limit. Try the manual trait filter instead." },
      { status: 429 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = ChatRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;

  const userMessages = body.messages.filter((m) => m.role === "user");
  if (userMessages.length > MAX_TURNS) {
    // S2-T19: soft-handle the cap. Instead of a 400 (which the client
    // surfaces as an error chip with a disabled input), stream back a
    // single assistant message inviting the user to open a fresh chat.
    // The 200 keeps the client's stream-handling code on its happy path.
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (obj: unknown) => controller.enqueue(encodeSse(obj));
        send({
          type: "text",
          text: "We've covered a lot — open a fresh chat to keep narrowing. Your earlier suggestions stay visible in this one.",
        });
        send({ type: "done" });
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }
  if (userMessages.some((m) => m.content.length > MAX_USER_MESSAGE_CHARS)) {
    return NextResponse.json(
      { error: `Keep each message under ${MAX_USER_MESSAGE_CHARS} characters.` },
      { status: 400 }
    );
  }

  const ctxBundle = await loadEcologicalContext(body.snippetId);
  if (!ctxBundle) {
    return NextResponse.json({ error: "Snippet not found" }, { status: 404 });
  }

  // Two-block system prompt for cache effectiveness:
  //   stable  = persona + hard rules + full catalogue + final reminders
  //             (identical for every snippet and every user; cache hit rate
  //              approaches 100% inside the 5-minute ephemeral TTL)
  //   dynamic = per-snippet site/depth/month + ecological likelihood ordering
  //             (~150 tokens; never billed at cache-write rate)
  //
  // Always cache the FULL catalogue so ad-hoc snippet hops don't bust the
  // cache. The dynamic block still steers the model toward locally plausible
  // species via the explicit "Ecological likelihood" line.
  const stableSystemBlock = buildStableSystemBlock(FULL_CATALOGUE);
  const dynamicSystemBlock = buildDynamicSystemBlock(ctxBundle.ctx);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encodeSse(obj));
      const apiMessages: Anthropic.MessageParam[] = body.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        // Track whether the model has produced any user-visible text. If the
        // tool-call loop exhausts MAX_TOOL_ROUNDS with no text, we send a
        // fallback message so the user isn't left with just candidate chips.
        let receivedAnyText = false;
        // Inner loop: allow up to N tool-call rounds per agent turn.
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const messageStream = client.messages.stream(
            {
              model: MODEL,
              max_tokens: 1024,
              system: [
                {
                  type: "text",
                  text: stableSystemBlock,
                  cache_control: { type: "ephemeral" },
                },
                {
                  type: "text",
                  text: dynamicSystemBlock,
                },
              ],
              tools: [NARROW_TOOL],
              messages: apiMessages,
            },
            // Safety net: cap each model round so a hung upstream can't hold the
            // serverless function open to Vercel's wall-clock limit. The client
            // also has a 20s idle watchdog; this is the server-side backstop.
            { signal: AbortSignal.timeout(45000) },
          );

          // Forward token deltas to the client as they arrive.
          messageStream.on("text", (delta) => {
            if (delta) {
              send({ type: "text", text: delta });
              receivedAnyText = true;
            }
          });

          const final = await messageStream.finalMessage();

          const toolUseBlocks: Anthropic.ToolUseBlock[] = [];
          for (const block of final.content) {
            if (block.type === "tool_use") toolUseBlocks.push(block);
          }

          apiMessages.push({ role: "assistant", content: final.content });

          if (final.stop_reason !== "tool_use" || toolUseBlocks.length === 0) {
            break;
          }

          const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map((tu) => {
            if (tu.name !== "narrow_candidates") {
              return {
                type: "tool_result",
                tool_use_id: tu.id,
                is_error: true,
                content: `Unknown tool: ${tu.name}`,
              };
            }
            const rawInput = (tu.input ?? {}) as Record<string, unknown>;
            // narrowCandidates() sanitises must_have / must_not_have internally —
            // pass the raw input through so unknown keys can't blow up.
            const candidates = narrowCandidates({
              catalogue: ctxBundle.localCatalogue,
              mustHave: rawInput.must_have,
              mustNotHave: rawInput.must_not_have,
              probabilityByScientific: ctxBundle.prob.probabilityByScientific,
              limit: 8,
            });
            send({ type: "candidates", candidates });
            return {
              type: "tool_result",
              tool_use_id: tu.id,
              content: JSON.stringify({ candidates }),
            };
          });

          apiMessages.push({ role: "user", content: toolResults });
        }

        if (!receivedAnyText) {
          // The tool loop exhausted itself without ever producing prose. Give
          // the user a clear next-step prompt so the conversation doesn't end
          // silently after a list of candidate chips appears.
          send({
            type: "text",
            text: "I've narrowed the candidates above. Could you tell me one more thing — colour, markings, or how it was moving?",
          });
        }
        send({ type: "done" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
