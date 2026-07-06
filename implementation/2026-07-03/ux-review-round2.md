# FishSpotter — UX review, round 2 (2026-07-03)

Second-pass audit, run the same day as [round 1](./ux-review.md) but through the
lenses round 1 didn't use: **journey walkthroughs** (three personas traced
step-by-step through the real code paths), **copy/tone/terminology** (every
user-visible string, including the four email templates), **performance &
resilience** (slow networks, failures, offline, perceived speed), and an
**adversarial verification pass** that tried to refute round 1's P1s before we
build on them. All claims below were verified against the working tree with
`file:line` evidence; overstated citations were trimmed.

---

## Round-1 verification: all five P1s stand

| # | Round-1 P1 | Verdict |
|---|---|---|
| 1 | Pebbles redesign half-shipped (stale reference-model copy) | **CONFIRMED** — every cited string exists verbatim |
| 2 | `/feed/[id]` permalink degraded | **CONFIRMED — and worse than reported** (see R2-2) |
| 3 | Profile `/u/[id]` orphaned | **CONFIRMED — understated**: the only two `/u/` links in runtime are the leaderboard (needs 10 IDs) and an **admin-gated** panel, so a normal newcomer has **zero** routes in |
| 4 | Reveal never states the verdict in words | **CONFIRMED** for the feed (the primary surface). Two stale comments even describe a headline that no longer exists (`RevealResult.tsx:5`, `CorrectFishSwim.tsx:13`). The permalink *does* say "Correct"/"Wrong" — in the retired model's words |
| 5 | WCAG AA contrast failures | **CONFIRMED** with two trims: `TileGate.tsx:436` is a drag-handle (non-text criterion, ~3.1:1 marginal pass) and `CandidateStrip`'s 5 sites aren't user-facing (orphan status re-verified — imported nowhere). **9 genuinely user-facing failing sites remain** |

---

## Headline

Round 2 confirms round 1's diagnosis and raises the stakes. The same drift —
**the Pebbles redesign shipped in the feed's happy path and never reached the
adjacent surfaces** — turns out to include not just stale copy but a live
**data-integrity bug** (an admin action that destroys Pebbles balances), a
**dead reward** (the collection-unlock chip can never fire), and a shared-link
page that shows **wrong numbers**, not just an old design.

Separately, two things no earlier audit caught: the app's **single most
important action (submitting an ID) can fail completely silently**, and the
**AI chat is presented as a human** ("Ask the biologist") with no disclosure
anywhere.

---

## P0 — data integrity (fix before anything else)

### R2-1. Admin reference-save silently destroys Pebbles balances ✅ FIXED 2026-07-06
> Fixed on this branch: `rescoreAnswers` no longer emits `points` (type-level —
> a test guards against regression), the server action writes `isCorrect` +
> unlocks only, and the admin copy now says "Pebbles balances are never
> changed."
`setSnippetReference` → `rescoreAnswers` → `matchWithAliases` **overwrites
`Answer.points` on the retired 0/1/2 scale**
(`admin/snippets/[id]/actions.ts:108,114–121`; `lib/snippet-reference.ts:39`;
`lib/answer-matching.ts:43–54`) while live answers hold Pebbles — 5–31 at
submit, consensus credits up to ~375, legacy rows migrated ×10. One admin save
on an answered clip slashes every spotter's total and corrupts the leaderboard.
The admin list page even advertises it: "Saving re-scores existing answers"
(`admin/snippets/page.tsx:44–48`). **Fix:** rewrite the rescore for the Pebbles
model — adjust `isCorrect`/unlocks only, never rewrite `points` (or compute a
Pebbles-aware delta); correct the admin copy. *Until fixed, staff should not
save references on answered clips.*

---

## P1 — silent failures, wrong numbers, trust

### R2-2. Submitting an ID can fail with zero feedback (two layers)
- **Network layer:** `useCreatureQuiz.handleSubmit` wraps both the guest and
  authed POSTs in `try/finally` with **no catch**
  (`lib/useCreatureQuiz.ts:230–360`); `fetch` rejecting offline or `res.json()`
  throwing on an HTML 500 propagates as an unhandled rejection through
  `submitAndAdvance` (`FeedCard.tsx:889–898`). A spotter on flaky mobile taps a
  tile — spinner blips, nothing happens, no message, no retry, pick not queued.
- **UI layer:** even *handled* errors (`submitError`, e.g. the 429 "Too many
  answers") render only in the floating panel (`FeedCard.tsx:1444–1452`), which
  is **hidden while the Spot It gates are open** — and neither `CandidateGate`
  nor `BodyShapeGate` receives an error prop. The message renders into an
  invisible component.
**Fix:** catch in `handleSubmit` with a visible, retryable error; pass
`submitError` into the gates (or a toast at article level).

### R2-3. The shared-link page shows the retired economy's numbers — wrong, not just old
Deepens round-1 P1-2: `SnippetPlayer` renders "**Correct · +2**" (:171),
"**+1 Bonus**" (:196), "**Reference: {staffAnswer}**" (:215), and
"**+1 Bonus · reference pending**" (:224) — and since the stats route no longer
returns `staffAnswer`, "reference pending" shows **forever**. Meanwhile
`useCreatureQuiz` already computes real Pebbles (`rewardProgress.pebblesEarned`,
`useCreatureQuiz.ts:339`) — SnippetPlayer just never renders it. Every share
lands here. Also: its guest sign-in link omits `isSignUp=1`
(`SnippetPlayer.tsx:121`), so first-timers land on the sign-*in* form.
**Fix:** replace the challenge card with the feed's reveal stack
(`RevealResult` + `SpeciesSuggestions`); `isSignUp=1` on the guest link. Do
with the engagement plan's PR-B/C — this is the share loop's landing page.

### R2-4. The collection-unlock reward is dead code at the moment it matters
`POST /api/answers` hardcodes **`unlock: null`** (`api/answers/route.ts:154`),
so the "X added to your collection · N of 57" chip
(`RevealResult.tsx:204–210`) can **never** render at submit. Unlocks now happen
only in the consensus cron and the admin rescore — both offline and silent. The
collection is the retention centrepiece and its reward moment is unreachable.
**Fix:** restore an immediate provisional unlock for catalogue-resolvable picks
at submit, or surface unlocks on next session (with R2-6's ledger).

### R2-5. "Ask the biologist" is an undisclosed AI
`IdGuideWizard.tsx:403` "Ask the biologist"; `IdGuideTrigger.tsx:212` "Sign in
to ask the biologist"; the chat greeting says "Hi, I help identify marine
life…" (`IdGuideChat.tsx:19`) — zero occurrences of "AI"/"assistant"/
"automated" in any visible copy. It's an Anthropic-API chat. For a CIC science
product, implying a live human marine biologist is a trust liability (and
increasingly a regulatory one). **Fix:** "Ask the ID assistant" (or "our AI
field guide") + one honest greeting line.

---

## P2 — the invisible economy, resilience, terminology

### The economy the user can't see
- **R2-6. Consensus payouts produce no felt moment.** The cron credits
  potentially large sums (pioneer 30 × rarity ≤5 × Current ≤2.5) by silently
  mutating `Answer.points` (`consensus.ts:289–343`); the PebbleBag total just
  loads bigger next session, and retro `isCorrect` flips can relabel old
  answers with no narrative. **Fix:** a "since you were away" ledger — the data
  already exists in `ConsensusEvent.creditedAnswerIds`; surface a toast/inbox:
  "Your Tompot blenny call was vindicated — +45 Pebbles, Pioneer."
- **R2-7. Guests' best conversion hook is computed then discarded.** The
  preview API returns the exact Pebbles a guest would bank + First Sighting
  status (`api/answers/preview/route.ts:70–81`); the guest branch of
  `useCreatureQuiz` drops both (`useCreatureQuiz.ts:256–277`), so the reveal's
  Pebble chip never renders for guests. **Fix:** pass them through; reframe the
  signup card: "Sign up to bank +30 Pebbles · First Sighting."
- **R2-8. Streaks are UTC-only with zero in-app expiry surfacing.**
  `streak.ts:11–13,48–51` uses UTC date-keys (an 11pm/1am UK pattern can kill a
  streak); the only warning is an email behind `digestOptIn` which **defaults
  false** (`schema.prisma:19`), and the streak itself hides in the hamburger.
  **Fix:** timezone-aware or 36–48h-grace streaks + a header streak chip with an
  "expires tonight" state for streaks ≥3.
- **R2-9. Guest-queue TTL contradicts its promise.** "Sign up to keep your
  finds (N so far)" (`FeedCard.tsx:1738–1741`) vs a 24h queue TTL
  (`useCreatureQuiz.ts:22`) — sign up tomorrow evening and the finds are gone,
  silently. Extend to ~7 days or say "from the last day" honestly.

### Resilience under real conditions
- **R2-10. Installed PWA shows a raw browser error offline.** `manifest.ts`
  promises `standalone`, but `sw.js:21–27` skips `/`, `/feed`, `/api/*` etc.,
  so offline launch = chromeless browser error page; other routes get an
  unstyled `"Offline"` 503 (`sw.js:43`). **Fix:** precache a branded `/offline`
  route and serve it for failed navigations.
- **R2-11. Landing autoplays a 3.4–8 Mbps clip on first visit.**
  `HeroPreview.tsx:115–126` — `autoPlay` negates `preload="metadata"`; no
  Save-Data/`effectiveType` check; no `fetchpriority` on the likely LCP poster.
  **Fix:** `preload="none"` + start from the existing IntersectionObserver; a
  small dedicated hero rendition (~1 Mbps).
- **R2-12. Scrolled-past feed videos are never actually unloaded.** Every
  snippet mounts (`FeedPlayer.tsx:194–223`); dropping `src` without
  `video.load()` doesn't release buffers — long sessions accumulate one per
  clip visited on mid-range phones. **Fix:** `pause(); removeAttribute("src");
  load()` on preload-off, or window the list.
- **R2-13. Feed load fires N parallel `/api/answers/my` fetches** — 30
  simultaneous GETs at first paint (all 401 for guests), competing with the
  active video, while the server already computed `answeredIds` and threw it
  away (`feed/page.tsx:72–76`; `useCreatureQuiz.ts:156–189`). **Fix:** pass
  answers down as props or one batched GET.
- **R2-14. Rung-3 opens with up to 24 uncached per-species photo fetches**
  per clip, re-fetched every time; tiles pop from silhouette to photo at the
  decision moment (`CandidateGate.tsx:221–268`; same pattern in
  `SpeciesComparison`, `GroupGuide`). **Fix:** batch endpoint + module-level
  cache (57 stable species).
- **R2-15. Likelihood ranking degrades silently.** Probability-fetch failures
  are swallowed (`CandidateGate.tsx:147–171` `.catch(() => {})`) — tiles render
  in catalogue order with no "local sighting data unavailable" note and no
  retry.

### Words (full audit + glossary in the copy pass)
- **R2-16. One clip, five names.** clip / snippet / sighting / observation /
  catch — the 404 card alone uses three (`feed/[id]/not-found.tsx:13–18`), and
  DB vocabulary ("Snippets… re-encoding") + raw API strings ("Snippet not
  found", "Unauthorized") reach users verbatim (`api/answers/route.ts:63`,
  rendered at `useCreatureQuiz.ts:253/297`). **Fix:** standardise on **clip**;
  reserve **sighting** for the First Sighting bonus; map API errors to friendly
  client strings.
- **R2-17. Term drift set** (each small, together erosive): streak in four
  formats ("5 day streak" / "Streak: 5 days" / "Day 5 streak" / "5-day spotting
  streak" — standardise "5-day streak"); Archive vs "Observation Archive" vs
  three "browse the archive" casings; "The catalogue" (landing) vs "Species
  guide" (nav) vs "our local catalogue" (wizard); action verb split across
  identify/name/spot/call/log with aria/visible mismatches
  (`FeedCard.tsx:1331/1339`) — standardise the mechanic on **identify**, keep
  *spot* for brand moments; species common names Title Case for all 26 inverts
  vs sentence case for all 25 fish in `species-traits.json` (two authoring
  batches) — normalise to sentence case; streak-nudge subject ("on the line")
  vs preview text ("in danger") disagree in the same inbox row.
- **R2-18. "Consensus"/"Contested" are never taught.** The only explanation is
  a hover-only `title` tooltip (`RevealResult.tsx:140`) — invisible on touch.
  Caption the leaderboard column; put the Contested explanation in visible text.

### Staff & feedback loop
- **R2-19. No user→staff feedback channel at all.** No report/flag feature
  exists; video errors log only to the browser console (`FeedCard.tsx:988–992`).
  A clip 404ing in production is invisible to `/admin`. **Fix:** a "Something
  wrong with this clip?" flag → `Flag` table + admin queue; beacon video errors
  through the existing consent-gated `/api/events`.
- **R2-20. Admin has no path from a clip to its editor.** No `/admin` link in
  app chrome (URL must be known); `/feed/[id]` computes `admin` but offers no
  "Open in admin"; the snippet list has no search (`admin/snippets/page.tsx:54–87`).
- **R2-21. Species annotator dead-ends into CLI/JSON edits** for any species
  without a curated photo (`admin/species/[name]/page.tsx:79–108`) — not
  actionable for non-developer staff. **Fix:** an in-UI "promote to curated"
  action on cached photos.
- **R2-22. `/admin/metrics` labels consensus-agreement "accuracy"**
  (`admin/metrics/page.tsx:66–73`) — a funder will read expert ground truth
  where `isCorrect` now means "matched the community leader" and is
  cron-mutable. Relabel in dashboard + CSV export.

---

## P3 — polish

- **R2-23.** Web vitals are sampled, written to the `Vital` table… and **read
  by nothing** (zero `prisma.vital` readers). Surface p75 LCP/INP/CLS in
  `/admin/metrics` or stop paying the writes.
- **R2-24.** Double-tap race: `award` is computed pre-upsert and reported as
  earned even on the no-op update branch (`api/answers/route.ts:75–84,146`) —
  the PebbleBag can celebrate pebbles never granted. `useRef` in-flight lock +
  derive `earned` from whether the upsert created.
- **R2-25.** A *stalled* (not errored) video is a frozen poster forever — the
  skip pill triggers only on `error` (`FeedCard.tsx:988–992`). Add
  `waiting`/`stalled` + ~5s timer → "Still loading — skip for now?".
- **R2-26.** Feed TTFB pays 3 serial DB awaits (`feed/page.tsx:42–91`) —
  `Promise.all` the answers+user queries.
- **R2-27.** PebbleBag vanishes for the session on one bad response (no `r.ok`
  check, `PebbleBag.tsx:195–204`).
- **R2-28.** Nothing is "new since last visit" for a regular who cleared the
  feed (`feed-ordering.ts:29–53`) — a "N new clips" pill would make day-14
  returns feel alive. Guests also see up to 3 signup asks per clip (cap at the
  post-reveal card once warmed).
- **R2-29.** Copy polish set: rate-limit copy scolds ("Slow down a bit." →
  "You're on a roll — give it a few seconds"); "Pelagic vs demersal" in a
  disclosure that promises anatomy-free language (`IdGuideWizard.tsx:74`);
  field-note jargon outliers ("reticulated", "C. lyra"); "UK reefs" vs "Welsh
  coast" framing wobble; comma splices (`auth/signin/page.tsx:265`,
  `feed/error.tsx:40`); Rung-2 tile labels mix forms (bare "Wrasses" among
  "Cod-shaped"/"Silver swimmers"); `AvatarMenu.tsx` is orphaned — delete.
- **R2-30.** `canvas-confetti` is statically imported into the feed bundle
  (`lib/confetti.ts:1`) but only fires on correct answers — import at trigger
  time.

---

## Done well (round-2 additions — keep as reference)

- **Guest guess persistence is genuinely well built:** localStorage queue,
  drained per-card on auth (`useCreatureQuiz.ts:200–223`) — guesses survive the
  signup redirect.
- **`IdGuideChat`'s failure UX is the best in the app:** idle-timeout abort +
  explicit "guide stalled, use the manual filter" fallback. The pattern R2-2
  should copy.
- Stats-fetch fallback prevents infinite "Scoring your answer…"; SpeciesGallery
  auto-retries 5xx with a visible retry; MCQ preloads thumbnails with a 1.5s
  cap; leaflet + web-vitals are dynamically imported; segment `error.tsx` /
  `loading.tsx` exist with retry affordances.
- **Copy at its best is excellent:** SwimLoader captions, the cookie banner (a
  model consent ask), blame-free password-reset copy, "Welcome aboard. Time to
  spot some fish." — and **"spotter" is used flawlessly everywhere**; build the
  glossary around it.

---

## Sequencing (merged with round 1)

1. **P0 hotfix:** the admin rescore (R2-1) — small diff, prevents live data
   corruption. Tell staff not to save references on answered clips until then.
2. **Submit resilience (R2-2)** + **verdict line (R1-4)** — the core action
   must visibly succeed or visibly fail.
3. **Coherence pass, now bigger:** R1-1 copy/labels + the permalink rebuild
   (R2-3) + unlock restoration (R2-4) + AI disclosure (R2-5) + the terminology
   set (R2-16/17/18). One "finish shipping the Pebbles redesign" PR.
4. **The felt economy:** consensus ledger (R2-6), guest hook (R2-7), streak
   surfacing (R2-8) — this is the retention payoff of the whole redesign.
5. **Resilience batch:** offline page, landing video, video unloading, request
   batching (R2-10..15).
6. **Staff loop:** flag mechanism + admin links + annotator promote action +
   metrics relabel (R2-19..22).

Round 1's remaining items (profile reachability, contrast, nav, token sweep)
slot unchanged into 3–5.
