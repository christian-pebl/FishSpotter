// Seeds Taxon + TaxonAlias from data/species-master.json + manual functional-group entries.
// Idempotent — safe to re-run.

import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();
const DATA_FILE = path.join(__dirname, "..", "data", "species-master.json");

// ---------- Helpers ----------

/** Normalize a string for alias matching: lowercase, collapse whitespace, strip diacritics, drop leading articles. */
export function normalizeAlias(s) {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^(a|an|the)\s+/i, "")
    .trim();
}

/** Normalise scientific name (collapse double spaces, drop trailing periods on "sp."/"spp."). */
function cleanScientific(s) {
  if (!s) return null;
  const c = s.replace(/\s+/g, " ").trim();
  if (!c || c === "-") return null;
  if (c.includes(";") || c.includes(":")) return null;
  if (c === "(Genus)") return null;
  return c;
}

function cleanCommon(s) {
  if (!s) return null;
  const c = s.trim();
  if (!c || c === "-") return null;
  if (c.includes(";") || c.includes(":")) return null; // garbage like "Whiting:Common Hermit Crab"
  if (c.length > 60) return null; // probably a full sentence note
  return c;
}

/** Pick the best display name for a taxon: prefer capitalised English common name, fall back to scientific. */
function pickDisplayName(commonNames, sci) {
  const capitalisedCommon = commonNames.find((c) => /[A-Z]/.test(c[0] ?? ""));
  if (capitalisedCommon) return capitalisedCommon;
  if (commonNames.length > 0) {
    return commonNames[0]
      .split(" ")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ");
  }
  return sci ?? "Unknown";
}

// ---------- Manual functional-group taxa ----------
// These map 1-1 to the AI's functional_group tags in metadata.json.

const functionalGroups = [
  {
    name: "Crab",
    funFact: "Sideways-walking crustaceans. North Devon waters host common shore crabs, hermit crabs, and the occasional spiny spider crab.",
    description: "Crabs are decapod crustaceans with a hard shell and ten legs (the front pair modified into pincers). They scavenge, hunt, and play a key role in the seabed food web.",
    aliases: ["crab", "crabs"],
  },
  {
    name: "Fish",
    funFact: "Bideford Bay's fish life shifts with the seasons — whiting and pouting form winter shoals; cod and bream pass through.",
    description: "A general grouping for fish where the species hasn't been confidently identified yet. Help us narrow it down by looking at body shape, fin position, and markings.",
    aliases: ["fish", "fishes"],
  },
  {
    name: "Flatfish",
    funFact: "Flatfish start life with eyes on both sides, then one eye migrates as they mature into bottom-dwellers.",
    description: "Flatfish lie camouflaged on the seabed with both eyes on one side of their body. North Devon flatfish include flounder, plaice, dab, and lemon sole.",
    aliases: ["flatfish", "flat fish"],
  },
  {
    name: "Jellyfish",
    funFact: "Most jellyfish are 95% water and have no brain, heart, or bones — they drift with the current and pulse to feed.",
    description: "Jellyfish are gelatinous, free-swimming plankton. Common UK species include moon jellyfish (harmless) and lion's mane (stings).",
    aliases: ["jellyfish", "jelly fish", "jellies"],
  },
  {
    name: "Gastropod",
    funFact: "Marine gastropods include whelks, top shells, and sea snails — many feed on barnacles or scavenge dead matter.",
    description: "Gastropods are single-shelled molluscs (sea snails, whelks, limpets). They're slow-moving but ecologically vital — many are predators of barnacles or filter feeders themselves.",
    aliases: ["gastropod", "gastropods", "sea snail", "snail"],
  },
  {
    name: "Scooter",
    funFact: "Working term for fast-darting bottom fish — usually sand gobies or similar small species that 'scoot' along the seabed.",
    description: "PEBL working term for small, fast-moving bottom fish that dart along the seabed. Most often these are sand gobies (Pomatoschistus minutus).",
    aliases: ["scooter", "scooters"],
  },
];

// ---------- Main ----------

async function main() {
  const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  console.log(`Loaded ${raw.length} entries from species-master.json`);

  // Dedupe & clean
  const cleaned = new Map(); // sci OR common-as-key → entry
  for (const e of raw) {
    const sci = e.scientific_names.map(cleanScientific).find((s) => s);
    const commons = e.common_names.map(cleanCommon).filter(Boolean);
    const genera = e.genera.filter((g) => g && g !== "(Genus)");
    if (!sci && commons.length === 0) continue;
    const dedupKey = sci ?? `_common:${commons[0].toLowerCase()}`;
    const existing = cleaned.get(dedupKey);
    if (existing) {
      existing.commons = Array.from(new Set([...existing.commons, ...commons]));
      existing.genera = Array.from(new Set([...existing.genera, ...genera]));
      existing.count += e.occurrence_count;
    } else {
      cleaned.set(dedupKey, { sci, commons, genera, count: e.occurrence_count });
    }
  }
  // Sort by occurrence (descending) — more-common taxa claim shared aliases first
  const ordered = Array.from(cleaned.values()).sort((a, b) => b.count - a.count);
  console.log(`Cleaned to ${ordered.length} unique taxa`);

  // ----- Insert functional groups -----
  let fgInserted = 0;
  for (const fg of functionalGroups) {
    const existing = await prisma.taxon.findFirst({ where: { name: fg.name, isFunctionalGroup: true } });
    let taxon;
    if (existing) {
      taxon = await prisma.taxon.update({
        where: { id: existing.id },
        data: { funFact: fg.funFact, description: fg.description },
      });
    } else {
      taxon = await prisma.taxon.create({
        data: {
          name: fg.name,
          isFunctionalGroup: true,
          funFact: fg.funFact,
          description: fg.description,
        },
      });
      fgInserted++;
    }
    for (const a of fg.aliases) {
      const norm = normalizeAlias(a);
      if (!norm) continue;
      try {
        await prisma.taxonAlias.upsert({
          where: { alias: norm },
          create: { taxonId: taxon.id, alias: norm, display: a, source: "common" },
          update: {},
        });
      } catch (e) {
        // alias taken — skip (a more-common taxon claimed it)
      }
    }
  }
  console.log(`Functional groups: ${fgInserted} new, ${functionalGroups.length - fgInserted} updated`);

  // ----- Insert species/genus taxa -----
  let speciesInserted = 0;
  let aliasesInserted = 0;
  for (const t of ordered) {
    const displayName = pickDisplayName(t.commons, t.sci);
    if (!displayName) continue;

    let taxon;
    if (t.sci) {
      taxon = await prisma.taxon.upsert({
        where: { scientificName: t.sci },
        create: { name: displayName, scientificName: t.sci },
        update: { name: displayName },
      });
    } else {
      // No scientific name → look up by display name (functional-group-like, e.g. "whelk")
      const existing = await prisma.taxon.findFirst({
        where: { name: displayName, scientificName: null, isFunctionalGroup: false },
      });
      taxon = existing ?? (await prisma.taxon.create({ data: { name: displayName } }));
    }
    if (taxon.createdAt.getTime() === taxon.updatedAt.getTime()) speciesInserted++;

    // Aliases
    const aliasSpecs = [];
    if (t.sci) aliasSpecs.push({ display: t.sci, source: "scientific" });
    for (const c of t.commons) aliasSpecs.push({ display: c, source: "common" });
    for (const g of t.genera) aliasSpecs.push({ display: g, source: "scientific" });

    for (const { display, source } of aliasSpecs) {
      const norm = normalizeAlias(display);
      if (!norm) continue;
      try {
        const result = await prisma.taxonAlias.upsert({
          where: { alias: norm },
          create: { taxonId: taxon.id, alias: norm, display, source },
          update: {},
        });
        if (result.taxonId === taxon.id) aliasesInserted++;
      } catch (e) {
        // Race / unique violation — ignore
      }
    }
  }

  console.log(`Species/genus taxa: ${speciesInserted} new`);
  console.log(`Aliases inserted: ${aliasesInserted}`);

  // Summary
  const total = await prisma.taxon.count();
  const totalAliases = await prisma.taxonAlias.count();
  console.log(`\nFinal: ${total} taxa, ${totalAliases} aliases.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
