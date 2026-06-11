# Remote UI build via a Gemini-Flash visual feedback loop — PLAN

Goal: build the remaining "needs-your-eyes" UI (profiles, pokedex, coach-mark
tutorial, gate polish, WS-D) **remotely**, by replacing "Christian's eyes" with
an autonomous loop: Playwright renders + drives the real app, Gemini 3.5 Flash
judges the visuals, axe-core judges accessibility, I act on the findings.

## Why this is now feasible (verified 10 Jun)
- **Playwright 1.60 is already a dependency** (`@playwright/test`, `@axe-core/playwright`).
  -> headless screenshots to PNG **and** real interaction-driving + assertions.
- **`gemini-vision.ts` already accepts `imageBase64`** and is "designed to be
  repurposed: change buildPrompt + RESPONSE_SCHEMA." House pattern: Claude
  orchestrates, Gemini does the vision (the stronger image model).
- **Gemini key is live + has quota** (18 assessments succeeded this session; paid tier).

## What Gemini CAN and CANNOT judge (the guardrail)
- **CAN (advisory):** layout, visual hierarchy, brand/token adherence, readability
  & contrast, crowding, mobile fit at 390px, "does it match the brief / the mock".
- **CANNOT:** interaction correctness, scoring, routing, data accuracy, focus order.
  Those stay on **Playwright behavioural assertions + vitest + my `preview_eval`
  state checks**. Gemini is a second opinion on *look*, never the source of truth
  on *behaviour*. I keep final judgement; Christian reviews before any push.

## Phase 0 — build the harness (one-time, ~half a day)
1. **`scripts/lib/ui-shot.ts`** — Playwright helper. Launches chromium against the
   running preview (`localhost:3000`), sets viewport (390×844 mobile + 1280×800
   desktop), supports: `goto(route)`, `waitFor(selector)`, `pauseVideo()` (the
   feed autoplays — pause before shooting, which is why preview_screenshot timed
   out), `click`/`fill` to reach a state, screenshot full-page or a single element
   -> PNG under `implementation/<date>/shots/`.
2. **UI-critique mode in `gemini-vision.ts`** (or new `src/lib/ui-critique.ts`):
   `critiqueUi({ imageBase64, brief, rubric })` -> strict JSON
   `{ verdict: "pass"|"revise", score, matchesIntent, issues:[{severity, area,
   detail, fix}], brandViolations:[], readabilityNotes }`. New `RESPONSE_SCHEMA`
   + a prompt that embeds the **PEBL design system** (teal #3AAFA9 / navy #17252A,
   `rounded-card`, no-emoji-as-icons, ≥44px touch targets, named type tokens) so
   Gemini grades against OUR rules, not generic taste.
3. **`scripts/ui-review.ts`** CLI: `--route /species/labrus-mixtus --brief "..."`
   -> ui-shot (mobile+desktop) -> axe-core a11y scan + Gemini critique -> prints a
   structured report + writes the PNGs. This is the loop primitive.
4. **Loop protocol per element:** build/edit -> `ui-review` -> fix `severity:high`
   + `brandViolations` + axe violations -> re-run -> until `verdict:pass` or 3
   rounds (then surface to Christian). Behaviour gated separately by a Playwright
   spec + vitest. I can also view the PNGs directly as a sanity cross-check.

## Per-element build queue (each runs through the loop)

### A. Public species profile  — `/species/[slug]`  (NO schema; ship first)
Highest value, fully remote-buildable, exercises both new engines.
- Route + `SpeciesProfile` component from existing data: `fieldNote`, behaviour/
  habitat/movement traits, `SpeciesImage` gallery, `DiagnosticMark` rings
  (`AnnotatedSpeciesPhoto`), **depth band** (`depth.ts`), **distribution map**.
- **`DistributionMap` SVG component** — UK/NE-Atlantic coast basemap + density
  cells from `distribution.ts` (intensity shading). This is the most visual piece
  -> ideal Gemini-loop target (does the map read as a range? legible? on-brand?).
- Depth/distribution fetched on-demand first (cache table comes in step E).
- Verify: Playwright (route renders, marks/photos present) + Gemini (layout/brand)
  + axe (a11y). Mobile + desktop.

### B. Pokedex collection grid + badges  (NEEDS schema: `UnlockedSpecies`)
- `UnlockedSpecies` Prisma model; unlock on a correct `Answer` resolved via
  `scientificFromLocalName`. Grid of all catalogue species, locked = greyed
  silhouette, unlocked = photo + count, links to the profile (A).
- Shape-class completion badges ("3 different crabs"); a `Badge` derivation
  (computed, no table needed to start).
- Verify: Playwright E2E for unlock logic (answer correctly -> species unlocks);
  Gemini for the grid look; axe.

### C. Depth in the candidate tile (WS-I tile half)
- Wire the depth band into `SpeciesGuidePopup` / candidate tile ("usually ~5-25 m").
- Tiny; loop-verify the tile look.

### D. Coarse "submit as just a [Fish]"  (WS-D — spec already written)
- `BodyShapeGate` footer action -> existing `handleSubmit`. Playwright E2E asserts
  1 pt on a fish-ref clip, 0 on a crab-ref clip; Gemini checks button placement.

### E. Cache tables + refresh  (NEEDS schema)
- `SpeciesDepthCache` + `SpeciesDistributionCache` (TTL), populated by a script /
  weekly cron, so profiles don't hit OBIS per request.

### F. Non-skippable coach-mark tutorial (WS-H)
- Custom spotlight overlay (no new lib): blackout + transparent target window +
  tooltip, anchored to refs on the **Identify** button, **brightness control**,
  **"show on screen"** radar, **leaderboard** link. Non-skippable; folds in the
  OnboardingTour close-affordance fix. Gemini checks each step's framing at 390px
  (spotlight not clipping the target, tooltip readable).

### G. WS-F: wire `next-trait.ts` info-gain picker into the wizard + gate polish.

## Decisions needed before I start
1. **Prod schema:** B + E need `prisma db push` to the shared prod DB (additive,
   non-breaking; re-run `db:enable-rls` after). Authorize additive pushes, or
   build the code + stage the migration for you? (A/C/D/F/G need NO schema.)
2. **Build order / first target** (recommend A: profile + distribution map — no
   schema, biggest visual payoff, exercises the engines).
3. **Autonomy:** milestone check-ins (recommend) vs run the whole queue unattended.

## Risks / guardrails
- Gemini critique is advisory and can hallucinate -> I cross-check + you review
  pre-push; behaviour is gated by Playwright/vitest, not Gemini.
- Cost: ~4-10 Gemini calls per element per round (paid tier fine).
- Preview server must be running for Playwright; pause video before feed shots.
- **Nothing deploys until you push** — except a prod `prisma db push` (shared DB),
  which is exactly why decision 1 is gated on your OK.
