/**
 * Ground the food web's individual feeding links against FishBase's recorded
 * diet observations.
 *
 * The food web asserts 238 "A eats B" links. Most were written from general
 * UK/NE-Atlantic diet knowledge and carry a blanket disclaimer, which is not
 * the same as a reference. FishBase publishes per-species food-item records
 * (prey taxon, territory, predator life stage, with a source), so for the fish
 * predators each link can be checked against a real record rather than asserted.
 *
 * IMPORTANT, and the reason this script never builds a food-items URL itself:
 * FishBase renders that page's HEADING from the genus/species query parameters
 * but its ROWS from the stock code. Guess the stock code and you get a page
 * titled "Food Items - Pollachius pollachius" listing freshwater African
 * tilapia prey. So the only safe route is to follow the link the species'
 * own summary page publishes, which carries the correct stock code.
 *
 * A link is bound only when a prey record actually matches: by binomial, by the
 * prey's family (FishBase records many prey only to family, e.g. "Ammodytidae"),
 * or by an explicit common-name alias. Everything else is reported as unmatched
 * rather than quietly asserted.
 *
 *   npm run refs:diet [-- --limit N] [-- --dry-run]
 */

import { promises as fs } from "fs";
import path from "path";
import speciesTraitsData from "../../src/data/species-traits.json";
import { referenceFileSchema, type Claim, type ReferenceFile } from "../../src/lib/references/schema";
import { fetchText, pageText, sleep } from "./lib/http";
import { quotable } from "./lib/parse-sources";
import { E as FW_EDGES } from "../../food-web/build-foodweb.mjs";

const REFS = path.join(process.cwd(), "src", "data", "species-references.json");
const CACHE = path.join(process.cwd(), ".refs-cache");
const TODAY = new Date().toISOString().slice(0, 10);
const DELAY_MS = 900;
const READER = "refs:diet (FishBase food-item records)";

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const LIMIT = argv.includes("--limit") ? Number(argv[argv.indexOf("--limit") + 1]) : undefined;

type Traits = { commonName: string; shapeClass: string };
const CATALOGUE = speciesTraitsData as unknown as Record<string, Traits>;
const BY_COMMON = new Map<string, string>();
for (const [sci, t] of Object.entries(CATALOGUE)) BY_COMMON.set(t.commonName.toLowerCase(), sci);

/**
 * Food-web resource nodes are not taxa, so they can never match a FishBase
 * prey record by name. They are listed here so they are skipped deliberately
 * rather than counted as failures.
 */
const RESOURCE_NODES = new Set(["Kelp canopy", "Plankton", "Seabed biodeposits", "Farmed mussels"]);

/**
 * Prey terms FishBase uses that name our catalogue species without using the
 * binomial. Kept explicit and small: a fuzzy matcher here would invent support.
 */
const PREY_ALIASES: Record<string, string[]> = {
  "Sprattus sprattus": ["sprat", "sprats", "clupeidae"],
  "Ammodytes tobianus": ["sandeel", "sand eel", "ammodytidae"],
  "Trachurus trachurus": ["horse mackerel", "carangidae"],
  "Scomber scombrus": ["mackerel", "scombridae"],
  "Gadus morhua": ["cod", "gadidae"],
  "Merlangius merlangus": ["whiting", "gadidae"],
  "Trisopterus minutus": ["poor cod", "gadidae"],
  "Trisopterus luscus": ["bib", "pouting", "gadidae"],
  "Carcinus maenas": ["shore crab", "green crab", "portunidae", "carcinus"],
  "Cancer pagurus": ["edible crab", "cancer", "cancridae"],
  "Necora puber": ["velvet", "portunidae"],
  "Pagurus bernhardus": ["hermit crab", "paguridae", "pagurus"],
  "Sepia officinalis": ["cuttlefish", "sepiidae", "sepia"],
  "Ophiothrix fragilis": ["brittle star", "brittlestar", "ophiuroidea", "ophiothrix"],
  "Asterias rubens": ["starfish", "asteroidea", "asterias"],
  "Patella vulgata": ["limpet", "patellidae", "patella"],
  "Nucella lapillus": ["dog whelk", "nucella", "muricidae"],
  // Group-level catalogue entry: FishBase records UK spider crabs under the
  // constituent genera, never under the superfamily name.
  Majoidea: ["maja", "majidae", "hyas", "inachus", "macropodia", "spider crab", "oregoniidae"],
  // FishBase commonly records small gobies only to genus or family.
  "Pomatoschistus microps": ["gobiidae", "pomatoschistus"],
  "Pomatoschistus minutus": ["gobiidae", "pomatoschistus"],
  "Gobius paganellus": ["gobiidae", "gobius"],
  "Gobiusculus flavescens": ["gobiidae", "pomatoschistus flavescens", "gobiusculus"],
  "Callionymus lyra": ["callionymus", "callionymidae"],
  "Callionymus maculatus": ["callionymus", "callionymidae"],
};


/**
 * FishBase's food table has category columns (Food I / Food II / Food III) whose
 * values are labels, not prey. "squids/cuttlefish" is a CATEGORY; the actual
 * prey on that row might be an octopus. Matching a label is not evidence of
 * anything, so the labels are stripped before searching.
 */
const FISHBASE_CATEGORY_LABELS = [
  "squids/cuttlefish",
  "finfish",
  "bony fish",
  "cartilaginous fish",
  "crustaceans",
  "crabs",
  "shrimps/prawns",
  "molluscs",
  "bivalves",
  "gastropods",
  "cephalopods",
  "echinoderms",
  "starfish",
  "sea urchins",
  "worms",
  "polychaetes",
  "zoobenthos",
  "zooplankton",
  "phytoplankton",
  "detritus",
  "others",
  "n.a./others",
  "benth. crust.",
  "other terrest. invertebrates",
];

/**
 * Does the diet blob NAME this prey, as a word?
 *
 * Bare substring matching produced four wrong citations: the alias "carcinus"
 * for the shore crab (Carcinus maenas) matched inside "LioCARCINUS holsatus",
 * a swimming crab in a different family. So the term must sit on word
 * boundaries, and the FishBase category labels are removed first so a match
 * cannot land on a column heading.
 */
export function namesPrey(blob: string, term: string): boolean {
  let hay = blob;
  for (const label of FISHBASE_CATEGORY_LABELS) {
    hay = hay.split(label).join(" ");
  }
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i").test(hay);
}

async function cached(key: string, url: string): Promise<string | null> {
  await fs.mkdir(CACHE, { recursive: true });
  const file = path.join(CACHE, `${key.replace(/[^a-z0-9]+/gi, "_")}.html`);
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    await sleep(DELAY_MS);
    // FishBase is slow (~30s); the default timeout clips it.
    const res = await fetchText(url, { timeoutMs: 90_000 });
    if (!res.ok) return null;
    await fs.writeFile(file, res.text, "utf8");
    return res.text;
  }
}

/** The food-items link a FishBase summary page publishes for itself. */
function foodItemsUrl(summaryHtml: string): string | null {
  const m = /(?:\.\.\/)?TrophicEco\/FoodItemsList\.php\?[^"'>\s]+/i.exec(summaryHtml);
  if (!m) return null;
  const rel = m[0].replace(/^\.\.\//, "");
  return `https://www.fishbase.se/${rel}`.replace(/&amp;/g, "&");
}

/** Everything after the food-items table header, as one searchable blob. */
function foodItemsText(html: string): string | null {
  const text = pageText(html);
  const i = text.indexOf("Food items reported for");
  if (i < 0) return null;
  const end = text.indexOf("Entered by", i);
  return text.slice(i, end > i ? end : undefined);
}

async function main() {
  const file: ReferenceFile = referenceFileSchema.parse(JSON.parse(await fs.readFile(REFS, "utf8")));

  // Predator -> the prey nodes the food web claims it eats.
  const edgesByPredator = new Map<string, string[]>();
  for (const [prey, predator] of FW_EDGES as Array<[string, string]>) {
    const list = edgesByPredator.get(predator) ?? [];
    list.push(prey);
    edgesByPredator.set(predator, list);
  }

  let predators = [...edgesByPredator.keys()].filter((p) => {
    const sci = BY_COMMON.get(p.toLowerCase());
    return sci && file.species[sci]?.sourceIds.some((s) => s.startsWith("fishbase:"));
  });
  if (LIMIT) predators = predators.slice(0, LIMIT);

  console.log(`Checking feeding links for ${predators.length} fish predator(s)${DRY ? " (dry run)" : ""}\n`);

  let boundCount = 0;
  const unmatched: string[] = [];
  const noRecords: string[] = [];

  for (const [i, predatorCommon] of predators.entries()) {
    const sci = BY_COMMON.get(predatorCommon.toLowerCase())!;
    const entry = file.species[sci];
    const fishbaseId = entry.sourceIds.find((s) => s.startsWith("fishbase:"))!;
    const summaryUrl = file.sources[fishbaseId]?.url;
    if (!summaryUrl) continue;

    const summary = await cached(fishbaseId, summaryUrl);
    const foodUrl = summary ? foodItemsUrl(summary) : null;
    if (!foodUrl) {
      noRecords.push(`${predatorCommon}: summary page publishes no food-items link`);
      continue;
    }
    const foodHtml = await cached(`${fishbaseId}__food`, foodUrl);
    const blob = foodHtml ? foodItemsText(foodHtml) : null;
    if (!blob) {
      noRecords.push(`${predatorCommon}: food-items page had no readable record table`);
      continue;
    }
    // Sanity check: the page must be about this predator, not a stock-code
    // mix-up. Test the accepted name as well as the catalogue key, since
    // FishBase lists the two-spotted goby under Pomatoschistus flavescens
    // while our catalogue still keys it as Gobiusculus flavescens.
    const predatorNames = [sci, entry.identity?.acceptedName].filter(Boolean) as string[];
    if (!predatorNames.some((n) => blob.toLowerCase().includes(n.toLowerCase()))) {
      noRecords.push(
        `${predatorCommon}: food-items page named none of ${predatorNames.join(" / ")} (possible stock-code mismatch, skipped)`,
      );
      continue;
    }
    const haystack = blob.toLowerCase();

    const claims: Record<string, Claim> = { ...entry.claims };
    let boundHere = 0;
    for (const prey of edgesByPredator.get(predatorCommon) ?? []) {
      if (RESOURCE_NODES.has(prey)) continue;
      const preySci = BY_COMMON.get(prey.toLowerCase());
      const terms = [
        preySci?.toLowerCase(),
        // The prey's family, since FishBase often records prey only to family.
        preySci ? file.species[preySci]?.identity?.family?.toLowerCase() : undefined,
        ...(preySci ? (PREY_ALIASES[preySci] ?? []) : []),
      ].filter(Boolean) as string[];

      const hit = terms.find((t) => t.length > 3 && namesPrey(haystack, t));
      const key = `edge:${prey}->${predatorCommon}`;
      if (!hit) {
        unmatched.push(`${predatorCommon} eats ${prey}: no FishBase food-item record matched`);
        continue;
      }
      if (claims[key]?.claimSupported) continue;

      // Quote the surrounding record so a reviewer sees the actual row.
      const at = haystack.indexOf(hit);
      const excerpt = blob.slice(Math.max(0, at - 90), at + 120);
      claims[key] = {
        sourceIds: [fishbaseId],
        support: [
          {
            sourceId: fishbaseId,
            locator: `Food items (matched on "${hit}")`,
            quote: quotable(excerpt),
            readBy: READER,
            readOn: TODAY,
          },
        ],
        claimSupported: false,
      };
      boundHere++;
      boundCount++;
    }

    file.species[sci] = { ...entry, claims };
    console.log(
      `[${i + 1}/${predators.length}] ${predatorCommon.padEnd(26)} ${boundHere}/${(edgesByPredator.get(predatorCommon) ?? []).filter((p) => !RESOURCE_NODES.has(p)).length} links matched to a diet record`,
    );
  }

  const parsed = referenceFileSchema.parse(file);
  if (DRY) {
    console.log(`\n[dry run] would bind ${boundCount} feeding link(s)`);
  } else {
    await fs.writeFile(REFS, JSON.stringify(parsed, null, 2) + "\n", "utf8");
    console.log(`\nBound ${boundCount} feeding link(s) to a FishBase diet record.`);
  }

  if (noRecords.length) {
    console.log(`\n${noRecords.length} predator(s) had no usable diet page:`);
    for (const n of noRecords) console.log(`  - ${n}`);
  }
  if (unmatched.length) {
    console.log(`\n${unmatched.length} feeding link(s) have NO matching diet record and stay unsourced:`);
    for (const u of unmatched) console.log(`  - ${u}`);
    console.log(
      `\nThat is a finding, not a failure. Each is either a real gap in FishBase's records or a\nlink the food web asserts more confidently than the evidence allows. Review before publishing.`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
