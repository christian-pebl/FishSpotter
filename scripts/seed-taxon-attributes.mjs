// Seeds TaxonAttribute rows from a hand-curated mapping.
// Each entry is annotated with the validation source and any uncertainty.
//
// Attribute keys + valid values must mirror src/lib/id-guide-questions.ts:
//   functionalGroup: fish | crab | jellyfish | gastropod | echinoderm | cephalopod
//   bodyShape:       (fish)      streamlined | flat | eel-like | round-globular
//                    (crab)      squarish | hidden-in-shell | long-legged
//                    (jellyfish) bell-shape | elongated | comb-like
//                    (others omitted; Q4 is skipped for those FGs)
//   locomotion:      swimming | darting | drifting | crawling | stationary | hidden
//   screenZone:      surface | midwater | seabed
//   colorTag:        silvery | sandy | red | mottled | dark | striped | translucent
//
// Idempotent. Re-run safely.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Mapping keyed by canonical scientific name (or display name for FGs).
 * Sources noted in comments where non-obvious.
 *   FB = FishBase, M = Marine Conservation Society / MarLIN, K = general knowledge of N. Atlantic temperate fauna.
 */
const ATTRS = {
  // ─── Functional groups (self-tag for matching at FG level) ────────────────
  "Crab":      { functionalGroup: "crab",      locomotion: ["crawling"],             screenZone: ["seabed"] },
  "Fish":      { functionalGroup: "fish",      locomotion: ["swimming"],             screenZone: ["midwater"] },
  "Flatfish":  { functionalGroup: "fish",      bodyShape: "flat",   locomotion: ["stationary","crawling"], screenZone: ["seabed"], colorTag: ["mottled","sandy"] },
  "Gastropod": { functionalGroup: "gastropod", locomotion: ["crawling","stationary"],screenZone: ["seabed"] },
  "Jellyfish": { functionalGroup: "jellyfish", locomotion: ["drifting"],             screenZone: ["midwater"] },
  "Scooter":   { functionalGroup: "fish",      bodyShape: "streamlined", locomotion: ["darting"], screenZone: ["seabed"], colorTag: ["sandy"] }, // PEBL working term, mostly sand gobies

  // ─── Crustaceans ──────────────────────────────────────────────────────────
  "Pagurus bernhardus":   { functionalGroup: "crab", bodyShape: "hidden-in-shell", locomotion: ["crawling"], screenZone: ["seabed"], colorTag: ["sandy","mottled"] }, // K — common in N. Devon
  "Pagurus":              { functionalGroup: "crab", bodyShape: "hidden-in-shell", locomotion: ["crawling"], screenZone: ["seabed"], colorTag: ["sandy","mottled"] }, // genus level — same body plan
  "Paguridae":            { functionalGroup: "crab", bodyShape: "hidden-in-shell", locomotion: ["crawling"], screenZone: ["seabed"], colorTag: ["sandy","mottled"] }, // family level
  "Carcinus maenas":      { functionalGroup: "crab", bodyShape: "squarish",        locomotion: ["crawling"], screenZone: ["seabed"], colorTag: ["dark","mottled"] }, // K — green shore crab, very common UK
  "Maja squinado":        { functionalGroup: "crab", bodyShape: "long-legged",     locomotion: ["crawling"], screenZone: ["seabed"], colorTag: ["sandy","red"] },    // M — spiny spider crab, common UK
  "Portumnus latipes":    { functionalGroup: "crab", bodyShape: "squarish",        locomotion: ["crawling","swimming"], screenZone: ["seabed"], colorTag: ["sandy"] }, // FB — pennant's swimming crab; back legs paddle-shaped, occasional swimmer
  "Brachyura or Anomura": { functionalGroup: "crab", locomotion: ["crawling"], screenZone: ["seabed"] }, // uncertain crab — broad tag only
  "Cumacea":              { functionalGroup: "crab", locomotion: ["hidden","crawling"], screenZone: ["seabed"], colorTag: ["sandy"] }, // tiny shrimp-like, often half-buried; tagged loosely as "crab" group (closest match in our 6 FGs)

  // ─── Round-bodied bony fish (cod / pouting / pollack family) ──────────────
  "Gadus morhua":          { functionalGroup: "fish", bodyShape: "streamlined", locomotion: ["swimming"], screenZone: ["midwater","seabed"], colorTag: ["mottled","sandy"] }, // FB
  "Pollachius pollachius": { functionalGroup: "fish", bodyShape: "streamlined", locomotion: ["swimming"], screenZone: ["midwater"],          colorTag: ["dark","silvery"] }, // FB — dark green-brown back, silver belly
  "Trisopterus minutus":   { functionalGroup: "fish", bodyShape: "streamlined", locomotion: ["swimming"], screenZone: ["midwater"],          colorTag: ["sandy"] }, // FB — poor cod
  "Trisopterus luscus":    { functionalGroup: "fish", bodyShape: "streamlined", locomotion: ["swimming"], screenZone: ["midwater"],          colorTag: ["sandy","striped"] }, // FB — pouting (corrected from 'iuscus' typo)
  "Trisopterus":           { functionalGroup: "fish", bodyShape: "streamlined", locomotion: ["swimming"], screenZone: ["midwater"],          colorTag: ["sandy"] }, // genus
  "Trisopterus sp.":       { functionalGroup: "fish", bodyShape: "streamlined", locomotion: ["swimming"], screenZone: ["midwater"],          colorTag: ["sandy"] }, // species placeholder
  "Trisopterus sp":        { functionalGroup: "fish", bodyShape: "streamlined", locomotion: ["swimming"], screenZone: ["midwater"],          colorTag: ["sandy"] }, // dup
  "Merlangius merlangus":  { functionalGroup: "fish", bodyShape: "streamlined", locomotion: ["swimming"], screenZone: ["midwater"],          colorTag: ["silvery"] }, // FB — whiting
  "Spondyliosoma cantharus": { functionalGroup: "fish", bodyShape: "streamlined", locomotion: ["swimming"], screenZone: ["midwater"],        colorTag: ["dark","silvery"] }, // FB — black sea bream

  // ─── Flatfish ──────────────────────────────────────────────────────────────
  "Platichthys flesus":   { functionalGroup: "fish", bodyShape: "flat", locomotion: ["stationary","crawling"], screenZone: ["seabed"], colorTag: ["mottled","sandy"] }, // K — flounder
  "Scophthalmus maximus": { functionalGroup: "fish", bodyShape: "flat", locomotion: ["stationary"],            screenZone: ["seabed"], colorTag: ["mottled","sandy"] }, // WoRMS-accepted name for turbot (formerly Psetta maxima)
  "Pleuronectiformes":    { functionalGroup: "fish", bodyShape: "flat", locomotion: ["stationary","crawling"], screenZone: ["seabed"], colorTag: ["mottled"] }, // order

  // ─── Gobies + dragonets (small bottom-darting fish) ────────────────────────
  "Pomatoschistus minutus": { functionalGroup: "fish", bodyShape: "streamlined", locomotion: ["darting","stationary"], screenZone: ["seabed"], colorTag: ["sandy"] }, // K — sand goby
  "Gobiusculus flavescens": { functionalGroup: "fish", bodyShape: "streamlined", locomotion: ["darting"],            screenZone: ["seabed","midwater"], colorTag: ["sandy"] }, // FB — twospot goby
  "Callionymus lyra":       { functionalGroup: "fish", bodyShape: "streamlined", locomotion: ["stationary","crawling"], screenZone: ["seabed"], colorTag: ["mottled","sandy"] }, // FB — common dragonet (males brightly coloured but mottled overall)
  "Callionymus maculatus":  { functionalGroup: "fish", bodyShape: "streamlined", locomotion: ["stationary","crawling"], screenZone: ["seabed"], colorTag: ["mottled","sandy"] }, // FB — spotted dragonet
  "Callionymidae":          { functionalGroup: "fish", bodyShape: "streamlined", locomotion: ["stationary","crawling"], screenZone: ["seabed"], colorTag: ["mottled","sandy"] }, // family

  // ─── Eel-shaped + small bottom dwellers ───────────────────────────────────
  "Ammodytes sp.":         { functionalGroup: "fish", bodyShape: "eel-like", locomotion: ["swimming","hidden"], screenZone: ["midwater","seabed"], colorTag: ["silvery"] }, // K — sand eels
  "Ammodytidae spp.":      { functionalGroup: "fish", bodyShape: "eel-like", locomotion: ["swimming","hidden"], screenZone: ["midwater","seabed"], colorTag: ["silvery"] },
  "Hyperoplus lanceolatus":{ functionalGroup: "fish", bodyShape: "eel-like", locomotion: ["swimming"],          screenZone: ["midwater"],          colorTag: ["silvery"] }, // FB — greater sand-eel
  "Lipophrys pholis":      { functionalGroup: "fish", bodyShape: "eel-like", locomotion: ["crawling","stationary"], screenZone: ["seabed"], colorTag: ["mottled","dark"] }, // FB — shanny

  // ─── Gurnards + sea scorpions (bony, demersal) ────────────────────────────
  "Eutrigla gurnardus":     { functionalGroup: "fish", bodyShape: "streamlined", locomotion: ["crawling"], screenZone: ["seabed"], colorTag: ["sandy","mottled"] }, // FB — grey gurnard
  "Chelidonichthys lucerna":{ functionalGroup: "fish", bodyShape: "streamlined", locomotion: ["crawling"], screenZone: ["seabed"], colorTag: ["red"] }, // FB — tub gurnard
  // Sea scorpions: ambiguity in our data — labeller wrote "Myoxocephalus/Taurulus  scorpius/bubalis"
  // Both are similar sculpins. Tag once with that exact key:
  "Myoxocephalus/Taurulus scorpius/bubalis": { functionalGroup: "fish", bodyShape: "streamlined", locomotion: ["stationary"], screenZone: ["seabed"], colorTag: ["mottled","dark"] }, // K

  // ─── Mid-water shoaling silvery fish ──────────────────────────────────────
  "Trachurus trachurus": { functionalGroup: "fish", bodyShape: "streamlined", locomotion: ["swimming"], screenZone: ["midwater"], colorTag: ["silvery"] }, // FB — scad
  "Alosa fallax":          { functionalGroup: "fish", bodyShape: "streamlined", locomotion: ["swimming"], screenZone: ["midwater"], colorTag: ["silvery"] }, // FB — twaite shad
  "Mullus surmuletus":     { functionalGroup: "fish", bodyShape: "streamlined", locomotion: ["swimming","crawling"], screenZone: ["seabed","midwater"], colorTag: ["red","striped"] }, // FB — red mullet

  // ─── Sharks (catshark family) ─────────────────────────────────────────────
  "Scyliorhinus stellaris": { functionalGroup: "fish", bodyShape: "eel-like", locomotion: ["swimming","stationary"], screenZone: ["seabed"], colorTag: ["mottled"] }, // K — nursehound (large dark spots)
  "Scyliorhinus canicula":  { functionalGroup: "fish", bodyShape: "eel-like", locomotion: ["swimming","stationary"], screenZone: ["seabed"], colorTag: ["mottled"] }, // K — small-spotted catshark (small dark dots)

  // ─── Jellyfish + ctenophores ──────────────────────────────────────────────
  "Aurelia aurita":     { functionalGroup: "jellyfish", bodyShape: "bell-shape", locomotion: ["drifting"], screenZone: ["midwater"], colorTag: ["translucent"] }, // K — moon jellyfish
  "Cyanea lamarckii":   { functionalGroup: "jellyfish", bodyShape: "bell-shape", locomotion: ["drifting"], screenZone: ["midwater"], colorTag: ["translucent","dark"] }, // K — blue jellyfish
  "Cyanea capillata":   { functionalGroup: "jellyfish", bodyShape: "bell-shape", locomotion: ["drifting"], screenZone: ["midwater","surface"], colorTag: ["red"] }, // K — lion's mane jellyfish (corrected from 'capitata' typo)
  "Pleurobrachia pileus": { functionalGroup: "jellyfish", bodyShape: "comb-like", locomotion: ["drifting"], screenZone: ["midwater"], colorTag: ["translucent"] }, // K — sea gooseberry (a ctenophore but visually jellyfish-like)
  "Ctenophora":         { functionalGroup: "jellyfish", bodyShape: "comb-like", locomotion: ["drifting"], screenZone: ["midwater"], colorTag: ["translucent"] }, // phylum

  // ─── Echinoderms ──────────────────────────────────────────────────────────
  "Asterias rubens":  { functionalGroup: "echinoderm", locomotion: ["crawling","stationary"], screenZone: ["seabed"], colorTag: ["red","sandy"] }, // K — common starfish
  "Ophiuroidea":      { functionalGroup: "echinoderm", locomotion: ["crawling"],              screenZone: ["seabed"], colorTag: ["sandy","mottled"] }, // class — brittle stars

  // ─── Cephalopods ──────────────────────────────────────────────────────────
  "Alloteuthis subulata": { functionalGroup: "cephalopod", locomotion: ["swimming","darting"], screenZone: ["midwater"], colorTag: ["translucent"] }, // FB — European common squid

  // ─── Marine snails ────────────────────────────────────────────────────────
  "Nucella lapillus": { functionalGroup: "gastropod", locomotion: ["crawling","stationary"], screenZone: ["seabed"], colorTag: ["sandy","mottled"] }, // K — dog whelk
};

/**
 * Special handling for taxa stored with NULL scientificName: match by display name.
 * These are mostly placeholders we leave un-tagged, but we add a few generic ones.
 */
// Fallbacks for taxa stored with NULL scientificName (mostly the 6 functional-group rows).
// "Cod", "Dragonet", "Sand Goby", "Whelk", "Sideways Crab" were removed by cleanup-taxa.mjs.
const NAME_FALLBACKS = {
  "Hermit Crab":      { functionalGroup: "crab", bodyShape: "hidden-in-shell", locomotion: ["crawling"], screenZone: ["seabed"], colorTag: ["sandy","mottled"] },
  "Unknown Jellyfish":{ functionalGroup: "jellyfish", locomotion: ["drifting"], screenZone: ["midwater"], colorTag: ["translucent"] },
  "Unclassified Crab":{ functionalGroup: "crab", locomotion: ["crawling"], screenZone: ["seabed"] },
};

async function tagOne(taxon, attrs) {
  const ops = [];
  for (const [key, raw] of Object.entries(attrs)) {
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) {
      ops.push(
        prisma.taxonAttribute.upsert({
          where: { taxonId_key_value: { taxonId: taxon.id, key, value } },
          create: { taxonId: taxon.id, key, value, source: "manual" },
          update: {},
        })
      );
    }
  }
  await Promise.all(ops);
  return ops.length;
}

async function main() {
  const taxa = await prisma.taxon.findMany({
    select: { id: true, name: true, scientificName: true, isFunctionalGroup: true },
  });

  let tagged = 0;
  let totalAttrs = 0;
  let untagged = [];

  for (const t of taxa) {
    let attrs = null;
    if (t.scientificName && ATTRS[t.scientificName]) {
      attrs = ATTRS[t.scientificName];
    } else if (!t.scientificName && NAME_FALLBACKS[t.name]) {
      attrs = NAME_FALLBACKS[t.name];
    } else if (t.isFunctionalGroup && ATTRS[t.name]) {
      attrs = ATTRS[t.name];
    }

    if (!attrs) {
      untagged.push(`${t.scientificName ?? "(no sci)"} | ${t.name}`);
      continue;
    }

    const n = await tagOne(t, attrs);
    tagged++;
    totalAttrs += n;
  }

  console.log(`Tagged ${tagged} taxa with ${totalAttrs} attribute rows.`);
  if (untagged.length > 0) {
    console.log(`\nNot tagged (${untagged.length}):`);
    for (const u of untagged) console.log("  -", u);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
