# Next.js 14 -> 16 + NextAuth 4 -> 5 upgrade scope

Written 17 Jul 2026 during the audit-findings pass (`fix/audit-findings-jul2026`).
Deliberately **not attempted** in that pass -- both the 2026-07-16 audit and the
earlier 2026-07-15 hardening pass independently concluded this is its own
project, not a launch blocker (no reachable RCE/auth-bypass advisory among the
current `next@14.2.35` findings; several are Vercel-mitigated at the platform
level regardless of app code). This doc exists so the eventual upgrade has a
concrete starting point instead of "it's a big task, good luck."

## Why two hops, not one

Next's own guidance: go 14 -> 15 -> 16, not straight to 16. Two smaller
migrations, each independently testable, beat one big one where a regression
could come from either version's changes.

## What actually breaks in THIS codebase

### 1. NextAuth v4 -> v5 (Auth.js) -- the bigger of the two migrations

- `getServerSession(authOptions)` is gone entirely, replaced by an `auth()`
  function exported from a new root-level `auth.ts`/`auth.config.ts` split.
  Every call site needs rewriting -- and there are a lot of them:
  `src/lib/admin.ts`, `src/app/feed/page.tsx`, `src/app/leaderboard/page.tsx`,
  `src/app/u/[id]/page.tsx`, `src/app/account/page.tsx`, every `/admin/*`
  action, and every API route that gates on a session. `grep -rn
  "getServerSession" src/` before starting to get the exact count.
- The credentials provider config shape changes (no more `XxxProvider`
  wrapper naming, env var auto-inference via `AUTH_*` prefixes replaces
  explicit `NEXTAUTH_SECRET`/`NEXTAUTH_URL` naming -- though old names still
  work per the migration guide, worth confirming during the upgrade rather
  than assuming). Our credentials provider is hand-rolled (guest branch +
  signup branch + signin branch all in one `authorize()`), so re-verify the
  whole flow, not just the types.
- JWT session strategy is required for Credentials (already the case here --
  `S3-02` comment in `auth.ts` already notes `session: { strategy: "jwt" }`
  is deliberate), so this specific constraint is already satisfied.
- `middleware.ts`'s guest-cookie + signed-in-redirect logic
  (`hasSession()` checks a NextAuth session cookie name directly) needs
  re-verification against whatever v5 names its cookies.

### 2. Next.js 15 -> 16 -- narrower but touches infra this session just built

- **Async `params`/`searchParams` become mandatory everywhere** (already true
  as of 15, enforced harder in 16). Several routes in this app already use
  the `Promise<...>` + `await` pattern (`u/[id]/page.tsx`,
  `feed/browse/page.tsx`) as forward-compat prep. `src/app/page.tsx`
  currently reads NO searchParams at all (reverted this session -- see the
  back/forward-cache fix commit) specifically to stay static/ISR; that
  choice is still valid in 15/16, it just means the homepage doesn't need
  this migration at all.
- **Default caching model changes between 14 and 15** (fetch requests move
  from cached-by-default to uncached-by-default). This session did
  significant, carefully-verified work on exactly this axis (the
  back-forward-cache fix, `export const revalidate` on the homepage /
  leaderboard / species pages). **Re-verify every Cache-Control header this
  session fixed** after the version bump -- a caching-model change at the
  framework level could silently undo or change the shape of that fix.
  Same empirical method used this session (curl every route, confirm
  `s-maxage`/`no-store` matches intent) applies directly.
- **Turbopack becomes the default bundler.** `next.config.mjs` wraps the
  config with `withSentryConfig` (a webpack-based plugin) and has custom
  `images.remotePatterns` + `headers()`. Confirm both still work under
  Turbopack, or pin back to webpack via config if Sentry's plugin isn't
  Turbopack-ready yet by the time this upgrade happens.
- **Stricter HTML nesting validation** (invalid nesting that silently passed
  before now breaks hydration). This app has many custom interactive
  components built from scratch (drag handles, nested clickable panels in
  `FeedCard.tsx`, the shape-gate/candidate-gate tile grids). Worth a
  systematic sweep for nested `<button>`/`<a>` before/during the upgrade,
  not just fixing what the build happens to flag.
- **`middleware.ts` naming convention trending toward `proxy.ts`.** Confirm
  the exact deprecation timeline for whichever Next 16.x patch is targeted
  before renaming -- don't rename speculatively if `middleware.ts` still
  works.
- Node.js 20.9+ becomes the minimum runtime -- confirm the Vercel project's
  configured Node version before upgrading (Project Settings -> General ->
  Node.js Version).
- `next lint` is removed. This repo's `npm run lint` already just calls
  `next lint` today -- will need to move to a standalone ESLint CLI
  invocation as part of this upgrade, not after.

### 3. `@sentry/nextjs` 8 -> 10 (pulled in as part of the `npm audit` fix path)

Currently inert (`SENTRY_DSN` unset, confirmed 2026-07-16/17 -- `Sentry.init`'s
own `enabled: Boolean(dsn)` guard no-ops it), so the runtime risk of staying
on v8 is genuinely zero today. The `next.config.mjs` `withSentryConfig(...)`
call and its options object may have a different shape in v10 -- check
Sentry's own Next.js SDK migration guide when this is tackled, since it's
bundled with the Next.js upgrade's build-tooling changes anyway (Turbopack
compatibility is a shared concern for both).

## Recommended sequencing

1. Next 14 -> 15 first, alone. Re-run this session's full verification
   suite (tsc, vitest, Playwright, `next build && next start`, the
   Cache-Control curl sweep) before moving on.
2. Next 15 -> 16, same verification pass again.
3. NextAuth v4 -> v5 as its own step (can happen before or after the Next.js
   hops -- it's a separate dependency -- but doing it in isolation makes a
   regression easier to attribute to the right cause).
4. `@sentry/nextjs` 8 -> 10 last, since it's lowest-risk (inert today) and
   benefits from whichever bundler (webpack/Turbopack) the Next.js hops land
   on.

## Effort estimate

Large -- the NextAuth rewrite alone touches double-digit call sites across
pages, API routes, and admin actions, each needing a real behavioural
re-verification (not just a type-error fix), and the Next.js hops each want
a full regression pass given how much of this app depends on the exact
caching/dynamic-rendering behaviour this session just hardened. Not a
single-session task; scope as its own multi-day project with the
verification gate from `implementation/2026-07-15/pre-launch-hardening.md`
(`tsc && test && lint && lint:tokens`, plus this session's addition of a
real `next build && next start` pass) as the bar for each of the four steps
above.

## Sources consulted (17 Jul 2026 web search, not exhaustively read)

- https://nextjs.org/docs/app/guides/upgrading/version-16
- https://nextjs.org/blog/next-16
- https://authjs.dev/getting-started/migrating-to-v5
- https://next-auth.js.org/getting-started/upgrade-v4
