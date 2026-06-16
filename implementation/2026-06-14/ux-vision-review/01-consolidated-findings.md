# FishSpotter Vision UX Review — Consolidated Findings

**Synthesis of a 7-agent visual UX review** (lenses A–G). 88 raw findings deduped
and recalibrated into 38 consolidated themes. Severity has been re-graded against
a disciplined P0 bar (a casual user is blocked, bounced, or the funnel breaks) and
against three orchestrator re-verifications of the live app (see "Severity
recalibration notes" below).

- **Reviewers:** A (first impression / acquisition), B (core identify loop),
  C (reveal / reward), D (auth / account), E (discovery / collection / community),
  F (cross-cutting design system + a11y), G (engagement / retention strategy).
- **Source counts (raw):** A 10, B 15, C 13, D 11, E 13, F 14, G 12 = 88.
- **Consolidated count:** 38 (4 P0, 15 P1, 15 P2, 4 P3).

> **Errata (see `03-completeness-critique.md` + the Errata section of
> `02-implementation-plan.md`):** the verdict colour tokens (`correct`/`incorrect`/
> `pending`) ALREADY exist in `tailwind.config.ts` and are used in `RevealResult.tsx`
> — the "off-palette amber" in **T-06/T-11** is actually the named `pending` token,
> so those fixes are call-site/token-value + a visible non-colour cue, not token
> creation. **T-07** needs `/api/answers` extended to return an unlock flag. A live
> em-dash exists on the protected `feed-05` ("Save my finds — sign up free") and
> must be fixed. Minor: **T-09** (guest reveal omits the user's guess; authed
> includes it), **T-04** ("blank panels" overstated on desktop).

---

## 1. Executive summary

FishSpotter is, at the component level, a **credible science product, not a
hackathon prototype** — and every reviewer said so independently. There is one
coherent brand language (navy/teal palette, uppercase tracked eyebrow + bold
heading, "pebl-surface" cards, the right-aligned PEBL wordmark), the legal and
accessibility pages are a genuine asset, the species education pages are
finished-grade, the shape-class-first identify gate is the correct mental model
for the public, and the **guest reveal sequence (play → score → community → soft
sign-up) is best-practice citizen-science activation that must be protected.** The
bones are right. The damage is concentrated in first-run states, the reward
moment's framing, and a missing reason-for-being.

Six cross-cutting themes emerged across multiple reviewers:

**Theme 1 — No "real science" contribution narrative (the missing reason-for-being).**
The single highest-leverage gap. Nowhere in the journey does the app tell a member
of the public that their ID helps monitor a real reef or feeds a real dataset. The
landing sells "spot the species", the reveal says "PEBL ID", the pokédex frames a
personal "collection", the leaderboard explains only points maths. A visitor
completes the whole loop believing they played fish-ID trivia. **Converged:** G
(G-01, the lead P0), reinforced by E (community framing) and D (the one place it is
done well — the sign-up card's "join the marine monitoring community" copy proves
the app *can* say it, it just doesn't say it anywhere it matters).

**Theme 2 — Demotivating empty / first-run states (the activation→retention leak).**
Every retention surface a newcomer first sees is empty by construction and frames
the product as something you have already lost at: the pokédex opens on "0 of 57"
above a ~57-tile grey "Locked" wall, the profile reads "SCORE 0 / ACCURACY 0% /
STREAK 1", and the leaderboard advertises a 10-ID gate with one real spotter on the
board and no progress-to-entry cue. Because zero unlocks exist in the database,
this all-locked state is what **every** current user sees — it is the de-facto
design, not an edge case. **Converged hard:** E (E-01, E-02, E-05, E-13), G (G-02,
G-09), F (F-12). The most-cited theme in the review.

**Theme 3 — The reward moment under-celebrates and never accumulates progress.**
The reveal is the dopamine engine and it is too quiet and disconnected. The verdict
is a small chip (an "≈ Close · +1" amber pill with an obscure maths glyph, no
focal hierarchy, no animation), the signed-in reveal surfaces only the verdict pill
and shows no points / streak / "added to your collection" at the moment of the win,
and the unlock-a-collectible mechanic fires silently in a screen the user has to go
and find. **Converged:** C (C-04), G (G-06, G-07), reinforced by the orchestrator's
verified note that the authed reveal shows no progress accumulation, and B (B-14, no
progress cue during the loop either).

**Theme 4 — Two visual "worlds" + a weaker, inconsistent secondary reveal.**
The app oscillates between near-black dark feed sheets and pale-teal light pages
with no shared bridge (radius, shadow, button, type, and verdict-colour language
all differ). The sharpest instance is the single-snippet detail page (`/feed/[id]`,
"Spotter Challenge"): a light card with raw native HTML5 video chrome, a harder
type-in identify path instead of the guided rungs, bbox tracking dots rendering
*over* the metadata text (a real visual bug), and a reward that omits the verdict
pill, points, teaching link and sign-up card the feed reveal has. **Converged:**
F (F-05, F-07, F-10), B (B-05, B-06), C (C-02, C-08).

**Theme 5 — Meaning carried by colour alone + an off-palette amber (acute, owner is colour-blind).**
The reward verdict, the leaderboard mini-bars, and the species OBIS heat-map all
lean on colour (sometimes plus a faint glyph) with no redundant text/shape cue, so
a red/green colour-blind user cannot reliably tell correct from close from wrong —
the whole reward signal. The "Close" verdict chip and the account verify banner are
rendered in an **amber/gold that is outside the documented PEBL palette and the
named verdict tokens** — the brief bans stock amber for semantic states, and the
product owner is colour-blind. **Converged:** F (F-01, F-02, F-14), C (C-04), with
the colour-only legibility also feeding F-03.

**Theme 6 — Auth friction + the blank-canvas problem.**
Every entry route is a password form: no one-tap OAuth, no passwordless magic link,
and sign-up is a five-field gate at the soft ask. Sign-in and forgot-password are
exactly the bare `max-w-md` card on empty teal the design rules forbid (two-thirds
of the desktop viewport is empty water), wasting prime motivation real estate. The
signed-in menu then has an IA hole: a wall of live-video playback sliders but no
visible Account / Settings / Sign out. **Converged:** D (D-01, D-02, D-03, D-08),
reinforced by F (F-03 low-contrast, F-05 two-worlds) and A (the landing's twin-CTA
and dead-space variants of the same blank-canvas instinct).

Two further systemic threads cut across the above and are worth naming even though
they fold into the themes: **low-contrast secondary text on every light page**
(captions, credits, legal/footer — F-03, D-06) and **sub-44px touch targets in the
dense list/strip surfaces** (species photo strip, leaderboard rows, browse
pagination — F-04, D-07).

**Net:** the funnel's mouth (landing) and its single best screen (guest reveal) are
healthy; the product leaks at activation→retention because the first surfaces a
newcomer explores are empty, the reward never visibly accumulates, and the entire
arc never tells them their effort feeds real science. Fixing first-run framing, the
reward's progress beat, and the contribution narrative — all largely copy and
state-logic, not rebuilds — is where the public-engagement goal moves most.

---

## 2. Severity recalibration notes (orchestrator caveats applied)

Three reviewer P0s were re-verified against the live app and overridden:

- **A-01 (hero demo "broken/empty"): P0 → P1.** The hero video loads and plays
  (readyState 4, not paused); it is NOT broken. The real problem is a *content*
  one: the demo clip frames show empty green water with no visible subject and the
  faux species-pick overlay is only intermittent, so a visitor sees "nothing to
  spot." Folded into **T-05**.
- **C-01 (correct reveal shows no verdict/points): P0 → P1, rescoped.** This is the
  SECONDARY single-snippet page (`/feed/[id]`), not the primary feed reveal. The
  primary feed reveal is good and shows the verdict prominently. Folded into the
  secondary-reveal parity theme **T-08**.
- **B-01 (two vague first-action prompts): P0 → P1.** A casual user is not blocked
  or bounced — there is a clear tappable affordance; the issue is redundant,
  reward-free, inconsistent wording. Real comprehension friction, but not a P0 by
  the disciplined bar. **T-12.**

Two distinct P1s were *added* from the orchestrator's verified re-capture of the
authed reveal: the reward moment shows no progress accumulation (**T-07**) and the
community split is thin/lonely, often n=1 (**T-09**).

The four retained P0s are the ones where the de-facto experience genuinely fails a
casual user at a critical moment: no reason-for-being (T-01), the all-failure
first-run retention wall (T-02), and the unscannable/placeholder browse grid that
makes the primary discovery surface a dead database dump (T-03, T-04).

---

## 3. Consolidated findings

Severity order: P0 → P1 → P2 → P3. Effort: S (hours) / M (a day or two) / L
(multi-day or cross-cutting).

### P0 — fix first (de-facto experience fails a casual user)

#### T-01 — No "real science" contribution narrative anywhere in the journey
- **Severity:** P0 · **Theme:** Reason-for-being (1)
- **Screens:** landing, feed idle, feed reveal, authed reveal, profile/pokédex, leaderboard
- **Merges:** G-01 (+ supporting framing in E-12, G-08, D's sign-up copy)
- **Observation:** Not one line tells the public their ID helps monitor a real reef
  or feeds a dataset. "Real underwater footage" reads as content provenance, not
  "your contribution matters"; "PEBL ID", "your collection", and the points-maths
  explainer all frame it as personal trivia.
- **Fix:** Thread a contribution beat through four points: landing sub-hero ("Every
  ID helps PEBL monitor what's living on real UK reefs"); reveal micro-line after a
  correct/close ID ("Your ID was added to the Bideford Bay record", using the
  snippet site already shown); profile contribution framing ("12 IDs added to the
  marine record", distinct sites helped); a community aggregate ("the community has
  identified N species across M clips this month") on the leaderboard header. Copy
  first; a real impact view is a later phase. **Effort: M**

#### T-02 — First-run retention surfaces greet the newcomer with their own failure
- **Severity:** P0 · **Theme:** Empty/first-run states (2)
- **Screens:** profile/pokédex (m+d), leaderboard (m+d)
- **Merges:** E-01, E-02, E-13, G-02, G-09, F-12
- **Observation:** The pokédex opens on "0 of 57" above a ~57-tile grey "Locked"
  wall (the mobile profile is ~3357px tall, mostly this grid); the profile reads
  "SCORE 0 / ACCURACY 0% / STREAK 1"; every shape group reads "0/N"; the collection
  copy leads with a caveat about what *won't* unlock. Because zero unlocks exist in
  the DB, this is what 100% of current users see. "0% accuracy" at n=1 is a blunt,
  arguably-wrong judgement on someone who has tried once.
- **Fix:** (1) Suppress accuracy until ≥5 scored answers (show "—"); never show 0%.
  (2) Reframe the collection header from deficit to momentum ("1 species discovered —
  56 to find") with a filling progress bar; show unlocked species first/large, not
  the locked wall. (3) Collapse the locked grid to a small "likely at your site"
  preview (from the OBIS probability cache) behind a "Show all 57" expander; give the
  next-achievable tile an "Up next" teal-outline treatment; replace 57 repeated
  "Locked" labels with a single lock glyph. (4) Demote the group-ID caveat to a
  tooltip and lead with the goal. (5) Purpose-built empty states with one clear next
  action on collection, leaderboard and recent-IDs. **Effort: M**

#### T-03 — Browse/archive grid is an unscannable wall of identical cards
- **Severity:** P0 · **Theme:** Two-worlds / discovery (4, 2)
- **Screens:** browse (m+d)
- **Merges:** E-03, E-12 (intro copy)
- **Observation:** Every card shows the identical eyebrow "ALGAPELAGO" and title
  "Bideford Bay, North Devon, UK"; only a small grey date differs. No species name,
  no ID status, no depth — nothing to tell 30 clips apart. Mobile is a single column
  ~16,500px tall. The primary discovery surface reads as a database dump, not a
  library worth exploring; the "ALGAPELAGO" internal codename is unglossed.
- **Fix:** Give each card identity — lead with the species/reference ID if known (or
  "Unidentified — be the first" if not), demote location/date to secondary, add a
  status chip (Identified / Needs ID / You got this). Add discovery filters that
  matter (by species, by "needs an ID", by site) instead of Site/Sort-only. Warm the
  intro copy and gloss or replace the "ALGAPELAGO" eyebrow. **Effort: M**

#### T-04 — Browse thumbnails are blank panels or subjectless murk (looks broken)
- **Severity:** P0 · **Theme:** Empty states / trust (2)
- **Screens:** browse (m+d)
- **Merges:** E-04, F-11
- **Observation:** Roughly half the grid tiles render as flat light-teal panels with
  no image at all; the rest are murky green frames with no discernible subject. The
  grid's visual content is either missing or unreadable, which reads "prototype" and
  removes the single biggest reason to click a tile.
- **Fix:** (1) Find why posters are missing (generation gap / broken URLs) and ensure
  every clip has a poster frame. (2) Pick the poster at peak bbox activity (from
  `bboxJson`) so the subject is visible. (3) Fallback to a branded placeholder
  (silhouette + "clip" label), never a bare panel. Pairs with T-03. **Effort: M**

### P1 — fix soon (significant friction or clear engagement/comprehension miss)

#### T-05 — Hero demo clip shows empty water with nothing to spot
- **Severity:** P1 (was A-01 P0; content, not a bug) · **Theme:** First impression (1)
- **Screens:** landing (m+d)
- **Merges:** A-01
- **Observation:** The hero demo video plays fine, but its clip frames show empty
  green murk with no visible fish and the faux species-pick overlay is only
  intermittent — so the one element doing the most persuasive work demonstrates
  "nothing to spot."
- **Fix:** Use a hand-picked demo clip with a clearly visible subject in the first
  second (or hold on a subject frame / set a curated poster), and keep the faux-pick
  overlay persistent over a visible creature. Optionally a faint ring on the subject
  so even a static frame reads "here's the thing you identify." **Effort: S**

#### T-06 — Reward verdict is too quiet; obscure "≈" glyph; off-palette amber
- **Severity:** P1 · **Theme:** Reward moment (3) + colour (5)
- **Screens:** feed reveal
- **Merges:** C-04, F-01 (verdict half), part of F-02
- **Observation:** The verdict is a small amber "≈ Close · +1" pill on the same line
  as "You said Pollack", no greater weight than surrounding text, no scale-in. The
  "≈" maths symbol won't read as "close" to non-experts, the "+1" is buried inside
  the pill, and the amber is outside the PEBL palette and the named verdict tokens.
- **Fix:** Promote the verdict to the focal element: larger pill in the named
  `pending` token, plain-language label ("Close match" / "Partial — shape right"),
  points called out distinctly ("+1 pt"). Drop or word-pair the "≈". Add a
  reduced-motion-safe scale-in + points count-up (motion tokens + the animation skill
  already exist). **Effort: M**

#### T-07 — Reward moment never accumulates progress (points/streak/collection)
- **Severity:** P1 (orchestrator-verified addition) · **Theme:** Reward moment (3)
- **Screens:** authed reveal, feed reveal
- **Merges:** G-06, G-07 (reward half), C-06 (signed-in reward state), B-14
- **Observation:** Verified: the signed-in reveal surfaces only the verdict pill and
  shows no points earned, no running score, no streak tick, and no "added to your
  collection" beat at the moment of the win. The pokédex fills silently in a screen
  the user must go and find; the unlock is never felt where it is earned. The authed
  reveal is thinner than the guest reveal — the converted user gets the poorer
  payoff.
- **Fix:** On a correct/close ID, surface a compact progress beat on both reveals: an
  "Added to your collection — N of 57" line (brief unlock animation for a *new*
  species), the streak tick, and the running points total. For coarse-only credit,
  show the partial ("shape unlocked — name it to add the species"). Reuse the
  `fishspotter-animations` species-unlock pattern. **Effort: M**

#### T-08 — Single-snippet `/feed/[id]` reveal is a weaker, inconsistent second reveal
- **Severity:** P1 (rescoped per caveat) · **Theme:** Two-worlds / secondary reveal (4)
- **Screens:** snippet challenge, snippet reveal-correct
- **Merges:** C-01 (rescoped), C-02, B-05, B-06
- **Observation:** The shareable single-snippet page — the entry point most likely to
  be a new visitor's first impression — is a materially weaker version of the reward:
  light card, raw native HTML5 video chrome ("0:00 / 0:09", browser controls), a
  harder free-text type-in identify path instead of the guided rungs, and a reveal
  that omits the verdict pill, points, teaching link and sign-up card the feed reveal
  has. Label wording also drifts ("Reference" vs "PEBL ID", "Community response" vs
  "COMMUNITY").
- **Fix:** Bring `/feed/[id]` to parity with the feed reveal (one reveal component,
  one label set), reuse the guided rung flow as the primary identify path (keep
  type-in only as an advanced escape hatch), and apply the dark chromeless video +
  HUD treatment. If the page must stay leaner, at minimum port the verdict pill,
  points and sign-up nudge. Alternatively, redirect deep-links into the feed
  experience. **Effort: L**

#### T-09 — Community split is thin/lonely and excludes the user's own guess
- **Severity:** P1 (orchestrator-verified) · **Theme:** Reward moment (3) / community
- **Screens:** feed reveal
- **Merges:** C-05
- **Observation:** "COMMUNITY · 2 SPOTTERS" shows Saithe 50% / Poor cod 50% — two
  equal bars on n=2, neither the user's guess (Pollack), which is nowhere on the
  board. Verified that the split is often n=1 (e.g. "Saithe · you 100%"). The
  social-proof feature reads as statistically meaningless and subtly isolating.
- **Fix:** (1) Always include the user's own guess, highlighted ("Pollack — you").
  (2) For low n, label honestly and frame as opportunity ("Only 2 spotters so far —
  your ID helps build consensus") instead of a hard percentage; hide the bar chart
  below a small threshold and show a "be the first to help ID this" state. (3) When
  the top two are tied/close, add "Spotters disagree on this one — these two look
  alike" to turn the split into a teaching beat. **Effort: M**

#### T-10 — "PEBL ID: Fish" headline reads as an anticlimax with no framing
- **Severity:** P1 · **Theme:** Reward moment (3) / comprehension
- **Screens:** feed reveal
- **Merges:** C-03
- **Observation:** After the verdict, the largest text is the coarse word "Fish"
  under a small "PEBL ID" eyebrow — to a user who guessed the specific "Pollack" this
  reads as a let-down or a bug ("I was more specific than the official answer?"),
  with nothing explaining that the clip is deliberately unresolved to species. The
  community then names two species, making "Fish" look like a placeholder.
- **Fix:** Frame the coarse reference positively, e.g. eyebrow "Closest confirmed ID"
  + "Fish" + a one-line subtext "This clip isn't confirmed to species yet — your
  'Pollack' guess is logged and counts toward the community ID", with a small "why?"
  affordance. Lean into the citizen-science invitation. **Effort: M**

#### T-11 — Meaning carried by colour alone elsewhere (a11y; owner is colour-blind)
- **Severity:** P1 · **Theme:** Colour (5) / accessibility
- **Screens:** feed reveal, leaderboard, species OBIS map
- **Merges:** F-02 (non-verdict parts), F-14 (semantic-token system)
- **Observation:** Beyond the verdict (T-06), the leaderboard "most-named species"
  rows encode ranking only in very low-contrast pale-teal mini-bars (the "n · %" is
  already in text), and the species OBIS occurrence map is a teal monochrome ramp
  with density carried by colour alone and no value/pattern labelling. Reliance on
  colour alone is a WCAG 1.4.1 failure and contradicts the app's own accessibility
  statement.
- **Fix:** Stand up the named `correct/incorrect/pending/notice` token set in
  `tailwind.config.ts` (each `DEFAULT` + `ink`) and give every semantic state a
  redundant non-colour cue: verdict gets a per-state shape/icon + word; leaderboard
  bars either strengthen to brand teal or drop in favour of the text; OBIS map gets
  value labels or a coarse texture and a lightest step distinguishable from the card.
  **Effort: M**

#### T-12 — First-action prompt is doubled, vague, and reward-free
- **Severity:** P1 (was B-01 P0) · **Theme:** Core loop comprehension (1)
- **Screens:** feed idle (m+d)
- **Merges:** B-01, G-12
- **Observation:** The idle feed presents the entry action twice, worded differently
  ("Tap the clip to identify" floating pill vs "Tap to name species" bottom bar),
  neither says what the user gets, and there's no one-line "what is this / why" — the
  user lands on murky green with two competing taps.
- **Fix:** One primary prompt, one verb everywhere ("Identify"). E.g. a single bottom
  CTA "Identify this species →" plus a first-time-only subtitle that carries both
  confidence and meaning: "No expertise needed — just pick what looks closest. Every
  guess helps." Drop the redundant pill. **Effort: S**

#### T-13 — Two visual worlds (dark feed vs light pages) with no shared bridge
- **Severity:** P1 · **Theme:** Two-worlds (4) / design system
- **Screens:** feed sheets vs landing, sign-in, leaderboard, browse, species, account
- **Merges:** F-05, F-07
- **Observation:** Near-black dark glass feed sheets vs pale-teal-on-white everywhere
  else, with different radius, shadow, control styling, verdict colour AND type scale
  (light pages use a heavy display H1; feed sheet "titles" are small uppercase
  labels). A user moving feed → leaderboard → species → account gets a hard theme
  switch each time; the two halves don't read as one component library.
- **Fix:** Treat dark and light as one documented system — shared `rounded-card` /
  `rounded-modal` scale, shared shadow tokens, shared control shapes, one
  verdict-colour set that works on both backgrounds, and map feed modal headings onto
  the same named type tokens (`h2`/`h3`, not an ad-hoc small label). Carry one
  bridging element (eyebrow + heading treatment, primary-button shape) across so it
  reads "same app, different surface." **Effort: M**

#### T-14 — No one-tap / passwordless sign-in anywhere
- **Severity:** P1 · **Theme:** Auth friction (6)
- **Screens:** sign-in (m+d), sign-up
- **Merges:** D-01
- **Observation:** Every auth route is an email + password form — no "Continue with
  Google/Apple", no magic link. Password creation is the highest-abandonment step in
  any consumer funnel, and the app already runs the email infra (verification +
  reset) that a magic link would need.
- **Fix:** Add at least one one-tap provider ("Continue with Google" = highest public
  coverage) above the email form on sign-in and sign-up with an "or" divider. If OAuth
  is out of short-term scope, add a passwordless email magic-link primary path and
  demote password to a "use a password instead" disclosure. **Effort: L**

#### T-15 — Sign-in and forgot-password are the forbidden bare card on a blank canvas
- **Severity:** P1 · **Theme:** Auth friction / blank canvas (6)
- **Screens:** sign-in (m+d), forgot-password
- **Merges:** D-02
- **Observation:** Exactly the bare `max-w-md` card on empty teal the design rules
  forbid. On desktop ~two-thirds of the 1280px viewport is empty water beside the
  card; forgot-password is the emptiest of all. Prime real estate to show what the
  user signs up for is wasted.
- **Fix:** Fill the unused viewport with editorial content — reuse the landing's
  existing `HeroPreview` / `StatsBand` / `SpeciesMarquee` components: desktop
  two-column (form one side, looping snippet + live stats the other); mobile a compact
  still/silhouette/stat strip; forgot-password at minimum a reassuring still or line.
  **Effort: M**

#### T-16 — Signed-in menu has no Account / Settings / Sign out, and buries IA under video sliders
- **Severity:** P1 · **Theme:** Auth friction / IA (6)
- **Screens:** menu, account
- **Merges:** D-03
- **Observation:** The slide-in menu shows the display name "UX Review" as inert text,
  then nav + a "UI sounds" toggle + a large "LIVE VIDEO" block of playback controls
  (Video sound, Highlight trace, Playback speed, Brightness, Contrast). There is no
  visible Account / Settings / Profile entry and no Sign out — yet the rich account
  page clearly exists. On a shared device, no findable sign-out is a real problem;
  playback tuning outranking account/sign-out is wrong IA.
- **Fix:** Make the display-name row a tappable account entry (name + email + chevron
  → /account), add explicit "Account & settings" and "Sign out" items in the top nav
  group, and demote the per-clip LIVE VIDEO sliders out of the global menu into an
  in-player controls sheet. **Effort: M**

#### T-17 — Low-contrast secondary text across every light page
- **Severity:** P1 · **Theme:** Accessibility (5/6)
- **Screens:** landing, leaderboard, browse, species, account, dark menu
- **Merges:** F-03, D-06
- **Observation:** Whole-app light-mode pattern: secondary/meta text is muted
  teal-grey on pale-teal or white, at small sizes — footer/company-number, catalogue
  photo-credit line, browse card captions and search controls, leaderboard
  scoring-explainer, species attribution and the "USUALLY SEEN AT / SIZE / HABITAT"
  eyebrows. The same shortfall recurs in the dark menu (inactive nav labels, "LIVE
  VIDEO" eyebrow). Captions/credits/legal are exactly where a science product earns
  trust; many fail AA.
- **Fix:** Establish two named muted-text tokens with verified contrast (a "muted" at
  Dark Teal `#2B7A78` ≥4.5:1 on white; a darker "muted-strong" navy for captions on
  pale-teal), replace ad-hoc light greys, and lift dark-menu inactive labels to ≥4.5:1
  with a teal-tinted off-white. Audit every `text-*-400/500` grey on a light surface
  at its actual size. **Effort: M**

#### T-18 — Sub-44px touch targets in dense list/strip surfaces
- **Severity:** P1 · **Theme:** Accessibility / mobile (5/6)
- **Screens:** species photo strip, leaderboard rows, browse pagination, account Save
- **Merges:** F-04, D-07
- **Observation:** Several interactive elements look under 44×44px on mobile: the
  species "Photos" thumbnails with their even-smaller corner "i" info dot sitting
  close together (mis-tap opens the popover instead of the image); packed leaderboard
  rows; small closely-spaced browse pagination links; and the account display-name
  "Save" button (small, pale/washed, reads semi-disabled).
- **Fix:** Enforce a 44px min hit area on every thumbnail, badge, info-dot, list row
  and pagination control (pad the tap target even if the glyph stays small); give the
  photo-strip "i" a clearly-separated larger control; give the account Save a solid
  primary-teal fill at full opacity when dirty, ≥44px height, and a "Saved" tick. Add
  save-on-blur as a fallback. Re-check all at 390px. **Effort: M**

#### T-19 — Rung-3 candidate tiles are uneven; some render dark/unlabelled
- **Severity:** P1 · **Theme:** Core loop (1) / trust
- **Screens:** feed Rung-3 candidates
- **Merges:** B-03
- **Observation:** The 2×2 candidate grid is inconsistent at the rung where the user
  actually picks a species: two tiles have clear labels ("ATLANTIC COD", "ATLANTIC
  HORSE MACKEREL"), one has a hard-to-read label area, and one is a dark/low-contrast
  image with no visible caption. The four photos vary wildly in brightness/crop/scale,
  so the grid reads as a mix of real options and broken cells.
- **Fix:** Guarantee every candidate tile has a consistent always-rendered label band
  (solid scrim + name) and a vetted photo. Reuse the existing Gemini image-quality
  gate to reject dark/low-contrast/unlabelled images from the candidate pool, falling
  back to a silhouette + name rather than shipping a dark cell. **Effort: M**

#### T-20 — Panel question headers truncate mid-word on mobile
- **Severity:** P1 · **Theme:** Core loop (1) / copy
- **Screens:** feed Rung-2, Rung-3
- **Merges:** B-02
- **Observation:** The most important text on each rung is clipped: Rung 3 shows
  `WHICH ONE IS IT? TAP TO CO…` (the instruction "tap to compare" is cut off) and
  Rung 2 shows `WHAT WAS THE OVERALL BOD…`. The header is squeezed between the
  back-arrow and the minimise/close circles, and the all-caps tracking overflows
  sooner. The truncated word is exactly the instruction a first-timer needs.
- **Fix:** Shorten headers ("Which one?", "Body shape?") and move the verb instruction
  to a subline; reserve the top row for icons only and put the question on its own
  full-width line. Pairs with T-21 (drop all-caps). **Effort: S**

#### T-21 — Single-snippet bbox overlay dots render over the metadata text (visual bug)
- **Severity:** P1 · **Theme:** Two-worlds / trust (4)
- **Screens:** snippet reveal-correct
- **Merges:** C-08
- **Observation:** In the "PEBL OBSERVATION DETAILS" panel the video's tracking-overlay
  dots are painted across the metadata text — the heading and "Site: Bideford Bay…"
  are occluded by scattered teal blobs and read as garbled. Overlay graphics are
  bleeding outside the video frame onto the card beneath. A clear rendering bug on the
  shareable entry page.
- **Fix:** Clip the bbox/tracking overlay strictly to the video element bounds
  (`overflow: hidden` on the player container) so it can never paint onto the details
  card. Verify on the single-snippet layout specifically (panels sit closer there than
  in the feed sheet). **Effort: S**

#### T-22 — Landing leads with "6 spotters" social proof, signalling an empty product
- **Severity:** P1 · **Theme:** First impression / empty states (1/2)
- **Screens:** landing
- **Merges:** A-06, G-04
- **Observation:** The stats band gives three equal-weight numbers — "30 underwater
  clips / 57 identifiable species / 6 spotters" — and the leaderboard corroborates one
  ranked spotter. A literal "6 spotters" as a headline metric tells every visitor the
  community is essentially empty, the opposite of social proof, at the first
  impression.
- **Fix:** Swap the third stat for one that grows fast and reads positively — "N IDs
  made", "N species spotted this week", or a site count ("footage from N UK sites").
  Reintroduce a spotter count once it's in the hundreds. **Effort: S**

### P2 — meaningful polish / consistency / clarity

#### T-23 — All-caps tracked headers used for primary rung questions (shouty, hurts readability)
- **Severity:** P2 · **Theme:** Core loop / design system
- **Screens:** feed Rung-1/2/3
- **Merges:** B-08
- **Observation:** Every panel question is full uppercase with wide tracking ("WHAT
  SHAPE IS IT, ROUGHLY?"). The brief reserves uppercase tracked styling for small
  eyebrow labels; at question length it adds reading time, feeds the T-20 truncation,
  and reads hackathon/shouty.
- **Fix:** Set rung questions in sentence case, brand-bold, normal tracking ("What
  shape is it, roughly?"); keep uppercase tracked styling for eyebrows and badges
  only. **Effort: S**

#### T-24 — Escape-hatch labels are ambiguous and overlap in meaning
- **Severity:** P2 · **Theme:** Core loop / copy
- **Screens:** feed Rung-1/2/3
- **Merges:** B-09, plus B-10 (missing partial-credit path at Rung 2)
- **Observation:** "SKIP TO GUESS →" most strongly reads as "skip this clip", not
  "jump to the species list", and overlaps with "NOT SURE" and "PICK FROM A LIST";
  it's unclear whether it forfeits points. Separately, the "IT'S JUST A FISH"
  partial-credit (1-pt, shape-only) commit appears only at Rung 3, so a user sure of
  the class but not the sub-shape has no "lock in what I'm sure of" option at Rung 2.
- **Fix:** Rename for intent ("Skip to guess" → "Just pick the species →"), reserve
  "Skip" for skipping the clip, make "Not sure" clearly "help me narrow / step back",
  and use the same two escape verbs consistently across rungs. Surface the "It's just
  a Fish — lock in 1 pt" action at Rung 2 as well. **Effort: S**

#### T-25 — Minimised resume control is an unlabelled "magnifier" colliding with the scroll hint
- **Severity:** P2 · **Theme:** Core loop / affordance
- **Screens:** feed minimized
- **Merges:** B-04
- **Observation:** After minimising, the only way back into the ID flow is a small
  teal-outlined magnifier circle with no label (a magnifier conventionally means
  "search", not "resume identifying"), sitting right under/beside the "USE ↑/↓ OR
  SCROLL FOR NEXT" pill and the progress line — three controls crowding one corner. A
  user who minimised by accident has no obvious way back in.
- **Fix:** Change the glyph to a fish-tag/target icon, add a small "Resume ID" label
  (or a one-time tooltip on first minimise), and separate it spatially from the scroll
  hint so the resume control owns the bottom-right corner. **Effort: S**

#### T-26 — Verify-email banner intrudes on the reward / play surface and stacks on other overlays
- **Severity:** P2 · **Theme:** Reward / onboarding overload
- **Screens:** authed reveal, authed feed, menu, onboarding
- **Merges:** C-07, E-11, D-04, A-04 (stacked-overlay variant), G-07 (banner half), G-10
- **Observation:** A persistent "Check your inbox / Verify to enable the weekly digest
  / Resend email" banner is pinned at the bottom of the play/reveal area for a fresh
  user — the most prominent message right when they should be having fun. It also
  overlaps the open menu (covering lower nav, possibly the very Account/Sign-out items
  of T-16), competes with the onboarding tour in the same frame on first sign-in, and
  greets the converted user with an admin chore at the reward moment.
- **Fix:** Make it a slim, dismissible, non-blocking banner that never overlaps the
  reward sheet or the open menu; suppress transient toasts while the full-screen menu
  is open; sequence it after the onboarding tour and after the first successful reveal;
  prefer a quiet inline chip on the account/identity area; soften copy to a perk
  ("Optional: verify to get the weekly digest"). **Effort: S**

#### T-27 — Onboarding teaches the mechanic but not the meaning, and is text-dense
- **Severity:** P2 · **Theme:** First impression / reason-for-being (1)
- **Screens:** onboarding steps 1–3
- **Merges:** A-07, G-10 (purpose half), A-03 (em-dash copy)
- **Observation:** Each tour card is a heading + a 2–3 line paragraph with no
  supporting visual; step 2 front-loads OBIS, references and scoring rationale in
  prose before the user has seen any of it. It explains "Spot / Compare / Streak" but
  never says *why it matters* (no "you're helping monitor real reefs"), and the body
  copy uses em dashes (a zero-tolerance brand violation) and reads slightly
  AI-generated.
- **Fix:** Cut each step to one heading + one plain sentence, add a small per-step
  visual (a species-pick tile, a "you vs community" bar, a streak graphic), add one
  purpose beat ("Your IDs help PEBL track what lives on UK reefs"), defer the
  OBIS/scoring nuance to the in-product reveal, and strip every em dash. **Effort: M**

#### T-28 — Leaderboard is competitive-only and exclusionary to newcomers (no progress-to-entry, no collective frame)
- **Severity:** P2 · **Theme:** Empty states / community (2)
- **Screens:** leaderboard (m+d)
- **Merges:** E-05, G-08, E-13 (leaderboard half)
- **Observation:** The board has one human ("#1 Anjali · 11"), a hidden 10-answer gate
  with no progress cue for a 1-answer newcomer, and the rest of the page is a
  "most-named species" stats list (data, not competition). There's no collective
  framing ("the community has identified N species together"), no recent-finds strip,
  no "you" row — so it reads dead and exclusionary at n=6.
- **Fix:** Always show a "You" row with a progress chip ("3 / 10 answers to join");
  lead with a collective banner (clips identified / species found / sites covered) and
  keep the ranked table as one section below; add a "recent finds" / "newest spotters"
  strip; relabel the species-frequency list as "Community trends" and tie it into the
  impact narrative (T-01). **Effort: M**

#### T-29 — Species page teaches then dead-ends (no path back into playing/collecting)
- **Severity:** P2 · **Theme:** Discovery → loop (2)
- **Screens:** species (dragonet/crab/starfish, m+d)
- **Merges:** E-09
- **Observation:** The (excellent) species pages terminate at "← Back to the feed" —
  no "find a clip with this species", no collection-status line, no "go unlock it." The
  most educational surface doesn't feed the core loop or the collection.
- **Fix:** Add a footer CTA band: a primary "Spot this in the feed" (deep-link/filter
  to clips where the species is plausible per the probability cache) and a
  collection-status line ("Locked — name it in a clip to unlock" / "✓ In your
  collection"). **Effort: M**

#### T-30 — Pokédex group counters use jargon + don't match the gate + aren't tappable filters
- **Severity:** P2 · **Theme:** Empty states / consistency (2)
- **Screens:** profile/pokédex
- **Merges:** E-08
- **Observation:** Group chips read "Crab 0/6, Fish 0/28, … Gastropod 0/4 …" —
  "Gastropod" is jargon the brief flags as off-tone, the labels don't obviously line
  up with the shape-class gate the user just used, and they're plain text where users
  will expect tapping "Fish 0/28" to filter the grid.
- **Fix:** Use the same friendly gate names, gloss/replace "Gastropod" ("Sea snails"),
  make each chip a filter that scrolls the grid to that group, and show each group's
  progress as a tiny bar. **Effort: S**

#### T-31 — "Edit answer" after scoring is ambiguous and risks undermining the reward
- **Severity:** P2 · **Theme:** Reward / comprehension (3)
- **Screens:** feed reveal
- **Merges:** C-10
- **Observation:** The post-reveal footer offers "EDIT ANSWER" (pencil) and "ARCHIVE"
  in low-contrast grey beside the bright "Next →". After points are awarded, "Edit
  answer" is ambiguous — does it re-score (making +1 meaningless)? — and "Archive"
  reads as an admin/dataset action a public player won't understand here.
- **Fix:** If re-scoring isn't allowed, relabel to "Change my guess (won't rescore)"
  or remove "Edit answer" from the post-reveal state; make "Next →" the unambiguous
  primary; demote/relocate "Archive". **Effort: S**

#### T-32 — Teaching link is underweighted and targets the wrong comparison
- **Severity:** P2 · **Theme:** Reward / learning loop (3)
- **Screens:** feed reveal
- **Merges:** C-09
- **Observation:** "HOW TO SPOT A FISH NEXT TIME" is small low-contrast grey text on a
  utility row beside "WHERE IS THIS?" — same weight as a secondary action, yet it's
  the learning payoff that makes the next guess better. It's also generic ("a Fish")
  rather than targeting the actual confusion (Pollack vs Saithe vs Poor cod).
- **Fix:** Raise its prominence after a near-miss (teal text, "See how to tell these
  apart", more separation from "Where is this?") and target it at the user-vs-top-
  community look-alike comparison. **Effort: M**

#### T-33 — Map modal truncates the site name and is a dead-end lookup
- **Severity:** P2 · **Theme:** Reward / place (3)
- **Screens:** feed map modal
- **Merges:** C-11
- **Observation:** The "Where is this?" header reads "BIDEFORD BAY, NORTH DEVON, UK ·
  ALGAP…" (deployment cut mid-word), subtitle is raw coordinates "51.0605, -4.3611",
  and there's no scale bar, no human framing, and no onward action — the modal closes
  back to the reveal. Place is a credibility/wonder lever wasted.
- **Fix:** Don't truncate the site/deployment name (wrap or move the code to the
  subtitle); replace/supplement raw coordinates with human context ("North Devon, ~20m
  depth"); add a scale indicator and one onward action ("More clips from Bideford
  Bay"). **Effort: M**

#### T-34 — Primary-button styling is inconsistent across screens
- **Severity:** P2 · **Theme:** Two-worlds / design system (4)
- **Screens:** landing, sign-in/up, reveal, 404, account
- **Merges:** F-06, A-05/G-05 (landing twin-CTA), B-13 (flashcard BACK), C-13 (reveal title)
- **Observation:** The "primary CTA" role renders as dark-teal-fill (landing "Start
  spotting"), bright-teal-fill (sign-in), and outlined (404) depending on the page,
  with text colour also varying. On the landing two near-equal CTAs ("Start spotting"
  vs "Create your spotter profile") split intent and reintroduce the sign-up barrier
  the guest flow removes; on the flash-card a heavy "‹ BACK" pill competes with the
  decisive "This is my pick" CTA; the reveal sheet lacks a "Your result" title.
- **Fix:** Pick ONE primary (bright-teal `#3AAFA9` fill, navy text) and ONE secondary
  (outlined teal), name them as component classes, apply uniformly. On the landing make
  "Start spotting" the single dominant CTA and demote "Create your spotter profile" to
  a quiet text link. Demote the flash-card "BACK" to a ghost/chevron. Add a "Your
  result" eyebrow to the reveal sheet. **Effort: M**

#### T-35 — Header chrome and back-link wording vary across the app
- **Severity:** P2 · **Theme:** Two-worlds / consistency (4)
- **Screens:** all
- **Merges:** F-10, A-09 (desktop hamburger-only + ghost logo), B-12 (orphan "SHOW ON SCREEN")
- **Observation:** The left affordance shifts by context (hamburger on feed/landing vs
  a back-link on content pages) and the back-link copy varies ("Back to feed", "Back to
  FishSpotter", "Back to the feed", "Back to live feed"). On desktop the landing header
  is just a hamburger + a low-contrast ghost "PEBL" wordmark (reads as a stretched
  mobile layout); the feed has an orphaned, unlabelled "SHOW ON SCREEN" control bottom-
  right.
- **Fix:** Standardise one header system: persistent wordmark right (lift to full brand
  colour); a single left-affordance rule (menu on top-level surfaces, one consistently
  worded back-link — e.g. always "Back to feed" — on detail pages); render proper
  desktop nav/CTA instead of hamburger-only; label or remove "SHOW ON SCREEN".
  **Effort: M**

#### T-36 — Legal copy surfaces a `.vercel.app` URL; long legal pages have no navigation
- **Severity:** P2 · **Theme:** Trust / legal
- **Screens:** terms, privacy, accessibility
- **Merges:** F-08, F-09
- **Observation:** Terms states "available at fish-spotter.vercel.app" — a hosting URL
  in published legal copy reads as staging/temporary (the intended canonical domain is
  a real domain). Privacy renders ~18,850px tall and Terms ~10,390px with no table of
  contents, jump-links or "back to top", so a user with a specific GDPR question must
  scroll thousands of pixels. Support-contact treatment also differs across the three
  pages.
- **Fix:** Replace the `vercel.app` reference with the canonical product domain (kept in
  sync across the three pages), add a short sticky/inline table of contents + a
  persistent "back to top" / "Back to FishSpotter", and standardise the support-contact
  treatment. **Effort: M**

#### T-37 — Sign-up form is a five-field gate with "profile" framing at the soft ask
- **Severity:** P2 · **Theme:** Auth friction (6)
- **Screens:** sign-up, signup-filled
- **Merges:** D-08, D-05 (duplicate 8-char hint)
- **Observation:** Sign-up stacks five decisions (email, display name, password +
  3-item checklist, age, terms) plus the under-18 explainer — a tall "play → paperwork"
  register shift right after the reveal. "Create your spotting profile" oversells a
  standard account (no avatar/bio collected). The "(at least 8 characters)" hint is
  also duplicated (inline label + first checklist item) and is mis-placed on sign-in
  entirely.
- **Fix:** Trim the visible first step to the legally/operationally required set
  (email + password + age + terms) and defer display name (auto-assign "Spotter 4312",
  editable on the account page); make the heading honest ("Create your account"); pick
  one source for the 8-char rule and remove it from sign-in. Pairs with T-14.
  **Effort: M**

### P3 — minor nits / nice-to-haves

#### T-38 — Assorted small polish
- **Severity:** P3 · **Theme:** various
- **Merges:** C-12 (depth chip uses a download glyph), B-15 (squid/eel silhouettes hard
  to parse), B-11 (unlabelled drag/minimise/close controls + destructive-close risk),
  D-10 (off-palette "Danger Zone" red + one-tap delete needs a confirm step), D-09
  (inconsistent required-field asterisks), D-11 (forgot-password success-state clarity),
  E-06/E-07 (red ✗ surfaces low performance; "Saithe (was Scooter)" is cryptic),
  F-13 (CC attribution microcopy too small / inconsistent), A-08 (mobile catalogue is a
  dead-end teaser + dead-fish Sprat card), A-02 (landing dead-space band between stats
  and catalogue), A-10 (secondary-CTA wording + loose About line-height).
- **Fix (themed):** swap the depth glyph for a depth-appropriate icon; revisit the
  squid/eel silhouettes for legibility; differentiate + label minimise vs close and
  confirm a destructive mid-funnel close; use a named "destructive" token + a confirm
  step for account deletion; standardise required-field marking (drop asterisks,
  validate on submit); confirm the forgot-password success state; balance the recent-ID
  red ✗ with points earned and make "you guessed X · correct answer Y" explicit; define
  one attribution pattern ("© {author} · {licence}") at one legible size; add a
  browse-through link + an in-water Sprat photo on the mobile catalogue; remove the
  landing dead-space band (or fill it with a "how it works" strip); reword the secondary
  CTA to a benefit frame and tighten the About line-height. **Effort: S each**

---

## 4. What's genuinely good (keep / protect)

A consolidated list from all reviewers — do not regress these:

- **The guest reveal sequence** (`feed-05`): play → score in place → PEBL reference →
  community split → *then* a soft "Save my finds — sign up free" card. Best-practice
  citizen-science activation. The strongest screen in the app. (A, C, G)
- **Reward fires in place and immediately** — verdict, reference and community land on
  the same card the moment the user commits; no navigating to find a score. (C, G)
- **The species education pages** — dark "How to spot it" card with numbered teal rings
  over a real annotated photo + 2–3 plain-English diagnostic bullets, the "Usually seen
  at / Size / Habitat / Behaviour" chip row, the OBIS occurrence map, and correct
  visible CC attribution. A finished, on-brand asset; keep the template wholesale.
  (E, F)
- **The shape-class-first identify gate** — the correct cognitive altitude for the
  public ("it's a fish" before "it's a pollack"), large tiles, clean teal line-art
  silhouettes, species-count badges that teach scope, a real breadcrumb, and graduated
  escape hatches at every rung so nobody dead-ends. (B)
- **The species flash-card** — binomial, "usually seen ~7–130 m", a diagnostic-mark
  ring on a real photo, the lateral-line explainer, a CC-attributed reference strip, one
  decisive "This is my pick" CTA. The teaching payload done well. (B)
- **Honest, generous scoring on display** — "Close · +1" for a coarse-but-reasonable
  guess tells a newcomer the game is forgiving and lowers the barrier. (G)
- **The auth copy + consent/safeguarding layer** — the sign-up value framing ("Join the
  PEBL marine monitoring community…"), the age band + under-18 guardian/leaderboard
  handling, inline password-strength feedback with "(recommended)" framing. Rare to see
  done this well; keep verbatim. (D)
- **The account/settings page** — identity, email-verification status, a public-
  leaderboard privacy toggle, a named Danger Zone, a GDPR Art. 20 JSON data export, and
  a legal block. Reads as a lawful, credible product. (D)
- **The legal + accessibility pages** — proper structure, company number 12076622,
  registered address, and an unusually honest Accessibility Statement that names a WCAG
  2.1 AA target AND a candid "Known gaps" section. A genuine trust asset. (F)
- **One consistent brand system + no emoji icons in the core chrome** — the wordmark,
  the uppercase tracked teal eyebrow + bold navy H1, the pebl-surface cards, line/
  silhouette art not emoji. The single biggest "this is a real product" signal. (F)
- **The 404 page** — keeps the marine-silhouette background, a clear headline, and two
  real recovery actions. (F)
- **Play-before-signup is implemented** and the landing removes the obvious blockers
  ("Free, no card required" + a primary CTA that doesn't demand an account). (A, G)
- **The persistent metadata HUD** (depth / location / month) on the feed and the
  reveal's "Where is this?" — grounds each clip in real provenance. (B, C)
- **The retention scaffolding exists at all** (pokédex, streak, leaderboard,
  most-named-species) — the right set of mechanics; the problems are framing and
  first-run state, not whether to have them. (G)

---

## 5. Top 10 highest-leverage fixes

Ranked by how much each moves the public-engagement goal per unit of effort.

1. **Thread the real-science contribution narrative through landing → reveal → profile
   → leaderboard (T-01).** The missing reason-for-being; mostly copy. *M.*
2. **Convert the first-run retention states from deficit to momentum (T-02)** — hide
   0% accuracy, reframe "0 of 57" as "1 discovered, 56 to find" with a filling bar,
   collapse the locked wall, seed a guaranteed first unlock in onboarding. *M.*
3. **Make the reward visibly accumulate progress on both reveals (T-07)** — points +
   streak tick + "added to your collection — N of 57" / unlock beat at the moment of
   the win. *M.*
4. **Fix the browse grid: real poster frames + per-card identity/status + discovery
   filters (T-03 + T-04).** Turns a dead database dump into a library worth exploring.
   *M.*
5. **Give the verdict focal weight, plain language and the named `pending` token; drop
   the off-palette amber and the "≈" glyph (T-06).** The payoff must land. *M.*
6. **Swap the landing "6 spotters" stat for a fast-growing positive metric, and make
   "Start spotting" the single dominant CTA (T-22 + T-34 landing half).** First-
   impression conversion. *S.*
7. **Add a redundant non-colour cue to every semantic state and stand up the named
   verdict-token set (T-11).** The owner is colour-blind; the app publishes a WCAG
   pledge it currently breaks. *M.*
8. **Bring the single-snippet `/feed/[id]` reveal to parity with the feed reveal and
   fix the bbox-over-text bug (T-08 + T-21).** The shareable entry point is currently
   the worst version of the product. *L (parity) + S (bug).*
9. **Reduce auth friction: one-tap / magic-link path + defer display name + fill the
   blank auth canvas (T-14 + T-37 + T-15).** Removes the wall at the soft ask. *L + M.*
10. **Add a daily-goal + streak-stakes loop and a progress-to-leaderboard "You" row
    (T-28 + the day-2 retention engine from G-03).** Gives a concrete reason to return
    tomorrow. *M.*
