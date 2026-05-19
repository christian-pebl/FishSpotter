# Sprint 4 — Performance & List Pages

## Goal

Convert FishSpotter's three list pages (`/feed`, `/feed/browse`, `/leaderboard`) from naive `force-dynamic` + unbounded `prisma.findMany()` patterns into routes that survive growth: SQL-side aggregation, ISR caching, cursor pagination, lazy bbox payloads, and (for the live feed) coalesced neighbour preload + virtualisation. Add the filter / sort / search surfaces the archive's hero copy promises, plus the timeframe + self-row affordances the leaderboard needs to keep being motivating once the all-time top-50 stabilises. Wire `web-vitals` so future regressions are visible.

Nothing in this sprint is failing visibly today (corpus is ~30 snippets, user base is small). Every ticket is preventative; the budget is set so that at 1 000 snippets and 50 000 answers the same routes still hit our targets.

## Definition of done

Performance budgets (verified via Lighthouse CI from Sprint 1, run against a seeded test DB containing 1 000 snippets and 50 000 answers):

- **TTFB:** < 200 ms warm (ISR cache hit) on `/feed/browse`, `/leaderboard`, and `/` for an anonymous user. < 500 ms cold.
- **LCP:** < 2.5 s on simulated Slow 4G for `/feed` (first card poster preloaded with `fetchpriority="high"`), `/feed/browse`, `/leaderboard`.
- **CLS:** < 0.1 on all three list pages (no layout shift on filter chip activation, no shift on leaderboard timeframe swap).
- **INP:** < 200 ms on filter / sort / pagination interactions.
- **Initial JS transfer:** < 200 KB gz on `/feed/browse` and `/leaderboard`. < 350 KB gz on `/feed` (Framer Motion ceiling acknowledged; trimmed further in Sprint 5).
- **Initial HTML payload:** < 200 KB on `/feed` (first 5 snippets only, `bboxJson` excluded from initial payload).

Behavioural acceptance:

- `/feed` initial server response contains at most 5 snippets; the rest are fetched via `/api/feed?cursor=…`.
- `bboxJson` is never inlined into the initial `/feed` HTML; it loads per-card as the card enters the ±1 window.
- `/leaderboard` runs at most 2 SQL queries regardless of `Answer` table size (one `groupBy` for user aggregates, one `groupBy` for species histogram).
- `/feed/browse` URL is the source of truth for filter / sort / page state (`?site=…&sort=newest&page=2`); deep links restore exactly.
- Off-screen videos are explicitly released (`removeAttribute('src'); load();`) on the cleanup of the preload effect; long-session memory growth verified flat in DevTools.
- `web-vitals` POSTs LCP / CLS / INP samples to `/api/vitals` at a 10% sample rate; samples persist to a `Vital` Prisma table.
- All new query params on `/feed/browse` and `/leaderboard` are validated server-side (Zod) and round-trip safely through `searchParams`.

Test gates (lean on Sprint 1's testing infrastructure):

- Playwright e2e covers: archive filter combinations, leaderboard timeframe switch, feed pagination cursor, end-of-feed terminal card, self-row highlight for signed-in leaderboard user.
- Lighthouse CI budget file updated with the numbers above; build fails if any budget is exceeded.
- Vitest covers the new SQL aggregation helpers (`getLeaderboard`, `getArchiveFilters`, `getFeedPage`) against a seeded test DB.
- axe-core: filter UI passes (proper `<label>`s, listbox semantics on sort, `aria-live` on results count).

## Audit findings addressed

From `02-feed-experience.md`: H1 (full-table on every visit), H2 (uncoalesced ±1 preload), H3 (`<video>` `src` not stripped → memory growth), end-of-feed state missing, per-card metadata not rendered, `force-dynamic` CDN bypass, service worker drift risk, H.264 codec invariant not enforced, debounce + virtualisation recommendations.

From `05-browse-leaderboard.md`: F-ARC-01 (full-table on every visit), F-ARC-02 (no filter / sort / search), F-ARC-03 (`recordingDatetime` selected but not rendered), F-ARC-04 (inline type cast hides fields), F-ARC-05 (developer empty-state copy), F-ARC-06 (no end-of-results indicator), F-ARC-08 (no species hint — punted to Sprint 2's spoiler policy decision but the data plumbing lands here), F-ARC-11 (back-link target). F-LB-01 (full Answer scan), F-LB-03 (no timeframe filter), F-LB-04 (no self-row highlight), F-LB-06 (rank ties), F-LB-07 (personal empty state), F-LB-11 (no in-page anchors). F-X-01 (session-aware variants), F-X-02 (both pages `force-dynamic`).

From `07-accessibility-responsive-perf.md`: PERF-05 (service worker overly conservative), PERF-06 (`?v=3` cache-busting), PERF-07 (LCP poster preload), PERF-10 (full Answer scan), PERF-11 (`force-dynamic` disables ISR), PERF-15 (web-vitals not monitored).

Out of scope for this sprint, deferred elsewhere:

- F-LB-02 scoring formula (Sprint 2 — quiz alignment).
- F-LB-05 / F-LB-10 identity model + profile pages (Sprint 6).
- F-ARC-07 / F-ARC-09 / RESP-10 / A11Y items not directly on the list-page surface (Sprint 5 polish).
- `error.tsx` / `loading.tsx` / `not-found.tsx` (Sprint 1 — already shipped).
- Tap-to-pause, tap-to-unmute, panel default-collapsed (Sprint 5 navigation & polish).

## Dependency graph

```
S4-01 (Answer.createdAt index)
  └─→ S4-02 (leaderboard groupBy + ISR)
        └─→ S4-03 (timeframe filter)
              └─→ S4-04 (self-row highlight + personal empty state)
                    └─→ S4-05 (rank ties + species histogram groupBy)

S4-06 (Snippet indexes for filter columns)
  └─→ S4-07 (archive filter / sort / search URL state)
        └─→ S4-08 (archive pagination + cursor API)
              └─→ S4-09 (archive ISR + revalidate)
                    └─→ S4-10 (archive empty / end / count + back-link fix)

S4-11 (/api/feed?cursor= pagination endpoint + bbox lazy endpoint)
  └─→ S4-12 (/feed page: paginate, strip bbox, ISR shell)
        └─→ S4-13 (FeedPlayer: coalesced preload + memory release)
              └─→ S4-14 (FeedPlayer virtualisation)
                    └─→ S4-15 (end-of-feed terminal card + per-card metadata strip)

S4-16 (web-vitals sampler + /api/vitals + Vital table)
S4-17 (service worker review + SWR for static assets, version bump)
S4-18 (poster preload + Lighthouse CI budget update)
```

S4-01, S4-06, S4-11, S4-16, S4-17 can start in parallel. The leaderboard chain (S4-02 → S4-05), the archive chain (S4-07 → S4-10), and the feed chain (S4-12 → S4-15) are each linear but independent of each other once their seed ticket is in.

## Dependencies on Sprint 1-3

- **Sprint 1 (Foundations) is a hard prerequisite for verification.** Specifically:
  - `error.tsx` / `loading.tsx` / `not-found.tsx` (need `loading.tsx` to show a meaningful skeleton during the new ISR cold-cache window; need `error.tsx` so a Prisma timeout in the new `groupBy` calls degrades gracefully instead of blanking).
  - Lighthouse CI scaffolding (Sprint 1 stands this up; Sprint 4 tightens the budget thresholds against it).
  - Playwright visual-regression scaffolding (Sprint 1) is the harness for the new e2e specs.
  - axe-core integration (Sprint 1) gates the new filter / sort UI.
- **Sprint 2 (Quiz alignment) influences but does not block.** The archive's "species hint per card" decision (F-ARC-08, spoiler-or-not) is editorially owned by Sprint 2. Sprint 4 lands the plumbing (`staffAnswer` in the select, badge slot in the card) but leaves the badge content gated behind a feature flag until Sprint 2's policy is set.
- **Sprint 3 (Onboarding & compliance) lightly intersects.** The leaderboard self-row highlight (S4-04) needs `auth()` to return a session; Sprint 3 may introduce email verification gates that change which sessions are "real". Treat S4-04 as session-agnostic (highlight any matching `userId`).
- No dependency on Sprint 5 / 6.

---

## Tickets

### S4-01 — Add `Answer.createdAt` index, confirm uniqueness, prep schema for timeframe filter

**Severity:** P1 (precondition for leaderboard timeframe filter)
**Audit refs:** §05 F-LB-03 (open question 6), §05 F-LB-12 (open question 7)
**Files:** `prisma/schema.prisma`

**Goal**

Confirm `Answer.createdAt` exists and is indexed for time-bucket filtering. Confirm `@@unique([userId, snippetId])` is in place (it is, line 49) so the leaderboard cannot be inflated by duplicate answers. Add a covering index for the leaderboard `groupBy`.

**Acceptance**

- `Answer.createdAt` is indexed (already a `DEFAULT now()` column at line 45; needs an explicit `@@index([createdAt])` for range scans).
- New compound index `@@index([userId, createdAt])` and `@@index([isCorrect, createdAt])` to back the timeframe leaderboard query without a sequential scan.
- Migration runs cleanly against the live Supabase DB via `prisma db push` (no `--accept-data-loss` needed; pure additive change).
- `scripts/backup-pre-drop.ts` not relevant here (no drops); skip.

**Plan**

1. Edit `prisma/schema.prisma`:
   ```prisma
   model Answer {
     // ...existing fields...
     @@unique([userId, snippetId])
     @@index([createdAt])
     @@index([userId, createdAt])
     @@index([isCorrect, createdAt])
   }
   ```
2. Run `npx prisma db push` against `POSTGRES_PRISMA_URL`.
3. Run `npx prisma generate`.
4. Sanity check via `psql` (or Supabase SQL editor): `\d "Answer"` should list the three new indexes.

**Verification**

- Schema check passes; `npm run db:check-apis` continues to report DB connected.
- `EXPLAIN ANALYZE` on a `SELECT userId, COUNT(*) FROM "Answer" WHERE "createdAt" >= now() - interval '7 days' GROUP BY userId` shows index scan, not seq scan.

---

### S4-02 — Convert `/leaderboard` to SQL `groupBy` + ISR

**Severity:** P0 (audit §05 F-LB-01, §07 PERF-10)
**Audit refs:** §05 F-LB-01, §07 PERF-10, §07 PERF-11, §05 F-X-02
**Files:** `src/app/leaderboard/page.tsx`, new `src/lib/leaderboard.ts`

**Goal**

Replace `prisma.answer.findMany()` + JS reduction with two `prisma.answer.groupBy` calls. Switch from `force-dynamic` to `export const revalidate = 60`. Add a `take` ceiling.

**Acceptance**

- `/leaderboard` runs exactly 3 queries in the common case (groupBy users, groupBy options, findMany Users by id `IN (…)`).
- No JS-side aggregation over the full `Answer` table.
- Page declares `export const revalidate = 60`.
- All existing visual output preserved (top-50 table, top-12 species histogram, hero copy).
- Total query time at 50 000-row seeded `Answer` table is < 100 ms (measured via `prisma.$on('query')`).

**Plan**

1. Create `src/lib/leaderboard.ts` exporting `getLeaderboardSnapshot({ range }: { range: 'week' | 'month' | 'all' })`. For this ticket only `range: 'all'` is wired; `range` parameter is shape-only so S4-03 can layer on without a rewrite.
2. Inside, use:
   ```ts
   const since = computeSince(range); // null for 'all'
   const userAggregates = await prisma.answer.groupBy({
     by: ['userId'],
     where: since ? { createdAt: { gte: since } } : undefined,
     _count: { _all: true },
     _sum: { isCorrect: false }, // booleans don't sum; see step 3
     take: 200, // headroom for tie-handling before slice(0, 50)
   });
   ```
3. Prisma `groupBy` does not `_sum` booleans on Postgres. Use a raw query for the correct/total split:
   ```ts
   const rows = await prisma.$queryRaw<Array<{ userId: string; correct: number; total: number }>>`
     SELECT "userId",
            COUNT(*) FILTER (WHERE "isCorrect")::int AS correct,
            COUNT(*)::int AS total
       FROM "Answer"
      ${since ? Prisma.sql`WHERE "createdAt" >= ${since}` : Prisma.empty}
      GROUP BY "userId"
      ORDER BY (COUNT(*) FILTER (WHERE "isCorrect"))::int DESC, COUNT(*) DESC
      LIMIT 200;
   `;
   ```
4. Species histogram via raw SQL too (`chosenOption` group, trim + lower, top 12).
5. Replace `src/app/leaderboard/page.tsx:1-126` to call `getLeaderboardSnapshot` and switch `export const dynamic = "force-dynamic"` → `export const revalidate = 60`.
6. Add `export const dynamic = "force-static"` … no, keep ISR default. Just `revalidate = 60`.

**Verification**

- Snapshot the rendered HTML before / after; ranks and counts identical for the existing seed.
- `prisma.$on('query')` log shows exactly 3 queries on a fresh request.
- Lighthouse CI TTFB on `/leaderboard` drops below 200 ms warm (the new ISR cache).

**Risk / rollback**

- If raw SQL bucketing of `chosenOption` proves slower than the JS path on the current tiny seed, fall back to JS aggregation but keep the user-side `groupBy` (the user-side is the one that grows fastest). Roll back by reverting this commit; no schema change here.

---

### S4-03 — Leaderboard timeframe filter (week / month / all)

**Severity:** P1 (audit §05 F-LB-03)
**Audit refs:** §05 F-LB-03
**Files:** `src/app/leaderboard/page.tsx`, `src/lib/leaderboard.ts`, new `src/components/leaderboard/TimeframeTabs.tsx`

**Goal**

Add a `?range=week|month|all` query param. Render three tabs (radio-group semantics). Default `all`. Cap allowed values server-side via Zod.

**Acceptance**

- URL is the source of truth; deep link to `/leaderboard?range=week` restores the tab.
- Tabs use `role="tablist"` / `role="tab"` / `aria-selected` semantics, keyboard arrow nav works.
- Default value `all` does not appear in URL (clean canonical).
- `getLeaderboardSnapshot({ range })` honours `since = subDays(now, 7|30|null)`.
- ISR cache keys on `range` (Next handles automatically via `searchParams`).
- Switching tabs does a soft navigation (`router.push`), preserves scroll.

**Plan**

1. `TimeframeTabs.tsx` client component, controlled by `useSearchParams` + `useRouter`. Three tabs.
2. Server `LeaderboardPage` accepts `{ searchParams }`. Parse via Zod: `z.enum(['week','month','all']).default('all')`.
3. Pass `range` to `getLeaderboardSnapshot`.
4. Add a small "Showing the past 7 days" / "past 30 days" / "all time" subtitle below the H1 so the active filter is unambiguous.

**Verification**

- Playwright: assert that clicking each tab updates the URL and re-renders without a full page reload (ISR cache hit on second tab visit).
- axe-core: no violations on the tab control.

---

### S4-04 — Self-row highlight + personal empty state on leaderboard

**Severity:** P1 (audit §05 F-LB-04, §05 F-LB-07, §05 F-X-01)
**Audit refs:** §05 F-LB-04, §05 F-LB-07, §05 F-X-01
**Files:** `src/app/leaderboard/page.tsx`, `src/lib/leaderboard.ts`, new `src/components/leaderboard/SelfRowFooter.tsx`

**Goal**

When a signed-in user views the leaderboard:
- If they appear in the top-50 for the current range, highlight that row.
- If they don't appear, render a sticky footer showing "Your rank: #{rank}" (computed from the aggregate).
- If they have zero answers in the current range, render a personal empty state CTA to `/feed`.

**Acceptance**

- `auth()` is called server-side; anonymous users see no self-row affordance and no personal empty state.
- Highlight uses `bg-[color:var(--surface-muted)]` + `aria-label` annotation so SR users hear "Your row, rank 12, 14 points".
- Self-row computation does not require fetching all rows — `getLeaderboardSnapshot` returns `selfRank: number | null` for the requested `userId`.
- Personal empty state is distinct from the global "No entries yet" state.

**Plan**

1. Extend `getLeaderboardSnapshot({ range, currentUserId })`. After the limit-200 query, compute self's rank in the full set via a separate aggregate query keyed on `currentUserId` only (cheap, one row).
2. Render highlight by comparing `entry.userId === currentUserId` inside the existing table loop.
3. `SelfRowFooter` is a `<tfoot>` row (sticky on mobile) when `selfRank > 50`.
4. Personal empty state replaces the table footer when `selfTotal === 0`.

**Verification**

- Playwright: sign in as a seeded user with 0 answers → see personal empty state. Seed 1 answer → row appears in table (if in top 50) or in footer otherwise.
- Manual: NVDA reads "Your row, rank N" when traversing the table.

---

### S4-05 — Rank ties + species histogram groupBy + chart honesty fix

**Severity:** P2 (audit §05 F-LB-06, §05 F-LB-08, §05 F-LB-09)
**Audit refs:** §05 F-LB-06, §05 F-LB-08, §05 F-LB-09
**Files:** `src/app/leaderboard/page.tsx`, `src/lib/leaderboard.ts`

**Goal**

- Compute rank with shared positions on tied scores (1, 2, 2, 4).
- Replace `Math.max(2, percent)` minimum bar width with a 0–2% dot marker so a 1-count answer doesn't visually equal a 5-count.
- The species histogram already moved to SQL `groupBy` in S4-02; here, normalise via `lower(trim(chosenOption))` to dedupe casing.

**Acceptance**

- Two users with identical (correct, total) share a rank; the next distinct score skips ahead (`1, 2, 2, 4`).
- "Ballan wrasse" and "ballan wrasse" merge into one histogram bar.
- Bars with `percent < 2` render as a 6px dot at the start of the track instead of a forced 2% bar.

**Plan**

1. In `getLeaderboardSnapshot`, walk the sorted user list with a previous-score pointer to assign `rank`.
2. Change species histogram raw SQL to `GROUP BY lower(trim("chosenOption"))`.
3. Update the bar JSX: `percent < 2 ? <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--primary)]" /> : <div style={{ width: `${percent}%` }} ...>`.

**Verification**

- Vitest unit on `assignRanksWithTies([10,10,9,8])` → `[1,1,3,4]`.
- Visual diff against seeded data shows merged casing.

---

### S4-06 — Add Snippet indexes for filter / sort columns

**Severity:** P1 (precondition for S4-07)
**Audit refs:** §05 F-ARC-02
**Files:** `prisma/schema.prisma`

**Goal**

Back the new archive filters with indexes so `WHERE site = … AND recordingDatetime >= …` does not seq-scan.

**Acceptance**

- New indexes: `@@index([site])`, `@@index([deployment])`, `@@index([recordingDatetime])`, `@@index([createdAt])` on `Snippet`. (`externalId` is already `@unique`.)
- `prisma db push` runs cleanly.

**Plan**

1. Append indexes to the `Snippet` model in `schema.prisma`.
2. `npx prisma db push` then `npx prisma generate`.
3. Verify in Supabase.

**Verification**

- `EXPLAIN ANALYZE SELECT * FROM "Snippet" WHERE "site" = 'Skomer' ORDER BY "recordingDatetime" DESC LIMIT 60` shows index scan.

---

### S4-07 — Archive filter / sort / search UI with URL state

**Severity:** P0 (audit §05 F-ARC-02; hero copy currently promises filtering that doesn't exist)
**Audit refs:** §05 F-ARC-02, §05 F-ARC-03, §05 F-ARC-04
**Files:** `src/app/feed/browse/page.tsx`, new `src/components/browse/ArchiveFilters.tsx`, new `src/lib/archive.ts`

**Goal**

Add a filter strip above the grid: site chips, deployment chips, depth-bucket chips (`≤5m`, `5–15m`, `15–30m`, `30m+`), date range, free-text search across `site`/`deployment`/`staffAnswer`, sort dropdown (`newest`, `oldest`, `site`, `depth`). All state in URL search params.

**Acceptance**

- URL params: `?site=Skomer&deployment=SC11&depth=15-30&q=wrasse&sort=newest&from=2024-01-01&to=2024-12-31&page=1`.
- All params Zod-validated server-side; unknown / malformed values fall through to defaults.
- Filter chip click toggles the param and `router.push`es; back-button restores prior state.
- `recordingDatetime` is selected, rendered (per F-ARC-03), and wrapped in `<time dateTime="…">`.
- Inline `:` type cast at `page.tsx:37` removed; the row type derives from `Prisma.SnippetGetPayload`.
- Active filters render as removable chips; an "Clear all" link resets to canonical URL.
- A results count appears in the hero: `Showing 24 of 30 clips`.

**Plan**

1. `getArchiveFilters()` server helper queries distinct `site` / `deployment` values (cheap with the new indexes; cached for 1 hour via `unstable_cache`).
2. `getArchivePage({ filters, sort, page, pageSize })` returns `{ items, totalCount }`.
3. `ArchiveFilters.tsx` is a client component reading / writing `useSearchParams`.
4. Replace the `(s: { id, … })` inline cast with `Prisma.SnippetGetPayload<{ select: typeof archiveSelect }>`.
5. Render date and (gated) species badge per card.
6. `aria-live="polite"` on the results-count region so SR users hear "Showing 12 of 30 clips" after filter change.

**Verification**

- Playwright: combinations of site × depth × date × q produce expected counts (use seeded DB).
- axe-core: filter UI has labels, sort dropdown is a real `<select>` or correctly-rolled listbox.
- URL state survives reload and browser back.

---

### S4-08 — Archive cursor pagination + `/api/browse?cursor=` endpoint

**Severity:** P1 (audit §05 F-ARC-01, §07 PERF-11)
**Audit refs:** §05 F-ARC-01, §05 F-ARC-06
**Files:** `src/app/feed/browse/page.tsx`, new `src/app/api/browse/route.ts`, `src/lib/archive.ts`

**Goal**

Cap initial server payload at `pageSize = 24`. Provide a `Load more` button (chosen over infinite scroll per §05 open question 4 — research audience prefers explicit boundaries; also better for SR users).

**Acceptance**

- Initial server render returns first 24 snippets matching the active filter.
- `Load more` button issues `GET /api/browse?cursor=<createdAt>&<filters>` and appends to the grid.
- `?page=N` in the URL fast-forwards to that page on server render (deep-link friendly).
- API endpoint validates filters via the same Zod schema as the page.
- Last page renders `You've reached the end · 24 of 30 clips` footer.

**Plan**

1. Cursor is `(createdAt, id)` keyset, not offset, to remain stable under inserts.
2. `getArchivePage({ ..., cursor })` issues `findMany` with `cursor: { id: cursorId }, skip: 1, take: 25` (fetch one extra to know `hasMore`).
3. `/api/browse/route.ts` returns `{ items: SnippetCard[], nextCursor: string | null }`.

**Verification**

- Playwright: click `Load more` 3× on seeded 100-snippet DB, assert all unique IDs.
- HTML payload of `/feed/browse` initial response stays < 60 KB regardless of corpus size.

---

### S4-09 — Archive ISR + `revalidate = 60`

**Severity:** P1 (audit §05 F-X-02, §07 PERF-11)
**Audit refs:** §05 F-X-02, §07 PERF-11
**Files:** `src/app/feed/browse/page.tsx`

**Goal**

Drop `force-dynamic`; adopt `export const revalidate = 60`. Each combination of `searchParams` becomes its own ISR cache entry (Next handles automatically).

**Acceptance**

- Cold page render < 500 ms; warm < 100 ms.
- `Cache-Control` headers reflect ISR (`s-maxage=60, stale-while-revalidate`).
- Deep links to filtered states still resolve correctly server-side.

**Plan**

1. Change page directive.
2. Ensure `getArchivePage` itself uses `unstable_cache` keyed on full filter tuple, TTL 60s.

**Verification**

- Lighthouse CI TTFB < 200 ms warm on `/feed/browse?site=Skomer`.

---

### S4-10 — Archive: empty state, end state, count, public copy, back-link fix

**Severity:** P1 (audit §05 F-ARC-05, §05 F-ARC-06, §05 F-ARC-11)
**Audit refs:** §05 F-ARC-05, §05 F-ARC-06, §05 F-ARC-11
**Files:** `src/app/feed/browse/page.tsx`, `src/app/feed/[id]/page.tsx`

**Goal**

- Replace dev-flavoured empty-state copy with public language; keep the dev hint behind `process.env.NODE_ENV === 'development'`.
- Render "You've reached the end" footer below the grid when the last page has been loaded.
- Make the detail page's back link return to `/feed/browse` if the user came from the archive (`?from=browse` appended by archive card links, or use `Referer`).

**Acceptance**

- Empty state: "The PEBL archive is currently empty. Check back soon, or visit the live feed for the latest deployments." + button to `/feed`.
- End footer: "You've reached the end — {totalCount} clips in the archive."
- Detail-page back link: dynamic text `← Back to archive` when `?from=browse`, falls back to `← Back to live feed` otherwise.

**Plan**

1. Archive `<Link>` adds `?from=browse&clip={id}` so the detail page knows where to send the user back.
2. Detail page reads `searchParams.from`. Build href accordingly.

**Verification**

- Playwright: open detail from archive → back link reads "Back to archive" and returns to `/feed/browse?...filters preserved`.

---

### S4-11 — `/api/feed?cursor=` pagination + `/api/feed/[id]/bboxes` lazy endpoint

**Severity:** High (audit §02 H1)
**Audit refs:** §02 H1, §07 PERF-11
**Files:** new `src/app/api/feed/route.ts`, new `src/app/api/feed/[id]/bboxes/route.ts`, `src/lib/feed.ts`

**Goal**

Server endpoints that the new `/feed` page (S4-12) and FeedPlayer (S4-13) will lazy-load from. Separates the bbox payload (heavy, per-card) from the snippet metadata (light, paginated).

**Acceptance**

- `GET /api/feed?cursor=<createdAtIso>` returns the next 5 snippets sans `bboxJson`, plus a `hasBboxes: boolean` flag and `nextCursor: string | null`.
- `GET /api/feed/{id}/bboxes` returns `{ bboxes: BBoxFrame[] } | { bboxes: null }`. Cached `s-maxage=86400, immutable` (snippet bboxes don't change post-seed).
- Both endpoints are public (no auth required — same data as the current SSR payload).

**Plan**

1. `src/lib/feed.ts` exports `getFeedPage({ cursor, take = 5 })` returning the slim shape.
2. Both routes use `revalidate = 60` for the list, `revalidate = 86400` for the bbox.
3. Apply Zod validation on `cursor`.

**Verification**

- `curl /api/feed | jq '.items | length'` → 5. `jq '.items[0].bboxJson'` → undefined.

---

### S4-12 — `/feed` page: paginate, strip bbox from initial payload, ISR shell

**Severity:** High (audit §02 H1, §07 PERF-11)
**Audit refs:** §02 H1, §07 PERF-11
**Files:** `src/app/feed/page.tsx`, `src/components/FeedPlayer.tsx`

**Goal**

Initial server render ships first 5 snippets (no bbox). FeedPlayer fetches subsequent pages as the user scrolls into the bottom 50% of its window, and fetches bbox per card as it enters the ±2 window.

**Acceptance**

- Initial HTML payload for `/feed` is < 200 KB regardless of catalogue size.
- `bboxJson` does not appear anywhere in the initial HTML.
- `export const revalidate = 60` (replaces `force-dynamic`).
- FeedPlayer renders a small bottom-of-feed sentinel that triggers `/api/feed?cursor=…` and appends.
- FeedCard fetches its bbox on mount when `preload` is true (and it doesn't yet have bbox data); shows the bbox overlay after fetch completes.

**Plan**

1. Strip `bboxJson` from the server select; replace with `hasBboxes: boolean` computed via `select: { _count: ... }` or a length probe in SQL.
2. Pass `initialItems` + `initialNextCursor` to `<FeedPlayer>`.
3. `FeedPlayer` keeps a state `items: FeedSnippet[]`; the IntersectionObserver from S4-13 promotes neighbours; a separate sentinel observer triggers `fetchMore()`.
4. `FeedCard` accepts `bboxes?: BBoxFrame[]` plus `hasBboxes: boolean`. When `preload && hasBboxes && bboxes === undefined`, fire `useEffect` to fetch `/api/feed/{id}/bboxes` once.

**Verification**

- Playwright: load `/feed`, assert response HTML has only 5 `<section>` elements; scroll 4 down, assert next page fetched.
- DevTools Network: bbox request fires when card enters ±2 window, not before.

---

### S4-13 — FeedPlayer: debounced/coalesced ±1 preload + explicit `<video>` resource release

**Severity:** High (audit §02 H2, §02 H3)
**Audit refs:** §02 H2 (preload H), §02 H3 (memory M)
**Files:** `src/components/FeedPlayer.tsx`, `src/components/FeedCard.tsx`

**Goal**

Stop the uncoalesced preload churn on fast scroll. Strip `<video>` `src` and call `load()` when a card leaves the preload window so Chrome releases the media buffer.

**Acceptance**

- `activeIndex` updates from the IntersectionObserver are debounced 120ms after `scrollend` (or the observer settles).
- Preload window narrows to `index === active || index === active + 1` (forward-only) by default; backward neighbour is preloaded only after `scrollend` and only if user has scrolled backward in the last 5s.
- On a fast-fling test (10 cards in 1s), only the resting card's video has `readyState >= 2`; transient neighbours never started a network fetch.
- Off-screen videos: cleanup effect calls `video.removeAttribute('src'); video.load();` so the buffer is released.
- Long-session memory growth profiled in DevTools: stable after 50 card scrolls.

**Plan**

1. In `FeedPlayer`, replace the direct `setActiveIndex` from the observer with a `useDebouncedCallback` (120ms) gated by a `scrollend` listener.
2. Track scroll direction; pass to `FeedCard` so it knows to preload backward only after settle.
3. In `FeedCard`, add cleanup effect:
   ```ts
   useEffect(() => {
     return () => {
       const v = videoRef.current;
       if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
     };
   }, [preload]);
   ```
4. Also call this when `preload` flips false (not only on unmount). Use a separate effect with `preload` in the deps.

**Verification**

- Manual DevTools Network throttling Slow 4G: fast fling 10 cards, assert only 1–2 video requests show in waterfall, not 10.
- DevTools Performance: 30-card scroll session, heap snapshot diff < 50 MB.

---

### S4-14 — Virtualise FeedPlayer once `snippets.length > 30`

**Severity:** Medium (audit §02 "Performance notes" — virtualise once > 30)
**Audit refs:** §02 performance notes, §02 H3
**Files:** `src/components/FeedPlayer.tsx`, new `src/components/FeedVirtualWindow.tsx`

**Goal**

Mount only `[activeIndex - 1, activeIndex + 2]` `FeedCard` instances. Other slots are placeholder `<section>` with the correct height for snap-scroll geometry. Use a simple hand-rolled windowing approach (no `react-window` dep) keyed off `activeIndex`.

**Acceptance**

- DOM contains at most 4 `<article>` elements regardless of `items.length`.
- Snap scroll still works — placeholder sections retain `snap-start` and the same height (`100dvh`).
- Scroll position is preserved across mount/unmount of windows (`scrollTo` on activeIndex on mount, then no programmatic scroll during regular scroll).
- Virtualisation activates only when `items.length > 30`; below that, all cards mount (avoids over-engineering at current scale per §02 open question 1).

**Plan**

1. New `FeedVirtualWindow` component renders one `<section>` per item; only the windowed range contains a `<FeedCard>`; the rest contain `null` inside a fixed-height section.
2. Behind a `const VIRTUALISE_THRESHOLD = 30` constant so the behaviour can be tuned.

**Verification**

- Playwright: load a 100-snippet seeded `/feed`, assert `document.querySelectorAll('article').length <= 4` at any scroll position.

---

### S4-15 — End-of-feed terminal card + per-card metadata strip

**Severity:** Medium (audit §02 "no end-of-feed state", §02 "card info hierarchy")
**Audit refs:** §02 (end-of-feed state, metadata hierarchy), §05 F-ARC-03
**Files:** `src/components/FeedPlayer.tsx`, `src/components/FeedCard.tsx`, new `src/components/FeedEndCard.tsx`

**Goal**

- Render a synthetic terminal card after the last snippet: "You've seen all current clips. Browse the archive →" with a link to `/feed/browse`.
- Add a top-left, low-opacity metadata strip to each `FeedCard` showing `site · depth · month-year` from already-available props (`site`, `depthM`, `recordingDatetime`).

**Acceptance**

- The terminal card snaps like any other section but has no video; copy + CTA only.
- After fetchMore returns `nextCursor: null`, the terminal card is appended.
- Metadata strip renders only when at least one of (site, depth, date) is non-null. Text colour `#DEF2F1` on dark gradient backdrop for WCAG AA per audit §07 contrast matrix.
- Strip respects `prefers-reduced-motion` (no animations).

**Plan**

1. `FeedEndCard.tsx` is a static component; `FeedPlayer` renders it once when `hasMore === false`.
2. In `FeedCard`, add a `<div className="absolute top-3 left-3 ...">` containing the metadata. Format date with `Intl.DateTimeFormat` short-month + year.

**Verification**

- Playwright: scroll past last card, terminal card visible, CTA navigates to archive.
- Visual regression: metadata strip present on all seeded cards.

---

### S4-16 — `web-vitals` production sampler + `/api/vitals` + `Vital` Prisma table

**Severity:** Low (audit §07 PERF-15)
**Audit refs:** §07 PERF-15, §07 testing plan ("web-vitals production sampler")
**Files:** `src/app/layout.tsx`, new `src/lib/web-vitals.ts`, new `src/app/api/vitals/route.ts`, `prisma/schema.prisma`

**Goal**

Sample 10% of sessions for LCP / CLS / INP / TTFB / FCP and POST to `/api/vitals`. Persist to a small `Vital` table. Build a `npm run db:vitals-summary` script to print p75 per route.

**Acceptance**

- `useReportWebVitals` hook wired in `src/app/layout.tsx`.
- Client samples at 10% (via a stable session-scoped random gate).
- API uses `navigator.sendBeacon` so it doesn't block unload.
- `Vital` table: `{ id, ts, route, metric, value, rating, sessionId, userId? }`. Indexed on `(route, metric, ts)`.
- API route validates payload via Zod, rate-limits per session (max 50 events / 5 min).

**Plan**

1. Add to `schema.prisma`:
   ```prisma
   model Vital {
     id        String   @id @default(cuid())
     ts        DateTime @default(now())
     route     String
     metric    String   // LCP | CLS | INP | TTFB | FCP
     value     Float
     rating    String   // good | needs-improvement | poor
     sessionId String
     userId    String?
     @@index([route, metric, ts])
   }
   ```
2. `src/lib/web-vitals.ts` registers `onLCP`, `onCLS`, `onINP`, `onTTFB`, `onFCP` from the `web-vitals` package.
3. `npm i web-vitals`.
4. Route handler bulk-inserts events.

**Verification**

- After 100 page loads, `SELECT route, metric, percentile_cont(0.75) WITHIN GROUP (ORDER BY value) FROM "Vital" GROUP BY route, metric` returns reasonable numbers.

---

### S4-17 — Service worker review: cache hashed assets, version bump, drift guard

**Severity:** Low (audit §02 SW note, §07 PERF-05)
**Audit refs:** §02 (SW verification), §07 PERF-05
**Files:** `public/sw.js`, new `scripts/verify-sw.ts`, `package.json`

**Goal**

- Keep network-first for personalised routes (`/`, `/feed`, `/leaderboard`, `/feed/...`, `/auth/...`, `/api/...`).
- Add stale-while-revalidate for hashed `/_next/static/*` assets (these are content-addressed and safe to cache forever).
- Bump `CACHE_NAME` to `fishspotter-shell-v3` to invalidate existing clients.
- Provide a meaningful `/offline` HTML fallback in PEBL branding (very small, app-shell only).
- Add `scripts/verify-sw.ts` run in CI that greps `public/sw.js` for any Supabase storage URL and fails the build (codec-regression guard from CLAUDE.md video note).

**Acceptance**

- Hashed `_next/static` requests served from cache after first visit (DevTools "Size: (ServiceWorker)").
- `/offline` returns a 200 HTML page (not the 503 "Offline" string).
- CI step `npm run verify-sw` fails if `sw.js` mentions `/storage/v1/object/public/snippets/`.

**Plan**

1. Edit `public/sw.js`:
   ```js
   const CACHE_NAME = "fishspotter-shell-v3";
   // ...
   function isHashedStatic(url) {
     return url.pathname.startsWith("/_next/static/");
   }
   // in fetch handler:
   if (isHashedStatic(url)) {
     event.respondWith(staleWhileRevalidate(event.request));
     return;
   }
   ```
2. Add `public/offline.html` (small PEBL-branded page).
3. Pre-cache `/offline.html` in the install handler; serve it as the fallback inside the catch block.
4. `scripts/verify-sw.ts` does a `readFileSync` + regex; exits non-zero on match.
5. Add `verify-sw` to the `build` script in `package.json`.

**Verification**

- Chrome DevTools Application → Service Workers: confirm `v3` is active after deploy.
- Lighthouse: PWA offline assertion passes.

---

### S4-18 — LCP poster preload + Lighthouse CI budget tightening + `?v=N` cache-bust replacement strategy

**Severity:** Medium (audit §07 PERF-06, §07 PERF-07)
**Audit refs:** §07 PERF-06, §07 PERF-07, §02 H1 (LCP)
**Files:** `src/app/feed/page.tsx`, `next.config.mjs`, `scripts/transcode-to-h264.ts`, `.lighthouserc.json`, `CLAUDE.md`

**Goal**

- Preload the first snippet's poster with `<link rel="preload" as="image" fetchpriority="high">` to bring `/feed` LCP under 2.5s on Slow 4G.
- Tighten Lighthouse CI budgets to the DoD numbers above.
- Document and enforce the "new path on re-encode, not `?v=N`" rule (CLAUDE.md says it; codify by updating `scripts/transcode-to-h264.ts` to upload to a new path and updating CLAUDE.md to match the audit's PERF-06 recommendation).

**Acceptance**

- `/feed` HTML contains `<link rel="preload" as="image" fetchpriority="high" href="<first-poster>">` for the first snippet.
- `.lighthouserc.json` asserts LCP < 2500ms on mobile slow-4G for `/feed`, `/feed/browse`, `/leaderboard`.
- `scripts/transcode-to-h264.ts` writes to `snippets/{externalId}/snippet-v{N+1}.mp4` (next version path) instead of appending `?v=N`; updates `Snippet.videoUrl` in DB accordingly.
- CLAUDE.md updated: the "?v=3 cache-busting" note becomes a "new path per re-encode" note, with a clear reference to PERF-06.

**Plan**

1. In `feed/page.tsx`, derive the first item's `thumbnailUrl` and pass it to a `<Head>`-emitted preload tag (Next 14: use the `<link>` element directly in the metadata or render it in the layout via a server component).
2. Update `.lighthouserc.json` budgets (Sprint 1 stood the file up; here we tighten).
3. Edit `transcode-to-h264.ts` to compute a versioned path and upload to it; update DB row; do not append `?v=N`.
4. Update CLAUDE.md FishSpotter section: change the cache-busting paragraph.

**Verification**

- Lighthouse CI run on PR: LCP value reported and within budget.
- Re-run `transcode-to-h264` against one snippet → new file at `snippet-v4.mp4`, DB updated, no `?v=` query param.

---

## Out-of-scope notes

- **Personalised badges on archive cards** ("Answered ✓ / Wrong ✗ / Not yet seen", §05 F-ARC-08, §05 F-X-01): plumbing lands in S4-07 (the `staffAnswer` field is selectable; the card has a badge slot). The actual badge content is gated behind Sprint 2's spoiler-policy decision.
- **Leaderboard scoring formula** (§05 F-LB-02): owned by Sprint 2.
- **Profile click-through, follow, share** (§05 F-LB-10): Sprint 6.
- **Anti-cheat signals** (§05 F-LB-12): Sprint 6.
- **`@@unique([userId, snippetId])`**: already present (`prisma/schema.prisma:49`); no migration needed.
- **Anonymous-handle policy** (§05 F-LB-05): identity-model decision; Sprint 3 / 6.
- **Captions / transcripts** (§07 A11Y-08): editorial decision; Sprint 6+.
- **Deep-link `/feed/[id]` → resume scrolling feed** (§02 deep-link finding): Sprint 5 navigation.
