/**
 * Fetch body-form silhouettes for the Rung 2 sub-splits.
 *
 * Pins 18 specific PhyloPic image UUIDs vetted against the live API
 * (build 541, 3 Jun 2026). Writes to public/silhouettes/forms/<value>.svg
 * and records author + license to src/data/bodyform-silhouette-credits.json
 * (mirrors the shape-class silhouette pattern).
 *
 * Run: node scripts/fetch-bodyform-silhouettes.cjs
 */
const fs = require("fs");
const path = require("path");

const ACCEPT = { Accept: "application/vnd.phylopic.v2+json" };

// Pinned image UUIDs — one per sub-split option value.
// File names match the trait values used in CandidateStrip SUB_SPLITS so
// the component can construct the URL as /silhouettes/forms/<value>.svg.
const TARGETS = [
  // crab crabForm --------------------------------------------------------
  {
    file: "broad-carapace",
    uuid: "422060a1-0c7f-4428-b645-bdd26d815482",
    taxon: "Cancer bellianus (Cancridae)",
    license: "Public Domain Mark 1.0",
    attribution: "Jebulon (vectorized by T. Michael Keesey), via PhyloPic",
    source: "https://www.phylopic.org/images/422060a1-0c7f-4428-b645-bdd26d815482",
  },
  {
    file: "swimming",
    uuid: "7197c71a-0653-4e82-bcbb-b156c150826a",
    taxon: "Callinectes sapidus (Portunidae)",
    license: "CC0 1.0",
    attribution: "Public Domain (CC0 1.0), via PhyloPic",
    source: "https://www.phylopic.org/images/7197c71a-0653-4e82-bcbb-b156c150826a",
  },
  {
    file: "spider",
    uuid: "e29b80f3-df87-46f9-ad82-be4b6c212121",
    taxon: "Macrocheira kaempferi (Majoidea)",
    license: "CC-BY-SA 3.0",
    attribution: "Michael Wolf (photo), Hans Hillewaert (editing), T. Michael Keesey (vectorization), via PhyloPic",
    source: "https://www.phylopic.org/images/e29b80f3-df87-46f9-ad82-be4b6c212121",
  },
  {
    file: "hermit",
    uuid: "d2064615-2851-40c8-b99c-f7e5669958ee",
    taxon: "Paguridae",
    license: "CC0 1.0",
    attribution: "Kurtis Wothe, via PhyloPic",
    source: "https://www.phylopic.org/images/d2064615-2851-40c8-b99c-f7e5669958ee",
  },
  // fish bodyShape -------------------------------------------------------
  {
    file: "fusiform",
    uuid: "5ac54f3b-2422-4d31-9920-ec90c16d4fd5",
    taxon: "Scomber",
    license: "Public Domain Mark 1.0",
    attribution: "Robbie N. Cada (vectorized by T. Michael Keesey), via PhyloPic",
    source: "https://www.phylopic.org/images/5ac54f3b-2422-4d31-9920-ec90c16d4fd5",
  },
  {
    file: "laterally-compressed",
    uuid: "fc97b67e-627d-4430-9a5a-2cf661640bc7",
    taxon: "Abramis brama",
    license: "Public Domain Mark 1.0",
    attribution: "Ando, via PhyloPic",
    source: "https://www.phylopic.org/images/fc97b67e-627d-4430-9a5a-2cf661640bc7",
  },
  {
    file: "elongated",
    uuid: "31124fe7-c960-40dd-943b-dbecd53650db",
    taxon: "Ammodytes",
    license: "Public Domain Mark 1.0",
    attribution: "T. Michael Keesey, via PhyloPic",
    source: "https://www.phylopic.org/images/31124fe7-c960-40dd-943b-dbecd53650db",
  },
  {
    file: "eel-like",
    uuid: "629e1135-d0c5-4f02-bb13-8cbf63e48692",
    taxon: "Anguilla rostrata",
    license: "CC0 1.0",
    attribution: "Steven Traver, via PhyloPic",
    source: "https://www.phylopic.org/images/629e1135-d0c5-4f02-bb13-8cbf63e48692",
  },
  // squid cephalopodForm -------------------------------------------------
  {
    file: "cuttlefish",
    uuid: "00f831ef-01ad-4327-8506-7e0b92c1839b",
    taxon: "Sepia orbignyana",
    license: "CC0 1.0",
    attribution: "Guillaume Dera, via PhyloPic",
    source: "https://www.phylopic.org/images/00f831ef-01ad-4327-8506-7e0b92c1839b",
  },
  {
    file: "squid",
    uuid: "22a8e316-7f4d-4270-b6af-b5ef9e84c2c2",
    taxon: "Loligo vulgaris",
    license: "CC0 1.0",
    attribution: "Cagri Cevrim, via PhyloPic",
    source: "https://www.phylopic.org/images/22a8e316-7f4d-4270-b6af-b5ef9e84c2c2",
  },
  {
    file: "bobtail",
    uuid: "2e11cbff-6287-4df5-8118-6a3ea055f936",
    taxon: "Euprymna scolopes",
    license: "CC0 1.0",
    attribution: "Darrin Schultz, via PhyloPic",
    source: "https://www.phylopic.org/images/2e11cbff-6287-4df5-8118-6a3ea055f936",
  },
  {
    file: "octopus",
    uuid: "f060bcc7-5725-46f7-8276-14553af3707f",
    taxon: "Octopus sp.",
    license: "CC0 1.0",
    attribution: "Margot Michaud, via PhyloPic",
    source: "https://www.phylopic.org/images/f060bcc7-5725-46f7-8276-14553af3707f",
  },
  // starfish armForm -----------------------------------------------------
  {
    file: "short-stubby",
    uuid: "19f846e4-62f6-4081-9e52-b933792c5bcd",
    taxon: "Asteriidae",
    license: "CC0 1.0",
    attribution: "Mario Quevedo, via PhyloPic",
    source: "https://www.phylopic.org/images/19f846e4-62f6-4081-9e52-b933792c5bcd",
  },
  {
    file: "long-spiny",
    uuid: "37d1d45b-66c7-4240-a81c-bad76f27443d",
    taxon: "Odontaster validus",
    license: "CC0 1.0",
    attribution: "Guillaume Dera, via PhyloPic",
    source: "https://www.phylopic.org/images/37d1d45b-66c7-4240-a81c-bad76f27443d",
  },
  {
    file: "long-smooth",
    uuid: "7e27ce06-1f4f-45d8-a359-dcba8fc54b9b",
    taxon: "Tethyaster subinermis",
    license: "CC0 1.0",
    attribution: "Birgit Lang, via PhyloPic",
    source: "https://www.phylopic.org/images/7e27ce06-1f4f-45d8-a359-dcba8fc54b9b",
  },
  {
    file: "thin-whippy",
    uuid: "99c957a2-99b1-4a30-9b25-355a6fb55509",
    taxon: "Ophiura albida",
    license: "CC0 1.0",
    attribution: "Guillaume Dera, via PhyloPic",
    source: "https://www.phylopic.org/images/99c957a2-99b1-4a30-9b25-355a6fb55509",
  },
  // gastropod shellShape -------------------------------------------------
  {
    file: "flat-cone",
    uuid: "20ab4f5b-a0ab-401b-812e-718e303f7fc3",
    taxon: "Lottia",
    license: "CC-BY-SA 3.0",
    attribution: "Taro Maeda, via PhyloPic",
    source: "https://www.phylopic.org/images/20ab4f5b-a0ab-401b-812e-718e303f7fc3",
  },
  {
    file: "pointed-cone",
    uuid: "af3b0a39-4ba9-4134-800e-d181a7288689",
    taxon: "Trochidae",
    license: "CC0 1.0",
    attribution: "Tauana Cunha, via PhyloPic",
    source: "https://www.phylopic.org/images/af3b0a39-4ba9-4134-800e-d181a7288689",
  },
  {
    file: "rounded-squat",
    uuid: "9c17f9fa-11bd-4d99-9e14-80eca4a12108",
    taxon: "Tegula fasciata",
    license: "CC0 1.0",
    attribution: "Tauana Cunha, via PhyloPic",
    source: "https://www.phylopic.org/images/9c17f9fa-11bd-4d99-9e14-80eca4a12108",
  },
  // jellyfish bellForm ---------------------------------------------------
  {
    file: "saucer",
    uuid: "f0494167-77f6-46eb-841d-c4cefb683bbd",
    taxon: "Aurelia",
    license: "CC0 1.0",
    attribution: "Lodewijk van Walraven, via PhyloPic",
    source: "https://www.phylopic.org/images/f0494167-77f6-46eb-841d-c4cefb683bbd",
  },
  {
    file: "frilly-arms",
    uuid: "99632006-ff40-49a2-bca3-4a9aae003abf",
    taxon: "Rhopilema esculentum",
    license: "CC0 1.0",
    attribution: "SecretJellyMan, via PhyloPic",
    source: "https://www.phylopic.org/images/99632006-ff40-49a2-bca3-4a9aae003abf",
  },
  {
    file: "trailing-mass",
    uuid: "f2fb5773-f8ff-45b0-9c6c-cc5aef3c93d5",
    taxon: "Cyanea capillata",
    license: "CC0 1.0",
    attribution: "Guillaume Dera, via PhyloPic",
    source: "https://www.phylopic.org/images/f2fb5773-f8ff-45b0-9c6c-cc5aef3c93d5",
  },
];

async function getBuild() {
  const r = await fetch("https://api.phylopic.org/", { headers: ACCEPT, redirect: "manual" });
  const loc = r.headers.get("location") || "";
  const m = loc.match(/build=(\d+)/);
  if (m) return Number(m[1]);
  const j = await (await fetch("https://api.phylopic.org/", { headers: ACCEPT })).json();
  return j.build;
}

async function getVectorUrl(uuid, build) {
  const url = `https://api.phylopic.org/images/${uuid}?build=${build}`;
  const j = await (await fetch(url, { headers: ACCEPT })).json();
  return j?._links?.vectorFile?.href || null;
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

  const outDir = path.join(process.cwd(), "public", "silhouettes", "forms");
  fs.mkdirSync(outDir, { recursive: true });

  const credits = {};
  let ok = 0;

  for (const t of TARGETS) {
    const vectorUrl = await getVectorUrl(t.uuid, build);
    if (!vectorUrl) {
      console.log(`SKIP ${t.file}: no vectorFile href for UUID ${t.uuid}`);
      continue;
    }
    const raw = await (await fetch(vectorUrl)).text();
    if (!raw.includes("<svg") || !raw.includes("path")) {
      console.log(`SKIP ${t.file}: vector looks empty`);
      continue;
    }
    const svg = sanitise(raw);
    fs.writeFileSync(path.join(outDir, `${t.file}.svg`), svg + "\n");
    credits[t.file] = {
      taxon: t.taxon,
      imageUuid: t.uuid,
      attribution: t.attribution,
      license: t.license,
      source: t.source,
    };
    console.log(`OK   ${t.file}: ${t.taxon} (${t.license})`);
    ok++;
  }

  fs.writeFileSync(
    path.join(process.cwd(), "src", "data", "bodyform-silhouette-credits.json"),
    JSON.stringify(credits, null, 2) + "\n",
  );

  console.log(`\nWrote ${ok}/${TARGETS.length} silhouettes + credits.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
