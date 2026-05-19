# Sprint 6 — Captions, Re-engagement & Advanced

> **Status flag.** Sprint 6 is the v2 surface. It bundles features that drive
> retention (digests, profiles, journals, notifications), close out remaining
> WCAG / anti-cheat questions, and extend the platform (OAuth, i18n, admin,
> GDPR export, analytics). Several tickets are **blocked on product
> decisions** made during Sprints 1-3; effort estimates assume the decision
> lands a specific way and are flagged per ticket.

## Goal

With foundations (Sprint 1), quiz alignment (Sprint 2), compliance + auth
(Sprint 3), performance (Sprint 4) and navigation + a11y (Sprint 5) in place,
Sprint 6 makes FishSpotter a product worth **returning to**: re-engagement
emails and notifications; a personal surface (profile, sightings journal,
data export); a social surface (share, optional follow); trust signals on
the leaderboard (anti-cheat + rate-limit); and the platform extensions
required to operate at PEBL scale (OAuth, i18n scaffold, admin, captions
policy, analytics).

## Definition of done

- WCAG 1.2.2 caption posture is **documented and shipped**: either silent-media
  exemption note (live in `/accessibility` conformance page) or a
  `<track kind="descriptions">` per snippet, plus a captions production
  pipeline (Whisper-based) if captions are chosen.
- Email digest opt-in is live, gated on Sprint 3 email infra; users can opt
  out via `/account` and via one-click unsubscribe link in the email itself.
- `/u/[id]` profile route renders for any user with at least one answer:
  display name, accuracy, streak history, species-list-seen, last 10 answers.
  Linked from leaderboard rows (closes §05 F-LB-10).
- Share-this-clip button on each FeedCard and `/feed/[id]` page uses Web
  Share API with `og:image` fallback URL preview.
- Leaderboard renders an anti-cheat badge next to any row whose recent
  answers trip the heuristic (<2s/answer or score-spike >3σ).
  Server-side `POST /api/answers` enforces a per-user rate limit backing
  the heuristic (closes §05 F-LB-12).
- Web Push notifications opt-in via `/account` for: new clips added,
  streak-about-to-break, overtaken-on-leaderboard. In-app fallback
  notification centre for users who decline push.
- Personal "Your sightings" journal at `/u/me/sightings` surfaces the
  iNat photo cache per species the user has correctly identified (closes the
  graduate-from-§03 F8 win — gallery is now also a personal trophy case).
- PWA install prompt appears once per device after 3 returning visits,
  dismissible permanently. SW scope verified safe after Sprint 4's audit.
- `next-intl` (or equivalent) wired into `[locale]` route segment; English
  catalogue extracted; Welsh + French stubs present (untranslated). All
  user-facing strings flow through `t()`.
- Admin route `/admin/snippets` (gated to `User.role = 'staff'`) for snippet
  upload, staff-answer editing, bbox JSON upload, and answer moderation.
  Replaces CLI-only `scripts/seed.ts` flow for net-new snippets.
- Google + Apple OAuth providers live; `Account` table from Sprint 3
  populated for OAuth identities; existing email users can link providers
  from `/account`.
- GDPR data export: `GET /api/account/export` returns a ZIP of user JSON
  (user row, answers, profile-photo URLs). Linked from `/account`.
- Unified search at `/feed/browse` filters across site, depth band, species,
  date range (extends Sprint 4 filtering). Powered by Postgres FTS or
  client-side filtering of the cached list.
- Plausible (or equivalent GDPR-friendly) analytics wired; cookie-less,
  surfaced in the Sprint 3 privacy notice.
- Web Vitals dashboard p75 LCP/INP/CLS reviewed; any items deferred from
  Sprint 4 (virtualisation threshold review, SW aggressiveness) acted on.

## Product decisions required before sprint can plan firmly

These five decisions should land **before Sprint 6 planning** but no later
than Sprint 6 day 1; several tickets are blocked on each.

1. **Captions vs silent-media exemption (§07 A11Y-08).** Either:
   (a) document silent-media exemption in `/accessibility` conformance
   statement (low effort), or (b) generate VTT captions for each snippet
   via Whisper + behavioural description (medium effort, plus ongoing
   tooling). Default assumption used for estimates below: **(a)** with an
   on-card "Clip description" `<details>` for scene context. T-23 covers
   the tooling option if (b) is chosen.
2. **Notification surface (web push vs in-app only).** Apple's PWA push
   support shipped iOS 16.4 but is fiddly. Assumed default: **both**,
   with in-app as primary and web push as enhancement. T-16 reflects this.
3. **Follow-other-users (social graph yes/no).** Adds moderation surface
   and DM pressure. Assumed default: **no** for v2. T-11 ships share-only;
   `Follow` table is *not* added.
4. **i18n launch languages (English-only at launch, scaffold for which
   second?).** Assumed default: **scaffold English + Welsh + French**, ship
   English only. PEBL Ocean's bilingual remit makes Welsh + French the
   natural targets.
5. **Admin scope (staff-only vs partner-org multi-tenant).** Assumed
   default: **flat staff role** via `User.role = 'staff'`. Multi-tenant
   org-scoped admin is out of scope.

## Audit findings addressed

| Finding | File | Severity | Sprint 6 ticket |
|---|---|---|---|
| A11Y-08 | §07 | High | T-1 (caption decision), T-23 (Whisper tooling, conditional) |
| F-LB-10 | §05 | P1 | T-3 (profile route) |
| F-LB-12 | §05 | P2 | T-5 (anti-cheat signal), T-6 (server-side rate-limit) |
| F-LB-04 | §05 | P1 | T-3 (self-row link to profile) |
| Finding 3 (OAuth) | §06 | Med | T-13 |
| Finding 15 (email digests) | §06 | Med | T-2 |
| Finding 8 (GDPR delete/export) | §06 | High | T-14 |
| Finding 6 (onboarding gap) | §06 | Med | partial — covered in Sprint 3; T-9 closes the journal/trophy gap |
| Cross-page §05 F-X-01 (session-aware) | §05 | P1 | T-3, T-9 |
| Theme F (CIC compliance) | §00 README | n/a | T-2, T-14, T-15 |
| Theme B / PERF-05 (SW aggressiveness follow-up) | §07 | Low | T-22 |
| §02 share affordance | §04 | n/a | T-4 |

Sprint 6 is the **closing sprint** for the §07 caption question, the §05
anti-cheat question, the §06 OAuth + digest gaps, and the GDPR
right-to-portability gap.

## Dependency graph

```
T-0 (product decisions) ─┬─> T-1 captions posture (decision 1)
                         ├─> T-13 OAuth (decision 5)
                         ├─> T-16 notifications (decision 2)
                         ├─> T-11 share (decision 3)
                         ├─> T-15 i18n scaffold (decision 4)
                         └─> T-17 admin route (decision 5)

T-3 profile route ──┬──> T-9 sightings journal
                    └──> T-5 anti-cheat (renders the badge)

T-6 server-side rate-limit ──> T-5 anti-cheat heuristic

T-2 email digest depends on Sprint 3 Resend infra; T-14 GDPR export uses
the same provider for the "your data is ready" link.

T-16 push notifications depends on Sprint 4 SW review (T-22).

T-15 i18n scaffold blocks every user-facing string; ship early in sprint.
```

## Dependencies on Sprints 1-5

- **Sprint 1** — design tokens, error boundaries, axe-core CI. Profile
  page (T-3), admin (T-17), sightings journal (T-9) all rely on the
  tokenised component library.
- **Sprint 2** — quiz-flow alignment (multiple choice or free text fixed).
  Affects `Answer.chosenOption` semantics used by leaderboard + anti-cheat
  (T-5) + sightings journal (T-9).
- **Sprint 3** — `Account`, `VerificationToken`, `emailVerified` columns,
  Resend wired, password reset live. T-2 (digests), T-13 (OAuth), T-14
  (export), T-16 (push) all directly depend.
- **Sprint 4** — `revalidate` ISR on `/feed/browse`, `/leaderboard`. T-11
  share, T-19 search, T-22 SW polish hang off this.
- **Sprint 5** — persistent nav, deep-link parity, focus trap on
  `SideMenu`, real `<label>` on species input, `aria-live` for quiz.
  T-3 profile route and T-9 journal both consume the persistent nav.

---

## Tickets

### T-1 — WCAG 1.2.2 caption posture: ship the chosen path

- **Severity:** High (§07 A11Y-08 closes the open question; product decision 1)
- **Blocked on:** product decision 1 (silent-exemption vs VTT)
- **Files:**
  - **(a) Exemption path)** `src/app/accessibility/page.tsx` (new),
    `src/components/FeedCard.tsx:540-575` (add `<details>` clip-description expander
    sourced from `staffAnswer + site + deployment`), `src/app/layout.tsx:14`
    (link in footer), `CLAUDE.md` (conformance note).
  - **(b) VTT path)** `prisma/schema.prisma` (add `Snippet.captionsVttUrl`),
    `src/components/FeedCard.tsx:540-575` (add `<track kind="captions" srclang="en" default>`),
    `scripts/generate-captions.ts` (new — see T-23), Supabase Storage
    bucket `captions` (new).
- **Definition of done:**
  - Path (a): `/accessibility` page live, footer link from every layout,
    every FeedCard renders a collapsed "Clip description" `<details>`,
    SR users get a scene description on demand. CLAUDE.md gains a "WCAG
    1.2.2 — silent media exemption" subsection.
  - Path (b): `Snippet.captionsVttUrl` column on every row (back-fill
    via T-23), `<track>` element present and validates against an
    automated `pa11y` rule, "CC" indicator visible on FeedCard.
- **Effort:** (a) **0.5d** writer + 0.5d eng. (b) **2d** eng + T-23 tooling (3d).
- **Notes:** Estimates below assume **path (a)**. Path (b) shifts T-23
  into-scope and adds ~3d.

### T-2 — Weekly digest email + streak-break nudge

- **Severity:** Medium (§06 Finding 15)
- **Blocked on:** Sprint 3 Resend wired + `User.emailVerified`
- **Files:**
  - `src/lib/email/templates/weekly-digest.tsx` (React Email)
  - `src/lib/email/templates/streak-break.tsx`
  - `src/app/api/cron/weekly-digest/route.ts` (Vercel cron, Sun 09:00 UTC)
  - `src/app/api/cron/streak-nudge/route.ts` (daily 18:00 UTC)
  - `vercel.json` (register two crons under `CRON_SECRET`)
  - `prisma/schema.prisma` — add `User.emailPrefs Json @default("{}")`
    (keys: `weeklyDigest: boolean`, `streakNudge: boolean`, both
    opt-in default `false`)
  - `src/app/account/notifications/page.tsx` (UI toggle)
  - `src/app/api/email/unsubscribe/route.ts` (signed-token one-click)
- **Definition of done:**
  - Two crons live; both 401 without `CRON_SECRET`.
  - Digest body: streak status, top 3 species you got right this week,
    leaderboard rank delta, 1-2 new clips added.
  - Streak-break: fires when last answer was 23-25h ago and streak ≥3.
    Self-throttled to once per streak (don't spam users who genuinely
    quit). One-click unsubscribe token signed with `NEXTAUTH_SECRET`.
  - Opt-in only — emails do not fire until user enables in `/account`.
- **Effort:** **3d** (template design 1d + cron + signed unsubscribe + UI 2d)

### T-3 — Profile route `/u/[id]`

- **Severity:** Medium (§05 F-LB-10, closes social hook)
- **Files:**
  - `src/app/u/[id]/page.tsx` (server component, `revalidate = 60`)
  - `src/app/u/[id]/loading.tsx`, `not-found.tsx`
  - `src/app/u/me/page.tsx` → redirect to current user's id
  - `src/components/profile/AccuracyChart.tsx` (small recharts inline)
  - `src/components/profile/SpeciesSeenStrip.tsx` (uses `SpeciesImage` cache)
  - `src/app/leaderboard/page.tsx:79-89` — wrap display name in `<Link>`
- **Definition of done:**
  - Renders for any user with `appearOnLeaderboard != false` (per
    Sprint 5's privacy toggle). 404s for users who opted out.
  - Displays: display name, joined date, accuracy %, current streak,
    species-seen count, last 10 answers (clip thumb + outcome).
  - Empty state for a profile with 0 answers ("This spotter hasn't
    submitted yet.").
  - Linked from every leaderboard row.
- **Effort:** **2d**

### T-4 — Share-this-clip (Web Share API + og:image)

- **Severity:** Low-Medium
- **Files:**
  - `src/components/feed/ShareButton.tsx` (new)
  - `src/components/FeedCard.tsx` — mount in panel
  - `src/app/feed/[id]/opengraph-image.tsx` (Next 14 dynamic OG)
- **Definition of done:**
  - Share button visible in FeedCard panel + on `/feed/[id]`.
  - Click invokes `navigator.share()` when available, else copies
    canonical URL to clipboard and toasts "Link copied".
  - Open Graph image: 1200x630, PEBL-branded, shows clip thumbnail +
    site + deployment + "FishSpotter". Twitter card variant set.
  - Spoiler-safe: OG image does **not** include staff answer.
- **Effort:** **1.5d**

### T-5 — Leaderboard anti-cheat signal

- **Severity:** P2 (§05 F-LB-12)
- **Blocked on:** T-6 (rate-limit metadata needed)
- **Files:**
  - `src/app/leaderboard/page.tsx:79-89` — render a flag icon next to flagged rows
  - `src/lib/leaderboard/anti-cheat.ts` (heuristic computation)
  - `prisma/schema.prisma` — add `Answer.responseMs Int?` (time from clip
    play to submit, captured client-side and trusted as a hint not a proof)
  - `src/lib/useCreatureQuiz.ts` — record `responseMs`
- **Definition of done:**
  - Heuristic: a user is flagged if EITHER (a) ≥30% of their answers
    in the last 7 days have `responseMs < 2000`, OR (b) their daily
    answer rate exceeds 3σ above the cohort median for ≥2 days.
  - Flagged rows render a small badge with tooltip "Activity under
    review" (deliberately vague — moderation copy).
  - `/admin/leaderboard-flags` lists flagged users for staff review.
  - Heuristic is documented on the leaderboard page in a "How scoring
    works" expandable.
- **Effort:** **2d**

### T-6 — Server-side answer rate-limit

- **Severity:** Medium (backs T-5 + §05 F-LB-12)
- **Files:**
  - `src/app/api/answers/route.ts` — call `rateLimit({ key: 'answer:${userId}', limit: 60, windowMs: 60_000 })`
  - `src/lib/rate-limit.ts` — extend with per-user keys
  - Reject with 429 + retry-after header. Front-end shows
    "Slow down — try again in N seconds".
- **Definition of done:**
  - 60 answers/minute hard cap per user.
  - 401 still returned for unauthenticated requests (Sprint 1 fix).
  - Logged to `Answer.responseMs = null` so anti-cheat doesn't see
    rate-limited attempts as legitimate.
  - Unit test in `tests/unit/rate-limit.test.ts` covers the per-user key.
- **Effort:** **0.5d**

### T-7 — Notifications: in-app inbox

- **Severity:** Medium
- **Blocked on:** product decision 2
- **Files:**
  - `prisma/schema.prisma` — `Notification { id, userId, type, payload Json, readAt, createdAt }`
  - `src/app/api/notifications/route.ts` — list + mark-read
  - `src/components/notifications/NotificationBell.tsx` (header right slot)
  - `src/lib/notifications/emit.ts` — server-side emitter called from
    answer route, snippet-upload route, leaderboard recompute
- **Definition of done:**
  - Bell icon in header, badge with unread count.
  - Drawer lists last 20 notifications. Click → relevant route
    (e.g. "You're now rank 12 — view leaderboard").
  - Types: `STREAK_RISK`, `OVERTAKEN`, `NEW_SNIPPET`,
    `ANSWER_REVIEWED`, `PROFILE_VIEWED` (last only if T-3 ships analytics).
- **Effort:** **2.5d**

### T-8 — Notifications: Web Push (enhancement)

- **Severity:** Low (enhancement on T-7)
- **Blocked on:** T-7, product decision 2, Sprint 4 SW review (T-22)
- **Files:**
  - `public/sw.js` — add `push` + `notificationclick` handlers
  - `src/lib/push/subscribe.ts` — VAPID subscribe flow
  - `prisma/schema.prisma` — `PushSubscription { endpoint, p256dh, auth, userId }`
  - `src/app/account/notifications/page.tsx` — enable-push toggle
- **Definition of done:**
  - Enable-push toggle prompts browser permission.
  - Subscriptions stored; emitter from T-7 also calls `webpush.sendNotification`
    when a subscription exists and the type is opt-in.
  - Permission-denied state shows a polite explanation. Safari PWA
    (iOS 16.4+) supported.
- **Effort:** **2d**

### T-9 — Sightings journal `/u/me/sightings`

- **Severity:** Medium
- **Blocked on:** T-3 (uses profile-route plumbing), Sprint 2 (`isCorrect` semantics)
- **Files:**
  - `src/app/u/me/sightings/page.tsx`
  - `src/components/sightings/SpeciesTile.tsx` — uses `SpeciesImage` cache
- **Definition of done:**
  - Lists every species the user has answered correctly at least once.
  - Each tile shows iNat photo (from `SpeciesImage`), common name,
    first-spotted date, count, link to a "your clips of this species" list.
  - Empty state nudges to `/feed`.
- **Effort:** **1.5d**

### T-10 — PWA install prompt polish

- **Severity:** Low
- **Blocked on:** Sprint 4 SW review (T-22)
- **Files:**
  - `src/components/pwa/InstallPrompt.tsx`
  - `public/manifest.webmanifest` (verify)
- **Definition of done:**
  - `beforeinstallprompt` captured; banner appears once per device
    after 3 returning visits (tracked via localStorage). Dismissible
    permanently.
  - iOS Safari path: "Add to Home Screen" instruction sheet when
    `navigator.standalone === false` and UA matches.
- **Effort:** **1d**

### T-11 — Share-only social (no follow)

- **Severity:** Low
- **Blocked on:** product decision 3
- **Notes:** Covered by T-4. **No** `Follow` table, no follow button.
  Documented explicitly so a future ticket can revisit.
- **Effort:** 0d (documentation only; flagged in `CLAUDE.md`)

### T-12 — i18n scaffold

- **Severity:** Medium
- **Blocked on:** product decision 4
- **Files:**
  - `npm i next-intl`
  - `src/middleware.ts` — locale detection
  - `src/app/[locale]/...` — restructure under locale segment
  - `src/i18n/en.json`, `cy.json` (Welsh stub), `fr.json` (French stub)
  - Codemod all user-facing strings to `t('key')`
- **Definition of done:**
  - `/en/feed`, `/cy/feed`, `/fr/feed` all resolve.
  - English ships fully translated; Welsh and French ship the
    catalogue keys with English fallback values.
  - Locale switch lives in the side menu footer.
  - Date formatting uses `Intl.DateTimeFormat(locale)`.
- **Effort:** **3d** (codemod is the bulk)

### T-13 — Google + Apple OAuth

- **Severity:** Medium (§06 Finding 3)
- **Blocked on:** Sprint 3 `Account` table + `emailVerified`
- **Files:**
  - `src/lib/auth.ts` — add `GoogleProvider`, `AppleProvider`
  - `.env.local.example` — document required env vars
  - `src/app/auth/signin/page.tsx:118-124` — add provider buttons
  - `src/app/account/page.tsx` — list linked providers; allow link/unlink
- **Definition of done:**
  - Sign in with Google works end-to-end on web + iOS PWA.
  - Apple sign in works on iOS Safari + macOS Safari (Apple
    developer account + Service ID required — flag as prerequisite).
  - First-time OAuth user is auto-`emailVerified` (provider asserts).
  - Existing email user signing in with same-email OAuth is **linked**,
    not duplicated.
- **Effort:** **2d** (after Apple developer cert is in hand)

### T-14 — GDPR data export

- **Severity:** High (§06 Finding 8 — completes the right-to-portability gap)
- **Blocked on:** Sprint 3 `/account` + Resend
- **Files:**
  - `src/app/api/account/export/route.ts` — generates a ZIP buffer
    with `user.json`, `answers.json`, `notifications.json`, `email-prefs.json`
  - `src/app/account/data/page.tsx` — "Export my data" + "Delete my account"
    buttons
  - Resend email "Your data is ready" link (signed, 24h expiry)
- **Definition of done:**
  - "Export my data" generates a ZIP and emails a signed download link
    (avoids holding the file in browser memory for large users).
  - "Delete my account" still works (built in Sprint 3); export is
    offered as a final step in the delete confirmation flow.
  - Coverage: every model that joins on `userId` is included
    (User, Answer, Notification, PushSubscription, emailPrefs).
- **Effort:** **1.5d**

### T-15 — Unified search across snippet metadata

- **Severity:** Medium (extends Sprint 4 filtering)
- **Blocked on:** Sprint 4 filter chips on `/feed/browse`
- **Files:**
  - `src/app/feed/browse/page.tsx` — accept `?q=...&site=...&depth=...&species=...&from=...&to=...`
  - `src/lib/search/snippets.ts` — Postgres `to_tsvector` query over
    `site || ' ' || deployment || ' ' || staffAnswer`
  - `src/components/browse/SearchBar.tsx`
- **Definition of done:**
  - Free-text search box at top of `/feed/browse`.
  - All filters are URL-driven; back/forward navigates correctly.
  - Postgres GIN index added on the tsvector expression.
  - Empty-result state distinct from empty-archive state.
- **Effort:** **2d**

### T-16 — Plausible (or similar) analytics

- **Severity:** Low
- **Files:**
  - `src/components/analytics/Plausible.tsx` (script tag, conditional on env)
  - `src/app/privacy/page.tsx` — disclose
  - `next.config.mjs` — CSP allow
- **Definition of done:**
  - Plausible script loaded in production only.
  - Cookie-less — no consent banner change needed.
  - Custom events: `quiz_submit`, `quiz_correct`, `share_click`,
    `digest_open` (tracked via UTM in the email link).
- **Effort:** **0.5d**

### T-17 — Admin / staff route `/admin/snippets`

- **Severity:** Medium (§00 Theme — replaces CLI-only flow)
- **Blocked on:** product decision 5
- **Files:**
  - `prisma/schema.prisma` — `User.role String @default("user")`
  - `src/middleware.ts` — gate `/admin/**` to `role === 'staff'`
  - `src/app/admin/snippets/page.tsx` — list + upload form
  - `src/app/admin/snippets/[id]/page.tsx` — edit staff answer, bbox JSON
  - `src/app/admin/leaderboard-flags/page.tsx` — anti-cheat review (T-5)
  - `src/app/api/admin/snippets/route.ts` — handles upload to Supabase
    Storage + `Snippet` row insert; reuses logic from `scripts/seed.ts`
- **Definition of done:**
  - Staff user can upload a new MP4 + thumbnail + metadata + bbox JSON
    via the web UI. H.264 codec check runs server-side via `ffprobe`
    (CLAUDE.md invariant).
  - Staff user can edit staff answer of an existing snippet.
  - Staff user can soft-delete a snippet (hides from feed but keeps
    answers for leaderboard integrity).
  - Non-staff users get 404 (not 403 — don't advertise the route).
- **Effort:** **3d**

### T-18 — Performance follow-ups from Sprint 4

- **Severity:** Low-Medium
- **Blocked on:** Sprint 4 ship + web-vitals data
- **Files:**
  - `public/sw.js` — adopt stale-while-revalidate for `/_next/static/*`
    (deferred from Sprint 4 per §07 PERF-05)
  - `src/components/FeedPlayer.tsx` — virtualise once catalogue > 50
    (deferred from Sprint 4 per §02)
  - `src/app/api/vitals/route.ts` (new) — accept web-vitals beacons
    started in Sprint 4
- **Definition of done:**
  - SW caches hashed Next assets stale-while-revalidate;
    `/offline` HTML page replaces "Offline" string.
  - FeedPlayer virtualises (e.g. `react-virtuoso`) past a 50-card
    threshold.
  - p75 LCP, INP, CLS reviewed and any regression > 10% fixed.
- **Effort:** **2d**

### T-19 — (Conditional, ships only if T-1 path (b) chosen) Captions production pipeline

- **Severity:** Medium (conditional)
- **Blocked on:** T-1 path (b)
- **Files:**
  - `scripts/generate-captions.ts` — Whisper API call, outputs VTT
  - `scripts/upload-captions.ts` — uploads to Supabase `captions` bucket,
    updates `Snippet.captionsVttUrl`
  - `src/app/api/admin/snippets/[id]/captions/route.ts` — admin re-run
- **Definition of done:**
  - One CLI invocation captions all 30 existing snippets in
    "behavioural description" mode (Whisper output edited for
    underwater context — script appends scene metadata from staff
    answer + site).
  - Per-snippet regeneration available from the admin route (T-17).
  - VTT files validate against W3C VTT validator.
- **Effort:** **3d** (only if T-1 (b) chosen)

---

## Path + ticket count

- **Path:** `implementation/2026-05-18/sprint-6-advanced.md`
- **Ticket count:** **19 tickets** (T-1 through T-19; T-11 is a 0d
  decision-record ticket flagged for transparency).
- **Effort range (assuming T-1 path (a), no T-19):** ~26 dev-days +
  0.5d writer; 1 sprint of two engineers at ~13d each, or 3 weeks
  solo, plus the Apple-developer-cert lead time on T-13.
- **Effort with T-1 path (b) + T-19:** +3d eng (~29d total).
