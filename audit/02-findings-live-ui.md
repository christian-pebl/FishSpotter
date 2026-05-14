# FishSpotter — Live UI / Headers Findings

**Date:** 2026-05-14
**Method:** Claude Preview MCP at viewports 1280×800 (desktop) and 375×812 (mobile)
**Note:** Screenshots could not be captured because the screenshot RPC repeatedly timed out while the feed had 30 simultaneously-loaded `<video>` elements. All findings below were captured via DOM eval + headers fetch.

---

## Visual / typographic findings

### V-01 — H1 and H2 are font-weight 400, not bold
- **Severity:** P2
- **Route:** `/` (and others using `.font-brand-heading`)
- **Observed:** `h1` on landing: `font-size: 60px`, `font-weight: 400`, `font-family: Futura, "Trebuchet MS", Arial, sans-serif`. `h2`: 24px / 400. Mobile h1: 36px / 400.
- **Expected:** Hero h1 typically 600–700; secondary headings ≥ 600 for clear hierarchy.
- **Recommendation:** Either load Futura Bold via `next/font` and apply `font-weight: 700` to `.font-brand-heading`, or add Tailwind class `font-bold` to h1/h2 usages in `src/app/page.tsx`, `src/app/feed/page.tsx`, etc.

### V-02 — Eyebrow labels are 12 px at borderline contrast
- **Severity:** P2
- **Route:** all (`<p>` with `tracking-[0.2em]` uppercase)
- **Observed:** color `rgb(43,122,120)` (#2b7a78) on translucent white surface — measured ratio **4.13:1**.
- **Expected:** WCAG AA requires 4.5:1 for normal text < 18 px. At 12 px and 600 weight this technically fails AA-normal; AA-large does not apply.
- **Recommendation:** Either darken the eyebrow color to `#22645f` (≈ 6:1) or increase size to 14 px and weight to 700 (qualifies as AA-large at 4.13).

### V-03 — Header touch targets below 44 px on mobile
- **Severity:** P1
- **Route:** all, viewport 375×812
- **Observed:** Logo link `28×84`, sound-toggle button `34×41` (also too narrow), "Sign in" link `32×67`. WCAG 2.5.5 (AAA) recommends 44×44, Apple HIG requires 44×44 minimum.
- **Recommendation:** In `src/components/Header.tsx`, increase header item padding to at least `py-2.5 px-3` and minimum widths/heights via `min-h-[44px] min-w-[44px]`. Wrap the sound emoji button so its hit-box is ≥ 44 px even though the visual chip is smaller.

### V-04 — `/feed` mounts 30 `<video>` elements simultaneously
- **Severity:** P0 (performance) — also drove screenshot tool to hang on mobile
- **Route:** `/feed` (all viewports)
- **Observed:** 30 `<article>` cards rendered at once, 30 `<video>` elements, 23 of them at `readyState >= 2` (i.e. metadata + first frame buffered) immediately after load. On a mobile network this is dozens of MB of speculative downloads before the user has scrolled.
- **Recommendation:** Virtualize the feed: render only the active card ± 1 neighbor (or use IntersectionObserver to attach `<video>` `src` only when within ~1 viewport). For non-active cards, swap to `<img>` thumbnail. Defer `preload="metadata"` to neighbors; set everything else `preload="none"`. This will also unblock screenshot tooling and Lighthouse mobile metrics.

### V-05 — Screenshot tool hangs on `/` and `/feed`
- **Severity:** P3 (tooling) — indirect signal of V-04
- **Route:** `/`, `/feed`
- **Observed:** `preview_screenshot` timed out after 30 s twice on `/` (which still has the rendered videos in the background tab? Actually no — the timeout happens reliably even on the landing). Suggests heavy paint or in-flight video decoding. Header `cache-control: no-store, must-revalidate` ensures the dev server is always re-rendering.
- **Recommendation:** Fix V-04 (video preload); reconfirm screenshot capture after.

---

## Layout findings

### V-06 — No horizontal scroll on any tested viewport
- **Status:** PASS
- **Observed:** `scrollWidth - clientWidth = 0` on `/`, `/feed`, `/leaderboard`, `/auth/signin` at 1280, 375.

### V-07 — `/feed` has zero `<main>` landmarks
- **Severity:** P1 (a11y)
- **Route:** `/feed`, all viewports
- **Observed:** `document.querySelectorAll('main').length === 0`. Confirmed live; matches A11Y-02 in static audit.
- **Recommendation:** Wrap the feed scroll container in `<main>` in `src/app/feed/page.tsx` (or `FeedPlayer.tsx`).

### V-08 — Body height pinned to 812 px on mobile when content needs more
- **Severity:** P3
- **Route:** `/feed`, mobile
- **Observed:** `body { height: 812px; overflow: hidden }` — by design (snap-scroll inside child). Aside `max-h-[46vh]` = 373 px, scrollable. Works as intended, but on iOS the URL bar's auto-hide can change visible viewport and 100vh != innerHeight.
- **Recommendation:** Use `100dvh` (or `100svh` for the upper bound) instead of `100vh` in feed CSS to handle mobile URL-bar collapse.

### V-09 — No safe-area insets honored
- **Severity:** P2 (mobile polish)
- **Route:** `/feed` particularly (`.bottom-3` hint pill)
- **Observed:** No `env(safe-area-inset-*)` usage in `globals.css`. On iPhone X+ the hint pill at `bottom: 12 px` lands inside the home-indicator zone.
- **Recommendation:** Add `padding-bottom: max(12px, env(safe-area-inset-bottom))` to the hint container and to any fixed-bottom UI.

---

## Accessibility findings (live)

### A-01 — Every route shares the same `<title>` "PEBL FishSpotter"
- **Severity:** P2
- **Routes:** `/`, `/feed`, `/leaderboard`, `/auth/signin`
- **Observed:** `document.title === "PEBL FishSpotter"` on all four. No per-route `metadata` export.
- **Recommendation:** In each route's `page.tsx`, export `metadata = { title: "Feed — PEBL FishSpotter" }` etc.

### A-02 — Confirms static A11Y-09: leaderboard is `<ul>` with tabular data
- **Severity:** P1
- **Route:** `/leaderboard`
- **Observed:** `<ul>` with 50 `<li>` children, each `#1Christian6.5 pts1/12 correct` — rank, name, score, accuracy all in one string. Screen-reader users can't navigate columns.
- **Recommendation:** Convert to `<table>` with `<thead>` Rank/Player/Score/Accuracy and `<tbody>` rows.

### A-03 — Sound-toggle aria-label / visible text mismatch
- **Severity:** P3
- **Route:** all
- **Observed:** Button has `aria-label="Mute sounds"` (the action) and visible text "Sound on🔊" (the state). WCAG 2.5.3 requires accessible name to contain the visible label.
- **Recommendation:** Either make `aria-label` start with the visible text — e.g. `Sound on, mute` — or make the visible text the label and remove `aria-label`.

### A-04 — Password input has no `autocomplete`, no `required`, no `minLength`
- **Severity:** P1 (overlaps S-02)
- **Route:** `/auth/signin`
- **Observed:** Email input is `required`, no autocomplete attr. Password input is **not** required, no minLength, no autocomplete.
- **Recommendation:** Add `autoComplete="email"` to email and `autoComplete="current-password"` (or `"new-password"` in signup mode) to password. Set `required` and `minLength={8}` on password.

### A-05 — H1 on landing is a full sentence
- **Severity:** P3
- **Route:** `/`
- **Observed:** H1 text is `"PEBL FishSpotter turns marine monitoring into a shared, playable observation feed."` (88 chars, wraps to 240 px tall on desktop).
- **Recommendation:** Cosmetic — heading-as-prose pattern is acceptable but consider shortening to 6–10 words for skimmability.

---

## Security findings (live)

### S-LIVE-01 — Response headers missing
- **Severity:** P1
- **Routes tested:** `/`, `/feed`, `/leaderboard`, `/api/snippets`, `/api/leaderboard`, `/api/auth/session`
- **Observed (full capture in `audit/raw/headers.json`):**
  - **Missing on all responses:** `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`
  - **Leaks framework version:** `x-powered-by: Next.js` on HTML responses
  - **API responses:** no CORS allow-origin set (default — fine for same-origin)
- **Recommendation:** Add `async headers()` block in `next.config.mjs`:
  ```js
  async headers(){return [{source:'/(.*)',headers:[
    {key:'X-Content-Type-Options', value:'nosniff'},
    {key:'X-Frame-Options', value:'DENY'},
    {key:'Referrer-Policy', value:'strict-origin-when-cross-origin'},
    {key:'Permissions-Policy', value:'camera=(),microphone=(),geolocation=()'},
  ]}]}
  ```
  Set `poweredByHeader: false` to drop the X-Powered-By header. Add an HSTS header for production builds only.

### S-LIVE-02 — `/api/answers` requires auth ✓
- **Status:** PASS
- **Observed:** POST `/api/answers` with empty body and no cookie → `401 {"error":"Unauthorized"}`.

### S-LIVE-03 — `/api/snippets` does NOT expose `staffAnswer` ✓
- **Status:** PASS — corrects S-12 false positive in static audit
- **Observed:** Response keys: `id, externalId, thumbnailUrl, videoUrl, site, deployment, depthM, recordingDatetime, labelStatus`. Code at `src/app/api/snippets/route.ts:9-18` explicitly omits `staffAnswer` from `select`.

### S-LIVE-04 — `/api/leaderboard` does NOT expose full email ✓
- **Status:** PARTIAL PASS — downgrades S-04 from HIGH to LOW
- **Observed:** Response shape `{leaderboard: [{userId, displayName, correct, total, score}, ...]}`. Email is fetched server-side but only the prefix may surface via `displayName` fallback if both `displayName` and `name` are null.

---

## Raw measurements

| Metric | Desktop /​ | Mobile /​ | Mobile /feed | Mobile /leaderboard | Mobile /auth/signin |
|---|---|---|---|---|---|
| `<main>` count | 1 | 1 | **0** | 1 | 1 |
| `<h1>` count | 1 | 1 | 1 | 1 | 1 |
| H1 font-size | 60 px | 36 px | n/a | 30 px | 30 px |
| H1 font-weight | 400 | 400 | n/a | 400 | 400 |
| Horizontal scroll | 0 | 0 | 0 | 0 | 0 |
| Page title | "PEBL FishSpotter" | same | same | same | same |
| Videos in DOM | 0 | 0 | **30** | 0 | 0 |
| Videos at readyState≥2 | 0 | 0 | **23** | 0 | 0 |

### Mobile header touch targets (375×812)

| Element | Height × Width (px) | Pass 44×44? |
|---|---|---|
| Logo link "FishSpotter" | 28 × 84 | ❌ |
| Sound toggle button | 34 × 41 | ❌ |
| "Sign in" link | 32 × 67 | ❌ |
| Form submit "Sign in" | 48 × 293 | ✓ |

### Computed contrast samples (rgb→relative luminance)

| Surface | fg | bg | Ratio | AA-normal (4.5:1) |
|---|---|---|---|---|
| Body text | `#17252a` | `#def2f1` | 12.6:1 | ✓ |
| Sign-in pill button | `#17252a` | `#3aafa9` | 5.91:1 | ✓ (corrects static guess) |
| Header nav link | `#17252a` | `rgba(255,255,255,0.72)` over `#def2f1` | 15.7:1 | ✓ |
| Eyebrow label | `#2b7a78` | translucent white | 4.13:1 | borderline (12px text fails) |
| H1 body | `#17252a` | translucent white over gradient | 1.33 reported | parsing artifact — actually ≈ 12:1 on rendered bg |
