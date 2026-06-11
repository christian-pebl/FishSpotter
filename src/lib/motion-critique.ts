/**
 * Gemini-powered MOTION critique — the "eyes" for validating animations.
 *
 * The sibling ui-critique.ts judges a single SETTLED screenshot: perfect for
 * "does this screen look right", structurally blind to motion. An animation
 * lives in time, so this judges a SEQUENCE of frames captured across the
 * animation's timeline (plus an optional reduced-motion resting frame), and asks
 * Gemini to grade the ARC: is it smooth, does it land on a calm end state, and
 * above all is it SUBTLE enough not to distract from the clip the user is trying
 * to identify. Same house pattern as ui-critique / gemini-vision (Claude
 * orchestrates, Gemini does the vision; advisory, never a CI gate).
 *
 * SCOPE: look + feel of the motion only. Behaviour (does the score update, does
 * the unlock persist) stays on Playwright assertions + vitest.
 */

import { geminiGenerate, type TokenUsage } from "@/lib/biodiversity/gemini-vision";
import { DESIGN_SYSTEM } from "@/lib/ui-critique";

export type MotionVerdict = "pass" | "revise";

export type MotionIssue = {
  severity: "high" | "medium" | "low";
  /** smoothness | distraction | end-state | amplitude | brand | reduced-motion | timing | other */
  area: string;
  detail: string;
  fix: string;
};

export type MotionCritique = {
  verdict: MotionVerdict;
  /** 0..100 overall motion quality vs the brief + the house aesthetic. */
  score: number;
  /** 0..100 — does it progress in even, intentional steps (high) or stutter/jump (low)? */
  smoothness: number;
  /** 0..100 — how SUBTLE / non-distracting it is. High = recedes behind the
   * content (good). Low = flashy/busy/long, pulls the eye off the clip (bad). */
  subtlety: number;
  /** The last motion frame is a calm, legible resting state (not mid-motion). */
  landsOnEndState: boolean;
  /** Thin teal line-art, colorblind-safe, flat — on the house aesthetic. */
  onBrand: boolean;
  /** Amplitude + duration fit the moment (micro-feedback tiny; celebration brief). */
  amplitudeOk: boolean;
  /** If a reduced-motion frame was supplied: it still conveys the outcome,
   * losing only the flourish. Null when no reduced-motion frame was given. */
  reducedMotionInformative: boolean | null;
  issues: MotionIssue[];
  /** Specific brand/token breaches (off-palette colour, neon glow, emoji, etc). */
  brandViolations: string[];
  notes: string;
};

export type MotionCritiqueResult =
  | { ok: true; critique: MotionCritique; usage: TokenUsage; model: string }
  | { ok: false; error: string };

const MOTION_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["pass", "revise"] },
    score: { type: "integer" },
    smoothness: { type: "integer" },
    subtlety: { type: "integer" },
    landsOnEndState: { type: "boolean" },
    onBrand: { type: "boolean" },
    amplitudeOk: { type: "boolean" },
    reducedMotionInformative: { type: "boolean", nullable: true },
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
  required: [
    "verdict", "score", "smoothness", "subtlety", "landsOnEndState",
    "onBrand", "amplitudeOk", "reducedMotionInformative", "issues",
    "brandViolations", "notes",
  ],
} as const;

const MOTION_RUBRIC = [
  "HOW TO JUDGE THE MOTION (this is a marine-ID game; the clip of the animal is",
  "the subject, animation is seasoning):",
  "- SUBTLETY is the most important axis. A reward/teaching/feedback motion must",
  "  recede behind the content. Big, flashy, long, or busy motion is a FAIL even",
  "  if it is pretty. Small amplitude + short duration + one focal thing = good.",
  "- SMOOTHNESS: the frames should progress in even, intentional steps. Sudden",
  "  jumps, stutters, or a thing that pops in fully-formed read as janky.",
  "- END STATE: the final motion frame must be a calm, legible resting state, not",
  "  caught mid-motion. The user should be left looking at a clear result.",
  "- AMPLITUDE / PACE: micro-feedback (a tap, a press) should be tiny and ~150-",
  "  400ms; a celebration/reveal can be a little more but stays under ~1.5s.",
  "- AESTHETIC: thin teal stroked line-art, flat. No neon/glow (the one allowed",
  "  glow is a thin teal radar ring), no orange (the user is colorblind).",
  "- REDUCED MOTION: if a final 'reduced-motion resting state' frame is supplied,",
  "  it must still convey the outcome (e.g. the unlocked photo + ticked badge),",
  "  losing only the flourish. If it loses the information, that is a high issue.",
].join("\n");

function buildMotionPrompt(
  brief: string,
  viewport: string,
  timestamps: number[],
  hasReducedFrame: boolean,
): string {
  const seq = timestamps.map((t) => `${t}ms`).join(", ");
  return [
    "You are a senior product designer reviewing an ANIMATION in the FishSpotter",
    `web app, captured at ${viewport}.`,
    "",
    "The images are sequential frames of ONE animation, in order, captured at",
    `t = ${seq} after the moment was triggered.` ,
    hasReducedFrame
      ? "The FINAL image is a separate capture of the SAME moment with the OS"
        + " 'reduce motion' setting on — i.e. the resting state a motion-averse"
        + " user sees. Judge it for whether it still conveys the outcome."
      : "No reduced-motion frame was supplied; return null for"
        + " reducedMotionInformative.",
    "",
    "INTENT / brief for this animation:",
    brief,
    "",
    MOTION_RUBRIC,
    "",
    DESIGN_SYSTEM,
    "",
    "Read the frames as a time sequence, not as separate stills. Return JSON:",
    "verdict 'pass' only if the motion is subtle, smooth, on-brand, lands on a",
    "clear end state, and (if given) the reduced-motion frame stays informative,",
    "with no high-severity issues; otherwise 'revise'. Give concrete issues each",
    "with a fix, and list any brand/token breaches. Keep notes to one sentence.",
    "Do not use em dashes.",
  ].join("\n");
}

/**
 * Critique an animation from a sequence of frames (base64 PNG/JPEG, in temporal
 * order) plus an optional reduced-motion resting frame. One Gemini call covers
 * the whole arc, which keeps it frugal against the free-tier daily cap. Never
 * throws on expected failures.
 */
export async function critiqueMotion(args: {
  frames: { ms: number; base64: string }[];
  reducedMotionFrame?: { base64: string } | null;
  mimeType?: string;
  brief: string;
  viewport?: string;
  model?: string;
  apiKey?: string;
}): Promise<MotionCritiqueResult> {
  const mime = args.mimeType ?? "image/png";
  const timestamps = args.frames.map((f) => f.ms);
  const hasReduced = !!args.reducedMotionFrame;

  const parts: Array<
    { text: string } | { inline_data: { mime_type: string; data: string } }
  > = [
    { text: buildMotionPrompt(args.brief, args.viewport ?? "unspecified viewport", timestamps, hasReduced) },
  ];
  for (const f of args.frames) {
    parts.push({ inline_data: { mime_type: mime, data: f.base64 } });
  }
  if (args.reducedMotionFrame) {
    parts.push({ inline_data: { mime_type: mime, data: args.reducedMotionFrame.base64 } });
  }

  const result = await geminiGenerate({
    parts,
    schema: MOTION_SCHEMA,
    model: args.model,
    apiKey: args.apiKey,
    thinkingBudget: 0,
  });
  if (!result.ok) return { ok: false, error: result.error };

  try {
    const critique = JSON.parse(result.text) as MotionCritique;
    return { ok: true, critique, usage: result.usage, model: result.model };
  } catch {
    return { ok: false, error: `non-JSON critique: ${result.text.slice(0, 200)}` };
  }
}
