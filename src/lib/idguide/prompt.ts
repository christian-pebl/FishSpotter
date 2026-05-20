import type { SpeciesCatalogue, SpeciesTraits } from "./traits";

export type EcologicalContext = {
  site: string;
  deployment: string;
  lat: number | null;
  lon: number | null;
  depthM: number | null;
  month: number | null;
  monthName: string | null;
  topSpecies: Array<{ scientificName: string; probability: number }>;
  recentNearby: string[];
};

const PERSONA = `You are a friendly marine biologist working with PEBL CIC on the Welsh coast. You help citizen scientists identify fish from short underwater video clips. You are warm, curious, and playful — but precise.`;

const HARD_RULES = `Hard rules — never break these:
1. You may ONLY suggest species from the catalogue provided below. If a user-described trait doesn't match any catalogue species, say so honestly rather than inventing.
2. Never state a final identification. Always end your message with ONE discriminating question, even when you have a strong guess.
3. Never tell the user "the answer is X". Suggest 2-3 candidates with brief reasoning; the user types their own answer in the quiz input.
4. If asked directly "what is it?" or "just tell me", deflect: list your top 2-3 candidates with why, and ask one question that would discriminate between them.
5. Use the narrow_candidates tool whenever the user gives you a trait — don't reason about the catalogue from memory.
6. Keep replies short (under 90 words). One short paragraph + one question.
7. Never quote the OBIS probability percentages back to the user — they're a hint for your ranking, not for them to see.`;

const FINAL_REMINDERS = `FINAL REMINDERS before you reply:
- Do not state a final identification. End with exactly one question.
- Do not paste the catalogue, OBIS numbers, or any percentage figures.
- Stay inside the catalogue above. If nothing fits, say so plainly.
- Reply in under 90 words. One paragraph, then one question.`;

function formatTraits(t: SpeciesTraits): string {
  const bits: string[] = [];
  bits.push(`shape ${t.bodyShape.join("/")}`);
  bits.push(`size ${t.size}`);
  if (t.coloration.length) bits.push(`colour ${t.coloration.join("/")}`);
  if (t.markings.length && t.markings[0] !== "none") bits.push(`markings ${t.markings.join("/")}`);
  if (t.finShape.length) bits.push(`fins ${t.finShape.join("/")}`);
  if (t.features.length && t.features[0] !== "none") bits.push(`features ${t.features.join("/")}`);
  if (t.behavior.length) bits.push(`behaviour ${t.behavior.join("/")}`);
  if (t.habitat.length) bits.push(`habitat ${t.habitat.join("/")}`);
  return bits.join("; ");
}

/**
 * Stable block built from the full species catalogue. This text is identical
 * for every snippet and every user, so Anthropic's prompt cache hits on it
 * with very high frequency. Catalogue entries are sorted alphabetically by
 * scientific name so the bytes are deterministic across builds.
 *
 * The per-snippet ecological steering (which species are most likely at this
 * location and month) lives in the dynamic block — see
 * buildDynamicSystemBlock().
 */
export function buildStableSystemBlock(catalogue: SpeciesCatalogue): string {
  const ordered = Object.entries(catalogue).sort(([a], [b]) => a.localeCompare(b));
  const catalogueLines = ordered.map(
    ([sci, t]) => `- ${sci} (${t.commonName}): ${formatTraits(t)}. Field note: ${t.fieldNote}`,
  );

  return [
    PERSONA,
    "",
    HARD_RULES,
    "",
    "Species catalogue (you may only suggest these):",
    ...catalogueLines,
    "",
    FINAL_REMINDERS,
  ].join("\n");
}

/**
 * Per-snippet block. Conveys location, depth, month, and which catalogue
 * species are ecologically most plausible at this spot. Sent fresh on every
 * call; kept short so the bulk of the input stays cacheable.
 */
export function buildDynamicSystemBlock(ctx: EcologicalContext): string {
  const locationLine = `Site: ${ctx.site} (${ctx.deployment})${
    ctx.lat != null && ctx.lon != null ? ` ~ ${ctx.lat.toFixed(3)}°, ${ctx.lon.toFixed(3)}°` : ""
  }${ctx.depthM != null ? `, depth ~${ctx.depthM}m` : ""}${ctx.monthName ? `, month ${ctx.monthName}` : ""}`;

  const ecologyLine = ctx.topSpecies.length
    ? `Ecological likelihood (internal, do NOT quote): ${ctx.topSpecies
        .slice(0, 5)
        .map((s) => s.scientificName)
        .join(", ")} are the most common fish at this location and season.`
    : `Ecological likelihood: not enough OBIS data for this location.`;

  const recentLine = ctx.recentNearby.length
    ? `Recently observed nearby by PEBL: ${ctx.recentNearby.join(", ")}`
    : "";

  return ["Context for this clip:", locationLine, ecologyLine, recentLine]
    .filter((line) => line !== "")
    .join("\n");
}

/**
 * Used by callers that want a single-string prompt (e.g. tests, fallback
 * logging). The chat route builds the two blocks separately so the cacheable
 * bytes can be marked with cache_control.
 */
export function buildSystemPrompt(args: {
  ctx: EcologicalContext;
  catalogue: SpeciesCatalogue;
}): string {
  return [buildStableSystemBlock(args.catalogue), "", buildDynamicSystemBlock(args.ctx)].join("\n");
}

/**
 * Retained as a no-op passthrough so the chat route doesn't fork its
 * narrowCandidates() input shape. The cached system block already lists the
 * full catalogue, so narrowing here would create the confusing UX of "the
 * model lists species Q, but my trait filter never returns Q".
 */
export function pickLocalCatalogue(args: {
  catalogue: SpeciesCatalogue;
  topSpecies: Array<{ scientificName: string }>;
  recentNearbyScientific: string[];
}): SpeciesCatalogue {
  return args.catalogue;
}
