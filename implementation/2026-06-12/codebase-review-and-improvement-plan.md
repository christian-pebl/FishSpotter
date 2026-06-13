# FishSpotter Codebase Review & Improvement Plan

**Date:** 12 June 2026
**Scope:** Full-codebase review across security, performance, UX/accessibility, architecture/maintainability, and production-readiness. Read-only audit (no code changed). Findings grounded in `file:line` evidence.
**Method:** Five parallel deep-dive reviews, each adversarially grounded in the actual code, then synthesised and the two load-bearing claims re-verified by hand.

---

## Verdict

FishSpotter is a genuinely mature, security-conscious app, well ahead of a typical side-project build. The auth token flows are textbook-correct (cryptographically random, hashed at rest, single-use, expiring), there is no IDOR anywhere across ~30 API routes, RLS is a real CI-checkable invariant, GDPR erasure and export are real (not theatre), zod validates almost every API boundary, TypeScript is strictly typed with zero `any` in `src`, the `@/` import discipline is 100%, and the 2 June design-audit backlog is closed.

The gaps are **concentrated, not a long tail of sloppiness.** They cluster into three stories:

1. **"Built but not wired."** The hardest infrastructure already exists; it just is not connected. The feed-pagination route (`/api/feed`) and lazy-bbox route (`/api/snippets/[id]/bbox`) are written but unused. The web-vitals sampler beacons data to `/api/vitals`, which discards it. The `error.tsx` / `global-error.tsx` boundaries exist but swallow to `console`. The `MapModal` already demonstrates the `next/dynamic` code-split technique that the feed bundle does not use. The pre-push quality gate is documented in CLAUDE.md but not enforced in CI.

2. **No safety net, flying blind.** `main` auto-deploys to Vercel, yet no CI runs `tsc`, the unit tests that guard the scoring/consensus invariants, or the lint gates. There is no error tracking (Sentry), so a route that starts 500ing or a cron that fails silently surfaces nowhere until a user emails in.

3. **The feed is the engineering centre of gravity, and it carries the most debt.** `FeedCard.tsx` (1,622 lines) is the one true god component; the feed loads the entire clip corpus and mounts every card at once; and a video that fails to load degrades to a silent black box.

None of this is a rewrite. This is roughly two to three focused weeks of work to cross from "impressively built" to "production-grade professional."

---

## What is already strong (do not re-spend effort here)

- **Auth & secrets:** bcrypt cost 12; 256-bit random tokens stored as SHA-256, single-use, expiring; no account enumeration on forgot-password; no committed secrets (only `.env.example` placeholders are tracked).
- **Authorization:** no IDOR found; every user-data route scopes to `session.user.id`; admin gate enforced server-side on every action with cross-species tamper checks.
- **RLS:** `prisma/rls.sql` covers all current and future public tables; `enable-rls.ts --check` is a CI-able gate (and `rls-audit.yml` runs it).
- **GDPR:** real Art.17 hard-delete with verified `onDelete: Cascade`, Art.20 export, cookie consent.
- **Type safety & conventions:** `strict: true`, zero `any` in `src`, no `@ts-ignore`, 100% `@/` imports, build does not ignore type/lint errors.
- **Resilience baseline:** `error.tsx` / `global-error.tsx` / `not-found.tsx` / route `loading.tsx` all present and on-brand; OBIS/GBIF use retry-with-backoff; email never throws into the caller.
- **UX baseline:** reveal feedback is in-place and colorblind-safe; `useModalFocus` applied; `inert` on off-screen cards; reduced-motion handled globally; `SpeciesGallery` has a gold-standard idle/loading/empty/error/retry machine.
- **Pure-logic test coverage:** scoring (`answer-matching`), narrowing, consensus, catalogue-validation, streak, leaderboard, feed-ordering are all genuinely well-tested.

---

## The plan, sequenced into five waves

Effort key: **S** = hours, **M** = a day or two, **L** = several days. Severity: **P1** = highest.

### Wave 1 — Safety net + cheap high-value (about 1-2 days)

Low-risk, high-leverage, several are correctness/legal/security. Do the CI gate first; it protects everything after.

| # | Item | Dim | Sev | Effort |
|---|---|---|---|---|
| 1.1 | **CI quality gate**: `ci.yml` running `tsc --noEmit && npm test && npm run lint && npm run lint:tokens` on PR + push to main | Prod | P1 | S |
| 1.2 | **Bump Next.js** 14.2.18 to latest 14.2.x (closes known advisories incl. image-optimizer + middleware) | Sec | P1 | S |
| 1.3 | **OG/Twitter card metadata** + `metadataBase`; `og:image` on snippet, species, profile pages | Prod | P1 | M |
| 1.4 | **Privacy policy fix**: Resend to SendGrid (factual GDPR transparency defect); add Anthropic as a sub-processor | Prod | P2 | S |
| 1.5 | **CSRF**: treat missing `Origin` on state-changing requests as a fail (currently fails open) | Sec | P1 | S |
| 1.6 | **Timing-safe cron auth** on `digest` + `streak-nudge` (extract the existing `timingSafeEqual` helper) | Sec | P2 | S |
| 1.7 | `robots.ts` disallow `/admin`; sitemap include `/species` + species pages | Prod | P2 | S |
| 1.8 | Complete `.env.example` to parity with the real ~20 vars, grouped + commented | Prod | P2 | S |
| 1.9 | Remove dead `resend` dependency | Prod/Arch | P3 | S |

### Wave 2 — The flagship: feed render path (about 3-5 days)

This single change fixes TTFB/LCP/memory/INP on the core surface, stops the page degrading as the clip library grows, and bundles the top item from three separate reviews. It pairs naturally with starting the `FeedCard` refactor.

| # | Item | Dim | Sev | Effort |
|---|---|---|---|---|
| 2.1 | Server-render only the first ~5 ordered snippets; **drop `bboxJson` from the feed `select`**; hand the rest via the existing `/api/feed` cursor route | Perf | P1 | L |
| 2.2 | Fetch each card's bbox from the existing `/api/snippets/[id]/bbox` route when it enters the +/-1 window | Perf | P1 | M |
| 2.3 | **Window the mounted cards** (activeIndex +/- 2; unmount distant) so DOM + `<video>` count stays bounded | Perf | P1 | M |
| 2.4 | Code-split the post-submit ID-guide subtree + `canvas-confetti` via `next/dynamic` (copy the `MapModal` pattern) | Perf | P2 | M |
| 2.5 | **Video error/retry state**: a clip that fails to load currently shows a silent black box. Add `videoError` + in-card fallback + Retry + Skip (mirror `SpeciesGallery`) | UX | P1 | S-M |
| 2.6 | Extract `useBboxTrail` hook out of `FeedCard` (the camera-follow render loop + 6 geometry helpers) | Arch | P1 | M |

### Wave 3 — Observability, so you stop flying blind (about 2-3 days)

| # | Item | Dim | Sev | Effort |
|---|---|---|---|---|
| 3.1 | **Wire Sentry** (`@sentry/nextjs`) into both empty error boundaries + a shared API error helper | Prod | P1 | M |
| 3.2 | `src/lib/log.ts` structured logger; replace scattered `console.error` (the Sentry seam) | Arch | P2 | M |
| 3.3 | **Persist web-vitals** (small `Vital` table or forward to a RUM sink) so LCP/INP are actually queryable | Prod | P2 | M |
| 3.4 | Cron failure alerting: `captureException` + return 500 when `failed > 0` so Vercel cron alerts fire | Prod | P2 | S |
| 3.5 | `src/lib/env.ts` zod env schema, parsed at boot, fail-fast with a clear message | Prod | P2 | M |

### Wave 4 — Maintainability + the test unlock (about 3-4 days)

| # | Item | Dim | Sev | Effort |
|---|---|---|---|---|
| 4.1 | **vitest jsdom project split** so components + API routes become testable at all (currently node-only) | Arch | P1 | M |
| 4.2 | Continue the `FeedCard` split: `useBreakpoint`, `useKeyboardOffset`, `<RevealPane>`, `<SpotItGates>` (roughly halves the file) | Arch | P1 | L |
| 4.3 | Tests for the **untested security-critical pure modules**: `csrf.ts`, `rate-limit.ts`, `auth/tokens.ts` | Arch | P2 | M |
| 4.4 | One `POST /api/answers` integration test (scoring + streak + pokedex side-effect) once 4.1 lands | Arch | P2 | M |
| 4.5 | **Delete dead code**: `MCQCandidatePicker`, `CandidateStrip`, `trait-questions`, `next-trait` (~700 lines); fix the now-misleading "MCQ tile grid" comments + CLAUDE.md | Arch/UX | P2 | S |
| 4.6 | Move shared payload/DTO types out of route files into `src/types/` | Arch | P3 | S |

### Wave 5 — Hardening + polish (ongoing, pick off opportunistically)

| # | Item | Dim | Sev | Effort |
|---|---|---|---|---|
| 5.1 | Content-Security-Policy (start report-only; `img-src` from the existing `remotePatterns`) | Sec | P2 | M |
| 5.2 | `GET /api/leaderboard` JSON route: replace full-table scan with SQL `groupBy` + `revalidate` (the page route was already fixed; this one was missed) | Perf | P1 | S |
| 5.3 | `POST /api/answers` streak: bound the per-submit query to a recent window instead of full history | Perf | P2 | S |
| 5.4 | Move rate-limiter to a shared store (Upstash/Redis) before significant growth; today it is best-effort per-instance | Sec | P2 | M |
| 5.5 | Forgot-password: add an email-only rate bucket + invalidate prior reset tokens (email-bombing via IP rotation) | Sec | P2 | S |
| 5.6 | Feed a11y: `role`/`aria-label` on the scroll region + an `aria-live` "Clip N of M" announcement | UX | P2 | S |
| 5.7 | PWA: PNG + maskable icons, `favicon.ico`, branded `/offline` page | Prod | P3 | M |
| 5.8 | `/api/health` (`SELECT 1`) + a free uptime monitor | Prod | P3 | S |
| 5.9 | `List-Unsubscribe` header on digest/nudge email (2024 Gmail/Yahoo bulk-sender rules) | Prod | P2 | S |
| 5.10 | Cache headers on `probability` + `stats` routes (currently `force-dynamic`) | Perf | P3 | S |
| 5.11 | Finish the WebP image backfill so the whole catalogue serves derivatives, not source JPEGs | Perf | P2 | M |
| 5.12 | Chat route: zod schema (the one route still hand-rolling validation); cap total message-array length | Sec/Arch | P2 | S |
| 5.13 | Leaderboard JSON: stop returning internal user cuids | Sec | P3 | S |

---

## Findings appendix (detail by dimension)

### Security
- **Next.js 14.2.18 behind on patches** (`package.json:56`). No-risk patch bump. Image-optimizer advisories are in scope (the app uses `next/image` + `remotePatterns`); middleware-bypass impact is limited because `middleware.ts` only does a cookie-existence redirect. *Fix: bump to latest 14.2.x; run `npm audit` in CI.*
- **CSRF fails open on missing Origin** (`src/lib/csrf.ts:4` returns `true` when no origin). Every mutating non-NextAuth route relies on this single check. *Fix: fail on missing Origin for state-changing methods, or fall back to Referer; pin SameSite=Lax + Secure on the session cookie.*
- **No CSP** (`next.config.mjs:50-55` sets other headers but no Content-Security-Policy). *Fix: report-only CSP first; `img-src` from the existing `remotePatterns`; `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`.*
- **Forgot-password email-bombing** (`src/app/api/auth/forgot/route.ts:50-69` rate-limits on `ip:email`; IP rotation defeats it; tokens accumulate). *Fix: email-only bucket + invalidate prior reset tokens.*
- **Two crons use `!==` not timing-safe compare** (`cron/digest/route.ts:23-28`, `cron/streak-nudge/route.ts:24-29`; the other two crons already use `timingSafeEqual`). *Fix: extract the helper, use everywhere.*
- **Chat route hand-rolls validation** (`api/idguide/chat/route.ts:215` casts `as ChatRequest`); the only non-zod route. *Fix: zod schema, cap message-array length.*
- **`/api/vitals` unauthenticated, logs caller strings** (`api/vitals/route.ts:24-33`). *Fix: same-origin + IP rate-limit; drop the body echo.*
- **Digest unsubscribe HMAC compared with `!==`** (`unsubscribe/route.ts:29`); low value. *Fix: timingSafeEqual.*
- **Leaderboard exposes internal user cuids** (`api/leaderboard/route.ts:49-51`). *Fix: opaque key.*
- **Transitive dev-dep advisories** (esbuild/glob/defu via react-email, prisma CLI); not in the prod runtime. *Fix: `npm audit fix`; schedule react-email major bump.*
- In-memory rate-limiter is per-instance (best-effort on serverless); move to a shared store before growth.

### Performance
- **Feed loads the whole corpus + `bboxJson`, mounts every card** (`feed/page.tsx:40-55` no `take`, selects `bboxJson`; `FeedPlayer.tsx:177-206` maps all). The `/api/feed` cursor route and `/api/snippets/[id]/bbox` lazy route exist and are **unused** (verified: nothing in `src/components`/`src/app/feed` calls them). *Fix: Wave 2.1-2.3.*
- **`GET /api/leaderboard` full-table scan** (`route.ts:11-13` `findMany` of every Answer, aggregates in JS). The page route was rewritten to SQL `groupBy`; the JSON route was missed. *Fix: SQL groupBy + `revalidate=60`.*
- **Leaderboard page runs 3 separate `groupBy by userId`** (`leaderboard/page.tsx:53-75`); signed-in requests bypass ISR and pay full cost. *Fix: collapse to one `groupBy` with `_count` + `_sum`; consider a denormalised per-user score.*
- **`POST /api/answers` loads entire answer history per submit** for the streak (`route.ts:84-87`); grows unbounded. *Fix: bound to a recent window; run in parallel with the snippet lookup; memoise `loadAliases`.*
- **Bundle: `canvas-confetti` + the whole ID-guide subtree statically imported into the feed** (`lib/confetti.ts:1`; `FeedCard.tsx:10-20`). `RevealResult` already dynamic-imports confetti correctly. *Fix: `next/dynamic` the post-submit machinery + confetti.*
- **`CandidateGate` fires up to 24 parallel image fetches** when the Rung-3 gate opens (`CandidateGate.tsx:115-138`). *Fix: batch endpoint or chunk to ~6.*
- Read-only routes `force-dynamic` (`probability`, `stats`, `feed`, `bbox`). *Fix: cache headers (copy the `species-images` route).*
- **Web-vitals collected then discarded** (`WebVitalsReporter` beacons; `api/vitals/route.ts:32` only `console.log`). *Fix: persist (Wave 3.3).*
- Species photos render as raw `<img>` (deliberate, documented; mitigations in place). *Fix: finish WebP backfill.*
- `FeedCard` is not memoised and parent passes inline arrow props, so a parent state change re-renders every mounted card; mostly resolved by windowing (2.3) + stabilising `onAdvance`/`onAnswered`.

### UX & Accessibility
- **Video failure = silent black box** (`FeedCard.tsx:793-796` only `console.error`); the image path one component over has a full error/retry machine. *Fix: Wave 2.5. Highest-leverage UX item.*
- **Feed scroll region is silent for screen readers** (no `role`/`aria-label`, no active-card announcement in `FeedPlayer`). *Fix: `role="region"` + `aria-live` "Clip N of M".*
- **Dead `MCQCandidatePicker` + `CandidateStrip`**; the live "Pick from a list" path is the type-to-search input, not an MCQ grid, but FeedCard comments + CLAUDE.md still describe an "MCQ tile grid." Trap for the next contributor. *Fix: delete + correct comments (Wave 4.5).*
- Spacebar play/pause is undiscoverable; when autoplay is blocked, the paused-overlay should take focus. *Fix: focus the play overlay on `videoPaused`.*
- Leaderboard medals use stock `amber/zinc/orange` (token hygiene only; colorblind is handled via numerals + shapes + labels). Low priority.
- `SideMenu` "Sign out" misses the 44px floor its siblings have (`SideMenu.tsx:329-338`).
- A few interactive control glyphs at `white/35`; first-run nudges are localStorage-only so they re-show on a second device. Polish.
- Verified solid: reveal-in-place, modal focus, `inert`, route error/empty/loading states, auth-form a11y, skip-link, per-route metadata titles, reduced-motion.

### Architecture & maintainability
- **`FeedCard.tsx` 1,622-line god component** holding 7+ responsibilities. *Fix: extract `useBboxTrail` (2.6, highest-value single refactor), then `useBreakpoint`/`useKeyboardOffset`/`<RevealPane>`/`<SpotItGates>` (4.2).*
- **vitest is node-only** (`vitest.config.ts:12`); components + API + cron routes are physically untestable. The pure-logic core is well-covered but coverage stops where logic meets a request/DOM. *Fix: jsdom project split (4.1).*
- **~700 lines of orphaned narrowing code** (`CandidateStrip`, `trait-questions`, `next-trait`); the team knows (docs say "orphaned"). *Fix: delete or quarantine (4.5).*
- **No logger abstraction**; raw `console.*` across 14 files incl. 5 routes. *Fix: `src/lib/log.ts` (3.2).*
- Highest-value missing tests, in order: `csrf.ts`, `rate-limit.ts`, `auth/tokens.ts` (all security-critical, all zero tests), the extracted bbox geometry helpers, one `/api/answers` integration test.
- Shared route payload types imported into client components (`SpeciesGallery.tsx:5`); inverts the dependency direction. *Fix: `src/types/`.*
- Verified fine (do not chase): zero `any`, 100% `@/`, Prisma not scattered, schema well-modelled with covering indexes + cascade, scripts organised not sprawled (shared lib reused), zero TODO/FIXME, strong docs (ARCHITECTURE + runbooks). The `data-explorer` note in CLAUDE.md belongs to a different project; not in this repo.

### Production-readiness
- **No CI quality gate** (5 workflows, none runs `tsc`/unit-test/lint/lint:tokens; only Playwright e2e). `main` auto-deploys. *Fix: 1.1. Single highest-leverage change.*
- **No error tracking** (no Sentry; both error boundaries swallow to console). *Fix: 3.1.*
- **Zero OG/Twitter metadata** (no `openGraph`/`twitter`/`og:image`/`metadataBase` anywhere) for a share-driven product. Snippet + species pages have images in hand. *Fix: 1.3.*
- **Privacy policy names Resend** (`privacy-policy.md:38,55`) but the app sends via SendGrid; Anthropic (chat free-text to US) not listed. Real UK-GDPR transparency defect. *Fix: 1.4.*
- **No `List-Unsubscribe` header** on marketing email (`send.ts:68-78`). *Fix: 5.9.*
- **Crons return 200 regardless of failures** (`digest/route.ts:75-81`); resilient per-recipient but alert-blind. *Fix: 3.4.*
- **`.env.example` documents 6 of ~20 vars**; no env validation/fail-fast. *Fix: 1.8 + 3.5.*
- **Sitemap omits species + profile pages**; **robots does not disallow `/admin`** (saved by the layout's noindex). *Fix: 1.7.*
- PWA icons SVG-only (no favicon.ico/PNG/maskable); bare-text offline response. *Fix: 5.7.*
- No `/api/health` endpoint. *Fix: 5.8.*
- Dead `resend` dep. *Fix: 1.9.*
- Verified done well: error/not-found/loading boundaries, real GDPR, competent SendGrid email subsystem, PWA + consent + vitals plumbing (need destinations), security headers + image-host allowlisting, RLS-regression CI guard.

---

## Recommended starting point

Wave 1 in full (about a day), because it is cheap, several items are genuine correctness/legal/security fixes, and the CI gate protects every wave after it. Then commit to Wave 2 as a single focused piece of work, since the feed render path is the product's centre of gravity and the change touches perf, UX (video errors), and the start of the `FeedCard` refactor together.

---

## Execution strategy (parallel agents)

The work parallelizes well except for one hard bottleneck.

**The feed bottleneck.** `FeedCard.tsx` and `FeedPlayer.tsx` are touched by all of Wave 2, the Wave 4.2 refactor, the 4.5 comment cleanup, and the 5.6 a11y work. Multiple agents cannot edit these files concurrently. They run as one serial "feed track" owned by a single strong (Opus) agent, in order: 2.1 pagination, 2.2 lazy bbox, 2.3 windowing, 2.4 code-split, 2.5 video error state, 2.6 extract `useBboxTrail`, 4.2 further split, 4.5 dead-code + comments, 5.6 a11y.

**Dependency mutations are centralized.** All package.json / lockfile changes (Next bump, remove resend, add Sentry, add test libs) are done in one place per batch with a single `npm install`, never by concurrent agents (avoids lockfile races).

**Everything else runs in file-disjoint parallel batches**, with a verification gate (`tsc --noEmit && npm test && npm run lint && npm run lint:tokens`) between batches:

- **Batch A (quick wins):** CI workflow; OG metadata; sitemap + robots; privacy policy; `.env.example`; CSRF fix; timing-safe cron helper. Plus the Next bump + resend removal.
- **Batch B (foundations):** vitest jsdom project split; tests for `csrf`/`rate-limit`/`auth/tokens`; shared DTO types; zod env validation.
- **Batch C (observability):** Sentry (Opus); persist web-vitals; structured logger then cron alerting (serial, same files).
- **Feed track (serial, Opus):** as above.
- **Batch D (leaf hardening):** leaderboard SQL; answers streak window; chat zod; leaderboard cuid hide; `/api/health`; List-Unsubscribe; cache headers; forgot-password bucket; PWA icons; CSP (Opus).
- **Batch E:** `/api/answers` integration test (after the vitest split and a stable feed).

**Model policy.** Opus for the feed track, CSP, and Sentry. Fable 5 (inherited) for mid-tier multi-file implementation. Haiku for trivial mechanical edits.

**Needs external input to fully activate** (code is wired regardless): a Sentry DSN; an Upstash/Redis instance for the shared rate-limiter (5.4, otherwise deferred); pointing an uptime monitor at `/api/health` (5.8).

**Branch:** `improvements-2026-06-12` (off `feedback-2026-06-10`). Commits left to Christian's explicit request.

---

## Progress log

- **Batch A (DONE, green):** CI gate (`.github/workflows/ci.yml`); Next 14.2.18 to 14.2.35; OG/Twitter metadata + default `opengraph-image` + per-page images (snippet/species/profile) + species pages in `sitemap.ts`; `robots` disallow `/admin`; privacy policy Resend to Twilio SendGrid + Anthropic sub-processor row; `.env.example` to parity; CSRF fail-closed on missing Origin (+ Referer fallback); shared timing-safe `cron-auth` across all 5 crons; removed dead `resend` dep. Gate: tsc + 302 tests + lint + lint:tokens green.
- **Batch B (DONE, green):** vitest jsdom split via `environmentMatchGlobs` + `vitest.setup.ts` + automatic JSX runtime (component testing unlocked, smoke test passing); tests for `csrf`/`rate-limit`/`auth/tokens` (31 new); `src/lib/env.ts` + root `instrumentation.ts` fail-fast validation + `experimental.instrumentationHook` in `next.config.mjs`. Gate: tsc + 334 tests + lint + lint:tokens green.
- **UI fix (verified):** feed header PEBL logo right inset 12px to 28px (`pr-7` on feed) so it clears the desktop scrollbar; left menu + non-feed bar unchanged. Verified by DOM measurement in the preview.
- **Note:** pre-existing animation WIP (CorrectFishSwim, UnlockTile, ring draw-on + stories) is bundled on this branch per Christian's choice; its earlier 4 lint errors are resolved.
- **Batch C (DONE, green):** Sentry wired via @sentry/nextjs 8.55.2 (inert until `SENTRY_DSN` set; error boundaries capture; next.config wrapped with withSentryConfig preserving all existing options; instrumentation merges Sentry init with validateEnv); `Vital` prisma model + guarded persist in `/api/vitals` (degrades to 204 until table exists); `src/lib/log.ts` structured logger + console.error replaced in api routes + cron 500-on-failure alerting. Gate: tsc + 334 tests + lint + lint:tokens green.
- **Batch D wave 1 (DONE, green):** leaderboard JSON route to SQL groupBy + `revalidate=60` (userId kept: moot to hide, /u/[id] already public, route not client-fetched); CDN cache headers on probability + stats routes (only the pre-answer, user-independent shape, never the gated reference field); `/api/health` liveness probe; idguide chat route to zod (+ total message-array cap). Gate: tsc + 334 tests + lint + lint:tokens green.
- **Activation items (need human action, code is in place):** `prisma db push` to create the `Vital` table; `SENTRY_DSN` in Vercel; Upstash/Redis for the shared rate-limiter (5.4, deferred).
- **Surfaced 12 Jun:** ~300 pre-existing em/en dashes across 100 files (comments, UI copy, legal docs) predating the no-dash rule on this code. Decision pending: sweep all / user-facing only / leave.
- **Remaining:** the serial FEED TRACK (Wave 2 pagination + lazy bbox + windowing + code-split + video-error state + useBboxTrail extraction, then 4.2 refactor + 4.5 dead-code + 5.6 a11y); Batch D remainder (CSP [Opus, next.config], PWA icons, email List-Unsubscribe, forgot-password email bucket); Batch E (answers integration test). Deferred: B3 shared types (WIP overlap), 5.3 streak window (scoring-correctness risk, needs a test). No commits yet (Christian's choice).

