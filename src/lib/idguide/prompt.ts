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

export function buildSystemPrompt(args: {
  ctx: EcologicalContext;
  catalogue: SpeciesCatalogue; // already filtered to locally plausible species
}): string {
  const { ctx, catalogue } = args;

  const locationLine = `Site: ${ctx.site} (${ctx.deployment})${
    ctx.lat != null && ctx.lon != null ? ` ~ ${ctx.lat.toFixed(3)}°, ${ctx.lon.toFixed(3)}°` : ""
  }${ctx.depthM != null ? `, depth ~${ctx.depthM}m` : ""}${ctx.monthName ? `, month ${ctx.monthName}` : ""}`;

  // Order the catalogue by ecological likelihood so the model favours the more
  // plausible species when ties occur. The probabilities are NEVER surfaced.
  const probByName = new Map(ctx.topSpecies.map((s) => [s.scientificName, s.probability] as const));
  const ordered = Object.entries(catalogue).sort(([a], [b]) => (probByName.get(b) ?? 0) - (probByName.get(a) ?? 0));

  const ecologyLine = ctx.topSpecies.length
    ? `Ecological likelihood (internal, do NOT quote): ${ctx.topSpecies
        .slice(0, 5)
        .map((s) => s.scientificName)
        .join(", ")} are the most common fish at this location and season.`
    : `Ecological likelihood: not enough OBIS data for this location.`;

  const recentLine = ctx.recentNearby.length
    ? `Recently observed nearby by PEBL: ${ctx.recentNearby.join(", ")}`
    : "";

  const catalogueLines = ordered.map(
    ([sci, t]) => `- ${sci} (${t.commonName}): ${formatTraits(t)}. Field note: ${t.fieldNote}`
  );

  return [
    PERSONA,
    "",
    HARD_RULES,
    "",
    "Context for this clip:",
    locationLine,
    ecologyLine,
    recentLine,
    "",
    "Locally plausible species catalogue (you may only suggest these):",
    ...catalogueLines,
    "",
    FINAL_REMINDERS,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function pickLocalCatalogue(args: {
  catalogue: SpeciesCatalogue;
  topSpecies: Array<{ scientificName: string }>;
  recentNearbyScientific: string[];
}): SpeciesCatalogue {
  const wanted = new Set<string>();
  for (const s of args.topSpecies) wanted.add(s.scientificName);
  for (const s of args.recentNearbyScientific) wanted.add(s);

  const intersect: SpeciesCatalogue = {};
  for (const [sci, traits] of Object.entries(args.catalogue)) {
    if (wanted.has(sci)) intersect[sci] = traits;
  }
  // Fall back to the full catalogue when the OBIS slice is too narrow —
  // otherwise we'd hide species the user might actually be looking at.
  if (Object.keys(intersect).length >= 6) return intersect;
  return args.catalogue;
}
