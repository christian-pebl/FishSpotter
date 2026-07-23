# FishSpotter Food Web

An interactive food-web diagram of all catalogue species on a **seaweed & shellfish
farm**, with a toggle that strips the farm away to show the bare soft-sediment /
open-water baseline. Built as PEBL's "Biodiversity Mechanisms" cross-section
populated with the live species catalogue.

- **Live artifact:** https://claude.ai/code/artifact/f114c49e-0fcb-4134-b7c4-92f234d2ef30
- **In this repo:** open `public/food-web.html` directly, or run the dev server and
  visit `http://localhost:3000/food-web.html` (served from `public/`, same pattern
  as `decision-tree.html`). The page is fully self-contained (inline CSS + JS +
  silhouette sprite), no build step needed to view it.

## Rebuild

```bash
node food-web/build-foodweb.mjs
```

Reads the silhouettes from `public/silhouettes/` and writes `public/food-web.html`.
Paths resolve relative to the script, so it works from any checkout. Add `DUMP=1`
to print the full diet list per predator plus a trophic-direction sanity check:

```bash
DUMP=1 node food-web/build-foodweb.mjs
```

## What's in it

- **72 species** (fish, crabs, cephalopods, starfish, gastropods, jellyfish,
  urchins, seabirds, seals) laid out on the farm by depth zone (surface / mussel
  lines / seaweed canopy / open water / seabed).
- **234 feeding links** (prey → predator), verified against published UK / NE-Atlantic
  diet records. Every species eats something; the only species with no predator are
  the ecologically-valid terminals (apex predators, jellyfish, large starfish).
- **Trophic tier** colour (T2 grazers/filter feeders → T5 apex), colourblind-safe.
- **Farm proximity** dot (farm-core ● / footprint ◐ / passing ○).
- **Click any species** to trace what it eats (blue) and what eats it (amber), with a
  connection panel. Hover previews; Esc / Clear / background resets.

## The with / without-farm toggle

Each species and each energy source carries a **farm-impact** class (`FARM` map in
the script), for a generic sheltered soft-sediment site:

| class | meaning | baseline view | count |
|---|---|---|---|
| `created` | absent without the farm (reef / weed / crevice obligates, gastropods, rock urchins, mussel specialists) | ghosted, links pruned | 25 |
| `enhanced` | present anyway but fewer without the farm (pollack, saithe, cod, spider crab, common starfish, brittlestar, eider) | faded | 7 |
| `harmed` | *more* abundant without the farm's biodeposits (sea potato) | shown with a **+** badge | 1 |
| `anyway` | soft-sediment / open-water native, ~unchanged | normal | 39 |

Switching to **Without the farm** hides the structure, kelp and mussels, ghosts the
`created` species, prunes every feeding link that touched them, and recomputes the
stats: **72 → 47 species, 234 → 129 links**. The interaction is mode-aware, so a
selected species' diet contracts to only the prey/predators that survive at the
baseline site (e.g. Atlantic cod drops from 17 prey to 11).

## Where the data lives (to edit)

All in `build-foodweb.mjs`:

- `SPECIES` — the 72 tiles: `S(name, shortLabel, silhouetteForm, tier, zone, proximity)`.
- `RES` — the four basal energy sources (kelp, farmed mussels, plankton, detritus).
- `link(predator, ...prey)` calls — the feeding edges. A `completeness pass` + an
  `accuracy additions` block follow the main diets.
- `FARM` — the farm-impact class per species (default `anyway`).

Change a diet or a classification, re-run the build, and the page + stats update.

## Caveats

Placement and farm-impact are an **indicative teaching schematic**, not a quantified
survey. Diets are qualitative (who-eats-whom, no frequencies). The farm-impact split
reads the artificial-reef / canopy-nursery / biodeposition literature for a *generic*
sheltered soft-sediment site; a rocky-reef-adjacent location would have a different
baseline (fewer species would be "created"). The four basal nodes are compartments
(producer / mussels / plankton / detritus-and-benthos), so small benthic carnivores
"eat" a compartment rather than a named invertebrate species.
