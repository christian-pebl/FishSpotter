# Spot It category review + fish restructure (17 Jun 2026)

A comprehensive review of the "Spot It" identification categories and
sub-categories, with the goal that **the options at every decision node are
split in a way a beginner can easily identify**, and that **no node offers more
than 10 options** (the user's ceiling: above 10, add a lower rung). Grounded in
three UK field guides and a vision pass over all 28 fish reference photos.

## TL;DR

- **One node broke the rules: Fish.** Its Rung-2 cut ("What was the overall body
  shape?": Torpedo-or-deep / Long-and-slender / Eel-like / Bottom-scooters) put
  **20 of 28 fish into the single "Torpedo or deep-bodied" bucket** — double the
  ceiling, and (per the vision pass) an unreliable cut: deep-vs-torpedo only
  holds at the extremes.
- **Fix: re-cut the fish Rung-2 by plain-English family gestalt** (a new
  `fishGroup` trait), not body cross-section. Six groups, every one <=10, each
  something a novice can read off a clip. No 4th rung needed.
- **All six other shape classes already pass** (largest bucket = 6). No change.
- Plus four catalogue mis-tags the vision pass caught, corrected.

## How the review was done

1. **Ground truth** — enumerated every shape class + Rung-2 bucket from the live
   catalogue. Only Fish (28) exceeds 10 at Rung 1; its "fusiform" Rung-2 bucket
   held 20.
2. **Reference grounding** — read the ZSL estuarine beginner key, Sussex IFCA
   guide, and EA/Maitland key (`decision-tree/id-guides/`). All three lead a
   novice on **shape/posture + family gestalt**, not fin-ray detail. The ZSL key
   branches shape-first, then "three dorsal fins?" (cod-like).
3. **Vision pass** — downloaded and looked at all 28 fish reference photos.
   Confirmed: (a) deep-vs-torpedo is mushy in the mid-range; (b) gobies +
   dragonets + blenny + sea scorpion genuinely read as one "small bottom fish"
   group; (c) the catshark is unmistakably a shark and must leave the torpedo
   bucket; (d) the two-spotted goby hovers (body says goby).

The reference pass and the vision pass converged independently on the same
six-group family-gestalt structure.

## The new fish Rung-2 (the `fishGroup` trait)

| Tile label | `fishGroup` | Species | n | Glance test |
|---|---|---|---|---|
| Cod-shaped | `cod-like` | Pollack, Saithe, Bib, Poor cod, Atlantic cod | 5 | Chunky reef-hangers, three separate fins on the back |
| Wrasses | `wrasse` | Ballan, Cuckoo, Corkwing, Goldsinny | 4 | Deep, thick-lipped, one long fin, in the rocks |
| Silver shoalers | `silver-shoaler` | Mackerel, Horse mackerel, Sprat, Sand smelt, Sea bass, Thick-lipped mullet | 6 | Slim and silver, out in open water |
| Bottom-sitters | `bottom-sitter` | Dragonet, Spotted dragonet, Common/Rock/Sand/Two-spotted goby, Shanny, Long-spined sea scorpion, Red mullet | 9 | Small fish perched on the seabed |
| Long and skinny | `long-skinny` | Conger eel, Butterfish, Fifteen-spined stickleback | 3 | Eel-like, much longer than it is deep |
| Shark-shaped | `shark` | Lesser-spotted catshark | 1 | Looks like a little shark |

All 28 fish covered exactly once. Largest bucket = 9 (<=10), so **no fish Rung-3
is required**. A regression test (`body-forms.test.ts`) now enforces the <=10
ceiling and full fish coverage so future catalogue growth can't silently break
either.

### Why family gestalt over body shape

The old `bodyShape` cut asked a near-millimetre question (torpedo vs deep) that
collapses for the 20 fish that all just look like "a normal fish". Family
gestalt (cod-like / wrasse / silver shoaler / bottom-sitter) is what the field
guides themselves use for beginners and what a novice can actually judge from a
short underwater clip. `bodyShape` is retained as a secondary scored descriptor;
`fishGroup` is now the authoritative fish gate trait.

## Catalogue mis-tags corrected (from the vision pass)

- **Lesser-spotted catshark** — was in the torpedo bucket; now `fishGroup: shark`
  (its own group). It reads as a shark instantly.
- **Long-spined sea scorpion** — grouped with the gobies/dragonets as a
  `bottom-sitter` (it is a big-headed seabed ambusher, not a torpedo).
- **Sprat** `bodyDepth` deep -> slender; **Corkwing wrasse** `bodyDepth` deep ->
  medium (both reference photos read slimmer than "deep").

(The two-spotted goby keeps its hovering nuance in its field note but is grouped
under Bottom-sitters so a beginner finds it with the other gobies.)

## What changed in code

| File | Change |
|---|---|
| `src/lib/idguide/traits.ts` | New `FISH_GROUP` enum + `FishGroup` type; optional `fishGroup` on `SpeciesTraits` + `TraitSelection`. |
| `src/lib/idguide/narrow.ts` | `fishGroup` registered in `TRAIT_KEYS` + `ALLOWED_VALUES`. |
| `src/lib/idguide/catalogue.ts` | `fishGroup` added to the strict zod schema. |
| `src/lib/idflow/body-forms.ts` | Fish `SUB_SPLITS` key `bodyShape` -> `fishGroup`, prompt "What kind of fish was it?", 6 options. |
| `src/data/species-traits.json` | `fishGroup` on all 28 fish; sprat/corkwing `bodyDepth` fixes. |
| `public/silhouettes/forms/*.svg` (x6) | Tile silhouettes: `cod-like` + `shark` authored (PEBL CC0); `wrasse`/`silver-shoaler`/`long-skinny`/`bottom-sitter` reuse the matching PhyloPic/PEBL art. Registered in `bodyform-silhouette-credits.json`. |
| `src/lib/idflow/trait-questions.ts` | Curated `fishGroup` yes/no copy (for the orphaned adaptive engine). |
| `*.test.ts` | `fishGroup` coverage in `trait-questions.test.ts`; <=10 ceiling + fish-coverage guards in `body-forms.test.ts`. |

## Verification

- `npx tsc --noEmit` clean; **336 tests pass**; `npm run lint` + `npm run lint:tokens` clean.
- All 6 tile silhouettes rasterised and eyeballed — each reads as its label.
- Live walk (dev server, Playwright): Rung 2 shows the six groups with correct
  counts; tapping Cod-shaped narrows Rung 3 to exactly the 5 cod species.

## Follow-ups (not done; optional)

- **Bottom-sitters (9)** is within the ceiling but heterogeneous. An optional
  Rung-3 head-shape cut (flat-headed dragonets/scorpion vs rounded-head
  gobies/shanny/red-mullet) would tighten it if desired.
- **Catshark Rung-1 tile** — a beginner seeing a dogfish may tap nothing and look
  for "Shark" at Rung 1. Considered out of scope (it is correctly a fish; the
  Shark-shaped Rung-2 tile catches it). Revisit if telemetry shows misses.
- **Dead asset** `public/silhouettes/forms/laterally-compressed.svg` (retired
  `bodyShape` value) can be removed in a future cleanup.
- **`decision-tree/index.html`** (authoring artifact, not runtime) still shows
  the old fish grouping; refresh when convenient.
