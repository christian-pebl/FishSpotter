# Test snapshot

> Live result of the test suite. Re-generate by running `npm test` and pasting the summary blocks below.
>
> Last refreshed: **2026-05-13**

## Summary

```
╔══════════════════════════════════════════════════════════════╗
║  95 tests · 95 passing · 0 failing · 1 flaky-under-parallel   ║
║                                                              ║
║  Unit (Vitest)         53 / 53 pass in 0.5 s                 ║
║  E2E + API (Playwright) 42 / 42 pass when run alone           ║
║                          41 / 42 pass under parallel run     ║
║                          (1 flake — see Notes)               ║
╚══════════════════════════════════════════════════════════════╝
```

## Unit suite (53 tests, 6 files, 502ms)

```
 RUN  v4.1.5 C:/Users/Christian Abulhawa/FishSpotter

 ✓ tests/unit/biogeographic-prior.test.ts        (8 tests)
 ✓ tests/unit/id-guide-prefill.test.ts          (11 tests)
 ✓ tests/unit/id-guide-questions.test.ts         (6 tests)
 ✓ tests/unit/obis.test.ts                       (7 tests)
 ✓ tests/unit/taxon-matching.test.ts             (7 tests)
 ✓ tests/unit/use-id-guide-reducer.test.ts      (14 tests)

 Test Files  6 passed (6)
      Tests  53 passed (53)
   Duration  502ms
```

## E2E + API suite (42 tests, 9 spec files, ~2 min)

```
✓ tests/e2e/01-home-and-auth.spec.ts                     (5)
✓ tests/e2e/02-feed.spec.ts                              (3)
✓ tests/e2e/03-answer-flow.spec.ts                       (4)
✓ tests/e2e/04-life-list-and-taxon-page.spec.ts          (5)
✓ tests/e2e/05-corrections-and-cleanup.spec.ts           (3)
✓ tests/e2e/06-id-guide-ui.spec.ts                       (7)
✓ tests/e2e/07-id-guide-prefill.spec.ts                  (2)
✓ tests/e2e/api-id-guide.spec.ts                         (9)
✓ tests/e2e/api-snippets.spec.ts                         (3)

42 / 42 passing when run with --workers=1
41 / 42 under default parallel run (1 flake)
```

## Live deployment health checks

| | Result |
|---|---|
| Localhost:3000 `/api/snippets` count | **30** |
| Localhost:3001 `/api/snippets` count | **30** |
| Vercel `/api/snippets` count | **30** |
| Row IDs hash across all 3 | `f0e16a1a5f1e` (identical) |
| Storage URLs returning 200 + real video | **30 / 30** |
| `X-Vercel-Cache` on `/api/snippets` | `MISS` · `Age: 0` (force-dynamic working) |
| NextAuth on prod (CSRF token) | 64 chars ✓ |
| NextAuth sign-up via API | session established + redirect URL correct ✓ |
| ID Guide on enhanced version | hermit-crab path → Common Hermit Crab @ 0.85 ✓ |
| OBIS prior activated on enhanced version | priorActive: true · Whiting #1 ("common") · Twaite Shad demoted ("rare") ✓ |
| **Live ingest cycle**: DB write → all 3 deploys | row visible everywhere in ~2 s, no redeploys ✓ |

## What the suite covers

See [`../tests/README.md`](../tests/README.md) for the full mapping to test-plan sections.

The suite mirrors the manual walkthrough in [`app-test-run.md`](app-test-run.md). Every "what's expected" cell in that doc has a corresponding automated assertion.

## Bugs caught by the suite

1. **Tracker toggle Strict-Mode bug**
   - `FeedCard.tsx`: side effects (`localStorage.setItem` + `dispatchEvent`) inside a `setState(prev => …)` updater
   - React Strict Mode double-invokes updaters in dev → side effects fired twice → toggle flipped back
   - **Caught by**: `02-feed.spec.ts › tracker toggle persists across reload`
   - **Fixed**: moved side effects outside the updater

2. **Single-frame bbox prefill bail**
   - `src/lib/id-guide-prefill.ts`: required ≥2 frames and bailed silently on single-frame tracks (manual tracks)
   - The newest clip (`ALG_SC_14_2024-07-17…trackmanual_1…`) has only one bbox frame, so the prefill hint never appeared on its UI
   - **Caught by**: `07-id-guide-prefill.spec.ts › prefill hint shows on Q2 / Q3 after answering Q1`
   - **Fixed**: single-frame tracks now suggest screenZone from the one bbox; locomotion omitted

## Notes

### About the parallel-run flake

`01-home-and-auth.spec.ts › sign in / sign out / sign in preserves the user` occasionally fails when run alongside other auth tests in parallel. Re-running individually always passes. It's almost certainly a NextAuth session race with adjacent tests (cookies, csrf tokens, db writes against a shared user table).

Not blocking shipping. Worth tightening with proper test isolation when time permits — options:
- Per-test database transactions with rollback
- Stricter `signUpFresh` (wait for `/api/auth/session` to confirm before proceeding)
- Move auth tests to a separate worker pool

### How to refresh this snapshot

```bash
# Run both suites, capture output
npm run test:unit > /tmp/unit.txt 2>&1
npm run test:e2e > /tmp/e2e.txt 2>&1
# Paste the summary blocks above
```

### CI integration

Not yet wired to GitHub Actions. The suite is ready for it — see `tests/README.md` § CI tips. One-day task when there's a second contributor.
