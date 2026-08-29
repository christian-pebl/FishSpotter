/**
 * Read-only claim audit: enumerate EVERY factual claim the app makes about a
 * species, and report which ones are bound to a source, which are bound but
 * unevidenced, and which are asserted with nothing behind them at all.
 *
 * This is the work queue for the grounding effort, and afterwards the honest
 * scorecard. It never writes, and it never sets a trust flag.
 *
 * Claims audited are exactly what the species guide RENDERS:
 *   trait:depth/size/habitat/behavior  the four sourced fact tiles
 *   mark:<id>                          each diagnostic-mark description
 *   fieldNote                          the prose field note
 *   diet:eats:<n> / diet:eatenBy:<n>   each authored diet bullet
 *
 * The per-edge feeding links and the farm-web trophic tier are gone from the
 * guide, so they are gone from here. Counting claims the app no longer makes
 * would flatter the denominator, which is the opposite of what an audit is
 * for. The workshop deck and the food-web page still carry their own claims
 * and want their own audit when they are next revised.
 *
 *   npm run refs:audit            summary + per-surface counts
 *   npm run refs:audit -- --queue print the unbound claims, most valuable first
 *   npm run refs:audit -- --species "Gadus morhua"
 *   npm run refs:audit -- --json
 */

import { PrismaClient } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";
import speciesTraitsData from "../../src/data/species-traits.json";
import speciesFacts from "../../src/data/species-facts.json";
import statedDiet from "../../src/data/species-diet.json";
import { referenceFileSchema, type ReferenceFile } from "../../src/lib/references/schema";

const REFS = path.join(process.cwd(), "src", "data", "species-references.json");

const argv = process.argv.slice(2);
const AS_JSON = argv.includes("--json");
const SHOW_QUEUE = argv.includes("--queue");
const ONLY = argv.includes("--species") ? argv[argv.indexOf("--species") + 1] : undefined;

type Traits = {
  commonName: string;
  shapeClass: string;
  fieldNote?: string;
  size: string;
  habitat: string[];
  behavior: string[];
};
const CATALOGUE = speciesTraitsData as unknown as Record<string, Traits>;
const FACTS = speciesFacts as Record<string, Partial<Record<"depth" | "size" | "habitat" | "behaviour", { text: string }>>>;
const DIETS = statedDiet as Record<string, { eats: { text: string }[]; eatenBy: { text: string }[] }>;

/** Food-web nodes are named by common name; map them back to the catalogue. */
const BY_COMMON = new Map<string, string>();
for (const [sci, t] of Object.entries(CATALOGUE)) BY_COMMON.set(t.commonName.toLowerCase(), sci);
const sciFor = (commonName: string) => BY_COMMON.get(commonName.toLowerCase());

type ClaimRow = {
  species: string;
  commonName: string;
  shapeClass: string;
  surface: string;
  key: string;
  /** The text the user actually reads, truncated for the report. */
  text: string;
  state: "unbound" | "bound" | "evidenced";
};

async function main() {
  let file: ReferenceFile = { version: 1, sources: {}, species: {} };
  try {
    file = referenceFileSchema.parse(JSON.parse(await fs.readFile(REFS, "utf8")));
  } catch {
    console.warn(`(no ${path.relative(process.cwd(), REFS)} yet, treating every claim as unbound)\n`);
  }

  const prisma = new PrismaClient();
  const marks = await prisma.diagnosticMark.findMany({
    select: { id: true, scientificName: true, label: true, description: true, createdBy: true },
    orderBy: [{ scientificName: "asc" }, { order: "asc" }],
  });
  await prisma.$disconnect();

  const rows: ClaimRow[] = [];
  const stateOf = (species: string, key: string): ClaimRow["state"] => {
    const claim = file.species[species]?.claims?.[key];
    if (!claim) return "unbound";
    return claim.claimSupported ? "evidenced" : "bound";
  };
  const push = (species: string, surface: string, key: string, text: string) => {
    const t = CATALOGUE[species];
    if (!t) return;
    if (ONLY && species !== ONLY && t.commonName !== ONLY) return;
    rows.push({
      species,
      commonName: t.commonName,
      shapeClass: t.shapeClass,
      surface,
      key,
      text: text.length > 110 ? text.slice(0, 107) + "..." : text,
      state: stateOf(species, key),
    });
  };

  // --- the four sourced fact tiles
  for (const [sci, t] of Object.entries(CATALOGUE)) {
    void t;
    for (const key of ["depth", "size", "habitat", "behaviour"] as const) {
      const f = FACTS[sci]?.[key];
      // A tile with no text is not rendered, so it is not a claim. It is a
      // GAP, counted separately below: an unmade claim and an unsourced one
      // are different failures and must not share a number.
      if (!f) continue;
      const claimKey = `trait:${key === "behaviour" ? "behavior" : key}`;
      push(sci, "fact tile", claimKey, `${key}: ${f.text}`);
    }
  }

  // --- diagnostic marks (the actual teaching text, and the biggest risk)
  for (const m of marks) {
    push(m.scientificName, "diagnostic mark", `mark:${m.id}`, `${m.label}: ${m.description}`);
  }

  // --- the field note, rendered when a species has no annotated diagram
  for (const [sci, t] of Object.entries(CATALOGUE)) {
    if (t.fieldNote) push(sci, "field note", "fieldNote", t.fieldNote);
  }

  // --- the authored diet bullets
  for (const [sci, d] of Object.entries(DIETS)) {
    d.eats.forEach((b, i) => push(sci, "diet bullet", `diet:eats:${i}`, `eats: ${b.text}`));
    d.eatenBy.forEach((b, i) => push(sci, "diet bullet", `diet:eatenBy:${i}`, `eaten by: ${b.text}`));
  }

  // --- gaps: what the page does NOT say, which an audit of claims alone hides
  const gapRows: { species: string; commonName: string; missing: string }[] = [];
  for (const [sci, t] of Object.entries(CATALOGUE)) {
    if (ONLY && sci !== ONLY && t.commonName !== ONLY) continue;
    const missing: string[] = [];
    for (const key of ["depth", "size", "habitat", "behaviour"] as const) {
      if (!FACTS[sci]?.[key]) missing.push(key);
    }
    if (!(DIETS[sci]?.eats?.length)) missing.push("eats");
    if (!(DIETS[sci]?.eatenBy?.length)) missing.push("eatenBy");
    if (missing.length) gapRows.push({ species: sci, commonName: t.commonName, missing: missing.join(", ") });
  }

  // ------------------------------------------------------------- report
  const total = rows.length;
  const by = (state: ClaimRow["state"]) => rows.filter((r) => r.state === state).length;

  if (AS_JSON) {
    console.log(JSON.stringify({ total, rows, gaps: gapRows }, null, 2));
    return;
  }

  console.log(`Claim audit: ${total} user-facing claims across ${new Set(rows.map((r) => r.species)).size} species\n`);

  const surfaces = [...new Set(rows.map((r) => r.surface))];
  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(`${pad("surface", 18)}${pad("total", 8)}${pad("unbound", 10)}${pad("bound", 8)}evidenced`);
  console.log("-".repeat(56));
  for (const s of surfaces) {
    const r = rows.filter((x) => x.surface === s);
    console.log(
      pad(s, 18) +
        pad(String(r.length), 8) +
        pad(String(r.filter((x) => x.state === "unbound").length), 10) +
        pad(String(r.filter((x) => x.state === "bound").length), 8) +
        String(r.filter((x) => x.state === "evidenced").length),
    );
  }
  console.log("-".repeat(56));
  console.log(
    pad("TOTAL", 18) + pad(String(total), 8) + pad(String(by("unbound")), 10) + pad(String(by("bound")), 8) + String(by("evidenced")),
  );

  const withIdentity = Object.values(file.species).filter((s) => s.identity).length;
  console.log(`\nIdentity spine: ${withIdentity}/${Object.keys(CATALOGUE).length} species resolved to a WoRMS anchor.`);

  // A claim audit that only counts what the page SAYS would score an empty
  // page perfectly, so the gaps are reported right beside it.
  const gapTally = gapRows.reduce((a, g) => a + g.missing.split(", ").length, 0);
  console.log(
    `Coverage: ${gapRows.length} species have an unfilled surface (${gapTally} of ${Object.keys(CATALOGUE).length * 6} possible).`,
  );
  if (SHOW_QUEUE && gapRows.length) {
    console.log("\nUnfilled surfaces:\n");
    for (const g of gapRows) console.log(`  ${g.commonName.padEnd(28)} ${g.missing}`);
  }

  if (SHOW_QUEUE) {
    // Teaching text first: it is what a user reads and acts on.
    const order = ["diagnostic mark", "field note", "fact tile", "diet bullet"];
    const queue = rows
      .filter((r) => r.state === "unbound")
      .sort((a, b) => order.indexOf(a.surface) - order.indexOf(b.surface) || a.species.localeCompare(b.species));
    console.log(`\nUnbound queue (${queue.length}), most user-visible first:\n`);
    for (const r of queue) console.log(`  [${r.surface}] ${r.commonName} :: ${r.key}\n      ${r.text}`);
  } else {
    console.log(`\nRun with -- --queue to list the unbound claims.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
