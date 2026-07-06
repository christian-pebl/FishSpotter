# FishSpotter — whole-app UI/UX review (2026-07-03)

A fresh end-to-end UI/UX review of the app: the core feed→ID→reveal loop, the
information architecture, every secondary page, and cross-cutting accessibility
/ responsive / design-token consistency. Grounded in a read of the actual code
across three parallel review passes, deduped and re-prioritised here.

**Relationship to the 2 Jun audit.** The [2 Jun design audit](../2026-06-02/design-audit.md)
was a *visual-polish* sweep and its backlog is closed (glyph-icons, radius/token
drift, touch targets, the one P1 modal-focus gap). This review goes a layer
deeper — into **product flow, IA, and the surfaces added since** (Pebbles,
consensus, community answers, the Spot-It gates) — so it is mostly new findings,
not a re-run. Where old drift has re-accumulated it's flagged as P3.

> **Method note / limitation.** This is a code-based review. I set up a
> headless-Chromium screenshot pass of the live site, but the environment's
> egress policy blocks `*.vercel.app` (proxy 403), so a rendered visual pass
> wasn't possible from here. The screenshot harness is saved at
> `scratchpad/shots.js` — run it locally (`localhost:3000`) to add the visual
> layer; every finding below cites `file:line` so it's checkable without it.

---

## Headline

FishSpotter is a mature, thoughtfully-built product with a genuinely good
guided-ID idea. The single most important finding is not any one bug — it's that
**the 18 June "Pebbles / crowd-is-the-authority" redesign was only half-shipped**.
The scoring core changed; the surfaces around it didn't. As a result the app now
speaks two contradictory languages in one session, and the places a new or
shared-link user lands first are exactly the ones still stuck in the old model.

Fixing that coherence debt (§1) plus three structural gaps — the degraded
shared permalink (§2), the orphaned profile/collection (§3), and the wordless
reveal (§4) — would lift the whole experience more than any amount of polish.
Two of these directly reinforce the engagement strategy in this same folder: a
degraded permalink undercuts the share loop, and an unreachable collection
undercuts retention.

---

## P1 — fix first (coherence, core-loop dead-ends, an AA failure)

### 1. The Pebbles/consensus redesign is only half-shipped — the app contradicts itself
The 18 Jun migration made the crowd the authority and renamed the currency to
**Pebbles**, but four high-traffic surfaces still teach or show the retired
staff-reference model:
- **Onboarding** (`OnboardingTour.tsx`) still says *"Compare with the reference
  ID (when available)"*, *"Clips without a reference are worth more"*, *"Submit
  10 identifications to enter the leaderboard"* — the first thing a signed-in
  user reads sets up a "did I match the official answer?" model the reveal never
  delivers.
- **Profile** (`u/[id]/page.tsx:136`) labels the Pebbles total *"Score"*.
- **Landing** (`landing/StepCards.tsx`) describes the old reference/"correct" loop.
- **Leaderboard** (`leaderboard/page.tsx`) shows a cryptic *"Consensus 5/12"*
  column with no legend.

One currency appears under three names (Pebbles / Score / points) and the
scoring story is told two incompatible ways. **Fix:** standardise on "Pebbles"
everywhere; rewrite onboarding + StepCards to Spot-the-shape → Pebbles /
First-Sighting → community-consensus + streak; give the leaderboard column a
legible name + one-line legend. This is a copy/label pass, not an architecture
change — cheap, high-impact.

### 2. The shared permalink `/feed/[id]` is a degraded, blank-text-box experience
`SnippetPlayer.tsx` renders a plain `<video controls>` + a bare "Type species
name" input — **none** of the Spot-It shape gate, photo-tile candidates,
`SpeciesSuggestions`, or reward surfacing the feed spent thousands of lines
building. This is the page users land on **from a shared link or the archive** —
often a *first* impression, and the exact destination the engagement plan's
share loop drives traffic to. A beginner who can't name the species is handed a
blank box — the wall the feed was redesigned to remove. **Fix:** reuse
`FeedCard` (or extract the shared ID surface) on the permalink; at minimum add
`SpeciesSuggestions` under the input. *(Directly gates the share strategy —
worth doing alongside PR-B/PR-C of the engagement plan.)*

### 3. Your own profile / collection is orphaned — newcomers can't reach it at all
The profile holds the most motivating content in the product (the species
"pokédex" collection, streak, score, accuracy), yet nothing a normal user finds
links to it. The `SideMenu` nav is Feed / Archive / Species / Leaderboard with
**no "My profile"**; the drawer's account-name block (`SideMenu.tsx`) is a plain
`<div>`, not a link; `/account` doesn't link to it either. The only ways in are
clicking your own name on the leaderboard (which requires 10 IDs to appear) or
the admin `SnippetAnswers` panel. So a user with <10 IDs — every newcomer, the
group you most want to hook — **cannot see their own collection during the
critical first session**. **Fix:** make the drawer account block a link to
`/u/{session.user.id}`, add a session-gated "My profile" nav item, and a "View
your profile" card on `/account`.

### 4. The reveal never says, in words, whether you were right
`RevealResult.tsx` leads with the Pebbles chip and the community histogram; the
correct / partial / wrong verdict is conveyed only implicitly — confetti, a
shake keyframe, a border pulse. There's no headline like *"Correct — Ballan
wrasse"* or *"Not quite."* The one thing a quiz player wants first is the one
thing not spelled out, and reduced-motion users lose even the implicit cues.
**Fix:** add a clear, tokenised verdict line (`correct`/`pending`/`incorrect`)
at the top of the reveal, above Pebbles and the histogram.

### 5. Low-contrast text fails WCAG AA across the Spot-It flow
`text-white/35–/45` over `navy-900` ≈ 2.3–2.9:1 — below the 4.5:1 AA floor for
body text (WCAG 1.4.3). Not just chrome: it includes the reveal's CTA copy
(*"Be the first to call this one"*, `RevealResult.tsx:151,191`) and comparison
probabilities (`CandidateStrip.tsx:222–349`, `SpeciesComparison.tsx:266,307`,
`GroupGuide.tsx:169`, `SpeciesGallery.tsx:276,603,637`, `MCQCandidatePicker.tsx:222`,
`TileGate.tsx:436`). **Fix:** raise informational text to `text-white/70`
minimum (≈4.7:1); if a muted token is wanted, add one to `tailwind.config.ts` at
an AA-passing alpha rather than scattering `/40`.

---

## P2 — meaningful friction / documented-rule breaches

### Core loop
6. **Tapping a candidate tile opens a popup instead of picking it.**
   `CandidateGate` says "Tap to compare"; a tile tap opens `SpeciesGuidePopup`
   and the guess only commits on a second "This is my pick" button — breaking the
   direct-manipulation expectation of a photo grid and covering the clip being
   compared. **Fix:** tile tap = select+commit (reuse `TileGate`'s lock-in
   animation); move "compare details" to a per-tile 'i' affordance.
7. **"Skip to guess" hands the stuck beginner a blind type-a-name box.**
   `skipToMcq` → a text input (`FeedCard.tsx:~1462`); the "Pick from a list"
   fallback actually demands the user already know and type the species — the one
   user who skips is the one who can't. **Fix:** make the fallback an OBIS-ranked
   pickable photo/name list, free-text as a tertiary "not in the list" row.
8. **The consensus / rarity / Current economy is invisible.** The reveal shows
   "+5 Pebbles" with no "why", and the big retro payout (consensus × rarity ×
   Current, `lib/consensus.ts`) is credited later by cron with **no user-facing
   notification** — players can't learn or anticipate the scoring meant to drive
   return visits, and a vindicated pioneer never sees it. **Fix:** a tap-to-expand
   "why" on the Pebble chip; a "your call was confirmed by the community: +X"
   surface on return (feed banner / profile).
9. **Two overlapping "guided ID" systems + orphaned code.** Pre-submit Spot-It
   (`ShapeGate→BodyShapeGate→CandidateGate`) vs the post-submit trait wizard
   (`IdGuideSheet`/`IdGuideWizard`), with `CandidateStrip.tsx` + `trait-questions.ts`
   imported nowhere. Entry points are labelled variously "Identify" / "Tap to
   name" / "Spot It" / "Help me identify." **Fix:** one verb everywhere; delete
   the orphaned strip or fold its information-gain cut into `CandidateGate`.

### IA / navigation
10. **No persistent navigation — one hamburger on every breakpoint.**
    `Header.tsx` is menu-button + faint logo + PebbleBag, even on desktop; no
    horizontal nav, active-page marker visible only while the drawer is open.
    **Fix:** add a persistent `md:`+ horizontal nav (Feed / Archive / Species /
    Leaderboard) with active state; keep the drawer for mobile; the feed can
    keep its transparent overlay.
11. **The Species guide is nearly undiscoverable.** The landing's "catalogue"
    marquee links to the *archive*, not `/species`; the richest educational
    surface is reachable only via the hamburger. **Fix:** point the catalogue CTA
    at `/species` and add it to the hero's secondary link row.
12. **Leaderboard "Consensus" column is unexplained and mobile-hidden** yet the
    rank card prints "5/12 consensus" on mobile with no context
    (`leaderboard/page.tsx:217–325`). **Fix:** legend + compact mobile treatment
    (or drop it from the mobile card).
13. **Onboarding misses the largest cohort and is text-only.** The landing CTA
    sends visitors to `/feed` anonymously, but the tour only fires for signed-in
    un-onboarded users — anonymous first-timers get no orientation. **Fix:** a
    lightweight first-clip coach-mark for anonymous users; refresh copy (§1); add
    a visual to slide 1.

### Token/colour breaches (documented rules)
14. **Error text uses stock `text-red-*` instead of the `danger` token** — and
    the app is split: `auth/forgot`, `auth/reset`, `account`, admin already use
    the token, but `SnippetPlayer.tsx:102`, `MCQCandidatePicker.tsx:159`,
    `FeedCard.tsx:1448`, `IdGuideChat.tsx:255`, `auth/signin/page.tsx:185–286`,
    admin snippet editors still use raw red. **Fix:** `text-danger` /
    `text-danger-onDark`.
15. **Stray stock utilities:** `FeedPlayer.tsx:212` `bg-slate-900` (→ `navy-900`);
    `IdGuideSheet.tsx:420` `text-amber-200` (no palette token); leaderboard medal
    rows use stock `amber-*`/`zinc-*` (`leaderboard/page.tsx:232–244`) — add
    `medal-gold/silver/bronze` tokens so ranks can't drift.
16. **Tap target under 44px:** `VideoSettingsPanel.tsx:46` speed pills are
    `min-h-[40px]` (the rest of the panel is correct). **Fix:** `min-h-[44px]`.

### Cross-page consistency
17. **Chrome differs across secondary pages.** Species pages lack `MarineBackdrop`
    and use an inline back-link + different max-width; `feed/browse` has **no**
    back affordance at all, while leaderboard/account/profile/browse use the
    shared `<BackToFeed>`. **Fix:** one backdrop, one `<BackToFeed>`, one content
    width.

---

## P3 — polish / lower impact

18. **Reveal is a very tall, noisy mobile scroll** (Pebbles chip, histogram,
    Contested badge, unlock chip, streak chip, guest card, annotated photo,
    gallery, credit, ID trigger, "Where is this?", Edit/Archive, Next inside a
    `max-h-62vh` scroll). Tier it: verdict + Pebbles + histogram above the fold;
    collapse teaching content behind a "See how to spot it" disclosure.
19. **Tapping the playing video opens the ID flow instead of pausing** (full-bleed
    catcher dispatches `openShapeGate`) — breaks the universal tap=play/pause
    convention. Reserve an explicit "Identify" affordance or pause-first.
20. **Radius drift (re-accumulated since June):** `SpeciesGallery.tsx` (7×
    `rounded-xl/lg`, the largest single-file drift), `SettingsMenu.tsx` (3),
    `AnnotatedSpeciesPhoto.tsx` (1), `admin/snippets/*` (4). → `rounded-modal`/`card`.
21. **Guests are asked to sign up twice per clip** (pre-submit line + reveal
    card). Once is enough.
22. **Focus-management divergence:** `IdGuideSheet`, `SideMenu`, `SpeciesGallery`
    hand-roll focus traps instead of the shared `useModalFocus`; `SettingsMenu`
    declares `role="dialog"` with no focus management (use `role="menu"` or wire
    the hook); `SpeciesGallery` InfoPopover + `AvatarMenu` don't trap Tab.
    Maintainability + minor keyboard leaks, not live blockers.
23. **Feed page has no `<h1>`** — add an `sr-only` heading for landmark nav.
24. **`CookieBanner` never receives focus / isn't announced** — add `aria-live`
    or `role="dialog"` + initial focus so keyboard/SR users discover the choice.
25. **Inline motion durations bypass `lib/motion.ts`** at `FeedPlayer.tsx:238`
    (also unguarded by `useReducedMotion` — framer JS isn't covered by the global
    CSS reduced-motion block), `SnippetPlayer.tsx:153`, `UnlockTile.tsx:135`,
    `TileGate.tsx:413`. Use `DURATION`/`TRANSITION` + a reduced-motion guard.
26. **Browse filters don't auto-apply** and hide the result count
    (`feed/browse/page.tsx`) — auto-submit on select change; show "N clips" by the
    controls.
27. **PEBL brand is nearly invisible in-app** — the header logo is `opacity-30`,
    `alt=""`, aria-hidden (`Header.tsx:73–77`). Given the brand-bridge goal in the
    engagement strategy, the wordmark deserves real presence somewhere persistent.

---

## Done well (verified, keep)
- Shared `useModalFocus` hook exists; `inert` correctly applied to inactive feed
  cards + the TileGate popup host (React-18.3 `{inert:""}` spread); skip-link
  present (`layout.tsx:91`); global reduced-motion block; safe-area insets; **no
  banned emoji-as-icons survive**; reveal verdict *pills* use the
  `correct/incorrect/pending` tokens.
- Sign-in error copy is actionable and context-aware; live password-strength
  checklist; ICO-compliant age gate.
- Cookie banner offers a real Essential-only / Accept choice — no dark pattern.
- Collection sorts unlocked-first ("opens on progress, not a wall"); species
  detail loops back to "Spot it in the feed"; leaderboard "N more to qualify"
  nudge is the right pattern.
- `pebl-button-*` bake in `min-h-[44px]`, so the visually-small `text-xs`
  buttons still meet the touch target (checked — not a violation).

---

## Suggested sequencing
1. **Coherence pass (§1):** copy/labels only — onboarding, StepCards, profile
   "Score"→"Pebbles", leaderboard column legend. Highest impact per effort.
2. **Permalink parity (§2)** — reuse the feed ID surface on `/feed/[id]`; do it
   with the engagement plan's share-card work (PR-B/C) since sharing lands here.
3. **Profile reachability (§3)** + **verdict line (§4)** + **contrast (§5)** —
   small, self-contained, each fixes a real gap.
4. **Structural P2s:** persistent nav (§10), tile-tap-to-commit (§6), the
   stuck-beginner fallback (§7), consensus visibility (§8).
5. **Token sweep** (§14–16, §20) — opportunistic per the standing convention;
   `SpeciesGallery` + `admin/*` hold most of it.

The a11y contrast fix (§5) and the error-colour token unification (§14) touch
the most surfaces for the least code and are the clearest documented-rule
breaches — good first commits for a polish PR.
