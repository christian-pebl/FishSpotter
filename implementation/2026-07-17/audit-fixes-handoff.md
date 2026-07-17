# Audit fixes handoff (17 Jul 2026)

Self-contained handoff for a fresh session to pick up the verification pass.
Written because the session that did this work ran long and is handing off
deliberately, not because anything is broken or blocked.

## Where this actually lives

**Branch:** `fix/audit-findings-jul2026`, 9 commits on top of `main` at `89112b6`.

**Worktree:** `C:\Users\Christian Abulhawa\FishSpotter-recovery-tmp`, NOT the
usual `C:\Users\Christian Abulhawa\FishSpotter`. This matters: partway
through the session, another concurrent Claude Code session switched the
shared main checkout to its own branch (`feat/difficulty-ladder`) without
warning, and one commit briefly landed there by mistake before being
recovered via `git cherry-pick` into this isolated worktree. Everything from
that point on happened here. The main checkout's `feat/difficulty-ladder`
branch still has that one stray commit sitting on top of its own work and
was deliberately left alone (not this session's branch to rewrite) -- flag
it to whoever owns that branch.

**This worktree needs its own setup** before you can run anything:
```
cd "C:\Users\Christian Abulhawa\FishSpotter-recovery-tmp"
npm install
# copy .env.local and .env from the main checkout -- gitignored, don't exist here yet
cp "C:\Users\Christian Abulhawa\FishSpotter\.env.local" .env.local
cp "C:\Users\Christian Abulhawa\FishSpotter\.env" .env
```

**Not yet pushed, not yet merged to `main`.** That decision was intentionally
left to you/Christian.

## What's already done (8 of 11 original findings)

Full detail with reasoning is in `docs/CHANGELOG.md` under "End-to-end audit
fixes, 8 of 11 findings (17 Jul 2026)". Short version, in commit order:

1. `bc57ed6` Critical: guest to admin privilege escalation, closed
2. `5dcc221` DriftingSilhouettes hydration mismatch, fixed
3. `c019b6d` Copy nits, delete confirmation toast, heading order
4. (no commit) 2020-dated archive clip, investigated only, see below
5. `170f6f6` Full source-listed CSP
6. `90ce76f` + `23b3605` Client-IP consolidation, then a pluggable Redis rate limiter
7. `7ff38bd` + `17c041e` npm audit fixes + Next.js/NextAuth upgrade scoping doc
8. `a4eaad9` Back/forward cache fix + 2 related hydration bugs found and fixed

**Deliberately not pursued** (Christian's call mid-session, not essential):
finding 2 (`/feed` main-thread blocking / TBT) and finding 8 (homepage image
optimisation) from the original audit numbering. No code changes for either;
`FeedCard.tsx` and the homepage image markup are unchanged from `main`. See
"On the TBT investigation" below if picking this back up later.

**Needs a human decision, not a code fix:** finding 11, the 2020-dated
Algapelago archive clip. There are actually 9 such clips (Jan-Feb 2020,
Bideford Bay, internally consistent site name/coordinates/capture-time
pattern), not the 1 the audit spotted. Reads like genuine early footage, not
a data error, but only Christian can confirm whether "Algapelago" filming
predates the 2025 eDNA programme start date. No DB rows were touched.

## Verification checklist

Everything below was run and passed as of the last commit (`17c041e`), but
re-run it fresh in this worktree before merging, since a few of these
(the production build in particular) need the manual step noted below.

```
cd "C:\Users\Christian Abulhawa\FishSpotter-recovery-tmp"
npx tsc --noEmit          # must be silent
npm test                  # 394 tests, 48 files
npm run lint               # must be silent
npm run lint:tokens        # must be silent
```

**Playwright** needs its own webServer port (the checked-in
`playwright.config.ts` hardcodes port 3000, which may collide with another
session). Use a scratch override:
```
# playwright.config.local.ts existed during the session but was NOT
# committed (gitignore doesn't cover it, just wasn't staged) -- recreate it
# if needed, pointing webServer at an unused port, or just free port 3000
# first and use the real config.
npx playwright test --config=playwright.config.local.ts
# expect 34/34 passing
```

**Production build** hits a pre-existing, unrelated Windows-only bug: the
vendored `@vercel/og` package (via `next/og`, used by
`src/app/opengraph-image.tsx`) mis-joins `import.meta.url` with a relative
path using OS path-join semantics, which breaks specifically because this
machine's username has a space in it (`Christian Abulhawa`). This is NOT
caused by anything in this branch, does NOT affect Vercel's Linux builds
(confirmed working there per existing CLAUDE.md history), and has no
in-app-code fix (it's inside `node_modules`). To get a local production
build anyway:
```
# 1. Temporarily stub the file (do NOT commit this):
#    replace src/app/opengraph-image.tsx with a trivial handler that
#    doesn't import next/og, e.g.:
#      export const alt = "PEBL FishSpotter";
#      export const size = { width: 1200, height: 630 };
#      export const contentType = "image/png";
#      export default async function OpengraphImage() {
#        return new Response(null, { status: 404 });
#      }
npm run build               # should exit 0
npx next start -p 3200      # or any free port
# ... do whatever verification needs a real prod server ...
git checkout -- src/app/opengraph-image.tsx   # restore the real file exactly
```
Confirm the restore is byte-exact with `git diff src/app/opengraph-image.tsx`
(should be empty other than a possible CRLF-only warning, no real diff).

**CSP / Cache-Control spot-check**, since these were the two most
behaviourally significant fixes:
```
curl -sD - -o /dev/null http://localhost:3200/ | grep -i content-security-policy
# should list script-src/style-src/img-src/media-src/font-src/connect-src, not just the old 4

for p in / /privacy /terms /accessibility /auth/signin /species /leaderboard /feed; do
  echo "=== $p ==="; curl -sD - -o /dev/null "http://localhost:3200$p" | grep -i cache-control
done
# / /privacy /terms /accessibility /auth/signin /species -> should show s-maxage (cacheable)
# /leaderboard /feed -> should still show no-store (correct, real personalisation)
```

**Lighthouse**, if you want a clean final number: run it against a real
`next start` server (not `next dev`) with nothing else competing for CPU on
the machine. This session's own Lighthouse runs were noisy because another
session's dev server was running on the same box the whole time (confirmed
via `netstat`) -- the numbers in the audit report itself were measured
against the live `fish-spotter.vercel.app` deployment, which is a different
environment again (real network latency, real Vercel serverless timing), so
don't expect this branch's localhost numbers to match that report's numbers
directly. Use before/after on the SAME machine under the SAME load as the
only valid comparison.

## On the TBT investigation, if picked back up

What was found before this got deprioritized, so the next attempt doesn't
repeat the same dead ends:

- The audit's own TBT numbers (3.3 to 4.0s) did not reproduce cleanly on
  this dev machine via `npx lighthouse` against a local `next start`
  server. `total-blocking-time` measured 0ms in this session's runs.
- However `mainthread-work-breakdown` showed ~4.9s total, with ~4.25s
  bucketed as "Other" (not "Script Evaluation") -- consistent with video
  decode/media-pipeline cost, which doesn't register as classic JS
  long-tasks (what TBT counts) even though it's real main-thread time.
- A genuine, real bug was found and a fix attempted: `FeedCard.tsx`'s
  `<video poster={snippet.thumbnailUrl}>` is unconditional, but `<video
  poster>` has no equivalent of `<img loading="lazy">` -- the browser
  fetches every mounted card's poster image eagerly regardless of
  visibility. With ~73 feed cards mounted (not virtualized), that's
  dozens of eager ~100-500KB thumbnail fetches on first load, on top of the
  already-correctly-gated video `src` (which only loads for the active
  card +-1, via the existing `preload={Math.abs(activeIndex - index) <= 1}`
  logic in `FeedPlayer.tsx`).
- The fix (gate `poster` the same way `src` already is) was applied and
  type-checked clean, but the before/after Lighthouse comparison came back
  showing WORSE numbers after the fix (Performance 77 -> 40, TBT 0ms ->
  3,530ms), which is the opposite of the intended direction. This is almost
  certainly measurement noise from CPU contention (confirmed another
  session's dev server was live on port 3157 during the "after" run,
  429MB memory, actively compiling), not a real regression, but it was
  never actually confirmed clean before the session ended. **The fix was
  reverted, not shipped** -- `FeedCard.tsx` is byte-identical to `main`.
- Next attempt: free the machine of other Node processes first
  (`netstat -ano | grep LISTENING` to check), then run the same poster-gating
  fix with 3+ Lighthouse trials before and after to get a low-noise
  comparison, rather than trusting a single run either direction.

## Reference docs this session produced

- `implementation/2026-07-17/next-major-upgrade-scope.md`: what actually
  breaks in this codebase for the Next.js 14->16 and NextAuth 4->5 upgrades,
  a recommended 4-step sequence, effort estimate. Not started, scoped only.
- `docs/CHANGELOG.md`, "End-to-end audit fixes, 8 of 11 findings (17 Jul
  2026)": the full narrative version of everything in this doc, in the
  project's normal shipping-log format.
- `CLAUDE.md`: updated with a new "Rate limiting" section (the
  `UPSTASH_REDIS_REST_URL`/`TOKEN` env vars and how backend selection
  works) and a corrected description of `src/lib/admin.ts`'s gate.
