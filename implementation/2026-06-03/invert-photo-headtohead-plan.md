# Plan: extend the visual head-to-head to the non-fish catalogue

**Date:** 2026-06-03
**Goal:** apply the same agentic visual best-fit selection that fixed the 27 fish-type species
(run 1 + run 2) to the rest of the catalogue: the 26 invertebrates and the 3 newly-added
fish-type species.

## Scope (confirmed from the catalogue + manifest)

Catalogue is now **57 species**. The 27 fish-type (26 fish + plaice + dragonet) are done.
Remaining:

**Group A — 26 invertebrates (already have a curated override, never visually head-to-head'd):**
- Crab (6): Carcinus maenas, Cancer pagurus, Necora puber, Liocarcinus depurator, Hyas araneus, Pagurus bernhardus
- Squid/cephalopod (6): Sepia officinalis, Loligo forbesii, Loligo vulgaris, Sepiola atlantica, Eledone cirrhosa, Octopus vulgaris
- Starfish (4): Asterina gibbosa, Marthasterias glacialis, Asterias rubens, Ophiothrix fragilis
- Gastropod (4): Patella vulgata, Nucella lapillus, Calliostoma zizyphinum, Steromphala umbilicalis
- Jellyfish (6): Aurelia aurita, Chrysaora hysoscella, Cyanea capillata, Rhizostoma octopus, Cyanea lamarckii, Pelagia noctiluca

**Group B — 3 new species, ZERO curation (need a from-scratch best pick):**
- Callionymus maculatus (Spotted dragonet, scooter)
- Limanda limanda (Dab, flatfish)
- Platichthys flesus (Flounder, flatfish)
- NB: all three currently have **no `shapeClass`** in `species-traits.json` (they read as "?"),
  so the shape gate can't place them yet. That field must be set (scooter / flatfish / flatfish)
  as part of this work, independent of the photo.

## THE central constraint: authored DiagnosticMarks (onDelete: Cascade)

`DiagnosticMark.speciesImageId` is a FK with **`onDelete: Cascade`**. **All 26 invertebrates
already carry 2–3 authored marks** (the jellyfish + invert tiles were marked in the 2 Jun work).
The "apply" step used for fish (delete the old curated row, upsert the new one) would therefore
**cascade-delete the authored marks** of any invert whose photo is swapped. Re-authoring marks is
manual work in `/admin/species/[name]` (coordinates are normalised to the specific photo, so they
cannot be transplanted automatically).

This changes the apply policy versus the fish run. The fish were almost all unmarked, so swapping
was free; the inverts are all marked, so a swap costs a re-authoring.

### Decision point for the user (pick one policy for Group A)

- **(P1) Report-only, swap only on hard failures.** Run the head-to-head as a *recommendation*.
  Auto-swap only where the committed photo is disqualifying (wrong species, multiple animals,
  dead/market specimen) AND queue those few for mark re-authoring. Leave merely "a-bit-better"
  cases as committed to preserve existing marks. *Lowest disruption, recommended.*
- **(P2) Best-fit everywhere + re-author.** Always take the visual winner; for every swapped
  marked species, follow with a mark re-authoring pass (a second agent team that re-derives ring
  coordinates on the new photo, or a flag for manual `/admin` authoring). *Highest quality, much
  more work and risk.*
- **(P3) Photo-frozen audit.** Don't swap any invert photo; just produce a ranked report of which
  committed invert photos are weak, for humans to fix in `/admin` where marks already live.

Group B has **no marks**, so it is unaffected — apply the best pick directly (like run 1).

## Methodology (reuse the run-2 harness)

The run-2 script (`fish-photo-headtohead-wf_3d900559-0a6.js`) already does committed-vs-workflow
-vs-fresh with a per-shape view guide. Two changes needed:

1. **Extend the view guide for invert classes** (the current one only knows fish/flatfish/scooter
   /catshark/conger). Class-correct "best view" rules:
   - **Crab:** top-down / dorsal of the whole carapace + both claws, showing carapace shape,
     markings, spines/teeth on the front margin. Hermit crab (Pagurus): whole animal in its shell.
     Single live animal; reject piles, cooked/red boiled crabs, claws-only.
   - **Squid/cuttlefish/octopus:** whole animal, mantle + arms/tentacles visible. Octopus
     (Octopus, Eledone): show arms + mantle, ideally live in-situ. Squid (Loligo): lateral whole
     body with fins. Cuttlefish (Sepia): lateral showing the fin skirt. Bobtail (Sepiola): the
     small rounded body. Reject market trays, dissected/dead-on-ice specimens, multiple animals.
   - **Starfish:** top-down of the whole animal, all arms in frame, showing arm count, surface
     texture/spines, colour. Brittlestar (Ophiothrix): central disc + the 5 long thin arms.
     Reject curled/regenerating/partial specimens and dried museum stars.
   - **Gastropod:** the shell clearly, showing shape, whorls, aperture, colour/pattern. Limpet
     (Patella): conical shell (a profile + apex view). Live animal on rock is ideal; reject empty
     weathered/hermit-occupied shells and bleached beach shells where the diagnostic colour is gone.
   - **Jellyfish:** the whole bell + tentacles/oral arms in the water column, showing the
     diagnostic markings (compass radial lines, lion's-mane mass, barrel-jelly cauliflower arms,
     etc.). Reject stranded/collapsed-on-sand blobs and out-of-water bucket shots where the
     structure is lost.
2. **Same-source mode for Group A:** there is no prior "workflow pick" for inverts (run 1 was
   fish-only), so pass `same:true` with `committed == workflow`; the judge then does
   committed-vs-fresh-sweep (the script already handles this branch). For Group B pass a
   `fresh-only` flag (no committed) so the agent curates from scratch.

Keep the same schema (winner row + winnerSource + reasoning + runnerUp) and the
misID warning (vote-order surfaces lookalikes — acute for inverts: shore-crab vs other
Carcinus, moon vs other Aurelia, common vs other Asterias, etc.).

## Execution sequence (once a policy is chosen)

1. **Set `shapeClass`** for the 3 new species in `species-traits.json` (scooter / flatfish /
   flatfish). Small, do first so the gate works regardless of photos.
2. **Group B fresh curation** (3 agents, run-1 style): pick the best photo per new species, add an
   override, `db:refresh-images --species`, verify. No marks risk. ~quick.
3. **Group A head-to-head** (26 agents, ~8 image views each): committed-vs-fresh, per the chosen
   policy. Produce the verdict table.
4. **Apply per policy.** For any swap on a marked species: edit manifest -> `db:refresh-images`
   -> prune the stale curated row (this cascades the old marks away) -> **queue/redo marks** on the
   new photo (P2), or only do this for hard-failure species (P1).
5. **Verify** end-to-end via `/api/species-images/<sci>` (lead = chosen) and a landing-page check;
   re-confirm mark counts for any swapped species so none are silently orphaned.
6. Record verdicts in `implementation/2026-06-03/invert-photo-headtohead.md` (mirror the fish note).

## Risks / watch-outs

- **Marks cascade (above)** — the dominant risk for Group A. Whatever policy, *always* re-check
  `diagnosticMark` counts for swapped species after pruning, the way the Trachurus check was done.
- **Parallel "Fish manual review" sessions are active** and own this file + the marks via PR #28.
  Re-read the manifest immediately before editing (as in run 2); coordinate so a swap here doesn't
  fight a concurrent manual edit there. Consider doing this on a dedicated branch.
- **Licensing** — keep to cc0 / cc-by / cc-by-sa / cc-by-nc only; the policy explicitly allows
  cc-by-nc. Several existing invert overrides are Wikimedia or cc-by-nc; the fresh sweep should
  prefer iNat research-grade and keep attributions verbatim.
- **Wikimedia false-positives** — the 2 Jun note records a wrong-subject Wikimedia photo
  (a person mis-filed under Aurelia). The fresh sweep should stay on iNat research-grade for
  inverts and treat any Wikimedia candidate with extra suspicion (the `looksNonPhotographic`
  guard only catches engravings/plates, not wrong-subject modern photos).
- **Cost** — Group A ~26 agents x ~8 image views + Group B ~3. Comparable to run 2 (~2.2M tokens).
  Worth confirming the user wants the full sweep vs a smaller priority subset (e.g. jellyfish +
  crabs first, since those are the most feed-visible invert classes).

## Recommendation

Go **P1 (report-only, swap only hard failures)** for Group A to protect the already-authored
invert marks, and apply Group B directly. Sequence: shapeClass fix -> Group B -> Group A report ->
targeted swaps + mark re-author only where a committed photo is genuinely disqualifying.
