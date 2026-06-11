# FishSpotter feedback triage + plan (10 Jun 2026)

Source: field-tester feedback (Christian) + Anjali's notes. Decisions locked
via two clarification rounds on 10 Jun. This doc is the build brief; nothing
implemented yet.

## Decisions locked

| # | Feedback | Decision |
|---|----------|----------|
| 1 | "Spot it" not intuitive | Rename the entry button to **"Identify"** |
| 2 | "Streamlined" vs "tall and thin" too fine (mm-scale) | **Merge fully**: collapse `fusiform` + `laterally-compressed` into one body-shape value everywhere; retire the Rung-3 `bodyDepth` splitter |
| 3 | Can't X out of "learn how to ID" (not computer-optimised) | Add corner-X + Esc + click-outside to **every** modal; repro to confirm which dialog the tester hit (likely OnboardingTour) |
| 4a | Gurnards missing | Onboard **Grey gurnard** (Eutrigla gurnardus) — content task |
| 4b | Gobies under streamlined AND scoochers | Drop the `fusiform`/`elongated` tags from Common/Rock/Sand goby; **scoocher only** |
| 5 | No way to submit unsure / coarse guesses | **"Not sure / it's just a [Fish]" button** at Rung 1/2 that commits the shape class for the existing 1-pt shape-class credit |
| 6 | Menu sometimes tiles, sometimes type-in list | **Always photo tiles** at Rung 3; type-in demoted to a search box inside the grid |
| 7 | "Saucer, short tentacles" icon looks like an anemone | Redraw the silhouette as a **moon jelly** (dome + 4 horseshoe gonad rings) |
| 8 | Videos hard to read | **Brighten the default** brightness/contrast a notch + make the control obvious (tutorial points to it). Per-user, no re-encode |
| 9 | Leaderboard copy reads like a funder pitch | **Rewrite community-facing** (address the spotter, not the creator) |
| 10 | Non-skippable tutorial of hidden features | **Mandatory first visit, replayable** thereafter via a "How it works" button. Must cover: submit-at-higher-level, brightness/video controls, "show on screen", leaderboard |
| 11 | Anjali: bring depth + location as overlay into the video | Add a **toggleable depth/location chip** overlaid on the clip |
| 12 | Anjali: depth/location in the species tile | **Folded into the pokedex species profile** (below) |
| 13 | Anjali: less AI-based leaderboard + unique pokedex | Pokedex (below) + copy rewrite (#9) |
| 14 | Anjali: lots of features hard to ID by | **Content review with Anjali** — which wizard traits are unreliable; not codeable blind |

## Pokedex (decision #13, the big one)

- **Collectable species grid:** all catalogue species; correctly-ID'd ones unlock (photo + count), rest greyed/locked.
- **Higher-rung badges:** award when a user collects N distinct species within a shape-class (e.g. "3 different crabs"). Reflects rung-above achievements, not just per-species.
- **Per-species profile** (each tile opens one): behaviour, where typically seen + **distribution map if findable**, typical **depth**, **substrate** — simple SVG drawings where possible.

Notes / dependencies:
- Distribution map: render from our `SpeciesProbability` (OBIS) cache or pull a GBIF/OBIS occurrence map; check map-tile licensing before shipping.
- Profile prose (behaviour/depth/substrate) is **content** — needs marine-bio sign-off, same gate as gurnard onboarding.

## Build order

**Quick wins (copy / asset / small UX):**
- Rename "Spot It" -> "Identify" ([FeedCard.tsx:1256](../../src/components/FeedCard.tsx))
- Leaderboard copy rewrite ([leaderboard/page.tsx:195](../../src/app/leaderboard/page.tsx))
- Moon-jelly icon ([public/silhouettes/forms/saucer.svg](../../public/silhouettes/forms/saucer.svg))
- Gobies -> scoocher only ([species-traits.json](../../src/data/species-traits.json))
- Modal close affordances (audit all modals)
- Brighten video default + surface control ([videoSettings.ts](../../src/lib/videoSettings.ts), SettingsMenu)

**Medium (logic + UI):**
- Body-shape full merge: catalogue migration + `traits.ts` enum + `body-forms.ts` SUB_SPLITS + `catalogue.test.ts` + retire `bodyDepth`. Confirm merged-tile label (proposed: "Torpedo / deep-bodied").
- Always-tiles Rung 3: collapse CandidateGate vs MCQCandidatePicker into one renderer
- "Not sure" coarse-submit button -> existing shape-class scoring path
- Depth/location overlay chip on the clip
- Non-skippable first-visit tutorial (expand OnboardingTour, gate completion, add replay)

**Larger (new surfaces / content):**
- Pokedex: grid + badges + per-species profile pages
- Grey gurnard onboarding (photo + marks + sign-off)
- Trait-clarity content review with Anjali

## Open micro-decisions
- Merged body-shape tile label wording (proposed "Torpedo / deep-bodied").
- Distribution-map data source + licensing.
- Profile content authoring (who writes behaviour/depth/substrate prose; Anjali?).
