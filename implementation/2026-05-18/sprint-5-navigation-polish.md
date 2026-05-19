# Sprint 5 — Navigation, Accessibility & Polish

## Goal

Make FishSpotter genuinely navigable, shareable, and accessible. By the end of this sprint:

- Every page exposes a persistent, discoverable navigation surface (not hidden behind a misleading chevron-left icon).
- The visible feed clip is reflected in the URL, and `/feed/[id]` uses human-readable `externalId` slugs that can be shared into Slack/email/Twitter without looking like a database leak.
- Each feed card surfaces its situational anchor (site, depth, recording date) so viewers know what they are looking at.
- The quiz outcome is announced to screen readers, paired with a non-color cue, and the species input has a real `<label>`.
- All modal/drawer surfaces (`SideMenu`, `MapModal`, any other) are focus-trapped to match the bar already set by `SpeciesGallery`.
- Framer Motion animations honour `prefers-reduced-motion` consistently, and color contrast failures on `#3AAFA9` text are gone.
- A `sitemap.ts`, `robots.ts`, locale-aware date formatting, and a route-vs-SW drift CI guard are in place.

Sprint 5 settles visual + a11y polish on top of Sprint 1's design tokens and Sprint 4's perf foundation. Scope is intentionally narrow: navigation IA, deep-linking, and accessibility. Internal page UX (quiz pipeline, archive filters, leaderboard scoring) is owned by Sprints 2/4 and is not re-litigated here.

## Definition of done

- **axe-core CI gate**: `@axe-core/playwright` runs on every PR against `/`, `/feed`, `/feed/browse`, `/feed/[externalId]`, `/leaderboard`, `/auth/signin` at 375 + 1280 viewports. Zero `critical` violations, zero `serious` violations. Build fails on regression.
- **Lighthouse CI accessibility score ≥95** on all six routes above, mobile slow-4G profile, asserted in `.lighthouserc.json`.
- **Keyboard-only walkthrough passes** the matrix in §07 testing plan: skip-link moves focus into `<main>`; Tab traversal hits every interactive control in DOM order with a visible focus ring; Escape closes every dialog/drawer; focus returns to the trigger on close.
- **Screen-reader walkthrough passes** on NVDA + VoiceOver: quiz outcome ("Correct — common name" / "Not quite — was X") is announced via the new aria-live region; species input announces its purpose ("Species name, edit text"); every page has exactly one `<h1>`.
- **Deep-link parity**: refreshing `/feed` while clip 5 is visible reloads the same clip; sharing the URL bar from a logged-in session opens the same clip for the recipient; `/feed/{externalId}` is the canonical permalink and old CUID URLs 301 to it.
- **Color contrast matrix**: `axe-core` colour-contrast rule passes everywhere. `#3AAFA9` is not used as text below 14px on any background; `#2B7A78` replaces it for small text on white/light-teal.
- **Cross-promo CTAs**: `/leaderboard` and `/feed/browse` each render a primary "Open live feed" CTA above the fold; archive cards link to `/feed/{externalId}`.
- **Service-worker drift test** (`npm run test:sw-routes`) passes in CI and would fail if a new top-level route were added without updating `isPersonalisedRoute()` in `public/sw.js`.
- **`sitemap.xml` and `robots.txt`** are reachable, valid, and include one entry per `Snippet.externalId`.
- **Touch target audit**: no interactive control under 44×44 CSS pixels on any reviewed route (`@axe-core/playwright` `target-size` rule passes).

## Audit findings addressed

| Finding | Source | Ticket(s) |
|---|---|---|
| F1 — No persistent nav chrome on non-feed pages | §04 | S5-T1, S5-T2 |
| F2 — Chevron-left hamburger is misleading | §04 | S5-T1 |
| F3 — Two header treatments, brittle pointer-events | §04 | S5-T2 |
| F4 — `/feed` URL never reflects visible clip; no share affordance | §04, §02 | S5-T3, S5-T5 |
| F12 — Snippet permalink lacks prev/next/share | §04 | S5-T5 |
| F13 — `/feed` back-nav loses activeIndex | §04 | S5-T3 |
| F14 — `usePathname()` exact match brittle on trailing slash | §04 | S5-T2 |
| F15 — No cross-promo from leaderboard/browse back to feed | §04 | S5-T6 |
| F16 — No `sitemap.ts` / `robots.ts` | §04 | S5-T19 |
| F20 — `/feed/[id]` uses opaque CUID | §04 | S5-T4 |
| F8 — Service-worker route list drift | §04 | S5-T20 |
| A11Y-01 — `#3AAFA9` text fails AA contrast | §07 | S5-T15 |
| A11Y-02 — Color-only correctness signal | §07 | S5-T9 |
| A11Y-03 — Post-submit panel swap not announced | §07 | S5-T9 |
| A11Y-04 — Skip-link target missing `tabIndex={-1}` | §07 | S5-T16 |
| A11Y-06 — Species input has placeholder-as-label | §07 | S5-T10 |
| A11Y-10 — `SideMenu` lacks focus trap (and `MapModal`) | §07 | S5-T11 |
| A11Y-11 — `/feed` has no `<h1>`; hierarchy audit needed | §07 | S5-T13 |
| A11Y-12 — Inconsistent paired-toggle labelling | §07 | S5-T16 |
| A11Y-13 — Page-title separator middot read literally | §07 | S5-T14 |
| A11Y-14 — Framer pulses not gated by `prefers-reduced-motion` | §07 | S5-T12 |
| A11Y-15 — Forms missing `autocomplete` tokens | §07 | S5-T10 |
| A11Y-16 — Touch targets below 44×44 | §07 | S5-T17 |
| RESP-06 — Landscape orientation handling | §07 | S5-T18 |
| RESP-07 — Hover-only interactions without touch parity | §07 | S5-T17 |
| Per-card metadata not surfaced (site, depth, date) | §02 | S5-T7 |
| Locale-aware date formatting / `lang` audit | §07, sprint scope item 18 | S5-T14 |
| Image alt-text audit | sprint scope item 19 | S5-T8 |

## Dependency graph

```
            S5-T1 Replace hamburger icon + nav primitive
              │
              ├─► S5-T2 Persistent nav (desktop + mobile tab-bar)
              │      │
              │      └─► S5-T6 Cross-promo CTAs on leaderboard / browse
              │
              └─► S5-T16 Skip-link + paired-toggle labels

S5-T4 externalId slug for /feed/[id]
   │
   ├─► S5-T3 history.replaceState deep-link on scroll
   │      │
   │      └─► S5-T5 Share button + prev/next on /feed/[externalId]
   │
   └─► S5-T19 sitemap.ts uses externalId

S5-T7 Per-card metadata surface (site / depth / date)
   │
   └─► S5-T14 Locale-aware date formatting (used by T7 + T5)

S5-T9 aria-live + non-color quiz cue
   │
   ├─► S5-T10 Real <label> for species input + autocomplete audit
   └─► S5-T11 Focus trap in SideMenu + MapModal

S5-T15 Color contrast sweep (#3AAFA9 → #2B7A78 / #DEF2F1)
   │
   └─► S5-T12 Reduced-motion guards (visual change)

S5-T13 Heading hierarchy + <h1> audit
   │
   └─► S5-T8 alt-text audit (shares the route walk)

S5-T17 Touch target + hover-parity sweep
S5-T18 Landscape orientation handling
S5-T20 SW route allowlist drift CI test
S5-T21 not-found.tsx polish
S5-T22 axe-core + Lighthouse CI wiring (gate for all of the above)
```

Critical path: T1 → T2 → T6, and T4 → T3 → T5. Everything else is parallelisable once T22 lands the CI scaffolding to measure regressions.

## Dependencies on Sprint 1-4

- **Sprint 1**: Tokens are in `tailwind.config.ts`. T15's contrast sweep assumes `text-primary-dark` / `text-foreground` utilities exist or that semantic colour aliases (`--text-on-dark-small`) are available. If Sprint 1 only landed CSS-var aliases without Tailwind utilities, T15 falls back to inline `text-[color:var(...)]` writes. Sprint 1 also owns `error.tsx` / `not-found.tsx` scaffolds; T21 only polishes the visual treatment.
- **Sprint 1**: `axe-core` + Lighthouse CI scaffolding was installed in Sprint 1. T22 here only adds the route list, budget thresholds, and the CI step that fails the build. If Sprint 1 deferred this, T22 expands to full install.
- **Sprint 2**: Quiz pipeline alignment. T9 (aria-live + non-color cue) assumes the post-submit panel still exists in `FeedCard.tsx`. If Sprint 2 has converted to multiple-choice, T9 retargets the new component but the same semantics apply (status region, paired icon+text).
- **Sprint 3**: Auth + compliance. T6's "Sign in" pill in non-overlay header only renders when no session — depends on the existing NextAuth `useSession()` hook (already present).
- **Sprint 4**: Perf work. T3's `history.replaceState` on IntersectionObserver active-index change is safe regardless of whether `/feed` is `force-dynamic` or `revalidate=60` (URL rewrites don't trigger refetch). T19's sitemap query uses `prisma.snippet.findMany({ select: { externalId: true, updatedAt: true } })` — if Sprint 4 added `updatedAt` indexing, sitemap benefits but does not require it.
- **Sprint 4**: `loading.tsx` scaffolds. T21 is `not-found.tsx` polish only; `loading.tsx` is out of scope here.

## Tickets

---

### S5-T1 — Replace chevron-left hamburger with a real menu icon, extract a `NavTrigger` primitive

**Audit refs:** §04 F1, F2.

**Files:**
- `src/components/Header.tsx` (lines 45-54 — swap SVG path)
- New: `src/components/nav/NavTrigger.tsx` (extract reusable button)

**Acceptance:**
- The left-hand header button no longer uses the `M11.25 4L6 9l5.25 5` chevron path. It renders a three-line hamburger glyph (e.g. `M3 6h14M3 10h14M3 14h14` with `stroke-width="1.8"` `stroke-linecap="round"`).
- `aria-label` stays `"Open menu"`. `aria-expanded` and `aria-controls` (pointing at the SideMenu container id) are wired correctly.
- The `<button>` extracts into `src/components/nav/NavTrigger.tsx` so the same component is reused by the future desktop nav (T2). It accepts `onClick`, `isOpen`, `variant: "overlay" | "solid"`.
- Visual treatment unchanged for both `onFeed` (overlay) and non-feed (solid) variants.
- Touch target stays ≥44×44.

**Non-goals:** Drawer behaviour itself (already implemented). T11 will add the focus trap.

---

### S5-T2 — Persistent navigation: desktop horizontal bar, mobile bottom tab-bar

**Audit refs:** §04 F1, F3, F14.

**Files:**
- New: `src/components/nav/PrimaryNav.tsx` (desktop horizontal nav)
- New: `src/components/nav/MobileTabBar.tsx` (bottom tab-bar)
- `src/components/Header.tsx` (mount `PrimaryNav` at `md:` breakpoint; keep `NavTrigger` for mobile only)
- `src/app/layout.tsx` (mount `MobileTabBar` below `<main>` on `< md`)
- `src/components/SideMenu.tsx:27, 38, 51` (normalise pathname comparison per F14)

**Acceptance:**
- At `≥768px` (`md:` breakpoint and up) the header renders an inline `<nav aria-label="Primary">` containing three links: **Live feed** (`/feed`), **Archive** (`/feed/browse`), **Leaderboard** (`/leaderboard`). The mobile hamburger button is hidden at this breakpoint.
- At `<768px` a `MobileTabBar` sits fixed to the bottom of the viewport (above `env(safe-area-inset-bottom)`) with the same three destinations as 44×44 icon+label tiles. The hamburger remains as a fourth tab labelled "More" (opens `SideMenu`) — discoverable but not the only path.
- The active route is indicated by:
  - Desktop: a 2px bottom-border in `var(--primary)` plus `aria-current="page"` on the active link.
  - Mobile: a filled background pill on the active tab plus `aria-current="page"`.
- Visible focus ring on all nav items, `:focus-visible` outline 2px `var(--primary)` offset 2px.
- The `/feed` overlay header continues to work — `PrimaryNav` inherits `variant="overlay"` from `Header` and uses light text + `text-shadow` for legibility against video.
- Pathname comparison uses a helper `normalisePath(p)` that strips trailing slashes (fixes F14). All three call sites in `SideMenu.tsx` migrate to the helper.

**Non-goals:** Changing the marketing landing layout at `/`.

---

### S5-T3 — Deep-link feed by clip: sync visible clip to URL via `history.replaceState`

**Audit refs:** §04 F4, F13.

**Files:**
- `src/components/FeedPlayer.tsx` (IntersectionObserver active-index handler, ~lines 42-68)

**Acceptance:**
- When `IntersectionObserver` changes `activeIndex`, `FeedPlayer` calls `window.history.replaceState(null, "", "/feed/" + snippet.externalId)` so the URL bar always reflects the visible clip without pushing a history entry on every snap.
- On mount, `FeedPlayer` reads `window.location.pathname` and if it matches `/feed/{externalId}`, sets `activeIndex` to that clip's index and calls `scrollToIndex` after layout (use `requestAnimationFrame`).
- Refreshing on `/feed/{externalId}` is handled by T4's slug route, which renders the live `<FeedPlayer>` (not the single-clip page) when the request is to `/feed/{externalId}` *and* the user-agent supports the feed (i.e. the same component as `/feed` but with `initialClipExternalId` prop). See T4 for the routing.
- The activeIndex is persisted to `sessionStorage` keyed `feed:active:{count}` as a fallback for browsers that block `replaceState` in PWAs; on mount, sessionStorage wins only if no externalId is in the URL.
- Forward / back browser buttons do not refetch — `replaceState`, not `pushState`.

**Non-goals:** Building the share button (S5-T5) or the slug routing (S5-T4).

---

### S5-T4 — Switch `/feed/[id]` from CUID to `externalId` with 301 redirect for legacy URLs

**Audit refs:** §04 F20.

**Files:**
- Rename: `src/app/feed/[id]/page.tsx` → `src/app/feed/[slug]/page.tsx`
- `src/app/feed/[slug]/page.tsx` (lookup by `externalId`, fallback to CUID with `permanentRedirect()`)
- `prisma/schema.prisma` (confirm `Snippet.externalId` has `@unique` — add if missing)
- Migration: `prisma/migrations/*` for unique index if added
- All internal `href={\`/feed/${snippet.id}\`}` callers — replace with `externalId`:
  - `src/app/feed/browse/page.tsx`
  - `src/components/FeedCard.tsx` (any future share button)
  - `src/components/FeedPlayer.tsx` (T3 already uses externalId)

**Acceptance:**
- `/feed/{externalId}` resolves and renders the snippet detail page.
- `/feed/{cuid}` issues HTTP 308 (`permanentRedirect`) to `/feed/{externalId}`. Verified with a curl test in the testing plan.
- `prisma.snippet.findUnique({ where: { externalId: slug } })` is used; if null, fall through to `findUnique({ where: { id: slug } })` and redirect, else `notFound()`.
- `generateMetadata` uses externalId in the canonical link.
- All `Link href` references in the codebase are grep-clean for `/feed/${row.id}` or similar CUID patterns.
- A unique constraint exists on `Snippet.externalId` (verified: today externalId is the folder name and is unique by convention, but add the DB-level constraint to make this a guarantee). If a migration is needed, file it as `add_snippet_externalid_unique`.

**Non-goals:** Changing the database `Snippet.id` primary key.

---

### S5-T5 — Share button on feed cards + prev/next/share on `/feed/[externalId]`

**Audit refs:** §04 F4, F12.

**Files:**
- `src/components/FeedCard.tsx` (add Share button to floating panel header)
- `src/app/feed/[slug]/page.tsx` (add prev/next/share affordances)
- New: `src/components/ShareButton.tsx` (Web Share API + clipboard fallback)

**Acceptance:**
- `FeedCard` renders a Share button (icon + visually-hidden text "Share this clip") in the floating panel top-right, ≥44×44 touch target.
- Clicking Share calls `navigator.share({ url: "https://fish-spotter.vercel.app/feed/" + externalId, title })` if available, otherwise `navigator.clipboard.writeText(...)` and toasts "Link copied" via existing toast pattern (or inline aria-live announcement).
- On `/feed/[slug]`, a header strip renders three controls:
  - "← Previous clip" (Prisma cursor query: most recent snippet with `createdAt < this.createdAt`)
  - "Next clip →" (mirror)
  - "Share" (same component as above)
- Prev/next render as disabled buttons when no neighbour exists, with `aria-disabled="true"` and `tabIndex={-1}`.
- Existing "← Back to live feed" link stays but moves into the same strip.
- All four controls have visible focus rings and ≥44×44 hit areas.

**Non-goals:** Open Graph / Twitter Card metadata — out of scope; flagged for Sprint 6.

---

### S5-T6 — Cross-promotion CTAs: leaderboard and archive each link back to the feed

**Audit refs:** §04 F15.

**Files:**
- `src/app/leaderboard/page.tsx` (above the table)
- `src/app/feed/browse/page.tsx` (above the grid)

**Acceptance:**
- `/leaderboard` renders a primary CTA above the leaderboard table: `<Link href="/feed" class="pebl-button-primary">Start spotting</Link>` with `min-h-[44px]`.
- The empty-state copy ("Sign in and submit an observation") on `/leaderboard` becomes actual `<Link>` elements pointing at `/auth/signin?callbackUrl=/feed` and `/feed`.
- `/feed/browse` renders a paired primary + secondary CTA above the grid: "Open live feed" → `/feed`, "Browse on map" (if applicable, stub allowed).
- Archive thumbnails link to `/feed/{externalId}` (T4 already updates the href).
- When `useSession()` returns no session, the non-overlay Header (T2) renders a "Sign in" pill in the top-right that points at `/auth/signin?callbackUrl={current path}`. Hidden on `/feed` (which keeps its own in-card sign-in prompt).

**Non-goals:** Restructuring the leaderboard table itself (Sprint 4 owns that).

---

### S5-T7 — Per-card metadata surface: site, depth, recording date

**Audit refs:** §02 (Card information hierarchy section).

**Files:**
- `src/components/FeedCard.tsx` (top-left overlay strip)

**Acceptance:**
- Each `FeedCard` renders a small metadata strip in the top-left of the video overlay containing three tokens:
  - **Site**: `snippet.site` (e.g. "ALG SC 11"). Format: humanise (replace `_` with space, title-case).
  - **Depth**: `{snippet.depthM} m` if `depthM != null`; otherwise hidden.
  - **Date**: formatted via T14's locale-aware formatter (e.g. "6 Jun 2024").
- Tokens are space-separated by a `·` (middle-dot, but inside a `<span aria-hidden>` and joined with " " for the AT name).
- The strip wraps in a small `<div role="group" aria-label="Clip context">` with a visually-hidden full sentence: `"Clip from {site}, {depthM} metres depth, recorded {date}"`.
- Background: `bg-[#17252A]/72` with `text-[color:#DEF2F1]` at 11px (T15-compatible contrast).
- Tap on the strip opens the existing `MapModal` (already wired for lat/lon) — adds discoverability for the map feature.
- Strip is hidden on the desktop centred panel layout when it would collide with the floating panel; mobile always shows it (top-left, above safe-area).

**Non-goals:** Building a separate sites/deployments taxonomy page.

---

### S5-T8 — Image alt-text audit across all components

**Audit refs:** §07 A11Y-17 (logos), §07 A11Y context for `SpeciesGallery`, sprint scope item 19.

**Files (grep walk):**
- `src/components/Header.tsx:64-69`
- `src/components/SideMenu.tsx:135-136`
- `src/components/SpeciesGallery.tsx:121-129` (and lightbox)
- `src/app/feed/browse/page.tsx:44-52`
- `src/components/FeedCard.tsx` (any `<img>` / poster)
- `src/app/page.tsx`

**Acceptance:**
- Every `<img>` / `next/image` either has a meaningful `alt` describing content, or `alt=""` + `aria-hidden="true"` if purely decorative — never both, never missing.
- PEBL wordmark in Header + SideMenu: keep `alt=""` + `aria-hidden` (the parent link already carries `aria-label="PEBL FishSpotter home"`).
- Species photos in `SpeciesGallery`: `alt` is `{scientificName} ({attribution})` — current pattern verified or updated.
- Archive grid thumbnails: `alt` is the same sentence as the metadata strip from T7.
- Video posters: `alt=""` because the `<video>` already carries `aria-label`.
- A grep test (`tests/a11y/img-alt.spec.ts`) parses every `<img` and `<Image` JSX usage with a Babel AST walk and fails if `alt` is absent (the build will already fail on bare `<img>` thanks to ESLint, but extend the rule to `next/image`).

**Non-goals:** Captioning the video clips themselves (Sprint 6+).

---

### S5-T9 — aria-live region for quiz feedback + non-color cue (icon + text label)

**Audit refs:** §07 A11Y-02, A11Y-03; Theme C.

**Files:**
- `src/components/FeedCard.tsx:957-1058` (post-submit panel)

**Acceptance:**
- The post-submit result block is wrapped in `<div role="status" aria-live="polite" aria-atomic="true">`.
- The result sentence is rewritten to always lead with a non-color textual cue:
  - Correct: `"Correct — {commonName}"`, preceded by a filled-circle `✓` icon (inline SVG, `aria-hidden`).
  - Incorrect: `"Not quite — was {staffAnswer}"`, preceded by an outlined-circle `✕` icon (inline SVG, `aria-hidden`).
- The two icons differ in **shape** (filled vs outlined), not just colour. Verified by switching to greyscale in DevTools — outcome is still distinguishable.
- The error path at line 833-839 keeps `role="alert"` (unchanged); the success path uses `role="status"` so the two announcements don't conflict.
- The shake animation (line 973) and panel pulse (line 734) remain as enhancements, gated by reduced-motion (T12).

**Non-goals:** Restructuring the quiz to multiple-choice (Sprint 2).

---

### S5-T10 — Real `<label>` for species input + autocomplete tokens on auth form

**Audit refs:** §07 A11Y-06, A11Y-15.

**Files:**
- `src/components/FeedCard.tsx:844-874` (species input)
- `src/components/IdGuideChat.tsx:42` (chat textarea — same pattern)
- `src/app/auth/signin/page.tsx` (email + password inputs)

**Acceptance:**
- Species input has a visually-hidden `<label htmlFor="species-answer-{cardId}">Species name</label>` immediately before the `<input>` (no `aria-label` substitute — a real label is more robust).
- Placeholder stays as `"e.g. ballan wrasse"` (an example, not a label).
- `autoComplete="off"` is retained.
- `IdGuideChat` textarea gets the same treatment: hidden `<label>` "Message" + visible placeholder.
- `/auth/signin` email input: `autoComplete="email"`, `inputMode="email"`, `<label>` "Email address" (visible).
- `/auth/signin` password input: `autoComplete="current-password"`, `<label>` "Password" (visible).
- `axe-core` `label` and `autocomplete-valid` rules pass on `/auth/signin` and `/feed`.

**Non-goals:** Building a sign-up form (Sprint 3).

---

### S5-T11 — Focus trap on `SideMenu` and `MapModal` (port the `SpeciesGallery` pattern)

**Audit refs:** §07 A11Y-10.

**Files:**
- Extract: `src/lib/hooks/useFocusTrap.ts` (port the in-line implementation from `SpeciesGallery.tsx:207-223`)
- `src/components/SideMenu.tsx` (apply hook)
- `src/components/MapModal.tsx` and/or `MapModalInner.tsx` (apply hook)
- `src/components/SpeciesGallery.tsx` (refactor to use the new shared hook — behaviour-preserving)

**Acceptance:**
- A `useFocusTrap(active: boolean, containerRef: RefObject<HTMLElement>)` hook is exported from `src/lib/hooks/useFocusTrap.ts`. It handles: focus into the first focusable on open, Tab/Shift-Tab cycle, Escape returns focus to the trigger.
- `SideMenu`: when `open`, Tab cycles only within the drawer; focus on the previously-focused element (the `NavTrigger`) is restored on close.
- `MapModal`: identical contract. Backdrop click + Escape close the modal and restore focus.
- `SpeciesGallery` is refactored to call the new hook — its existing tests pass unchanged.
- Background elements behind an open dialog get `inert` attribute (with a polyfill fallback for Firefox <125; React 18 doesn't support `inert` as a prop natively until React 19, so apply via `ref.setAttribute`).
- The drag handle on the floating panel (A11Y-09) is out of scope — flagged in §07 but not in this sprint.

**Non-goals:** Building a generic `<Dialog>` primitive (Sprint 1's design system owns that).

---

### S5-T12 — Reduced-motion guards across Framer Motion usage

**Audit refs:** §07 A11Y-14.

**Files:**
- `src/components/FeedCard.tsx:734-737` (`submitPulse` `boxShadow`), confetti (`PERF-03` already in Sprint 4 but the reduced-motion ternary applies here)
- `src/components/FeedPlayer.tsx:146-172` (nav hint)
- `src/components/SideMenu.tsx` (drawer slide-in)
- `src/components/IdGuideSheet.tsx`, `src/components/IdGuideWizard.tsx`
- `src/components/SnippetPlayer.tsx`
- New helper: `src/lib/hooks/useReducedMotion.ts` (thin wrapper over Framer's `useReducedMotion()` that always returns boolean even on SSR)

**Acceptance:**
- Every `motion.*` usage that animates `boxShadow`, `scale`, `y`, or `opacity` over more than 200ms reads `const reduceMotion = useReducedMotion()` and either:
  - skips the animation entirely (`transition={{ duration: 0 }}`), or
  - jumps directly to the end state.
- The confetti trigger in the correct-answer handler is gated: if `reduceMotion`, no confetti.
- The `setTimeout(onAdvance, 450)` in `FeedCard.tsx:506-515` becomes `setTimeout(onAdvance, reduceMotion ? 0 : 450)` (PERF-09 recommendation).
- A unit test renders `FeedCard` in JSDOM with `matchMedia('(prefers-reduced-motion: reduce)')` mocked to `true` and asserts no `transition` prop is set on the result panel.
- A `motion` prop audit is documented in `docs/a11y-motion-audit.md` (`grep` script output).

**Non-goals:** Removing Framer Motion entirely (PERF-01 is Sprint 4/6).

---

### S5-T13 — Heading hierarchy: every route has exactly one `<h1>`

**Audit refs:** §07 A11Y-11.

**Files:**
- `src/app/feed/page.tsx` (add `<h1 className="sr-only">Live FishSpotter feed</h1>`)
- `src/app/feed/[slug]/page.tsx` (add visible `<h1>` "Sighting: {site} {deployment}" or sr-only equivalent)
- `src/app/feed/browse/page.tsx` (audit — likely already has an `<h1>`)
- `src/app/leaderboard/page.tsx` (audit)
- `src/app/page.tsx` (audit)
- `src/app/auth/signin/page.tsx` (audit)
- `src/components/FeedCard.tsx` (add `<h2 className="sr-only">Clip from {site} {deployment}</h2>`)

**Acceptance:**
- Each `<article>` in `FeedCard` contains a visually-hidden `<h2>` with the site + deployment.
- Each top-level page has exactly one `<h1>` (verified by a Playwright spec that runs `page.locator('h1').count()` per route).
- Heading order on each route is monotonic: no `<h3>` without an `<h2>` ancestor.
- `axe-core` rules `heading-order` and `page-has-heading-one` pass on all routes.

**Non-goals:** Reworking the page-content layout.

---

### S5-T14 — Page titles, meta descriptions, locale-aware date formatting, `lang` audit

**Audit refs:** §07 A11Y-13, sprint scope items 15 + 18.

**Files:**
- `src/app/layout.tsx` (title template, `<html lang="en-GB">`)
- `src/app/page.tsx`, `src/app/feed/page.tsx`, `src/app/feed/browse/page.tsx`, `src/app/feed/[slug]/page.tsx`, `src/app/leaderboard/page.tsx`, `src/app/auth/signin/page.tsx` (each gets a route-specific `title` and `description` via `generateMetadata` or static `metadata` export)
- New: `src/lib/format/date.ts` (`formatRecordingDate(d: Date): string` returning `d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })`)

**Acceptance:**
- `<html lang="en-GB">` (en-GB, not en — matches UK CIC operating context).
- Title template in `layout.tsx` becomes `"%s - PEBL FishSpotter"` (hyphen, not middle-dot — A11Y-13 + user's banned em-dash rule respected).
- Each route exports a `metadata` (or `generateMetadata`) with:
  - `title`: short, route-specific (e.g. "Live feed", "Archive", "Leaderboard", "Sign in", "{site} {deployment}").
  - `description`: 140–160 chars, plain-English, no emoji.
- All snippet recording dates render via `formatRecordingDate` — used by T7 (per-card strip), T5 (snippet detail header), and `/feed/browse` archive grid.
- A grep test asserts no `new Date(...).toLocaleString()` without explicit locale + options anywhere in `src/`.

**Non-goals:** OpenGraph / Twitter Cards (Sprint 6).

---

### S5-T15 — Color contrast sweep: `#3AAFA9` no longer used as small text

**Audit refs:** §07 A11Y-01, contrast matrix; Theme C; user's colorblind preference.

**Files (per audit citations):**
- `src/components/FeedCard.tsx:986, 1037` (`text-[#3AAFA9]` on dark navy panel)
- `src/components/SideMenu.tsx:169, 198, 236`
- `src/app/leaderboard/page.tsx:58, 84, 86, 111`
- Anywhere else grep finds `text-\[#3AAFA9\]` or `text-\[color:var\(--primary\)\]` at `text-[10px]` / `text-[11px]` / `text-xs`

**Acceptance:**
- For text on **dark navy** (`#17252A`), small annotations (<14px) use `#DEF2F1` (light teal — 14.21:1). `#3AAFA9` is reserved for headings ≥14px.
- For text on **white** or **light teal**, small text uses `#17252A` (foreground) or `#2B7A78` (dark teal — 5.05:1 on white). `#3AAFA9` is never used as text on white/light-teal regardless of size.
- `pebl-button-primary` (teal background) keeps `#17252A` text — already correct in `globals.css:95-98`. No change.
- A new section is appended to `CLAUDE.md` (project root, not user-global) under "PEBL Brand Guidelines" → "Color × text-size matrix" reproducing the contrast matrix from §07 with bolded "DO / DON'T" rules.
- `axe-core` `color-contrast` rule passes on all six audited routes.

**Non-goals:** Redesigning the brand palette.

---

### S5-T16 — Skip-link target focus + paired toggle accessible names

**Audit refs:** §07 A11Y-04, A11Y-05, A11Y-12.

**Files:**
- `src/app/feed/page.tsx`, `src/app/feed/browse/page.tsx`, `src/app/leaderboard/page.tsx`, `src/app/feed/[slug]/page.tsx`, `src/app/page.tsx`, `src/app/auth/signin/page.tsx` (every `<main id="main">` gets `tabIndex={-1}`)
- `src/app/globals.css:115-129` (skip-link `:focus` background → `var(--foreground)` + colour → `var(--surface)`; `top: max(0.5rem, env(safe-area-inset-top))` per RESP-04)
- `src/components/FeedCard.tsx:660-708, 768-777` (rename collapsed-pill `aria-label` from `"Name this species"` → paired toggle `"Show identification panel"` / `"Hide identification panel"`, OR keep a single button with `aria-expanded`)

**Acceptance:**
- Every `<main id="main">` carries `tabIndex={-1}` and a `:focus-visible` outline.
- Skip link is visibly distinct against any background — solid `--foreground` background, white text — verified on `/feed` over video.
- Panel collapse/expand is either:
  - A single button with `aria-expanded={isOpen}` and one label "Identification panel", or
  - Two distinct elements with paired labels: "Show identification panel" / "Hide identification panel".
- Keyboard-only walkthrough (test plan §07): Tab from cold load activates skip link, Enter moves focus into `<main>`, next Tab lands on the first content control (not the header).

**Non-goals:** Skip-link styling beyond contrast (Sprint 1 owns the design token).

---

### S5-T17 — Touch target + hover-parity sweep (44×44, `active:` siblings, `focus-visible:`)

**Audit refs:** §07 A11Y-16, RESP-07.

**Files (per audit citations):**
- `src/components/FeedCard.tsx:875-883` (Skip button — `min-h-[44px]`)
- `src/components/FeedCard.tsx:768-777` (collapse caret — `min-h-[44px] min-w-[44px]`)
- Repo grep for `hover:` without adjacent `focus-visible:` or `active:` — apply pairs

**Acceptance:**
- No interactive control on any audited route is below 44×44 CSS pixels (`axe-core` `target-size` rule passes, AAA-2.2 best practice).
- Every `hover:` utility class in `src/components/` and `src/app/` is paired with either `focus-visible:` (same visual treatment) and `active:scale-[0.98]` (or equivalent tactile cue). A lint rule in `eslint-plugin-tailwindcss` config could enforce this — out of scope to add the rule, but the manual pass clears existing usage.
- `whileTap={{ scale: 0.98 }}` is added to every Framer `motion.button` that lacks it.

**Non-goals:** Adding gesture libraries.

---

### S5-T18 — Landscape orientation handling for portrait phones (RESP-06)

**Audit refs:** §07 RESP-06.

**Files:**
- `src/components/FeedCard.tsx:540-575` (video element + fullscreen affordance)
- `src/components/SettingsMenu.tsx` (add "Fit video: cover / contain" toggle, persisted to `localStorage`)

**Acceptance:**
- A new "Fullscreen" icon button is added to the floating panel, ≥44×44, calling `videoRef.current.requestFullscreen()` (with the `webkitRequestFullscreen` fallback for Safari/iOS). On iOS Safari that returns void: gracefully degrade to a toast "Use the iOS fullscreen control on the video".
- A "Fit video" toggle in `SettingsMenu` flips between `object-cover` (default — current behaviour) and `object-contain` (letterboxed). Persisted via `localStorage` key `fs:video-fit`. Read in `FeedCard` and applied as a className.
- On `orientationchange`, the `FeedPlayer` does *not* auto-rotate — leaves user in control.
- A landscape-aware test in Playwright at 932×430 (iPhone Pro Max landscape) confirms the floating panel does not collide with the metadata strip (T7).

**Non-goals:** Implementing a custom video controls UI.

---

### S5-T19 — `sitemap.ts` + `robots.ts`

**Audit refs:** §04 F16.

**Files:**
- New: `src/app/sitemap.ts`
- New: `src/app/robots.ts`

**Acceptance:**
- `src/app/sitemap.ts` exports a default async function returning a `MetadataRoute.Sitemap` with:
  - Static entries: `/`, `/feed`, `/feed/browse`, `/leaderboard` (priority 0.8, `changeFrequency: "daily"`).
  - Dynamic entries: one per `Snippet`, URL `/feed/{externalId}`, `lastModified: snippet.updatedAt ?? snippet.createdAt`, priority 0.6.
  - `/auth/*` is excluded.
- `src/app/robots.ts` exports a `MetadataRoute.Robots` allowing `User-agent: *` for `/`, disallowing `/api/`, `/auth/`, pointing `Sitemap` at `https://fish-spotter.vercel.app/sitemap.xml`.
- `https://fish-spotter.vercel.app/sitemap.xml` returns valid XML with all 30 snippet URLs.
- `https://fish-spotter.vercel.app/robots.txt` returns expected content.
- A Playwright spec fetches the sitemap, parses URLs, requests each, asserts 200 and non-empty `<h1>` (covers T13).

**Non-goals:** Open Graph / structured data (Sprint 6).

---

### S5-T20 — Service-worker route allowlist drift CI guard

**Audit refs:** §04 F8, sprint scope item 23.

**Files:**
- New: `scripts/test-sw-routes.ts`
- `package.json` (add `"test:sw-routes": "tsx scripts/test-sw-routes.ts"`)
- `.github/workflows/ci.yml` (or wherever CI runs) — add a step
- `public/sw.js:18-24` (add a header comment documenting the contract)

**Acceptance:**
- `scripts/test-sw-routes.ts` walks `src/app/` for `page.tsx` files, derives the route paths (`/feed/[slug]` → `/feed/*` pattern), and parses the `isPersonalisedRoute` body in `public/sw.js` (regex extracting the array of paths/prefixes). It asserts that every derived route is covered by exactly one prefix in the SW list. Exits non-zero on mismatch with a clear error message listing the missing routes.
- CI runs `npm run test:sw-routes` on every PR. A new top-level route added without updating `sw.js` fails the build.
- `public/sw.js` has a comment block above `isPersonalisedRoute` explaining the contract and pointing at the script.

**Non-goals:** Generating the SW list at build time (audit's option (b) — flagged for Sprint 6 if drift becomes painful).

---

### S5-T21 — `not-found.tsx` polish (assuming Sprint 1 added the scaffold)

**Audit refs:** §04 F5.

**Files:**
- `src/app/not-found.tsx` (re-style if Sprint 1 left a stub)
- New (optional): `src/app/feed/[slug]/not-found.tsx` (snippet-specific)

**Acceptance:**
- Default `not-found.tsx` renders the standard header + main layout, an `<h1>` "Page not found", a one-sentence explanation, and two CTAs: "Back to live feed" (`/feed`) and "Browse archive" (`/feed/browse`).
- PEBL branding (logo + colours) consistent with the design tokens from Sprint 1.
- Optional `feed/[slug]/not-found.tsx` renders snippet-specific copy: "This sighting may have been retired" + link back to `/feed/browse`.
- Mobile + desktop layouts verified at 375 / 1280.
- If Sprint 1 did not land the scaffold, this ticket grows to include creating it. Default assumption: Sprint 1 created the file with placeholder copy.

**Non-goals:** `error.tsx` (Sprint 1 territory).

---

### S5-T22 — axe-core CI gate + Lighthouse CI a11y budget

**Audit refs:** §07 testing plan (automated section); Theme C ("baseline axe-core + Lighthouse CI from day one").

**Files:**
- `tests/a11y/routes.spec.ts` (Playwright + `@axe-core/playwright`)
- `.lighthouserc.json` (a11y assertion ≥95 per route)
- `.github/workflows/ci.yml` (run both steps on every PR)
- `package.json` (`"test:a11y": "playwright test tests/a11y/"`)

**Acceptance:**
- The Playwright spec iterates the route list (`/`, `/feed`, `/feed/browse`, `/feed/{firstExternalId}`, `/leaderboard`, `/auth/signin`) at viewports 375 and 1280, runs `AxeBuilder.analyze()`, and fails on any `critical` or `serious` violation. The viewport matrix is data-driven so adding a route is one line.
- `.lighthouserc.json` asserts `categories:accessibility >= 0.95` for the same routes, mobile slow-4G profile.
- The CI workflow runs `npm run build && npm run start` and waits for `localhost:3000` before invoking either tool. Failures comment on the PR with the violation list.
- Local developers can run `npm run test:a11y` against `npm run dev`.
- A baseline run on the current `claude/angry-allen-76508d` branch is recorded as the pre-Sprint-5 violation count for comparison.

**Non-goals:** Visual regression (out of scope — Sprint 1).

---
