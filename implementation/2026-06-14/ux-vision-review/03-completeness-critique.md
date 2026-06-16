# Vision UX Review — Completeness Critique

**Adversarial review of** `00-screenshot-manifest.md`, `01-consolidated-findings.md`,
and `02-implementation-plan.md`. Written by a completeness critic: the job is to find
what is **missing, wrong, or mis-prioritised**, and to say whether the deliverable is
good enough to act on. I read all three docs, the shared `_BRIEF.md`, the 7 per-agent
findings files, spot-checked 8 screenshots, and verified several load-bearing claims
against the live code (`tailwind.config.ts`, `RevealResult.tsx`, the `idflow/` tree).

---

## (a) Verdict on overall completeness/quality

**Strong and actionable, with one factual error at the centre of a Top-10 fix and a
set of named blind spots the plan should own rather than silently inherit.** The
synthesis is genuinely good: 88 raw findings deduped to 38 with disciplined,
*re-verified* severity (three reviewer P0s correctly demoted, two P1s correctly added
from re-capture), an honest "keep/protect" list, a defensible leverage-ranked Top 10,
and a 7-wave plan whose dependency order (tokens → reward/meaning → first-run → browse
→ auth → system → a11y) is mostly right. My spot-checks confirmed the headline claims
(browse wall, bbox-over-text bug, the deficit pokédex, the thin community split, the
secondary-reveal regression). But it is a **vision-only** review that under-declares
its structural blind spots, it contains a **concrete error about the verdict tokens**
(they already exist; the amber is a deliberately-named token, not a stray utility),
and a handful of severities and "facts" need correction before a developer acts on
them literally. It is close to done — it needs a short errata pass and an explicit
"what a vision review cannot see" section, not a redo.

---

## (b) Coverage gaps

Surfaces / states / flows that were NOT captured and whether they matter for the
**public-engagement** goal.

### Matters — add to plan (verify or design the state, even if no new screenshot)

1. **Loading / skeleton / first-paint states — NOT captured. MATTERS.**
   The app is known to mount ~30 feed videos at once (per the project memory and
   `CLAUDE.md` history). The single biggest engagement risk on a phone on cellular is
   a slow, janky, or blank first paint — and *every* screenshot here is a fully-loaded
   steady state. A casual visitor who bounces does so in the first 3 seconds, which
   this review never looked at. **Action: add-to-plan** — Wave 0 or a new "perf/first-
   paint" note: capture cold-load on throttled network, confirm the feed lazy-loads /
   only mounts the active card ± neighbours, and define skeletons for feed, browse grid,
   pokédex, leaderboard.

2. **The MCQ / type-in "Pick from a list" fallback identify path — only partially captured.**
   `snippet-01-challenge` shows the type-in on the *secondary* page, but the **in-feed
   "Pick from a list" MCQ** (the escape hatch named at every rung, and the
   `MCQ_CURATED_PHOTOS_ONLY` photo-gate surface in `CLAUDE.md`) was never opened. This
   is the path a stuck beginner takes, and `CLAUDE.md` warns most MCQ tiles silhouette
   today because only one species is curated. **Action: capture-later + add-to-plan** —
   it likely shares T-19's "dark/unlabelled tile" problem and the plan should say so.

3. **The "wrong answer" feed reveal vs the "close/correct" ones — under-sampled.**
   The primary *feed* reveal was only captured as a **Close** (`feed-05`) and the authed
   one only as **Wrong** (`verify-authed-reveal`). There is **no guest "flat-out wrong"
   feed reveal** and **no "species-correct +2" feed reveal**. The wrong-answer moment is
   where a beginner is most likely to feel bad and leave; the +2 moment is the dopamine
   peak the reward work (Wave 1) is built around. Designing T-06/T-07 against only the
   "Close +1" frame risks tuning the wrong state. **Action: capture-later** before
   building Wave 1, so the verdict hierarchy + count-up is validated on all three
   verdict states (correct/close/wrong), not one.

4. **The transactional email / weekly digest — NOT captured. MATTERS (and it's in scope).**
   T-26 makes the verify-email banner pin the "weekly digest" perk all over the play
   surface, and `src/lib/email/client.ts` + the digest cron exist. The **digest email
   itself is a retention surface** (it is the thing the banner nags you to enable) and
   it was never reviewed. A nag toward an unseen, possibly-unbranded email is a weak
   loop. **Action: add-to-plan** — review the digest/verification email template for
   brand + the same contribution narrative (T-01) before leaning on it in T-26.

5. **Genuinely-empty community / consensus states at the source.**
   T-09 is built on n=1/n=2 splits, but the review never saw a snippet with **zero**
   community answers (the literal "be the first" state it recommends), nor the
   consensus retro-credit beat. The recommended "be the first to help ID this" UI is
   thus designed blind. **Action: capture-later** — confirm the zero-answer reveal
   actually exists and isn't already handled.

### Matters less / lower priority

6. **Browse desktop "blank teal panel" claim is partly a capture artifact.** See (d):
   on `d-browse` I see mostly murky-green frames and one clear blue tile, **not** "half
   the grid is flat light-teal panels with no image." The bare-panel claim (T-04 / E-04
   / F-11) is real on *some* tiles but overstated; treat poster-coverage as a thing to
   *measure*, not an assumed 50% failure. **Action: add-to-plan** — Wave 3 step 1
   already says "investigate"; just don't pre-commit the "half are blank" number.

7. **The signed-in feed (`authed-02-feed-authed`) is captured but barely analysed.**
   It mostly duplicates the guest feed; fine to leave, but the verify-email banner's
   interaction with it (T-26) is the only live thread.

### Out of scope (correctly omitted — name them so nobody asks later)

- **Dark mode / RTL / i18n** — the app is single-locale English, light-with-a-dark-feed
  by design (T-13 is literally about that duality). No OS-dark-mode or RTL obligation
  for a UK citizen-science MVP. **Out of scope.**
- **Admin surfaces** (`/admin/*`, the annotator, species editor) — internal, `noindex`,
  not public. **Out of scope** for an engagement review. Correctly excluded.
- **Very-large / ultrawide and very-small (<360px) viewports** — 390 and 1280 are the
  right two to grade; extreme widths are low-value here. **Out of scope.**
- **Offline / service-worker behaviour** — `public/sw.js` is app-shell-only; not an
  engagement lever. **Out of scope** (note it, don't chase it).

---

## (c) Lens gaps the plan MUST acknowledge

A vision review structurally cannot see these, and several **materially affect
engagement**. The plan's "Invariants" box names colour-blindness and 44px but does not
admit the *whole class* of things screenshots miss. Add a short "What this review could
not see" subsection so these don't read as solved:

1. **Performance / first-paint / the all-videos-mounted problem.** The single most
   likely real-world bounce cause, invisible to a steady-state screenshot. Must be
   named. (Ties to coverage gap 1.)

2. **Interaction timing, motion quality, and jank.** Wave 1 hinges on a "scale-in +
   points count-up" and an "unlock animation," and Wave 5 on rung transitions — none of
   which a still can judge. The plan *does* route these through
   `fishspotter-animations` + `validate-animation`, which is correct; but it should
   state plainly that **motion quality is unreviewed in this pass** and is a gate, not a
   given.

3. **Real copy at length / dynamic content overflow.** Every header-truncation finding
   (T-20, T-33) is a symptom of testing with one site name ("Bideford Bay, North Devon,
   UK"). Longer species names, longer site names, 3-digit point totals, and a 2-line
   verdict label are untested. The reward redesign (T-06/T-07) must be checked with the
   **longest** species binomial and a streak in the hundreds, not the demo data.

4. **Actual tap accuracy / real touch targets.** T-18 is eyeballed ("look under 44px").
   Whether the species-strip "i" dot vs thumbnail mis-fires is a *device* test, not a
   pixel-measure. Name it as "needs on-device verification."

5. **Screen-reader / keyboard a11y (vs visual a11y).** This is the biggest unflagged
   lens. The review covers contrast + colour-only meaning (visual a11y) well, but says
   nothing about focus order, focus-visible rings, `aria-live` on the reveal verdict
   (does a screen-reader user even hear "+1"?), the modal focus-trap contract
   (`useModalFocus` exists per `CLAUDE.md`), `inert` on off-screen feed cards (a known
   invariant), or keyboard operability of the rung tiles. For a product that publishes a
   **WCAG 2.1 AA pledge**, shipping a "fixed a11y" wave that only addressed *visual*
   a11y would be a credibility risk. **The plan should explicitly scope Wave 6 as
   "visual a11y only" and add a non-visual a11y audit as a named follow-up** (axe catches
   some of it; focus order and live-regions it does not).

6. **Data/empty-at-scale and the opposite — crowded-at-scale.** Everything was shot at
   n=6 spotters / 0 unlocks. The first-run fixes (Wave 2) are designed for the empty
   end; nobody checked what the leaderboard, pokédex, or community split look like at
   **healthy** scale (a 57/57 pokédex, a 50-row leaderboard, a 12-way community split).
   A momentum frame that works at "1 of 57" can break at "55 of 57." Low priority, but
   name it.

---

## (d) Errors / mis-prioritisations / regression-risk

Specific, with T-ids.

### ERROR (factual) — the verdict tokens already exist; T-06's premise is wrong

- **T-06 / T-11 / Top-10 #7 / Wave 0 Step 1 are built on a false statement.** The docs
  repeatedly assert the "Close" pill is "an **off-palette amber** outside the documented
  PEBL palette **and the named verdict tokens**." **This is incorrect.**
  `RevealResult.tsx:122` already renders the pill with `bg-pending text-pending-ink` —
  i.e. it **is** the named token. And `tailwind.config.ts:54-69` already defines
  `correct` / `incorrect` / `pending` (the Q4-D2 token set). The "Wrong" pill already
  uses `incorrect` (rose), confirmed in `verify-authed-reveal`.
  - **What's actually true:** the `pending` token's *value* is `#fcd34d` (amber-300, by
    deliberate Q4-D2 design). So the colour on screen is amber, but it is a **named,
    intentional token**, not a stray Tailwind utility that "snuck in." The real question
    T-06 should ask is a *palette decision*: **should the `pending` token value be amber
    at all, given a red/green-and-yellow colour-blind owner**, and it needs a redundant
    non-colour cue regardless.
  - **Consequence for the plan:** Wave 0 Step 1's "Add named tokens `correct`,
    `incorrect`, `pending`" is **redundant for all three** — they exist. Only `notice`
    and the two **text** tokens (`muted`, `muted-strong`) are genuinely new. Top-10 #7
    "**stand up** the named verdict-token set" overstates the work by ~70%. **Fix the
    docs to:** (i) `notice` + `muted` + `muted-strong` are new; (ii) T-06 is "revisit the
    `pending` token *value* + add a non-colour cue + promote focal weight + reword
    `≈`/`Close`," a **call-site + one-token-value** change, not a token-creation task.
  - Severity of the *user-facing* problem (quiet, colour-only, cryptic glyph) is fairly
    P1; only the **cause description and the effort** are wrong. This is the single most
    important correction in this critique.

### CONTRADICTION — T-09 over-generalises "excludes the user's own guess"

- **T-09 says the community split "excludes the user's own guess."** In `feed-05` (guest,
  guessed Pollack) that's true — Pollack is absent. But in `verify-authed-reveal` (authed,
  guessed Saithe) the split reads "**Saithe · you · 100%**" — the guess **is** included
  and labelled "you." So the behaviour is **inconsistent between guest and authed
  reveals**, not uniformly "excluded." **Fix:** reword T-09 to "the user's guess is shown
  on the authed reveal but missing on the guest reveal (inconsistent), and at n≤2 the
  percentage bars are meaningless." The fix (always include + honest low-n framing) is
  right; the observation is imprecise and would mislead whoever implements it.

### UNFLAGGED BRAND VIOLATION — em dash in a *protected* screen

- The "keep/protect" hero, `feed-05`, contains **"Save my finds — sign up free"** with a
  literal em dash, and the same copy appears in the reveal nudge. `CLAUDE.md` is
  **zero-tolerance** on em/en dashes. The review flags em dashes only in onboarding copy
  (T-27, A-03) and missed this one on the very screen it tells everyone to protect.
  Several other on-screen strings ("Close · +1" uses a middot, fine) should be swept.
  **Action: add an em-dash sweep of all on-screen copy to Wave 0** (it's a global brand
  invariant, not just an onboarding nit), and call out `feed-05` specifically so the
  "protect" instruction doesn't preserve the violation.

### MIS-PRIORITISATION — a couple of P-levels look off

- **T-21 (bbox dots over metadata text) is rated P1 but behaves like a P0 on the
  shareable surface.** My spot-check of `snippet-02-reveal-correct` shows the "PEBL
  OBSERVATION DETAILS" block is **genuinely garbled** — site/depth/deployment are
  overprinted by teal blobs and unreadable. The doc itself calls `/feed/[id]` "the entry
  point most likely to be a new visitor's first impression." A broken, garbled-text first
  impression on the *shareable* page is funnel-breaking by the review's own P0 bar.
  **Recommend P1→P0 (or at least "do in Wave 0 regardless of severity label"** — it
  already is in Wave 0, so the practical risk is low; the label is just inconsistent with
  the bar).
- **T-04 (browse thumbnails "blank panels … looks broken") may be over-severe on
  desktop.** As noted in (b)(6), `d-browse` is mostly murky-green frames + one clear blue
  tile, not a wall of empty teal panels. The "looks broken / removes the reason to click"
  judgement is fair for the *murk* but the specific "flat light-teal panels with no image
  at all … roughly half" is not what I see at desktop. Keep P0 for the *combined* T-03+T-04
  "unscannable wall" effect, but **soften the T-04 wording** so the poster pipeline isn't
  chased for a 50%-missing-poster bug that may not exist.
- **T-14 (no OAuth/magic-link) at P1 is defensible but the leverage ranking (Top-10 #9)
  may be too high for the effort.** It's marked **L** and depends on either Vercel OAuth
  secrets (ops, out of the codebase) or building a magic-link flow. For a *play-before-
  signup* app where the soft ask comes **after** the reward, auth friction bites a smaller
  slice than the empty-first-run wall. Fine to keep P1; just flag that its ROI is lower
  than its neighbours and it's the most likely wave to slip.

### REGRESSION-RISK — fixes that could damage a "keep" strength or break an invariant

- **T-02 "collapse the locked wall behind a Show-all expander."** The pokédex *silhouette
  grid* is doing quiet teaching work — my spot-check shows recognisable per-species
  silhouettes under each "Locked," which is *more* informative than the doc's "grey wall"
  framing implies. Hiding all 57 behind an expander risks **removing the "here's the
  scope of what's out there" teaching** that the review elsewhere praises (the shape-gate
  count badges do the same job and are on the keep-list). **Mitigation: keep a visible,
  silhouette-rich teaser of the full set; reframe and reorder, don't bury.**
- **T-08 "redirect deep-links into the feed experience"** (offered as an alternative).
  Deep-linking to a *specific* clip is a sharing/SEO asset (`/feed/[id]` has its own OG
  image, sitemap entry, metadata HUD — all on the keep-list). Redirecting a shared clip
  link into the generic feed would **break the share loop**. **Mitigation: prefer the
  "bring to parity" path; treat "redirect" as a last resort and flag the SEO/share cost.**
- **T-13 / T-34 "one primary button everywhere; bridge the two worlds."** Heavy global
  className churn across landing/auth/reveal/404/account is exactly the kind of sweep the
  `CLAUDE.md` "deferred consolidations" section warns carries visual-regression risk that
  outranged the value. **Mitigation: do it behind the `ui-review` baseline diff the plan
  already mandates, surface-by-surface, not in one big find-replace.** (The plan implies
  this; make it explicit for T-34.)
- **Animation invariants on every motion add (T-06, T-07, T-25 glyph swaps).** Correctly
  routed through the skill; just ensure the **reduced-motion + off-screen-pause** path is
  in the acceptance criteria for each, not only the "happy" animation.

### LIKELY-ARTIFACT (not a product issue) — verify before building

- **"Faux species-pick overlay is only intermittent" (T-05).** Could be a capture-timing
  artifact (Playwright grabbed a frame mid-cycle) rather than a real intermittency. Verify
  against the live `HeroPreview` loop before "fixing" a non-bug.
- **The verify-email banner appearing in nearly every authed shot (T-26)** is real, but
  its *stacking on the menu* (A-04 variant) was inferred, not cleanly captured. Confirm
  the overlap actually occludes the menu's Account/Sign-out before scoping that part.

---

## (e) Plan soundness notes

**Sequencing is mostly right.** Tokens-first (Wave 0) correctly precedes the reward and
a11y waves that consume them; reward+meaning (Wave 1) and first-run (Wave 2) are
correctly the high-leverage centre; browse/auth/system/a11y trail sensibly. Specific
issues:

1. **Wave 0 Step 1 is partly redundant (see the token error).** Re-scope it to "add
   `notice` + `muted` + `muted-strong`; the verdict trio already exists — only revisit
   the `pending` *value*." Otherwise a developer wastes time re-adding existing tokens or,
   worse, *redefines* them and forks the colour.

2. **Missing dependency: T-07 depends on API payload shape that the plan assumes.** Wave 1
   Step 3 says "the `/api/answers` response already returns the streak diff." That is an
   **unverified assumption** stated as fact. If it doesn't return running-points / new-
   unlock / collection-count, Wave 1 has a hidden API task. **Add a pre-step: confirm the
   answers + stats payloads carry points-total, streak, isNewUnlock, collectionCount; if
   not, that's part of the wave.** Same caution for T-09's "always include the user's
   guess" — needs the stats payload to return it.

3. **Missing dependency: T-02 / T-29 "likely at your site" + "spot this in the feed"
   both depend on the `SpeciesProbability` OBIS cache being populated for the relevant
   sites.** `CLAUDE.md` notes the cache exists but is bucketed; if a given snippet's
   site/depth bucket is empty, these features render nothing. **Add: verify cache
   coverage for the live snippet sites before promising a probability-driven preview.**

4. **Browse poster fix (Wave 3) names the wrong-ish root cause.** It points at
   `scripts/seed.ts` / `reupload-snippets-hq.ts` / `thumbnailUrl`. But `CLAUDE.md`'s
   storage section says clips were just re-cut and storage is **split (30 on Supabase,
   Vercel still on R2)** with **orphaned R2 objects** — a thumbnail that 404s because the
   DB points at one provider and the object lives on the other is a *plausible* cause the
   plan doesn't mention. **Add storage-provider mismatch to the poster investigation
   hypotheses.**

5. **A finding that's scheduled but vaguely: T-19's "reuse the Gemini image-quality gate
   to reject dark tiles."** `CLAUDE.md` says the Gemini key is **free-tier ~20 req/day**
   and a full sweep 429s. Gating the *live candidate pool* at request time on a 20/day
   quota is not viable; this must be a **build-time pre-vet** that writes a curated flag,
   not a runtime call. The plan should say which, or it's unactionable as written.

6. **Findings scheduled into a wave — coverage check.** I traced every T-id (T-01…T-38)
   to a wave. **All 38 are scheduled** (Wave 0: 11,22,34½,12,20,23,25,21,05,26,36½,38-parts;
   Wave 1: 01,06,07,09,10,27,32; Wave 2: 02,28,30,29; Wave 3: 03,04; Wave 4: 14,15,37,16;
   Wave 5: 13,34,35,08,19,24; Wave 6: 11,17,18,33,31,36,38-rest). **No orphaned findings.**
   Good. The one bookkeeping nit: **T-38 is split across Wave 0 and Wave 6 without a clear
   line on which sub-nit goes where** beyond "cheap ones in 0" — fine, but list the exact
   sub-items in each so nothing falls between the two.

7. **Unactionably vague spots:** (a) Wave 5 Step 1 "carry one bridging treatment across
   surfaces" — name the *specific* element (e.g. "the eyebrow+heading block and the primary
   button") or it won't get done; (b) Wave 1 Step 6 "target the actual confusion
   (user-guess vs top-community look-alike)" assumes a data join that may not exist —
   confirm the reveal has both the user's guess and the community top-2 in scope to build
   the targeted teaching link.

8. **No rollback / feature-flag note.** Waves 1-2 change the emotional core (reward) and
   the first thing every user sees (pokédex). Given the colour-blind-owner sign-off gate
   already in the plan, add: **ship the reward/verdict change behind a quick on-device +
   owner screenshot check before merge** (the plan says this for colour; extend it to the
   reward beat generally).

---

## (f) Is this review good enough to act on? + Top 3 to add before "done"

**Yes — it is good enough to start Wave 0 today**, with the caveat that one Top-10 fix
(T-06) is described with a wrong cause and must be corrected first so the developer
doesn't re-create existing tokens or "fix" a non-existent stray-amber utility. The
synthesis, severity discipline, keep-list, and wave order are sound and evidence-backed;
my spot-checks confirmed the major findings. It needs a short errata + two named-blind-
spot additions, not a rework.

**Top 3 things to add before calling it done:**

1. **Correct the verdict-token error (T-06 / T-11 / Top-10 #7 / Wave 0 Step 1).** State
   that `correct`/`incorrect`/`pending` **already exist** in `tailwind.config.ts` and the
   pill **already uses `bg-pending`; only `notice` + `muted` + `muted-strong` are new. Re-
   scope T-06 to "revisit the `pending` token *value* (amber, vs a colour-blind owner) +
   add a redundant non-colour cue + promote focal weight + reword `≈`," i.e. a call-site +
   one-token-value change. This is the highest-impact correction.

2. **Add a "What a vision review could not see" section + an em-dash sweep.** Name the
   five unreviewed lenses that affect engagement — **first-paint/perf (the all-videos-
   mounted risk), motion quality, real-copy-at-length overflow, on-device tap accuracy,
   and non-visual (screen-reader/keyboard) a11y** — and scope Wave 6 explicitly as
   *visual* a11y with non-visual a11y as a named follow-up. Add a global on-screen em-dash
   sweep to Wave 0 and fix the one **on the protected `feed-05` "Save my finds — sign up
   free"** so "protect this screen" doesn't lock in a brand violation.

3. **Capture the three missing reward states + verify the payloads before Wave 1.** Get a
   guest **flat-wrong** feed reveal, a **species-correct +2** feed reveal, and a
   **zero-community / "be the first"** reveal, and confirm `/api/answers` +
   `/api/snippets/[id]/stats` actually return running points / streak / new-unlock /
   collection-count / the user's own guess. Wave 1's whole reward redesign is currently
   tuned against a single "Close +1" frame and an *assumed* API shape; both should be real
   before building.
