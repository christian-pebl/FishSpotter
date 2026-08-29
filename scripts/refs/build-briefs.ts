/**
 * Build one verification BRIEF per species: every claim the guide renders, the
 * exact words the reader sees, the sources already bound to it, and the local
 * path to each source's cached text.
 *
 * This exists so a verification pass reads rather than searches. Handing a
 * reviewer "here is the claim, here is the page it is supposed to rest on, in
 * plain text on disk" is a different job from "go and find out whether this is
 * true", and only the first one is repeatable.
 *
 * The brief covers exactly what a reader sees on /species/<slug>:
 *   trait:depth/size/habitat/behavior   the four fact tiles
 *   mark:<id>                            the "How to spot it" ring text
 *   fieldNote                            the prose note (rendered only when a
 *                                        species has no marks, but it also
 *                                        feeds the workshop cards)
 *   trophic:tier                         the one-line tier under "In the food web"
 *   diet:eats:<n> / diet:eatenBy:<n>     the three "I eat" and three "Eats me"
 *                                        bullets, which are AUTHORED from the
 *                                        sources rather than read off the farm
 *                                        food web; the brief carries whatever
 *                                        the graph currently says as background
 *                                        only, clearly marked as such
 *
 *   npx tsx --env-file=.env.local scripts/refs/build-briefs.ts [--species "X"]
 */

import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import speciesTraitsData from "../../src/data/species-traits.json";
import speciesFacts from "../../src/data/species-facts.json";
import statedDiet from "../../src/data/species-diet.json";
import { referenceFileSchema, type ReferenceFile } from "../../src/lib/references/schema";
import { E as FW_EDGES } from "../../food-web/build-foodweb.mjs";
import { safeName } from "./lib/cache";

const REFS = path.join(process.cwd(), "src", "data", "species-references.json");
const CACHE = path.join(process.cwd(), ".refs-cache");
const OUT = path.join(process.cwd(), ".refs-cache", "briefs");

type Traits = { commonName: string; fieldNote?: string; size: string; habitat: string[]; behavior: string[] };
const CATALOGUE = speciesTraitsData as unknown as Record<string, Traits>;
const FACTS = speciesFacts as Record<string, Partial<Record<"depth" | "size" | "habitat" | "behaviour", { text: string }>>>;
const DIETS = statedDiet as Record<string, { eats: { text: string; slug?: string }[]; eatenBy: { text: string; slug?: string }[] }>;

/** Three of each: representative enough to be useful, few enough to evidence. */
const DIET_SLOTS = 3;

const prettify = (v: string) => {
  const s = v.replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export type BriefClaim = {
  key: string;
  surface: string;
  /** Exactly the words the reader sees, so the check is against the rendering. */
  rendered: string;
  /** The underlying data value, where it differs from the rendering. */
  raw?: string;
  sourceIds: string[];
  existingSupport: { sourceId: string; locator: string; quote?: string }[];
  claimSupported: boolean;
  conflict?: string;
  /** Set for an "Eats me" row: the claim lives on the predator's entry. */
  ownedBy?: string;
};

export type Brief = {
  species: string;
  commonName: string;
  identity?: { acceptedName: string; aphiaId: number; url: string };
  /**
   * The Spot It wizard's trait tokens. CONTEXT ONLY, and specifically the thing
   * the fact tiles no longer render: they are a controlled vocabulary chosen so
   * a beginner can cut a candidate list off a short clip, not a description of
   * the animal. Do not copy them into a tile.
   */
  wizardTraits: { size: string; habitat: string[]; behavior: string[] };
  claims: BriefClaim[];
  /**
   * What the 72-node farm food web currently draws for this species. Background
   * for a sanity check, NOT a list to transcribe: its rows are constrained to
   * catalogue neighbours, which is exactly the limitation the authored bullets
   * exist to escape.
   */
  foodWebContext: { eats: string[]; eatenBy: string[] };
  sources: {
    id: string;
    kind: string;
    title: string;
    publisher: string;
    url?: string;
    /** Repo-relative path to the cached plain text, when the fetch succeeded. */
    textFile?: string;
    textBytes?: number;
    cacheStatus: string;
    linkVerified: boolean;
  }[];
};

async function main() {
  const argv = process.argv.slice(2);
  const only = argv.includes("--species") ? argv[argv.indexOf("--species") + 1] : undefined;

  const file: ReferenceFile = referenceFileSchema.parse(JSON.parse(fs.readFileSync(REFS, "utf8")));
  const verification: Record<string, { status: string }> = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "src", "data", "reference-verification.json"), "utf8"),
  );
  const cacheIndex: Record<string, { status: string; file?: string; bytes?: number }> = fs.existsSync(
    path.join(CACHE, "index.json"),
  )
    ? JSON.parse(fs.readFileSync(path.join(CACHE, "index.json"), "utf8"))
    : {};

  const prisma = new PrismaClient();
  const marks = await prisma.diagnosticMark.findMany({
    select: { id: true, scientificName: true, label: true, description: true },
    orderBy: [{ scientificName: "asc" }, { order: "asc" }],
  });
  await prisma.$disconnect();

  const BY_COMMON = new Map<string, string>();
  for (const [sci, t] of Object.entries(CATALOGUE)) BY_COMMON.set(t.commonName.toLowerCase(), sci);
  const sciFor = (c: string) => BY_COMMON.get(c.toLowerCase());

  fs.mkdirSync(OUT, { recursive: true });
  const briefs: Brief[] = [];

  for (const [sci, t] of Object.entries(CATALOGUE)) {
    if (only && sci !== only && t.commonName !== only) continue;
    const entry = file.species[sci];
    const claims: BriefClaim[] = [];
    const usedSources = new Set<string>();

    const add = (key: string, surface: string, rendered: string, raw?: string, ownedBy?: string) => {
      const owner = ownedBy ?? sci;
      const c = file.species[owner]?.claims?.[key];
      for (const id of c?.sourceIds ?? []) usedSources.add(id);
      claims.push({
        key,
        surface,
        rendered,
        raw,
        sourceIds: c?.sourceIds ?? [],
        existingSupport: (c?.support ?? []).map((s) => ({
          sourceId: s.sourceId,
          locator: s.locator,
          quote: s.quote,
        })),
        claimSupported: c?.claimSupported ?? false,
        conflict: c?.conflict,
        ...(ownedBy ? { ownedBy } : {}),
      });
    };

    // --- the four fact tiles. Each is a phrase to be written FROM a source,
    // not a rendering of the wizard token, so the brief shows whatever text is
    // there now (often nothing) and carries the token separately as context.
    for (const key of ["depth", "size", "habitat", "behaviour"] as const) {
      const f = FACTS[sci]?.[key];
      const claimKey = `trait:${key === "behaviour" ? "behavior" : key}`;
      add(claimKey, `${key[0].toUpperCase()}${key.slice(1)} tile`, f ? f.text : "(empty tile - write from the sources)");
    }

    // --- how to spot it
    for (const m of marks.filter((m) => m.scientificName === sci)) {
      add(`mark:${m.id}`, "How to spot it ring", `${m.label}: ${m.description}`);
    }
    if (t.fieldNote) add("fieldNote", "Field note", t.fieldNote);

    // --- diet
    // The three "I eat" and three "Eats me" bullets. These are AUTHORED from
    // the sources, so the slots exist whether or not anything fills them yet.
    for (let i = 0; i < DIET_SLOTS; i++) {
      const b = DIETS[sci]?.eats?.[i];
      add(`diet:eats:${i}`, "I eat", b ? b.text : "(empty slot - author from the sources)", b?.slug);
    }
    for (let i = 0; i < DIET_SLOTS; i++) {
      const b = DIETS[sci]?.eatenBy?.[i];
      add(`diet:eatenBy:${i}`, "Eats me", b ? b.text : "(empty slot - author from the sources)", b?.slug);
    }

    // Every source the species declares, plus any pulled in by an eats-me edge.
    for (const id of entry?.sourceIds ?? []) usedSources.add(id);
    const sources = [...usedSources].sort().map((id) => {
      const s = file.sources[id];
      const cached = cacheIndex[id];
      return {
        id,
        kind: s?.kind ?? "?",
        title: s?.title ?? "(unknown source)",
        publisher: s?.publisher ?? "",
        url: s?.url,
        textFile: cached?.file ? `.refs-cache/text/${cached.file}` : undefined,
        textBytes: cached?.bytes,
        cacheStatus: cached?.status ?? "not-fetched",
        linkVerified: verification[id]?.status === "ok",
      };
    });

    // What the farm food web currently draws, carried as BACKGROUND only. It is
    // the thing being replaced, so it must not read as a list to transcribe:
    // its rows are catalogue neighbours, not a diet.
    const graphEats: string[] = [];
    const graphEatenBy: string[] = [];
    for (const [prey, predator] of FW_EDGES as Array<[string, string]>) {
      if (predator.toLowerCase() === t.commonName.toLowerCase()) graphEats.push(prey);
      if (prey.toLowerCase() === t.commonName.toLowerCase()) graphEatenBy.push(predator);
    }

    const brief: Brief = {
      species: sci,
      wizardTraits: { size: t.size, habitat: t.habitat, behavior: t.behavior },
      commonName: t.commonName,
      identity: entry?.identity
        ? { acceptedName: entry.identity.acceptedName, aphiaId: entry.identity.aphiaId, url: entry.identity.url }
        : undefined,
      claims,
      sources,
      foodWebContext: { eats: graphEats, eatenBy: graphEatenBy },
    };
    briefs.push(brief);
    fs.writeFileSync(path.join(OUT, `${safeName(sci)}.json`), JSON.stringify(brief, null, 2));
  }

  const totalClaims = briefs.reduce((a, b) => a + b.claims.length, 0);
  const unsupported = briefs.reduce((a, b) => a + b.claims.filter((c) => !c.claimSupported).length, 0);
  const conflicted = briefs.reduce((a, b) => a + b.claims.filter((c) => c.conflict).length, 0);
  const noSource = briefs.reduce((a, b) => a + b.claims.filter((c) => c.sourceIds.length === 0).length, 0);
  fs.writeFileSync(
    path.join(OUT, "_index.json"),
    JSON.stringify(
      briefs.map((b) => ({
        species: b.species,
        commonName: b.commonName,
        claims: b.claims.length,
        unsupported: b.claims.filter((c) => !c.claimSupported).length,
        file: `.refs-cache/briefs/${safeName(b.species)}.json`,
      })),
      null,
      2,
    ),
  );

  console.log(`${briefs.length} briefs, ${totalClaims} rendered claims`);
  console.log(`  already evidenced : ${totalClaims - unsupported}`);
  console.log(`  needs a read      : ${unsupported}`);
  console.log(`  flagged conflict  : ${conflicted}`);
  console.log(`  no source at all  : ${noSource}`);
  console.log("Written to .refs-cache/briefs/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
