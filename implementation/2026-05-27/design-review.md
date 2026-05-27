# FishSpotter Design Review — 27 May 2026

**Method:** 14 parallel agents — 9 static code/screenshot reviews + 5 live user-journey walkthroughs.
**Models:** Opus for feed core, AI-smell, stuck-novice journey. Sonnet for all others. Haiku for admin.
**Scope:** Landing, auth, feed, MCQ picker, reveal, IdGuide wizard, browse archive, leaderboard, admin, mobile 390×844.

---

## Executive summary

The app's **bones are a product**, not a prototype. The bbox trail, H-toggle, reveal pulse, round-ends-on-submit reorder, PEBL palette discipline, and IdGuide teaching architecture are all considered, above-average moves. The AI-smell auditor rated it **4/10 on the AI-built scale** — much better than a shadcn-template SaaS.

But two upstream problems undercut the whole surface: **data quality** (candidate photos that are textbook pages or hands, reference IDs filed as "Fish") and **feedback timing** (the reveal — which is excellent content — is buried 29 cards back after submit). Fix those two before any more UI polish. The chassis already deserves content that matches it.

The review found **14 blockers**, **31 polish items**, and **18 nits**.

---

## BLOCKERS
*Fix before the next user-facing push. Grouped by theme.*

### Data / content

**B-1. MCQ candidate tiles show textbook diagrams and hands holding fish**
`src/components/MCQCandidatePicker.tsx:191-214` — tested examples: "Poor cod" shows a diagram with visible body text; "Sprat" shows a hand holding a fish; "Crab" and "Fish" fall back to the silhouette placeholder. Two of four tiles being unidentifiable from the photo makes the quiz a coin-flip on iconography, not biology.
**Fix:** extend the `curated=true` gate (already built for marks in Q3A-T4) to MCQ candidate photos. Block uncurated tiles from appearing in MCQ; silhouette only as absolute last resort, not first default.

**B-2. 60%+ of reference IDs are genus-class strings, not species**
`Snippet.staffAnswer` audit: 9/30 = "Fish", 5 = "Crab", 4 = "Scooter", 4 = "Flatfish". A player who correctly identifies *Ballan wrasse* gets the Wrong pill because the reference is the word "Fish". This breaks the scoring model's social contract entirely.
**Fix:** backfill `staffAnswer` with species-level IDs where possible. Where a generic reference is all that exists, treat it as `null` so the Pending (+1) path fires instead of Wrong. Audit script needed.

**B-3. Wizard mark coverage: 1 of 26 species authored, wizard is guess-funnel for the other 25**
Only pollack has diagnostic marks. The wizard narrows confidently to 3-5 candidate species, then FinalReveal shows rich pollack teaching or a bare field-note for every other species. Asymmetric teaching within a single wizard run (pollack vs bib) is actively confusing.
**Fix (data):** prioritise authoring by running `SELECT chosenOption, staffAnswer, COUNT(*) FROM Answer WHERE isCorrect=false GROUP BY chosenOption, staffAnswer ORDER BY COUNT DESC` — find top confused pairs, author marks targeting those discriminations first. Aim for 5 high-frequency species before the next marketing push.
**Fix (UI):** for unannotated species, show a callout below the gallery: "Diagnostic marks for [species] are being authored — check back soon." Users currently have no way to know they're getting a weaker experience.

### User flow

**B-4. Reveal is not immediately visible after submit — card goes to position 29/30**
The reveal panel is the single best teaching moment in the app (species name, community bar chart, "How to spot X next time"). But after submitting, the card silently moves to the back of a 30-card feed. First-timers assume nothing happened; they never find the reveal on a first session.
Confirmed in both signup journey (~38s to answer, result never found until scrolling to card 29) and daily-driver journey.
**Fix:** show a brief inline verdict flash before advancing (300ms "✗ Wrong — it was a Gastropod" overlay on the submitted card), OR show a minimal result modal/toast before loading the next card. The full reveal panel can still live on the answered card; the flash closes the feedback loop immediately.

**B-5. `/feed/browse` 404s for anonymous users, despite being the destination of the homepage "Explore archive" CTA**
Tested in anonymous journey: clicking "Explore archive" on the landing page returns a 404 with "Page not found". The homepage advertises a route that doesn't exist for the very users it's inviting.
**Fix:** either make `/feed/browse` accessible without auth (read-only grid with CTAs to sign up), or redirect to a branded "Sign up to explore the archive" page. Do not 404.

**B-6. `/auth/signup` and `/auth/register` both return 404**
Confirmed in daily-driver and mobile journeys. The "Create your spotter profile" CTA on the landing routes to `/auth/signin?isSignUp=1` which works, but direct navigation to `/auth/signup` or `/auth/register` returns 404. Any shared link to a signup page breaks.
**Fix:** add redirect rules in `next.config.mjs` or create the routes as aliases.

**B-7. Clicking species names inside the IdGuide wizard fires an MCQ answer on the underlying card**
Confirmed in daily-driver journey: tapping a species name in the wizard's body-shape examples ("Cod, mackerel, bass") submits that as the MCQ answer on the card behind the sheet. The IdGuide and MCQ picker share a click context with no isolation.
**Fix:** the IdGuide sheet (or at minimum the MCQ picker) must `stopPropagation` on all pointer events, or the picker should be unmounted/inert while the sheet is open. This is the most destructive interaction bug in the app.

**B-8. Leaderboard top-3 rows are visually indistinguishable from rank #47**
`src/app/leaderboard/page.tsx:192-199` — rank #1 carries a teal `#1` numeral and nothing else. The most motivating moment in a competitive scoring system is completely flat.
**Fix:** gold/silver/bronze row tints (`bg-amber-50`, `bg-zinc-50`, `bg-orange-50`) or left-border accents (`border-l-4 border-amber-400`) for positions 1-3. Minimum effort for maximum motivational signal.

### Accessibility (WCAG 2.1 AA failures)

**B-9. Off-screen feed cards are not `inert` — keyboard users tab into 29 hidden cards**
`src/components/FeedPlayer.tsx:169` / `FeedCard.tsx:816+` — all 30 `<motion.section>` cards render in the DOM simultaneously. Only the `<video>` gets `tabIndex={isActive ? 0 : -1}`; every button inside an inactive card remains fully focusable.
**Fix:** `inert={!isActive}` on each `<motion.section>` in `FeedPlayer.tsx:174`. One line.

**B-10. `IdGuideSheet` has no Tab focus trap**
`src/components/IdGuideSheet.tsx:86-117` — `SideMenu` and `SpeciesGallery` both implement Tab-wrap loops. `IdGuideSheet` has Escape/H handlers and initial focus placement but no Tab interceptor. Focus escapes the sheet onto video and off-screen card buttons beneath it.
**Fix:** mirror the Tab-trap from `SideMenu.tsx:103-118`. ~20 lines.

### Mobile blockers

**B-11. "Help me identify" button is 111×15px on mobile — effectively untappable**
`FeedCard.tsx` — the primary IdGuide entry point is a text link below the candidate grid. At 15px tall it is invisible to a one-thumb user in motion. Confirmed in mobile journey.
**Fix:** raise to minimum `min-h-[44px]` and give it button-level visual weight (solid teal pill or outlined button, not a text link).

**B-12. "Hide" pill is 28×32px — below Apple HIG and WCAG 44px minimum**
`FeedCard.tsx:905` — the only way to collapse the MCQ panel without submitting is undersized on touch.
**Fix:** `min-h-[44px] min-w-[44px]` on the pill. This also applies to the "Skip" button (42×25px) and "Where is this?" (95×36px).

### Design

**B-13. Emoji-as-icon: 🐟 in IdGuideTrigger, 🔥 in SideMenu streak indicator**
`src/components/IdGuideTrigger.tsx:109` / `src/components/SideMenu.tsx:197` — the two loudest AI-built tells in the app. The otherwise restrained PEBL palette and scientific register are cheapened by Apple emoji glyphs.
**Fix:** swap both for stroked SVG icons in `text-teal-500`. A monoline fish silhouette (distinct from the emoji) already exists in the H-pill SVG vocabulary; reuse it. For the streak, a monoline flame SVG or simply the word "streak" without an icon.

**B-14. Auth pages are 80% empty viewport — centred card on blank background**
`src/app/auth/signin/page.tsx:59` — the sign-in and sign-up forms sit in a `max-w-md` card in an otherwise empty viewport. Reads as a Tailwind scaffold that was never given content.
**Fix:** right-side editorial content: a curated underwater still from a PEBL deployment with a field-note quote, OR a species silhouette collage, OR a single animated stat ("3,240 identifications by the community"). The auth page should earn the user's commitment with something that shows what they're signing up for.

---

## Polish backlog
*Next sprint candidates. Sized S (< 2h) / M (2-4h) / L (4-8h).*

### Feed & reveal

**P-1. Panel-to-video ratio inverted on mobile [M]**
`FeedCard.tsx:847-878` — panel consuming ~55% of vertical space at 390×844 means the MCQ is winning over the fish. Users are identifying from a narrow strip of video.
Fix: cap `max-h` to `50vh` on mobile; let user pull to expand. Or default-collapse panel until the video has played one loop.

**P-2. Desktop layout feels mobile-uploaded [M]**
`FeedCard.tsx:847` `w-[min(560px,calc(100%-1rem))]` leaves 800px+ of empty gutters at 1440. The panel is floating in negative space.
Fix: optional two-column layout at `>=lg` (video left, MCQ right), or grow to `min(720px,...)` and move the rarity panel to a side rail post-submit.

**P-3. FinalReveal stacks all candidates vertically — "Use this as my answer" below fold [M]**
`IdGuideWizard.tsx:282-327` — with 3-5 candidates each rendering an async photo + gallery + fieldNote, the primary CTA is below fold for the first candidate on a laptop screen.
Fix: show only the top candidate in full; collapse remaining to compact header + one-line field-note snippet, expandable on tap.

**P-4. Reveal auto-dismisses on mobile — walking user misses score [S]**
Mobile journey: the reveal panel appears then the card moves away before a user in motion can read it.
Fix: require an explicit "Next" tap on mobile (same as the existing "Next" button in the reveal panel) before advancing. Do not auto-advance on mobile.

**P-5. "Why ask this?" disclosures hidden behind toggle [S]**
`IdGuideWizard.tsx:206-213` — genuinely good teaching copy is buried behind a `<details>` at 10px in muted teal. Nobody reads it first pass.
Fix: show the first sentence inline below the question text (always visible); keep the full rationale behind the disclosure.

**P-6. `AnnotatedSpeciesPhoto` SVG distorts rings on non-square photos [S]**
`AnnotatedSpeciesPhoto.tsx:83` — `preserveAspectRatio="none"` on a 1000×1000 viewBox turns circles into ovals on portrait/landscape iNat photos.
Fix: `preserveAspectRatio="xMidYMid meet"` and `width:100%; height:100%; position:absolute` on the SVG.

**P-7. Size step unanswerable without scale reference in video [M]**
Stuck-novice journey: "roughly how big?" with no ruler, diver, or fixed object in the clip forces a guess every time.
Fix: add a "no scale visible" auto-skip path, OR embed a cm-grid overlay in the bottom corner of snippets at upload time so the question is answerable. If neither, remove the step entirely — it adds noise more than signal for a novice.

**P-8. Move-to-back animation not visible in-session [S]**
Daily-driver journey: Q3A-T7 (optimistic reorder) works at reload but the in-session Framer layout transition is imperceptible. The "round ends" signal is absent.
Fix: increase `duration` from 0.45s to 0.35s and add a brief scale-down (`scale: 0.95`) on the departing card before it reflows to the tail. Strengthen the visual confirmation that an answer was locked in.

### Landing & auth

**P-9. Three competing CTAs on landing, collapses to three stacked rows on mobile [S]**
`src/app/page.tsx:27-46` — "Start spotting", "Create your spotter profile", "Explore archive" at equal visual weight.
Fix: demote "Explore archive" to a text link below the primary two. On mobile, show only the primary CTA above the fold.

**P-10. Hero headline front-loads brand over benefit [S]**
`page.tsx:21` — "PEBL FishSpotter turns marine monitoring into a shared, playable observation feed" — "playable observation feed" is LLM-tinged, "turns X into Y" is SaaS-marketing.
Fix: "Identify species from real underwater footage — and help build a shared observation record." Concrete, scientific, no metaphor.

**P-11. Primary button hover kills dark-text contrast [S]**
`globals.css:98` — hover jumps to `bg-teal-800` (near-black teal) while text stays `text-navy-900`. Contrast at that state is below AA.
Fix: hover to `bg-teal-600` instead, or swap hover text to white.

**P-12. Auth error copy is grammatically awkward [S]**
`signin/page.tsx:45` — "Invalid email or sign in failed." is two failure modes collapsed into one unhelpful sentence.
Fix: "No account found for that email, or the password is incorrect." / "That email address is already registered — try signing in instead."

**P-13. No persistent session — users land on homepage every visit [M]**
Daily-driver journey: returning user expecting `/feed` lands on the marketing homepage. Adds 2-3 taps of friction on every visit.
Fix: if `session` exists on `/`, immediately redirect to `/feed`. One middleware rule.

**P-14. Forgot-password inputs styled differently to sign-in inputs [S]**
`forgot/page.tsx:76` uses `rounded-modal border-navy-900/15 bg-white` vs sign-in's `rounded-2xl border-[var(--border)] bg-surface-muted`. Jarring across a single auth flow.
Fix: extract a shared input component or copy sign-in classes into forgot.

**P-15. Landing body text `#2B7A78` on white fails WCAG AA [S]**
Contrast ~3.5:1, requires 4.5:1 for body text at 16px. Affects "1 · SPOT" eyebrow labels and how-it-works paragraphs.
Fix: use `--foreground` (`#17252A`) for body paragraphs; reserve `--muted` for genuinely decorative text.

**P-16. No social proof or real imagery on landing [M]**
`page.tsx` — zero evidence of real footage above the fold. No thumbnail, no species image, no clip counter.
Fix: add a single looping still from a curated PEBL clip (same CDN, no new infrastructure), or a species silhouette grid showing "26 species in the guide."

### Navigation

**P-17. Hamburger-only nav buries secondary pages [M]**
Every path to Archive and Leaderboard is a full drawer open. On mobile, the hamburger is top-left — hardest thumb-reach zone on a right-handed iPhone.
Fix: a persistent bottom tab bar on mobile (3 tabs: Feed / Archive / Leaderboard). On desktop, surface these as text links in the header nav rather than hamburger-only.

**P-18. No "answered" state on browse archive cards [S]**
`browse/page.tsx:185` — daily-driver users doing review have no way to distinguish clips they've already answered from unseen ones.
Fix: `answered` boolean from the session's `Answer` table, rendered as a subtle pill overlay ("Identified" / "Open") on each card.

**P-19. Silent redirects with no explanation [S]**
Anonymous journey: `/leaderboard` silently drops to `/`, `/feed` silently opens signup. No message explaining what the user is missing or why an account is needed.
Fix: middleware should redirect with a query param (`?reason=login-required`); the auth page should show a contextual message ("Sign in to see the leaderboard" / "Sign in to submit identifications").

### Motion & interactions

**P-20. Motion durations: 9 distinct values, needs a shared constant [S]**
`FeedCard.tsx`, `FeedPlayer.tsx`, `SnippetPlayer.tsx`, `RarityPanel.tsx`, `SideMenu.tsx`, `SettingsMenu.tsx` — values range from 0.15 to 0.45 with no shared source of truth.
Fix: `src/lib/motion.ts` exporting `DURATION = { micro: 150, standard: 200, layout: 300 }` and `EASE = { enter: "easeOut", exit: "easeIn", layout: "easeInOut" }`. Apply across all Framer calls.

**P-21. Infinite swipe-up hint bounce and collapsed-pill pulse [S]**
`FeedPlayer.tsx:199-202` (`y: [0,-3,0]` forever) and `FeedCard.tsx:802-814` (scale pulse, `repeat: Infinity`). Both are vestibular risks for users with motion sensitivity and expensive for persistent on-screen elements.
Fix: cap both at 3 repeats. The hint disappears after first scroll anyway; the pulse only fires for first-time users.

**P-22. Header gradient leaks onto light-surface pages [S]**
`Header.tsx:23` — `bg-gradient-to-b from-black/40` is correct over the dark video feed but puts a black scrim over the PEBL logo on the light landing/signin pages.
Fix: the existing transparent/solid branch on line 24 needs to route correctly to all non-feed surfaces, not just the explicit cases currently handled.

### IdGuide sheet

**P-23. finShape options are not mutually exclusive [S]**
`IdGuideWizard.tsx:63-83` — "split-dorsal" and "forked-tail" can both describe the same fish (cod). A novice stalls trying to pick one.
Fix: split into two sub-questions (dorsal fin count → tail shape) or annotate with "pick the most distinctive feature."

**P-24. Sheet title doesn't reorient on mode switch (wizard → chat) [S]**
`IdGuideSheet.tsx:165-172` — no transition signal or breadcrumb when switching. Chat footer has no "← Back to guided" affordance.
Fix: add "← Back to guided" link in chat footer matching the wizard's existing footer navigation pattern.

**P-25. "8 turns left" counter creates scarcity anxiety [S]**
`IdGuideChat.tsx:288-290` — the turn limit is a safety valve, not a feature. Surfacing it on every message adds unnecessary friction.
Fix: hide counter until ≤ 3 turns remain.

**P-26. `NARROW_ENOUGH = 5` fires FinalReveal after body shape alone on mobile [S]**
`IdGuideWizard.tsx:124,162` — selecting "torpedo/streamlined" on mobile can narrow to ≤5 candidates after step 1, jumping straight to FinalReveal with 5 stacked fish cards and no further guidance.
Fix: raise to `NARROW_ENOUGH = 3`, or add `stepIdx >= 2` as a minimum-steps guard.

**P-27. Teach marks apply to photo-to-photo not photo-to-video [M]**
Stuck-novice journey: the pollack marks are excellent on the clean iNat reference photo, but nothing bridges from "here's the lateral-line kink on a textbook fish" to "here's what it looks like in murky green water."
Fix: below the annotated reference photo in FinalReveal, add a second image: a screenshot from an actual FishSpotter clip with the same feature circled in murky conditions. One image per species, sourced from the existing snippet library.

### Contrast / a11y polish

**P-28. Verdict pills use off-brand emerald / rose / amber [S]**
`FeedCard.tsx:1123,1132,1151` — the three verdict states use Tailwind stock colours not in the PEBL palette.
Fix: add `correct`, `incorrect`, `pending` semantic tokens to `tailwind.config.ts` (e.g. a teal-adjacent green for correct, warm red for incorrect, muted amber for pending). Update all three pill call-sites.

**P-29. Footer links and "Sign in" nav link below contrast / touch-target minimums [S]**
Footer link opacity ~3.0:1 at 12px. "Sign in" in AvatarMenu is 36px touch target (need 44px).
Fix: raise footer link opacity to 0.72+; AvatarMenu `min-h-[44px]`.

**P-30. `IdGuideChat` typing indicator has no ARIA live region [S]**
`IdGuideChat.tsx:299-301` — three animate-pulse dots with no `aria-label` or `role="status"`. Screen-reader users hear nothing while Claude generates.
Fix: `<span role="status" aria-label="Claude is typing">` wrapping the dots; `aria-hidden="true"` on the dots themselves.

**P-31. Leaderboard `aria-current="true"` (string) should be `aria-current="row"` [S]**
`leaderboard/page.tsx:207`. One-line fix.

---

## Nits
*Batch into a single cleanup commit.*

- Company registration number duplicated on landing (hero + footer) — remove from hero body, keep in footer.
- "PEBL spotter leaderboard" H1 redundant — "Spotter leaderboard" or "Community rankings".
- "Community guesses" histogram label — rename to "Most-named species."
- "Got it" cookie dismiss — rename to "Dismiss" or "OK."
- Browse archive zero-results empty state is a bare `<p>` — add "→ Go to live feed" CTA alongside reset link.
- `IdGuideChat.tsx:18` — "Welsh coast" seed greeting hardcodes geography. Add TODO for region expansion.
- `shadow-2xl` on `IdGuideSheet.tsx:189` and `MapModal.tsx:49` — swap to the custom `shadow-menu` / `shadow-panel` tokens already defined.
- Admin: save failure and curation-gate errors are silent (no toast) — `SpeciesAnnotator.tsx:104-106,91-107`.
- SKIP button `text-white/45` fails AA (~3.0:1) against `bg-navy-800` — raise to `text-white/70`. `FeedCard.tsx:1032`.
- H-key undiscoverable on desktop for first-time users — add one-time hint chip on the first card ("Press H to peek at the video"), same pattern as the existing `nav-hint` in `FeedPlayer.tsx:188`.
- `animate-spin` on submit SVG in `FeedCard.tsx:999` not gated by `useReducedMotion`.
- `aria-describedby` missing on password input — hint text "(at least 8 characters)" has no stable `id`.
- `src/data/species-traits.json` — bass (`Dicentrarchus labrax`) listed as example alongside gadoids in the fins/tail step ("Cod, bib, pollack, bass") — bass is not a gadoid, creates a category leak. Fix the example string.
- Five concurrent border-radius values across the app — `rounded-hero`, `rounded-card`, `rounded-modal`, `rounded-2xl`, `rounded-lg`. Consolidate to two (`card` for surfaces, `full` for pills).
- "Display name" field on signup is premature — user hasn't seen any content yet. Defer the prompt to post-first-answer nudge ("Add a display name to appear on the leaderboard").
- Browse archive eyebrow hardcoded "PEBL sighting" on every card — replace with `{snippet.deployment}`.
- Type scale tokens (`display`, `h1`, `h2`, `h3`, `eyebrow`) declared in `tailwind.config.ts` but bypassed by ad-hoc `text-[10px]`, `text-xs` usage in `RarityPanel.tsx:91`, `SideMenu.tsx:188`. Migrate to named scale.
- `move-to-back` animation duration 0.45s feels sluggish — reduce to 0.3s. `FeedPlayer.tsx:172`.

---

## Anti-patterns to add to CLAUDE.md

Add to the "Guidelines for Claude" section:

```md
### UI/Design rules (to avoid regressions)

- **Never use emoji as UI icons.** Replace any 🐟, 🔥, 🔍, ✨, 🚀 in JSX with
  stroked SVGs in `text-teal-500`. Emoji are Apple-platform-specific and
  communicate "hackathon", not "marine science product."

- **Verdict / semantic colour states must use design tokens, not Tailwind
  stock utilities.** `emerald-400`, `rose-400`, `amber-300` are not in the PEBL
  palette. Add `correct`, `incorrect`, `pending` tokens to `tailwind.config.ts`
  before using them. Same rule for any future semantic state (warning, info,
  success, danger).

- **Named design tokens must be used at call-sites.** If `rounded-card`,
  `shadow-menu`, or a named type-scale token is defined in `tailwind.config.ts`,
  use it — do not reach for `rounded-2xl`, `shadow-2xl`, or `text-sm` as a
  substitute. The token exists to make changes consistent.

- **Auth/empty pages need editorial content in unused viewport.** Never ship
  a `max-w-md` card centred on a blank background. At minimum: a contextual
  still from a PEBL deployment, a field-note quote, or a species silhouette
  collage to show what the user is signing up for.

- **All interactive elements ≥ 44×44px on mobile.** This applies to pills,
  text links, icon buttons, and collapse affordances — not just primary CTAs.
  Check with preview_resize to 390px before committing any feed or sheet change.

- **Off-screen overlay content must be `inert`.** Any component that renders
  multiple items but only one is "active" (feed cards, carousel slides, offscreen
  drawers) must set `inert={!isActive}` on inactive items. `tabIndex=-1` alone
  does not remove items from the accessibility tree.

- **Reveal / result feedback must be immediate.** Any action where a user
  submits something and expects a score must show a result *in place* before
  navigating away. Do not rely on the user finding the result in a different
  scroll position or page state.
```

---

## Prioritised fix order

| # | Item | Why first | Effort |
|---|---|---|---|
| 1 | B-7 IdGuide click triggers MCQ answer | Silent data corruption, breaks the core loop | S |
| 2 | B-4 Reveal not immediately visible | Single biggest UX gap; excellent content buried | S |
| 3 | B-9 Off-screen cards not `inert` | WCAG blocker, one line | S |
| 4 | B-10 IdGuideSheet missing Tab trap | WCAG blocker, ~20 lines | S |
| 5 | B-11/12 Mobile touch targets | Blocks mobile shippability | S |
| 6 | B-5 /feed/browse 404 for anonymous | Homepage CTA is broken | S |
| 7 | B-13 Emoji-as-icon | Top AI-smell signal; easy SVG swap | S |
| 8 | B-2 Generic reference IDs | Makes scoring model meaningless | M (data) |
| 9 | B-14 Auth empty viewport | Second-loudest AI-smell signal | M |
| 10 | B-1 MCQ candidate photo quality | Third data-layer problem | M |
| 11 | P-13 Persistent session → /feed | Kills daily habit formation | S |
| 12 | P-17 Bottom tab bar on mobile | Navigation is the other mobile blocker | M |
| 13 | B-8 Leaderboard top-3 differentiation | Maximum motivational signal for minimum effort | S |
| 14 | B-3 + P-27 Mark authoring + murky bridge | Strategic differentiator depends on it | L (content) |

Items 1-7 are all **< 2 hours each** and could ship as a single "UX critical fixes" commit before the next feature.
