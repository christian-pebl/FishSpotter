# Guide-hero fix report (2026-06-04)

Companion to [species-image-audit.md](species-image-audit.md). Records the fix sweep: P1 photo swaps, P2 hero authoring, and the Gemini box_2d auto-placement + verify loop (scripts/place-diagnostic-marks.ts). Baseline data: species-image-audit-data-BASELINE.json; post-fix: species-image-audit-data.json.

## Before to after

| Metric | Before | After |
|---|---|---|
| Species with a guide-hero | 42 / 57 | **57 / 57** |
| Heroes graded keep (good as-is) | 8 | **16** |
| Heroes overallAligned=true | 8 | **17** |
| Heroes needing photo replacement | 3 | **0** |
| Avg teaching-clarity (heroes) | 71 | 67 (dragged down by 15 new held-specimen photos) |

Per-species change in count of OFF (wrong-part) marks vs baseline: **33 improved, 24 unchanged, 0 regressed**. The two relocate regressions (Shanny, Dog Whelk) were reverted to their baseline coordinates.

## What was done

- **P1 photos replaced (2):** Dragonet to iNat 501553650 (score 82 IDEAL); Edible Crab to Wikimedia Cancer_pagurus.jpg (score 85 IDEAL). Old dead/captive photos demoted + blocklisted. Flat Top Shell needed no swap (its photo is the best available; only the rings were wrong).
- **P2 heroes authored (15):** feature lists in scripts/data/p2-mark-drafts.ts, coordinates placed by Gemini. Every previously-heroless species now has a guide-hero.
- **Relocate sweep (48):** every misaligned hero re-placed via Gemini box_2d localisation + a verify-and-correct loop; the 9 already-aligned heroes were skipped untouched.
- All marks are DRAFTS, tagged createdBy=gemini-place@pebl-cic.co.uk, pending expert sign-off.

## Still needs a manual admin-UI pass (24)

At least one ring Gemini still places on the wrong part, or the photo/marks have a content problem the placer cannot fix. Tune at /admin/species/[name].

| Species | Marks | OFF | Note |
|---|---|---|---|
| Spotted dragonet | 3 | 2 | The circles for marks 2 and 3 are swapped and misaligned. Circle 2 should be moved to the spotted body flank,  |
| Goldsinny wrasse | 3 | 2 | The photo itself is excellent and clearly shows all diagnostic features, but the circles are completely misali |
| Rock goby | 6 | 2 | Several circles are misaligned or stacked directly on top of each other. Reposition circle 1 to the first dors |
| Great Spider Crab | 4 | 2 | Marks 1 and 2 are missing from the image entirely. The remaining marks should be re-authored to include all fo |
| Velvet Swimming Crab | 4 | 2 | The current markers are highly redundant and poorly placed, with two circles floating in the empty water colum |
| Plaice | 3 | 2 | The large unnumbered circle covers the orange spots but is not labeled. Reposition circle 1 to the body spots, |
| Pollack | 3 | 2 | The lateral line circle is well placed, but the circles for the jaw and chin barbel are misaligned and need to |
| Flat Top Shell | 4 | 2 | Mark 1 is missing entirely and mark 2 is misaligned in the top-left corner on background rock. Additionally, t |
| Sand smelt | 3 | 1 | The circles are poorly sized and misaligned. Circle 1 should be centered on the bright silver stripe, Circle 2 |
| Dragonet | 3 | 1 | The first dorsal fin is folded down so mark 1 cannot show a tall fin, but the other features are visible. Shri |
| Thick-lipped mullet | 3 | 1 | The thick lip is correctly marked, but the circles for the flanks and dorsal fins are far too large and misali |
| European sea bass | 6 | 1 | Several circles are far too large or misaligned, particularly circle 1 and circle 3 which fail to target the d |
| Atlantic cod | 3 | 1 | The circles are poorly sized and placed, with circle 1 missing the chin entirely and circles 2 and 3 being far |
| Two-spotted goby | 3 | 1 | Move circle 1 down to align directly over the dark spot behind the pectoral fin, and slightly adjust circle 2  |
| Ballan wrasse | 3 | 1 | The circles are misaligned, with mark 1 completely off the fish and mark 2 shifted too high. Reposition mark 1 |
| Dab | 3 | 1 | The circles are misaligned and clustered near the tail. Move circle 1 forward to the curved lateral line above |
| Shanny | 3 | 1 | Move circle 2 up and forward to cover the eye and thick lips. Reduce the size of circle 3 and shift it slightl |
| Common Limpet | 2 | 1 | The image clearly shows the limpet clamped to the rock, but mark 1 is missing entirely. Add a new circle point |
| Butterfish | 6 | 1 | Several markers are missing, duplicated, or poorly sized. The entire set of annotations needs to be re-authore |
| Flounder | 3 | 1 | The circles are poorly sized and misaligned. Circle 3 should be resized to encompass the entire fish to repres |
| Sand goby | 3 | 1 | The circles are poorly sized and misaligned. Circle 1 needs to be shrunk to focus on the sandy skin texture, C |
| Fifteen-spined stickleback | 3 | 1 | The snout is well-marked, but circle 1 is unnecessarily large and circle 3 is placed too far back on the body  |
| Corkwing wrasse | 3 | 1 | The photo is excellent and clearly shows all features, but circle 3 is misaligned. Reposition circle 3 to targ |
| Long-spined sea scorpion | 3 | 1 | The circles are poorly sized and aligned, with circle 3 almost entirely off the fish. Reposition circle 1 to c |

### Known content bugs (duplicate / too-many marks, surfaced by the placer)

Some species carry duplicate or redundant mark labels seeded earlier (European sea bass had two "Spiny gill cover" marks; horse mackerel, rock goby and butterfish each carry 6 marks with redundancy). These need editorial trimming, not just repositioning. The placer logs exact-duplicate labels per species in placement-log.json (dupLabels field).
