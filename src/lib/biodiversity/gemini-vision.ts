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

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

// Override with GEMINI_MODEL in .env.local (e.g. "gemini-3.5-flash"). Default
// to a known-good Flash id; Flash is fast + cheap and plenty for this task.
const DEFAULT_MODEL = "gemini-2.5-flash";

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

export type AssessResult =
  | { ok: true; quality: ImageQuality; model: string }
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
  const res = await fetch(url, {
    headers: { "User-Agent": "FishSpotter/1.0 (https://fish-spotter.vercel.app)" },
  });
  if (!res.ok) throw new Error(`image fetch ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`image too large (${buf.byteLength} bytes)`);
  }
  return { base64: buf.toString("base64"), mimeType: guessMimeType(url, res.headers.get("content-type")) };
}

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
};

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

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: buildPrompt(args.scientificName, args.commonName) },
          { inline_data: { mime_type: image.mimeType, data: image.base64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`;

  let attempt = 0;
  while (true) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) {
      if (attempt >= MAX_RETRIES - 1) {
        return { ok: false, error: `network: ${(e as Error).message}`, model };
      }
      await new Promise((r) => setTimeout(r, nextDelay(attempt, null)));
      attempt++;
      continue;
    }

    if (res.status === 429 || res.status === 503 || res.status === 500) {
      if (attempt >= MAX_RETRIES - 1) {
        return { ok: false, error: `gemini ${res.status} after retries`, model };
      }
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

    if (!res.ok) {
      return { ok: false, error: `gemini ${res.status}: ${json.error?.message ?? "unknown"}`, model };
    }

    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text.trim()) return { ok: false, error: "empty model response", model };

    try {
      const quality = JSON.parse(text) as ImageQuality;
      return { ok: true, quality, model };
    } catch {
      return { ok: false, error: `non-JSON model output: ${text.slice(0, 200)}`, model };
    }
  }
}
