/**
 * Gemini vision client — image feature extraction / quality assessment.
 *
 * Claude orchestrates; Gemini does the actual vision work because it is the
 * stronger image model. We use it to score how SUITABLE a candidate photo is
 * for FishSpotter (teaching diagnostic marks + MCQ thumbnails + reveal
 * galleries), which iNaturalist's "research grade" flag does NOT measure
 * (research grade = community agreement on the ID, not photo composition).
 *
 * This is the escape hatch for the photo-curation gap noted in CLAUDE.md:
 * iNat's top-voted photo for a species is often a mixed school, a dead
 * beach-cast specimen, an engraving, or even (the Aurelia aurita case) a photo
 * of a person. Gemini reads the pixels and tells us.
 *
 * Auth: reads GEMINI_API_KEY from the environment (set in .env.local, which is
 * gitignored — never commit the key). Model is overridable via GEMINI_MODEL.
 *
 * REST docs: https://ai.google.dev/api/generate-content
 */

import { fetchWithTimeout } from "@/lib/http";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

// Override with GEMINI_MODEL in .env.local. Default to the latest Flash id
// (verified available via the ListModels API, 3 Jun 2026); Flash is fast +
// cheap and plenty for this task.
const DEFAULT_MODEL = "gemini-3.5-flash";

// Retry transient failures, same posture as the iNat client.
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 600;
const MAX_DELAY_MS = 10_000;

// Cap inline image size. Gemini inline_data tolerates a few MB; our reference
// photos are ~medium (500px) so this is a guard against a surprise original.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export type QualityRecommendation = "ideal" | "usable" | "poor" | "reject";

/** Structured assessment of one photo's suitability for FishSpotter. */
export type ImageQuality = {
  /** What the frame actually contains. */
  subjectType:
    | "single-specimen"
    | "multiple-specimens"
    | "no-organism"
    | "wrong-subject"
    | "other";
  /** How many distinct individual animals are visible (0 if none). */
  individualCount: number;
  /** Living state of the primary specimen. */
  condition: "alive-natural" | "dead-or-beachcast" | "preserved-or-museum" | "unknown";
  /** Dominant viewing angle of the primary specimen. */
  view: "lateral" | "dorsal" | "ventral" | "anterior" | "oblique" | "other";
  /** A drawing/engraving/plate rather than a photograph. */
  nonPhotographic: boolean;
  /** 0..100 scores. */
  focus: number; // sharpness of the specimen
  lighting: number; // exposure / colour, not blown-out or murky-dark
  framing: number; // how fully the body is in-frame and not cropped
  occlusionFree: number; // 100 = fully unobstructed, 0 = mostly hidden
  diagnosticFeaturesVisible: number; // fins, markings, barbels etc. legible
  /** Overall teaching suitability 0..100 and a bucketed call. */
  teachingScore: number;
  recommendation: QualityRecommendation;
  /** One short sentence; what makes it good or bad for ID teaching. */
  notes: string;
};

/** Token usage for one call, for cost tracking. */
export type TokenUsage = {
  input: number; // prompt tokens (image + text + schema)
  output: number; // visible response tokens
  thinking: number; // reasoning tokens (0 when thinkingBudget is 0)
  total: number;
};

export type AssessResult =
  | { ok: true; quality: ImageQuality; model: string; usage: TokenUsage }
  | { ok: false; error: string; model: string };

// Gemini responseSchema (OpenAPI subset). Keeps the model on-rails so the
// caller never has to parse free-form prose.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    subjectType: {
      type: "string",
      enum: ["single-specimen", "multiple-specimens", "no-organism", "wrong-subject", "other"],
    },
    individualCount: { type: "integer" },
    condition: {
      type: "string",
      enum: ["alive-natural", "dead-or-beachcast", "preserved-or-museum", "unknown"],
    },
    view: {
      type: "string",
      enum: ["lateral", "dorsal", "ventral", "anterior", "oblique", "other"],
    },
    nonPhotographic: { type: "boolean" },
    focus: { type: "integer" },
    lighting: { type: "integer" },
    framing: { type: "integer" },
    occlusionFree: { type: "integer" },
    diagnosticFeaturesVisible: { type: "integer" },
    teachingScore: { type: "integer" },
    recommendation: { type: "string", enum: ["ideal", "usable", "poor", "reject"] },
    notes: { type: "string" },
  },
  required: [
    "subjectType",
    "individualCount",
    "condition",
    "view",
    "nonPhotographic",
    "focus",
    "lighting",
    "framing",
    "occlusionFree",
    "diagnosticFeaturesVisible",
    "teachingScore",
    "recommendation",
    "notes",
  ],
} as const;

function buildPrompt(scientificName: string, commonName?: string): string {
  const name = commonName ? `${commonName} (${scientificName})` : scientificName;
  return [
    `You are a marine-biology photo editor curating reference photos for an`,
    `underwater-species identification game. The target species is ${name}.`,
    ``,
    `Assess THIS photo's suitability as a TEACHING reference — a clear photo a`,
    `beginner can study to learn how to recognise the species, and on which an`,
    `expert can annotate diagnostic features (fins, markings, barbels, etc.).`,
    ``,
    `An IDEAL photo is: a single living specimen, in natural condition, side-on`,
    `(lateral), sharp, well-lit, fully in frame, unobstructed, with diagnostic`,
    `features clearly legible.`,
    ``,
    `Penalise heavily: drawings/engravings/old plates (set nonPhotographic),`,
    `dead or beach-cast specimens, preserved/museum specimens, mixed schools or`,
    `multiple individuals, blur, heavy occlusion, extreme crop, and any frame`,
    `whose main subject is NOT this kind of animal (e.g. a person, a landscape,`,
    `a map) — set subjectType to wrong-subject for those.`,
    ``,
    `Score each 0..100. teachingScore is your overall judgement. Map`,
    `recommendation: ideal (>=80), usable (60-79), poor (35-59), reject (<35`,
    `or wrong-subject or nonPhotographic). Keep notes to one short sentence.`,
    `Do not use em dashes.`,
  ].join("\n");
}

function nextDelay(attempt: number, retryAfter: string | null): number {
  if (retryAfter) {
    const s = Number(retryAfter);
    if (Number.isFinite(s) && s > 0) return Math.min(s * 1000, MAX_DELAY_MS);
  }
  const exp = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  return exp + exp * 0.25 * Math.random();
}

function guessMimeType(url: string, contentType: string | null): string {
  if (contentType && contentType.startsWith("image/")) return contentType.split(";")[0];
  if (/\.png(\?|$)/i.test(url)) return "image/png";
  if (/\.webp(\?|$)/i.test(url)) return "image/webp";
  if (/\.gif(\?|$)/i.test(url)) return "image/gif";
  return "image/jpeg";
}

async function downloadImage(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetchWithTimeout(
    url,
    { headers: { "User-Agent": "FishSpotter/1.0 (https://fish-spotter.vercel.app)" } },
    15_000,
  );
  if (!res.ok) throw new Error(`image fetch ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`image too large (${buf.byteLength} bytes)`);
  }
  return { base64: buf.toString("base64"), mimeType: guessMimeType(url, res.headers.get("content-type")) };
}

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { message?: string };
};

/**
 * Generic structured-generation call against Gemini. Caller supplies the
 * `parts` (text + any inline_data) and a `responseSchema`; gets back the raw
 * JSON text + token usage, or { ok:false, error }. Encapsulates the key check,
 * generationConfig, URL, and the 429/503/500 retry loop so every Gemini task
 * (image quality, UI critique, future vision tasks) shares one client.
 */
export async function geminiGenerate(args: {
  parts: Array<Record<string, unknown>>;
  schema: object;
  model?: string;
  apiKey?: string;
  thinkingBudget?: number;
}): Promise<
  | { ok: true; text: string; usage: TokenUsage; model: string }
  | { ok: false; error: string; model: string }
> {
  const model = args.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const apiKey = args.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: "GEMINI_API_KEY not set (add it to .env.local)", model };

  const body = {
    contents: [{ role: "user", parts: args.parts }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: args.schema,
      thinkingConfig: { thinkingBudget: args.thinkingBudget ?? 0 },
    },
  };
  // Pass the key via header, not the query string: query strings end up in
  // access logs / error traces, headers do not.
  const url = `${GEMINI_BASE}/models/${model}:generateContent`;

  let attempt = 0;
  while (true) {
    let res: Response;
    try {
      res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(body),
        },
        60_000,
      );
    } catch (e) {
      if (attempt >= MAX_RETRIES - 1) return { ok: false, error: `network: ${(e as Error).message}`, model };
      await new Promise((r) => setTimeout(r, nextDelay(attempt, null)));
      attempt++;
      continue;
    }

    if (res.status === 429 || res.status === 503 || res.status === 500) {
      if (attempt >= MAX_RETRIES - 1) return { ok: false, error: `gemini ${res.status} after retries`, model };
      await new Promise((r) => setTimeout(r, nextDelay(attempt, res.headers.get("Retry-After"))));
      attempt++;
      continue;
    }

    let json: GeminiResponse;
    try {
      json = (await res.json()) as GeminiResponse;
    } catch {
      return { ok: false, error: `gemini ${res.status}: unparseable body`, model };
    }
    if (!res.ok) return { ok: false, error: `gemini ${res.status}: ${json.error?.message ?? "unknown"}`, model };

    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text.trim()) return { ok: false, error: "empty model response", model };

    const u = json.usageMetadata;
    const usage: TokenUsage = {
      input: u?.promptTokenCount ?? 0,
      output: u?.candidatesTokenCount ?? 0,
      thinking: u?.thoughtsTokenCount ?? 0,
      total: u?.totalTokenCount ?? 0,
    };
    return { ok: true, text, usage, model };
  }
}

// ---------------------------------------------------------------------------
// Silhouette scoring (added 17 Jun 2026). Scores how well a flat tile
// silhouette represents its labelled group in the Spot It gate, on fixed
// 0..100 metrics, so the icon set can be measured and tracked over time
// (re-run scripts/score-silhouettes.ts; compare the JSON baseline).
// ---------------------------------------------------------------------------

export type SilhouetteVerdict = "strong" | "adequate" | "weak" | "replace";

/** Structured representativeness score for one tile silhouette. */
export type SilhouetteScore = {
  /** 1-3 words: what the shape most looks like at a glance, no caption. */
  readsAs: string;
  /** 0..100: would a beginner read this shape as the intended label? */
  recognizability: number;
  /** 0..100: does the outline capture the group's key shape cues? */
  diagnosticAccuracy: number;
  /** 0..100: clean + legible as a small flat icon (not broken/cluttered). */
  clarity: number;
  /** 0..100: visually distinct from the sibling tiles in the same picker. */
  distinctiveness: number;
  /** Sibling/animal it is most likely mistaken for, or "none". */
  confusableWith: string;
  /** 0..100: overall representativeness. */
  score: number;
  verdict: SilhouetteVerdict;
  /** One short, concrete improvement suggestion. */
  notes: string;
};

export type SilhouetteResult =
  | { ok: true; score: SilhouetteScore; model: string; usage: TokenUsage }
  | { ok: false; error: string; model: string };

const SILHOUETTE_SCHEMA = {
  type: "object",
  properties: {
    readsAs: { type: "string" },
    recognizability: { type: "integer" },
    diagnosticAccuracy: { type: "integer" },
    clarity: { type: "integer" },
    distinctiveness: { type: "integer" },
    confusableWith: { type: "string" },
    score: { type: "integer" },
    verdict: { type: "string", enum: ["strong", "adequate", "weak", "replace"] },
    notes: { type: "string" },
  },
  required: [
    "readsAs",
    "recognizability",
    "diagnosticAccuracy",
    "clarity",
    "distinctiveness",
    "confusableWith",
    "score",
    "verdict",
    "notes",
  ],
} as const;

function buildSilhouettePrompt(label: string, groupContext: string, siblings: string[]): string {
  const sib = siblings.length ? siblings.join(", ") : "(none)";
  return [
    `You are an icon-design reviewer for a UK marine-species identification game`,
    `for the general public. The attached image is a flat, single-colour`,
    `SILHOUETTE used as a tap-target on a picker tile. Its intended meaning is`,
    `"${label}" (${groupContext}).`,
    ``,
    `In the SAME picker the user also sees these sibling tiles: ${sib}.`,
    `The user is a beginner who taps the silhouette that best matches the animal`,
    `they just saw in a short underwater video clip. There is a small caption,`,
    `but good silhouettes should read correctly on shape alone.`,
    ``,
    `Judge how well THIS silhouette represents "${label}":`,
    `- readsAs: in 1-3 words, what does the shape most look like at a glance?`,
    `- recognizability: would a beginner read this shape as a ${label}?`,
    `- diagnosticAccuracy: does the outline capture the key shape cues of a`,
    `  ${label} (e.g. a cod's three separate dorsal fins, a shark's upturned`,
    `  tail, a wrasse's deep body + single long fin, a crab's wide carapace and`,
    `  legs, an eel's long ribbon body)?`,
    `- clarity: is it clean and legible at small icon size, not cluttered,`,
    `  broken, lopsided, or ambiguous?`,
    `- distinctiveness: is it visually distinct from the sibling tiles listed,`,
    `  so it will not be confused with them?`,
    `- confusableWith: which sibling (or other common animal) is it most likely`,
    `  to be mistaken for? "none" if clearly distinct.`,
    ``,
    `Score each metric 0..100. score is your overall representativeness`,
    `judgement. Map verdict: strong (>=80), adequate (60-79), weak (40-59),`,
    `replace (<40). Keep notes to one short, concrete suggestion. Do not use em`,
    `dashes.`,
  ].join("\n");
}

/**
 * Score a tile silhouette (passed as base64 PNG) for how well it represents its
 * labelled group, relative to its sibling tiles. Never throws for an expected
 * failure; returns { ok: false, error } so batch callers can continue.
 */
export async function assessSilhouette(args: {
  label: string;
  groupContext: string;
  siblings: string[];
  imageBase64: string;
  mimeType?: string;
  apiKey?: string;
  model?: string;
}): Promise<SilhouetteResult> {
  const model = args.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const result = await geminiGenerate({
    parts: [
      { text: buildSilhouettePrompt(args.label, args.groupContext, args.siblings) },
      { inline_data: { mime_type: args.mimeType ?? "image/png", data: args.imageBase64 } },
    ],
    schema: SILHOUETTE_SCHEMA,
    model: args.model,
    apiKey: args.apiKey,
    thinkingBudget: 0,
  });
  if (!result.ok) return { ok: false, error: result.error, model: result.model };
  try {
    const score = JSON.parse(result.text) as SilhouetteScore;
    return { ok: true, score, model: result.model, usage: result.usage };
  } catch {
    return { ok: false, error: `non-JSON model output: ${result.text.slice(0, 200)}`, model };
  }
}

/**
 * Assess a single image (by URL or already-decoded base64) for teaching
 * suitability. Never throws for an expected failure (bad key, fetch error,
 * model error) — returns { ok: false, error } so batch callers can continue.
 */
export async function assessImageQuality(args: {
  scientificName: string;
  commonName?: string;
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  apiKey?: string;
  model?: string;
}): Promise<AssessResult> {
  const model = args.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const apiKey = args.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "GEMINI_API_KEY not set (add it to .env.local)", model };
  }

  let image: { base64: string; mimeType: string };
  try {
    if (args.imageBase64) {
      image = { base64: args.imageBase64, mimeType: args.mimeType ?? "image/jpeg" };
    } else if (args.imageUrl) {
      image = await downloadImage(args.imageUrl);
    } else {
      return { ok: false, error: "no imageUrl or imageBase64 provided", model };
    }
  } catch (e) {
    return { ok: false, error: `download failed: ${(e as Error).message}`, model };
  }

  // This is a scored-rubric triage, not open-ended reasoning — thinkingBudget 0
  // cut output tokens ~8x in testing (847 -> 0) with no quality loss.
  const result = await geminiGenerate({
    parts: [
      { text: buildPrompt(args.scientificName, args.commonName) },
      { inline_data: { mime_type: image.mimeType, data: image.base64 } },
    ],
    schema: RESPONSE_SCHEMA,
    model: args.model,
    apiKey: args.apiKey,
    thinkingBudget: 0,
  });
  if (!result.ok) return { ok: false, error: result.error, model: result.model };

  try {
    const quality = JSON.parse(result.text) as ImageQuality;
    return { ok: true, quality, model: result.model, usage: result.usage };
  } catch {
    return { ok: false, error: `non-JSON model output: ${result.text.slice(0, 200)}`, model: result.model };
  }
}
