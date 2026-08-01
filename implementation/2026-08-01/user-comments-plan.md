# Public clip comments + PEBL feedback inbox — implementation plan

Date: 2026-08-01
Owner: Christian (direction) + Claude (build)
Status: **BUILD COMPLETE, validated against production data, NOT committed and
NOT deployed.** Phases 1-4 built. Outstanding before launch: the OSA risk
assessments (T4.3, Christian's), a slur list for the blocklist, and a visual
sign-off pass.
Execution target: Claude Code, Opus 5, max reasoning effort.

## Build log

| Task | State | Notes |
|---|---|---|
| T0.1 worktree + baseline | DONE | `../FishSpotter-comments` on `feat/clip-comments`. |
| T1.1 pure lib + tests | DONE | `src/lib/comments.ts` + 50 tests. Both guard tests mutation-verified. |
| T1.2 schema + RLS | DONE | Tables live in production. RLS proven end-to-end. |
| T1.3 rate limiters | DONE | Comment limiter + per-admin email throttle. |
| T1.4 POST /api/comments | DONE | Validated live against prod (see below). |
| T1.5 GET (gated) | DONE | INV-1 verified live, signed-out and signed-in. |
| T1.6 composer + thread | DONE | `CommentBox` + `CommentThread`, 5 component tests. |
| T1.7 feed mount | DONE | Above the sticky advance row so Next stays reachable. |
| T1.8 e2e gate tests | DONE | 6 cases added to `tests/e2e/security.spec.ts`. |
| T1.9 admin inbox | DONE | Triage + moderation, canned replies, unread badge. |
| T2.x moderation | DONE | Report route, auto-hide, held queue, hide/unhide/delete. |
| T3.x instant email | DONE | Template, dispatcher, throttle, wired into both routes. |
| T4.1/T4.2 legal copy | DONE | Terms "Comments and discussion"; Privacy collection + retention rows. |
| T4.3 risk assessments | **OUTSTANDING** | Christian's. Blocks public launch. |

Final gate: `tsc` 0, **527 tests pass** (56 files), `lint` clean, `lint:tokens`
clean, `next build` succeeds, `db:enable-rls --check` exits 0.

## Live validation against production (2026-08-01)

Run against the real database via a temporary throwaway account, since the unit
tests cannot prove the wiring. **All validation data was removed afterwards**
(verified: 0 comments, 0 reports, 0 test users remaining).

Signed out:

| Check | Result |
|---|---|
| `GET /api/comments?snippetId=…` | `{"gated":true}` exactly. No `comments` key, no `total` key. |
| `GET /api/comments` (no param) | 400, not a full-table read |
| `POST /api/comments` | 401 |
| Payload scanned for `adminNote` / `emailVerified` | absent |

Signed in, on a clip the spotter HAD answered:

| Check | Result |
|---|---|
| Thread unlocked | `gated: false` |
| Same user, clip they had NOT answered | still `gated: true` (gate is per clip) |
| Normal comment | 201, reason preserved |
| Comment containing a link | 400 rejected |
| Empty / whitespace body | 400 rejected |
| Posting on an unanswered clip | 403 `must-answer-first` |
| Profanity | 201 but `isHidden: true`, `held: true` (held, not lost) |
| **"a bass, not a cockle bed"** | **201, NOT held** — the Scunthorpe guard working on real input |
| 4th top-level comment | 429 `clip-limit-reached` |
| Self-report | 400 |
| `reportCount` for a non-admin | `null` (INV-2 in a real payload) |

### BUG FOUND AND FIXED during live validation

The per-clip cap was also blocking **replies**. A spotter who had left three
comments on a clip could never answer anyone on that clip again, which reads as
a broken thread rather than a limit. The count was correct (top-level only) but
the gate was applied to replies as well.

Fixed by adding `isReply` to `canPost` and resolving the parent BEFORE the
eligibility check in the route. Two regression tests added. Re-verified live:
reply at cap 201, reply-to-reply flattens to the top-level ancestor, new
top-level still 429.

This is exactly the class of defect unit tests do not catch, and the reason the
live pass was worth doing.

## Visual review (Gemini 3.5 Flash, 2026-08-01)

Done with the house loop (`src/lib/ui-critique.ts`) via a temporary Playwright
harness, because the stock `scripts/ui-review.ts` shoots an anonymous route and
the thread only renders for a signed-in spotter who has answered that clip
in-session. Screenshots in `implementation/2026-08-01/shots/`, raw grades in
`shots/critique.json`.

Two things had to be solved before anything could be captured:
1. The seeded accounts had `onboardedAt` null, so the **first-run OnboardingTour
   overlaid the whole feed** and the first pass graded the tour, not the feature.
2. The 4-rung ID flow had to be driven deepest-stage-first; a shallow-first
   click list re-hits "Identify" (still in the DOM behind the open gate) and
   toggles the gate shut forever.

All four surfaces ended at `matchesIntent: true`.

| Surface | Score | Note |
|---|---|---|
| Reveal with collapsed thread | 78 | "successfully positions the collapsed comments row subordinate to the prominent Next button" — the design goal, confirmed |
| Thread expanded | 68 (readability 3 -> 75) | after the contrast + layout fixes below |
| Admin inbox | 72 (from 68) | |
| Shape gate (pre-existing) | 68 | not this feature's code |

### Fixed as a result

- **Composer reason chips wrapped to four rows**, pushing the textarea and Post
  button off a 390px screen. Now one horizontally-scrolling row.
- **Admin action buttons were 36px** (`h-9`), against the repo's explicit 44px
  rule. All raised to `min-h-[44px]`. This was a genuine invariant breach.
- **Reply / Report hit areas** raised 32px -> 44px.
- **Low-contrast text**: comment body, timestamps, Report, and the composer
  placeholder all lifted (thread readability 3 -> 75).
- **Admin "NEW" chip** moved off the `pending` amber token to teal: `pending` is
  right on the dark reveal, but on the light admin surface amber reads as a
  warning about the comment rather than a triage state.
- **Clip ids** (~55 chars) wrapped over three lines in the inbox; now truncated
  with a `title`.
- Admin reason-filter row scrolls instead of wrapping.

### Rejected findings (recorded so they are not re-raised)

- **"Off-palette yellow CONTESTED / pending badge."** That is `bg-pending`, a
  *named house token* (amber-300) added deliberately so semantic states cannot
  drift. Gemini judges against the teal/navy brand palette and cannot know the
  token exists. Keeping the token.
- **"Emoji in the Day 1 streak pill."** It is an inline stroked SVG flame in
  `RevealResult`, not an emoji. False positive, and pre-existing code.
- **Cramped 3x3 shape grid, "USE ARROWS OR SCROLL" pill, low-contrast
  "WHERE IS THIS?" / "EDIT ANSWER"** — all pre-existing feed UI, out of scope.

### Known issue, NOT fixed (pre-existing, flagged for Christian)

Gemini repeatedly flagged, at HIGH severity, that **the FishSpotter header
overlaps the scrolled reveal content** ("logo colliding with COMMUNITY ANSWERS /
SPOTTERS"). This is pre-existing: the feed header is a transparent overlay
(`pointer-events-none absolute inset-x-0 top-0` in `Header.tsx`) and the reveal
panel scrolls underneath it. It is visible on the reveal *without* the thread.

This feature does not cause it, but it does make it more noticeable, because a
thread gives people a reason to scroll further inside the reveal. Fixing it means
changing the global feed header, which is well outside this branch. Worth its own
ticket.

### Mutation testing (T1.1)

The 48 tests passed first try, so both invariant guards were deliberately broken
to confirm the tests actually bite. Both correctly failed the suite:

- Spreading the raw Prisma row into `toPublicComment`'s output (the classic INV-2
  leak) -> suite fails.
- Switching `hitsBlocklist` to substring matching -> suite fails on the
  Scunthorpe cases.

### INV-3 proof (T1.2)

`scripts/verify-comment-rls.ts` is the end-to-end check, and it exists because an
empty table returns `[]` from PostgREST whether RLS works or not. It inserts a
canary row via Prisma (owner role, bypasses RLS), confirms Prisma sees it, then
confirms the **public anon key** gets `[]` for both new tables, then deletes the
canary. Verified passing against production.

### DEVIATION FROM PLAN: pre-existing production schema drift

`prisma db push` initially refused, because it wanted to **drop `Event.label`**, a
column holding live production data.

Root cause: `Event.label` (the CTA-click field from the engagement-flywheel work)
exists in production and in the primary checkout's **uncommitted**
`prisma/schema.prisma`, but was never committed to `main`. It reached production
via a `db push` from that uncommitted schema. This branch forked from committed
`main`, so its schema did not know the column existed.

Resolution (approved by Christian, 2026-08-01): the column declaration was carried
forward into this branch's schema so `db push` leaves it alone. `prisma migrate
diff` was used to confirm the resulting change set was **purely additive** (2
CreateTable, 6 CreateIndex, 5 AddForeignKey, zero DROP, zero statements touching
any existing table) before pushing. `--accept-data-loss` was NOT used.

Only the schema declaration was carried over. The app code that populates the
column (`cta_click` in `EVENT_TYPES`, `CTA_LABELS` in `src/lib/events.ts`) remains
uncommitted in the primary checkout and is **not** on this branch. Expect a
trivial `schema.prisma` conflict when that work lands.

**Follow-up for Christian:** the flywheel schema change should be committed to
`main`, otherwise the next person to branch from `main` and run `db push` hits the
same trap, and the next one may not read the warning.

---

## 0. What this is, in one paragraph

Spotters can leave a comment on a clip after they submit their guess: the
species they saw is not in the list, the clip is too blurry to call, that fish
looks like a juvenile, they would call it something else, or anything else they
want to say about it. Comments form a **public thread on each clip**, readable
only by spotters who have already made their own call. Every new comment fires
an **instant email** to PEBL staff (`@pebl-cic.co.uk`), and lands in a
moderation and triage inbox at `/admin/comments` where staff can reply, resolve
against a real outcome, hide, or dismiss.

### Decisions locked (2026-08-01, Christian)

| Decision | Choice |
|---|---|
| Visibility | **Public thread on each clip** (not a private feedback channel) |
| Admin notification | **Instant email per comment** (no daily digest) |
| Spotter reward | **None.** Comments earn no Pebbles. Purely altruistic. |

### Decisions taken by the plan (change these before starting if you disagree)

| Decision | Choice | Why |
|---|---|---|
| Thread gating | Readable only after you answer this clip | Load-bearing. See §2, invariant INV-1. |
| Guest posting | Guests read, real accounts post | Guest accounts are free unlimited identities. See §2, INV-4. |
| Reply depth | One level, flatten below | Unreadable at 390px, and doubles moderation surface. |
| Reason tags | Optional, default `note`, forced only on the "can't find it" entry | Required tags are friction on a discussion box. |
| Email latency | `await` with a 3s timeout | Next 14.2.35 has no `after()`, no `@vercel/functions`. See §7. |

---

## 1. How to execute this plan

This section is the operating manual for the agent doing the build. Read it
before Phase 0.

### 1.1 Isolate the working tree first (hazard)

This repo regularly has more than one live Claude session, dev server, and build
running at once. That has previously caused Prisma client regeneration locks, a
corrupted shared `.next`, silently lost edits, and branch switches nobody asked
for. Additionally, `git status` at the time of writing shows ~20 modified files
and 5 untracked paths already in the tree from other work.

**Do not build this on `main` in the primary checkout.**

```bash
git worktree add ../FishSpotter-comments -b feat/clip-comments
```

Work there, run the dev server on a non-default port if the primary one is
already up, and never run `git add -A` (it would sweep in the unrelated
uncommitted work listed in `git status`). Stage explicit paths only.

### 1.2 The gate command

Every task ends by running this. A task is not done until it exits clean.

```bash
npx tsc --noEmit && npm test && npm run lint && npm run lint:tokens
```

During a task, prefer the narrow, fast form so the loop stays tight:

```bash
npx vitest run src/lib/comments.test.ts
```

### 1.3 Task format

Every task below carries the same six fields. Execute them in order within a
phase; tasks marked **parallel-safe** touch disjoint files and can be issued in
one batched message.

- **Files** — exact paths, new or edited.
- **Pattern** — an existing file and line range to copy from. Read *that range*,
  not the whole file. This is the main token-efficiency lever in the plan.
- **Do** — what to build.
- **Test** — the test written as part of the task, not after.
- **Verify** — a runnable command whose output proves the task landed.
- **Depends on** — prerequisite task IDs.

### 1.4 Token efficiency rules for this build

1. **Never read a whole large file.** `FeedCard.tsx` is 2109 lines. Every anchor
   you need is given below with a line number. Read a 40-line window around it.
2. **Do not re-read a file after editing it.** Edit fails loudly if the match
   missed; the harness tracks file state.
3. **Batch independent tool calls** into a single message. The parallel-safe
   markers below tell you which.
4. **Do not run the full gate after every edit.** Run the narrow vitest file
   during a task, and the full gate once at the end of each phase.
5. **Do not spawn subagents for this.** Every task is a small, well-specified
   edit against a named pattern; delegation costs more than it saves here.

### 1.5 Definition of done for the whole build

- Full gate passes.
- All tests in the §10 inventory exist and pass.
- `npm run db:enable-rls -- --check` exits 0.
- The leak grep in §10.4 returns only the allowed files.
- Playwright `tests/e2e/security.spec.ts` passes, including the new gate cases.
- One Gemini visual pass on the composer and thread at 390px (§6, task 1.9).

---

## 2. Invariants that must not break

These are the four things that make this feature safe. Each has a test that
proves it. If a task would break one, stop and raise it rather than working
around it.

### INV-1: the thread is invisible until the viewer has answered this clip

FishSpotter's Pebbles economy pays out for **independent** convergence.
`src/lib/consensus.ts` credits a camp when spotters agree, and `src/lib/trust.ts`
propagates reputation through those camps. `GET /api/snippets/[id]/stats` already
withholds the community histogram until the caller has submitted
([stats/route.ts:32-39](<../../src/app/api/snippets/[id]/stats/route.ts>)). A thread
that says "obvious pollack" in plain words, readable before answering, would turn
consensus into a measurement of copying.

Copy that exact `userHasAnswered` check into `GET /api/comments`. Pre-answer the
route returns `{ gated: true }` and nothing else.

- **Test:** `tests/e2e/security.spec.ts`, added to the existing
  `"S1-T11: anonymous spoiler-gate on API"` describe block.

**Known residual, do not try to fix here:** "Edit answer" still exists on the
reveal, so a spotter can read the thread and revise. That vector already exists
via the histogram, so the thread does not open a new door, it widens an existing
one. The proper fix is locking consensus eligibility to the first submitted
value, which is a change to `consensus.ts` and out of scope. Log it, move on.

### INV-2: `adminNote` and author emails never reach a client

`Comment.adminNote` is internal staff commentary. Author email plus
`emailVerified` are read only to compute the PEBL badge. None of the three may
appear in any JSON response.

The design makes this cheaply testable: **all serialisation goes through one
pure function**, `toPublicComment(row, viewer)` in `src/lib/comments.ts`. Routes
map over it and never construct a response shape by hand.

- **Test:** unit test asserting `Object.keys(toPublicComment(...))` contains
  none of `adminNote`, `email`, `emailVerified`, `hiddenReason`, plus the §10.4
  grep guard.

### INV-3: RLS is enabled on both new tables

The Supabase anon key ships in the browser bundle. A `public` table with RLS off
is world-readable at `/rest/v1/<Table>`. An unprotected `Comment` table hands
anyone every thread, every hidden comment, and every `adminNote`, keyed to user
IDs. `prisma db push` does not manage RLS, so a new table lands unprotected.

- **Verify:** `npm run db:enable-rls -- --check` exits 0. Run it immediately
  after every `db:push` in this build, not just at the end.

### INV-4: guests cannot post

`User.isGuest` accounts are username-only, carry a synthetic placeholder email,
and are never verified. They are a free, unlimited posting identity, which is
the single most obvious abuse path in a public thread. Guests may read the
thread (after answering) and are prompted to create an account to post, which is
also the existing conversion moment.

- **Test:** unit test on `canPost({ isGuest: true })` returning a
  `guest-must-upgrade` reason.

---

## 3. Data model

### 3.1 Schema

Add to [prisma/schema.prisma](../../prisma/schema.prisma), plus
`comments Comment[]` back-relations on `User` and `Snippet`.

```prisma
// Public per-clip discussion thread + PEBL feedback inbox (2026-08-01).
//
// Visibility is gated on the VIEWER having answered this clip, mirroring
// GET /api/snippets/[id]/stats. That gate is load-bearing: src/lib/consensus.ts
// pays Pebbles for INDEPENDENT convergence, so a thread readable before you
// commit would make consensus measure copying instead of agreement.
//
// Serialisation for any client goes through toPublicComment() in
// src/lib/comments.ts. adminNote and the author's email must never leave the
// server.
model Comment {
  id            String    @id @default(cuid())
  userId        String
  snippetId     String
  parentId      String?   // one level of replies; deeper replies flatten to this
  reason        String    @default("note") // REASON_CODES in src/lib/comments.ts
  body          String    // <= MAX_BODY chars, URLs rejected
  suggestedName String?   // for reason "not-listed" / "disagree"

  // Moderation
  hiddenAt     DateTime?
  hiddenBy     String?   // admin email
  hiddenReason String?   // internal; never serialised to a non-admin
  reportCount  Int       @default(0) // auto-hides at AUTO_HIDE_REPORTS

  // Staff triage
  status    String    @default("new") // new | acknowledged | resolved | dismissed
  outcome   String?   // OUTCOME_CODES; set on resolve
  adminNote String?   // INTERNAL ONLY. Never serialised to any client.
  handledBy String?   // admin email (same audit pattern as DiagnosticMark.createdBy)
  handledAt DateTime?
  readAt    DateTime? // first admin open; drives the unread badge

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  user    User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  snippet Snippet         @relation(fields: [snippetId], references: [id], onDelete: Cascade)
  parent  Comment?        @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies Comment[]       @relation("CommentReplies")
  reports CommentReport[]

  @@index([snippetId, createdAt])
  @@index([status, createdAt])
  @@index([userId, createdAt])
  @@index([parentId])
}

model CommentReport {
  id        String   @id @default(cuid())
  commentId String
  userId    String
  reason    String   // abusive | spam | off-topic | personal-info | other
  createdAt DateTime @default(now())
  comment   Comment  @relation(fields: [commentId], references: [id], onDelete: Cascade)

  @@unique([commentId, userId]) // one report per person per comment
  @@index([commentId])
}
```

Deliberately **not** unique on `(userId, snippetId)`: people should be able to
add a second thought. The POST route caps it at `MAX_PER_CLIP = 3` top-level
comments per user per clip instead, so a thread cannot become one person's
scratchpad.

`onDelete: Cascade` on `User` means account erasure removes comments, satisfying
the UK GDPR right to erasure already promised in the Privacy Policy.

### 3.2 Reason codes

Public-facing tags that double as triage routing. Each maps to an existing PEBL
tool, which is what makes the inbox actionable rather than a suggestion box.

| Code | Spotter label | Routes to |
|---|---|---|
| `not-listed` | "The species isn't in the list" | `npm run db:onboard-species` |
| `unclear` | "Too unclear to call" | `Snippet.excluded` in TRDesk4, or difficulty re-score |
| `wrong-track` | "The trail follows the wrong animal" | `SnippetTrackEditor` at `/admin/snippets/[id]` |
| `life-stage` | "Juvenile or different life stage" | `species-images.json` life-stage buckets |
| `disagree` | "I'd call this something else" | Reference / consensus review |
| `note` | "Something else" (default) | General triage |

### 3.3 Outcome codes

Set on resolve. Gives `/admin/metrics` a real funder line: *N spotter reports,
M catalogue additions.*

`catalogue-added` | `clip-excluded` | `track-fixed` | `reference-updated` | `no-action`

---

## 4. Phase 0 — Pre-flight

### T0.1 Worktree + baseline

- **Do:** create the worktree per §1.1. Run the full gate on a clean tree to
  confirm the baseline is green before adding anything.
- **Verify:** `npx tsc --noEmit && npm test && npm run lint && npm run lint:tokens`
- **If red:** stop. Fix or report the pre-existing failure first. Do not build
  on top of a red baseline, or you will spend the phase chasing someone else's
  breakage.

---

## 5. Phase 1 — The thread (core loop)

Target: a spotter can post, everyone who has answered can read, staff can see
and reply. Roughly 1.5 days.

### T1.1 Pure library + tests (do this first, it is the spine)

- **Files:** `src/lib/comments.ts` (new), `src/lib/comments.test.ts` (new)
- **Pattern:** [src/lib/events.ts](../../src/lib/events.ts) for the `as const`
  code-list style; [src/lib/pebbles.ts](../../src/lib/pebbles.ts) for the
  pure-function-plus-test shape.
- **Do:** export, with no Prisma import anywhere in this file:

```ts
export const REASON_CODES = ["not-listed", "unclear", "wrong-track",
  "life-stage", "disagree", "note"] as const;
export const OUTCOME_CODES = ["catalogue-added", "clip-excluded", "track-fixed",
  "reference-updated", "no-action"] as const;
export const REPORT_REASONS = ["abusive", "spam", "off-topic",
  "personal-info", "other"] as const;
export const STATUSES = ["new", "acknowledged", "resolved", "dismissed"] as const;

export const MAX_BODY = 500;
export const MAX_PER_CLIP = 3;
export const AUTO_HIDE_REPORTS = 3;

export function sanitiseBody(input: unknown): string
export function containsUrl(body: string): boolean
export function hitsBlocklist(body: string): string | null
export function canPost(user): { ok: true } | { ok: false; reason: string }
export function canTransition(from: Status, to: Status): boolean
export function isVisibleTo(comment, viewer): boolean
export function toPublicComment(row, viewer): PublicComment  // THE leak guard
export function threadShape(rows, viewer): PublicComment[]   // nests one level
```

  `toPublicComment` builds its return object by **explicit field construction**,
  never by spreading the row. That is the whole point: it makes INV-2 a
  compile-time-visible, unit-testable property rather than a review habit.

- **Test:** `src/lib/comments.test.ts`, minimum cases:
  - every code list is non-empty and has no duplicates
  - `sanitiseBody` trims, clamps at `MAX_BODY`, collapses runs of whitespace,
    strips control characters
  - `containsUrl` catches `http://`, `https://`, `www.`, and a bare
    `something.com` / `something.co.uk`
  - `hitsBlocklist` matches on **word boundaries only**. Explicitly assert the
    Scunthorpe class of false positive stays clean: `"Scunthorpe"`, `"assess"`,
    `"classic"`, `"shiitake"`, `"cockle"`, `"bass"` must all pass. A substring
    blocklist on a marine-species app will otherwise reject real species names.
  - `canPost` rejects `{ isGuest: true }` with reason `guest-must-upgrade` (INV-4)
  - `canTransition`: `new -> acknowledged` true, `resolved -> new` false,
    `dismissed -> acknowledged` false, same-to-same false
  - `isVisibleTo`: a hidden comment is visible to its author and to an admin,
    and invisible to a third party
  - **INV-2:** `Object.keys(toPublicComment(fullRow, viewer))` contains none of
    `adminNote`, `email`, `emailVerified`, `hiddenReason`, `handledBy`
  - `threadShape` nests a reply under its parent and flattens a
    reply-to-a-reply to the same level
- **Verify:** `npx vitest run src/lib/comments.test.ts`
- **Depends on:** T0.1

### T1.2 Schema + RLS — **parallel-safe with T1.1**

- **Files:** `prisma/schema.prisma`
- **Do:** add both models from §3.1 plus the two back-relations.
- **Verify, in order:**
  ```bash
  npx prisma validate
  npm run db:push
  npm run db:enable-rls -- --check
  ```
  The third command must exit 0. If it reports an unprotected table, run
  `npm run db:enable-rls` (no flag) and re-check. This is INV-3.
- **Depends on:** T0.1

### T1.3 Rate limiter

- **Files:** [src/lib/rate-limit.ts](../../src/lib/rate-limit.ts)
- **Pattern:** the shop limiter at lines 143-151. Copy its shape exactly.
- **Do:** add two limiters:
  ```ts
  const COMMENT_WINDOW_MS = 60 * 60 * 1000;
  const COMMENT_MAX_PER_HOUR = 20;
  export async function checkCommentRateLimit(userId: string): Promise<boolean>

  // Reused as an EMAIL throttle in Phase 3, not a request limiter.
  const COMMENT_MAIL_MAX_PER_HOUR = 20;
  export async function checkCommentMailRateLimit(adminEmail: string): Promise<boolean>
  ```
- **Test:** extend `src/lib/rate-limit.test.ts` with one case per limiter
  (allows up to N, blocks N+1).
- **Verify:** `npx vitest run src/lib/rate-limit.test.ts`
- **Depends on:** T0.1

### T1.4 POST /api/comments

- **Files:** `src/app/api/comments/route.ts` (new)
- **Pattern:** [src/app/api/shop/purchase/route.ts:1-40](../../src/app/api/shop/purchase/route.ts)
  for the same-origin, auth, rate-limit, zod sequence.
- **Do:** in order, and do not reorder these:
  1. `assertSameOrigin` else 403
  2. `getServerSession`, no `user.id` else 401
  3. `checkCommentRateLimit(userId)` else 429
  4. zod parse: `snippetId`, `body`, optional `reason` (enum, default `note`),
     optional `parentId`, optional `suggestedName`
  5. load the user's `isGuest`; `canPost` else 403 with `guest-must-upgrade` (INV-4)
  6. confirm the user has an `Answer` on this snippet, else 403. You must have
     answered to join the thread you are allowed to read.
  7. `sanitiseBody`; empty after sanitising means 400
  8. `containsUrl` means 400 with a plain message ("Links aren't allowed in
     comments")
  9. `hitsBlocklist` means create the row **with `hiddenAt` set** and flag it in
     the inbox. Do not reject outright: false positives must be recoverable by a
     human.
  10. count existing top-level comments by this user on this clip; at
      `MAX_PER_CLIP` return 429 with a friendly message
  11. if `parentId` is set, confirm the parent exists on the same snippet, and
      flatten (use the parent's `parentId` if the parent is itself a reply)
  12. create, then return `toPublicComment(created, viewer)` and nothing else
- **Test:** covered by e2e in T1.8 plus the pure tests in T1.1. Do not build a
  Prisma mock harness for this; the repo has no precedent for it and the pure
  functions already carry the logic.
- **Verify:** `npx tsc --noEmit`
- **Depends on:** T1.1, T1.2, T1.3

### T1.5 GET /api/comments (the gated read) — **INV-1 lives here**

- **Files:** `src/app/api/comments/route.ts` (same file as T1.4)
- **Pattern:** [stats/route.ts:32-39](<../../src/app/api/snippets/[id]/stats/route.ts>)
  is the exact `userHasAnswered` block to copy. Read those 8 lines and reuse the
  shape verbatim.
- **Do:**
  - `?snippetId=` required
  - compute `userHasAnswered` exactly as the stats route does
  - **if not answered: return `{ gated: true }` and stop.** No `comments` key, no
    count, no partial payload. Nothing that hints at the content.
  - if answered: load the thread, resolve each author's display name as
    `displayName ?? name ?? "Spotter " + id.slice(0,6)` (matching
    [SnippetAnswers](../../src/components/SnippetAnswers.tsx)), compute
    `isPebl` via `isAdminUser({ email, emailVerified })`, then discard email and
    `emailVerified`
  - serialise **only** through `toPublicComment` / `threadShape`
  - **no public `Cache-Control` header.** The payload is per-user gated and
    identity-bearing. The stats route's PRIVACY comment at lines 14-19 explains
    exactly why, and the same reasoning applies.
- **Verify:** `npx tsc --noEmit`, then the e2e in T1.8
- **Depends on:** T1.4

### T1.6 Spotter UI: composer + thread

- **Files:** `src/components/idflow/CommentThread.tsx` (new),
  `src/components/idflow/CommentBox.tsx` (new)
- **Pattern:** the reveal panel styling at
  [RevealResult.tsx:126](../../src/components/idflow/RevealResult.tsx)
  (`rounded-modal border border-white/10 bg-white/[0.06] p-3`) and its
  `motion` variants at lines 83-91.
- **Do:**
  - `CommentThread` renders collapsed by default as a single summary line
    ("4 comments" / "Start the discussion"), expanding on tap. Collapsed by
    default is not cosmetic: the advance row at
    [FeedCard.tsx:1886](../../src/components/FeedCard.tsx) is sticky, and an
    expanded thread would bury "Next" on a phone.
  - Comments show display name, a teal PEBL chip when `isPebl`, relative time,
    the reason tag when not `note`, and the body.
  - `CommentBox`: optional reason chips, textarea with a live character count
    against `MAX_BODY`, Send button. Disabled with an explanatory line for
    guests, linking to signup (INV-4, and the conversion moment).
  - House rules, all enforced by `npm run lint:tokens`: **no emoji as icons**
    (stroked SVG in `text-teal-500`), design tokens only (`rounded-modal`,
    `rounded-card`, `rounded-full`, no `rounded-2xl`), timings from
    `src/lib/motion.ts`, every interactive element at least 44x44px.
- **Test:** add both components to
  [src/components/__smoke__/render-smoke.test.tsx](../../src/components/__smoke__/render-smoke.test.tsx)
  so they are proven to render without throwing in jsdom.
- **Verify:** `npx vitest run src/components/__smoke__ && npm run lint:tokens`
- **Depends on:** T1.1

### T1.7 Mount in the feed + the "I can't find it" entry

- **Files:** [src/components/FeedCard.tsx](../../src/components/FeedCard.tsx),
  [src/components/idflow/CandidateGate.tsx](../../src/components/idflow/CandidateGate.tsx)
- **Anchors, read a 40-line window around each, not the whole file:**
  - `FeedCard.tsx:1740` — the `<RevealResult .../>` mount. `CommentThread` goes
    directly after the farm link block that ends at line 1859.
  - `FeedCard.tsx:1860` — the trigger row holding "Help me identify" and
    "Where is this?".
  - `FeedCard.tsx:1886` — the sticky advance row. `CommentThread` must render
    **above** this.
  - `CandidateGate.tsx:294` — the existing `skip={...}` prop.
- **Do:**
  - mount `CommentThread` in the reveal, above the advance row
  - at the candidate gate, add a tertiary "I can't find it" action alongside
    "Pick from a list". It opens `CommentBox` pre-tagged `not-listed` with the
    name field visible. On submit it does **two** things: writes the comment,
    and submits the typed name as a real answer via the existing
    `POST /api/answers` free-text path (`chosenOption` accepts up to 80 chars,
    see [answers/route.ts:20-24](../../src/app/api/answers/route.ts)). Their
    guess still earns Pebbles and enters consensus; PEBL gets a routed catalogue
    request. No dead end.
- **Verify:** `npx tsc --noEmit && npm run lint:tokens`, then load
  `http://localhost:3000/feed` in the browser preview, answer one clip, confirm
  the thread appears and "Next" is still reachable at 390px width.
- **Depends on:** T1.6

### T1.8 e2e gate tests — **this is the INV-1 proof**

- **Files:** [tests/e2e/security.spec.ts](../../tests/e2e/security.spec.ts)
- **Pattern:** the existing `"S1-T11: anonymous spoiler-gate on API"` describe
  block at line 36. Your cases belong in it, and it already shows how to grab a
  real snippet id off `/feed/browse`.
- **Do:** add four cases:
  1. anonymous `GET /api/comments?snippetId=<id>` returns 200 with
     `{ gated: true }` and **no** `comments` key and **no** `total` key
  2. anonymous `POST /api/comments` returns 401
  3. cross-origin `POST /api/comments` (an `Origin` header of
     `https://evil.example.com`) returns 403
  4. the response body of case 1, stringified, does not contain the substring
     `adminNote`
- **Verify:** `npm run test:e2e -- tests/e2e/security.spec.ts`
- **Depends on:** T1.5

### T1.9 Admin inbox v1

- **Files:** `src/app/admin/comments/page.tsx` (new),
  `src/app/admin/comments/CommentInbox.tsx` (new),
  `src/app/admin/comments/actions.ts` (new),
  [src/app/admin/AdminNav.tsx](../../src/app/admin/AdminNav.tsx),
  [src/app/admin/layout.tsx](../../src/app/admin/layout.tsx),
  [src/app/admin/page.tsx](../../src/app/admin/page.tsx)
- **Pattern:** [species/[name]/actions.ts:43-96](<../../src/app/admin/species/[name]/actions.ts>)
  for the server-action shape (`"use server"`, `requireAdminSession()` first
  line, `cleanText` clamping, `revalidatePath` last).
- **Do:**
  - the route sits under the existing `/admin` layout, so the
    `@pebl-cic.co.uk` plus `emailVerified` gate is inherited with zero new auth
    code. Do not add your own check.
  - server actions: `acknowledgeComment`, `replyToComment`, `resolveComment`
    (requires an `outcome`), `dismissComment`, `markRead`. Every one starts with
    `await requireAdminSession()` and uses `canTransition` before writing.
  - four canned replies as one-tap chips: "Thanks, logged", "Good catch, we've
    fixed the clip", "Adding this species", "We'll take another look". This is
    the react-to-it affordance, and one tap is why it will actually get used.
  - filter pills: New / Acknowledged / Resolved / All, plus by reason code.
  - each row: clip thumbnail, reason chip, spotter name linking to `/u/[id]`,
    their submitted answer for context, the body, the age.
  - `AdminNav`: add `{ href: "/admin/comments", label: "Feedback" }` with an
    unread count pill. `layout.tsx` is already `force-dynamic` and already hits
    the DB, so add one `prisma.comment.count({ where: { status: "new" } })` and
    pass it down. Roughly three lines for a genuinely useful badge.
  - `admin/page.tsx`: add a fourth tile.
- **Test:** add `/admin/comments` to the smoke render test.
- **Verify:** `npx tsc --noEmit && npm run lint:tokens`, then sign in as a
  `@pebl-cic.co.uk` user, post a comment as a normal spotter, confirm it appears
  in the inbox and the badge increments.
- **Depends on:** T1.4

### T1.10 Phase 1 gate

- **Verify, all four must pass:**
  ```bash
  npx tsc --noEmit && npm test && npm run lint && npm run lint:tokens
  npm run db:enable-rls -- --check
  npm run test:e2e -- tests/e2e/security.spec.ts
  ```
- Plus the leak grep in §10.4.
- Plus one Gemini visual pass: capture the expanded thread and the composer at
  390px via the browser preview, grade with
  [gemini-vision.ts](../../src/lib/biodiversity/gemini-vision.ts) against the
  house rubric (on-brand >= 80, restraint >= 75, clarity >= 80). This is the
  established loop for visual changes in this repo.

---

## 6. Phase 2 — Moderation

Target: reports, auto-hide, held-comment queue. Roughly 1 day. **This phase is
not optional before launch.** An accessible reporting route and a demonstrable
takedown path are specific Online Safety Act duties, not polish.

### T2.1 Report route

- **Files:** `src/app/api/comments/[id]/report/route.ts` (new)
- **Pattern:** T1.4's route sequence.
- **Do:** same-origin, auth, rate-limit, zod (`reason` from `REPORT_REASONS`).
  Upsert on the `(commentId, userId)` unique so a person cannot inflate a count.
  Recompute `reportCount` from the relation, and when it reaches
  `AUTO_HIDE_REPORTS` set `hiddenAt` in the same transaction. Return 204.
- **Test:** unit-test the threshold rule as a pure function
  `shouldAutoHide(reportCount)` in `comments.ts`.
- **Verify:** `npx vitest run src/lib/comments.test.ts && npx tsc --noEmit`

### T2.2 Report UI

- **Files:** `src/components/idflow/CommentThread.tsx`
- **Do:** a low-contrast "Report" action on every comment that is not your own,
  expanding to the five reason chips. After reporting, the control becomes a
  static "Reported" label. Optimistic, no page reload.
- **Verify:** `npm run lint:tokens` plus a manual pass in the preview.

### T2.3 Moderation queue

- **Files:** `src/app/admin/comments/CommentInbox.tsx`,
  `src/app/admin/comments/actions.ts`
- **Do:** two more filter pills (Reported, Held) and three more actions:
  `hideComment`, `unhideComment`, `deleteComment`. Hidden comments render to
  admins and to their own author only, which `isVisibleTo` already decides.
- **Test:** extend the `isVisibleTo` cases in `comments.test.ts` to cover the
  auto-hidden and admin-hidden states separately.
- **Verify:** `npx vitest run src/lib/comments.test.ts && npx tsc --noEmit`

### T2.4 Phase 2 gate

Full gate plus the e2e suite.

---

## 7. Phase 3 — Instant email

Target: staff know within seconds. Roughly half a day.

### The latency problem, and the decision

This repo is on **Next 14.2.35** with **no `@vercel/functions`** installed. That
means no `after()` and no `waitUntil`. A fire-and-forget promise is unreliable,
because the serverless instance can freeze the moment the response is sent, and
the email silently never goes.

**Decision: `await` the send, wrapped in a 3s timeout.** `sendEmail` already
never throws ([send.ts:1-18](../../src/lib/email/send.ts)), SendGrid is typically
200 to 300ms, and posting a comment is a deliberate one-off action rather than a
hot loop like answering. Zero new dependencies.

If the added latency proves noticeable in practice, the upgrade is to add
`@vercel/functions` and switch to `waitUntil`. Do not do that pre-emptively.

### T3.1 Template

- **Files:** `src/lib/email/templates/NewCommentEmail.tsx` (new)
- **Pattern:** [src/lib/email/templates/StreakNudgeEmail.tsx](../../src/lib/email/templates/StreakNudgeEmail.tsx)
  and the shared `_Layout.tsx`.
- **Do:** the comment body, the reason tag, the spotter's name, the clip
  thumbnail, and a deep link to `/admin/comments`. Subject line carries the
  reason so it is triageable from a phone lock screen:
  `"FishSpotter: new comment (species not listed)"`.

### T3.2 Dispatcher

- **Files:** `src/lib/email/comment-notify.ts` (new)
- **Pattern:** [src/lib/email/dispatch.ts](../../src/lib/email/dispatch.ts) for
  the never-throws contract.
- **Do:**
  - recipients: `prisma.user.findMany` where email ends `@pebl-cic.co.uk` and
    `emailVerified` is not null. Same rule `isAdminUser` enforces, so reuse it
    rather than re-deriving the suffix.
  - **flood cap:** before each send, `checkCommentMailRateLimit(adminEmail)`.
    Over 20 in an hour, skip the email silently. The comment is still in the
    inbox, so nothing is lost, and a spam run cannot turn a phone into a pager.
    This reuses the existing limiter, so it adds no infrastructure.
  - wrap the whole thing in try/catch plus a 3s `Promise.race` timeout. An email
    failure must never fail the spotter's POST.
  - fires on: a new top-level comment, a reply to a PEBL comment, and the first
    report of any comment. **Not** on ordinary spotter-to-spotter replies, or the
    signal becomes noise within a week.
- **Test:** `src/lib/email/comment-notify.test.ts` covering the pure
  `shouldNotify(comment, parent)` decision table above. Do not test the network
  call.
- **Verify:** `npx vitest run src/lib/email/comment-notify.test.ts`

### T3.3 Wire in

- **Files:** `src/app/api/comments/route.ts`,
  `src/app/api/comments/[id]/report/route.ts`
- **Do:** call the dispatcher after a successful create, before returning.
- **Verify:** post a comment on the dev server with `SENDGRID_API_KEY` unset and
  confirm the console logs the skipped send and the POST still returns 201.
  Then set the key, set `EMAIL_PREVIEW_CATCHALL`, and confirm a real delivery.

---

## 8. Phase 4 — Compliance (run in parallel with Phases 1 to 3)

This is the item most likely to set the actual launch date. Start it on day one,
not after the code is done.

### T4.1 Terms of Service

- **Files:** [src/data/legal/terms-of-service.md](../../src/data/legal/terms-of-service.md)
- **Do:** the "Acceptable use" (line 23) and "Your contributions" (line 38)
  sections currently cover identifications only. Add comment clauses: content
  standards, that comments are public and visible to other spotters, that PEBL
  may hide or remove content and suspend accounts, and no personal information
  about yourself or anyone else.

### T4.2 Privacy Policy

- **Files:** [src/data/legal/privacy-policy.md](../../src/data/legal/privacy-policy.md)
- **Do:** a row in the collection table at line 13 (comments and reports;
  purpose: community discussion and improving clips and the species catalogue;
  lawful basis: legitimate interests). A sentence stating comments are public
  alongside your display name. A retention line in the section at line 86.

### T4.3 Risk assessments (Christian, not the agent)

- Written **illegal-content risk assessment** and **children's risk assessment**
  under the Online Safety Act. The technical half is delivered by Phase 2
  (reporting route, blocklist, auto-hide, admin removal). The documentation half
  is a real piece of work and cannot be generated as a paragraph.
- **Children's Code judgment call to make explicitly:** comments show the same
  display name already used on the leaderboard. Minors (13 to 17) default to
  `leaderboardOptIn: false`, yet would still be named in comments. That is
  defensible (posting is a deliberate act, ranking is automatic) but it should be
  a decision on the record, not an accident.

---

## 9. Sequencing

```
T0.1
 ├─ T1.1 (lib+tests) ─┬─ T1.4 (POST) ── T1.5 (GET) ── T1.8 (e2e)
 ├─ T1.2 (schema+RLS)─┤                        └───── T1.9 (inbox)
 ├─ T1.3 (limiter) ───┘
 └─ T1.6 (UI) ─────────── T1.7 (mount)
                                    └── T1.10 (Phase 1 gate)
                                            └── Phase 2 ── Phase 3
Phase 4 runs alongside everything from day one.
```

T1.1, T1.2, T1.3 are mutually parallel-safe (disjoint files). T1.6 is
parallel-safe with T1.4 and T1.5. Batch those tool calls.

---

## 10. Test inventory

### 10.1 Unit (vitest, fast, no DB)

| File | Covers |
|---|---|
| `src/lib/comments.test.ts` | code lists, `sanitiseBody`, `containsUrl`, `hitsBlocklist` incl. the Scunthorpe class, `canPost` guest rule (INV-4), `canTransition`, `isVisibleTo`, `toPublicComment` leak guard (INV-2), `threadShape` nesting, `shouldAutoHide` |
| `src/lib/rate-limit.test.ts` | the two new limiters |
| `src/lib/email/comment-notify.test.ts` | `shouldNotify` decision table |

### 10.2 Component smoke (vitest + jsdom)

| File | Covers |
|---|---|
| `src/components/__smoke__/render-smoke.test.tsx` | `CommentThread`, `CommentBox`, `/admin/comments` render without throwing |

### 10.3 e2e (Playwright)

| File | Covers |
|---|---|
| `tests/e2e/security.spec.ts` | INV-1 anonymous gate, 401 on unauth POST, 403 cross-origin, no `adminNote` in any body |

### 10.4 Static guards (run as commands, not tests)

```bash
# INV-3: RLS on every public table
npm run db:enable-rls -- --check

# INV-2: adminNote must appear ONLY in these files. Anything else is a leak.
#   prisma/schema.prisma
#   src/lib/comments.ts
#   src/lib/comments.test.ts
#   src/app/admin/comments/*
grep -rn "adminNote" src/ prisma/

# No emoji as UI icons, no arbitrary colour/radius values
npm run lint:tokens
```

---

## 11. Deploy runbook

1. Merge to `main`. Vercel auto-deploys.
2. **Run `prisma db push` against production, then immediately
   `npm run db:enable-rls`.** The new tables land with RLS off. This is the one
   step that is genuinely dangerous to forget, and the anon key is public.
3. Confirm `npm run db:enable-rls -- --check` exits 0 against production.
4. Post a test comment from a non-admin account. Confirm the email arrives and
   the inbox badge increments.
5. Confirm from a signed-out browser that `GET /api/comments?snippetId=<id>`
   returns `{ gated: true }`.
6. Ship the Terms and Privacy edits **before or with** this deploy, not after.

### Rollback

The feature has no data migration and no back-fill, so rollback is a revert plus
a redeploy. The two tables can be left in place (orphaned but harmless) or
dropped. Nothing else in the app reads them.

---

## 12. Open decisions for Christian

1. **Guests post or not.** The plan says read-only, upgrade to post (INV-4). It
   is the single biggest abuse lever and easy to relax later, painful to tighten
   once people are used to it.
2. **Minors named in comments** while defaulted off the leaderboard (T4.3). Needs
   a decision on the record.
3. **Blocklist severity.** A UK-specific slur and profanity list needs to exist
   somewhere. Whether it holds for review (the plan's choice) or rejects outright
   is a tone decision about how the community should feel.
4. **The edit-after-read consensus vector** (INV-1 residual). Pre-existing, not
   made materially worse by this feature, but now more visible. Worth a separate
   ticket to lock consensus eligibility to the first submitted value.

---

## 13. What this deliberately does NOT do

- No Pebbles reward for comments (Christian's call, 2026-08-01).
- No daily digest email (instant only).
- No nesting beyond one reply level.
- No editing or deleting your own comment after posting. Add later if asked;
  it complicates the moderation audit trail.
- No notifications to spotters when someone replies to them. Phase 5 if the
  thread gets real use.
- No rich text, images, or links of any kind.
