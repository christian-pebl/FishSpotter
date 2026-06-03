# Invertebrate photo audit (P3, read-only) + 3 new species — results

**Date:** 2026-06-03
**Method:** agentic team (29 agents). 26 invert judges each viewed the committed photo +
a fresh research-grade CC sweep with a class-correct "best view" guide (crab = dorsal carapace +
claws; cephalopod = whole mantle + arms; starfish = top-down all arms; gastropod = shell whorls/
aperture; jellyfish = whole bell + tentacles in-water). Per the chosen **P3 policy, NO invert
photo was swapped** — every invert keeps its authored DiagnosticMark rings. The 3 new species
(no marks) were curated from scratch and applied.

## New species — APPLIED (verified leading via live API)

| Species | Class | Photo | Licence | Note |
|---|---|---|---|---|
| Callionymus maculatus (Spotted dragonet) | scooter | obs 199402084 (Libby Keatley) | cc-by | Live in-situ full lateral; raised-but-not-filamentous 1st dorsal separates from C. lyra. |
| Limanda limanda (Dab) | flatfish | obs 40326420 (Michael Verdirame) | cc-by-nc | Clean top-down eyed side, no orange spots (vs plaice). iNat was 24/30 misID'd lookalikes. |
| Platichthys flesus (Flounder) | flatfish | obs 168622323 (Brenton Prigge) | cc-by-nc | Live in-situ whole-body eyed side. **Re-curated** (see below). |

Also set the missing `shapeClass` (scooter / flatfish / flatfish) on these three in
`species-traits.json` so the shape gate can place them.

### Two fixes made during apply (worth knowing)

- **Platichthys agent error:** the agent's first pick (obs 198824907) is actually a photo of a
  **seal eating a flounder** — its written description ("flounder on clean sand") did not match the
  real image. Caught on visual verification, re-curated to a genuine live flounder (obs 168622323).
- **Refresh-script bug fixed** (`src/lib/biodiversity/refresh-images.ts`): when a curated
  override's observation also appears in the iNat bucket sweep, the bucket upsert (keyed on
  `scientificName + sourceUrl`) was **overwriting the hand-picked frame** with that observation's
  representative photo. This had silently swapped the Callionymus full-body lateral (351648617) for
  a head-crop (351648624) of the same animal. Added a guard so a bucket photo never clobbers a
  curated override of the same observation. Benefits every species.

## Invert audit — 20 GOOD, 4 WEAK, 2 DISQUALIFYING (no swaps made)

**All 6 flagged species carry 2–3 authored DiagnosticMarks**, so swapping requires re-authoring
the rings in `/admin/species/[name]`. Recommended replacements are ready if you choose to act.

### DISQUALIFYING (2) — committed photo is genuinely unsuitable

| Species | Problem with committed | Recommended replacement |
|---|---|---|
| **Cancer pagurus** (Edible Crab) | A **dead empty carapace** held in a hand, ventral/frontal angle, no claws or legs, bleached. | obs 53236001 (Emil B, cc-by-nc) — live crab, both black-tipped claws, pie-crust margin. |
| **Necora puber** (Velvet Swimming Crab) | **Head-only macro** (red eyes + blue line only); no carapace, claws, legs, or the diagnostic banded swimming legs. | obs 281748453 (sleocj, cc-by-nc) — near top-down dorsal, whole animal, banded paddle legs. |

### WEAK (4) — usable but a clearly better candidate exists

| Species | Issue | Recommended replacement |
|---|---|---|
| **Hyas araneus** (Great Spider Crab) | Held belly-up/oblique in fingers; dorsal pyriform carapace + rostral spines not shown. | obs 117902959 (Ian Manning, **cc-by**) — live dorsal in-situ. |
| **Patella vulgata** (Common Limpet) | Near top-down; reads as a flat disc, not the diagnostic **conical profile**. | obs 146287226 (Jamie O'Neill, **cc-by**) — lateral profile showing cone + apex. |
| **Nucella lapillus** (Dog Whelk) | A **crowd** of a dozen+ whelks; no single isolated shell for annotation. | obs 344317999 (Drew, cc-by-nc) — single whelk, spire/whorls/aperture clear. |
| **Aurelia aurita** (Moon Jellyfish) | The Luc Viatour studio shot shows **two bells** and the diagnostic gonad clover is faint. | obs 274048952 (Janine H., cc-by-nc) — single, top-down, four gonad horseshoes crisp. |

### GOOD (20) — committed photo confirmed best after viewing the fresh sweep

Carcinus maenas, Liocarcinus depurator, Pagurus bernhardus, Sepia officinalis, Loligo forbesii,
Loligo vulgaris, Sepiola atlantica, Eledone cirrhosa, Octopus vulgaris, Asterina gibbosa,
Marthasterias glacialis, Asterias rubens, Ophiothrix fragilis, Calliostoma zizyphinum,
Steromphala umbilicalis, Chrysaora hysoscella, Cyanea capillata, Rhizostoma octopus,
Cyanea lamarckii, Pelagia noctiluca.

The audit repeatedly noted vote-order surfacing misIDs even at research grade (squid for
cuttlefish; Octopus americanus for O. vulgaris; Winter Flounder for dab), and several committed
photos carry small photographer watermarks (Loligo forbesii "CyberOceans"; Rhizostoma "Dive KLB")
— cosmetic, not swap-worthy.

## To action a swap later (per flagged species)

1. Edit the `overrides` entry in `src/data/species-images.json` to the recommended row.
2. `npm run db:refresh-images -- --species "<binomial>"`.
3. Prune the stale curated row for the old observation (it cascades the old marks away).
4. **Re-author the DiagnosticMark rings** on the new photo in `/admin/species/<binomial>` (the old
   coordinates do not transfer).
5. Verify the lead + mark count via `/api/species-images/<binomial>`.

Full per-species reasoning + runner-up notes: workflow run wf_6f434637-8f3.
