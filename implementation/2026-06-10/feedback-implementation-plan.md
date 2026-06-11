# FishSpotter Feedback Implementation Plan (10 Jun 2026)

Source: field-tester feedback (Christian) + Anjali. Video-legibility was handled
separately (source re-cut + ffmpeg export fix; see CLAUDE.md "Quality re-cut").
This plan covers everything else.

## Locked decisions (from AskUserQuestion, 10 Jun)
- **Body shape gate:** merge "Torpedo/streamlined" (fusiform) + "Tall and thin"
  (laterally-compressed) FULLY into one value everywhere.
- **Coarse guess:** a "Not sure - submit as just a [Fish]" path at Rung 1/2 that
  commits the shape class for the existing 1-pt shape-class credit.
- **Rung-3:** always photo tiles; type-in becomes a secondary search inside the
  grid, never the default.
- **Pokedex:** collectable species-tile grid + higher-rung badges (e.g. "3
  different crabs") + a full per-species profile (behaviour, where seen, typical
  depth, substrate, distribution map if findable; simple SVGs where possible).

## Open decisions - RESOLVED (10 Jun)
1. Rename "Spot It" -> **"Identify"**.
2. Gurnard to add: **Grey gurnard** (Eutrigla gurnardus) only.
3. Distribution map: **GBIF/OBIS occurrence density** (fetch + cache real records).
4. Tutorial style: **interactive coach-marks** (highlights pointing at real UI).
5. (defaulted) Substrate: no data exists anywhere; v1 omits it from profiles and
   the on-video overlay until a `Snippet.substrate` field or per-site map is added.

---

## Workstreams

### WS-A - Quick copy & icon fixes  [S, code]  Phase 1
Independent, ship first.
- **Leaderboard copy** (`src/app/leaderboard/page.tsx:195` + scoring blurb ~198):
  rewrite the creator-facing "Reward regular participation..." line to address the
  spotter directly and drop the "AI/monitoring record" framing. Less-AI tone.
- **Jellyfish "saucer" icon** (`public/silhouettes/forms/saucer.svg`): redraw as a
  clear moon-jelly dome with four horseshoe gonad rings (currently reads as an
  anemone). Hand-authored filled SVG; preserve credits per `fetch-bodyform-silhouettes.cjs`.
- **Gobies retag** (`src/data/species-traits.json`): drop the extra `fusiform` /
  `elongated` tags from Common, Rock, Sand goby so they live ONLY under
  `bottom-scooter`. Re-run `catalogue.test.ts`.
- **Modal close affordances** ("not computer optimized, can't X out"): add a visible
  corner-X to `OnboardingTour.tsx` (today only Skip/Got-it) and confirm
  `IdGuideSheet` / `MapModal` all have X + Esc + click-outside (`useModalFocus`
  already gives Esc/focus-trap; verify the click-outside + visible X on each).

### WS-B - Rename "Spot It"  [S, code]  Phase 1  (BLOCKED on decision 1)
- Button label at `FeedCard.tsx:1256`; sweep for other "Spot It" UI strings
  (onboarding copy, aria-labels). Single find/replace once the name is chosen.

### WS-C - Body-shape merge (fusiform + laterally-compressed -> one)  [M, code+content]  Phase 2
- Enum: `src/lib/idguide/traits.ts` body-shape values - collapse the two into one
  (proposed value `torpedo-or-deep`, label "Torpedo / deep-bodied"; final label TBD).
- Sub-split tile: `src/lib/idflow/body-forms.ts` SUB_SPLITS - one tile instead of two.
- Catalogue: retag every `laterally-compressed` (and `fusiform`) species in
  `species-traits.json` to the merged value; update zod enum in `catalogue.ts`;
  fix `catalogue.test.ts`.
- Silhouette: one merged `public/silhouettes/forms/<value>.svg` (small content).
- NOTE: the Rung-3 `bodyDepth` trait (deep/medium/slender) is SEPARATE from
  bodyShape and stays - so narrowing keeps a fine discriminator even after the
  gate-level merge. `narrow.ts` / `next-trait.ts` need no logic change, only the
  enum/data.

### WS-D - Coarse "Not sure" submission  [M, code]  Phase 2
- Add a "Not sure - it's just a [Fish/Crab/...]" action on the Shape gate (Rung 1)
  and Body gate (Rung 2) that submits the shape-class label as `chosenOption`.
- Scoring already supports it: `answer-matching.ts` maps coarse words -> ShapeClass
  and pays `POINTS_SHAPE_CLASS = 1` on a shape match. No scoring change needed.
- Files: `ShapeGate.tsx` / `BodyShapeGate.tsx` (add the button), `FeedCard.tsx`
  submit path (route the coarse label through the existing submit).

### WS-E - Rung-3 always tiles  [M, code]  Phase 2
- Make `CandidateGate` (photo tiles) the only Rung-3 surface. Fold the type-in box
  into the tile grid as a secondary "search" affordance; remove the separate
  list-default path.
- Today tiles ARE the main path (`spotItActive && !myAnswer` -> CandidateGate); the
  divergence the tester hit is: (a) "Pick from a list"/"Skip to guess" -> MCQ
  free-text, and (b) `selectCandidates()` returning `DEGENERATE` (<2 photo
  candidates) -> free-text. Fix both: on DEGENERATE show catalogue tiles with
  silhouette fallback instead of dropping to free-text; demote "Pick from a list"
  to an in-grid search.
- Files: `src/lib/biodiversity/candidates.ts` (fallback handling),
  `FeedCard.tsx` (guessMode routing), `MCQCandidatePicker.tsx` (becomes the in-grid
  search, not a separate screen).

### WS-F - Gurnards + trait discriminability  [content+code]  Phase 4  (BLOCKED on decision 2)
- Add gurnard species via `docs/runbooks/add-a-species.md`: traits in
  `species-traits.json`, curated photo (`species-images.json` + `db:refresh-images`),
  diagnostic marks, marine-bio sign-off.
- Anjali's "features hard to identify by": a trait-discriminability review (which
  traits actually separate look-alikes). Partly addressed by richer profiles (WS-J)
  and the existing "Why ask this?" rationale. Treat as an ongoing content pass, not
  a code blocker.

### WS-G - Video legibility finish  [S, code]  Phase 3
- Source quality: DONE (re-cut).
- Consider a small default brightness bump for underwater murk in
  `src/lib/videoSettings.ts` (default 0 -> +1) - A/B by eye; keep the control.
- Tutorial points users at the brightness/contrast control (WS-H).

### WS-H - Non-skippable tutorial + desktop polish  [M-L, code]  Phase 3  (decision 4)
- Extend `OnboardingTour.tsx` (3 slides today, skippable) into a required walkthrough
  covering: how to ID / **submit at a higher taxon** (WS-D), **brightness/contrast**
  control (`SettingsMenu.tsx`), **"show on screen"** radar (`FeedCard.tsx:1014`),
  **leaderboard**, video controls.
- "Non-skippable": remove Skip; advance-only; "Got it" closes on the last slide.
  Keep an accessibility-safe exit (Esc) but re-show until `onboardedAt` set.
- Style: expanded static slides w/ one illustration per feature (lower effort) OR
  interactive coach-marks pointing at live UI (higher effort) - decision 4.
- Desktop: the modal-X fix (WS-A) covers most of "not computer optimized."

### WS-I - Depth / location surfacing  [M, code+data]  Phase 3
- **On-video overlay** (FeedCard): a small toggleable chip showing depth +
  location/date from `snippet.depthM` / `lat` / `lon` / `recordingDatetime`
  (e.g. "12 m - 51.6N, 5.1W - Jul"). Substrate omitted until data exists (decision 5).
- **"Typically seen at ~X m"** per species: aggregate `SpeciesProbability.depthBucket`
  weighted by probability per scientificName -> a typical-depth range. New helper +
  cache (no per-species depth stat exists today). Surface on the profile (WS-J) and
  optionally the candidate tile.

### WS-J - Pokedex + species profiles + leaderboard tie-in  [L, code+content]  Phase 4
- **Collectable grid:** all catalogue species; a species unlocks when the user has a
  correct ID (resolve `Answer.chosenOption` via `SpeciesNameMap` -> scientificName,
  `isCorrect`). Locked = greyed silhouette. New route (e.g. `/u/[id]/collection` or
  a tab on the profile).
- **Higher-rung badges:** distinct species collected per shape-class -> badges
  ("3 different crabs"). New badge logic + display.
- **Per-species profile** (new route `/species/[slug]`): fieldNote + behaviour /
  habitat / movement traits (have), photos (`SpeciesImage`), diagnostic marks
  (`AnnotatedSpeciesPhoto`), typical depth (WS-I), where seen / distribution map
  (decision 3), substrate (decision 5). Simple SVGs where possible.
- **Leaderboard:** less-AI framing (overlaps WS-A) + link each spotter row to their
  profile/collection.
- Depends on WS-I (depth agg) + decisions 3 & 5.

---

## Progress log (10 Jun, remote)
SHIPPED + verified (uncommitted, won't deploy until pushed): WS-A copy/icon/gobies,
WS-B rename "Identify", **WS-C body-shape merge** (retired `laterally-compressed`
into `fusiform` "Torpedo or deep-bodied"; 8 species retagged; 286 tests green),
**WS-G brightness default +1/+1** (verified live: `brightness(1.08) contrast(1.08)`),
**WS-I on-video depth/location chip** (verified live: "20 m · Bideford Bay · Jul 2024"),
**WS-E** removed the standalone "Pick from a list" entry so "Identify" -> tiles is
the single consistent entry (type-in still reachable via CandidateGate -> MCQ +
DEGENERATE fallback). Backend engines (depth, distribution) + GBIF polish done
earlier. Gurnard photo curated + onboarding drafted.

### WS-D build spec (staged — needs your eyes / interactive verify)
Coarse "Not sure -> submit as just a [Fish]" at the BODY gate (Rung 2, where the
shape class is already chosen — cleanest spot vs Rung 1 which has no class yet):
1. `BodyShapeGate` footer: add an action "Submit as just a {shapeLabel}" (e.g.
   "Submit as just a Fish") alongside the existing notSure/skip.
2. FeedCard: pass the chosen shapeClass label + a `onSubmitShapeClass` callback
   that calls the SAME `submitAndAdvance(() => handleSubmit({ answerText: <shape label> }))`
   path used elsewhere. Scoring already handles it (`answer-matching` maps coarse
   words -> shape class -> `POINTS_SHAPE_CLASS=1`; unit-tested).
3. Verify interactively: submitting "Fish" on a fish-reference clip scores 1, on a
   crab-reference clip scores 0; the reveal shows the coarse verdict in place.
Left unbuilt because it changes the shared TileGate/gate API + the live submit
path, and the interaction placement is a UX call best made watching it.

## Sequencing
- **Phase 1 (quick wins):** WS-A, WS-B. Ship in a day.
- **Phase 2 (core Spot-It UX):** WS-C, WS-D, WS-E. The heart of the ID flow.
- **Phase 3 (engagement + clarity):** WS-I, WS-H, WS-G.
- **Phase 4 (big build + content):** WS-J, WS-F.

## Data/content gaps to commission (not pure code)
- Gurnard onboarding content + sign-off (WS-F).
- Substrate per snippet/site (WS-I/J) - no field exists.
- Distribution-map source (WS-J).
- Merged body-shape silhouette + moon-jelly icon (WS-A/C) - hand-authored SVGs.

## Out of scope / deferred
- Open-science/data-commons pivot (parked).
- Reveal redesign PR #51 (separate track).
- Interactive coach-marks if decision 4 picks static slides.
