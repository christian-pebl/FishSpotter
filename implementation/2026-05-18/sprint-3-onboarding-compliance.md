# Sprint 3 — Onboarding & Compliance

## Goal

Make FishSpotter safe to share publicly. PEBL CIC is a UK-registered Community Interest Company collecting personal data (email, IP, behavioural answers) and setting functional cookies (NextAuth JWT). The app today has no privacy notice, no T&Cs, no email verification, no password reset, and no account-deletion route. Several of these are hard legal blockers under UK GDPR and PECR; the rest are credible-launch blockers (a forgotten password permanently locks an account today). Sprint 3 closes those gaps and lands the first-run UX scaffolding (landing page sign-up CTA, onboarding tour, account page, header avatar) so a cold visitor can complete a clean, legible, recoverable account lifecycle.

## Definition of done

A cold visitor in incognito can:

1. Land on `/`, see a value-prop CTA that explicitly mentions creating an account, read a plain-English summary of the quiz / streak mechanic, and reach a privacy policy and T&Cs from the footer.
2. Sign up with email + password, receive a verification email via Resend, click the link, land back in the app with `User.emailVerified` set.
3. Forget their password, request a reset from `/auth/forgot`, receive an email with a single-use token, set a new password at `/auth/reset/[token]`, sign back in.
4. Complete a 3-step in-app onboarding tour (typed-answer mechanic, staff-answer reveal, streak meaning) on first sign-in, with dismissal persisted in `User.onboardedAt`.
5. Visit `/account` to see their email, display name, streak, email-verified status, weekly-digest opt-in toggle, and a Sign Out button. Edit display name. Delete account (GDPR Article 17), with a typed-confirm step that cascades all `Answer` rows.
6. See a header avatar / initials chip across every authenticated route surfacing their identity and streak without opening the side menu.
7. Sign-in / sign-up forms reflect typed-quiz-answer context (carried in via the Sprint 2 redirect contract) so the user does not lose their answer.
8. Cookie banner appears on first visit (PECR disclosure) with a dismiss action; consent state stored in a first-party cookie. No tracking cookies are set without consent (currently moot — the app sets only the auth JWT, which is strictly necessary, but the banner future-proofs analytics work).
9. Prisma schema is extended with `User.emailVerified`, `User.onboardedAt`, `User.digestOptIn`, `VerificationToken`, `PasswordResetToken`, and the NextAuth `Account` model. Existing user data is preserved (additive migration, all new columns nullable / defaulted).
10. All transactional emails (verify, reset, weekly digest) render via React Email templates with PEBL brand tokens. Resend is wired with `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` env vars; sandbox-mode for preview deploys, production-mode for `fish-spotter.vercel.app`.
11. Playwright e2e suite covers: signup → verify → first answer → onboarding seen → sign-out; forgot password happy path; account deletion cascades.

## Compliance scope (UK CIC, UK GDPR, PECR — confirm with PEBL legal)

This sprint plans the engineering work for compliance, **not** the legal copy itself. The privacy / T&Cs text must be confirmed by Christian / PEBL legal before launch. Engineering scope:

- **UK GDPR Art. 13 (information at collection):** privacy policy linked from sign-up form and footer, explaining lawful basis (consent for digest emails; legitimate interest for the auth session and basic analytics if added later), data categories (email, hashed password, IP for rate-limit, quiz answers), retention period (TBC with PEBL — engineering needs a number), and rights.
- **UK GDPR Art. 15 (right of access):** out of scope this sprint; flagged for Sprint 6+. A manual export-on-request via support email is acceptable interim posture per ICO guidance for small CICs.
- **UK GDPR Art. 17 (right to erasure):** in scope. `DELETE /api/account` cascades `Answer` rows (already `onDelete: Cascade` on the schema) and revokes the session.
- **UK GDPR Art. 7 (consent):** weekly digest is opt-in (unticked by default), with a one-click unsubscribe link in every digest email (PECR Reg. 22 requirement for unsolicited marketing).
- **PECR Reg. 6 (cookies):** the auth JWT is strictly necessary and does not require consent, but PECR still requires the user be informed. Cookie banner discloses this and links to the privacy policy. If analytics is added in a later sprint, the banner needs to gate non-essential cookies; the component should be built with that pluggability in mind.
- **CIC-specific trust signals:** privacy and T&Cs pages must include the CIC name (Plant Ecology Beyond Land (PEBL) CIC), company number (12076622), registered email (`hello@pebl-cic.co.uk`), and a link to `pebl-cic.co.uk`. Already documented in the root CLAUDE.md "Company Details" section.

**Engineering deliverable:** policy *page scaffolding* with PEBL-branded layout, slots for legal copy, version field, and "last updated" timestamp. The actual policy text is a writing task for Christian / PEBL legal counsel.

## Audit findings addressed

From `audit/ux-2026-05/06-onboarding-auth.md`:

| Finding | Severity | Ticket |
|---|---|---|
| F1 — no password reset flow | High | S3-04, S3-05 |
| F2 — no email verification | High | S3-03, S3-06 |
| F3 — no OAuth options | Medium | S3-02 (schema scaffolding only; provider wiring deferred to Sprint 6+) |
| F4 — landing page has no sign-up CTA or value explainer | Medium | S3-10 |
| F5 — auth gate is jarring (full-page redirect) | Medium | Owned by Sprint 2; S3-15 closes the loop on form side |
| F6 — no first-time-user onboarding | Medium | S3-11 |
| F7 — sign-in error message hides real cause | Medium | S3-15 |
| F8 — no privacy / T&Cs / cookie consent | High (legal) | S3-08, S3-09 |
| F9 — sign-out has no confirm / no toast | Low | S3-13 |
| F10 — account state weak outside side menu | Low | S3-13 |
| F11 — no profile editing UI | Low | S3-12 |
| F12 — empty leaderboard text assumes auth | Low | S3-14 |
| F13 — leaderboard unbounded fetch | Medium | Deferred to Sprint 4 (perf) — out of this sprint's scope |
| F14 — display-name fallback exposes email local-part | Low | S3-15 (Spotter-{shortId} fallback) |
| F15 — zero email touchpoints / no re-engagement | Medium | S3-16 (digest), S3-17 (streak nudge) |
| F16 — `window.location.href` redirect on sign-in | Low | S3-15 |

Also addresses cross-cutting Theme F (Compliance & lifecycle gaps) from `00-README.md`.

## Dependency graph

```
S3-01 (schema) ──┬─→ S3-02 (Account model scaffolding)
                 ├─→ S3-03 (email service + Resend)
                 │        └─→ S3-04 (forgot-password API)
                 │        └─→ S3-06 (verify-email API)
                 │        └─→ S3-16 (digest cron)
                 │        └─→ S3-17 (streak nudge cron)
                 ├─→ S3-05 (reset-password page) ── needs S3-04
                 ├─→ S3-07 (verify-email page) ── needs S3-06
                 ├─→ S3-12 (account page) ── needs S3-01
                 └─→ S3-13 (header avatar + sign-out toast)

S3-08 (privacy/terms pages) ── independent ── informs S3-10, S3-15
S3-09 (cookie banner) ── needs S3-08 (link target)
S3-10 (landing redesign) ── needs S3-08 (footer link)
S3-11 (onboarding tour) ── needs S3-01 (User.onboardedAt)
S3-14 (empty states) ── independent
S3-15 (sign-in/up form polish) ── needs S3-01, S3-04, S3-06, S3-08
S3-18 (Playwright e2e) ── runs last, validates the whole sprint
```

Critical path: S3-01 → S3-03 → S3-04/06 → S3-05/07 → S3-15 → S3-18. The policy / landing / onboarding work runs in parallel.

## Dependencies on Sprint 1-2

- **Sprint 1 design tokens (Theme A):** every new page (`/auth/forgot`, `/auth/reset/[token]`, `/auth/verify`, `/account`, `/privacy`, `/terms`, onboarding tour) must consume the tokens-in-code Tailwind theme landed in Sprint 1. If Sprint 1 has not shipped, tickets must still use the `pebl-surface` / `pebl-button-primary` / `pebl-eyebrow` class scaffolding visible in the current `/auth/signin` page so the codemod can sweep them later without touching new code.
- **Sprint 1 error.tsx / loading.tsx scaffolding:** the new auth routes pick up the per-route error boundary added in Sprint 1. No new boundaries should be added in this sprint outside of the route-group level.
- **Sprint 2 quiz-pipeline alignment:** the redirect contract for "preserve typed answer through auth redirect" (audit F14 in section 03; F5 in section 06) is owned by Sprint 2. S3-15 in this sprint hooks the form side: read `pendingAnswer` from `searchParams` and surface it in the post-auth callback redirect so Sprint 2's machinery can replay it. If Sprint 2 chooses MCQ instead of free-text, S3-15's "preserve answer" copy needs to read "preserve selected option ID" — confirm before building.
- **Sprint 2 anonymous-first answer (open question 1 in the audit):** if product decides to allow one anonymous answer before the auth gate, S3-15's flow changes from "sign-in interrupts submit" to "sign-in is offered after submit". Confirm with product before Ticket S3-15.

## Tickets

---

### S3-01 — Schema migration: emailVerified, onboardedAt, digestOptIn, VerificationToken, PasswordResetToken

**Priority:** P0 (blocks every email-flow ticket)
**Effort:** S (2-3h, mostly safety + verification)
**Audit refs:** F1, F2, F6, F15
**Files:**
- `prisma/schema.prisma`
- `scripts/backup-pre-drop.ts` (re-use pattern; this migration is additive but run a defensive dump anyway)
- `CLAUDE.md` (project root — update schema summary section)

**Current:** `User` has only `id, email, passwordHash, name, displayName, createdAt, answers`. No verification token, no reset token, no email-verified timestamp, no onboarding flag, no digest opt-in.

**Target:**

```prisma
model User {
  // ... existing fields ...
  emailVerified  DateTime?
  onboardedAt    DateTime?
  digestOptIn    Boolean   @default(false)
  passwordResetTokens PasswordResetToken[]
  verificationTokens  VerificationToken[]
}

model VerificationToken {
  id         String   @id @default(cuid())
  userId     String
  token      String   @unique  // random 32-byte hex, hashed at rest (sha256)
  expiresAt  DateTime           // now + 24h
  consumedAt DateTime?
  createdAt  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model PasswordResetToken {
  id         String   @id @default(cuid())
  userId     String
  token      String   @unique  // random 32-byte hex, hashed at rest (sha256)
  expiresAt  DateTime           // now + 1h
  consumedAt DateTime?
  createdAt  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

**Approach:**
1. Run `scripts/backup-pre-drop.ts` configured for `User` table (additive migration but cheap insurance).
2. Edit `prisma/schema.prisma` per target.
3. `npx prisma db push` (no `--accept-data-loss` should be needed; verify).
4. `npx prisma generate`.
5. Spot-check in Supabase studio that existing `User` rows have `emailVerified = NULL`, `onboardedAt = NULL`, `digestOptIn = false`.
6. **Decision: grandfather existing users.** Existing pre-Sprint-3 users (the seeded test accounts) get `emailVerified = createdAt` set in a one-off SQL run inside the same migration window, so they are not locked out when S3-06 starts gating actions on verification. Document this in the migration log inside CLAUDE.md.
7. Update CLAUDE.md root schema summary.

**Acceptance:**
- `npx prisma db push` runs clean against production.
- `SELECT count(*) FROM "User" WHERE "emailVerified" IS NOT NULL` returns the count of grandfathered accounts.
- `VerificationToken` and `PasswordResetToken` tables exist with the indexes above.
- `prisma generate` regenerates the client; type checking passes across the app.

**Testing:**
- Local: against a Postgres scratch DB, apply migration, insert a user, confirm cascade delete drops verification + reset tokens.
- Production: run `prisma db push` from CI or local with prod creds, verify no data lost.

**Risk:** Low. Migration is additive. Cascade-on-delete already used elsewhere in the schema. Only meaningful risk is forgetting to grandfather existing accounts and accidentally bricking the test users at S3-06 cutover.

**Deps:** None. **First ticket in the sprint.**

---

### S3-02 — NextAuth `Account` model scaffolding (no OAuth providers yet)

**Priority:** P1
**Effort:** S (1-2h)
**Audit refs:** F3
**Files:**
- `prisma/schema.prisma`
- `src/lib/auth.ts` (PrismaAdapter wiring)
- `package.json` (add `@auth/prisma-adapter`)

**Current:** NextAuth is credentials-only with no database adapter; sessions are JWT, accounts are not persisted to a table. Adding Google / Apple / Magic Link later will require a migration in a hot path. Audit F3 flags this as a future-proofing gap.

**Target:** Land the NextAuth-canonical `Account` and `Session` model shapes so a future ticket can drop `GoogleProvider({...})` into the providers array with no schema work. **Do not wire any OAuth provider in this sprint** — that is a product / branding decision (logos, T&Cs implications, Apple developer cost) and is explicitly deferred to Sprint 6+ by the audit roadmap.

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

Wire `PrismaAdapter(prisma)` into `authOptions` but keep `session: { strategy: "jwt" }` — JWT remains the active strategy. The adapter is dormant until an OAuth provider is added; this keeps the door open.

**Approach:**
1. Add fields to `prisma/schema.prisma`.
2. `npm i @auth/prisma-adapter`.
3. Edit `src/lib/auth.ts`: `import { PrismaAdapter } from "@auth/prisma-adapter"; ... adapter: PrismaAdapter(prisma), session: { strategy: "jwt", ... }`.
4. Verify the credentials provider still works under the JWT strategy (NextAuth docs are explicit that Credentials + JWT + Adapter coexist; the adapter just does not write to the Session table for JWT users).

**Acceptance:**
- Schema migrates cleanly.
- Existing sign-in / sign-up flow continues to work end-to-end.
- A future ticket can add Google / Apple by editing only `src/lib/auth.ts`.

**Testing:** Run full sign-up + sign-in cycle locally and on a preview deploy. Verify NextAuth does not error on adapter + JWT combination. The NextAuth migration-warnings page should not flag anything new.

**Risk:** Low-medium. The credentials-provider + JWT-strategy + database-adapter combination is supported but unusual. A regression here breaks all sign-in.

**Deps:** S3-01.

---

### S3-03 — Resend transactional email service + React Email template scaffolding

**Priority:** P0 (blocks reset / verify flows)
**Effort:** M (4-5h including domain DKIM / SPF setup)
**Audit refs:** F1, F2, F15
**Files:**
- `package.json` (add `resend`, `react-email`, `@react-email/components`)
- `src/lib/email/client.ts` (Resend client wrapper)
- `src/lib/email/send.ts` (typed `sendEmail({ to, subject, react })`)
- `src/lib/email/templates/VerificationEmail.tsx`
- `src/lib/email/templates/PasswordResetEmail.tsx`
- `src/lib/email/templates/WeeklyDigestEmail.tsx` (skeleton only; payload in S3-16)
- `src/lib/email/templates/StreakNudgeEmail.tsx` (skeleton only; payload in S3-17)
- `src/lib/email/templates/_shared/Layout.tsx` (PEBL-branded shell)
- `.env.local`, Vercel project env (Production + Preview)
- `CLAUDE.md` (env-vars section)

**Current:** Zero email infrastructure. Audit F15 quantifies this as the single biggest re-engagement gap.

**Target:**
- **Provider:** Resend (per CLAUDE.md root note "Resend (Recommended - simple, modern, good free tier)"). **Confirm with PEBL product before merging.** Resend's free tier is 100 emails/day, 3000/month — comfortable for verify + reset traffic at FishSpotter's expected scale, but the weekly digest will exhaust it once user count exceeds ~420. Plan to upgrade to the $20/month tier before public launch.
- **Sender domain:** `noreply@pebl-cic.co.uk` (requires DKIM + SPF records on pebl-cic.co.uk; Christian to coordinate with whoever holds DNS).
- **Templates:** React Email components rendered server-side. Brand tokens (PEBL teal #3AAFA9, dark navy #17252A) wired via inline styles per CLAUDE.md root brand guidelines. Plain-text fallback auto-generated by React Email.
- **Sandbox mode for preview deploys:** detect `process.env.VERCEL_ENV !== "production"` and route to a `christian.n.berger+fishspotter-preview@gmail.com`-style catchall, or short-circuit and log to console. Avoids spamming real users from preview branches.
- **Idempotency:** `sendEmail` returns `{ ok, messageId }`; failure must not block the parent transaction (verify-email creation should succeed even if the email send 5xxs, with a server-side log so support can re-trigger).

**Env vars to add:**
```
RESEND_API_KEY=re_...
EMAIL_FROM_ADDRESS=noreply@pebl-cic.co.uk
EMAIL_FROM_NAME=PEBL FishSpotter
EMAIL_REPLY_TO=hello@pebl-cic.co.uk
EMAIL_PREVIEW_CATCHALL=christian.n.berger+fishspotter-preview@gmail.com  # only used when VERCEL_ENV !== production
```

**Approach:**
1. `npm i resend react-email @react-email/components`.
2. Build `src/lib/email/client.ts` exporting a singleton `new Resend(process.env.RESEND_API_KEY)` with graceful no-op in test mode.
3. Build `src/lib/email/send.ts` with `sendEmail({ to, subject, react, replyTo? })` that uses React Email's `render()`, calls Resend, swallows errors into the logger.
4. Build shared `Layout` template with PEBL logo (use a Supabase-hosted PNG to avoid embedding base64), brand-token colours, footer with CIC details + `EMAIL_REPLY_TO`.
5. Build `VerificationEmail` and `PasswordResetEmail` with their token URLs. Skeleton-only `WeeklyDigestEmail` and `StreakNudgeEmail`.
6. Set up DKIM / SPF / DMARC on pebl-cic.co.uk via Resend dashboard. Christian to action the DNS changes.
7. End-to-end probe: a tiny script `scripts/email-probe.ts` that sends a single test to Christian and asserts a 2xx response.

**Acceptance:**
- `npm run email:probe` (new script alias in `package.json`) sends a styled test email to Christian's address and prints the Resend message ID.
- DKIM, SPF, DMARC pass at `mxtoolbox.com` for `pebl-cic.co.uk`.
- Templates render correctly in Gmail web, Outlook web, and Apple Mail iOS (manual visual check; React Email's documented compatibility matrix is the spec).

**Testing:**
- Send each of the 4 templates to gmail / outlook / proton inboxes; check spam folder; verify CTA links resolve.
- Preview-deploy probe: trigger a verify email from a preview URL, confirm it lands at the catchall and not the real user.

**Risk:** Medium. DKIM / SPF setup is in someone else's hands (PEBL DNS holder); historically the most common reason these slip. Mitigate by starting DNS work day 1 of the sprint even if the code lands later.

**Deps:** S3-01 (for the User shape that templates reference). Confirm Resend with product before starting.

---

### S3-04 — Password reset request: `POST /api/auth/forgot` + `/auth/forgot` page

**Priority:** P0
**Effort:** M (3-4h)
**Audit refs:** F1
**Files:**
- `src/app/auth/forgot/page.tsx`
- `src/app/api/auth/forgot/route.ts`
- `src/lib/email/templates/PasswordResetEmail.tsx` (lands in S3-03; this ticket consumes it)
- `src/lib/auth/tokens.ts` (new — random + sha256 helpers shared with S3-06)

**Current:** No flow exists. Audit F1: "A user who forgets their password is permanently locked out."

**Target:**
- **Page `/auth/forgot`:** PEBL-branded form, single field (email), submit button, success state ("If an account exists for this address, a reset link has been sent. Check your inbox."). Returns the same success state regardless of whether the user exists — standard email-enumeration mitigation.
- **API `POST /api/auth/forgot`:**
  1. Rate-limit per IP and per email (re-use `checkAuthRateLimit` from `src/lib/rate-limit.ts`; 3 attempts / 15 min is appropriate for reset given the email cost).
  2. `prisma.user.findUnique({ where: { email } })` — if no match, return 200 with the same body to avoid enumeration.
  3. If match: generate `crypto.randomBytes(32).toString('hex')` token; store sha256 of token in `PasswordResetToken` with `expiresAt = now + 1h`; send the **plain** token by email (the DB only stores the hash so a DB leak does not enable resets).
  4. Email links to `https://fish-spotter.vercel.app/auth/reset/[plainToken]`.
  5. Always return `200 { ok: true }`.

**Approach:** Standard rotating-token pattern. The hashing-at-rest is the only non-obvious bit and protects against DB leak as a privilege escalation vector.

**Acceptance:**
- Submitting the form with a real email triggers a Resend send and writes a `PasswordResetToken` row.
- Submitting with a non-existent email returns the same success body (verify in DevTools network tab).
- Rate-limit kicks in at attempt 4 from the same IP within 15 min, returning 429.
- Token stored in DB is sha256(plainToken), never the plain token.

**Testing:**
- Unit test for the token helper: `hashToken(plain) === expectedSha256`.
- Manual: request reset with valid email, expect email; request with garbage email, expect same page response, no email.
- Manual: pull DB, confirm `token` column does not equal anything in the email body.

**Risk:** Medium. The hashing-at-rest detail is easy to skip under time pressure; if skipped, a DB leak hands attackers active reset tokens.

**Deps:** S3-01, S3-03.

---

### S3-05 — Password reset consume: `/auth/reset/[token]` page + `POST /api/auth/reset`

**Priority:** P0
**Effort:** M (3h)
**Audit refs:** F1
**Files:**
- `src/app/auth/reset/[token]/page.tsx`
- `src/app/api/auth/reset/route.ts`

**Current:** No flow.

**Target:**
- **Page `/auth/reset/[token]`:** server component that validates the token (sha256-hash lookup, `consumedAt IS NULL`, `expiresAt > now`). If invalid or expired, render an "expired link" state with a CTA back to `/auth/forgot`. If valid, render a client form (new password + confirm password, both ≥ 8 chars, must match).
- **API `POST /api/auth/reset`:**
  1. Body: `{ token, newPassword }`.
  2. Re-validate token (race-condition window between page-render and POST).
  3. `bcrypt.hash(newPassword, 12)` (match the BCRYPT_ROUNDS const at `src/lib/auth.ts:12`).
  4. Update `User.passwordHash`. Set `PasswordResetToken.consumedAt = now`.
  5. **Invalidate all existing sessions for that user.** Because session strategy is JWT and JWTs are stateless, this is a limitation we explicitly accept for Sprint 3 — document in CLAUDE.md that reset does not revoke active sessions on other devices until JWT expiry. A proper fix needs the Session table (S3-02) wired in active mode, which is Sprint 6+ work.
  6. Return 200; client redirects to `/auth/signin?reset=success` which shows a success banner.

**Approach:** Mirror S3-04's hashing-at-rest convention.

**Acceptance:**
- Happy path completes: request → email → click link → set new password → sign in with new password.
- Re-using a consumed token returns 410 Gone with a friendly message.
- Token > 1h old returns 410.
- Password < 8 chars returns 400 with inline error.

**Testing:**
- Playwright e2e (lands in S3-18).
- Manual: race the token — open the link twice in two tabs, confirm only one POST succeeds.

**Risk:** Low.

**Deps:** S3-04.

---

### S3-06 — Email verification on sign-up: `POST /api/auth/verify-request` + send-on-signup wiring

**Priority:** P0
**Effort:** M (3h)
**Audit refs:** F2
**Files:**
- `src/lib/auth.ts` (modify the `authorize` callback's sign-up branch)
- `src/app/api/auth/verify-request/route.ts` (resend verification)
- `src/lib/auth/tokens.ts` (shared with S3-04)

**Current:** Sign-up creates a usable account immediately. No `emailVerified` column. Audit F2: "anyone can create accounts impersonating someone else's address."

**Target:**
- On sign-up (in the existing `authorize` callback at `src/lib/auth.ts:35-50`):
  1. After `prisma.user.create`, generate a verification token (same crypto + sha256 helpers as S3-04, 24h TTL).
  2. Store hashed token in `VerificationToken`.
  3. Send `VerificationEmail` via the S3-03 email service. Failure does not block sign-up; user can resend later.
  4. Allow the user to sign in immediately (do not block on verification) — but UI surfaces (account page header, banner on `/feed`) flag the unverified state.
- **Resend endpoint `POST /api/auth/verify-request`:** authenticated route. If the calling user has `emailVerified IS NULL`, generate a fresh token, invalidate prior unconsumed tokens (set `consumedAt = now` to keep history), send email. Rate-limit: 3 per hour per user.
- **Soft gating:** for Sprint 3, no action is blocked by `emailVerified IS NULL` other than receiving the weekly digest (S3-16). The intent is to land verification infrastructure without breaking existing users. A future ticket can tighten this once data shows verify rate.

**Approach:** Minimal touch to `src/lib/auth.ts` — the verification email is a fire-and-forget after `prisma.user.create`. The dev experience matters: do not throw if Resend fails, just log.

**Acceptance:**
- New sign-ups receive a verification email within 30s.
- The verification record is in `VerificationToken` with the sha256-hashed token.
- The account is immediately usable (the user can answer quizzes), but `User.emailVerified` is null until they click the link (which is S3-07).
- Resend endpoint works and rate-limits.

**Testing:** Manual sign-up flow + Playwright e2e (S3-18).

**Risk:** Low. The fire-and-forget pattern means email failures do not surface as user-facing errors.

**Deps:** S3-01, S3-03.

---

### S3-07 — Email verification consume: `/auth/verify?token=...` route

**Priority:** P0
**Effort:** S (2h)
**Audit refs:** F2
**Files:**
- `src/app/auth/verify/page.tsx`
- `src/app/api/auth/verify/route.ts`

**Current:** No flow.

**Target:**
- `/auth/verify?token=...` is a server component. It POSTs to `/api/auth/verify` from the server (or hands off to a client effect that POSTs once).
- `POST /api/auth/verify` validates the token (sha256 lookup, not consumed, not expired), sets `User.emailVerified = now`, marks token consumed. Returns 200 with the user ID.
- Page renders success state ("Your email is verified — welcome.") with a CTA "Continue spotting" → `/feed`.
- Invalid / expired token shows a friendly error with a "Resend verification email" button (requires the user to be signed in to use it — explain that they need to sign in first).

**Approach:** Symmetric to S3-05 (consume-token-via-page-route).

**Acceptance:**
- Clicking the email link sets `User.emailVerified` and renders a success state.
- Re-clicking the consumed link shows a "this link was already used" message, not a hard error.
- Expired link shows a "resend verification" CTA.

**Testing:** Playwright e2e covers happy path + expired + already-consumed.

**Risk:** Low.

**Deps:** S3-06.

---

### S3-08 — Privacy policy and Terms of Service page scaffolding

**Priority:** P0 (legal blocker for public launch)
**Effort:** S (2h scaffolding; legal copy is out-of-scope writing work)
**Audit refs:** F8
**Files:**
- `src/app/privacy/page.tsx`
- `src/app/terms/page.tsx`
- `src/data/legal/privacy-policy.md` (or `.mdx` — confirm preference)
- `src/data/legal/terms-of-service.md`
- `src/components/legal/LegalLayout.tsx`

**Current:** No `/privacy`, no `/terms`. Audit F8: "PEBL CIC is a UK-registered Community Interest Company collecting personal data... no privacy policy page, no T&Cs, no GDPR data-subject-access route."

**Target:**
- Both pages share a `LegalLayout` shell: PEBL header, branded title, `last_updated` date, version tag (`v1.0 — 2026-05-...`), section TOC sidebar on desktop, prose body.
- Source content lives in `src/data/legal/*.md` so legal updates can be done by editing markdown without touching React.
- Both pages link to each other in the footer and include CIC details (company number 12076622, registered email `hello@pebl-cic.co.uk`, link to `pebl-cic.co.uk`).
- The privacy policy file ships with **placeholder section headers** that match UK ICO's "Privacy notice checklist": identity, contact, data collected, lawful basis, retention, third parties (Resend, Vercel, Supabase, iNaturalist, OBIS, GBIF), rights, complaints (ICO contact). Legal copy itself: **Christian / PEBL legal to write**. Engineering deliverable here is the scaffolding and the placeholder.
- Terms of service file similarly: placeholders for acceptable use, account termination, liability, governing law (England and Wales).

**Approach:** Use a markdown loader (Next.js native `import` of `.md` won't work without a plugin; either use `gray-matter` + `remark` or write the prose directly in TSX). Recommend `remark` + `remark-html` for the lowest-friction path; this is already a common pattern in Next.js docs sites.

**Acceptance:**
- `/privacy` and `/terms` render with PEBL branding.
- Both pages are linked from `Footer.tsx` (if it does not exist, add one), the sign-up form (per S3-15), and the cookie banner (S3-09).
- "Last updated" timestamp is present and machine-readable for the bottom of the page.
- Pages return 200 with `og:title` and `og:description` meta tags for shareability.

**Testing:**
- Both routes return 200 in incognito.
- Lighthouse SEO score ≥ 90 on both pages.

**Risk:** Low engineering risk. The *legal* risk is real — explicitly call out in the PR description that the placeholder text must be replaced before public launch.

**Deps:** None.

---

### S3-09 — Cookie banner (PECR Reg. 6 disclosure)

**Priority:** P1
**Effort:** S (2-3h)
**Audit refs:** F8
**Files:**
- `src/components/legal/CookieBanner.tsx`
- `src/lib/cookies/consent.ts` (read / write consent cookie)
- `src/app/layout.tsx` (mount the banner)

**Current:** No banner. The auth JWT cookie is set without disclosure. PECR Reg. 6 requires informing the user even for strictly-necessary cookies.

**Target:**
- Banner appears on first visit if the consent cookie is not set. Bottom-fixed, PEBL-branded, two buttons: "Got it" (sets consent cookie, dismisses) and "Read policy" (links to `/privacy`).
- Consent stored in a first-party cookie `pebl_consent={"v":1,"ts":...,"essential":true,"analytics":false}` for 12 months. Essential is always true. Analytics is a placeholder for future granularity — for Sprint 3 the banner is informational, not granular, because no non-essential cookies exist yet.
- Banner is dismissable; consent state is read on every page load by a server component to decide whether to render.
- Future-proof: the consent shape can absorb a granular toggle in a later sprint without breaking the cookie format.

**Approach:** Read the consent cookie in the root layout (server component); render the banner only if absent. Banner client-side hydrates with the dismiss action.

**Acceptance:**
- First-visit incognito shows the banner.
- Dismissing sets the cookie; reload does not re-show.
- Banner is keyboard-accessible (Tab to "Got it", Enter dismisses).
- Banner does not block scroll or trap focus.

**Testing:**
- Playwright: incognito visit, assert banner visible; click "Got it", assert dismissal persists across reload.

**Risk:** Low.

**Deps:** S3-08 (the "Read policy" link target).

---

### S3-10 — Landing page (`/`) value-prop redesign + sample clip + sign-up CTA

**Priority:** P1
**Effort:** M (4-5h)
**Audit refs:** F4
**Files:**
- `src/app/page.tsx` (substantial rewrite)
- `src/components/landing/SampleClip.tsx` (new — autoplay-muted 8s sample)
- `src/components/landing/HowItWorks.tsx` (new — 3-step explainer)
- `src/components/landing/AboutPEBL.tsx` (new — CIC trust panel)
- `src/components/Footer.tsx` (new or extended — privacy / terms links)

**Current:** Two CTAs ("Start spotting" → `/feed`, "Explore archive" → `/feed/browse`). No sign-up CTA. No quiz-mechanic explainer. No PEBL-CIC trust signalling. Audit F4 calls all of this out specifically.

**Target:**
- **Hero:** Keep existing copy. Add a tertiary CTA "Create your spotter profile" → `/auth/signin?isSignUp=1` next to "Start spotting".
- **Sample clip:** 8-12s muted autoplay loop of an iconic snippet (Christian to nominate — e.g. one of the wrasse or thornback ray clips), shown inline below the hero. Demonstrates the product without requiring a sign-up. Falls back to a poster image if autoplay is blocked.
- **How it works:** 3 cards: (1) "Spot the species in 5s" (the typed-answer mechanic), (2) "Compare with PEBL staff" (the staff-answer reveal — explains the documented mismatch in audit Theme D between brief and implementation, so users understand what they're comparing against), (3) "Build a streak" (daily-return mechanic).
- **About PEBL:** Trust panel with CIC number (12076622), tagline ("Protecting Ecology Beyond Land"), 2-3 sentences on the mission, link to `pebl-cic.co.uk`.
- **Footer:** Privacy, Terms, About PEBL, hello@ contact, copyright year. Lands sitewide via `app/layout.tsx`.
- **Sign-up CTA copy:** explicit about account requirement — "Submit answers and join the leaderboard. Free, no card required." (Avoid GDPR-redundant phrases like "we never share your data" — that lives in the privacy policy.)

**Approach:**
1. Sketch the section order in markdown first (Christian to approve).
2. Build the sample-clip player as a thin wrapper around `<video autoPlay muted loop playsInline poster={...} />` — same H.264 invariant as the feed; do not introduce a new codec path.
3. Wire the sign-up CTA to `/auth/signin?isSignUp=1` so S3-15's form opens in sign-up mode by default when arriving from the landing.

**Acceptance:**
- New visitors see the 3-CTA layout with sign-up explicitly surfaced.
- Sample clip plays muted-autoplay on Chrome / Safari mobile and desktop.
- LCP for the landing page does not regress (the sample clip uses `preload="metadata"` and a poster).
- Footer privacy/terms links resolve.

**Testing:**
- Lighthouse on `/` for desktop and mobile, LCP < 2.5s.
- Playwright visual regression at 375 / 768 / 1280.

**Risk:** Low. The largest risk is the sample-clip autoplay on iOS Safari, which requires `playsinline muted` and no audio track.

**Deps:** S3-08 (footer policy links).

---

### S3-11 — First-run onboarding tour (3 steps, persisted in `User.onboardedAt`)

**Priority:** P1
**Effort:** M (5-6h)
**Audit refs:** F6
**Files:**
- `src/components/onboarding/OnboardingTour.tsx`
- `src/components/onboarding/steps/*.tsx` (3 steps)
- `src/app/api/account/onboarding/route.ts` (POST sets `onboardedAt = now`)
- `src/components/FeedCard.tsx` (mount the tour for first-time signed-in users on first card render)

**Current:** No onboarding. Audit F6: codebase has zero matches for `onboarding`, `tour`, `tooltip`, `welcome`.

**Target:**
- A modal-sheet tour that appears once, immediately after a new user's first sign-in, with three slides:
  1. **"Spot the species" —** illustration of the typed-answer input, explainer of free-text + fuzzy match.
  2. **"Compare with PEBL staff" —** illustration of the reveal card, explainer of the staff-answer concept (audit Theme D context).
  3. **"Build a streak" —** the daily-return mechanic, with the explicit note that the streak is visible in the header avatar popover (S3-13).
- Trigger logic: on `/feed` mount, if `session?.user.id` and `User.onboardedAt IS NULL`, show the tour. "Skip" or "Got it" on the last slide POSTs `/api/account/onboarding`, which sets `onboardedAt = now`.
- Dismissal is recorded server-side, not in `localStorage` — so a user who clears storage does not see the tour again from a second device.
- Sprint-2 dependency: if Sprint 2 changes the quiz mechanic to MCQ, slide 1's illustration changes. Coordinate copy with Sprint 2 before building the asset.

**Approach:** Use framer-motion (already in the project) for slide transitions. Re-use the `pebl-surface` shell pattern from the auth pages.

**Acceptance:**
- First-time sign-up → first `/feed` visit shows the tour.
- Completing or skipping persists `onboardedAt`.
- Second sign-in does not show the tour.
- Tour is keyboard-navigable (left / right arrows between slides, Esc to dismiss).
- Focus trap when open (consistent with SpeciesGallery, which the audit cites as the correct pattern).

**Testing:**
- Playwright: sign-up → land on /feed → assert tour visible → dismiss → reload → assert not visible.

**Risk:** Low.

**Deps:** S3-01 (User.onboardedAt).

---

### S3-12 — `/account` page: profile, verification status, digest opt-in, delete account

**Priority:** P0 (delete-account is GDPR Art. 17)
**Effort:** L (6-8h)
**Audit refs:** F8 (delete), F11 (profile edit), F15 (digest opt-in)
**Files:**
- `src/app/account/page.tsx`
- `src/app/api/account/route.ts` (PATCH display-name, DELETE account)
- `src/app/api/account/digest/route.ts` (PATCH toggle digestOptIn)
- `src/components/account/DeleteAccountDialog.tsx`

**Current:** No account page. Audit F11: "no UI to change [displayName]"; audit F8: "no GDPR data-subject-access route... no DELETE /api/account."

**Target:**

A single page with four sections:

1. **Identity:** email (readonly, with verified / unverified badge); display name (editable, save button, re-uses `/[^\p{L}\p{N}\s._-]/gu` sanitiser at `src/lib/auth.ts:43`); created date.
2. **Verification:** if unverified, "Send verification email" CTA hits `/api/auth/verify-request` (S3-06).
3. **Notifications:** weekly digest opt-in checkbox (PATCHes `User.digestOptIn`). Streak-nudge opt-in implied by digest opt-in for Sprint 3; granular toggle deferred.
4. **Danger zone:** "Delete account" button → `DeleteAccountDialog` requires typing the user's email to confirm → DELETE `/api/account`. Cascades all `Answer` rows (already `onDelete: Cascade` on the schema). Signs the user out and redirects to `/?deleted=1` which shows a "Your account and all answers have been removed" toast.

**Approach:**
- Server component for the page, reads session and user data.
- Client components for the editable forms.
- `DELETE /api/account`: validate session; `prisma.user.delete({ where: { id } })`; cascade handles Answer + Account + Session + VerificationToken + PasswordResetToken. `signOut({ callbackUrl: "/?deleted=1" })` from the client.
- Log every deletion to the server logger with the user ID (already cascaded out of the DB) and timestamp, so support can answer "did this user actually delete?" questions without retaining the data itself.

**Acceptance:**
- Display-name edit persists and surfaces on the leaderboard immediately (revalidate the leaderboard route).
- Digest opt-in toggle persists.
- Delete-account requires typed-email confirmation, cascades all Answer + token rows, redirects to landing with a confirmation toast.
- A deleted user trying to sign back in with the same email gets the regular "no account" message and can re-sign up freshly.

**Testing:**
- Manual: delete a seed test user, verify in Supabase studio that Answer rows are gone.
- Playwright: full delete flow.

**Risk:** Medium. Cascade-delete is irreversible — make sure the typed-confirm prompt is unambiguous, and consider a 30-day soft-delete window in a future sprint. For Sprint 3 the immediate hard delete is sufficient and matches Art. 17 expectations.

**Deps:** S3-01, S3-06 (resend verify CTA).

---

### S3-13 — Header avatar / initials chip + Sign-Out confirm + toast

**Priority:** P1
**Effort:** M (3-4h)
**Audit refs:** F9, F10
**Files:**
- `src/components/Header.tsx`
- `src/components/AvatarMenu.tsx` (new — popover with display name, streak, account link, sign out)
- `src/components/SideMenu.tsx` (update sign-out call)

**Current:** Identity is only visible inside the SideMenu (`src/components/SideMenu.tsx:160-174`). Audit F10: "On the /feed overlay header the logo is rendered at 30% opacity, so even brand presence is muted." Audit F9: sign-out has no confirm, no toast, no callbackUrl.

**Target:**
- Header right slot renders an avatar / initials chip when `useSession()` returns authenticated. Click opens a small popover with:
  - Display name + email
  - Current streak (fetched once on mount via `/api/streak`)
  - "Account settings" → `/account`
  - "Sign out" → confirm prompt → `signOut({ callbackUrl: "/" })` → success toast on landing
- Unauthenticated header right slot shows "Sign in" link to `/auth/signin`.
- The chip uses the first two letters of `displayName` on a PEBL-teal background (#3AAFA9) — keeps it brand-coherent without needing user avatars.

**Approach:** Re-use framer-motion popover patterns from existing components. The streak fetch is the only new data call; cache it client-side for the session.

**Acceptance:**
- Avatar visible on every authenticated route (feed, archive, leaderboard, account).
- Sign-out asks "Sign out of PEBL FishSpotter?" before executing.
- Post-sign-out toast on landing page: "Signed out — see you next time."

**Testing:**
- Playwright: sign in, assert avatar; click avatar, click sign out, confirm, assert redirect to `/` and toast.

**Risk:** Low.

**Deps:** S3-01.

---

### S3-14 — Empty states for new (0-answer) users across feed, archive, leaderboard

**Priority:** P2
**Effort:** S (2-3h)
**Audit refs:** F12
**Files:**
- `src/app/feed/page.tsx`
- `src/app/feed/browse/page.tsx`
- `src/app/leaderboard/page.tsx`
- `src/components/empty/*.tsx` (new shared empty-state components)

**Current:** Audit F12: "The empty state reads 'No entries yet. Sign in and submit an observation to appear on the PEBL leaderboard.' This is shown to all visitors regardless of auth status, so a signed-in user with zero answers gets the same message asking them to sign in."

**Target:**
- Leaderboard empty state branches on `getServerSession`:
  - Guest: "No spotters yet — sign in to be first." with `/auth/signin?callbackUrl=/feed` link.
  - Signed-in with 0 answers: "Submit your first sighting on the feed to claim a rank." with `/feed` link.
  - Signed-in with answers but no peers: "You're the only spotter so far. Invite a friend." (low priority polish.)
- Community-guesses panel similarly branches.
- Feed: if the user has just signed up, show a one-line welcome banner above the first card ("Welcome, {displayName}. Your streak starts with your first answer.") — dismissable. Persisted via a `localStorage` flag is fine here (low-stakes).

**Approach:** Pure presentational change.

**Acceptance:**
- Each empty state matches the user's actual state, not a generic copy.
- Snapshot tests of the empty-state components.

**Testing:**
- Playwright at: guest visit /leaderboard; new-user visit /leaderboard.

**Risk:** Low.

**Deps:** None.

---

### S3-15 — Sign-in / sign-up form polish: distinct errors, sane fallbacks, T&Cs checkbox, router.replace

**Priority:** P0
**Effort:** M (4h)
**Audit refs:** F5, F7, F8, F14, F16
**Files:**
- `src/app/auth/signin/page.tsx`
- `src/lib/auth.ts` (typed error returns from `authorize`)
- `src/components/auth/PasswordStrengthHint.tsx` (new)

**Current:** Generic error messages, full-page reload after auth (`window.location.href` at `src/app/auth/signin/page.tsx:38`), no T&Cs checkbox, display-name fallback exposes email local-part (`src/lib/auth.ts:44`), no password-rules UX beyond `min 8`.

**Target:**
- **Distinct error codes from `authorize`:** instead of returning `null` for every failure, throw `new Error("RATE_LIMITED" | "INVALID_PASSWORD" | "NO_USER" | "EMAIL_TAKEN" | "WEAK_PASSWORD")`. Map to friendly copy client-side. Keep enumeration mitigation: on sign-in, merge `NO_USER` and `INVALID_PASSWORD` into a single "Email or password incorrect"; surface `RATE_LIMITED` and `EMAIL_TAKEN` distinctly.
- **Display-name fallback:** change `src/lib/auth.ts:44` from `email.split("@")[0]` to `Spotter-${nanoid(6)}`. Existing users grandfathered.
- **T&Cs checkbox** at sign-up: "I agree to the [Terms]({href}/terms) and [Privacy Policy]({href}/privacy)." Required to submit. The checkbox state is not persisted server-side for Sprint 3 (a future ticket can add `User.tosAcceptedAt` if PEBL legal wants the audit trail).
- **Password strength hint:** below the password input, list the rules in real-time green / grey:
  - ≥ 8 chars
  - mixed case (recommended, not required)
  - includes a number (recommended)
  - The only hard rule remains ≥ 8 chars (matches `src/lib/auth.ts:11`).
- **Router instead of full reload:** replace `window.location.href = callbackUrl` (line 38) with `router.replace(callbackUrl); router.refresh();`. Preserves SPA state and avoids the white-flash audit F16 flags.
- **Carry pending-answer state through redirect:** read `?pendingAnswer=...` and `?snippetId=...` from `searchParams`; surface "We saved your answer — finish signing in to submit it." copy above the form; pass them forward in the post-auth client effect so Sprint 2's machinery can replay. **Coordinate with Sprint 2's redirect-contract ticket before building this half** — the parameter names must match.

**Approach:** Re-shape `authorize` to throw, client-side `.catch(e => mapErrorCode(e.message))`. NextAuth surfaces thrown errors via `res.error`, so the existing form structure works.

**Acceptance:**
- Wrong password shows "Email or password incorrect."
- Existing email at sign-up shows "An account with this email already exists. Sign in?"
- Rate-limited shows "Too many attempts. Try again in 15 minutes."
- T&Cs checkbox is required at sign-up.
- Successful sign-in does not full-reload.

**Testing:**
- Playwright (lands in S3-18).
- Unit test the error mapping function.

**Risk:** Medium. The `authorize`-throws pattern is documented but not the default — verify it propagates to `res.error` correctly across NextAuth's client SDK.

**Deps:** S3-01, S3-04, S3-06, S3-08. Coordinate with Sprint 2.

---

### S3-16 — Weekly digest cron (`/api/cron/digest`) — Mon 08:00 UTC

**Priority:** P2
**Effort:** M (4h)
**Audit refs:** F15
**Files:**
- `src/app/api/cron/digest/route.ts`
- `vercel.json` (add cron entry)
- `src/lib/email/templates/WeeklyDigestEmail.tsx` (scaffolded in S3-03, payload here)
- `src/lib/digest/build.ts` (compute the digest payload per user)

**Current:** No re-engagement emails. Audit F15.

**Target:**
- Cron at `0 8 * * 1` (Mon 08:00 UTC). Same `Authorization: Bearer ${CRON_SECRET}` pattern as the existing biodiversity crons documented in CLAUDE.md.
- For each `User` with `digestOptIn = true` AND `emailVerified IS NOT NULL`:
  1. Compute their stats: answers this week, correct rate, streak.
  2. Pull top 3 leaderboard rows (just for variety).
  3. Pull any new snippets added this week.
  4. Render `WeeklyDigestEmail` and send.
- **Budget:** 50s per cron run; cap at 200 emails per invocation to stay inside Vercel cron's 60s timeout. If more, paginate via a `cursor` query param and re-fire (or land at Sprint 4 with a queue).
- Every email has a one-click unsubscribe link → `GET /api/account/digest/unsubscribe?token=...` that flips `digestOptIn` to `false`. PECR Reg. 22 requires this. Use a per-user unsubscribe token derived from `User.id` + `NEXTAUTH_SECRET` HMAC so links are stable and don't require a DB row.

**Approach:** Mirror the existing cron contract from `src/lib/biodiversity/refresh.ts`. Keep the per-user compute synchronous and small.

**Acceptance:**
- Manual `curl` with the bearer token sends digests to all opted-in users.
- The unsubscribe link works in one click without sign-in.
- Cron registers in vercel.json and runs on schedule.

**Testing:**
- Manual: opt in, fire cron, receive email, click unsubscribe, verify `digestOptIn = false`.

**Risk:** Low-medium. Email volume could exceed Resend's free tier once user count grows; flag for budget conversation.

**Deps:** S3-01, S3-03, S3-06.

---

### S3-17 — Streak-nudge cron (`/api/cron/streak-nudge`) — daily 09:00 UTC

**Priority:** P2
**Effort:** S (2-3h)
**Audit refs:** F15
**Files:**
- `src/app/api/cron/streak-nudge/route.ts`
- `vercel.json`
- `src/lib/email/templates/StreakNudgeEmail.tsx`

**Current:** No nudge. Streak is the primary retention loop per the audit, but silently resets after a missed day.

**Target:**
- Cron at `0 9 * * *` (daily 09:00 UTC).
- For each user with `digestOptIn = true` AND `emailVerified IS NOT NULL` AND a streak ≥ 3 days AND no answer in the last 20 hours:
  - Send a one-line email: "Your {streak}-day streak is in danger — log a sighting today to keep it alive."
  - Cap: one streak-nudge per user per week (track in a `User.lastStreakNudgeAt` column? **Add this to S3-01 if cheap.** Otherwise compute from a small denormalised cache. For Sprint 3 simplicity, add the column.)
- Same unsubscribe shape as S3-16.

**Approach:** Same cron contract pattern. The "20 hours since last answer" window is judgemental — verify with Christian before merging that 09:00 UTC is the right local hour for a UK / Ireland audience (it is 09:00 UK in winter, 10:00 in summer; consider 17:00 UTC if the goal is evening engagement).

**Acceptance:**
- Cron fires daily.
- Eligible users receive at most one nudge per week.
- Unsubscribe works.

**Testing:** Manual cron trigger + DB inspection.

**Risk:** Low. Highest risk is email fatigue — the cap is the key control.

**Deps:** S3-01 (add `lastStreakNudgeAt` column — fold into S3-01 if not already there), S3-03, S3-16 (unsubscribe handler).

---

### S3-18 — Playwright e2e suite for the Sprint 3 surface

**Priority:** P0 (validates the sprint)
**Effort:** L (6-8h)
**Audit refs:** Section 06 testing plan in full
**Files:**
- `e2e/onboarding/signup-verify-onboarding.spec.ts`
- `e2e/onboarding/forgot-password.spec.ts`
- `e2e/onboarding/account-delete.spec.ts`
- `e2e/onboarding/signout-toast.spec.ts`
- `e2e/onboarding/cookie-banner.spec.ts`
- `playwright.config.ts` (if not already set up by Sprint 1 — coordinate)

**Current:** Audit section 06 lists 6 suggested specs; none exist.

**Target:** Implement the named specs, all running against a preview deploy in CI:

1. **`signup-verify-onboarding.spec`** — sign up; intercept the verification email via Resend's test mode or a Mailpit local container; click the token URL; assert `User.emailVerified` set; first-`/feed` visit shows tour; dismiss tour; reload, tour does not reappear.
2. **`forgot-password.spec`** — request reset; consume token; sign in with new password.
3. **`account-delete.spec`** — sign in; visit `/account`; type-confirm delete; assert redirect to `/?deleted=1`; assert Answer rows cascaded.
4. **`signout-toast.spec`** — sign in; click avatar; confirm sign out; assert toast on landing.
5. **`cookie-banner.spec`** — incognito visit; banner visible; dismiss; reload; banner not visible.

Email assertion strategy: spin up Mailpit (`docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit`) for CI; point Resend's `Resend` client at it via a custom URL override in test mode, OR use Resend's actual sandbox with a dedicated test domain. Confirm the chosen approach with Christian — Mailpit is simpler.

**Approach:** Build on whatever Playwright scaffolding Sprint 1 lands; if Sprint 1 has not run yet, this ticket installs Playwright and the axe-core / visual-regression baselines.

**Acceptance:**
- All five specs green in CI on a preview deploy.
- Specs run in < 5 min combined.

**Testing:** Self-validating.

**Risk:** Medium. The email-intercept piece is fiddly; expect 2-3h on Mailpit / Resend test mode alone.

**Deps:** S3-01 through S3-15.

---

*Ticket count: 18. Sprint scope is appropriate; if the team has < 1.5 engineers, defer S3-16 + S3-17 + S3-18 to a Sprint 3.5 polish window. The compliance-critical block (S3-01 → S3-12 inclusive) must ship before any public-launch comms.*
