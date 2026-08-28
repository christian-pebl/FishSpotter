/**
 * Read-only claim audit: enumerate EVERY factual claim the app makes about a
 * species, and report which ones are bound to a source, which are bound but
 * unevidenced, and which are asserted with nothing behind them at all.
 *
 * This is the work queue for the grounding effort, and afterwards the honest
 * scorecard. It never writes, and it never sets a trust flag.
 *
 * Claims audited:
 *   fieldNote          the prose field note on the species guide
 *   trait:size/habitat/behavior   the three fact tiles on the guide
 *   mark:<id>          each diagnostic-mark description (the teaching text)
 *   diet:eats/eatenBy  the species-level diet statements on the workshop card
 *   trophic:tier       its trophic tier in the food web
 *   edge:<a>-><b>      each individual feeding link in the food web
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
import { referenceFileSchema, type ReferenceFile } from "../../src/lib/references/schema";
import { SPECIES as FW_SPECIES, E as FW_EDGES } from "../../food-web/build-foodweb.mjs";

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

  // --- guide prose + fact tiles
  for (const [sci, t] of Object.entries(CATALOGUE)) {
    if (t.fieldNote) push(sci, "field note", "fieldNote", t.fieldNote);
    push(sci, "trait tile", "trait:size", `Size: ${t.size}`);
    push(sci, "trait tile", "trait:habitat", `Habitat: ${t.habitat.join(", ")}`);
    push(sci, "trait tile", "trait:behavior", `Behaviour: ${t.behavior.join(", ")}`);
  }

  // --- diagnostic marks (the actual teaching text, and the biggest risk)
  for (const m of marks) {
    push(m.scientificName, "diagnostic mark", `mark:${m.id}`, `${m.label}: ${m.description}`);
  }

  // --- food web: tier, farm role, species-level diet, and each feeding link
  const unmapped = new Set<string>();
  for (const s of FW_SPECIES as Array<{ name: string; tier: number }>) {
    const sci = sciFor(s.name);
    if (!sci) {
      unmapped.add(s.name);
      continue;
    }
    push(sci, "food web", "trophic:tier", `Trophic tier ${s.tier}`);
    // farm:role is NOT audited any more. The created / enhanced / harmed
    // classification was withdrawn on 28 Aug 2026 after none of its 21
    // "created" assignments survived a check against the literature, so the
    // app makes no such claim and counting 72 of them as "unsourced" would
    // inflate the denominator with statements nobody makes.
    push(sci, "workshop card", "diet:eats", "I eat (species-level diet statement)");
    push(sci, "workshop card", "diet:eatenBy", "Eats me (species-level predator statement)");
  }
  for (const [prey, predator] of FW_EDGES as Array<[string, string]>) {
    const sci = sciFor(predator);
    if (!sci) {
      unmapped.add(predator);
      continue;
    }
    push(sci, "feeding link", `edge:${prey}->${predator}`, `${predator} eats ${prey}`);
  }

  // ------------------------------------------------------------- report
  const total = rows.length;
  const by = (state: ClaimRow["state"]) => rows.filter((r) => r.state === state).length;

  if (AS_JSON) {
    console.log(JSON.stringify({ total, rows, unmapped: [...unmapped] }, null, 2));
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

  if (unmapped.size) {
    console.log(`\n${unmapped.size} food-web node(s) do not map to a catalogue species (resources, or a name drift):`);
    for (const u of [...unmapped].sort()) console.log(`  - ${u}`);
  }

  if (SHOW_QUEUE) {
    // Teaching text first: it is what a user reads and acts on.
    const order = ["diagnostic mark", "field note", "workshop card", "trait tile", "food web", "feeding link"];
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
