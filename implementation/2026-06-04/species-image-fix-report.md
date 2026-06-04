# Guide-hero fix report (4 Jun 2026)

Companion to [species-image-audit.md](species-image-audit.md). Two passes: an initial sweep (photo swaps + hero authoring + Gemini box_2d auto-placement) and a continuation (improved placer + mark trimming + re-anchoring). Baseline data: species-image-audit-data-BASELINE.json; current: species-image-audit-data.json.

## Before to after

| Metric | Baseline | Now |
|---|---|---|
| Species with a guide-hero | 42 / 57 | **57 / 57** |
| Heroes graded keep (good as-is) | 8 | **26** |
| Heroes overallAligned=true | 8 | **28** |
| Heroes needing photo replacement | 3 | **1** |
| Heroes with >4 (over-) marks | several | **0** |
| Total OFF (wrong-part) marks | 47 across 42 (1.12/hero) | **20 across 57 (0.35/hero)** |
| Avg teaching-clarity (heroes) | 71 | 70 |

Recommendation mix now: {"keep":26,"reposition-circles":28,"replace-photo":1,"re-author-marks":2}.

> **Grader-noise caveat.** Alignment is judged by Gemini vision, which is not perfectly deterministic on borderline rings, so the off/keep counts wobble by a few between identical re-runs. Treat the trend (off-marks roughly a third of baseline per hero; over-marked eliminated; keep tripled) as the signal, not the exact integers.

## What was done (continuation)

- **Improved auto-placer:** Gemini now classifies each feature point vs region; point features (eye, barbel, single spot) are capped to a small ring (<=0.10) so they no longer read as oversized. The verify loop corrects every off/near ring over 4 rounds and, on the last round, gives a still-off ring one fresh independent re-localise. `loadImage` retries CDN 429s; one species erroring no longer aborts the sweep.
- **Trimmed 7 over-marked species** to a clean 3-mark set (scripts/data/mark-redraft.ts): European sea bass, Butterfish, Rock goby, Great Spider Crab, Velvet Swimming Crab, Atlantic horse mackerel, Dog Whelk (removed duplicate / redundant draft marks like the two "Spiny gill cover" on the bass).
- **Re-anchored 2 photo-limited species:** Flat Top Shell (dropped the underside open-navel mark, not visible top-down) and Dragonet (dropped the tall first-dorsal mark, fin folded in-photo) onto features the current photo shows.
- All marks remain DRAFTS (createdBy=gemini-place@pebl-cic.co.uk) pending expert sign-off.

## Still needs a manual admin-UI pass (15)

Mostly a single borderline ring on an otherwise-good hero; the genuinely-hard ones are murky/low-res or multi-specimen photos where the feature is intrinsically hard to ring (Pollack head, Poor cod, Flounder, sea bass, the two spider/velvet crabs). Tune at /admin/species/[name].

| Species | Marks | OFF | Clarity | Note |
|---|---|---|---|---|
| European sea bass | 3 | 2 | 45 | All three markers are misaligned. Move circle 1 back to cover the dorsal fins, shift circle 2 b |
| Great Spider Crab | 3 | 2 | 45 | The circles are misaligned, with circle 2 placed on the rear of the body and circle 3 placed on |
| Velvet Swimming Crab | 3 | 2 | 50 | All three markers are misaligned. Shrink circle 1 to target the red eyes, move circle 2 onto th |
| Pollack | 3 | 2 | 45 | The circles are misaligned, with circle 2 placed on the gill cover and circle 3 placed on the e |
| Poor cod | 3 | 2 | 45 | The circles for the chin barbel and the large eye are swapped and misaligned. Swap and adjust t |
| Dragonet | 3 | 1 | 45 | The circles are poorly aligned, with circle 2 completely missing the eye and circle 1 being far |
| Edible Crab | 3 | 1 | 45 | The circles for the shell features are misaligned. Circle 1 needs to be moved to the crimped ou |
| Thick-lipped mullet | 3 | 1 | 75 | The photo itself is excellent, but circles 2 and 3 need to be repositioned. Move circle 2 sligh |
| Conger eel | 3 | 1 | 65 | The circles for the dorsal fin start and the head are misaligned and overlapping. Move circle 3 |
| Rock goby | 3 | 1 | 85 | The circles for marks 1 and 2 are swapped or misaligned. Move circle 1 to target the pale band  |
| Ballan wrasse | 3 | 1 | 75 | The photo is excellent, but the circles for marks 2 and 3 are misaligned. Circle 2 needs to be  |
| Dog Whelk | 3 | 1 | 45 | The snail is positioned face-down on the rock, making it impossible to see the oval notched ape |
| Common Limpet | 2 | 1 | 85 | The image clearly shows a common limpet clamped to the rock, but mark 1 is missing. Add a new c |
| Flounder | 3 | 1 | 30 | All three circles are stacked on top of each other as massive rings covering the entire body of |
| Plaice | 3 | 1 | 65 | Move circle 3 slightly higher to target the area directly behind the eyes where the bony ridge  |

The single-mark octopuses (Common Octopus, Curled Octopus) are intentional (one whole-body mark), not stragglers.
