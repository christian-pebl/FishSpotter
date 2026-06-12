# FishSpotter — UX & Engagement Review

**Date:** 12 Jun 2026
**Scope:** How engaging and easy to use FishSpotter is as a *public* citizen-science
engagement tool. Reviewed the local `improvements-2026-06-12` branch (running) plus the
live `fish-spotter.vercel.app` deployment.
**Method:** Walked the landing page, feed, identify flow, and auth; read the core-loop
source (`FeedCard`, `useCreatureQuiz`, `/api/answers`, `StatsBand`, `OnboardingTour`,
`auth.ts`, `signin/page.tsx`). The funnel logic below is confirmed directly in code. A
couple of interaction states could not be driven in the headless preview (the feed's
IntersectionObserver / video playback don't composite in that tab), so those are
code-confirmed rather than click-confirmed.

---

## Verdict

The product is well-built and the **retention layer is genuinely strong**: scored-by-rung
Spot It, a rich reveal (verdict + community split + ecological likelihood + annotated
diagnostic photo + pokédex unlock + streak), a leaderboard, and a Monday digest. The
craft is high.

But the **acquisition funnel breaks at the single worst point.** A first-time visitor is
told "Start spotting — free, no card required," does the full work of identifying a clip
(watch → shape gate → sub-split → pick a species), and the moment they commit their first
answer they are **redirected to a sign-up form before ever seeing whether they were
right.** The reward that makes the loop addictive — the reveal — is locked behind account
creation. And the gate they hit is a full email + password + age + terms form with no
one-tap option.

**Fixing "let people play before the wall" is worth more than every other change on this
list combined.** Everything else is polish by comparison.

---

## P0 — Let people complete the loop before asking them to sign up

**The problem (confirmed in code).**
- `src/lib/useCreatureQuiz.ts:195-211`: the first thing `handleSubmit` does is
  `if (!session?.user) { …; window.location.href = "/auth/signin?…&isSignUp=1"; return; }`.
  An anonymous user is bounced to sign-up **on submit, before the reveal renders**.
- `src/app/api/answers/route.ts:37-40`: the only grading endpoint hard-requires a session
  (returns 401), so there is no anonymous path to a result at all.
- The anonymous user can navigate the *entire* Spot It flow (shape gate → tiles) because
  `openShapeGate` is dispatched regardless of session — so they invest the **most** effort
  right before the wall, then get **no** payoff. Worst-case ordering.
- This contradicts the landing promise (`src/app/page.tsx:148` "Free, no card required",
  CTA "Start spotting") and the onboarding copy ("try it"). Promise ≠ delivery.

**Why it matters for a citizen-science tool.** The peers people compare you to (iNaturalist
Seek, eBird, Zooniverse) all let you *do the thing* before committing. The reveal is the
dopamine hit and the teaching moment; gating it behind a 4-field form right after peak
effort is the textbook funnel leak. For a CIC whose mission is *accessibility*, the gate
also filters out exactly the casual public you want.

**How to implement (staged, lowest-risk first).**
1. **Add a public, read-only grade.** New `GET/POST /api/answers/preview` (or reuse the
   existing `GET /api/snippets/[id]/stats`, which already returns the community split +
   staff answer). It runs the pure `matchAnswer()` and returns `{ isCorrect, points,
   staffAnswer, stats, total }` **without writing a row** — so no `userId` needed, no
   leaderboard/consensus pollution, no anti-spam exposure (it's read-only and already
   public data).
2. **Render the real reveal for anonymous users.** In `useCreatureQuiz.handleSubmit`,
   when `!session`, call the preview path and drive the existing `RevealResult` /
   `RarityPanel` / `AnnotatedSpeciesPhoto` UI locally instead of redirecting. The reveal
   components already take plain props — they don't need a persisted answer.
3. **Soft, non-blocking sign-up ask after N reveals.** Keep a local counter
   (`localStorage fishspotter:guestReveals`). Let anonymous users complete ~3 full loops,
   then show an in-panel card: "Save your 3 finds + start a streak → Sign up" (carry the
   stashed answers in). Don't redirect; let them keep playing and convert on their terms.
4. **Carry-in on sign-up already half-exists.** `PENDING_ANSWER_KEY` (sessionStorage)
   stashes one answer and auto-submits on return (`useCreatureQuiz.ts:14-18, 64-71`).
   Extend it from one answer to the small queue of guest answers so nothing is lost.

**Effort:** ~1-1.5 days. Risk: low if preview is read-only. Anti-spam unaffected (persisted
answers still require auth + the existing rate limit). This is the highest ROI change in
the codebase.

> Product call for Christian: if you *deliberately* want a hard gate (data integrity), then
> at least make the gate honest upfront — don't say "no card required / start spotting,"
> say "create a free profile to play." But play-first will convert far better.

---

## P1 — Cut sign-up friction at the gate that remains

**The problem.** `src/app/auth/signin/page.tsx` renders **only** the email/password form.
The Google + Apple providers are fully wired in `src/lib/auth.ts:24-44` but **never
surfaced in the UI** — there is no `signIn("google")` button anywhere on the page. So the
only path a new spotter sees is: email → password (8+ chars, strength hints) → age band →
terms checkbox → "Create account." That is a lot of friction immediately after denying
them the reward.

**How to implement.**
- Add "Continue with Google" / "Continue with Apple" buttons at the top of the signin card,
  calling `signIn("google", { callbackUrl })`. They're already configured server-side; this
  is UI only. Gate each button on whether the provider is enabled (expose a small
  `enabledProviders` flag from a server component, or just render and let NextAuth 404
  gracefully if unset). **Set the Google OAuth env vars in Vercel** if not already (memory
  notes launch config was partially done).
- Keep email/password as the fallback. Net effect: one-tap for most users.

**Effort:** ~2-3 hours (plus 20 min Google Cloud OAuth setup). Risk: low.

---

## P1 — Fix the dead "0 / 0 / 0" social-proof band

**The problem (confirmed live + local).** The landing "at a glance" band renders
**0 underwater clips / 0 identifiable species / 0 spotters** to real traffic.
- `StatsBand.tsx` server-receives real counts (`clips = snippet.count()`,
  `species = 57` constant, `spotters = user.count()`) but **SSRs `0`** and only counts up
  via an `IntersectionObserver` (threshold 0.4) on scroll. The SSR/no-JS/crawler/social-card
  baseline is therefore `0/0/0` — which is exactly what the live server HTML serves and what
  a link-preview bot will show. `species` is a hardcoded 57 yet still showed 0 in my run, so
  the count-up can also simply fail to fire (it didn't in the preview).
- Showing "0 spotters" is **worse than showing nothing** — it signals a dead product on the
  first screen of a tool whose whole pitch is community.

**How to implement.**
- Make the rendered baseline the **real value**, not 0: initialise `useCountUp` state to
  `target` and treat the animation as enhancement (animate from a fraction of target → target
  on inView; if the observer never fires, the real number is already on screen). One-line
  change in `StatsBand.tsx`.
- Reconsider the **spotters** stat specifically. Until it's a number worth bragging about,
  either hide it or swap it for a faster-growing, still-true metric (e.g. "identifications
  made," "sites monitored," or "species in the catalogue"). Social proof should never reveal
  a small number.

**Effort:** ~1 hour. Risk: trivial.

---

## P2 — Onboarding reaches the wrong audience

**The problem.** `OnboardingTour` only opens for **signed-in** users
(`OnboardingTour.tsx:38` `needsTour && !!session?.user`). The 3-step "Spot / Compare /
Streak" explainer therefore never reaches the anonymous first-timer who most needs
orientation. Anonymous users get only a small one-line tap hint
(`fishspotter:tapHintSeen`). And the tour itself is a text-wall modal (three paragraphs),
not a contextual coachmark on the live card.

**How to implement.**
- After P0 ships (anonymous can play), let the first-run hint set fire for anonymous users
  too: a single contextual coachmark anchored to the identify pill ("Tap to name what you
  see — we give you the likely options"), dismiss on first interaction.
- Trim the text-wall tour to one line per step or make it show *on* a real card rather than
  as a blocking modal.

**Effort:** ~half a day. Risk: low.

---

## P2 — The in-feed identify panel is doing a lot

**Observation.** The identify surface is a floating glass panel that is **draggable**
(`dragControls`, a grip handle), **hide-able** (a "Hide"/minimise toggle + `H` shortcut),
collapses to a docked bar, and is gated behind a "Watching… tap to identify" label that
only becomes "Name this species" after the first video loop
(`FeedCard.tsx:1005-1007`, `1075-1103`). That's a rich, power-user-ish interaction model on
the single most important first-time surface.

**Why it matters.** A casual public user doesn't need drag/hide/keyboard-shortcut affordances
on their first clip; each one is a small "what is this / did I break it" moment. The
"Watching…" label also reads as *blocked* ("am I allowed yet?") when it's actually tappable.

**How to implement.**
- Default the panel to a simple fixed position for new users; reveal drag/hide only after a
  few identifications (or move them behind a settings affordance).
- Change "Watching… tap to identify" to an unambiguous action label from the start
  ("Tap to identify" / "Name this species"). The watch-first nuance isn't worth the
  "am I locked out?" ambiguity.

**Effort:** ~half a day. Risk: low-medium (touches the core card).

---

## P2 — Feed performance on mobile

**Observation.** The feed mounts **all 30 `<video>` elements at once** (confirmed:
`document.querySelectorAll('video').length === 30`). `preload` is correctly gated
(`isActive ? "auto" : metadata/none`, `FeedCard.tsx:746`), which protects bandwidth, but 30
live `<video>` nodes still pressure mobile Safari's hardware-decoder limit and memory.

**How to implement.** Windowing — only mount the active card ± 1-2 neighbours and recycle the
rest (the IntersectionObserver in `FeedPlayer` already tracks the active index, so it knows
the window). Keeps scroll snappy on low-end phones as the catalogue grows past 30.

**Effort:** ~1 day. Risk: medium (core feed); do after the funnel wins.

---

## P3 — Smaller wins / polish

- **Make the leaderboard goal visible.** Entry needs 10 identifications
  (`OnboardingTour` step 3). Show live progress ("3 / 10 to join the leaderboard") in the
  reveal or profile so the goal is legible instead of invisible.
- **Landing animation load.** The landing runs an always-on hero video + marine-pattern sway
  + drifting silhouettes + count-up; it was heavy enough to stall the headless renderer.
  Confirm it stays light on a mid-range phone (it's already reduced-motion-safe + off-screen
  paused, so this is a verify-don't-rebuild item).
- **Sentry build warnings.** Dev logs spam `'_optionalChain' is not exported from
  '@sentry/core'` on every route (`layout.tsx`, `page.tsx`, the auth route). Non-fatal, but a
  version mismatch worth resolving so it doesn't mask a real error later.
- **Soft/hard sign-in message mismatch.** The pre-submit panel says "Sign in to *save* your
  answer and streak" (`FeedCard.tsx:1231-1240`) — implying you can play without it — but the
  submit actually *blocks* on sign-in. P0 resolves this; until then the copy over-promises.

---

## What's already good (keep / protect)

- **Anonymous can reach the feed** (no signup wall to *browse/watch*) — right instinct;
  P0 just extends it to the reveal.
- **Scored-by-rung Spot It** (shape-class partial credit) is a smart, forgiving design that
  rewards "close" answers — great for beginners.
- **The reveal is genuinely rich and teaching-first**: verdict, community split, ecological
  likelihood, CC-attributed gallery, annotated diagnostic rings, pokédex unlock.
- **Retention mechanics are all present**: streaks, leaderboard, pokédex, weekly digest,
  consensus retro-bonus. The machine is built — it's just starved of activated users by P0.
- **Accessibility + legal care is high**: focus traps, 44px targets, reduced-motion paths,
  ICO Children's Code age-gating, CC attribution. Don't regress these.

---

## Suggested build sequence

1. **Quick wins (½ day total):** StatsBand SSR baseline (P1), surface OAuth buttons (P1).
2. **The big one (~1-1.5 days):** anonymous play-before-wall (P0) + soft sign-up ask + carry-in.
3. **Onboarding for anonymous (P2)** once P0 lands.
4. **Identify-panel simplification + "Watching…" label (P2).**
5. **Feed windowing (P2)** and the P3 polish as capacity allows.
