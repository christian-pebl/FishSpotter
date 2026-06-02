/**
 * Workstream D / UX-5: pull one PhyloPic silhouette per gate shape-class.
 *
 * PhyloPic art is single-path CC0/CC-BY vector. We sanitise each, write the
 * asset to public/silhouettes/<class>.svg (served as a static file and tinted
 * via CSS mask-image + bg-current in the gate, so it themes + hover-recolors
 * with zero JS-bundle cost), and record author + license in
 * src/data/silhouette-credits.json (mirrors the iNaturalist attribution
 * pattern). The credits file's keys also tell the component which classes have
 * a real asset vs the hand-drawn fallback.
 *
 * Run: node scripts/fetch-silhouettes.cjs
 */
const fs = require("fs");
const path = require("path");

const ACCEPT = { Accept: "application/vnd.phylopic.v2+json" };

// search-name fallbacks per class; first one that yields a primary vector wins.
const TARGETS = [
  { key: "fish", names: ["Actinopterygii"] },
  { key: "flatfish", names: ["Pleuronectiformes", "Pleuronectidae"] },
  { key: "crab", names: ["Brachyura", "Carcinus"] },
  { key: "scooter", names: ["Callionymidae", "Callionymus", "Callionymoidei"] },
  { key: "jellyfish", names: ["Scyphozoa", "Semaeostomeae", "Aurelia"] },
  { key: "starfish", names: ["Asteroidea", "Asterias"] },
  { key: "gastropod", names: ["Gastropoda", "Littorina", "Patellogastropoda"] },
  { key: "squid", names: ["Teuthida", "Myopsida", "Loligo", "Decapodiformes"] },
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

// FishSpotter is a PEBL CIC product, so a NonCommercial license is a no-go.
const isNC = (href) => /\/by-nc/i.test(href || "");
// Prefer the most permissive: CC0 / Public Domain, then CC-BY(-SA).
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

// Commercial-safe fallback: search the whole clade for non-NC vectors and take
// the most permissively-licensed one.
async function cladeImage(nodeUuid, build) {
  const url = `https://api.phylopic.org/images?build=${build}&filter_clade=${nodeUuid}&filter_license_nc=false&page=0&embed_items=true&items=24`;
  const j = await (await fetch(url, { headers: ACCEPT })).json();
  const items = (j?._embedded?.items || []).map(pack).filter(Boolean).filter((i) => !isNC(i.license));
  items.sort((a, b) => licenseRank(a.license) - licenseRank(b.license));
  return items[0] || null;
}

function sanitise(svg) {
  // Force every fill to inherit currentColor, drop explicit black, and let the
  // span control the box size.
  let out = svg
    .replace(/fill="(#000000|#000|#010101|black)"/gi, 'fill="currentColor"')
    .replace(/fill:\s*(#000000|#000|#010101|black)/gi, "fill:currentColor");
  if (!/<svg[^>]*\bfill=/i.test(out)) out = out.replace(/<svg\b/i, '<svg fill="currentColor"');
  // Normalise sizing: keep viewBox, render at 100% of the parent span.
  out = out.replace(/<svg([^>]*?)\swidth="[^"]*"/i, "<svg$1");
  out = out.replace(/<svg([^>]*?)\sheight="[^"]*"/i, "<svg$1");
  out = out.replace(/<svg\b/i, '<svg width="100%" height="100%" aria-hidden="true"');
  // Strip XML prolog / doctype for clean inlining.
  out = out.replace(/<\?xml[^>]*\?>/gi, "").replace(/<!DOCTYPE[^>]*>/gi, "").trim();
  return out;
}

async function main() {
  const build = await getBuild();
  console.log("PhyloPic build", build);
  const outDir = path.join(process.cwd(), "public", "silhouettes");
  fs.mkdirSync(outDir, { recursive: true });

  const credits = {};

  for (const { key, names } of TARGETS) {
    let found = null;
    let usedName = null;
    for (const name of names) {
      const node = await findNode(name, build);
      if (!node) continue;
      // Curated primary image first, but only if commercial-safe; otherwise
      // fall back to the most-permissive non-NC image in the clade.
      let img = await primaryImage(node, build);
      if (!img || isNC(img.license)) img = await cladeImage(node, build);
      if (img) {
        found = img;
        usedName = name;
        break;
      }
    }
    if (!found) {
      console.log(`SKIP ${key}: no vector image for ${names.join("/")}`);
      continue;
    }
    const raw = await (await fetch(found.vector)).text();
    if (!raw.includes("<svg") || !raw.includes("path")) {
      console.log(`SKIP ${key}: vector file looked empty`);
      continue;
    }
    const svg = sanitise(raw);
    fs.writeFileSync(path.join(outDir, `${key}.svg`), svg + "\n");
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
    path.join(process.cwd(), "src", "data", "silhouette-credits.json"),
    JSON.stringify(credits, null, 2) + "\n",
  );

  console.log(`\nWrote ${Object.keys(credits).length} silhouettes + credits.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
