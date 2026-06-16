# Vision UX Review — B: The Core Identify Loop ("Spot It")

Reviewer area: the heart of the app — the funnel a casual user runs on every clip
(feed clip → tap → Rung 1 shape gate → Rung 2 sub-split → Rung 3 candidate tiles →
optional species flash-card → reveal). Lenses applied: hierarchy, first-time
comprehension, friction/cognitive load, engagement, consistency, a11y, mobile-first,
copy, trust.

---

## Summary verdict

The core loop is **structurally sound and surprisingly considerate** — the
shape-first gate is the right mental model for a non-expert (people genuinely can
say "it's a fish" before they can say "it's a pollack"), the breadcrumb
(`FISH › TORPEDO OR DEEP-BODIED`) is a real orientation aid, the species-count
badges set expectations honestly, and every rung carries graded escape hatches
("Not sure", "Skip to guess", "It's just a Fish", "None look right", "Pick from a
list") so a casual user is never trapped. The flash-card is a genuinely good
teaching moment. **The weakness is the first 2 seconds and the cognitive framing at
each step.** The very first instruction is ambiguous ("Tap to name species" vs "Tap
the clip to identify" — two different phrasings on one screen, and neither says
*why*), the panel headers truncate mid-word on mobile (`WHICH ONE IS IT? TAP TO
CO…`, `WHAT WAS THE OVERALL BOD…`) which is a bad look on the panel that's supposed
to teach, several Rung-3 tiles render unlabelled/dark so the photo grid is uneven,
the minimised "magnifier bubble" has no label and competes spatially with the
scroll hint, and the single-snippet detail page is a **different visual world**
(light background, raw native video chrome, metadata dumped below the video) that
breaks continuity with the feed. The bones are right; the polish and the
comprehension scaffolding at the seams are what cost a first-timer.

## What's genuinely good (keep)

- **Shape-class-first gate** — correct cognitive altitude for the public; tiles are
  large, silhouettes are clean teal line-art, labels are legible.
- **Species-count badges** (28 / 3 / 6 …) on every shape and sub-split tile — these
  quietly teach scope and make a choice feel consequential without text.
- **The breadcrumb chip** (`FISH › TORPEDO OR DEEP-BODIED`) at Rung 3 — real
  orientation; the user always knows where they are in the funnel.
- **Graduated escape hatches** at every rung ("Not sure" + "Skip to guess" early;
  "It's just a Fish" + "None look right" + "Pick from a list" at Rung 3) — this is
  excellent funnel design; nobody dead-ends, and the partial-credit "It's just a
  Fish" path matches the 1-pt shape-only scoring.
- **The species flash-card** (Pollack: binomial, "Usually seen ~7-130 m", a
  diagnostic-mark ring on a real photo, the *lateral line* explainer, a reference
  strip with CC attribution, one decisive "This is my pick" CTA) — this is the
  teaching payload done well and on-brand.
- **The persistent metadata HUD** (depth / location / month, bottom-left) on the
  feed and minimised states — grounds each clip in real provenance, reinforces the
  "real science" positioning.

---

### B-01 — Two different, vague instructions for the single first action
- **Screens:** feed-01-idle.png, d-feed-01-idle.png
- **Severity:** P0
- **Lens:** First-time comprehension
- **Observation:** The idle feed presents the entry action **twice, worded
  differently**: a floating dark pill mid-screen reads "Tap the clip to identify"
  while the bottom bar reads "Tap to name species". A first-timer sees two prompts
  and can't tell if they're the same action or two different ones, and neither says
  what they get for doing it. There is no one-line "what is this / why" anywhere on
  the first screen — the user lands on a murky green underwater frame with a faint
  drifting shape and two competing taps.
- **Why it matters:** This is the single most important moment in the funnel — the
  decision to engage at all. Citizen-science conversion lives or dies on the first
  screen making the ask and the payoff obvious in under 2 seconds. Redundant,
  inconsistent, reward-free prompts read as a rough prototype and raise bounce.
- **Recommendation:** Pick **one** primary prompt and one verb. Replace both with a
  single clear CTA, e.g. a bottom button "Identify this species →" plus a one-line
  subtitle the first time only: "Spot what's in the clip, score points, build a
  streak." Drop the mid-screen floating pill (or make it the only prompt and remove
  the bottom one). Align the verb across the whole loop ("Identify" everywhere, not
  "name" in one place and "identify" in another).
- **Effort:** S

### B-02 — Panel headers truncate mid-word on mobile
- **Screens:** feed-04-rung3-candidates.png, feed-03-rung2-bodyshape.png
- **Severity:** P1
- **Lens:** Copy & microcopy / mobile-first quality
- **Observation:** The question header — the most important text on each rung — is
  clipped with an ellipsis on mobile. Rung 3 shows `WHICH ONE IS IT? TAP TO CO…`
  (the instruction "tap to compare" is cut off) and Rung 2 shows `WHAT WAS THE
  OVERALL BOD…`. The header sits between a back-arrow circle and the
  minimise/close circles, so the available width is squeezed and the all-caps
  tracked styling makes it overflow even sooner.
- **Why it matters:** The truncated word is exactly the instruction a first-timer
  needs ("tap to compare" tells them tiles are explorable, not commit-on-tap). A
  teaching panel that can't show its own question undermines trust and clarity at
  the decision point.
- **Recommendation:** Shorten the headers to fit (`WHICH ONE?`, `BODY SHAPE?`) and
  move the verb instruction to a small subline under the header, OR allow the
  header to wrap to two lines and reduce the all-caps tracking. Reserve the top row
  for icons only; put the question on its own full-width line below.
- **Effort:** S

### B-03 — Rung-3 candidate tiles are visually uneven; some render dark/unlabelled
- **Screens:** feed-04-rung3-candidates.png
- **Severity:** P1
- **Lens:** Visual hierarchy & clarity
- **Observation:** The 2×2 candidate grid is inconsistent. Two tiles have clear
  species labels ("ATLANTIC COD", "ATLANTIC HORSE MACKEREL"); the bottom-left tile
  shows a fish photo but the label area is hard to read, and the bottom-right tile
  is a dark/low-contrast image with **no visible caption at all**. The four photos
  vary wildly in brightness, crop and subject scale, so the grid reads as a mix of
  "real options" and "broken cells" rather than four equal candidates.
- **Why it matters:** This is the rung where the user actually picks a species. If
  some tiles look unlabelled or broken, the user can't compare like-for-like and
  loses confidence that the app knows its own catalogue — directly hurting the
  identify success rate and the sense of a credible science product.
- **Recommendation:** Guarantee every candidate tile has (a) a consistent label
  band (solid scrim + species name, always rendered) and (b) a vetted teaching
  photo. Reuse the Gemini image-quality gate already in the codebase to reject
  dark/low-contrast/unlabelled images from the candidate pool, and fall back to a
  silhouette + name when no clean photo exists, rather than shipping a dark cell.
- **Effort:** M

### B-04 — Minimised "magnifier bubble" has no label and collides with the scroll hint
- **Screens:** feed-06-minimized.png
- **Severity:** P1
- **Lens:** Friction & cognitive load / affordance clarity
- **Observation:** After minimising, the only way back into the ID flow is a small
  teal-outlined magnifier circle bottom-right. It carries **no text label**, and a
  magnifier glyph conventionally means "search", not "resume identifying". It also
  sits immediately under and beside the "USE ↑/↓ OR SCROLL FOR NEXT" pill and the
  thin teal progress line, so three controls crowd the same bottom-right corner.
  A first-timer who minimised by accident has no obvious "get back in".
- **Why it matters:** The minimise affordance only works if users can confidently
  return; an unlabelled search-looking icon competing with the scroll hint is a
  discoverability dead-end that strands a casual user mid-task.
- **Recommendation:** Give the bubble an explicit affordance: change the glyph to a
  fish-tag/target icon (not a magnifier) and add a small "Resume ID" / "Identify"
  label, or show a one-time tooltip on first minimise. Separate it spatially from
  the scroll pill (move the scroll hint to top-centre or shrink it) so the resume
  control owns the bottom-right corner.
- **Effort:** S

### B-05 — Single-snippet detail page is a different visual world from the feed
- **Screens:** snippet-01-challenge.png
- **Severity:** P1
- **Lens:** Consistency
- **Observation:** The detail page ("Spotter Challenge") is on a **light/pale-teal
  background** with a white video card and a **raw native HTML5 video player**
  (default play button, "0:00 / 0:09", browser volume/fullscreen/3-dot controls),
  with "PEBL OBSERVATION DETAILS" / "Site: …" listed as a text block **below** the
  video. The feed, by contrast, is full-bleed dark, full-screen video, no visible
  player chrome, metadata overlaid as a HUD, and ID happens in a dark glass panel.
  The two surfaces look like two different apps for the same core task.
- **Why it matters:** A user arriving via a shared link or the archive should feel
  they're in the same product and use the same identify gesture. The native player
  chrome reads as unbranded/prototype, and the light-on-dark whiplash plus the
  metadata-dumped-below-video layout break the polished, continuous feel the feed
  establishes.
- **Recommendation:** Unify the snippet detail page with the feed surface: dark
  background, custom (chromeless) video styling consistent with the feed, metadata
  as the same HUD treatment, and the **same** rung-based "Identify" entry as the
  feed (rather than a separate type-in challenge). At minimum, hide the native
  controls overlay and match the dark theme + brand pill styling.
- **Effort:** M

### B-06 — Detail-page type-in path diverges from the feed's guided rungs
- **Screens:** snippet-01-challenge.png
- **Severity:** P1
- **Lens:** Consistency / friction & cognitive load
- **Observation:** The detail page is framed as a "Spotter Challenge" with a
  type-in identification path (free-text/observation-details flow), whereas the
  feed teaches via the shape gate → sub-split → candidate-tiles funnel. A
  first-timer who learned the tap-the-shape flow on the feed lands here and is
  faced with a different, harder modality (recall/type a species name) with no
  scaffolding — exactly the expert-style task the rung funnel was designed to
  avoid for the public.
- **Why it matters:** Two different identify mechanics for the same job double the
  learning cost and contradict the core product bet (guided, shape-first ID lowers
  the barrier for non-experts). The harder type-in path on the detail page will
  have a far lower completion rate for casual users.
- **Recommendation:** Make the detail page reuse the **same guided rung flow** as
  the feed (one source of truth for "Identify"). Keep a "type the name" affordance
  only as an advanced escape hatch (equivalent to the feed's "Pick from a list"),
  not as the primary path. The user's mental model must transfer 1:1 between feed
  and detail page.
- **Effort:** M

### B-07 — Starfish tile pre-selected at the shape gate with no obvious reason
- **Screens:** feed-02-rung1-shapegate.png, d-feed-02-shapegate.png
- **Severity:** P2
- **Lens:** Visual hierarchy & clarity / first-time comprehension
- **Observation:** On the Rung-1 shape gate the **STARFISH** tile is rendered in a
  highlighted/selected state (brighter teal fill, teal ring) while the other six
  tiles are muted. Nothing on screen explains why one option is pre-emphasised — a
  first-timer may read it as "the app's suggested answer", as "already selected",
  or as a hover state stuck on. Given the clip shows a drifting fish-like shape,
  steering the eye to Starfish is actively misleading.
- **Why it matters:** A pre-highlighted wrong tile biases the very first decision
  and can produce an immediate wrong guess (0 pts) on a user's first attempt — a
  demoralising first impression. If it's a hover/focus artifact it still confuses
  on touch where there is no hover.
- **Recommendation:** Do not pre-select any shape tile on entry; all seven start
  equal. Use the highlight state only for genuine hover/focus/active. If a
  context-prior hint is intended (OBIS likelihood), express it as a subtle "likely
  here" badge, not as a full selected-state that mimics a committed choice.
- **Effort:** S

### B-08 — All-caps tracked headers hurt readability and add a "shouty" tone
- **Screens:** feed-02-rung1-shapegate.png, feed-03-rung2-bodyshape.png, feed-04-rung3-candidates.png
- **Severity:** P2
- **Lens:** Copy & microcopy / consistency
- **Observation:** Every panel question is set in full uppercase with wide letter
  tracking ("WHAT SHAPE IS IT, ROUGHLY?", "WHAT WAS THE OVERALL BODY SHAPE?",
  "WHICH ONE IS IT?"). The brief reserves uppercase tracked styling for **small
  eyebrow labels**, not for primary questions. At question-length the all-caps adds
  reading time, contributes to the truncation in B-02, and reads slightly
  hackathon/shouty rather than the plain, grounded tone the brand wants.
- **Why it matters:** These questions are the main instruction on each rung;
  sentence case is faster to read and friendlier for a non-expert audience, and it
  keeps uppercase meaningful (eyebrows only) per the design system.
- **Recommendation:** Set the rung questions in **sentence case**, brand-bold,
  normal tracking ("What shape is it, roughly?"). Keep uppercase tracked styling
  for the small eyebrow labels and badges only.
- **Effort:** S

### B-09 — "Skip to guess" is ambiguous and may read as "skip this clip"
- **Screens:** feed-02-rung1-shapegate.png, feed-03-rung2-bodyshape.png, feed-04-rung3-candidates.png
- **Severity:** P2
- **Lens:** Copy & microcopy / friction & cognitive load
- **Observation:** The bottom-right escape hatch reads "SKIP TO GUESS →". For a
  casual user "skip" most strongly signals "skip / move on to the next clip", not
  "jump straight to the final pick-a-species list". Paired with "NOT SURE" on the
  left and (at Rung 3) "PICK FROM A LIST", the three options overlap in meaning and
  aren't clearly differentiated. It's unclear whether "Skip to guess" forfeits
  points or just shortcuts the funnel.
- **Why it matters:** Ambiguous escape-hatch labels either trap users (afraid to
  tap "skip" lest they lose the clip) or send them somewhere unexpected — both add
  friction at the exact moments a hesitant user is looking for a way forward.
- **Recommendation:** Rename for intent: "Skip to guess" → "Just pick the species →"
  (or "Go straight to the list →"), reserve the word "Skip" for actually skipping
  the clip, and make "Not sure" clearly mean "help me narrow / step back". Ensure
  the same two escape verbs are used consistently across all rungs rather than
  three near-synonyms.
- **Effort:** S

### B-10 — Rung 2 has only one navigation back-stop; "It's just a Fish" partial-credit path is missing at the sub-split
- **Screens:** feed-03-rung2-bodyshape.png
- **Severity:** P2
- **Lens:** Friction & cognitive load / engagement
- **Observation:** At Rung 2 (body-shape sub-split) a user who is confident it's a
  fish but unsure of the body shape only has "Not sure" and "Skip to guess". The
  helpful "IT'S JUST A FISH" commit-for-partial-credit button (1 pt, shape-only)
  only appears at Rung 3. So a user who can't pick between "Torpedo or deep-bodied"
  and "Long and slender" must either guess a sub-shape they're unsure of or jump
  past the guided flow entirely — there's no "lock in the shape-class I'm sure of"
  option at this step.
- **Why it matters:** The sub-split is where less-confident users stall (body-shape
  distinctions are genuinely hard from a murky clip). Offering the guaranteed
  1-pt "it's a fish" commit here keeps them progressing and rewarded instead of
  bouncing or guessing wrong (0 pts).
- **Recommendation:** Surface the "It's just a Fish — lock in 1 pt" action at Rung 2
  as well (e.g. a tertiary button under the sub-shape list), so the partial-credit
  path is available the moment a user is confident of the class but not the
  sub-shape.
- **Effort:** S

### B-11 — Drag-handle / minimise / close affordances are unlabelled and easy to confuse
- **Screens:** feed-02-rung1-shapegate.png, feed-04-rung3-candidates.png
- **Severity:** P2
- **Lens:** Affordance clarity / accessibility (visual)
- **Observation:** Each ID panel carries three top-edge controls with no labels: a
  faint dotted grab-handle (`:::`) centred at the very top, a "minus" circle, and
  an "×" circle. A first-timer won't know the dotted dots are a drag handle, and
  the difference between "minus" (minimise to the bubble) and "×" (close/abandon) is
  not obvious — both look like "make this go away". Tapping the wrong one (close vs
  minimise) has very different consequences (lose progress vs keep it parked).
- **Why it matters:** On a guided funnel, accidentally closing (and losing the
  rung position) when the user meant to minimise is a real frustration; unlabelled
  icon-only controls also fail the non-expert audience and add to the
  control-clutter in the panel's top row.
- **Recommendation:** Differentiate clearly: keep "×" as close, but give the
  minimise a distinct down-chevron-to-corner glyph, and add tiny labels or
  aria-labels ("Minimise", "Close"). Confirm before a destructive close mid-funnel
  ("Close and lose your progress?") or make close also park to the bubble.
- **Effort:** S

### B-12 — Desktop layout wastes ~60% of the viewport with empty green gutters
- **Screens:** d-feed-01-idle.png, d-feed-02-shapegate.png
- **Severity:** P2
- **Lens:** Mobile-first quality (desktop breakage)
- **Observation:** On desktop the feed is a narrow centred phone-width column with
  large flat green gutters on both sides (~ a third of the width each). The shape
  gate, by contrast, **does** expand to a wide 4-up grid — so the two desktop
  screens are inconsistent with each other (idle = narrow column, gate = wide
  panel), and the idle state in particular looks like an un-adapted mobile build
  stretched onto a big screen. A "SHOW ON SCREEN" control sits orphaned bottom-right
  with no context.
- **Why it matters:** While mobile is primary, desktop is where many first-time
  visitors arrive from a shared link; vast empty gutters and an inconsistent
  width read as unfinished and lower trust in the science product.
- **Recommendation:** Either commit to a deliberately framed centred column on
  desktop (with editorial content / live stats / "what is this" in the gutters, per
  the landing approach) or widen the feed surface. Make the idle and gate states
  use the same desktop framing. Label or remove the orphaned "SHOW ON SCREEN"
  control.
- **Effort:** M

### B-13 — Flash-card "BACK" button competes with the primary "This is my pick" CTA
- **Screens:** feed-04b-species-flashcard.png
- **Severity:** P3
- **Lens:** Visual hierarchy & clarity
- **Observation:** On the species flash-card the top-right "‹ BACK" button is a
  prominent rounded pill, visually similar in weight to the bottom "This is my pick:
  Pollack" CTA. The decisive action (commit this species) should clearly dominate;
  a heavy BACK pill at the top draws the eye away from it and slightly muddies
  which way the user is meant to go.
- **Why it matters:** The flash-card's job is to confirm a confident pick; the
  commit CTA should be the unambiguous focal point. Equal-weight back/commit
  affordances add a beat of hesitation.
- **Recommendation:** Demote "BACK" to a lighter text/ghost button (or a plain
  back-chevron) and keep the full-width teal "This is my pick" as the single
  high-emphasis action. Optionally pin the commit CTA so it's always visible without
  scrolling past the reference strip.
- **Effort:** S

### B-14 — No persistent score / streak / progress cue during the loop
- **Screens:** feed-01-idle.png, feed-02-rung1-shapegate.png, feed-04-rung3-candidates.png
- **Severity:** P3
- **Lens:** Engagement & motivation
- **Observation:** Throughout the identify funnel there is no always-visible
  reminder of the stakes or the user's progress — no points-on-offer, no current
  streak, no "X of 10 to reach the leaderboard". The metadata HUD shows
  depth/location/month (provenance) but nothing motivational. The only numbers are
  the species-count badges, which set scope, not reward.
- **Why it matters:** Retention in citizen-science comes from visible progress and
  reward. Surfacing "+2 pts" potential and the streak during the act of
  identifying (not only at the reveal) gives the casual user a reason to finish the
  rung and come back — cheap motivation at the point of effort.
- **Recommendation:** Add a small, non-intrusive status chip (e.g. top-left or in
  the HUD) showing current streak and/or "worth up to 2 pts", and a subtle progress
  toward the 10-ID leaderboard entry. Keep it minimal and on-brand so it doesn't
  compete with the clip or the rung tiles.
- **Effort:** M

### B-15 — Squid silhouette is hard to parse; sub-split fish silhouettes are slightly abstract
- **Screens:** feed-02-rung1-shapegate.png, feed-03-rung2-bodyshape.png
- **Severity:** P3
- **Lens:** First-time comprehension / visual clarity
- **Observation:** The SQUID shape tile silhouette reads as an ambiguous blob/curled
  form rather than an obviously squid-like outline, and at Rung 2 the "EEL-LIKE"
  boomerang silhouette and "BOTTOM SCOOTERS" outline are abstract enough that a
  non-expert leans on the text label rather than the picture. The silhouettes are
  meant to let users match by shape pre-literacy; a couple don't yet carry that
  load on their own.
- **Why it matters:** The whole premise of the gate is "match the shape you see".
  Silhouettes that need their label to be understood weaken the visual-first promise
  for the audience least able to read the species names.
- **Recommendation:** Revisit the squid and eel-like/bottom-scooter silhouettes for
  a more immediately legible outline (clearer mantle+arms for squid; a recognisable
  eel curve). Validate with a quick non-expert "what is this shape?" check; keep
  labels but ensure the silhouette alone is ~recognisable.
- **Effort:** M

---

## Return to orchestrator

**Prefix:** B
**Counts:** 1 P0, 5 P1, 6 P2, 3 P3 (15 findings)
**Verdict:** The core "Spot It" loop is structurally strong — the shape-first gate
is the right model for the public, the breadcrumb + species-count badges orient and
set scope well, the graduated escape hatches mean nobody dead-ends, and the species
flash-card is a genuinely good teaching moment worth keeping. The damage is at the
seams and in the first 2 seconds: the entry screen gives two different vague prompts
for one action with no stated payoff (B-01, the only P0), panel question headers
truncate mid-word and shout in all-caps (B-02/B-08), the Rung-3 candidate grid ships
uneven/unlabelled/dark tiles (B-03), the minimised "magnifier" resume control is
unlabelled and collides with the scroll hint (B-04), a wrong shape tile appears
pre-selected at the gate (B-07), and the single-snippet detail page is a different
visual world with native video chrome and a harder type-in path that breaks
continuity with the feed (B-05/B-06). Fixing the first-screen ask, the header
truncation, the candidate-tile consistency, the resume affordance, and unifying the
detail page with the feed funnel would lift comprehension and completion materially
for a non-expert, with most fixes in the S–M range.
