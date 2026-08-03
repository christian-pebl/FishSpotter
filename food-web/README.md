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

## Verify (run this after any data edit)

```bash
node food-web/verify.mjs
```

Read-only cross-check; exits non-zero on any error. It checks:

- **Names** — every species name matches a `commonName` in `src/data/species-traits.json`
  exactly (with a near-miss hint on case typos), no duplicates, no catalogue species
  missing, and every `FARM` key is a real species (a typo there would silently
  misclassify a species).
- **Locations** — each species' `zone` is consistent with its catalogue `habitat` /
  `behavior`, birds and seals are in the surface band, flatfish on the seabed,
  jellyfish in open water, and proximity is a valid value.
- **Relationships** — link endpoints exist, no self-links, no duplicate or inverted
  (lower tier eats higher tier) links, every species eats something, every species
  has a predator unless it is an expected terminal, every energy source feeds
  something, and every species has a path down to a basal energy source.
- **Farm impact** — the rule that a farm-`created` species must sit on the farm
  (`core`), and that nothing surviving the no-farm baseline depends solely on
  farm-created food (otherwise it would starve in the baseline view).

The catalogue is a moving target (other work renames species), so re-run this after
pulling. It caught a live rename: `Hyas araneus` "Great Spider Crab" became
`Majoidea` "Spider Crab" mid-session.

## What's in it

- **72 species** (fish, crabs, cephalopods, starfish, gastropods, jellyfish,
  urchins, seabirds, seals) laid out on the farm by depth zone (surface / mussel
  lines / seaweed canopy / open water / seabed).
- **238 feeding links** (prey → predator), verified against published UK / NE-Atlantic
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
| `created` | absent without the farm (hard-substrate obligates, and small site-attached weed / crevice fish) | ghosted, links pruned | 21 |
| `enhanced` | present anyway but fewer without the farm (pollack, saithe, cod, spider crab, common starfish, brittlestar, eider, ballan + cuckoo wrasse, both octopuses) | faded | 11 |
| `harmed` | *more* abundant without the farm's biodeposits (sea potato) | shown with a **+** badge | 1 |
| `anyway` | soft-sediment / open-water native, ~unchanged | normal | 39 |

Switching to **Without the farm** hides the structure, kelp and mussels, ghosts the
`created` species, prunes every feeding link that touched them, and recomputes the
stats: **72 → 51 species, 238 → 151 links**. The interaction is mode-aware, so a
selected species' diet contracts to only the prey/predators that survive at the
baseline site.

### `created` is deliberately narrow (revised 3 Aug 2026)

`created` is only used where an animal **physically cannot occupy bare soft
sediment** — it needs a hard surface to grip (limpets, top shells, urchins,
whelks, the big starfish) or a crevice to hide in (blennies, rock goby, conger,
and the small weed-dependent fish whose home ranges are metres wide).

It is *not* used for large, wide-ranging animals that a farm merely draws in from
the surrounding seabed. That is the **attraction vs production** distinction from
the artificial-reef literature, and conflating the two is the standard way this
kind of claim gets overstated. Ballan wrasse, cuckoo wrasse and both octopuses
were moved `created` → `enhanced` on exactly that basis: all four range over
hundreds of metres and occupy any nearby reef or debris, so the farm concentrates
them rather than bringing them into existence.

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
