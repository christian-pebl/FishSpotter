# FishSpotter — Remaining Feedback Work: Detailed Plan (11 Jun 2026)

Closes out the initial feedback round. ~11 items shipped (PR #56); this plans the
5 genuinely-open ones + the enabler that makes the pokedex non-hollow. Build via
the Gemini visual loop (`scripts/ui-review.ts`) + Playwright/vitest; motion via
the `fishspotter-animations` + `validate-animation` skills. Each lands as its own
commit on a working branch off updated `main` (after #56 merges), gated by
`npx tsc --noEmit && npm test && npm run lint && npm run lint:tokens`.

## Open items (what this plan covers)
| Item | Feedback | Size | Why it's still open |
|---|---|---|---|
| A. Admin reference editor | (#16 enabler) | **L** | Pokedex can't fill — no species-level references exist in any clip |
| B. Non-skippable tutorial | #10/#13 (+#3) | **L** | Targets are state-dependent; needs careful coach-mark engineering |
| C. next-trait wiring | #11 | M | Info-gain picker built but unwired |
| D. Gurnard apply | #4 | M (content) | Drafted; needs enum decisions + sign-off |
| E. Global a11y | (loop) | S | skip-link + region landmarks, app-wide |
| F. /species nav link | (discoverability) | S | Index built but not linked in nav |

## Priority + sequencing
1. **E + F first** (quick, low-risk, clear value): a11y skip-link/region + nav link. ~half a day.
2. **A: Admin reference editor** — unlocks the pokedex's whole point; also lets us
   add the species-level refs that B's tutorial and the catalogue lean on.
3. **B: Non-skippable tutorial** — the biggest UX ask; closes #3 too.
4. **C: next-trait wiring**, then **D: gurnard** (content + sign-off cadence).

---

## A. Admin snippet reference editor  [L]
**Goal:** let PEBL staff set a clip's reference to a catalogue species where they
can, and explicitly mark "indeterminate to species" where they can't — then
retro-score existing answers + retro-unlock the pokedex. This is what makes the
collection fill (today every clip is `functional_group`-only).

**Architecture** (mirror the existing `admin/species/[name]` editor pattern):
- `src/app/admin/snippets/page.tsx` — list all snippets: thumbnail, site/date,
  current `staffAnswer` + whether it's species-level (resolves via
  `scientificFromLocalName`) or coarse, and answer count. Filter: "coarse only".
- `src/app/admin/snippets/[id]/page.tsx` — per-clip editor: the clip player +
  bbox, current reference, a catalogue species picker (reuse `SpeciesSuggestions`),
  a confidence note, and an explicit **"Indeterminate to species — keep as {group}"**
  toggle (first-class state, not a failure).
- `src/app/admin/snippets/[id]/actions.ts` — `setSnippetReference(snippetId, value)`:
  gated by `requireAdminSession()`; in a transaction:
  1. update `Snippet.staffAnswer`,
  2. **retro-rescore** every `Answer` on that snippet via the alias-aware
     `matchAnswer()` (NOT raw lower()), writing `isCorrect` + `points` (the SQL
     sketch in CLAUDE.md > Scoring model, but in code),
  3. **retro-unlock**: for answers that are now correct + resolve to a catalogue
     species, upsert `UnlockedSpecies` (same path as `api/answers/route.ts`).
- Add `admin/snippets` to the admin top-nav (`admin/layout.tsx`); `robots:noindex`
  already set there.

**Edge cases:** changing a reference can make a previously-correct answer wrong
(points drop) — that's correct; log it. Indeterminate clips keep a coarse
`staffAnswer` (shape-class scoring stays valid). A one-shot
`scripts/backfill-unlocked-species.ts` (already exists) re-syncs after a batch.

**Verification:** Playwright E2E (set a species ref → an existing matching answer
flips to correct + the user's pokedex gains the species); admin pages via the
Gemini loop; vitest for the rescore helper (extract it pure).
**Effort:** ~1.5 days.

---

## B. Non-skippable coach-mark tutorial (WS-H, closes #3)  [L]
**Goal:** a required first-run walkthrough that surfaces the hidden features the
tester only found by hunting: how to Identify, submit at a higher level, change
brightness, "show on screen", and the leaderboard. Replaces the 3-slide
`OnboardingTour`.

**The core problem (found 11 Jun):** every target lives INSIDE the per-card
`FeedCard` overlay and is state-dependent (panel collapsed until watched; the
docked "Show on screen" bar and the post-submit leaderboard link only exist in
certain states). A naive anchored coach-mark points at absent elements.

**Recommended approach — driven coach-marks with graceful fallback:**
- A `CoachMarks` client component driven by an ordered step list. Each step:
  `{ key, target: string (data-coach attr), title, body, prepare?: () => void,
  placement }`.
- `prepare()` drives the feed into the state where the target exists (e.g. expand
  the active card's panel before the "Identify" step). Coupling the tutorial to
  feed state via a tiny shared store or custom events (`window.dispatchEvent`) —
  decide at build (a Zustand-less `useSyncExternalStore` ping is enough).
- Spotlight = one positioned `div` over the target rect with
  `box-shadow: 0 0 0 9999px rgba(0,0,0,.7)` (dims everything else) + a tooltip
  card with Back / Next (Done on last). Recompute rect on resize/scroll.
- **Graceful fallback:** if a `target` can't be found/prepared, the step renders
  as a centered card with a small inline SVG illustration of the feature (e.g. a
  mini radar-ping for "show on screen") rather than a broken spotlight. So the
  walkthrough never points at nothing.
- Add `data-coach="identify|brightness|show-on-screen|leaderboard"` to the real
  controls in `FeedCard` / the nav.
- **Non-skippable:** no Skip; advance-only; arrow/Enter keyboard nav; Escape does
  NOT dismiss (re-shows on reload until `onboardedAt` set). Keep it to 5 steps so
  "required" isn't punishing. Completion POSTs `/api/account/onboarding`. (a11y:
  document the deliberate no-dismiss; trap focus; respects reduced-motion.)
- **Motion:** spotlight move + tooltip enter via `src/lib/motion.ts` tokens; build
  with the `fishspotter-animations` skill, QA with `validate-animation` (the static
  ui-review loop can't judge the motion arc).

**Steps (draft):** 1 Welcome → 2 Tap a clip to Identify → 3 Not sure? submit at a
higher level ("just a Fish") → 4 Brightness/clarity (Settings) → 5 Show on screen
+ Leaderboard.
**Verification:** Playwright drives each step + asserts the right target is
spotlit; `validate-animation` filmstrip per transition; Gemini loop on each step
at 390px. **Effort:** ~2 days (the state-driving is the cost).

---

## C. Wire the next-trait info-gain picker (#11)  [M]
`src/lib/idguide/next-trait.ts` (`nextBestTrait`, tested) is unused. Wire it so the
ID flow asks the single most-discriminating question when many candidates remain,
attacking "features hard to identify by".
- In `CandidateGate`: when candidates > ~8, insert one `nextBestTrait` yes/no cut
  (using `trait-questions.ts` prompts) before rendering the photo grid; narrow on
  the answer. Reuses the orphaned `CandidateStrip`/`trait-questions` machinery.
- Keep "Not sure" (skip the cut) + the coarse-submit. Verify: candidate-count
  drops after the cut (Playwright); vitest already covers the picker.
**Effort:** ~1 day.

## D. Apply Grey gurnard (#4)  [M, content]
Per `implementation/2026-06-10/grey-gurnard-onboarding-draft.md`. Needs your calls:
the body-shape bucket (bottom-scooter vs elongated) and a likely new
`free-pectoral-rays` feature enum. Then: override → `db:refresh-images --species`
→ traits entry → `db:seed-aliases` → author 3 marks → `catalogue.test` green.
**Effort:** ~half a day once the two enum calls are made + sign-off.

## E. Global a11y: skip-link + region landmarks  [S]
The loop flags `region` + `skip-link` on every page. Fix once in the root layout
(`src/app/layout.tsx`): a visually-hidden, focusable "Skip to content" link
targeting `#main`, and ensure each route's top element is a `<main id="main">`
landmark (profile/species index use plain `<main>` — add `id`). Re-run axe to 0.
**Effort:** ~2 hours.

## F. /species nav link  [S]
The species index exists but nothing links to it. Add a "Species guide" entry to
the global nav/menu (the hamburger), and a link from the pokedex header. **Effort:** ~1 hour.

---

## Cross-cutting
- **Branch/PR:** after #56 merges, branch off `main`; one PR per feature (A and B
  are big enough to review separately); E/F/C can share a "polish" PR.
- **Verification:** Gemini loop for all visual surfaces (admin pages, tutorial
  steps, nav); `validate-animation` for the tutorial motion; Playwright E2E for
  the behavioural invariants (retro-score, retro-unlock, coach-mark targeting,
  next-trait narrowing); the standard gate before every push.
- **R2 re-consolidation** (orthogonal): still awaits `R2_*` creds in `.env.local`;
  one idempotent `reupload-snippets-hq.ts` run under `STORAGE_PROVIDER=r2`.

## Decisions
1. **Tutorial approach — LOCKED:** driven coach-marks (prepare() drives feed state)
   with an illustrated centered-card fallback when a target can't be reached. ~2 days.
2. **Admin editor scope — LOCKED:** full in-app `admin/snippets` editor + retro-score
   + retro-unlock on save. ~1.5 days.
3. **Gurnard (still open):** the body-shape bucket + whether to add the
   `free-pectoral-rays` feature enum — needs Christian's marine-bio call.
4. **Merge #56 first (recommended):** large branch (feedback + loop + profile +
   pokedex + cache + coarse-submit). Merge before stacking A/B to keep PRs reviewable.
