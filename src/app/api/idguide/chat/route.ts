import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Anthropic from "@anthropic-ai/sdk";
import { authOptions } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { checkChatRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import speciesTraitsData from "@/data/species-traits.json";
import type { SpeciesCatalogue } from "@/lib/idguide/traits";
import { narrowCandidates } from "@/lib/idguide/narrow";
import { buildSystemPrompt, pickLocalCatalogue, type EcologicalContext } from "@/lib/idguide/prompt";
import { fetchRecentNearbySightings } from "@/lib/idguide/recent-sightings";
import { bucketFor } from "@/lib/biodiversity/buckets";
import { normaliseCommonName } from "@/lib/biodiversity/gbif-match";

export const dynamic = "force-dynamic";

const FULL_CATALOGUE = speciesTraitsData as unknown as SpeciesCatalogue;

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const MAX_TURNS = 8;
const MAX_USER_MESSAGE_CHARS = 600;
const MAX_TOOL_ROUNDS = 4;
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type ClientMessage = { role: "user" | "assistant"; content: string };

type ChatRequest = {
  snippetId: string;
  messages: ClientMessage[];
};

function isValidClientMessage(m: unknown): m is ClientMessage {
  if (!m || typeof m !== "object") return false;
  const r = (m as { role?: unknown }).role;
  const c = (m as { content?: unknown }).content;
  return (r === "user" || r === "assistant") && typeof c === "string";
}

const NARROW_TOOL: Anthropic.Tool = {
  name: "narrow_candidates",
  description:
    "Filter the locally plausible species catalogue by traits the user has described. Returns matching species ranked by trait match and local ecological probability. Use this whenever the user gives a new observable trait — do not reason about the catalogue from memory.",
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

  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (
    !body ||
    typeof body.snippetId !== "string" ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0 ||
    !body.messages.every(isValidClientMessage)
  ) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const userMessages = body.messages.filter((m) => m.role === "user");
  if (userMessages.length > MAX_TURNS) {
    return NextResponse.json(
      { error: "This conversation has reached its turn limit. Start a new chat for a fresh perspective." },
      { status: 400 }
    );
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

  const systemPrompt = buildSystemPrompt({
    ctx: ctxBundle.ctx,
    catalogue: ctxBundle.localCatalogue,
  });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encodeSse(obj));
      const apiMessages: Anthropic.MessageParam[] = body.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        // Inner loop: allow up to N tool-call rounds per agent turn.
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const resp = await client.messages.create({
            model: MODEL,
            max_tokens: 1024,
            system: [
              {
                type: "text",
                text: systemPrompt,
                cache_control: { type: "ephemeral" },
              },
            ],
            tools: [NARROW_TOOL],
            messages: apiMessages,
          });

          const toolUseBlocks: Anthropic.ToolUseBlock[] = [];
          for (const block of resp.content) {
            if (block.type === "text" && block.text) {
              send({ type: "text", text: block.text });
            } else if (block.type === "tool_use") {
              toolUseBlocks.push(block);
            }
          }

          apiMessages.push({ role: "assistant", content: resp.content });

          if (resp.stop_reason !== "tool_use" || toolUseBlocks.length === 0) {
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
