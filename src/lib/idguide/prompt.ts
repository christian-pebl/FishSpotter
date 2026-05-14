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
6. Keep replies short (under 90 words). One short paragraph + one question.`;

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

  const obisLine = ctx.topSpecies.length
    ? `OBIS top species at this bucket: ${ctx.topSpecies
        .slice(0, 10)
        .map((s) => `${s.scientificName} (${Math.round(s.probability * 100)}%)`)
        .join(", ")}`
    : `OBIS data: not enough records for this bucket.`;

  const recentLine = ctx.recentNearby.length
    ? `Recently observed nearby by PEBL: ${ctx.recentNearby.join(", ")}`
    : "";

  const catalogueLines = Object.entries(catalogue).map(
    ([sci, t]) => `- ${sci} (${t.commonName}): ${formatTraits(t)}. Field note: ${t.fieldNote}`
  );

  return [
    PERSONA,
    "",
    HARD_RULES,
    "",
    "Context for this clip:",
    locationLine,
    obisLine,
    recentLine,
    "",
    "Locally plausible species catalogue (you may only suggest these):",
    ...catalogueLines,
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

  // If we have very few matches against our catalogue, fall back to the full catalogue.
  const intersect: SpeciesCatalogue = {};
  for (const [sci, traits] of Object.entries(args.catalogue)) {
    if (wanted.has(sci)) intersect[sci] = traits;
  }
  if (Object.keys(intersect).length >= 6) return intersect;
  return args.catalogue;
}
