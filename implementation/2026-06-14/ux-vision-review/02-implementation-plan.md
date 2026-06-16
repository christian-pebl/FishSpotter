# FishSpotter UX — Implementation Plan

**Companion to** `01-consolidated-findings.md` (38 findings, 6 themes) and the
40-screenshot evidence set in `shots/`. This plan turns the findings into a
sequenced, file-level build plan a developer (or Claude) can execute.

## How to read this

- Work is grouped into **7 waves**, ordered by *leverage ÷ effort* and by
  *dependency* (shared tokens first, surface reworks before the narrative that
  threads through them, etc.). Each wave is a coherent, shippable PR.
- Every wave lists: **Goal**, the **findings (T-xx) it closes**, **concrete
  steps** (named file + change), **acceptance criteria**, **effort**, and **how
  to verify**.
- File paths are best-known from the codebase as of 14 Jun 2026; confirm before
  editing (a couple of components are inferred from behaviour and noted as such).
- **Invariants to respect on every change** (from `CLAUDE.md`): no emoji as UI
  icons; H.264-only video; named design tokens (run `npm run lint:tokens`);
  44px touch targets on mobile; reduced-motion-safe + off-screen-paused motion;
  the author is **colour-blind** (never encode meaning in colour alone); strip
  every em/en dash from copy; before pushing run
  `npx tsc --noEmit && npm test && npm run lint && npm run lint:tokens`.
- **Protect the "keep" list** in `01-consolidated-findings.md` §4 — especially
  the guest reveal sequence, the species pages, the shape-gate model, and the
  flash-card. These are the strong parts; do not regress them.

## Errata & scope limits (post-critique corrections)

A completeness-critic pass (`03-completeness-critique.md`) verified the findings
against the live app and the code. Apply these corrections when executing — they
override the findings/Top-10 where they conflict:

1. **The verdict tokens already exist (corrects T-06, T-11, Wave-0 step 1).**
   Verified in code: `correct` / `incorrect` / `pending` are named tokens in
   `tailwind.config.ts:58-69`, and `RevealResult.tsx:110-145` already renders the
   verdict pill with `bg-pending` + per-state `aria-label`s. The "off-palette
   amber" claim is **false** — the amber IS the named `pending` token (a
   deliberate Q4-D2 choice). So Wave 0 does NOT create the verdict tokens; it adds
   only the genuinely-new `notice` + two muted *text* tokens. The real T-06/T-11
   work is a **call-site + token-value** change: (a) revisit the `pending` value
   (amber is the hard case for the colour-blind owner) OR rely on a redundant
   **visible** non-colour cue (a per-state icon/shape + the plain word — the
   `aria-label` helps screen readers but is not visible), and (b) promote the
   pill's focal weight + count-up. Not token creation.
2. **`/api/answers` must be extended for the reward-progress beat (T-07).**
   Verified: the response returns `{ answer, isCorrect, points, streak }` but **no
   unlock signal**. To show "Added to your collection — N of 57" at the reward
   moment, the route (which already does the `UnlockedSpecies` upsert) must also
   RETURN whether a *new* species was unlocked + the new collection count. The
   read-only guest `/api/answers/preview` needs the equivalent (compute-only).
3. **Em-dash sweep (brand zero-tolerance rule) — add to Wave 0.** Several copy
   strings use em/en dashes, including the **protected hero screen `feed-05`**:
   "Save my finds — sign up free" (in `FeedCard.tsx`, shipped to prod). Sweep all
   user-facing copy (onboarding, reveal, nudges, this very plan's suggested copy)
   and replace em/en dashes with commas/colons/separate sentences. Fix the live
   `feed-05` string promptly — it is in production.
4. **Wording corrections.** T-09: the *guest* reveal omits the user's own guess;
   the *authed* reveal DOES include it ("Saithe · you 100%") — the fix is to make
   both inclusive AND handle low-n honestly. T-04: "blank teal panels" is
   overstated on desktop (mostly murky-green subjectless frames); the fix (real
   posters + branded fallback) is unchanged.
5. **Before starting Wave 1, capture the two missing reward states** the redesign
   is otherwise untuned for: a **guest flat-wrong** reveal and a **zero-community
   "be the first"** reveal (we already have Close+1, authed-Wrong, and a
   correct +2). Drive them with the existing capture scripts on a no-answer snippet.

**What this review could NOT see (a vision review's structural blind spots).**
This was a *visual* review of static screenshots; the following engagement-relevant
dimensions were out of its reach and must be assessed separately (none change the
plan's priorities, but Wave 6 is explicitly **visual** a11y only):
- **First-paint / performance** — notably the feed is known to mount all ~30
  `<video>` elements at once (flagged in the prior code review); judge real load +
  scroll jank on a mid-range phone and consider windowing.
- **Motion quality** — transitions/jank/reduced-motion behaviour (use
  `validate-animation`, not screenshots).
- **Real copy at length** — overflow/wrapping with long species names, long site
  names, long display names.
- **On-device tap accuracy** — the 44px findings are measured from pixels; confirm
  on a real touch device.
- **Non-visual accessibility** — screen-reader flow, keyboard navigation, focus
  order (distinct from the visual-contrast/colour findings here).
- **Data-at-scale** — every surface was seen near-empty (6 users, 0 unlocks); some
  findings (leaderboard, community split, pokédex) will read differently at scale.

## Guiding strategy (why this order)

1. **Wave 0 lays foundations and ships the cheap, visible wins** — the semantic
   token set (which the verdict, colour-a11y and contrast work all depend on)
   plus a batch of S-effort copy/bug fixes that immediately lift first
   impression and the core loop.
2. **Waves 1-2 attack the two most-cited, highest-leverage themes** — make the
   reward land and accumulate, and turn the demotivating first-run states into
   momentum. This is where the public-engagement goal moves most.
3. **Wave 1 also threads the missing "real science" narrative** (the #1
   leverage gap) because it is mostly copy and it sets the frame that Waves 2-3
   reinforce.
4. **Waves 3-4 fix the two remaining P0 surfaces** (discovery/browse) and lower
   the conversion wall (auth).
5. **Waves 5-6 consolidate the design system, bring the secondary reveal to
   parity, and complete the accessibility sweep** — the "good → polished and
   trustworthy" gap.

A reasonable cadence: Wave 0 in ~1 day; Waves 1-2 are the core sprint (~1 week);
Waves 3-6 as follow-on. Nothing here is a rewrite — the bones are right.

---

## Wave 0 — Foundations + quick wins

**Goal:** stand up the token foundation everything else needs, and ship the
S-effort fixes that visibly lift first impression and the identify loop.
**Closes:** T-11 (scaffold), T-22, T-34 (landing CTA half), T-12, T-20, T-23,
T-25, T-21, T-05, T-26, T-36 (URL half), parts of T-38.

### Steps

1. **Semantic + muted token set** (foundation for Waves 1, 6) — `tailwind.config.ts`.
   Add named tokens, each with a `DEFAULT` background and an `ink` text shade,
   all verified ≥4.5:1: `correct`, `incorrect`, `pending` (replaces the
   off-palette amber, T-06), `notice` (the verify banner), plus text tokens
   `muted` (Dark Teal `#2B7A78` on white) and `muted-strong` (navy, for captions
   on pale-teal). Do NOT change call-sites yet beyond the ones in this wave;
   Waves 1/6 migrate the rest. Keep `lint:tokens` green.
2. **Landing stat swap + single CTA** (T-22, T-34 landing) —
   `src/components/landing/StatsBand.tsx` + `src/app/page.tsx`. Replace the
   `spotters` stat with a fast-growing positive metric ("IDs made" or "species
   spotted this week" or "footage from N UK sites" — pick one backed by a cheap
   server count). In `page.tsx`, make **"Start spotting"** the single dominant
   primary CTA and demote "Create your spotter profile" to a quiet text link.
3. **One first-action prompt** (T-12) — `src/components/FeedCard.tsx`. Remove the
   redundant floating "Tap the clip to identify" pill; keep one bottom CTA with
   one verb, e.g. **"Identify this species →"**, and a first-time-only subtitle
   that carries confidence + meaning ("No expertise needed — pick what looks
   closest. Every guess helps."). (Reuse the existing tap-hint localStorage gate.)
4. **Rung headers: sentence case, no truncation** (T-20, T-23) —
   `src/components/idflow/TileGate.tsx` (+ the gate components that pass the
   header). Shorten questions ("Which one?", "Body shape?"), move any verb
   instruction to a subline, set them sentence-case brand-bold (not uppercase
   tracked), and give the question its own full-width row so it can't collide
   with the back/minimise/close icons.
5. **Minimised resume control** (T-25) — `src/components/idflow/TileGate.tsx`
   (the dock bubble). Swap the magnifier glyph for a fish-tag/target icon, add a
   small "Resume" label or a one-time tooltip on first minimise, and keep it
   clear of the "USE ↑/↓" scroll hint (already moved to the corner; ensure no
   overlap).
6. **Clip the bbox overlay to the video** (T-21) — the single-snippet player
   (`src/components/SnippetPlayer.tsx`) + any shared bbox overlay. Add
   `overflow: hidden` to the player container so tracking dots can never paint
   onto the "PEBL OBSERVATION DETAILS" card. Verify specifically on `/feed/[id]`.
7. **Hero demo content** (T-05) — `src/components/landing/HeroPreview.tsx` (+ the
   clip it points at, chosen in `src/app/page.tsx`'s `featured` query). Point the
   demo at a hand-picked clip with a clearly visible subject in the first second,
   set a curated poster on a subject frame, and keep the faux species-pick
   overlay persistent over a visible creature (optionally a faint ring on it).
8. **Verify-email banner: slim + non-blocking** (T-26) — the banner component
   (search for "Check your inbox"/"Resend email"). Make it a dismissible slim bar
   in the `notice` token that never overlaps the reveal sheet or the open menu;
   suppress it while the full-screen menu is open; show it only after the
   onboarding tour and first reveal; soften copy ("Optional: verify to get the
   weekly digest").
9. **Legal URL fix** (T-36 half) — `src/data/legal/*.md`. Replace the
   `fish-spotter.vercel.app` reference in Terms with the canonical product domain
   (keep in sync across privacy/terms/accessibility).
10. **Cheap T-38 nits** — depth-chip download glyph → depth icon (FeedCard HUD);
    standardise the CC attribution string to "© {author} · {licence}" at one
    legible size.

**Acceptance:** landing leads with one CTA + a non-deflating third stat; the feed
idle shows exactly one prompt; rung questions are sentence-case and never
truncate at 390px; the snippet page has no dots over text; the hero demo shows a
visible creature; the verify banner never covers the reward or menu; no
`vercel.app` in legal copy; `lint:tokens` green.
**Effort:** S overall (1 day). **Verify:** re-run the Playwright capture script on
landing + feed + snippet at 390px and eyeball; `npm run lint:tokens`.

---

## Wave 1 — Make it mean something, and make the win land

**Goal:** thread the real-science purpose through the journey and turn the reveal
into a focal, accumulating reward. The two highest-leverage themes.
**Closes:** T-01, T-06, T-07, T-09, T-10, T-27, plus T-32 (teaching link).

### Steps

1. **Contribution narrative beats** (T-01) — copy-led, four touch-points:
   - `src/app/page.tsx` sub-hero line: "Every ID helps PEBL monitor what's living
     on real UK reefs."
   - `src/components/idflow/RevealResult.tsx`: a one-line micro-beat after a
     correct/close ID using the snippet site already in props — "Your ID was added
     to the {site} record."
   - profile (`src/app/u/[id]/page.tsx`): reframe stats around contribution ("12
     IDs added to the marine record · 3 sites helped").
   - leaderboard header (`src/app/leaderboard/page.tsx`): a collective aggregate
     ("The community has identified N species across M clips this month") — cheap
     `groupBy`/count queries.
   Copy only in this wave; a richer "impact view" is later/optional.
2. **Verdict gets focal weight + plain language + the `pending` token** (T-06) —
   `RevealResult.tsx`. Promote the verdict to the largest element on the card:
   bigger pill, `pending` token (not amber), plain label ("Close match" /
   "Partial — shape right" / "Correct!" / "Not this time"), points called out
   distinctly ("+1 pt"). Drop or word-pair the "≈" glyph. Add a reduced-motion-safe
   scale-in + points count-up using `src/lib/motion.ts` tokens and the
   `fishspotter-animations` skill (do NOT hand-roll; consult the skill, then
   `validate-animation`).
3. **Reward accumulates progress** (T-07) — `RevealResult.tsx` / `FeedCard.tsx` +
   the answers response. The `/api/answers` response already returns the streak
   diff; extend the reveal to show, on a correct/close ID: the running points
   total, the streak tick, and an **"Added to your collection — N of 57"** beat
   with a brief unlock animation for a *new* species (reuse the existing
   species-unlock animation pattern). For coarse-only credit show the partial
   ("shape unlocked — name it to add the species"). Apply to BOTH the feed reveal
   and the authed reveal (same component). This is the day-2 retention engine.
4. **Community split: honest + inclusive** (T-09) — `RevealResult.tsx` + the stats
   payload (`/api/snippets/[id]/stats` + `/api/answers/preview`). Always include
   the user's own guess in the list, highlighted ("Pollack — you"). Below a small
   n threshold, hide the percentage bars and show an opportunity frame ("Only 2
   spotters so far — your ID helps build consensus"). When the top two are tied,
   add "Spotters disagree — these two look alike" to make it a teaching beat.
5. **Frame the coarse "PEBL ID" reference** (T-10) — `RevealResult.tsx`. When the
   reference is a coarse class (e.g. "Fish"), use an eyebrow like "Closest
   confirmed ID" + the class + a one-line subtext: "This clip isn't confirmed to
   species yet — your '{guess}' is logged and counts toward the community ID,"
   with a small "why?" affordance. Turn the anticlimax into the citizen-science
   invitation.
6. **Teaching link prominence + targeting** (T-32) — `RevealResult.tsx` /
   `IdGuideTrigger`. After a near-miss, raise "How to spot…" to teal text with
   separation from "Where is this?", and target the actual confusion
   (user-guess vs top-community look-alike) rather than the generic class.
7. **Onboarding teaches meaning** (T-27) — `src/components/onboarding/OnboardingTour.tsx`.
   Cut each step to one heading + one plain sentence, add a small per-step visual
   (species-pick tile / "you vs community" bar / streak graphic), add one purpose
   beat ("Your IDs help PEBL track what lives on UK reefs"), defer OBIS/scoring
   nuance to the in-product reveal, and **strip every em dash** (brand rule).

**Acceptance:** the reveal's verdict is the clear focal point in the `pending`
token with plain copy and a count-up; a correct/close ID visibly adds points +
streak + collection progress on both guest and authed reveals; the community
shows the user's guess and never a meaningless 100%/50% at n≤2; the coarse
reference reads as an invitation not a let-down; a purpose line appears in
landing, reveal, profile, leaderboard and onboarding; onboarding is one
sentence/step with a visual and zero em dashes.
**Effort:** M (the wave's centre of gravity). **Verify:** drive the guest + authed
reveal via the Playwright capture, screenshot, run `validate-animation` on the
verdict/unlock motion; confirm copy with a Gemini `ui-review` pass on the reveal.

---

## Wave 2 — Fix the first-run retention states

**Goal:** stop greeting every newcomer with their own failure; make progress and
community legible from answer #1. The most-cited theme.
**Closes:** T-02, T-28, T-30, T-29.

### Steps

1. **Profile / pokédex: deficit → momentum** (T-02) — `src/app/u/[id]/page.tsx`
   (+ its collection components).
   - Suppress accuracy until ≥5 scored answers (show "—"); never render "0%".
   - Reframe the collection header: "1 species discovered · 56 to find" with a
     filling progress bar; render unlocked species first/large.
   - Collapse the ~57-tile locked wall into a small "likely at your sites"
     preview (from the `SpeciesProbability` OBIS cache) behind a "Show all 57"
     expander; give the next-achievable tile an "Up next" teal-outline; replace
     57 "Locked" word-labels with a single lock glyph.
   - Purpose-built empty states (collection / leaderboard slot / recent-IDs) each
     with one clear next action ("Identify a clip →").
2. **Leaderboard: inclusive + collective** (T-28) — `src/app/leaderboard/page.tsx`
   (+ `/api/leaderboard`). Always show a **"You"** row with a progress chip
   ("3 / 10 answers to join"); lead with the collective banner from T-01 and keep
   the ranked table below; add a "recent finds / newest spotters" strip; relabel
   the species-frequency list "Community trends".
3. **Pokédex group chips** (T-30) — collection component. Use the friendly
   shape-gate names, gloss "Gastropod" → "Sea snails", make each chip a filter
   that scrolls the grid to that group, show a tiny per-group progress bar.
4. **Species page → back into the loop** (T-29) — `src/app/species/[slug]/page.tsx`.
   Add a footer CTA band: primary "Spot this in the feed" (deep-link/filter to
   clips where the species is plausible per `SpeciesProbability`) + a
   collection-status line ("Locked — name it in a clip to unlock" / "✓ In your
   collection").

**Acceptance:** a 1-answer user sees momentum framing (no 0%, no grey wall as the
first thing), a "You · 3/10" leaderboard row, tappable group filters, and a way
from any species page back into playing/collecting.
**Effort:** M. **Verify:** re-capture `/u/[id]` and `/leaderboard` for the test
account; confirm the locked wall is collapsed and accuracy shows "—".

---

## Wave 3 — Make discovery worth exploring (browse P0s)

**Goal:** turn the archive from a dead database dump into a library worth
clicking. **Closes:** T-03, T-04.

### Steps

1. **Investigate + fix poster frames** (T-04) — the seed/transcode/poster
   pipeline (`scripts/seed.ts`, `scripts/reupload-snippets-hq.ts`, the
   `thumbnailUrl` source) and the browse card. Find why ~half the tiles render as
   blank panels (missing/broken `thumbnailUrl`); ensure every clip has a poster.
   Pick the poster at peak bbox activity from `Snippet.bboxJson` so a subject is
   visible. Fallback to a branded placeholder (silhouette + "clip"), never a bare
   panel.
2. **Per-card identity + status + filters** (T-03) — `src/app/feed/browse/page.tsx`
   (+ card component). Lead each card with the species/reference ID if known (or
   "Unidentified — be the first" if not); demote location/date to secondary; add a
   status chip (Identified / Needs ID / You got this). Add discovery filters that
   matter (by species, "needs an ID", by site). Gloss or replace the unglossed
   "ALGAPELAGO" eyebrow; warm the intro copy.

**Acceptance:** every browse tile shows a real subject poster (or branded
fallback) and a distinguishing title + status; filters let a user find "clips that
need an ID" or a species; no two cards look identical.
**Effort:** M (+ investigation for posters). **Verify:** re-capture `/feed/browse`
mobile + desktop; confirm no blank tiles and per-card identity.

---

## Wave 4 — Lower the conversion wall (auth)

**Goal:** remove the password wall and the blank canvas at the soft ask.
**Closes:** T-14, T-15, T-37, T-16.

### Steps

1. **One-tap / passwordless** (T-14) — `src/lib/auth.ts` + `src/app/auth/signin/page.tsx`.
   The Google/Apple provider buttons were already added to the sign-in page (they
   render when env vars are set); **set `GOOGLE_CLIENT_ID`/`SECRET` in Vercel** so
   "Continue with Google" actually appears, above the email form with an "or"
   divider, on both sign-in and sign-up. If OAuth must wait, add a passwordless
   magic-link primary path (the email infra already exists for verification/reset)
   and demote password to a "use a password instead" disclosure.
2. **Fill the blank auth canvas** (T-15) — `src/app/auth/layout.tsx` +
   signin/forgot pages. Reuse the landing's `HeroPreview` / `StatsBand` /
   `SpeciesMarquee`: desktop two-column (form one side, looping snippet + live
   stats the other); mobile a compact still/silhouette/stat strip; forgot-password
   at minimum a reassuring still + line. (The auth layout already drops the card to
   80% over the marine pattern — extend it to actually fill the viewport.)
3. **Trim sign-up** (T-37) — `src/app/auth/signin/page.tsx` + `src/lib/auth.ts`.
   Reduce the visible first step to email + password + age + terms; **defer
   display name** (auto-assign the existing "Spotter-xxxx" fallback, editable later
   on `/account`); make the heading honest ("Create your account"); de-duplicate
   the 8-char hint and remove it from the sign-in (non-signup) view.
4. **Menu IA: Account + Sign out; demote video sliders** (T-16) — `src/components/Header.tsx`
   (the slide-in menu). Make the display-name row a tappable account entry (name +
   email + chevron → `/account`); add explicit "Account & settings" and "Sign out"
   items in the top nav group; move the per-clip LIVE VIDEO playback sliders out of
   the global menu into an in-player controls sheet.

**Acceptance:** sign-in/sign-up offer a one-tap or magic-link path above the email
form; auth pages fill the viewport with editorial content (no bare card on empty
teal); sign-up asks 4 visible fields, not 5, with an honest heading; the menu has
a findable Account and Sign out and no longer leads with video sliders.
**Effort:** L (OAuth/magic-link) + M (canvas/menu). **Verify:** re-capture the auth
pages mobile + desktop; confirm one-tap path + filled canvas; manual sign-out test.

---

## Wave 5 — One coherent system + the secondary reveal

**Goal:** make the dark feed and light pages read as one app, and bring the
shareable `/feed/[id]` page up to the feed's standard.
**Closes:** T-13, T-34 (full), T-35, T-08, T-19, T-24.

### Steps

1. **Bridge the two worlds** (T-13) — `tailwind.config.ts` + touched components.
   Document dark + light as one system: shared `rounded-card`/`rounded-modal`
   scale, shared shadow tokens, shared control shapes, one verdict-colour set that
   works on both backgrounds (the Wave-0 tokens), and map the feed modal headings
   onto the named type tokens (`h2`/`h3`) instead of ad-hoc small labels. Carry one
   bridging treatment (eyebrow + heading, primary-button shape) across surfaces.
2. **One primary / one secondary button** (T-34 full) — define the two as
   component classes (bright-teal `#3AAFA9` fill + navy text primary; outlined-teal
   secondary) and apply uniformly across landing, auth, reveal, 404, account,
   flash-card (demote the heavy "‹ BACK" to a ghost chevron). Add a "Your result"
   eyebrow to the reveal sheet.
3. **Standardise header chrome** (T-35) — `src/components/Header.tsx`. Persistent
   full-colour wordmark; one left-affordance rule (menu on top-level surfaces, one
   consistently-worded back-link — e.g. always "Back to feed" — on detail pages);
   real desktop nav/CTA instead of hamburger-only; label or remove the orphan
   "SHOW ON SCREEN" feed control.
4. **Single-snippet reveal parity** (T-08) — `src/components/SnippetPlayer.tsx`.
   Bring `/feed/[id]` to parity: reuse the shared reveal component (`RevealResult`)
   and the guided rung flow as the primary identify path (keep type-in as an
   advanced escape hatch), apply the dark chromeless video + HUD treatment, unify
   labels ("PEBL ID", "Community"). If it must stay leaner, at minimum port the
   verdict pill, points, teaching link and sign-up nudge. Consider redirecting
   deep-links into the feed experience.
5. **Candidate-tile consistency** (T-19) — `src/components/idflow/CandidateGate.tsx`.
   Guarantee every tile has an always-rendered label band (solid scrim + name) and
   a vetted photo; reuse the Gemini image-quality gate (`gemini-vision`) to reject
   dark/low-contrast/unlabelled images from the candidate pool, falling back to a
   silhouette + name rather than a dark cell.
6. **Escape-hatch labels** (T-24) — the gate components. Rename "Skip to guess" →
   "Just pick the species", reserve "Skip" for skipping the clip, make "Not sure"
   read as "help me narrow / step back", use the same two verbs across rungs, and
   surface the "It's just a Fish — lock in 1 pt" partial-credit action at Rung 2 as
   well as Rung 3.

**Acceptance:** moving feed → leaderboard → species → account no longer feels like
theme switches; one primary button style app-wide; `/feed/[id]` uses the same
reveal + guided ID as the feed; every candidate tile has a readable label + vetted
photo; escape-hatch verbs are consistent and intent-clear.
**Effort:** L (snippet parity) + M (system). **Verify:** re-capture the cross-section
(feed, leaderboard, species, account, snippet) and a Gemini `ui-review` consistency
pass.

---

## Wave 6 — Accessibility & trust sweep

**Goal:** complete the colour-independence + contrast + touch-target work and the
remaining trust/polish items. **Closes:** T-11 (complete), T-17, T-18, T-33,
T-31, T-36 (ToC half), T-38 remainder.

### Steps

1. **Colour-independence everywhere** (T-11 complete) — apply the Wave-0 tokens +
   a redundant non-colour cue to every semantic state: verdict already has a
   per-state word/icon (Wave 1); leaderboard mini-bars either strengthen to brand
   teal or drop in favour of the text rank (`/leaderboard`); the species OBIS map
   (`/species/[slug]`) gets value labels or a coarse texture and a lightest step
   distinguishable from the card. Target: no information conveyed by colour alone
   (WCAG 1.4.1), which the app's own Accessibility Statement pledges.
2. **Contrast sweep** (T-17) — replace ad-hoc `text-*-400/500` greys on light
   surfaces with the Wave-0 `muted` / `muted-strong` tokens; lift dark-menu
   inactive labels to ≥4.5:1. Audit footer/credits/legal/captions/eyebrows at
   their real sizes.
3. **Touch-target sweep** (T-18) — enforce a 44px min hit area on the species
   photo strip + its "i" dot, leaderboard rows, browse pagination, and the account
   display-name Save (give Save a solid primary fill at full opacity when dirty,
   ≥44px, a "Saved" tick, + save-on-blur fallback). Re-check at 390px.
4. **Map modal polish** (T-33) — don't truncate the site/deployment name; replace
   raw coordinates with human context ("North Devon, ~20m depth"); add a scale
   indicator and an onward action ("More clips from Bideford Bay").
5. **Post-reveal action clarity** (T-31) — if re-scoring isn't allowed, relabel
   "Edit answer" → "Change my guess (won't rescore)" or remove it post-reveal; make
   "Next →" the unambiguous primary; demote/relocate "Archive".
6. **Legal navigation** (T-36 remainder) — add a short sticky/inline table of
   contents + "back to top" to the long privacy/terms pages; standardise the
   support-contact treatment across the three legal pages.
7. **T-38 remainder** — squid/eel silhouette legibility; label minimise vs close +
   confirm a destructive mid-funnel close; named "destructive" token + confirm step
   for account deletion; standardise required-field marking; confirm forgot-password
   success state; balance the recent-ID red ✗ with points + an explicit "you
   guessed X · answer Y"; mobile catalogue browse-through link + an in-water Sprat
   photo.

**Acceptance:** an automated contrast + colour-independence pass on the key screens
finds no colour-only meaning and no sub-AA secondary text; all audited targets are
≥44px; the map, post-reveal actions, and legal nav are clarified.
**Effort:** M. **Verify:** axe pass (the `ui-shot` axe integration), a colour-blind
simulation review of the verdict/leaderboard/OBIS map, and a 390px touch-target
check.

---

## Cross-cutting: verification & QA approach

- **Visual loop (built this project):** `scripts/ui-review.ts` (Playwright +
  Gemini critique, mobile + desktop, axe) and the ad-hoc capture scripts in
  `implementation/2026-06-14/ux-vision-review/` are the regression harness — after
  each wave, re-capture the touched surfaces and diff against the `shots/` baseline.
- **Animation:** anything in Waves 1/5 that moves must go through the
  `fishspotter-animations` skill (authoring) and `validate-animation` (QA) — never
  hand-rolled.
- **Per-PR gate:** `npx tsc --noEmit && npm test && npm run lint && npm run
  lint:tokens`, plus a Playwright re-capture of the changed surfaces.
- **The colour-blind owner is the ultimate verdict-colour reviewer** — ship the
  verdict/leaderboard/OBIS changes behind a quick screenshot check with him.

## Effort summary & suggested sequencing

| Wave | Theme | Effort | Leverage |
|---|---|---|---|
| 0 Foundations + quick wins | tokens, copy, bugs | S (~1 day) | High (cheap, visible) |
| 1 Reward + meaning | reward moment + narrative (Themes 1,3,5) | M | **Highest** |
| 2 First-run states | empty-state retention (Theme 2) | M | **Highest** |
| 3 Browse | discovery P0s (Theme 2,4) | M | High |
| 4 Auth | conversion wall (Theme 6) | L+M | High |
| 5 System + secondary reveal | consistency (Theme 4) | L+M | Medium |
| 6 A11y + trust sweep | colour/contrast/targets (Theme 5,6) | M | Medium (compliance + trust) |

**Recommended:** ship Wave 0 immediately (1 day), then run Waves 1+2 as the core
engagement sprint (they close the two most-cited themes and most of the Top 10),
then Waves 3-6 as capacity allows. Waves 1-2 alone would materially change whether
a member of the public has fun, feels progress, and comes back.

## Appendix: finding → primary file map

- Landing: `src/app/page.tsx`, `src/components/landing/{StatsBand,HeroPreview,StepCards,SpeciesMarquee}.tsx` — T-05, T-22, T-34, T-01, T-38.
- Feed loop: `src/components/FeedCard.tsx`, `src/components/idflow/{TileGate,ShapeGate,BodyShapeGate,CandidateGate}.tsx` — T-12, T-20, T-23, T-24, T-25, T-19.
- Reveal: `src/components/idflow/RevealResult.tsx`, `IdGuideTrigger`, `/api/answers`, `/api/snippets/[id]/stats`, `/api/answers/preview` — T-06, T-07, T-09, T-10, T-31, T-32.
- Single-snippet: `src/components/SnippetPlayer.tsx`, `src/app/feed/[id]/page.tsx` — T-08, T-21.
- Profile/pokédex: `src/app/u/[id]/page.tsx` — T-02, T-30.
- Leaderboard: `src/app/leaderboard/page.tsx`, `/api/leaderboard` — T-28, T-11.
- Species: `src/app/species/[slug]/page.tsx` — T-29, T-11.
- Browse: `src/app/feed/browse/page.tsx`, poster pipeline (`scripts/seed.ts`, `reupload-snippets-hq.ts`, `bboxJson`) — T-03, T-04.
- Auth: `src/app/auth/signin/page.tsx`, `src/app/auth/layout.tsx`, `src/lib/auth.ts`, `src/app/auth/forgot/page.tsx` — T-14, T-15, T-37.
- Chrome: `src/components/Header.tsx` — T-16, T-35.
- Onboarding: `src/components/onboarding/OnboardingTour.tsx` — T-27.
- Tokens/system: `tailwind.config.ts` — T-11, T-13, T-17.
- Legal: `src/data/legal/*.md`, `src/app/{privacy,terms,accessibility}` — T-36.
- Verify banner: component rendering "Check your inbox" — T-26.
