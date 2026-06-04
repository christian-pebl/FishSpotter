/**
 * Shared helpers for the diagnostic-mark audit + placement scripts.
 *
 * - buildOverlaySvg: renders the numbered teal rings + badges EXACTLY as the
 *   runtime AnnotatedSpeciesPhoto.tsx does, so what Gemini grades is what the
 *   learner sees.
 * - compositeAnnotated: download a photo and burn the rings onto it (sharp).
 * - validateHero: ask Gemini to grade each ring's placement + clarity.
 *
 * Extracted from scripts/audit-species-images.ts so the placement tool reuses
 * the same geometry and the same verifier (closed loop).
 */
import sharp from "sharp";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

export type MarkRow = {
  label: string;
  description: string;
  overlayX: number;
  overlayY: number;
  overlayRadius: number;
};

/** SVG ring overlay matching AnnotatedSpeciesPhoto.tsx geometry exactly. */
export function buildOverlaySvg(W: number, H: number, marks: MarkRow[]): string {
  const S = Math.min(W, H);
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
  ];
  marks.forEach((m, idx) => {
    const cx = m.overlayX * W;
    const cy = m.overlayY * H;
    const r = m.overlayRadius * S;
    const badgeR = S * 0.024;
    const ringStroke = S * 0.004;
    const fontSize = S * 0.026;
    const textOffsetY = fontSize * 0.35;
    const badgeDist = r + badgeR + S * 0.012;
    const diag = badgeDist * 0.707;
    const corners: Array<[number, number]> = [
      [cx + diag, cy - diag],
      [cx - diag, cy - diag],
      [cx + diag, cy + diag],
      [cx - diag, cy + diag],
    ];
    const [bx, by] =
      corners.find(
        ([tx, ty]) => tx - badgeR >= 0 && tx + badgeR <= W && ty - badgeR >= 0 && ty + badgeR <= H,
      ) ?? corners[0];
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(20,184,166,0.18)" stroke="#5eead4" stroke-width="${ringStroke}"/>`,
      `<circle cx="${bx}" cy="${by}" r="${badgeR}" fill="#0f766e" stroke="#ffffff" stroke-width="${ringStroke}"/>`,
      `<text x="${bx}" y="${by + textOffsetY}" text-anchor="middle" font-size="${fontSize}" font-weight="700" font-family="sans-serif" fill="#ffffff">${idx + 1}</text>`,
    );
  });
  parts.push(`</svg>`);
  return parts.join("");
}

/** Download a photo, return its intrinsic dimensions + raw buffer (sharp).
 * Retries transient 429/5xx (the iNat/Wikimedia CDNs rate-limit rapid fetches),
 * so a sweep is not aborted by one throttled image. */
export async function loadImage(
  imageUrl: string,
): Promise<{ buf: Buffer; width: number; height: number }> {
  let lastErr = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    let res: Response;
    try {
      res = await fetch(imageUrl, { headers: { "User-Agent": "FishSpotter/1.0 (audit)" } });
    } catch (e) {
      lastErr = (e as Error).message;
      await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
      continue;
    }
    if (res.status === 429 || res.status === 500 || res.status === 503) {
      lastErr = `image fetch ${res.status}`;
      const ra = Number(res.headers.get("Retry-After"));
      await new Promise((r) =>
        setTimeout(r, Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1200 * 2 ** attempt),
      );
      continue;
    }
    if (!res.ok) throw new Error(`image fetch ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    return { buf, width: meta.width ?? 1000, height: meta.height ?? 1000 };
  }
  throw new Error(lastErr || "image fetch failed after retries");
}

/** Download a photo and burn the rings onto it; returns a base64 PNG. */
export async function compositeAnnotated(
  imageUrl: string,
  marks: MarkRow[],
): Promise<{ base64: string; mime: string; width: number; height: number }> {
  const { buf, width, height } = await loadImage(imageUrl);
  const svg = buildOverlaySvg(width, height, marks);
  const out = await sharp(buf)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
  return { base64: out.toString("base64"), mime: "image/png", width, height };
}

export type HeroValidation = {
  imageOk: boolean;
  overallClarity?: number;
  overallAligned?: boolean;
  perMark?: Array<{
    number: number;
    label: string;
    featurePresentAtRing: boolean;
    alignment: "on" | "near" | "off";
    clarity: number;
    note: string;
  }>;
  recommendation?: string;
  summary?: string;
  error?: string;
};

const VALIDATION_SCHEMA = {
  type: "object",
  properties: {
    overallClarity: { type: "integer" },
    overallAligned: { type: "boolean" },
    perMark: {
      type: "array",
      items: {
        type: "object",
        properties: {
          number: { type: "integer" },
          label: { type: "string" },
          featurePresentAtRing: { type: "boolean" },
          alignment: { type: "string", enum: ["on", "near", "off"] },
          clarity: { type: "integer" },
          note: { type: "string" },
        },
        required: ["number", "label", "featurePresentAtRing", "alignment", "clarity", "note"],
      },
    },
    recommendation: { type: "string" },
    summary: { type: "string" },
  },
  required: ["overallClarity", "overallAligned", "perMark", "recommendation", "summary"],
} as const;

function buildValidationPrompt(common: string, sci: string, marks: MarkRow[]): string {
  const list = marks.map((m, i) => `  ${i + 1}. "${m.label}" — ${m.description}`).join("\n");
  return [
    `You are a marine-biology ID editor reviewing an ANNOTATED reference photo`,
    `for an underwater species-identification game. The species is ${common} (${sci}).`,
    ``,
    `The photo has numbered teal CIRCLES drawn on it. Each circle is meant to`,
    `point at one diagnostic feature. The intended feature for each number is:`,
    list,
    ``,
    `For EACH numbered circle, judge ONLY from what you can see in the image:`,
    `- featurePresentAtRing: is the labelled feature actually visible INSIDE (or`,
    `  immediately under) that circle? true/false.`,
    `- alignment: "on" if the circle is centred on the feature, "near" if it is`,
    `  close but off-centre or the wrong size, "off" if it sits on the wrong part`,
    `  of the animal or on background.`,
    `- clarity: 0..100, how clearly a beginner could see that feature here.`,
    `- note: one short sentence on what is right or wrong.`,
    ``,
    `Then overall:`,
    `- overallClarity: 0..100 for the annotated hero as a teaching image.`,
    `- overallAligned: true only if MOST circles are correctly placed.`,
    `- recommendation: one of "keep" / "reposition-circles" / "replace-photo" /`,
    `  "re-author-marks", whichever best fixes the biggest problem.`,
    `- summary: one or two sentences with the concrete fix.`,
    `Do not use em dashes.`,
  ].join("\n");
}

async function geminiJson(prompt: string, base64: string, mime: string, schema: unknown): Promise<
  { ok: true; data: unknown } | { ok: false; error: string }
> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: "GEMINI_API_KEY not set" };
  const body = {
    contents: [
      { role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: base64 } }] },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: schema,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  const url = `${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) {
      if (attempt === 3) return { ok: false, error: `network: ${(e as Error).message}` };
      await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
      continue;
    }
    if (res.status === 429 || res.status === 500 || res.status === 503) {
      if (attempt === 3) return { ok: false, error: `gemini ${res.status} after retries` };
      const ra = Number(res.headers.get("Retry-After"));
      await new Promise((r) =>
        setTimeout(r, Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1500 * 2 ** attempt),
      );
      continue;
    }
    const json = (await res.json().catch(() => null)) as
      | { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } }
      | null;
    if (!res.ok || !json) {
      return { ok: false, error: `gemini ${res.status}: ${json?.error?.message ?? "unknown"}` };
    }
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    try {
      return { ok: true, data: JSON.parse(text) };
    } catch {
      return { ok: false, error: `non-JSON output: ${text.slice(0, 160)}` };
    }
  }
  return { ok: false, error: "exhausted retries" };
}

/** Composite the rings on the photo and ask Gemini to grade their placement. */
export async function validateHero(
  common: string,
  sci: string,
  imageUrl: string,
  marks: MarkRow[],
): Promise<HeroValidation> {
  let img: { base64: string; mime: string };
  try {
    img = await compositeAnnotated(imageUrl, marks);
  } catch (e) {
    return { imageOk: false, error: `composite failed: ${(e as Error).message}` };
  }
  const r = await geminiJson(buildValidationPrompt(common, sci, marks), img.base64, img.mime, VALIDATION_SCHEMA);
  if (!r.ok) return { imageOk: true, error: r.error };
  return { imageOk: true, ...(r.data as Omit<HeroValidation, "imageOk">) };
}

/** Low-level Gemini JSON call (image + schema), exposed for the placement tool. */
export { geminiJson };
