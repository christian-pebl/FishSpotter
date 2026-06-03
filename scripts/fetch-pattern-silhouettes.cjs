/**
 * Pulls a wider pool of marine silhouettes from PhyloPic to diversify the
 * decorative background pattern (scripts/build-marine-pattern.cjs reads these
 * in ADDITION to the 8 gate silhouettes in public/silhouettes/).
 *
 * Kept separate from fetch-silhouettes.cjs on purpose: the gate needs exactly
 * its 8 shape-classes, whereas the pattern just wants variety. Assets land in
 * public/patterns/silhouettes/ with attribution in
 * src/data/pattern-silhouette-credits.json. Commercial-safe only (no NC),
 * since FishSpotter is a PEBL CIC product. Re-run after editing TARGETS:
 *
 *   node scripts/fetch-pattern-silhouettes.cjs
 */
const fs = require("fs");
const path = require("path");

const ACCEPT = { Accept: "application/vnd.phylopic.v2+json" };

// Extra marine taxa, distinct from the 8 gate classes (fish, flatfish, crab,
// scooter, jellyfish, starfish, gastropod, squid). First name that yields a
// commercial-safe primary vector wins.
const TARGETS = [
  { key: "shark", names: ["Carcharhiniformes", "Selachii", "Lamniformes", "Squaliformes"] },
  { key: "ray", names: ["Rajidae", "Batoidea", "Myliobatiformes", "Rajiformes"] },
  { key: "eel", names: ["Anguilliformes", "Anguilla", "Anguillidae"] },
  { key: "seahorse", names: ["Hippocampus", "Syngnathidae"] },
  { key: "shrimp", names: ["Caridea", "Palaemonidae", "Penaeidae", "Crangon"] },
  { key: "lobster", names: ["Nephropidae", "Homarus", "Palinuridae", "Astacidea"] },
  { key: "octopus", names: ["Octopoda", "Octopus", "Octopodidae"] },
  { key: "cuttlefish", names: ["Sepiida", "Sepia", "Sepiidae"] },
  { key: "urchin", names: ["Echinoidea", "Echinus", "Echinidae"] },
  { key: "anemone", names: ["Actiniaria", "Actiniidae"] },
  { key: "mussel", names: ["Mytilidae", "Mytilus", "Bivalvia"] },
  { key: "scallop", names: ["Pectinidae", "Pecten"] },
  { key: "nudibranch", names: ["Nudibranchia", "Doris", "Nudibranchiomorpha"] },
  { key: "turtle", names: ["Cheloniidae", "Chelonioidea", "Chelonia"] },
  { key: "dolphin", names: ["Delphinidae", "Delphinus", "Tursiops"] },
  { key: "seal", names: ["Phocidae", "Phoca", "Pinnipedia"] },
  { key: "worm", names: ["Polychaeta", "Nereididae", "Annelida"] },
  { key: "barnacle", names: ["Balanidae", "Cirripedia", "Thoracica"] },
  { key: "prawn", names: ["Dendrobranchiata", "Penaeus"] },
  { key: "lugworm", names: ["Arenicola", "Arenicolidae"] },
];

async function getBuild() {
  const r = await fetch("https://api.phylopic.org/", { headers: ACCEPT, redirect: "manual" });
  const loc = r.headers.get("location") || "";
  const m = loc.match(/build=(\d+)/);
  if (m) return Number(m[1]);
  const j = await (await fetch("https://api.phylopic.org/", { headers: ACCEPT })).json();
  return j.build;
}

async function findNode(name, build) {
  const url = `https://api.phylopic.org/nodes?build=${build}&filter_name=${encodeURIComponent(name.toLowerCase())}&page=0`;
  const j = await (await fetch(url, { headers: ACCEPT })).json();
  const items = j?._links?.items || [];
  return items.length ? items[0].href.split("?")[0].split("/").pop() : null;
}

const isNC = (href) => /\/by-nc/i.test(href || "");
function licenseRank(href) {
  if (/publicdomain\/(zero|mark)/i.test(href)) return 0;
  if (/licenses\/by-sa/i.test(href)) return 2;
  if (/licenses\/by\//i.test(href)) return 1;
  return 3;
}

function pack(img) {
  if (!img?._links?.vectorFile?.href) return null;
  return {
    vector: img._links.vectorFile.href,
    license: img._links.license?.href || "",
    attribution: img.attribution || img._links.contributor?.title || "Unknown",
    contributor: img._links.contributor?.title || "Unknown",
    uuid: img.uuid || (img._links.self?.href || "").split("?")[0].split("/").pop(),
  };
}

async function primaryImage(nodeUuid, build) {
  const url = `https://api.phylopic.org/nodes/${nodeUuid}?build=${build}&embed_primaryImage=true`;
  const j = await (await fetch(url, { headers: ACCEPT })).json();
  return pack(j?._embedded?.primaryImage);
}

async function cladeImage(nodeUuid, build) {
  const url = `https://api.phylopic.org/images?build=${build}&filter_clade=${nodeUuid}&filter_license_nc=false&page=0&embed_items=true&items=24`;
  const j = await (await fetch(url, { headers: ACCEPT })).json();
  const items = (j?._embedded?.items || []).map(pack).filter(Boolean).filter((i) => !isNC(i.license));
  items.sort((a, b) => licenseRank(a.license) - licenseRank(b.license));
  return items[0] || null;
}

function sanitise(svg) {
  let out = svg
    .replace(/fill="(#000000|#000|#010101|black)"/gi, 'fill="currentColor"')
    .replace(/fill:\s*(#000000|#000|#010101|black)/gi, "fill:currentColor");
  if (!/<svg[^>]*\bfill=/i.test(out)) out = out.replace(/<svg\b/i, '<svg fill="currentColor"');
  out = out.replace(/<svg([^>]*?)\swidth="[^"]*"/i, "<svg$1");
  out = out.replace(/<svg([^>]*?)\sheight="[^"]*"/i, "<svg$1");
  out = out.replace(/<svg\b/i, '<svg width="100%" height="100%" aria-hidden="true"');
  out = out.replace(/<\?xml[^>]*\?>/gi, "").replace(/<!DOCTYPE[^>]*>/gi, "").trim();
  return out;
}

async function main() {
  const build = await getBuild();
  console.log("PhyloPic build", build);
  const outDir = path.join(process.cwd(), "public", "patterns", "silhouettes");
  fs.mkdirSync(outDir, { recursive: true });

  const credits = {};
  for (const { key, names } of TARGETS) {
    let found = null;
    let usedName = null;
    for (const name of names) {
      const node = await findNode(name, build);
      if (!node) continue;
      let img = await primaryImage(node, build);
      if (!img || isNC(img.license)) img = await cladeImage(node, build);
      if (img) {
        found = img;
        usedName = name;
        break;
      }
    }
    if (!found) {
      console.log(`SKIP ${key}: no commercial-safe vector for ${names.join("/")}`);
      continue;
    }
    const raw = await (await fetch(found.vector)).text();
    if (!raw.includes("<svg") || !raw.includes("path")) {
      console.log(`SKIP ${key}: vector file looked empty`);
      continue;
    }
    fs.writeFileSync(path.join(outDir, `${key}.svg`), sanitise(raw) + "\n");
    credits[key] = {
      taxon: usedName,
      imageUuid: found.uuid,
      contributor: found.contributor,
      attribution: found.attribution,
      license: found.license,
      source: `https://www.phylopic.org/images/${found.uuid}`,
    };
    console.log(`OK   ${key}: ${usedName} by ${found.attribution} (${found.license.split("/").slice(-3, -1).join("/") || found.license})`);
  }

  fs.writeFileSync(
    path.join(process.cwd(), "src", "data", "pattern-silhouette-credits.json"),
    JSON.stringify(credits, null, 2) + "\n",
  );
  console.log(`\nWrote ${Object.keys(credits).length} extra silhouettes + credits.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
