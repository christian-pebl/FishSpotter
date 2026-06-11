/**
 * Gemini-powered UI visual critique — the "eyes" in the remote build loop.
 *
 * Claude builds a component, Playwright screenshots the running app, this sends
 * the screenshot to Gemini 3.5 Flash with the PEBL design system + a per-element
 * brief, and gets back a STRUCTURED critique (pass/revise + issues + brand
 * breaches). Claude acts on it, re-screenshots, repeats. Same house pattern as
 * gemini-vision.ts (Claude orchestrates, Gemini does the vision); it reuses that
 * module's `geminiGenerate` client.
 *
 * SCOPE: Gemini judges LOOK only — layout, hierarchy, brand adherence,
 * readability, crowding, mobile fit, "does it match the brief". It does NOT
 * judge behaviour (scoring, routing, unlock logic); that stays on Playwright
 * assertions + vitest. Treat the critique as advisory.
 */

import { geminiGenerate, type TokenUsage } from "@/lib/biodiversity/gemini-vision";

export type UiVerdict = "pass" | "revise";

export type UiIssue = {
  severity: "high" | "medium" | "low";
  /** layout | spacing | hierarchy | contrast | readability | brand | mobile-fit | content | other */
  area: string;
  detail: string;
  /** concrete suggested fix */
  fix: string;
};

export type UiCritique = {
  verdict: UiVerdict;
  /** 0..100 overall visual quality vs the brief + brand */
  score: number;
  matchesIntent: boolean;
  readability: number; // 0..100
  issues: UiIssue[];
  /** specific PEBL token / brand breaches (off-palette colour, emoji icon, wrong radius, <44px target) */
  brandViolations: string[];
  notes: string;
};

export type CritiqueResult =
  | { ok: true; critique: UiCritique; usage: TokenUsage; model: string }
  | { ok: false; error: string };

const UI_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["pass", "revise"] },
    score: { type: "integer" },
    matchesIntent: { type: "boolean" },
    readability: { type: "integer" },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["high", "medium", "low"] },
          area: { type: "string" },
          detail: { type: "string" },
          fix: { type: "string" },
        },
        required: ["severity", "area", "detail", "fix"],
      },
    },
    brandViolations: { type: "array", items: { type: "string" } },
    notes: { type: "string" },
  },
  required: ["verdict", "score", "matchesIntent", "readability", "issues", "brandViolations", "notes"],
} as const;

// The PEBL design system, embedded so Gemini grades against OUR rules, not
// generic taste. Mirrors CLAUDE.md brand + UI rules.
const DESIGN_SYSTEM = [
  "PEBL DESIGN SYSTEM (grade against THIS, not generic taste):",
  "- Palette ONLY: teal #3AAFA9, dark-teal #2B7A78, navy #17252A, light-teal #DEF2F1, white #FFFFFF. Off-palette colours are a brand violation.",
  "- Surfaces use a soft card radius (rounded, ~16-20px), pills are fully rounded. Sharp corners on cards are wrong.",
  "- NO emoji as UI icons. Icons must be clean stroked line-icons (teal). An emoji glyph used as an icon is a brand violation.",
  "- Body text is navy on light, or near-white on dark video; must stay legible (good contrast, not low-opacity grey on busy backgrounds).",
  "- Headings use a clear type hierarchy; avoid cramped or competing sizes.",
  "- Touch targets on mobile must be >= ~44px tall.",
  "- The product is a calm marine-science citizen app, NOT a hackathon demo: restrained, uncluttered, generous spacing.",
].join("\n");

function buildUiPrompt(brief: string, viewport: string): string {
  return [
    "You are a senior product designer reviewing a SCREENSHOT of one screen of the",
    "FishSpotter web app, captured at:",
    `  ${viewport}`,
    "",
    "INTENT / brief for this screen:",
    brief,
    "",
    DESIGN_SYSTEM,
    "",
    "Judge ONLY what is visible: layout, visual hierarchy, spacing/crowding,",
    "readability/contrast, brand adherence, mobile fit, and whether it satisfies",
    "the brief. Do NOT speculate about behaviour, clicks, or data correctness.",
    "",
    "Return JSON: verdict 'pass' only if it is on-brand, readable, uncluttered AND",
    "matches the brief with no high-severity issues; otherwise 'revise'. score is",
    "your overall 0..100. List concrete, actionable issues (each with a fix) and",
    "any specific brand/token breaches in brandViolations. Keep notes to one",
    "sentence. Do not use em dashes.",
  ].join("\n");
}

/** Critique one screenshot (base64 PNG/JPEG) against a brief. Never throws. */
export async function critiqueUi(args: {
  imageBase64: string;
  mimeType?: string;
  brief: string;
  viewport?: string;
  model?: string;
  apiKey?: string;
}): Promise<CritiqueResult> {
  const result = await geminiGenerate({
    parts: [
      { text: buildUiPrompt(args.brief, args.viewport ?? "unspecified viewport") },
      { inline_data: { mime_type: args.mimeType ?? "image/png", data: args.imageBase64 } },
    ],
    schema: UI_SCHEMA,
    model: args.model,
    apiKey: args.apiKey,
    thinkingBudget: 0,
  });
  if (!result.ok) return { ok: false, error: result.error };

  try {
    const critique = JSON.parse(result.text) as UiCritique;
    return { ok: true, critique, usage: result.usage, model: result.model };
  } catch {
    return { ok: false, error: `non-JSON critique: ${result.text.slice(0, 200)}` };
  }
}
