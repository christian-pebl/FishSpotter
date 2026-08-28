/**
 * Reference identity spine: resolve every catalogue species to a verified
 * taxonomic anchor plus the open-access pages that can carry its claims.
 *
 *   WoRMS     -> AphiaID, accepted name, authority, classification (all species)
 *   MarLIN    -> the UK-specific species page, resolved by search then PROVED
 *                by fetching the candidate and checking it names the species
 *   FishBase  -> /summary/<Genus>-<species>.html (fish and flatfish only)
 *   BTO       -> BirdFacts page (the three birds MarLIN does not carry)
 *
 * Nothing is recorded on faith. A candidate URL is only written once the
 * fetched document says in its own TITLE that it is about this species (or,
 * for BTO's vernacular titles, names the bird in the title and the binomial in
 * the body). A mention in the body is not enough: MarLIN's common-mussel page
 * names both plaice and dab, which is how an earlier body-containment test
 * bound two flatfish to a bivalve. Anything that cannot be proved is reported
 * as unresolved rather than guessed at.
 *
 * Writes src/data/species-references.json, MERGING into whatever is already
 * there, so hand-authored claim bindings are never clobbered by a re-run.
 *
 *   npx tsx scripts/refs/resolve-identity.ts [--species "X"] [--limit N] [--dry-run] [--force]
 */

import { promises as fs } from "fs";
import path from "path";
import speciesTraitsData from "../../src/data/species-traits.json";
import speciesImagesData from "../../src/data/species-images.json";
import { referenceFileSchema, type ReferenceFile, type Source } from "../../src/lib/references/schema";
import { fetchJson, fetchText, identityMatch, sleep } from "./lib/http";

const OUT = path.join(process.cwd(), "src", "data", "species-references.json");
const TODAY = new Date().toISOString().slice(0, 10);
/** Courtesy gap between requests to the same small institutional host. */
const DELAY_MS = 900;

// ---------------------------------------------------------------- CLI

const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(n);
const opt = (n: string) => {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : undefined;
};
const ONLY = opt("--species");
const LIMIT = opt("--limit") ? Number(opt("--limit")) : undefined;
const DRY = flag("--dry-run");
const FORCE = flag("--force");
/**
 * Re-attempt only the sub-sources a resolved species is still missing. FishBase
 * in particular fails intermittently (a bare connection drop, reported as
 * "http 0"), and a plain re-run would skip the species entirely because its
 * WoRMS identity already landed.
 */
const FILL_GAPS = flag("--fill-gaps");

// ---------------------------------------------------------------- catalogue

type Traits = { commonName: string; shapeClass: string };
const CATALOGUE = speciesTraitsData as unknown as Record<string, Traits>;

/**
 * Group-level catalogue entries (Majoidea, the UK spider crabs) are pinned to a
 * representative species for photo and occurrence pulls. Reference resolution
 * follows the same pin, and records that it did so via `resolvedVia`.
 */
const IMAGES = speciesImagesData as unknown as {
  species?: Record<string, { fetchName?: string }>;
} & Record<string, { fetchName?: string }>;
function fetchNameFor(name: string): string | undefined {
  const bag = IMAGES.species ?? IMAGES;
  return bag?.[name]?.fetchName;
}

/** Fish and flatfish go to FishBase; everything else does not. */
const FISH_CLASSES = new Set(["fish", "flatfish"]);

/** The three birds, whose BirdFacts slugs are vernacular, not binomial. */
const BTO_SLUGS: Record<string, string> = {
  "Somateria mollissima": "eider",
  "Phalacrocorax carbo": "cormorant",
  "Phalacrocorax aristotelis": "shag",
};

// ---------------------------------------------------------------- WoRMS

type AphiaRecord = {
  AphiaID: number;
  url: string;
  scientificname: string;
  authority: string | null;
  status: string;
  rank: string;
  valid_AphiaID: number | null;
  valid_name: string | null;
  valid_authority: string | null;
  phylum?: string | null;
  class?: string | null;
  order?: string | null;
  family?: string | null;
};

async function resolveWorms(name: string) {
  const url = `https://www.marinespecies.org/rest/AphiaRecordsByName/${encodeURIComponent(name)}?like=false&marine_only=false`;
  const recs = await fetchJson<AphiaRecord[]>(url);
  if (!recs || recs.length === 0) return null;
  // Prefer an accepted record; otherwise fall back to the first, whose
  // valid_AphiaID then carries us to the accepted name anyway.
  return recs.find((r) => r.status === "accepted") ?? recs[0] ?? null;
}

/** Synonyms, so a page using an older or newer genus still counts as a match. */
async function wormsSynonyms(aphiaId: number): Promise<string[]> {
  const recs = await fetchJson<AphiaRecord[]>(
    `https://www.marinespecies.org/rest/AphiaSynonymsByAphiaID/${aphiaId}`,
  );
  return (recs ?? []).map((r) => r.scientificname).filter(Boolean);
}

// ---------------------------------------------------------------- MarLIN

/**
 * Resolve a MarLIN species page. Search returns candidate detail ids; each is
 * fetched and only accepted if the page's own TITLE says it is about this
 * species. The search ranking is not evidence, and neither is a mention in the
 * body: MarLIN's common-mussel page names both plaice and dab in its text, so a
 * body-containment test bound two flatfish to a bivalve.
 */
async function resolveMarlin(names: string[], commonName: string, queries: string[]) {
  // Search under every name the animal is known by, not just the catalogue key.
  // MarLIN indexes the shag under its current name Gulosus aristotelis, so a
  // search for the catalogue's older Phalacrocorax aristotelis returned nothing
  // even though the page exists.
  const ids: number[] = [];
  const searched: string[] = [];
  for (const q of Array.from(new Set(queries.filter(Boolean)))) {
    await sleep(DELAY_MS);
    const search = await fetchText(`https://www.marlin.ac.uk/search?q=${encodeURIComponent(q)}`);
    searched.push(`${q}${search.ok ? "" : `(http ${search.status})`}`);
    if (!search.ok) continue;
    for (const m of search.text.matchAll(/\/species\/detail\/(\d+)/g)) {
      const id = Number(m[1]);
      if (!ids.includes(id)) ids.push(id);
    }
    // A binomial search that already produced candidates is usually enough;
    // only widen to the next query when nothing came back.
    if (ids.length > 0) break;
  }
  if (ids.length === 0) {
    return { id: null as number | null, reason: `no candidates in search results (searched: ${searched.join(", ")})` };
  }

  const tried: string[] = [];
  for (const id of ids.slice(0, 6)) {
    await sleep(DELAY_MS);
    const page = await fetchText(`https://www.marlin.ac.uk/species/detail/${id}`);
    if (!page.ok) {
      tried.push(`${id}:http${page.status}`);
      continue;
    }
    const match = identityMatch(page.text, { binomials: names, commonName });
    if (match.ok) return { id, reason: match.reason, matchedOn: match.matchedOn! };
    tried.push(`${id}:${match.reason}`);
  }
  return { id: null, reason: `no candidate page was about this species (${tried.join(" | ")})` };
}

// ---------------------------------------------------------------- FishBase

async function resolveFishBase(binomial: string, names: string[], commonName: string) {
  const slug = binomial.trim().replace(/\s+/g, "-");
  const url = `https://www.fishbase.se/summary/${slug}.html`;
  // FishBase routinely takes ~30s to answer, right on the default timeout, which
  // showed up as intermittent "http 0" misses. Give it real headroom.
  const page = await fetchText(url, { timeoutMs: 90_000 });
  if (!page.ok) return { url: null as string | null, reason: `http ${page.status}` };
  const match = identityMatch(page.text, { binomials: names, commonName });
  if (!match.ok) return { url: null, reason: match.reason };
  return { url, reason: match.reason, matchedOn: match.matchedOn! };
}

// ---------------------------------------------------------------- BTO

/**
 * BTO titles are vernacular only ("Shag | BTO"), so these resolve via the
 * title+body route in identityMatch rather than a binomial in the title.
 */
async function resolveBto(slug: string, names: string[], commonName: string) {
  const url = `https://www.bto.org/understanding-birds/birdfacts/${slug}`;
  const page = await fetchText(url);
  if (!page.ok) return { url: null as string | null, reason: `http ${page.status}` };
  const match = identityMatch(page.text, { binomials: names, commonName });
  if (!match.ok) return { url: null, reason: match.reason };
  return { url, reason: match.reason, matchedOn: match.matchedOn! };
}

// ---------------------------------------------------------------- main

async function loadExisting(): Promise<ReferenceFile> {
  try {
    const raw = await fs.readFile(OUT, "utf8");
    return referenceFileSchema.parse(JSON.parse(raw));
  } catch {
    return { version: 1, sources: {}, species: {} };
  }
}

async function main() {
  const file = await loadExisting();
  let names = Object.keys(CATALOGUE);
  if (ONLY) names = names.filter((n) => n === ONLY || CATALOGUE[n]?.commonName === ONLY);
  if (LIMIT) names = names.slice(0, LIMIT);

  console.log(`Resolving reference identity for ${names.length} species${DRY ? " (dry run)" : ""}\n`);

  const unresolved: string[] = [];
  const renames: string[] = [];

  for (const [i, name] of names.entries()) {
    const traits = CATALOGUE[name];
    const existing = file.species[name];
    if (existing?.identity && !FORCE) {
      const missing: string[] = [];
      if (!existing.sourceIds.some((s) => s.startsWith("marlin:"))) missing.push("marlin");
      if (FISH_CLASSES.has(traits.shapeClass) && !existing.sourceIds.some((s) => s.startsWith("fishbase:"))) {
        missing.push("fishbase");
      }
      if (BTO_SLUGS[name] && !existing.sourceIds.some((s) => s.startsWith("bto:"))) missing.push("bto");
      if (!FILL_GAPS || missing.length === 0) {
        console.log(
          `[${i + 1}/${names.length}] ${name}  (already resolved${missing.length ? `, still missing ${missing.join("+")}` : ""}, skipping)`,
        );
        continue;
      }
      console.log(`[${i + 1}/${names.length}] ${name}  (filling gaps: ${missing.join("+")})`);
    }

    const via = fetchNameFor(name);
    const lookupName = via ?? name;
    process.stdout.write(`[${i + 1}/${names.length}] ${name}${via ? ` (via ${via})` : ""} ... `);

    await sleep(DELAY_MS);
    const rec = await resolveWorms(lookupName);
    if (!rec) {
      console.log("WoRMS: no record");
      unresolved.push(`${name}: WoRMS returned no record for ${lookupName}`);
      continue;
    }

    const acceptedName = rec.valid_name ?? rec.scientificname;
    const aphiaId = rec.valid_AphiaID ?? rec.AphiaID;
    await sleep(DELAY_MS);
    const synonyms = await wormsSynonyms(aphiaId);
    // Every string a source page might legitimately use for this animal.
    const nameCandidates = Array.from(
      new Set([name, lookupName, acceptedName, rec.scientificname, ...synonyms].filter(Boolean)),
    ) as string[];

    const sourceIds: string[] = [];
    const sources: Record<string, Source> = {};

    // --- WoRMS (taxonomy)
    const wormsId = `worms:${aphiaId}`;
    sources[wormsId] = {
      kind: "worms",
      title: `${acceptedName} ${rec.valid_authority ?? rec.authority ?? ""}`.trim(),
      publisher: "World Register of Marine Species (WoRMS Editorial Board)",
      url: `https://www.marinespecies.org/aphia.php?p=taxdetails&id=${aphiaId}`,
      identifier: `AphiaID:${aphiaId}`,
      licence: "CC BY 4.0",
      expectText: [acceptedName],
    };
    sourceIds.push(wormsId);

    // --- MarLIN (the UK spine)
    const marlin = await resolveMarlin(nameCandidates, traits.commonName, [
      acceptedName,
      lookupName,
      name,
      traits.commonName,
    ]);
    if (marlin.id) {
      const id = `marlin:${marlin.id}`;
      sources[id] = {
        kind: "marlin",
        title: `${traits.commonName} (${acceptedName}) - MarLIN species information review`,
        publisher: "Marine Life Information Network, Marine Biological Association of the UK",
        url: `https://www.marlin.ac.uk/species/detail/${marlin.id}`,
        expectText: [marlin.matchedOn ?? acceptedName],
        expectCommonName: traits.commonName,
      };
      sourceIds.push(id);
    }

    // --- FishBase (fish depth, trophic level, diet) or BTO (birds)
    let extra = "";
    if (FISH_CLASSES.has(traits.shapeClass)) {
      await sleep(DELAY_MS);
      const fb = await resolveFishBase(acceptedName, nameCandidates, traits.commonName);
      if (fb.url) {
        const id = `fishbase:${acceptedName.replace(/\s+/g, "-")}`;
        sources[id] = {
          kind: "fishbase",
          title: `${acceptedName} - FishBase species summary`,
          authors: ["Froese, R.", "Pauly, D. (eds)"],
          publisher: "FishBase",
          url: fb.url,
          expectText: [fb.matchedOn ?? acceptedName],
          expectCommonName: traits.commonName,
        };
        sourceIds.push(id);
        extra += " +fishbase";
      } else {
        extra += ` (fishbase: ${fb.reason})`;
      }
    }
    const btoSlug = BTO_SLUGS[name];
    if (btoSlug) {
      await sleep(DELAY_MS);
      const bto = await resolveBto(btoSlug, nameCandidates, btoSlug);
      if (bto.url) {
        const id = `bto:${btoSlug}`;
        sources[id] = {
          kind: "bto",
          title: `${traits.commonName} (${acceptedName}) - BTO BirdFacts`,
          publisher: "British Trust for Ornithology",
          url: bto.url,
          expectText: [bto.matchedOn ?? acceptedName],
          expectCommonName: btoSlug,
        };
        sourceIds.push(id);
        extra += " +bto";
      } else {
        extra += ` (bto: ${bto.reason})`;
      }
    }

    if (!marlin.id) unresolved.push(`${name}: MarLIN ${marlin.reason}`);

    // Merge, preserving any claim bindings already authored for this species.
    Object.assign(file.sources, sources);
    file.species[name] = {
      identity: {
        aphiaId,
        acceptedName,
        authority: (rec.valid_authority ?? rec.authority) || undefined,
        rank: rec.rank,
        phylum: rec.phylum ?? undefined,
        class: rec.class ?? undefined,
        order: rec.order ?? undefined,
        family: rec.family ?? undefined,
        url: `https://www.marinespecies.org/aphia.php?p=taxdetails&id=${aphiaId}`,
        resolvedOn: TODAY,
        resolvedVia: via,
      },
      sourceIds: Array.from(new Set([...(existing?.sourceIds ?? []), ...sourceIds])),
      claims: existing?.claims ?? {},
    };

    let renamed = "";
    if (acceptedName !== name && !via) {
      renamed = `  !! catalogue says ${name}, WoRMS accepts ${acceptedName}`;
      renames.push(`${name} -> ${acceptedName} (Aphia ${aphiaId})`);
    }
    console.log(`Aphia ${aphiaId}${marlin.id ? ` +marlin/${marlin.id}` : " (no marlin)"}${extra}${renamed}`);
  }

  // Validate before writing: a malformed file must fail here, not at runtime.
  const parsed = referenceFileSchema.parse(file);
  if (DRY) {
    console.log(
      `\n[dry run] would write ${Object.keys(parsed.species).length} species, ${Object.keys(parsed.sources).length} sources`,
    );
  } else {
    await fs.writeFile(OUT, JSON.stringify(parsed, null, 2) + "\n", "utf8");
    console.log(
      `\nWrote ${path.relative(process.cwd(), OUT)}: ${Object.keys(parsed.species).length} species, ${Object.keys(parsed.sources).length} sources`,
    );
  }

  if (renames.length) {
    console.log(`\n${renames.length} catalogue name(s) are not the currently accepted name:`);
    for (const r of renames) console.log(`  - ${r}`);
  }
  if (unresolved.length) {
    console.log(`\n${unresolved.length} thing(s) could not be proved and were NOT recorded:`);
    for (const u of unresolved) console.log(`  - ${u}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
