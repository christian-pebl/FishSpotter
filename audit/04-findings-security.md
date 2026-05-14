# FishSpotter Security Audit — Static Code Review

**Date:** 2026-05-14
**Stack:** Next.js 14 App Router, next-auth 4.24.10 (credentials), Prisma + Supabase Postgres
**Scope:** Source-code review only (live header/cookie checks in `02-findings-live-ui.md`)

---

## Critical Findings

### S-01 — No password hashing / complete authentication bypass
- **Severity:** CRITICAL (P0)
- **File:** `src/lib/auth.ts:15-33`
- **Observation:** The `authorize()` callback inspects `credentials.email` and `credentials.isSignUp` but **never reads or validates `credentials.password`**. Any visitor who knows a valid email can authenticate as that user with any password (including empty).
- **Recommendation:** Add a `passwordHash` column to the Prisma `User` model. On signup, hash with `bcrypt` (cost ≥ 12) or `argon2id`. On signin, look up the user, compare hash via `bcrypt.compare()`, return null on mismatch. Reject empty passwords with a minimum length (≥ 8).

### S-02 — Signin form forwards empty password as a single space
- **Severity:** CRITICAL (P0)
- **File:** `src/app/auth/signin/page.tsx:25`
- **Observation:** `password: password || " "` — the client coerces empty input to a space, then submits. Combined with S-01, this normalises the "no password" case into a successful login.
- **Recommendation:** Make the password input `required` and validate ≥ 8 chars client-side. Send the raw value (or omit if empty and let the server reject).

### S-03 — No rate limiting on authentication endpoint
- **Severity:** CRITICAL (P0)
- **File:** `src/app/api/auth/[...nextauth]/route.ts` and `src/lib/auth.ts`
- **Observation:** No throttling on `/api/auth/callback/credentials`. Once S-01 is fixed, this remains a brute-force/credential-stuffing vector and an account-enumeration timing oracle.
- **Recommendation:** Add a Vercel-friendly limiter (e.g. `@upstash/ratelimit` with Redis or in-memory token bucket): max 5 failed attempts per IP per 15 min, sliding window. Backoff on consecutive failures per email.

---

## High-Severity Findings

### S-04 — Leaderboard API leaks email *prefix* (downgraded after live verification)
- **Severity:** LOW (P2) — corrected from HIGH after live API check
- **File:** `src/app/api/leaderboard/route.ts:18-27`
- **Observation:** The Prisma query selects `email`, but only `email.split("@")[0]` is used as a display fallback when both `displayName` and `name` are null. The full email is **not** returned to the client (verified live — `GET /api/leaderboard` response contains only `userId, displayName, correct, total, score`). However, the prefix can still leak partial identity if accounts were created without a display name.
- **Recommendation:** Drop `email` from the Prisma `select`; replace the fallback with `User ${userId.slice(0,6)}`. Enforce `displayName` at signup.

### S-05 — Email stored in JWT (not encrypted, only signed)
- **Severity:** HIGH (P1)
- **File:** `src/lib/auth.ts:36-50`
- **Observation:** The `jwt` callback writes `token.email = user.email` and the session callback exposes the token to the client. JWTs are base64-decodable; the email leaks to anyone who can read the cookie/localStorage (XSS or shared device).
- **Recommendation:** Store only `token.id`. Look up email server-side when needed.

### S-06 — Sign-up accepts new accounts with no email verification, captcha, or rate limit
- **Severity:** HIGH (P1)
- **File:** `src/lib/auth.ts:20-28`
- **Observation:** Posting `isSignUp=true` with any email creates a `User` row. No verification email, no captcha, no per-IP throttle. Enables leaderboard pollution, spam, and pre-registration of victim emails.
- **Recommendation:** Add an email-verification step (Resend/SES) before activating the account. Add hCaptcha on the signup form. Rate-limit signups per IP (≤ 3/hr).

### S-07 — JWT max age is 30 days
- **Severity:** HIGH (P1)
- **File:** `src/lib/auth.ts:53`
- **Observation:** `session.maxAge = 30 * 24 * 60 * 60` — stolen tokens stay valid for a month.
- **Recommendation:** Reduce to 1–7 days. Configure `updateAge` (rolling) so active users don't get logged out.

### S-08 — `NEXTAUTH_SECRET` not enforced at startup
- **Severity:** HIGH (P1)
- **File:** `src/lib/auth.ts:54`
- **Observation:** `secret: process.env.NEXTAUTH_SECRET` — if the env var is missing in prod, next-auth may fall back to insecure defaults depending on environment.
- **Recommendation:** Validate at module load: `if (!process.env.NEXTAUTH_SECRET) throw new Error("NEXTAUTH_SECRET is required")`. Document ≥ 32 random bytes.

---

## Medium-Severity Findings

### S-09 — No input validation on answer submission
- **Severity:** MEDIUM (P1)
- **File:** `src/app/api/answers/route.ts:88-103`
- **Observation:** `await req.json()` then destructured; basic length cap exists but no schema. Untyped fields, type confusion, oversized payloads possible.
- **Recommendation:** Use Zod: `z.object({ snippetId: z.string().min(1), chosenOption: z.string().max(80), skipCorrection: z.boolean().optional() }).parse(body)`.

### S-10 — No CSRF token on state-changing POST endpoints
- **Severity:** MEDIUM (P1)
- **File:** `src/app/api/answers/route.ts`, other POST routes, `next.config.mjs`
- **Observation:** next-auth protects its own routes but app POSTs (e.g. answers) rely on cookies + same-site default. No explicit CSRF token check.
- **Recommendation:** Either enforce `SameSite=Strict` on the session cookie OR validate the next-auth CSRF token in custom POST handlers. Verify `Origin`/`Referer` against allowlist.

### S-11 — Service worker pre-caches authenticated app shell
- **Severity:** MEDIUM (P2)
- **File:** `public/sw.js:1-7`
- **Observation:** SW pre-caches `/`, `/feed`, `/leaderboard` unconditionally. On a shared device the previous user's rendered HTML (with their name/score) can be served from cache after logout.
- **Recommendation:** Don't cache HTML for authenticated pages. Use `Cache-Control: private, no-store` on server-rendered routes that contain user data, and skip them in `sw.js`'s precache list.

### S-12 — `staffAnswer` exposure (FALSE POSITIVE after live verification)
- **Severity:** N/A — corrected after live API check
- **File:** `src/app/api/snippets/route.ts:9-18`
- **Observation:** Live `GET /api/snippets` returns only `id, externalId, thumbnailUrl, videoUrl, site, deployment, recordingDatetime, depthM, labelStatus` — `staffAnswer` is NOT in the Prisma `select` and not in the response. The static reviewer was wrong.
- **Status:** Not an issue. Retained here to document the false positive and prevent re-flagging.

---

## Low-Severity Findings

### S-13 — No security headers configured in `next.config.mjs`
- **Severity:** LOW (P2)
- **File:** `next.config.mjs`
- **Observation:** No `headers()` block. Missing CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- **Recommendation:** Add a `headers()` async function returning at minimum:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (production only)
  - A CSP appropriate for Next.js (allow self + Supabase storage origin).

### S-14 — User-supplied `displayName` rendered without explicit sanitisation
- **Severity:** LOW (P2)
- **File:** `src/app/leaderboard/page.tsx:49`
- **Observation:** React auto-escapes string children, so direct XSS is unlikely. Risk vector is enforcement of length and character set — currently no cap on `displayName` itself (only on answers).
- **Recommendation:** Enforce a max length (≤ 32) and a printable-character allowlist at write time (signup + future profile edit).

### S-15 — `next-auth 4.x` is end-of-life path
- **Severity:** LOW (P3)
- **File:** `package.json:20`
- **Observation:** v5 (Auth.js) is the current line; v4 receives only critical patches.
- **Recommendation:** Plan a v5 migration before next major refactor. Until then, monitor `next-auth` GitHub releases.

---

## Summary

| # | Severity | Area |
|---|---|---|
| S-01 | CRITICAL | Authentication |
| S-02 | CRITICAL | Authentication |
| S-03 | CRITICAL | Authentication |
| S-04 | HIGH | Privacy / API |
| S-05 | HIGH | Authentication |
| S-06 | HIGH | Authentication |
| S-07 | HIGH | Session lifetime |
| S-08 | HIGH | Configuration |
| S-09 | MEDIUM | Input validation |
| S-10 | MEDIUM | CSRF |
| S-11 | MEDIUM | PWA cache |
| S-12 | MEDIUM | Gameplay integrity |
| S-13 | LOW | Headers |
| S-14 | LOW | XSS / display data |
| S-15 | LOW | Dependency |

**Headline action:** the app currently allows anyone who knows a registered email to sign in as that user. Do not deploy to production until S-01, S-02, and S-03 are fixed.
