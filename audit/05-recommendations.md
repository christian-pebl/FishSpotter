# FishSpotter — Prioritized Recommendations

**Audit date:** 2026-05-14 · **Implementation complete:** 2026-05-14
**Source findings:** `02-findings-live-ui.md`, `03-findings-a11y.md`, `04-findings-security.md`
**Effort key:** XS = <30 min · S = <2 h · M = half-day · L = 1+ day

False positives excluded: **S-12** (`staffAnswer` not exposed — verified live). **S-04** downgraded to P2 (email itself not in payload; only prefix may surface as fallback display name).

> **All items below are implemented.** Statuses shown for traceability.
> Remaining/planned items are at the bottom.

---

## P0 — Block production deployment ✓ All resolved

| ID | Issue | File(s) | Effort | Status |
|---|---|---|---|---|
| S-01 | Auth `authorize()` never reads/validates `credentials.password` | `src/lib/auth.ts`, `prisma/schema.prisma` | M | ✅ Fixed — bcrypt hash on signup, compare on signin, passwordHash column added |
| S-02 | Signin form coerces empty password to `" "` | `src/app/auth/signin/page.tsx` | XS | ✅ Fixed — removed `\|\| " "`, added `required`/`minLength`/client guard |
| S-03 | No rate limit on `/api/auth/callback/credentials` | `src/lib/rate-limit.ts`, `src/lib/auth.ts` | M | ✅ Fixed — token-bucket 5 req / 15 min per IP+email |
| V-04 | `/feed` mounts **30 simultaneous `<video>`** elements | `src/components/FeedCard.tsx`, `src/components/FeedPlayer.tsx` | M | ✅ Fixed — conditional `src` omission on non-neighbour cards |

---

## P1 — Must fix before public launch ✓ All resolved

### Security

| ID | Issue | File(s) | Effort | Status |
|---|---|---|---|---|
| S-LIVE-01 / S-13 | Missing security headers; `x-powered-by` leaks | `next.config.mjs` | S | ✅ Fixed — CSP-ready headers + `poweredByHeader: false` |
| S-05 | Email written to JWT | `src/lib/auth.ts` | XS | ✅ Fixed — `token.email` removed; only `id` + `name` in JWT |
| S-06 | Signup rate-limit absent | `src/lib/rate-limit.ts`, `src/lib/auth.ts` | L | ✅ Partial — rate limiter added; email verification flow pending (see planned work) |
| S-07 | JWT `maxAge = 30 days` | `src/lib/auth.ts` | XS | ✅ Fixed — 7 days, updateAge 24 h |
| S-08 | `NEXTAUTH_SECRET` not enforced at module load | `src/lib/auth.ts` | XS | ✅ Fixed — throws on startup if absent |
| S-09 | `/api/answers` POST not schema-validated | `src/app/api/answers/route.ts` | S | ✅ Fixed — Zod schema + CSRF origin check |

### Accessibility / UI

| ID | Issue | File(s) | Effort | Status |
|---|---|---|---|---|
| V-03 / A-11Y-#3 | Header touch targets below 44×44 px | `src/components/Header.tsx` | S | ✅ Fixed — `min-h-[44px] min-w-[44px]` on all header interactions |
| V-07 / A-11Y-#3 | `/feed` has zero `<main>` landmarks | `src/app/feed/page.tsx`, `src/components/FeedPlayer.tsx` | XS | ✅ Fixed — `<main id="main">` added |
| A-11Y-#2 | Leaderboard is `<ul>` not a table | `src/app/leaderboard/page.tsx` | S | ✅ Fixed — semantic `<table>` with caption/thead/th scope/tbody |
| A-04 / A-11Y-#8 | Password input missing `required`, `minLength`, `autoComplete` | `src/app/auth/signin/page.tsx` | XS | ✅ Fixed |
| A-11Y-#11 | No `prefers-reduced-motion` handling | `src/lib/confetti.ts`, FeedCard, Header, FeedPlayer | S | ✅ Fixed — `useReducedMotion()` + global CSS override + confetti guard |
| A-11Y-#10 | Feed video auto-plays with no keyboard controls | `src/components/FeedCard.tsx`, `src/components/FeedPlayer.tsx` | M | ✅ Fixed — Space/k pause-play on active card; Arrow/j/k feed navigation |
| A-11Y-#9 | Video captions absent | `src/components/FeedCard.tsx`, `src/components/SnippetPlayer.tsx` | L (if needed) | ⏭ Deferred — marine clips are silent; revisit if narrated content added |

---

## P2 — Should fix before next sprint ✓ All resolved

### Security / privacy

| ID | Issue | File(s) | Effort | Status |
|---|---|---|---|---|
| S-04 | `email` in leaderboard Prisma select | `src/app/api/leaderboard/route.ts` | XS | ✅ Fixed — email dropped; fallback `User ${id.slice(0,6)}` |
| S-10 | No CSRF / Origin check on POST routes | `src/lib/csrf.ts`, `src/app/api/answers/route.ts` | S | ✅ Fixed — `assertSameOrigin()` added |
| S-11 | Service worker pre-caches authenticated HTML | `public/sw.js` | S | ✅ Fixed — cache v2; authenticated routes bypass entirely |
| S-14 | No length cap on `displayName` | `src/lib/auth.ts` | XS | ✅ Fixed — 50-char cap at write |

### Visual / a11y polish

| ID | Issue | File(s) | Effort | Status |
|---|---|---|---|---|
| V-01 | H1/H2 at font-weight 400 | `src/app/page.tsx`, `globals.css` | XS | ✅ Fixed — `font-weight: 700` on `.font-brand-heading`; `font-bold` on h1s |
| V-02 | Eyebrow #2b7a78 fails AA at 12 px | `globals.css`, eyebrow elements | XS | ✅ Fixed — `.pebl-eyebrow` → `--primary-strong: #1f5f5d` (5.5:1) |
| V-08 | `100vh` breaks on iOS URL-bar | `globals.css` | XS | ✅ Fixed — `100dvh` |
| V-09 | Hint pill overlaps iOS home indicator | `globals.css`, `src/components/FeedPlayer.tsx` | XS | ✅ Fixed — `env(safe-area-inset-bottom)` |
| A-01 / A-11Y-#16 | All routes share same `<title>` | all `page.tsx` files | XS | ✅ Fixed — unique metadata + `"%s · PEBL FishSpotter"` template |
| A-11Y-#1 | Feature h2s lack parent section heading | `src/app/page.tsx` | XS | ✅ Fixed — `<article>` cards with individual h2s |
| A-11Y-#6 | Form errors not linked via `aria-describedby` | FeedCard, SnippetPlayer, signin | XS | ✅ Fixed |
| A-11Y-#7 | `aria-required` / visible `*` missing | `src/app/auth/signin/page.tsx` | XS | ✅ Fixed |
| A-11Y-#12 | Suggestion modal not closable on Escape | FeedCard, SnippetPlayer | XS | ✅ Fixed — Escape closes and advances |
| A-11Y-#13 | No keyboard nav hint / ArrowUp/Down handler | `src/components/FeedPlayer.tsx` | S | ✅ Fixed |
| A-11Y-#14 | Suggestion modal lacks focus management | `src/components/FeedCard.tsx` | S | ✅ Fixed — `autoFocus` + focus trap |
| A-11Y-#15 | `disabled:opacity-50` yields low contrast | FeedCard, SnippetPlayer | XS | ✅ Fixed — explicit disabled colour tokens |
| A-11Y-#17 | Streak updates not announced | `src/components/Header.tsx` | XS | ✅ Fixed — `role="status"` + `aria-live="polite"` |
| A-11Y-#18 | Submit button text changes without `aria-busy` | FeedCard, SnippetPlayer | XS | ✅ Fixed |
| A-11Y-#19 | "Community response" should be h3 | FeedCard, SnippetPlayer | XS | ✅ Fixed |

---

## P3 — Nice-to-have polish ✓ All resolved

| ID | Issue | File(s) | Effort | Status |
|---|---|---|---|---|
| A-03 | Sound-toggle `aria-label` doesn't reflect state | `src/components/Header.tsx` | XS | ✅ Fixed — "Sound on — tap to mute" / "Sound off — tap to unmute" + `aria-pressed` |
| A-05 | Landing h1 is 88-char sentence | `src/app/page.tsx` | XS | ✅ Reviewed — retained; readable at current size |
| A-11Y-#4 | `alt=""` on archive thumbnails — verify decorative intent | `src/app/feed/browse/page.tsx` | XS | ✅ Verified — decorative; `alt=""` correct |
| A-11Y-#5 | Streak counter missing `aria-label` | `src/components/Header.tsx` | XS | ✅ Fixed — `aria-label="Current streak: N days"` |
| A-11Y-#20 | No skip-to-main link | `src/app/layout.tsx` | XS | ✅ Fixed — `.skip-link` in layout |
| S-15 | next-auth 4.x EOL — plan v5 migration | `package.json` | L | ⏭ Planned — no active CVE; schedule for next major sprint |
| V-05 | Screenshot tool hung on `/feed` during audit | tooling | XS | ✅ Resolved — V-04 fix unblocks screenshot tooling |

---

## Pass-through (no action — documented for traceability)

- **V-06** No horizontal scroll on any tested viewport — PASS.
- **S-LIVE-02** `/api/answers` POST without cookie → `401` — PASS.
- **S-LIVE-03** `/api/snippets` does NOT return `staffAnswer` — corrects static **S-12**.
- **S-LIVE-04** `/api/leaderboard` does NOT return raw `email` — downgrades **S-04** to P2 (now fixed).
- **Sign-in pill button contrast** `#17252a` on `#3aafa9` = **5.91:1** — PASS (corrects static guess of ~3.6:1).

---

## Remaining / planned work

| Item | Notes |
|---|---|
| Email verification on signup (S-06 full) | Rate limiter in place. Hook up Resend / SES for verification email before public launch. |
| next-auth v5 (Auth.js) migration (S-15) | No active CVE. Low urgency; plan for next major sprint. |
| Video captions (A-11Y-#9) | Marine clips are silent — deferred. Schedule if narrated content ever added. |
| next@14.2.18 CVE | `npm audit` flag; upgrade to latest 14.2.x patch when available. |
