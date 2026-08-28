/**
 * Hand-authored sources: the ones a resolver cannot find, because they live in
 * a PDF monograph rather than on a species page.
 *
 * Everything here was READ, not inferred. Each entry records the page it was
 * read from and a short attributed quote, so `claimSupported` can honestly be
 * true where the passage carries the claim, and a `conflict` is recorded where
 * it does not. That is the whole point of the field: a resolver may never set
 * it, a reader may.
 *
 * Merged into src/data/species-references.json, and safe to re-run: the
 * resolver preserves existing claims and source ids, so this survives a
 * `refs:resolve`.
 *
 *   npm run refs:manual [-- --dry-run]
 */

import { promises as fs } from "fs";
import path from "path";
import { referenceFileSchema, type Claim, type ReferenceFile, type Source } from "../../src/lib/references/schema";

const REFS = path.join(process.cwd(), "src", "data", "species-references.json");
const DRY = process.argv.includes("--dry-run");
const READ_ON = "2026-08-28";
const READ_BY = "claude-code (read from the FAO PDF)";

const SOURCES: Record<string, Source> = {
  "fao:i1920e": {
    kind: "fao",
    title:
      "Cephalopods of the World. An Annotated and Illustrated Catalogue of Cephalopod Species Known to Date. Volume 2: Myopsid and Oegopsid Squids",
    authors: ["Jereb, P.", "Roper, C.F.E. (eds)"],
    publisher: "Food and Agriculture Organization of the United Nations",
    year: 2010,
    url: "https://www.fao.org/3/i1920e/i1920e.pdf",
    identifier: "FAO Species Catalogue for Fishery Purposes No. 4, Vol. 2",
    licence: "FAO open access",
    expectText: ["Loligo forbesii"],
    verifyMode: "pdf",
  },
};

/**
 * Veined squid is the one catalogue species with no MarLIN page and no
 * FishBase summary, so before this it had a taxonomy anchor and nothing else.
 * MarLIN carries Loligo vulgaris and Alloteuthis subulata but not L. forbesii.
 */
const CLAIMS: Record<string, Record<string, Claim>> = {
  "Loligo forbesii": {
    fieldNote: {
      sourceIds: ["fao:i1920e"],
      support: [
        {
          sourceId: "fao:i1920e",
          locator: "p. 62, Diagnostic Features",
          quote:
            "Mantle long, moderately slender, cylindrical; fins rhomboidal, their length three quarters that of mantle, their posterior borders slightly concave.",
          readBy: READ_BY,
          readOn: READ_ON,
        },
      ],
      // The source supports "slender" and "fins running well down towards the
      // tail" (three quarters of mantle length), but NOT "triangular": FAO and
      // the Cefas UK cephalopod guide both describe the fins as rhomboidal.
      claimSupported: false,
      conflict:
        'The field note says "two triangular fins". FAO (p. 62) and the Cefas UK cephalopod guide (p. 18) both describe the fins as rhomboidal, at roughly three quarters of mantle length. Reword to "rhomboidal" before this claim can be marked supported.',
    },
    "trait:size": {
      sourceIds: ["fao:i1920e"],
      support: [
        {
          sourceId: "fao:i1920e",
          locator: "p. 63, Size",
          // The quote now runs ON into the sentence that qualifies it. The
          // earlier version stopped one character short of "Common at smaller
          // sizes", which is the population a UK viewer actually sees. Cutting
          // a quote there is selection, not summary.
          quote:
            "Maximum mantle length 937 mm in males and 462 mm in females, for animals from the Azores. Common at smaller sizes (200 to 300 mm mantle length) in the Mediterranean and on the eastern North Atlantic continental shelf.",
          readBy: READ_BY,
          readOn: READ_ON,
        },
      ],
      claimSupported: false,
      conflict:
        "The app renders Size: Large (over 50 cm). FAO (p. 63) gives a 937 mm maximum, but says animals on the eastern North Atlantic continental shelf, which is UK water, are commonly 200 to 300 mm mantle length. That falls in the app's own medium bucket of 10 to 50 cm. Decide whether the tile means maximum or typical size before marking this supported.",
    },
    "trait:habitat": {
      sourceIds: ["fao:i1920e"],
      support: [
        {
          sourceId: "fao:i1920e",
          locator: "p. 63, Habitat and Biology",
          quote:
            "It occurs over the continental shelf in the temperate part of its distributional range, but it is found in deeper waters in subtropical areas.",
          readBy: READ_BY,
          readOn: READ_ON,
        },
      ],
      // The passage is about shelf position and depth. The claim is about
      // position in the water column. Those are different questions, and the
      // source does not answer the one being asked.
      claimSupported: false,
      conflict:
        'The app renders Habitat: "Midwater, Open water". The cited FAO passage (p. 63) describes shelf position and depth, not position in the water column, so it does not support the claim either way. Loliginids are commonly near-bottom by day. Find a passage that speaks to the water column, or reword the tile.',
    },
  },
};

async function main() {
  const file: ReferenceFile = referenceFileSchema.parse(JSON.parse(await fs.readFile(REFS, "utf8")));

  Object.assign(file.sources, SOURCES);

  let added = 0;
  const conflicts: string[] = [];
  for (const [species, claims] of Object.entries(CLAIMS)) {
    const entry = file.species[species];
    if (!entry) {
      console.warn(`skipping ${species}: not in the reference file`);
      continue;
    }
    const sourceIds = new Set(entry.sourceIds);
    for (const c of Object.values(claims)) c.sourceIds.forEach((id) => sourceIds.add(id));
    file.species[species] = {
      ...entry,
      sourceIds: [...sourceIds],
      claims: { ...entry.claims, ...claims },
    };
    for (const [key, c] of Object.entries(claims)) {
      added++;
      if (c.conflict) conflicts.push(`${species} ${key}: ${c.conflict}`);
    }
    console.log(`${species}: +${Object.keys(claims).length} claim(s), sources now ${[...sourceIds].join(", ")}`);
  }

  const parsed = referenceFileSchema.parse(file);
  if (DRY) {
    console.log(`\n[dry run] would add ${added} claim(s)`);
  } else {
    await fs.writeFile(REFS, JSON.stringify(parsed, null, 2) + "\n", "utf8");
    console.log(`\nAdded ${added} hand-read claim(s).`);
  }

  if (conflicts.length) {
    console.log(`\n${conflicts.length} claim(s) CONFLICT with the source and need the app text changed:`);
    for (const c of conflicts) console.log(`  - ${c}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
