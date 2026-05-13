# Test Automation

This project has two test layers:

| Layer | Framework | Where | What |
|---|---|---|---|
| **Unit** | Vitest | `tests/unit/*.test.ts` | Pure-function logic: alias normalization, question config, scoring math, bbox prefill heuristic, OBIS client, biogeographic prior |
| **E2E + API** | Playwright | `tests/e2e/*.spec.ts` | Full browser journeys + API integration tests against a running dev server |

**Current: 53 unit + 42 E2E = 95 tests, all green.** See [`../docs/test-snapshot.md`](../docs/test-snapshot.md) for the latest live run.

## Quick start

```bash
# Run everything (unit then E2E)
npm test

# Just the unit tests (fast, no server needed)
npm run test:unit

# Watch mode while iterating on a unit test
npm run test:unit:watch

# E2E tests (Playwright auto-starts the dev server)
npm run test:e2e

# E2E with the Playwright UI for debugging
npm run test:e2e:ui

# E2E in headed mode (visible browser)
npm run test:e2e:headed

# Open the most recent HTML report
npm run test:e2e:report
```

If you already have a dev server running on port 3000, set `PW_REUSE=1` to skip Playwright spawning its own:

```bash
PW_REUSE=1 npm run test:e2e
```

## Layout

```
tests/
├── unit/                              # Vitest, no server
│   ├── taxon-matching.test.ts          # normalizeAlias edge cases
│   ├── id-guide-questions.test.ts      # question config invariants
│   ├── use-id-guide-reducer.test.ts    # state machine transitions
│   ├── id-guide-prefill.test.ts        # bbox heuristic + boundary conditions
│   ├── obis.test.ts                    # OBIS client URL building + paging
│   └── biogeographic-prior.test.ts     # prior scoring class
└── e2e/                               # Playwright, needs running app
    ├── helpers.ts                      # signUpFresh, findClipByStatus, etc.
    ├── api-id-guide.spec.ts            # POST /api/id-guide/match scoring + renames + prior
    ├── api-snippets.spec.ts            # GET /api/snippets shape + label-status mix
    ├── 01-home-and-auth.spec.ts        # Sign up + sign in journeys
    ├── 02-feed.spec.ts                 # Feed renders, badges, map, tracker toggle
    ├── 03-answer-flow.spec.ts          # Verified correct/wrong + change + Help-us-ID
    ├── 04-life-list-and-taxon-page.spec.ts
    ├── 05-corrections-and-cleanup.spec.ts  # Did-you-mean + post-rename verification
    ├── 06-id-guide-ui.spec.ts          # ID Guide modal: hermit-crab-in-4-taps + exit ramps
    └── 07-id-guide-prefill.spec.ts     # Bbox-derived prefill hint visible
```

## What the suite covers

Mirrors `docs/app-test-run.md`. Mapping:

| Test plan section | Covered by |
|---|---|
| §1 Home page | `01-home-and-auth.spec.ts` |
| §2 Sign up + sign in | `01-home-and-auth.spec.ts` |
| §3 Feed first impressions | `02-feed.spec.ts` |
| §4 Tracker toggle + persistence | `02-feed.spec.ts` |
| §5 Verified + correct | `03-answer-flow.spec.ts` |
| §6 Verified + wrong + change | `03-answer-flow.spec.ts` |
| §7 Did-you-mean | `05-corrections-and-cleanup.spec.ts` |
| §8 Help-us-ID | `03-answer-flow.spec.ts` |
| §9 Life list | `04-life-list-and-taxon-page.spec.ts` |
| §10 Taxon page | `04-life-list-and-taxon-page.spec.ts` |
| §12 Cleanup verification | `05-corrections-and-cleanup.spec.ts` + `api-id-guide.spec.ts` |
| ID-guide matching API | `api-id-guide.spec.ts` |
| ID-guide UI + happy path | `06-id-guide-ui.spec.ts` |
| Bbox-derived prefill | `07-id-guide-prefill.spec.ts` |
| OBIS biogeographic prior | `api-id-guide.spec.ts` (`biogeographic prior re-ranks…`) |

## Bugs the suite has caught so far

1. **Tracker toggle Strict-Mode bug** — side effects (`localStorage.setItem` + `dispatchEvent`) inside a `setState(prev => …)` updater fired twice in React dev mode, flipping the toggle back. Fixed by moving side effects out of the updater. Test: `tracker toggle persists across reload`.
2. **Single-frame bbox bail** — `deriveIdGuidePrefill` required ≥2 frames and bailed silently for manual-tracked clips. Fixed by handling the single-frame case — screenZone still suggested, locomotion omitted. Test: `prefill hint shows on Q2 / Q3 after answering Q1` + new unit test `single-frame track still suggests screenZone`.

## What it doesn't cover (yet)

- **Streak counter increments** — needs deterministic time control or a streak API endpoint stub
- **Sound effects** — Playwright can't easily inspect audio playback
- **Confetti** — visual-only, not worth asserting on
- **Map zoom interactions** — basic existence asserted, but pixel-level zoom checks are fragile
- **Production deployment health** — not in the automated suite, see manual smoke tests in `docs/test-snapshot.md`

## Adding a new E2E test

1. Drop a new `*.spec.ts` in `tests/e2e/`
2. Use helpers from `tests/e2e/helpers.ts` to sign up a fresh user (avoids state collisions across tests)
3. Use `request` for API calls and `page` for UI

```ts
import { test, expect } from "@playwright/test";
import { signUpFresh } from "./helpers";

test("my new flow", async ({ page }) => {
  await signUpFresh(page);
  await page.goto("/feed");
  // ...
});
```

## Adding a new unit test

Drop a `*.test.ts` file in `tests/unit/` (or co-located in `src/**/__tests__/`). Vitest auto-discovers it.

```ts
import { describe, it, expect } from "vitest";
import { someFn } from "@/lib/something";

describe("someFn", () => {
  it("does the thing", () => {
    expect(someFn(1)).toBe(2);
  });
});
```

## CI tips

When running in CI (`process.env.CI=true`):
- Playwright retries each failure once (configured)
- Reporter switches to GitHub Actions format
- The dev server is started by Playwright automatically

Browsers must be installed once: `npx playwright install chromium`.

## Caveats

- E2E tests share a single Supabase database (the dev one). Each test signs up a fresh email so no fixture collisions, but a real test database with seed reset would be cleaner long-term.
- The `webServer` config defaults to spawning `npm run dev`. First test run is slow because Next.js compiles every page on first hit; subsequent runs are fast.
- One E2E test (`sign in / sign out / sign in preserves the user`) occasionally flakes under parallel load — passes consistently when run alone. Race with NextAuth session establishment from adjacent tests. Not blocking, but the test should be tightened with proper isolation when time permits.
