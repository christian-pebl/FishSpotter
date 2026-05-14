# FishSpotter QA Test Plan

Worktree: `C:\Users\Christian Abulhawa\FishSpotter\.claude\worktrees\modest-bhabha-6c4886`
Base URL: `http://localhost:3000`
Driver: Claude Preview MCP (resize, screenshot, inspect, click/fill, console/network, accessibility snapshot)
Date: 2026-05-14

---

## 1. Route inventory

| # | Route | Source | Notes |
|---|---|---|---|
| R1 | `/` | `src/app/page.tsx` | Landing — hero + 3-card feature grid |
| R2 | `/feed` | `src/app/feed/page.tsx` | Main game, vertical snap feed, `force-dynamic`, requires DB |
| R3 | `/feed/browse` | `src/app/feed/browse/page.tsx` | Archive grid (1/2/3 cols responsive), `force-dynamic` |
| R4 | `/feed/[id]` | `src/app/feed/[id]/page.tsx` | Single-snippet detail |
| R5 | `/leaderboard` | `src/app/leaderboard/page.tsx` | Top 50 list, `force-dynamic` |
| R6 | `/auth/signin` | `src/app/auth/signin/page.tsx` | Combined sign-in / sign-up form |
| R7 | `/auth/signin?callbackUrl=/feed` | same | Verify callback param honored |
| R8 | `/manifest.webmanifest` | `src/app/manifest.ts` | PWA manifest JSON |
| R9 | `/api/snippets`, `/api/answers`, `/api/streak`, `/api/leaderboard`, `/api/auth/*` | `src/app/api/**` | Inspect via network panel and direct GETs |

## 2. Viewport matrix

- **Desktop**: 1280×800
- **Tablet**: 768×1024
- **Mobile**: 375×812

For each route × viewport: resize, screenshot, snapshot (a11y tree), targeted inspect calls.

## 3. Visual polish checklist

### Typography
- Body font: `Roboto` via `next/font`, weights 300/400/500/700
- Heading font (`.font-brand-heading`): `Futura, "Trebuchet MS", Arial, sans-serif`; letter-spacing `-0.02em`
- Inspect each route's h1:
  - R1: `text-4xl md:text-6xl` → 36/60px mobile/desktop, leading-tight
  - R2 header: `text-lg` → 18px
  - R2 FeedCard h2: `text-2xl` → 24px
  - R3/R5/R6: `text-3xl` → 30px
- Eyebrow labels: `tracking-[0.2em]`–`[0.26em]`, text-xs (12px), font-semibold, color `var(--primary)` `#2b7a78`
- Body: text-sm/base (14/16px), leading-6/7
- Buttons: text-sm (14px), font-semibold, pill (rounded-full)

### Color palette (from globals.css)
- `--background: #def2f1`
- `--foreground: #17252a`
- `--primary: #2b7a78`
- `--accent: #3aafa9`
- `--surface: #ffffff`
- `--surface-muted: #eef9f8`
- `--border: rgba(23,37,42,0.12)`
- `--muted: rgba(23,37,42,0.72)`

### Overflow / clipping
- Body has `overflow-hidden h-screen`; flex-1 children must scroll internally
- /feed `<aside>` `max-h-[46vh]` on mobile with overflow-y-auto
- Header logo + nav must not wrap on 375px

### Hover / focus
- `.pebl-button-primary:hover` → bg `#2b9d97`
- Cards: `hover:-translate-y-0.5 hover:border-[color:var(--primary)]`
- No global `:focus-visible` rule — expected finding

## 4. Layout glitch checklist

1. Horizontal scroll — `document.documentElement.scrollWidth - clientWidth` must be ≤ 0
2. Overlap detection — Header z-stack vs first content child
3. Touch targets — flag any < 44px on mobile (likely sound toggle ~30px)
4. Responsive breakpoints — md=768px
5. Z-index — nav hint pill z-30 over video
6. Video player chrome — `<video>` has no controls attr (correct)
7. Snap scroll — verify snap-mandatory works
8. Long text — set 60-char display name on leaderboard, verify truncation
9. Empty states — feed/browse/leaderboard with 0 entries
10. iOS safe-area — no `env(safe-area-inset-*)` in CSS; bottom-3 hint may collide with home indicator

## 5. User flow scripts

- **Flow A** — Landing to feed: `/` → click "Start spotting" → wait for video ready → screenshot
- **Flow B** — Submit guess (unauth): /feed → fill species input → click confirm → capture POST /api/answers
- **Flow C** — Signup + submit + streak: /auth/signin → toggle signup → fill → submit → verify streak increments
- **Flow D** — Scroll feed: verify only one video plays at a time after IntersectionObserver swap
- **Flow E** — Confetti on correct answer + verify reduced-motion respect
- **Flow F** — Archive → detail → back
- **Flow G** — Leaderboard
- **Flow H** — Sounds toggle (localStorage flip + event)
- **Flow I** — PWA: manifest validity, sw.js registration
- **Flow J** — Error states: /feed/nonexistent → 404; direct /api/snippets → JSON

## 6. Accessibility audit (DOM-level)

### 6.1 Document-level
- `document.documentElement.lang` must be "en"
- `document.title` non-empty per route
- Exactly one `<main>` per page (note: /feed has no `<main>` — finding)

### 6.2 Headings
- Exactly one h1 per route; no skips
- /feed: h1 "Recent sightings" then h2 "What species is this?" per card

### 6.3 Landmarks
- header, main, nav present; footer absent (informational)

### 6.4 Images
- Header logo `alt="PEBL FishSpotter"` ✓
- Browse thumbnails `alt=""` — decorative, OK given card text

### 6.6 Forms
- /auth/signin inputs have htmlFor ✓
- /feed species input has htmlFor ✓

### 6.7 Keyboard
- Tab through; verify no focus trap; Enter submits in species input

### 6.8 Focus-visible
- No global :focus-visible rule — expected finding for pill buttons

### 6.9 Color contrast — compute via eval

```js
function L(rgb){const [r,g,b]=rgb.match(/\d+/g).map(Number).map(c=>{c/=255;return c<=.03928?c/12.92:((c+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b}
function ratio(fg,bg){const a=L(fg),b=L(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}
```

Suspect pairs:
- primary `#2b7a78` on background `#def2f1` — ~4.0:1 (likely fails AA-normal)
- button-primary text `#17252a` on `#3aafa9` accent — ~3.6:1 (likely fails AA-normal)
- White on `#3aafa9` confirm button — ~2.5:1 (fails)

### 6.10 Reduced motion
- `matchMedia('(prefers-reduced-motion: reduce)').matches` — code uses framer-motion + canvas-confetti with no `useReducedMotion` guard. Finding.

## 7. Security observations (live app)

### 7.1 Response headers — assert presence on `/`, `/feed`, `/api/snippets`, `/api/auth/session`

| Header | Expected | Likely default |
|---|---|---|
| Content-Security-Policy | restrictive | Not set |
| X-Frame-Options | DENY/SAMEORIGIN | Not set |
| Strict-Transport-Security | max-age=... | N/A localhost |
| X-Content-Type-Options | nosniff | Not set |
| Referrer-Policy | strict-origin-when-cross-origin | Default |
| Permissions-Policy | restrictive | Not set |
| X-Powered-By | absent | Often leaks "Next.js" |

### 7.2 Cookies
- next-auth.session-token: HttpOnly, SameSite, Secure (prod), Path=/

### 7.4 Exposed API routes
- /api/snippets — returns staffAnswer (gameplay-security finding)
- /api/answers — must require auth
- /api/leaderboard — public OK, but verify no emails leak
- /api/streak — auth-only, caller's data only

### 7.7 Auth implementation
- signin/page.tsx passes `password: password || " "` — empty allowed
- isSignUp flag passed as form field
- No rate limiting

## 8. Output schema

```
audit/
  01-test-plan.md
  02-findings-visual.md
  03-findings-a11y.md
  04-findings-security.md
  05-recommendations.md
  screenshots/
    {route-slug}-{viewport}.jpg
  raw/
    headers-{route}.json
    console-{route}.txt
    contrast-measurements.csv
```

### Finding format

```
### F-{NN} {short title}
- Severity: P0 | P1 | P2 | P3
- Route: /feed
- Viewport: mobile (375x812) | all
- Evidence: audit/screenshots/...
- Observation: <measured values>
- Expected: <what should be true>
- Recommendation: <concrete fix, file paths>
```
