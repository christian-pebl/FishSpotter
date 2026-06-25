# Conference-readiness hardening

**Goal:** FishSpotter must hold up for a public launch and a live on-stage demo at a
conference in **mid-September 2026**. Target three layers: prevent the realistic
failure modes, detect instantly if something slips, and a demo-day fallback that
runs even if the live site/wifi die.

Derived from a 4-lens robustness audit (data layer, failure handling, launch config,
performance under load) run 2026-06-25. Owner tags: **[code]** = changes in this repo
(Claude), **[ops]** = Vercel/Supabase/DNS/SendGrid (Christian, no repo access from here).

Work branch: `hardening/conference-prep` (off `main`). Nothing ships to `main` without sign-off.

---

## Roadmap

- **Now -> ~mid-July (code):** land all code-side fixes below, each verified (`tsc + test + lint + lint:tokens`).
- **In parallel (ops):** lock Vercel prod env, run `db:enable-rls`, move videos to a CDN (R2).
- **July -> Aug (detect + prove):** `/api/health` + external uptime monitor, switch Sentry on, then load-test the QR-crowd scenario for evidence it holds.
- **Early Sept (rehearse):** build the demo-day fallback + full dress rehearsal on the real prod URL.

---

## Code fixes (this repo)

### Done (verified green)
- [x] **Whole-feed crash guard** — `safeParseJson` per row in `src/app/feed/page.tsx`; one corrupt `bboxJson`/`manualTrackJson` no longer takes the feed down.
- [x] **Stuck "Scoring…" spinner guard** — `loadStats`/`loadMyAnswer` in `src/lib/useCreatureQuiz.ts` now `try/catch` + `res.ok`; stats failure falls back to an empty breakdown so the reveal renders.

### Critical (do before launch)
- [ ] **Dead video card recovery** — `FeedCard.tsx:~968` `<video onError>` only `console.error`s. Add a `videoErrored` state + inline "couldn't load, Skip" overlay so a bad clip URL isn't a frozen card.
- [ ] **DB statement timeout** — no query timeout anywhere; a slow DB hangs functions into spinners. Append `&statement_timeout=8000&pool_timeout=10` to the pooled `POSTGRES_PRISMA_URL` (Vercel) **[ops]**, and/or a Supabase role-level `statement_timeout`.
- [ ] **`Answer(snippetId)` index** — `prisma/schema.prisma` add `@@index([snippetId])`; the composite unique can't serve `WHERE snippetId=?`, so the hottest reads seq-scan the fastest-growing table. Then `npm run db:push` + `npm run db:enable-rls` **[ops to run]**.
- [ ] **Histogram `findMany` -> `groupBy`** — `src/app/api/snippets/[id]/stats/route.ts:41` and `src/app/api/answers/preview/route.ts:55` load every answer row per clip. Count in SQL.

### High
- [ ] **Cache the demo URL + feed** — landing `src/app/page.tsx` (5 uncached queries/hit) and `src/app/feed/page.tsx` are `force-dynamic`. Switch landing to `revalidate=60`; cache the feed snippet `findMany` (`unstable_cache`/ISR). Biggest spike-load win.
- [ ] **Drop per-card `/api/answers/my` fan-out** — `useCreatureQuiz.ts:173` fires on all ~48 mounted cards. Pass each card's answer down from the page (already has `answeredIds`).
- [ ] **Bound the unbounded per-user scans** — `take: 60, orderBy createdAt desc` on the streak/history `findMany`s in `src/app/api/answers/route.ts:89`, `src/app/u/[id]/page.tsx:91`, `src/app/api/streak/route.ts:15`.
- [ ] **Strip `bboxJson` from the feed payload** — 316 KB shipped to the client per load though only the active card draws it; lazy-load via the existing `/api/snippets/[id]/bbox`.
- [ ] **ID-guide chat stream timeout** — `IdGuideChat.tsx` + `src/app/api/idguide/chat/route.ts` have no idle/abort timeout; a stalled Anthropic stream shows "thinking…" forever. Add a ~15-20s client idle abort -> existing `onFallback`, and `AbortSignal.timeout()` server-side.
- [ ] **Feed windowing** (decision needed) — all ~48 cards mount at once. Window to active +/-2-3; also removes most of the fan-out + thumbnail load. Bigger change, behavior review first.

### Medium
- [ ] try/catch + safe default on hot read routes (`stats`, `bbox`, `quiz`, `snippets/[id]`, `streak`, `me/pebbles`) so a pool blip returns a default, not a 500.
- [ ] Add `src/app/feed/error.tsx` (segment boundary) so a feed crash recovers in place.
- [ ] `consensus-rescore` cron: watermark the full-table scan + batch the in-loop probability lookups (will silently time out as data grows).
- [ ] Region-pin Vercel functions to match Supabase (eu-west-1 / `lhr1`/`dub1`) to cut cold-start + round-trip latency.

---

## Ops / infra (Christian — Vercel / Supabase / DNS / SendGrid)

These mostly **fail silently** (no error, no log), so verify each.

### Vercel production env vars
Boot-critical (app won't start without):
- [ ] `NEXTAUTH_URL=https://www.fishspotter.app` — else every verify/reset email links to the dead `fish-spotter.vercel.app`. A wrong-but-present value passes validation, so eyeball it.
- [ ] `POSTGRES_PRISMA_URL` (pooled, `...pooler.supabase.com:6543?pgbouncer=true`) + `POSTGRES_URL_NON_POOLING`, `NEXTAUTH_SECRET`, `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Silent-degrade if missing:
- [ ] `CRON_SECRET` — else all 5 crons 401 and silently stop.
- [ ] `SENDGRID_API_KEY` + `EMAIL_FROM_ADDRESS` (on an authenticated domain) — else signup/reset emails silently skip.
- [ ] `SENTRY_DSN` — error tracking is dormant until set.
- [ ] `ANTHROPIC_API_KEY` — ID-guide chat (degrades to manual if absent).
- [ ] `NEXT_PUBLIC_SITE_URL=https://www.fishspotter.app` (build-baked -> redeploy after change) for clean share cards.

### Other ops
- [ ] **Videos onto a CDN** — all 48 clips serve from Supabase Storage with no CDN; a QR crowd = hundreds of Mbps of origin egress, the #1 spike risk. Re-consolidate onto R2 (`scripts/reupload-snippets-hq.ts` + R2 creds + `STORAGE_PROVIDER=r2`) or enable Supabase CDN on the `snippets` bucket.
- [ ] **Run `npm run db:enable-rls`** — newest tables (`Event`, `UnlockedSpecies`, `ConsensusEvent`) likely landed RLS-off; the public anon key can read any unprotected table. Use a plain `postgres://` URL or the check silently no-ops.
- [ ] **Apex -> www redirect preserves path + query** — verify `https://fishspotter.app/auth/verify?token=x` lands on `https://www.fishspotter.app/auth/verify?token=x` intact.
- [ ] **Run the demo from the production URL** (not a preview) or auth emails route to the catch-all.
- [ ] End-to-end test a real verification + password-reset email on prod after env is set.

---

## Detection (July–Aug)
- [ ] Add `/api/health` (200, optional DB check -> 503).
- [ ] External uptime monitor (UptimeRobot / BetterStack) on `https://fishspotter.app/api/health`, 1-min, email/Slack alerts + history.
- [ ] Switch Sentry on (`SENTRY_DSN`) + cron-monitors around the daily crons.
- [ ] Load-test the QR-crowd scenario (e.g. k6/Artillery: N concurrent hits on `/feed` + `/api/answers/preview`); confirm it holds and tune from results.

## Demo-day fallback (early Sept)
- [ ] Local instance of the app on the demo laptop (network-independent).
- [ ] Screen-recorded full walkthrough as backup.
- [ ] Phone tether as network fallback; preload the exact clips to be shown.
- [ ] Full dress rehearsal on the real prod URL.

---

## Confirmed good (no action)
Core loop is DB-only (no external API on the spot-and-submit path). Prisma is a correct
singleton on the pooled connection. JWT sessions (no DB per request). Error boundaries +
on-brand error pages. Leaderboard/browse/species already ISR + paginated. Answer-submit is
auth + rate-limited + zod-validated. Off-screen videos lazy-load (`preload="none"`).

---

## Implementation progress (2026-06-25)

Branch `hardening/conference-prep`, uncommitted pending review. Every shipped item
verified green: `tsc` + 371 tests + `lint` + `lint:tokens` (+ `prisma validate`).

**Shipped this session (code, verified):**
- Whole-feed crash guard -> shared `src/lib/safe-json.ts` + adversarial/stress test (`safe-json.test.ts`).
- Stuck "Scoring…" spinner guard (`useCreatureQuiz.ts`).
- Feed segment error boundary `src/app/feed/error.tsx` + render/recover test.
- Dead video-card recovery (`FeedCard.tsx` onError badge + Skip; the poster still backs a still-frame ID).
- ID-guide chat timeout: 20s client idle watchdog + `AbortSignal.timeout(45000)` per server round.
- `Answer(snippetId)` index in `prisma/schema.prisma` (schema validates). **[ops] run `npm run db:push` + `npm run db:enable-rls`.**
- Bounded the 3 per-user history scans (`take: 1000` desc) so they can't grow unbounded.
- Landing page (the demo URL) -> ISR `revalidate = 60`.
- Read-only, prod-guarded load-test harness `scripts/loadtest.ts` for the prove phase.

**Consciously deferred to the July-Aug prove phase** (need a preview deploy to test;
not safe to change the core feed blind pre-conference):
- Histogram `findMany` -> `groupBy` (the index already fixed the seq-scan; groupBy is a marginal transfer win that risks altering the normalised histogram).
- Feed snippet-list `unstable_cache` (the force-dynamic + data-cache interaction is Next-version-dependent).
- Strip `bboxJson` from the feed payload + feed windowing (behaviour change, UX review).
- **[ops]** statement_timeout on the pooled `POSTGRES_PRISMA_URL`.

**Validation honesty:** pure logic + the crash guard have real adversarial/stress unit
tests; the heavy UI nets (video recovery, chat timeout) are static-validated and scheduled
for the dress-rehearsal manual check; the load-resilience items get the `loadtest.ts` run
against a preview in the prove phase (a real network load test is unsafe against the prod DB).
