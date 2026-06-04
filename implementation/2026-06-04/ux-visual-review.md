# FishSpotter — Whole-App UX & Visual Review

**Date:** 2026-06-04
**Method:** Exhaustive multi-agent review (20 finders across 14 surfaces + 6 cross-cutting lenses; 2 adversarial verifiers per finding; completeness critic + top-ups; synthesis). 336 agents, ~14M tokens across two passes.
**Pinned to commit:** `aab20a7`.
**Lenses:** L1 simplicity, L2 layout integrity, L3 spacing, L4 readability, L5 flow, L6 accessibility (WCAG 2.2 AA + ICO), L7 brand/token, L8 motion, L9 microcopy. **Personas:** P1 novice, P2 daily-driver, P3 anon, P4 keyboard, P5 screen-reader, P6 low-vision/colourblind, P7 motor, P8 motion-sensitive, P9 13-17 teen, P10 one-handed mobile.
**Result:** 41 verified findings, deduped to 21 themes. Originally scored 1 Blocker / 5 P1 / 12 P2 / 3 P3; **a live verification pass (2026-06-04) downgraded the sole "Blocker" (T1) to P1 and fixed it**, so the standing count is **0 Blocker / 6 P1 (1 fixed) / 12 P2 / 3 P3**.

> **Important coverage caveat (read first):** the find/verify pass was a **source-read review** (the bulk live-screenshot pass was abandoned because the concurrent agent run saturated CPU). So most reflow / overlap / contrast claims rest on **code structure + content length + opacity math**, not rendered screenshots. A **targeted live pass at 390px on 2026-06-04 corrected T1**: the legal content actually scrolls in Chromium, so it is not the universal Blocker the source-read agents inferred (it is an iOS-Safari-specific clip, now fixed). A fuller **live pass at 390 / 768 / 1440 + a contrast-tool sweep** is still recommended to confirm T8 (dark-panel contrast) and the remaining layout themes empirically. Everything else is grounded in exact `file:line` evidence.

---

## Executive summary

FishSpotter's **core spotting loop is well-built and largely intuitive**: the feed, the reveal-in-place verdict, the shape-gate ID flow, and the reduced-motion architecture are genuinely strong, and the **worst defects from prior reviews remain fixed** (reveal visibility, off-screen-card `inert`, modal focus traps on MapModal/IdGuideSheet, the landing CTA hierarchy, the verdict tokens, the motion-constant + vestibular work). It is mostly simple and readable on the primary surfaces.

But it is **not uniformly suitable for all abilities**. After live verification, there is **no universal Blocker**, but two themes still matter most:

- The **suspected Blocker (T1) was corrected and fixed.** The statutory legal / accessibility `<main>` had no bounded scroll container (no `min-h-0`/`overflow-y-auto`) inside the `overflow-hidden` body. On Chromium the html element absorbs the overflow so the page scrolls, but on **iOS Safari** (where `body overflow-hidden` suppresses html scroll) this clips statutory content. Now fixed by making `main` own a bounded scroll container; note `/u/[id]` profile shares the identical latent structure.
- The **biggest systemic theme is touch-target debt**: sub-44px controls recur across at least seven surfaces, **flagged in three prior reviews and still open** (including the literal 27 May "Hide" pill).

Other recurring themes: the **admin annotator is keyboard-inaccessible** (drag-only, WCAG 2.1.1 + 2.5.7); **token/glyph drift the 2 Jun sweep missed** (Unicode dingbats + stock palettes on five surfaces); **low-opacity white text below AA** on dark panels; and **onboarding + the landing marquee miss focus/pause contracts the codebase already ships elsewhere**. Flow gaps (anon mid-ID bounce lands on sign-in not sign-up, no post-signup verification prompt, hamburger-only nav, a dead Spot-It "narrowing engine") round it out.

**Verdict: a polished product that needs a disciplined accessibility-and-token cleanup pass, not a redesign.**

---

## Severity legend
**Blocker** = broken / WCAG A-AA fail on a primary surface · **P1** = notable UX/flow/a11y · **P2** = visible polish · **P3** = nit. **Effort:** S (<2h) · M (2-4h) · L (4-8h). **pastStatus:** new · still-open · regressed · partial.

---

## P1 (was Blocker — corrected + fixed by live pass)

### T1 · Legal / accessibility long-form pages clip on iOS Safari (no bounded scroll container) — `S` · new · ✅ FIXED 2026-06-04
**Lenses L2/L6/L5 · /terms, /privacy, /accessibility.** `LegalLayout` rendered `<main>` as a `flex-1 flex flex-col` child with **neither `min-h-0` nor `overflow-y-auto`** inside the `h-[100dvh] overflow-hidden` body. **Live correction (390px, Chromium):** the content (`scrollHeight 8998px` in an `881px` viewport) is in fact *reachable* — the html element absorbs the overflow and `window.scrollTo` reaches `scrollY 8178` with the last element visible. So the source-read "unreachable on all mobile" inference was **overstated**: this is not a universal Blocker. **However**, on iOS Safari `body overflow-hidden` does suppress html-level scroll, and `main` has no internal scroller, so statutory content genuinely clips there. Profile (`/u/[id]:85-89`) shares the identical structure (same latent risk). Reclassified P1 (statutory content, mobile-Safari-specific) rather than Blocker.
- Evidence: `LegalLayout.tsx:17-21` (no `min-h-0`/`overflow-y-auto`); `app/layout.tsx:51` (body `h-[100dvh] overflow-hidden`) + `:56` (children wrapper is correctly `flex-1 min-h-0`); live DOM probe 2026-06-04.
- **Fix applied:** added `min-h-0 overflow-y-auto` to the `LegalLayout` `<main>` so it owns a bounded scroll container (robust on iOS Safari, and the `#main` skip-link target is now the scroller). Verified live: `main` overflow-y `auto`, `clientH 783`, `scrollH 8998`, reaches bottom within `main`. **Follow-up (not yet done):** apply the same one-liner to `/u/[id]` profile, which shares the structure.

---

## P1

### T2 · Recurring sub-44px touch targets across 7 surfaces — `M` · still-open (3rd review) · 🟡 MOSTLY FIXED 2026-06-04
**Fixed 2026-06-04:** `pebl-button-secondary` now bakes in `min-h-[44px]` + inline-flex centring (clears the onboarding Skip, cookie "Read policy", and all secondary buttons at once); the FeedCard "Hide" pill (B12) got a transparent `before:-inset` 44px hit area; idflow TileGate Back/Hide and SpeciesGuidePopup "Back" went `min-h-[40px]`→`44px`. **Residual:** the IdGuideWizard inline "More/Less" disclosure + skip targets (inline-flow, bundle with the T7 glyph at `:140`).

**L6/L2 · OnboardingTour, FeedCard reveal, idflow TileGate, IdGuideWizard, CookieBanner, SpeciesGuidePopup.** The 44px minimum (project rule + WCAG 2.5.8) is missed on many secondary/escape/chrome controls. `pebl-button-secondary` has **no `min-h` baked in** (unlike primary), so the tour Skip and cookie button land at ~28px. The feed "Hide" pill is 32px (**this exact control was 27 May's B12, still unfixed**); reveal "Edit answer"/"Archive"/"Where is this?" links are ≤36px; idflow gate Back/Hide are 40px; the wizard skip, More/Less disclosure, and footer links are ≤36px.
- Evidence: `globals.css:107-119` (secondary, no `min-h`) vs `:95` (primary has it); `OnboardingTour.tsx:86`; `CookieBanner.tsx:56-61`; `FeedCard.tsx:1101` (Hide `h-8`), `:1481`, `:1493/:1503`; `TileGate.tsx:394,409`; `IdGuideWizard.tsx:139,251,388`.
- Fix: add `min-h-[44px]` to `pebl-button-secondary` (fixes tour + cookie at once); raise FeedCard Hide to `h-11`; bump idflow/wizard chrome using the transparent-44px-hit-area pattern already shipped at `TileGate.tsx:527-535`.

### T3 · Admin annotator: marks unplaceable without dragging — `L` · new
**L6/L2 · /admin/species/[name].** Mark geometry is exposed only through pointer events (create `onPointerDown`, move/resize via `setPointerCapture` drag loops, resize via a ~16-20px SVG handle). No `onKeyDown`, `tabIndex`, arrow-nudge, or X/Y/radius spinner, so a keyboard-only (2.1.1) or no-drag motor-impaired (2.5.7) user **cannot author marks at all**. Rings expose no name/role/value and signal selection by near-identical teal stroke only (colour-only). Server actions already clamp coords, so the fix is client-side. Internal staff tool, hence P1 not Blocker.
- Evidence: `SpeciesAnnotator.tsx:307,350,376` (pointer-only); `:119-167` (drag loops sole path); `:367-378` (~16-20px handle); `:341-352` (bare `<g>/<circle>`, selection by stroke colour).
- Fix: add X/Y/radius number spinners to the Edit panel (satisfies 2.1.1 + 2.5.7 together), make the canvas focusable with arrow-key nudge, add an `aria-live` "Mark N at x%, y%, r z%" status, mark the decorative SVG `aria-hidden`, give the selected ring a dashed (non-colour) cue.

### T4 · Onboarding + marquee miss focus/pause contracts the app already ships — `M` · new
**L6/L8 · OnboardingTour, SpeciesMarquee.** The first-run tour declares `role=dialog aria-modal=true` but does **zero focus management** (no initial focus, Tab trap, Escape, scroll-lock, or background `inert`) despite `useModalFocus` existing and being applied to MapModal + SpeciesGuidePopup; a keyboard user can Tab onto the live feed behind it. Separately the landing `SpeciesMarquee` auto-scrolls infinitely and only pauses on hover/focus-within, but its figures hold no focusable children, so **touch/keyboard/motion-sensitive users cannot pause it** (WCAG 2.2.2 Level A requires an in-content pause independent of the OS reduced-motion setting).
- Evidence: `OnboardingTour.tsx:59-65`; `useModalFocus.ts` (the contract); `SpeciesMarquee.tsx:56-65`; `globals.css:349-351` (pause on hover/focus only).
- Fix: apply `useModalFocus` + `inert` to OnboardingTour (mirror MapModal); add a visible ≥44px pause/play toggle to the marquee, or start it paused.

### T5 · Anon mid-ID bounce lands on sign-IN; no post-signup verification prompt — `M` · new · 🟡 PARTIAL 2026-06-04
**Fixed 2026-06-04:** the mid-ID bounce (`useCreatureQuiz.ts:205`) now appends `&isSignUp=1`, so a brand-new spotter lands on the sign-up form (the page has a toggle for returning users who signed out). **Residual:** the post-signup "check your inbox" verification banner is still not shown.
**L5/L9 · /auth/signin, useCreatureQuiz, /feed.** A brand-new anon user who submits their first ID is bounced to `/auth/signin` **with no `isSignUp=1`**, so they see a password sign-in form for an account they do not have. Separately, the verification email is fire-and-forget and the user is pushed straight to `/feed` with **no "check your inbox" prompt**, while both re-engagement crons silently exclude unverified users. (Note: the landing "Start spotting" → `/feed` is intentional anon-first design and should **not** be rerouted to a sign-up wall.)
- Evidence: `useCreatureQuiz.ts:205` + `FeedCard.tsx:1238` (bounce, no `isSignUp`); `signin/page.tsx:26,222`; `auth.ts:103` (fire-and-forget) + `signin/page.tsx:75`; `cron/digest/route.ts:44` + `streak-nudge/route.ts:43` (exclude unverified).
- Fix: append `&isSignUp=1` to the mid-ID bounce; after sign-up show a dismissible feed banner "We have emailed you a link to verify your account" with a resend affordance (the route exists). Do not hard-gate `/feed`.

### T6 · Spot-It Rung 3 dumps 24 tiles with no "None look right"; the narrowing engine is dead code — `M` · new
**L5/L1 · idflow CandidateGate.** Rung 3 caps at 24 tiles and passes **no `notSure`** prop (unlike Rung 1/2). A novice who picks "fish" then skips the Rung-2 form lands on up to 24 near-identical thumbnails with no in-context "none of these" cut, the opposite of the stated narrow-to-3 goal. The only escape is a footer "Pick from a list" to the MCQ (another long list). Related: the adaptive yes/no narrowing loop the spec called "the engagement engine" is now **orphaned dead code** (CandidateStrip + trait-questions, imported nowhere), and CLAUDE.md still claims it is live.
- Evidence: `CandidateGate.tsx:43` (MAX 24), `:184` (no `notSure`); `ShapeGate.tsx:173` + `BodyShapeGate.tsx:106` (siblings pass it); `CandidateStrip.tsx:1-22` + `trait-questions.ts:4-7` (ORPHANED); `CLAUDE.md:389` (stale claim).
- Fix: add a "None look right" affordance routing to the MCQ or one discriminating cut; reintroduce one information-gain trait cut before rendering >~8 tiles. Either delete the orphan trio or wire one cut back in, and fix `CLAUDE.md:389`.

---

## P2

### T7 · Token/glyph drift the 2 Jun sweep missed — `M` · still-open (partial)
**L7/L6 · IdGuideChat, /account, /auth/signin, RarityPanel, /leaderboard.** Unicode dingbats persist as the chat typing indicator (`●●●`), the account "Email sent"/"Saved" states, and the sign-up password meter; stock palettes persist for the chat error chip (`red-400`), the RarityPanel rare badge (`amber-300`), and the leaderboard medal tints (`amber/zinc/orange`). **All carry redundant non-colour cues, so these are brand-consistency, not colourblind failures.** Evidence: `IdGuideChat.tsx:299-301,233`; `AccountClient.tsx:123,163`; `signin/page.tsx:153,156,159`; `RarityPanel.tsx:153` + `tailwind.config.ts:66-68` (no rarity token); `leaderboard/page.tsx:230-260`.
- Fix: swap dingbats for the stroked-SVG icons (`u/[id]/page.tsx:160-162` is the reference); chat error → `danger` token + warning SVG; add a **dedicated rarity token** (not the verdict tokens) and named medal tokens, preserving contrast so it is a pure rename.

### T8 · Low-opacity white text below AA on dark panels — `S` · still-open (partial)
**L4/L6 · FeedCard reveal, RarityPanel, TileGate, CandidateStrip.** The 2 Jun audit lifted `white/35→/60` but did not finish: community-stat percentages and RarityPanel meta use `white/40-60` at 9-11px on a `navy-900/95` (not fully opaque) panel, so a bright seabed bleeds through; the `white/40` no-data notice clearly fails. In the idflow gates the resting "Not sure" escape and inactive crumbs use `white/45` (~3:1), and "Not sure" is the murky-safe path for exactly the uncertain/low-vision user. (Bars are exempt: each has an adjacent % label.) Evidence: `FeedCard.tsx:1416` on `:1074` `bg-navy-900/95`; `RarityPanel.tsx:92,119,122,174`; `TileGate.tsx:441,468`; `CandidateStrip.tsx:222,230`.
- Fix: lift secondary small text to ≥`white/70`, raise the "Not sure" resting state, and make the feed panel fully opaque `navy-900` to remove video-bleed variability.

### T9 · Banned `rounded-xl` on wizard cards + catalogue browser — `S` · still-open
**L7 · IdGuideWizard, IdGuideSheet CatalogueBrowser.** `rounded-xl` (12px, not a PEBL token) on wizard options/skip/details and the catalogue search input + result rows; policy is card/modal/full. Sibling IdGuideChat already uses `rounded-modal`. Evidence: `IdGuideWizard.tsx:240,251,313`; `IdGuideSheet.tsx:383,394`; `tailwind.config.ts:71-74`. Fix: `rounded-xl` → `rounded-modal`.

### T10 · Hamburger-only nav, no bottom bar, no in-page back, no always-visible active-route cue — `L` · still-open (P17)
**L5/L1 · Header, SideMenu, leaderboard, account.** All primary nav is behind one top-left hamburger (worst right-thumb zone), avatar top-right (also outside the arc), no bottom tab bar. Secondary pages carry zero in-page back-to-feed link, so the only return path is the drawer (invisible in installed PWA). Active-route state lives only inside the closed drawer. Not broken (recognised pattern, 44px targets), so ergonomic polish for one-handed mobile. Evidence: `Header.tsx:34-57`; `AvatarMenu.tsx:69`; no `BottomNav` component; `leaderboard/page.tsx:177-198` + `account/page.tsx:33-48`; `SideMenu.tsx:233-247`.
- Fix: a persistent mobile bottom tab bar (Feed/Archive/Leaderboard/Account) with `aria-current`; cheap interim: a "Back to feed" link under each secondary page's eyebrow.

### T11 · Header logo navigates off-site behind a `window.confirm` — `S` · new
**L9/L5 · Header.** The masthead logo links to pebl-cic.co.uk (`target=_blank`) behind a native `window.confirm`, breaking the logo=home convention; app-home is buried in the drawer. Evidence: `Header.tsx:61-84`; `SideMenu.tsx:162`. Fix: point the logo to `/`; move the outbound link to the drawer footer; drop the confirm.

### T12 · Verify-link expired/error states dead-end signed-out users — `M` · new
**L5 · /auth/verify.** Expired/missing-token states route to `/account`, which hard-redirects session-less visitors to `/auth/signin` (no resend affordance); the generic-error branch offers no link at all. Evidence: `VerifyClient.tsx:60-65,69-78`; `verify/page.tsx:29`; `account/page.tsx`; `signin/page.tsx:216-231`. Fix: a signed-out-friendly resend page (wrap `/api/auth/verify-request`); give the error branch a "Back to sign in" link.

### T13 · Legal docs: draft banner, overclaimed conformance, wrong company number, no wayfinding — `M` · new
**L9/L1 · /accessibility, /privacy, /terms.** ⚠️ **Company-number claim was a FALSE POSITIVE** (verified 2026-06-04): the repo uses **12076622** consistently (legal docs, landing, email, DPIA/LIA) and that IS canonical per the project record; there is no `12082722` anywhere. No change made. The "overclaim" finding is also weak: the statement scopes its keyboard claim to *user-facing* surfaces (the only sub-44px gap, the admin annotator, is staff-only) and already carries an honest "Known gaps" section with a "Last updated" date. The genuine residual is **wayfinding**: the three pages had no back-link. Evidence: `accessibility-statement.md:3,36-39`; `LegalLayout.tsx`. **Fixed 2026-06-04:** added a "Back to FishSpotter" link to `LegalLayout` (covers all three pages). The "v0.1 engineering draft" banner is a content/legal call left for the owner.

### T14 · OnboardingTour progress is colour-only, no step-of-N for SR — `S` · new
**L6 · OnboardingTour.** Three progress pips in an `aria-hidden` container differ only by background colour at identical size; the dialog `aria-label` has no step indication. Evidence: `OnboardingTour.tsx:71-81,63`. Fix: visually-hidden "Step {n} of {N}" + a non-colour cue on the active pip.

### T15 · Reveal panel capped at 50vh buries the Next CTA below an internal scroll (mobile) — `M` · new
**L2/L5 · FeedCard reveal (mobile).** The bottom-docked reveal is capped at `max-h-[min(50vh,...)]` (~422px); the reveal stack (verdict, 4 bars, RarityPanel, annotated photo, gallery, trigger, edit/archive/next, end-card) exceeds it, so the canonical "Next" advance sits at the bottom of an internal scroll. The verdict shows in-place (B4 holds) and Next is 44px, but continuing the loop requires discovering a scroll. Evidence: `FeedCard.tsx:1074,1108,1334-1535,1507`. Fix: full docked height on mobile, or pin the edit/archive/next row as a sticky footer inside the scroll.

### T16 · Chat LLM channel has no off-topic/safety deflection rule for under-18s — `S` · new
**L6/L9 · IdGuideChat.** The open free-text channel's `HARD_RULES` constrain only species output, with no instruction to refuse/redirect non-marine, unsafe, or personal input, and no age gate. For a service likely accessed by under-18s, ICO expects explicit scope/safety framing on an LLM channel. Evidence: `idguide/prompt.ts:17-24`; `IdGuideChat.tsx:245-263`; chat route (login + rate-limit + length cap, no safety rule). Fix: add a HARD_RULE deflecting off-topic/unsafe/personal input; a one-line scope notice near the textarea; confirm min-age vs chat availability with a policy owner.

### T17 · Wizard jargon + high reading-age copy undercut the novice/teen audience — `M` · still-open (partial)
**L9/L1 · IdGuideWizard.** An always-visible option label reads "An eye-spot (ocellus)" (Latin on the recognition surface); whyHint disclosures use unglossed terms ("a gadoid signature", "what fisheries scientists actually look for"), contradicting the component's stated everyday-vocabulary intent. Evidence: `IdGuideWizard.tsx:93,62-63,89,17-18`. Fix: drop "(ocellus)"; replace "gadoid signature" with plain wording; aim whyHints at ~reading age 12.

### T18 · Admin annotator small targets + invalid button-in-button — `S` · new
**L2/L6 · SpeciesAnnotator.** Resize handle renders ~16-20px; sidebar reorder arrows ~18-20px tall and are **nested inside a parent button** (invalid HTML). Evidence: `SpeciesAnnotator.tsx:367-378,423-450` (nested in `:414`). Fix: enlarge the resize hit area, pad reorder buttons to 44×44, fix the nested-button structure. Bundle with T3.

---

## P3 (nits)

- **T19 · Hero faux-quiz mimics the real MCQ but is non-interactive** (`HeroPreview.tsx:106-194`). A novice could tap it expecting to play. Add a faint "preview" cue or make it a real entry point. `S`.
- **T20 · Landing H1 is a dense 19-word mission statement** above a comfortable reading age (`page.tsx:132,135`). Split into a short hook + trimmed sub-line. `S`.
- **T21 · SpeciesGuidePopup has three overlapping dismiss/commit affordances** ("Back" and "Keep looking" both fire `onClose`) (`SpeciesGuidePopup.tsx:127-137,178-184`). Collapse to "This is my pick" + one "Back to list". `S`.

---

## What's already good (do not regress)

1. **Reveal-in-place loop is solid** — verdict shows immediately at the top of the panel on submit (27 May B4 stays fixed); Next is 44px.
2. **Reduced-motion architecture is genuinely well-built** — a global `globals.css:206-215` kill-switch + per-component JS guards (`FeedPlayer.tsx:222`); no rogue infinite pulse remains. The 27 May vestibular finding is properly resolved.
3. **The shared `useModalFocus` hook is a clean reusable WCAG 2.1.2 contract** correctly applied to MapModal + SpeciesGuidePopup; it just needs extending to OnboardingTour.
4. **Leaderboard medals carry multi-channel cues** (SVG icon + sr-only label + rank number), so colourblind/SR users are well served even though the tints are off-token.
5. **idflow Rung 1/2 gates offer distinct "Not sure" + "Skip" escapes**, and TileGate ships the transparent-44px-hit-area pattern (a reusable fix template).
6. **Stat/likelihood bars are never colour-only** — each carries an adjacent % label, the right call for the colourblind owner.
7. **Sensible anon-first design** — "Start spotting" routes to `/feed` without a sign-up wall; per-user deterministic feed shuffle is in place.
8. **Admin surfaces carry `robots:noindex` + a clean `@pebl-cic.co.uk` gate**, and the annotator sidebar list is a partly-accessible text mirror of the canvas.

---

## Reconciliation with past logs (the cross-check you asked for)

| Past finding | Status now | Note |
|---|---|---|
| B4 reveal not visible after submit | **fixed** | In-place verdict (`FeedCard.tsx:1334`); T15 only notes the Next CTA can sit below a mobile scroll. |
| B5 /feed/browse 404 for anon | unverified | Not explicitly probed this pass. |
| B6 /auth/signup 404 | **fixed** | Sign-up is a mode on /auth/signin; T5 is about defaulting the anon bounce to it. |
| B7 IdGuide click fires MCQ behind | **fixed** | No recurrence; inert + overlay handling in place. |
| B8 leaderboard top-3 flat | **fixed** | Medal tints + icons + sr-only + rank numbers; only residual is stock-palette tints (T7). |
| B9 off-screen cards not inert | **fixed** | Holds despite the branch's revert history. |
| B10 IdGuideSheet no focus-trap | **fixed** | `useModalFocus` applied; the gap is now OnboardingTour (T4). |
| B11 "Help me identify" 111×15 | **fixed** | CTA hierarchy reworked 2 Jun. |
| B12 "Hide" pill 28×32 | **still-open** | `FeedCard.tsx:1101` still `h-8`; folded into T2. |
| B13 emoji-as-icon | **partial** | Feed/landing emoji gone, but dingbats persist in chat/account/sign-in (T7). |
| B14 auth empty viewport | **fixed** | MarinePattern behind /auth + 80% card. |
| P13 persistent session →/feed | unverified | Not directly probed. |
| P17 bottom tab bar | **still-open** | No bottom bar, no in-page back (T10). |
| P9 three competing landing CTAs | **fixed** | Resolved 2 Jun. |
| P11 primary hover contrast | **fixed** | `teal-hover` token. |
| P15 landing body teal-on-white AA | unverified | Not re-measured. |
| P20 motion constants | **fixed** | Shipped + in use. |
| P21 infinite animations | **fixed** | Gated + CSS kill-switch (T4 is a new marquee). |
| P28 verdict tokens | **partial** | Tokens exist + used, but RarityPanel/medals/chat-error still stock (T7). |
| Spot-It gate "Not sure"/"Skip" dead-ends | **partial** | Fixed on Rung 1/2; new Rung-3 CandidateGate ships without `notSure` (T6). |
| Spot-It touch targets 40→44 | **still-open** | Gate Back/Hide still 40px; wizard chrome sub-44 (T2). |
| jargon tile labels | **partial** | Tiles fixed; new jargon in wizard labels/whyHints (T17). |
| static candidate strip ("dopamine engine") | **still-open** | The narrowing loop exists but is wired out (orphaned); live Rung 3 is a static grid (T6). |
| de-kebab raw trait values | unverified | Not re-checked. |
| 2 Jun design-audit set | **partial** | All shipped where it swept; the same classes leak on surfaces the sweep missed (T2/T7/T8/T9/T18). **No regression of shipped work.** |

---

## Coverage note (honest)

**Strongly covered:** L6 accessibility (keyboard, touch, focus, colour-only) across feed/idflow/admin/onboarding/auth; L7 token/glyph; L9 microcopy/legal; the auth/onboarding flow (L5). Personas P4/P5/P6/P7/P10 well exercised.
**Lightly covered:** live runtime/visual verification at the three breakpoints (this was a **source-read** review, so reflow/overlap/contrast rest on code structure + content length, not rendered screenshots); P2 daily-driver friction beyond nav; P3 anonymous end-to-end (B5 browse-404 and P13 persistent-session went unverified); contrast was reasoned from opacity math, not instrument-measured. Surfaces lightly touched: `/data-explorer` (deprecated), browse grid interactions, email/digest templates.
**Recommended follow-up:** a live pass at 390/768/1440 + a contrast-tool sweep of the dark panels to confirm T8 and the legal-page reflow (T1) empirically.

---

## Proposed CLAUDE.md rule additions

1. **`min-h-[44px]` must be baked into `pebl-button-secondary`** (not added per call-site), the way `pebl-button-primary` already does.
2. **Every full-height route must own its scroll container** (`flex-1 overflow-y-auto` on the scrollable element) because the body is `h-[100dvh] overflow-hidden`. Follow the leaderboard pattern; never render long content in a bare `<main>`.
3. **Do not reuse the verdict tokens (correct/pending/incorrect) for non-verdict semantics.** Rarity, medals, etc. need their own named tokens; cross-wiring one colour onto two meanings is a hazard for the colourblind owner.
4. **Any auto-animating decorative element must ship a visible ≥44px pause/play control or start paused**, independent of `prefers-reduced-motion` (WCAG 2.2.2). Reduced-motion alone does not discharge the criterion.
5. **Any new `role=dialog`/`aria-modal` overlay must import `useModalFocus` and set background content `inert`.** Declaring `aria-modal` without focus management is a false contract.
6. **Drag-only interactions must always ship a single-pointer non-drag alternative (spinners/nudge) and a keyboard path**, including internal `/admin` tooling (WCAG 2.1.1 + 2.5.7).
7. **Legal/accessibility docs are public compliance surfaces:** no "engineering draft" banners, no absolute conformance claims the known-issues list contradicts, and the Companies House number must match the canonical PEBL record everywhere.

---

## Prioritised fix order + implementation status (all worked through 2026-06-04)

**Verification after the fix pass:** `tsc --noEmit` clean, `lint:tokens` clean, `eslint` clean, **260/260 unit tests pass**. Every commit used explicit path staging (never `-A`) to avoid the concurrent session's working tree.

| Theme | Sev | Status | What landed |
|---|---|---|---|
| T1 Legal pages clip (iOS Safari) | ~~Blocker~~ P1 | ✅ Done | `min-h-0 overflow-y-auto` on `LegalLayout` main; live-verified. Sibling `/u/[id]` profile fixed too. |
| T2 Sub-44px touch targets | P1 | 🟢 Mostly | `pebl-button-secondary` min-h+centring; FeedCard "Hide" hit-area; idflow gates + popup 40→44; reveal links. Residual: wizard inline "More/Less" disclosure. |
| T5 Anon bounce + verification | P1 | ✅ Done | mid-ID bounce → `&isSignUp=1`; dismissible "check your inbox" `VerificationBanner` on the feed. |
| T4 Onboarding focus + marquee pause | P1 | ✅ Done | `useModalFocus` on OnboardingTour; 44px pause/play toggle on SpeciesMarquee. |
| T6 Rung-3 "None look right" + dead engine | P1 | 🟢 Mostly | CandidateGate "None look right" exit added; CLAUDE.md corrected. Orphan strip left for a revive/remove product call. |
| T3 Admin annotator keyboard | P1 | ✅ Done | X/Y/Size number inputs (arrow-key placement), aria-hidden SVG, aria-live status, dashed selection cue. |
| T7 Token/glyph drift | P2 | 🟢 Mostly | All dingbats/glyphs → SVG/CSS (chat dots, account, password meter, wizard ▶). Stock-palette tints (chat-error red, rarity amber, medals) kept — they carry non-colour cues (brand-only, not a11y). |
| T8 Low-opacity white text | P2 | ✅ Done | TileGate/RarityPanel/FeedCard small text → `white/70+`; reveal panel fully opaque. |
| T15 Reveal Next below mobile scroll | P2 | ✅ Done | Advance row pinned as a sticky footer when a next clip exists. |
| T13 Legal copy + wayfinding | P2 | ✅ Done | Company-number finding was a FALSE POSITIVE (no change). Added "Back to FishSpotter" link. Draft-banner left to owner. |
| T12 Verify-link dead-ends | P2 | ✅ Done | Recovery links on the expired + error branches. |
| T16 Chat safety deflection | P2 | ✅ Done | HARD_RULE 8: on-task, assume children, deflect off-topic/unsafe/personal, no PII. |
| T11 Header logo off-site | P2 | ✅ Done | Logo → app home `/` (Next Link); off-site link already in the drawer. |
| T9 Banned `rounded-xl` | P2 | ✅ Done | → `rounded-modal` across the idflow surfaces. |
| T17 Wizard jargon | P2 | ✅ Done | Dropped "(ocellus)"; "gadoid signature" → plain "cod family (gadoids…)". |
| T18 Annotator button-in-button + targets | P2 | ✅ Done | Nested buttons restructured to siblings; targets padded; resize handle enlarged. |
| T14 Tour colour-only progress | P2 | ✅ Done | sr-only "Step X of N" + non-colour active-pip size cue. |
| T10 Hamburger-only nav | P2 | 🟢 Interim | "Back to feed" on leaderboard/account/profile. Persistent bottom tab bar = deferred deliberate project. |
| T19 Hero faux-quiz cue | P3 | ✅ Done | "Demo" chip + full-card link (real entry point). |
| T20 Hero H1 density | P3 | ✅ Done | Trimmed to a punchy hook. |
| T21 Popup redundant controls | P3 | ✅ Done | Collapsed to one primary + header back. |

**Explicitly deferred (need an owner decision, not a code fix):** T2/T6 residuals (wizard inline disclosure; revive-or-remove the orphan narrowing engine), T7 palette-token additions (rarity/medal tokens), T10 bottom tab bar, and the accessibility-statement "v0.1 draft" banner wording.

**Still recommended:** the live breakpoint pass at 390/768/1440 + an instrument-measured contrast sweep, to confirm the layout themes the source-read review reasoned about (T1 was already live-confirmed + corrected).

---

*Generated by a 20-finder multi-agent review with 2 adversarial verifiers per finding, reconciled against the 27 May / 1 Jun / 2 Jun logs. Review pinned to `aab20a7`; fixes applied 2026-06-04 on `spot-it-visual-id` and verified (tsc + 260 tests + eslint + token-lint all green).*
