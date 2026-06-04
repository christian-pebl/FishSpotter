/**
 * One-off research: should the Dragonet sit in its own `scooter` Rung-1 gate, or
 * be folded into `fish` alongside the gobies it superficially resembles?
 *
 * Claude orchestrates; Gemini does the vision. We pull one good reference photo
 * for the two dragonets + four gobies, send them all in a single call, and ask
 * Gemini (as a benthic-camera ID designer) to judge first-glance silhouette
 * confusability from a DOWNWARD-LOOKING seabed camera (the FishSpotter view).
 *
 * Read-only against the DB. Run:
 *   npx tsx --env-file=.env.local scripts/research-dragonet-goby-gate.ts
 */
import { PrismaClient } from "@prisma/client";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

const DRAGONETS = ["Callionymus lyra", "Callionymus maculatus"];
const GOBIES = [
  "Gobius paganellus",
  "Pomatoschistus minutus",
  "Gobiusculus flavescens",
  "Pomatoschistus microps",
];

const SCHEMA = {
  type: "object",
  properties: {
    dragonetSilhouetteDescription: { type: "string" },
    gobySilhouetteDescription: { type: "string" },
    keyDistinguishingFeatures: { type: "array", items: { type: "string" } },
    sharedFeaturesCausingConfusion: { type: "array", items: { type: "string" } },
    // How confusable from a TOP-DOWN benthic camera, 0 = unmistakable, 100 = identical
    confusabilityTopDown: { type: "integer" },
    // How confusable in a side-on view, for contrast
    confusabilityLateral: { type: "integer" },
    // Would a beginner reliably pick the right top-level shape gate?
    beginnerWouldPickSameGate: { type: "boolean" },
    recommendation: {
      type: "string",
      enum: ["keep-separate-scooter-class", "fold-dragonet-into-fish", "either-defensible"],
    },
    reasoning: { type: "string" },
  },
  required: [
    "dragonetSilhouetteDescription",
    "gobySilhouetteDescription",
    "keyDistinguishingFeatures",
    "sharedFeaturesCausingConfusion",
    "confusabilityTopDown",
    "confusabilityLateral",
    "beginnerWouldPickSameGate",
    "recommendation",
    "reasoning",
  ],
} as const;

const PROMPT = [
  "You are designing the first-glance silhouette gate for an underwater species ID",
  "game. Footage comes from a SEABED CAMERA that mostly looks DOWN onto the bottom,",
  "so the dominant view of bottom-dwelling fish is from above (dorsal) or oblique.",
  "",
  "The images below are reference photos. The FIRST set are DRAGONETS",
  "(Callionymus). The SECOND set are GOBIES (Gobius / Pomatoschistus /",
  "Gobiusculus). A naive user reports that dragonets and gobies 'look and move",
  "similarly' and questions why the game puts them in different top-level shape",
  "gates (dragonet = its own flattened 'scooter' class; gobies = generic 'fish').",
  "",
  "Judge purely on FIRST-GLANCE BODY OUTLINE as seen from a downward-looking",
  "camera, NOT on fine markings. Specifically assess:",
  " - the dragonet's flattened, triangular, wide-headed, eyes-on-top body plan vs",
  " - the goby's rounder, tube-like body perched up on the bottom on its pelvic sucker.",
  "",
  "Score confusabilityTopDown and confusabilityLateral 0..100 (0 unmistakable, 100",
  "identical). beginnerWouldPickSameGate = would an untrained user most likely tap",
  "the SAME shape tile for both. Then recommend whether to keep dragonet as its own",
  "flattened shape class or fold it in with the round-bodied fish. Be concrete and",
  "do not use em dashes.",
].join("\n");

async function fetchInline(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "FishSpotter/1.0 (research)" },
  });
  if (!res.ok) throw new Error(`fetch ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  return { inline_data: { mime_type: ct, data: buf.toString("base64") } };
}

async function main() {
  const prisma = new PrismaClient();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const parts: unknown[] = [{ text: PROMPT }];

  async function addGroup(label: string, names: string[]) {
    parts.push({ text: `\n=== ${label} ===` });
    for (const n of names) {
      const row = await prisma.speciesImage.findFirst({
        where: { scientificName: n },
        orderBy: [{ curated: "desc" }, { ordering: "asc" }],
      });
      if (!row) {
        console.log(`  (no photo cached for ${n})`);
        continue;
      }
      console.log(`  ${label}: ${n} -> ${row.url}`);
      parts.push({ text: `${n}:` });
      parts.push(await fetchInline(row.url));
    }
  }

  await addGroup("DRAGONETS", DRAGONETS);
  await addGroup("GOBIES", GOBIES);

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const url = `${GEMINI_BASE}/models/${MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    console.error("Gemini error", res.status, JSON.stringify(json).slice(0, 500));
    await prisma.$disconnect();
    process.exit(1);
  }
  const text =
    json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  console.log("\n===== GEMINI VERDICT (" + MODEL + ") =====\n");
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
