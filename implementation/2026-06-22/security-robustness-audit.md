# Security & Robustness Audit — FishSpotter

**Date:** 22 Jun 2026
**Branch:** `claude/security-robustness-audit-ibi98f`
**Scope:** Full application — auth/session, API surface, data handling, secrets,
external integrations, concurrency, error handling, dependencies.
**Method:** Three parallel read-only codebase sweeps (auth/API surface,
data/secrets/storage, robustness), each finding verified against the source,
followed by remediation of every actionable item.

---

## Executive summary

The app was already strong on the classic web-security fundamentals: CSRF
(`assertSameOrigin`, fail-closed), Zod validation on every authenticated POST,
bcrypt(12) password hashing, SHA-256 token-at-rest, timing-safe CRON-secret
comparison, RLS enforced on every public table, consistent admin gating, and a
solid set of security response headers. No SQL injection, no hardcoded secrets,
no untrusted-HTML render path.

The real exposure was in **robustness and abuse-resistance**, not classic
injection: unbounded outbound `fetch` calls (a self-inflicted DoS vector), a
rate limiter that didn't hold across serverless instances (defeating
anti-cheat + auth brute-force protection), and a read-then-write race on the
First-Sighting Pebble bonus.

All P1/P2 findings below are **fixed on this branch**. Remaining items are
dependency advisories and a CSP hardening follow-up, documented at the end.

---

## Findings & remediation

### F1 — Outbound `fetch` calls had no timeout — **HIGH (robustness) — FIXED**

Plain `fetch()` has no default timeout. A hung or slow upstream (OBIS, GBIF,
iNaturalist, Wikimedia, SendGrid, Gemini, arbitrary image downloads) held the
connection — and on a serverless function, the whole invocation — open until
the platform killed it. Under load or a flaky upstream this is a self-inflicted
denial of service.

**Evidence:** `src/lib/biodiversity/obis.ts:64,113`, `gbif-match.ts:50`,
`inaturalist.ts:127`, `wikimedia.ts:72`, `distribution.ts:110`, `depth.ts:130`,
`gemini-vision.ts:171,229`, `src/lib/email/send.ts:80`.

**Fix:** New `src/lib/http.ts` — `fetchWithTimeout(url, init, timeoutMs)` using
`AbortSignal.timeout` (composed with any caller signal via `AbortSignal.any`).
Default budget 10s; 12s for iNat, 15s for image downloads + SendGrid, 60s for
Gemini generation. Every server-side external fetch now routes through it. The
iNaturalist retry loop additionally retries on timeout/network errors rather
than propagating the first hang. Unit-tested in `src/lib/http.test.ts`.

### F2 — Rate limiter not enforced across serverless instances — **HIGH — FIXED**

The limiter was a per-process in-memory `Map`. Vercel runs each route as N
independent instances, so any given key's traffic was split across instances
and every cap (auth brute-force 5/15m, answer anti-cheat 200/h, chat 30/h,
events 600/h) could be exceeded N-fold by traffic that simply landed on
different instances.

**Evidence:** `src/lib/rate-limit.ts` (original, module-level `Map` only).

**Fix:** `src/lib/rate-limit.ts` now uses **Upstash Redis** (sliding window)
when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set, falling
back to the bounded in-memory store otherwise (local dev / tests / unconfigured
deploys). The public checks became `async`; all call sites now `await` them
(`auth.ts`, `answers`, `idguide/chat`, `events`, `auth/forgot`,
`auth/verify-request`). Fails **open** if Upstash is briefly unreachable (these
guard abuse, not correctness) while the in-memory store still provides a
per-instance backstop. `isDistributedRateLimit()` reports which backend is
active.

**Deploy action required:** create a (free) Upstash Redis DB and set the two env
vars in Vercel production + preview. Until then the limiter silently uses the
per-instance fallback. Added to `.env.example` and `src/lib/env.ts`.

### F3 — First-Sighting bonus race (read-then-write) — **MEDIUM — FIXED**

The arrival ordinal that sets the First-Sighting / early-spotter Pebble bonus
was computed by reading `priorSpotters.length` and then upserting, with no
transaction. Two users submitting on the same clip at the same instant could
both read the same ordinal and both claim the bonus.

**Evidence:** `src/app/api/answers/route.ts:75-116` (original).

**Fix:** The ordinal read + upsert now run together in a `SERIALIZABLE`
interactive transaction (`runSerializableAward`), retried up to 3× on the
Postgres serialization failure Prisma surfaces as `P2034`. The
`(userId, snippetId)` unique constraint already prevented duplicate rows; this
closes the bonus double-award. The user's own streak history read stays outside
the transaction (it's not part of the cross-user race).

### F4 — Gemini API key passed in the URL query string — **LOW — FIXED**

`geminiGenerate` appended `?key=<API_KEY>` to the request URL. Query strings
routinely land in access logs and error traces; headers do not.

**Evidence:** `src/lib/biodiversity/gemini-vision.ts:223` (original).

**Fix:** key now sent via the `x-goog-api-key` request header.

### F5 — Video element had no error fallback — **MEDIUM (robustness) — FIXED**

If a snippet's video URL was dead (storage outage, bad migration, codec issue),
the per-snippet player rendered a silent blank box with no feedback.

**Evidence:** `src/components/SnippetPlayer.tsx:41-47` (original).

**Fix:** added an `onError` handler + an accessible (`role="alert"`) fallback
panel telling the user the clip couldn't load and to refresh.

### F6 — No Content-Security-Policy header — **LOW (defence-in-depth) — FIXED**

The app shipped strong response headers (`X-Frame-Options`, `nosniff`, HSTS,
Referrer-Policy, Permissions-Policy) but no CSP.

**Evidence:** `next.config.mjs` `securityHeaders` (original).

**Fix:** added a CSP in `next.config.mjs`. The zero-breakage hardening
directives (`object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`,
`form-action 'self'`, `upgrade-insecure-requests` in prod) are the main value.
`script-src`/`style-src` retain `'unsafe-inline'` because Next's App Router
injects inline bootstrap scripts without a nonce; a strict nonce-based policy is
a tracked follow-up (see Remaining work). The app has no untrusted-HTML render
path, so the residual XSS surface is already minimal.

---

## Verified-good (no action needed)

- **SQL injection:** none. Raw SQL (`$queryRaw`/`$executeRawUnsafe`) is static
  or uses constants only (`health`, `enable-rls.ts`, `migrate-points`,
  `backup-pre-drop`). All user input goes through parameterized Prisma.
- **Secrets:** clean `NEXT_PUBLIC_*` vs server split (`src/lib/env.ts`); no
  hardcoded keys; `.env.local` gitignored.
- **RLS:** `prisma/rls.sql` enables RLS on all current + future public tables;
  `npm run db:enable-rls -- --check` is a CI-friendly auditor.
- **CSRF:** `assertSameOrigin` on all state-changing routes, fail-closed.
- **Auth:** bcrypt(12), 8-char minimum, SHA-256 token-at-rest, 1h reset TTL,
  email enumeration mitigation on `/forgot`, ICO Children's-Code age gating.
- **Admin gate:** `requireAdminSession()` (`@pebl-cic.co.uk`) on every admin
  route + server action; admin pages `noindex`.
- **CRON auth:** `crypto.timingSafeEqual` against `CRON_SECRET`, fails closed
  when unset.
- **Untrusted HTML:** single `dangerouslySetInnerHTML` reads a trusted in-repo
  markdown file (`LegalLayout.tsx`); Wikimedia attribution is HTML-stripped.
- **Consent:** `/api/events` hard-gates on analytics consent before any write.

---

## Remaining work (not done on this branch)

1. **Dependency advisories (`npm audit`).** `npm audit --omit=dev` reports a
   `next` CRITICAL (dev-server origin verification — **dev-only**, not a
   production-runtime risk) and several HIGH/MODERATE that are transitive/dev
   tooling (`@sentry/webpack-plugin` → rollup/glob, `react-email` → babel,
   storybook → `ws`/`socket.io`/`engine.io`). The notable production-path one is
   `next-auth ≤4.24.14` (transitive `uuid`). **Recommendation:** bump `next` to
   the latest 14.2.x patch and `next-auth` within the 4.x line, then re-audit.
   Deferred here because version bumps need their own regression pass.
2. **Strict CSP via nonces.** Replace `script-src 'unsafe-inline'` with a
   per-request nonce (middleware-injected) to make the CSP genuinely
   XSS-protective. Needs a nonce pipeline + runtime verification across all
   pages.
3. **Cron email robustness.** `cron/digest` and `streak-nudge` swallow
   per-recipient `sendEmail` failures with no retry/backoff. Consider a small
   retry or a dead-letter count surfaced in the cron response.
4. **Test coverage** for the new answer-submission transaction path and the
   consensus rescore cron (currently only the pure helpers are unit-tested).

---

## Changed files

| File | Change |
|---|---|
| `src/lib/http.ts` *(new)* | `fetchWithTimeout` + `isTimeoutError` |
| `src/lib/http.test.ts` *(new)* | timeout helper tests |
| `src/lib/rate-limit.ts` | Upstash distributed backend + async API + in-memory fallback |
| `src/lib/rate-limit.test.ts` | awaited async API, backend-selection test |
| `src/lib/env.ts`, `.env.example` | `UPSTASH_REDIS_REST_URL` / `_TOKEN` |
| `src/lib/auth.ts` | await rate-limit checks |
| `src/app/api/answers/route.ts` | serializable award transaction; await rate limit |
| `src/app/api/{idguide/chat,events,auth/forgot,auth/verify-request}/route.ts` | await rate-limit checks |
| `src/lib/biodiversity/{obis,gbif-match,inaturalist,wikimedia,distribution,depth,gemini-vision}.ts` | timeouts; Gemini key → header |
| `src/lib/email/send.ts` | SendGrid timeout |
| `src/components/SnippetPlayer.tsx` | video error fallback |
| `next.config.mjs` | Content-Security-Policy |
| `package.json` | `@upstash/ratelimit`, `@upstash/redis` |

**Verification:** `npx tsc --noEmit` ✓ · `npm test` (366 passing) ✓ ·
`npm run lint` ✓ · `npm run lint:tokens` ✓
