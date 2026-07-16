# Pre-launch security hardening — 15 Jul 2026

Plan + implementation record for the hardening pass before FishSpotter goes public.
Driven by a full functional test (live) + three deep code-reading security passes
(auth/session, API-route authz+injection, data-exposure/PII) + a prod RLS verification.

## Verdict going in

No confidentiality or integrity blocker. The app is well-built: RLS on all 18 prod
tables (verified live), no IDOR, no SQL injection, no anon-reachable SSRF, no
mass-assignment, strong tokens (256-bit, hashed, single-use, TTL), bcrypt(12),
server-side un-spoofable admin gating, constant-time cron auth. The fixes below are
one real abuse vector + defense-in-depth + hygiene.

## Fixes implemented this pass (all low-risk, gated by tsc+test+lint)

1. **F1 — `POST /api/vitals` abuse (the one real pre-launch fix).** Only
   unauthenticated, no-same-origin, no-rate-limit DB-write route. Anon could
   loop-insert unbounded `Vital` rows with attacker-controlled `ua`/`path`.
   Fix: add `assertSameOrigin()` (primary defense — a non-browser flood has no
   Origin/Referer and is rejected) + a per-IP rate limit (secondary). Over-limit
   drops silently to 204 to preserve the "a beacon never blocks the client"
   contract.
2. **`/api/answers/preview` unthrottled read.** Same-origin gated but runs an
   unbounded `answer.findMany` per call for any visitor. Add a per-IP rate limit.
3. **idguide chat leaks raw `err.message` to the client** (`chat/route.ts`).
   Send a generic message to the browser; `console.error` the real error
   server-side.
4. **digest-unsubscribe uses `!==` on an HMAC** (`digest/unsubscribe/route.ts`).
   Swap to `crypto.timingSafeEqual` for consistency with the cron path (cosmetic,
   but removes the timing-oracle smell).
5. **CSP hardening headers** (`next.config.mjs`). Add a Content-Security-Policy
   with the zero-regression-risk directives only: `base-uri 'self'`,
   `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'`. These
   harden clickjacking / base-tag / plugin / form-hijack injection without
   touching `script-src`/`img-src`/`style-src` (a full source-list CSP needs
   violation-report testing first — deferred, see below).
6. **Move `react-email` (dev CLI) to devDependencies.** Zero runtime imports
   (verified). Drops socket.io / ws / vite out of the production install →
   smaller prod attack surface, resolves several dev-only npm-audit highs from
   the prod tree.
7. **Delete confirmed dead components** (zero imports, verified): `AvatarMenu.tsx`,
   `MCQCandidatePicker.tsx`, `landing/UnderwaterBackdrop.tsx`. Reduces surface /
   reviewer confusion; tsc+build confirm nothing referenced them.

## Deferred — need a decision or dedicated effort (NOT done this pass)

- **Next.js 16 migration.** `14.2.35` is the last 14.2.x; only DoS-class
  advisories apply (no anon RCE/auth-bypass — those are 15.x regressions),
  several Vercel-mitigated. Major-version migration = its own project, not a
  launch gate.
- **Email-verification enforcement (policy).** Currently never enforced →
  identity-squatting possible (self-healing via reset, not true takeover).
  Decide whether to gate scoring/actions on `emailVerified`.
- **Shared-store rate limiter.** In-memory limiter is per-lambda-instance on
  Vercel → real caps are N× looser. Move auth/answer/event counters to
  Upstash/Vercel KV if abuse appears (needs infra + creds).
- **Full source-list CSP** (`script-src`/`img-src`/`style-src`/`connect-src`).
  High value but needs violation-report testing against the live host set
  (Supabase, R2, iNat/Wikimedia images, Sentry, map tiles, framer inline styles).
  Do as `Content-Security-Policy-Report-Only` first.
- **Orphaned narrowing engine** (`CandidateStrip.tsx` + `trait-questions.ts` +
  `next-trait.ts` + their tests, ~656 lines). Revive-or-remove product decision.
- **`restore-database.sql`** at repo root — stale pre-rename schema. Move to
  `backups/`/`docs/` or delete (DR-adjacent, needs the call).

## Gate

`npx tsc --noEmit && npm test && npm run lint && npm run lint:tokens` must pass,
plus a live smoke-load of the app in the browser preview.
