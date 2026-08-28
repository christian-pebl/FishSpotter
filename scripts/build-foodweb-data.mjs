/**
 * Emit the food web as a plain runtime data file: src/data/food-web-links.json.
 *
 * The species guide needs "what does this eat / what eats this", which the food
 * web already encodes. But `food-web/build-foodweb.mjs` reads silhouette SVGs
 * off disk at import time to build its sprite, so importing it from a Next.js
 * server component would drag build-only file IO into the request path. This
 * script runs that module ONCE, offline, and writes just the graph.
 *
 * Keyed by the food web's own display names; the loader in
 * src/lib/foodweb/diet.ts maps those onto catalogue scientific names.
 *
 *   node scripts/build-foodweb-data.mjs      (npm run build:foodweb-data)
 */

import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { E, RES, SPECIES } from "../food-web/build-foodweb.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "src", "data", "food-web-links.json");

const data = {
  // Regenerate with `npm run build:foodweb-data` after editing the food web.
  generatedFrom: "food-web/build-foodweb.mjs",
  species: SPECIES.map((s) => ({
    name: s.name,
    short: s.short,
    tier: s.tier,
  })),
  /** Non-taxon nodes: kelp, plankton, the mussel crop, seabed biodeposits. */
  resources: Object.fromEntries(
    Object.entries(RES).map(([k, v]) => [k, { label: v.label ?? k, sub: v.sub ?? null }]),
  ),
  /** [prey, predator] pairs, exactly as the diagram draws them. */
  edges: E,
};

writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log(
  `wrote src/data/food-web-links.json: ${data.species.length} species, ${Object.keys(data.resources).length} resources, ${data.edges.length} edges`,
);
