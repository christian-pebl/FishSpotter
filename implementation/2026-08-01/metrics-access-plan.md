# Streamlined metrics access via Claude Code — implementation plan

**Date:** 1 Aug 2026
**Goal:** ask Claude Code "what are the latest FishSpotter stats?" in any session and get a
real answer, without opening `/admin/metrics` and reading it by hand.

---

## 1. What's actually blocking this

Not tooling — **access**. `npm run db:stats` (PR #117) already computes every number the
schema supports. The problem is that it only runs where production credentials exist.

Claude Code runs in two contexts, and they fail differently:

| Context | Has `.env.local`? | Can reach the live app? | Status |
|---|---|---|---|
| **Local** (Christian's machine) | Yes | Yes | `npm run db:stats` works today. Gap is ergonomics — you have to remember the command exists. |
| **Remote / web / mobile** (this kind of session) | **No** | **No** — the environment's network policy denies the live domain (`www.fishspotter.app`) at the proxy | Cannot produce a single figure. Hard blocker. |

Any plan that doesn't solve the remote case leaves you tied to one laptop, which defeats
the point of asking from your phone.

## 2. The access decision

Three ways to unblock remote sessions. This plan picks **B**, and the reasoning matters
more than the choice:

**A — Put database credentials in the remote environment.**
Add `POSTGRES_PRISMA_URL` to the Claude Code web environment's env vars; `db:stats` then
works everywhere with zero new code.
*Rejected as the primary path:* it hands every remote agent session a full read-write
production database credential to read six aggregate numbers. The blast radius is the
entire database — user emails, password hashes, every answer. A read-only Postgres role
would narrow it, but the credential still sits in every session's environment. Wrong
trade for a reporting feature.

**B — A token-gated, read-only, aggregate-only JSON endpoint. ← recommended**
`GET /api/metrics/summary` returning exactly what `db:stats --json` prints, behind
`Authorization: Bearer $METRICS_TOKEN`.
*Why:* least privilege. The credential grants one thing — reading aggregate counts. It
cannot read a user record, cannot write, cannot be widened without a code change and a
deploy. It works from any Claude Code session, from `curl`, from a phone. It reuses the
`isAuthorisedCron` pattern the five existing crons already trust.
*Cost:* one new route, and `www.fishspotter.app` must be added to the environment's
network allowlist.

**C — Both.** Endpoint for routine use; DB creds only in a local session when a genuinely
novel question needs ad-hoc SQL. Sensible end state — but B first, since it covers the
recurring case.

## 3. Phases

### Phase 0 — Prerequisites (Christian, ~10 min, blocking for remote)

1. Generate a token: `openssl rand -hex 32`.
2. Set `METRICS_TOKEN` in Vercel (Production), and in `.env.local` for local runs.
3. **Allowlist `www.fishspotter.app`** (the confirmed canonical domain — see CLAUDE.md
   "Live URL", corrected 1 Aug 2026; originally written against the wrong domain,
   `fish-spotter.vercel.app`) in the Claude Code web environment's network policy (see
   https://code.claude.com/docs/en/claude-code-on-the-web). Without this, remote
   sessions still can't reach the endpoint — the code will be live and unusable.

Nothing downstream works remotely until step 3 is done, so do it first and confirm with
a `curl` from a remote session.

**Status, 1 Aug 2026 — steps 1-2 done and verified end-to-end; step 3 still open.**
Christian generated `METRICS_TOKEN` (32 random bytes via the browser's
`crypto.getRandomValues`, functionally equivalent to `openssl rand -hex 32`) and set it
in Vercel Production, then redeployed so the running function picked it up (a new env
var does NOT apply to an already-built deployment — this tripped us up briefly and is
worth remembering for any future env var addition). Verified live: a real request to
`https://www.fishspotter.app/api/metrics/summary` with the correct bearer token
returned a full payload; a wrong token correctly 401'd. **Step 3 was never done** —
every session in this conversation, right through to the final validation, still hit a
proxy 403 calling `www.fishspotter.app` directly, confirmed repeatedly with both `curl`
and `WebFetch`. The endpoint is live and correctly gated, but Path 1 (the remote
endpoint) remains unusable from THIS environment's network policy specifically until
someone allowlists the domain there. The validation above was done via Claude in
Chrome operating a real browser, not this session reaching the network directly — a
useful workaround, but not a substitute for the actual allowlist fix.

### Phase 1 — Extract the shared aggregation lib (~2 h)

`scripts/stats-roundup.ts` currently holds all aggregation inline, and
`/admin/metrics/page.tsx` independently computes an overlapping subset. Two
implementations of "how many active spotters" will drift.

Create **`src/lib/metrics/roundup.ts`** exporting `computeRoundup(prisma, { windowDays })
→ Roundup`, and have the script, the admin page, and (Phase 2) the endpoint all call it.
This mirrors the established pattern — `src/lib/biodiversity/refresh.ts` is shared by
`db:backfill` and the probabilities cron.

**One design change worth making during the extraction.** The script does a single wide
`findMany` over every `Answer` and `Event` row — fine for a CLI, risky in a 60-second
serverless function as `Event` grows. Split it:

- **SQL-side** (`count`, `groupBy`, `aggregate`) for everything that's just a total:
  signups, sessions, watch seconds, clip views, unlocks, vitals.
- **In-memory** only for the genuinely order-dependent First-Sighting maths, over a narrow
  `select: { snippetId, userId, createdAt }`. That projection stays small even at high
  answer volume.

Ship with `maxDuration = 60` and the same conservative posture as the crons.

**Tests:** `roundup.test.ts` against a fixture — the First-Sighting ordering, taper fill,
and contested-clip detection are the parts with real logic and real off-by-one risk.

### Phase 2 — The metrics endpoint (~1.5 h)

**`GET /api/metrics/summary`**

- Auth: `Authorization: Bearer $METRICS_TOKEN`. Generalise `src/lib/cron-auth.ts` into
  `isAuthorisedBearer(req, secret)` (constant-time compare, already correct) and keep
  `isAuthorisedCron` as a one-line wrapper — no behaviour change to the crons.
- **A separate token from `CRON_SECRET`**, so metrics access can be rotated or revoked
  without touching the five crons.
- Rate-limited via `src/lib/rate-limit.ts`, like every other route.
- Query params: `?days=30` (window), `?section=discovery` (optional narrowing).
- Response: the `Roundup` object, plus a `caveats` array so the consumer can't report a
  consent-gated number as if it were complete.
- Token-only — no session-cookie path, so a signed-in non-admin cannot reach it.

**Security posture:** aggregate only. No user id, email, or display name in the response.
The one spotter-level cut (First-Sighting concentration) returns a *share*, not a name.
Worth a `/security-review` pass before merge since this is a new unauthenticated-by-cookie
surface.

### Phase 3 — The `/fs-metrics` skill (~1 h) — this is the ergonomics win

Commit **`.claude/skills/fishspotter-metrics/SKILL.md`** to the repo, so every session —
local, web, or mobile — gets the command with no per-machine setup.

Behaviour:
1. If `FISHSPOTTER_METRICS_URL` + token are available → fetch the endpoint.
2. Else if `.env.local` exists → run `npm run db:stats -- --json`.
3. Else → say plainly that neither path is available and name the missing piece. **Never
   estimate.** (This is the failure mode that wasted a round trip on 1 Aug: repeated
   requests for numbers that could not be fetched.)
4. Format as the roundup, with caveats attached to the figures they qualify.

After this, "what are the latest stats?" is one command from anywhere.

### Phase 4 — Snapshots and trends (~2 h)

Today nothing can answer *"how did this change since last month?"* — the 90-day CSV is the
only history, and it covers five columns.

Add a **`MetricSnapshot`** table (`date`, `payloadJson`) and a daily cron that writes one
roundup per day. Then:
- Deltas come free: week-over-week, month-over-month, "First Sightings are up 40%".
- History survives beyond the Event log's retention.
- Trend queries stop being a full-table scan.

Cheap (one small row/day) and it's what turns a snapshot into a story for funder reporting.

Deploy note: `prisma db push` → **then `npm run db:enable-rls`** (a new table lands with
RLS off, which is a load-bearing invariant in this repo).

### Phase 5 — Push, don't pull (~30 min)

With the endpoint live, a **Routine** (`create_trigger`, weekly Monday 08:00) can wake a
session, fetch the roundup, and send you the numbers plus week-over-week deltas —
unprompted. That's the real endgame of "so I don't have to pull it up myself": you stop
asking entirely.

Optionally add an alert condition — e.g. message immediately if the unspotted-clip backlog
crosses a threshold, or if a day passes with zero IDs.

## 4. Sequencing and effort

| Phase | Effort | Unblocks | Dependency |
|---|---|---|---|
| 0 — token + network allowlist | 10 min (Christian) | everything remote | — |
| 1 — shared `roundup.ts` lib | ~2 h | one source of truth | PR #117 merged |
| 2 — `/api/metrics/summary` | ~1.5 h | access from anywhere | 0, 1 |
| 3 — `/fs-metrics` skill | ~1 h | **the actual ask** | 2 (degrades to local without it) |
| 4 — `MetricSnapshot` + trends | ~2 h | deltas, funder narrative | 1 |
| 5 — scheduled push | 30 min | zero-effort reporting | 2 |

**Minimum viable: Phases 0 → 1 → 2 → 3** (~5 h). That alone delivers the request.
Phases 4 and 5 turn it from *ask and receive* into *receive without asking*.

## 5. Risks

- **Phase 0 step 3 is the silent killer.** Everything can be built and merged and remote
  sessions will still fail with a proxy 403 until the host is allowlisted. Verify it
  early, not at the end.
- **New public-ish surface.** Token-gated, but it is a new route reachable from the open
  internet. Keep it aggregate-only; run `/security-review`; never let a "just add the user
  list" request through without rethinking the threat model.
- **Serverless timeout as data grows.** Mitigated by the SQL-side/in-memory split in
  Phase 1; revisit if `Event` passes ~1M rows.
- **Caveat erosion.** The consent-gate and `isCorrect` caveats matter — a number reported
  without them is misleading in a funder report. They're in the response payload
  deliberately, not just the CLI output.

## 6. Not in scope

Share/referral events, Spot It rung-by-rung drop-off, MCQ vs guided-flow split, and
gallery-popover opens all need **new `Event` types** before they can be reported at all.
That's a separate instrumentation workstream, not a reporting one.
