# CLAUDE.md - FishSpotter Project Notes

## Project Overview

**FishSpotter** (fish-spotter.vercel.app) is a PEBL CIC marine monitoring web app built with Next.js 14 (App Router), Prisma, Supabase Storage, and NextAuth.

- Repo: https://github.com/christian-pebl/FishSpotter
- Live URL: **https://fish-spotter.vercel.app** (canonical — ignore fishspotter.vercel.app, different deployment)
- Local dev: `npm run dev` runs on **localhost:3000**
- Database: Supabase Postgres (project ID: `aazxphcrexkggbmmceli`, region: West EU / Ireland)
- Storage: Supabase Storage bucket `snippets` — public URLs at `https://aazxphcrexkggbmmceli.supabase.co/storage/v1/object/public/snippets/{externalId}/snippet.mp4`

## Stack

- **Next.js 14 App Router** (TypeScript)
- **Prisma** ORM (PostgreSQL via Supabase)
- **Supabase Storage** for video and thumbnail files
- **NextAuth** for auth
- **Tailwind CSS** with custom PEBL design tokens
- **Framer Motion** for animations
- Deploy: **Vercel** (auto-deploy from `main` branch)

## Key Files

| File | Purpose |
|------|---------|
| `src/components/FeedCard.tsx` | Main video card — video playback, bbox tracking overlay, species quiz |
| `src/components/FeedPlayer.tsx` | IntersectionObserver scroll container; sets activeIndex |
| `src/app/feed/page.tsx` | Live feed page (server component, fetches snippets) |
| `src/app/feed/browse/page.tsx` | Archive grid page |
| `src/app/leaderboard/page.tsx` | Community leaderboard |
| `prisma/schema.prisma` | DB schema: User, Snippet, Answer |
| `scripts/seed.ts` | One-time seed: reads local snips folders, uploads to Supabase, inserts DB records |
| `scripts/transcode-to-h264.ts` | Utility: downloads all mp4v snippets, transcodes to H.264, re-uploads, updates DB URLs |
| `scripts/refresh-images.ts` | CLI runner for the species-image cache (thin wrapper around `src/lib/biodiversity/refresh-images.ts`) |
| `scripts/backup-pre-drop.ts` | Pre-migration safety net: dumps tables/columns about to be dropped by a `prisma db push --accept-data-loss` to `./backups/` as JSON. Edit the table list before running. |
| `scripts/seed-gadoid-marks.ts` | Inserts starter `DiagnosticMark` rows for the gadoid pilot (pollack, bib, cod), 3 per species. Idempotent (skips species that already have marks) and warns if a species has no `SpeciesImage` row cached. Defaults assume a left-facing lateral fish photo; coords usually need tuning in `/admin/species/[name]` after seeding. Run via `npm run db:seed-gadoid-marks`. |
| `scripts/adjust-gadoid-marks.ts` | One-off (kept in tree for reference) that applies the 27 May marine-biologist review: mirrors pollack coords for the right-facing iNat photo, and deletes the bib + cod seed marks because their iNat photos (mixed school, dead beach-cast) are unsuitable for teaching. Only touches rows tagged `createdBy = seed-script@pebl-cic.co.uk` so admin edits are safe. |
| `src/lib/biodiversity/refresh.ts` | Shared library for the OBIS/GBIF probability + name-map refresh (used by `db:backfill` and the probabilities cron) |
| `src/lib/biodiversity/refresh-images.ts` | Shared library for the iNat photo refresh (used by `db:refresh-images` and the images cron) |
| `src/lib/biodiversity/inaturalist.ts` | iNaturalist v1 API client (CC-licensed photo fetch with optional life-stage / sex annotation filters) |
| `src/components/SpeciesGallery.tsx` | Photo strip + lightbox for candidate cards and field-note view (portaled, focus-trapped, CC-attributed) |
| `src/components/AnnotatedSpeciesPhoto.tsx` | S9-T1: renders a reference photo with numbered SVG rings + legend for admin-authored diagnostic marks (used in the IdGuideWizard's final reveal). Returns null for species without authored marks, so the existing thumb-strip + field-note path keeps working as fallback. |
| `src/components/IdGuideWizard.tsx` | 5-step trait funnel (body shape → size → habitat → markings → behaviour). Each step now has a "Why ask this?" disclosure surfacing the marine biologist's rationale (S9-T1). FinalReveal renders AnnotatedSpeciesPhoto above the existing gallery + field note. |
| `src/data/species-images.json` | Per-species fetch manifest: which life-stage / sex buckets to request, plus optional pinned `overrides` |
| `src/data/species-traits.json` | Trait catalogue for the IdGuideWizard (body shape, size, markings, behaviour, habitat, plus the prose `fieldNote`). Read at request time by the wizard's narrowing engine in `src/lib/idguide/narrow.ts`. |
| `src/lib/admin.ts` | S9-T1 admin gate: `isAdminEmail()` checks for the `@pebl-cic.co.uk` suffix; `requireAdminSession()` does the lookup and redirects non-admins to `/`. Used by the `/admin` layout + the diagnostic-mark server actions. |
| `src/app/admin/layout.tsx` | Single gate + top nav for everything under `/admin`. Carries `robots: noindex` so admin pages never get indexed. |
| `src/app/admin/species/page.tsx` | S9-T1 species catalogue list — pilot gadoids pinned at the top with a "Pilot" badge, mark-count per species via `groupBy`, status pill (Not started / In progress / Published). |
| `src/app/admin/species/[name]/page.tsx` | Per-species editor shell. Loads SpeciesImage rows + DiagnosticMark rows in parallel, hands them to the client annotator. Shows the canonical `db:refresh-images` command if no photos are cached yet. |
| `src/app/admin/species/[name]/SpeciesAnnotator.tsx` | Click-to-add / drag-to-move / edge-handle-resize annotator. Img + absolute SVG overlay with normalised (0..1) coords. Save-on-blur for label/description; optimistic local updates with `useTransition` for the server actions. |
| `src/app/admin/species/[name]/actions.ts` | Server actions for DiagnosticMark CRUD (`createMark` / `updateMark` / `deleteMark` / `swapMarkOrder`). All gated by `requireAdminSession()`. Coords clamped to 0..1, radius to 0.01..0.5. Cross-species mark assignment is rejected. `swapMarkOrder` runs in a Prisma transaction so the order list can't end up with duplicates mid-swap. |
| `.github/workflows/bootstrap-image-cache.yml` | One-click GitHub Actions workflow that runs `prisma db push` + populates the cache; requires `POSTGRES_PRISMA_URL` + `POSTGRES_URL_NON_POOLING` repo secrets |
| `public/sw.js` | Service worker (network-first; only caches app-shell icons) |

## Video / Codec Notes (IMPORTANT)

All snippet videos must be **H.264 (avc1)** — Chrome cannot play MPEG-4 Part 2 Visual (mp4v/mpeg4). This was the root cause of videos not playing on the live site.

- As of May 2026: all 30 clips are H.264 (`?v=3` cache-busting on re-uploaded clips)
- 23 clips were already H.264 from the original seed
- 7 clips (the 2020 footage and one SC14 manual track) were mp4v and have been re-encoded
- If adding new clips, always ensure H.264 encoding. Use:
  ```
  ffmpeg -i input.mp4 -c:v libx264 -crf 22 -preset medium -profile:v high -level 4.0 -c:a aac -b:a 128k -movflags faststart output.mp4
  ```
- To re-transcode the DB, run: `npx tsx --env-file=.env.local scripts/transcode-to-h264.ts`

## Storage provider

The Next.js runtime treats `Snippet.videoUrl` and `Snippet.thumbnailUrl` as opaque public URLs — it never imports the storage SDK. Only the seed and migration scripts upload, and they use the abstraction in `scripts/lib/storage.ts` to pick a provider.

Two providers are supported:

| Provider | Egress fees | Storage | Notes |
|---|---|---|---|
| `supabase` (default) | $0.09/GB on Pro after 5GB free | $25/mo Pro for >1GB | Where snippets live today. Simple. Egress is the surprise line at scale. |
| `r2` | **$0 forever** | 10GB free, then $0.015/GB | S3-compatible. Recommended once seed grows past ~5GB egress/mo (≈10 active users at 5min/day). |

Select with `STORAGE_PROVIDER=r2` or `STORAGE_PROVIDER=supabase` (omit env var to default to supabase, no behaviour change).

### Cloudflare R2 setup (one-time)

1. **Provision the bucket.**
   - Cloudflare dashboard → R2 → Create bucket → name it e.g. `fishspotter-snippets`.
   - Settings → Public Access → enable. Either use the auto-generated `https://pub-<hash>.r2.dev` URL or attach a custom domain (e.g. `snippets.fish-spotter.com`).
2. **Create an API token.**
   - Cloudflare dashboard → R2 → Manage R2 API Tokens → Create API token.
   - Permission: **Object Read & Write**. Scope to the new bucket.
   - Copy the Access Key ID and Secret Access Key (shown once).
3. **Add env vars** to `.env.local` and to Vercel (Production + Preview):
   ```
   STORAGE_PROVIDER=r2
   R2_ACCOUNT_ID=<your Cloudflare account id, top-right of dashboard>
   R2_ACCESS_KEY_ID=<from step 2>
   R2_SECRET_ACCESS_KEY=<from step 2>
   R2_BUCKET_NAME=fishspotter-snippets
   R2_PUBLIC_URL=https://pub-<hash>.r2.dev    # or your custom domain, no trailing slash
   ```
4. **Run the migration** (copies existing snippets from Supabase → R2 and updates DB URLs):
   ```
   npm run db:migrate-to-r2 -- --dry-run     # preview what will move
   npm run db:migrate-to-r2 -- --limit 3     # spot-check on 3 clips first
   npm run db:migrate-to-r2                  # full migration (idempotent)
   ```
5. **Verify**: load any snippet on fish-spotter.vercel.app, confirm the video URL in the page source points at R2 (`pub-*.r2.dev` or your custom domain). The codec guard (`npm run check:codecs`) probes URLs regardless of host, so the H.264 invariant is preserved.
6. **Drop the Supabase objects** only after a few days of production traffic confirm R2 is serving. The Snippet rows now point at R2; the Supabase objects are dead weight but harmless until removed via the Supabase dashboard.

The migration is idempotent: re-running skips any row whose URL already lives under `R2_PUBLIC_URL`. Use `--force` to re-upload anyway.

## Design Tokens (CSS vars)

| Token | Value | Use |
|-------|-------|-----|
| `--foreground` | `#17252A` | Body text, headings |
| `--primary` | `#3AAFA9` | Buttons, accents |
| `--surface` | `#FFFFFF` | Card backgrounds |
| `--surface-muted` | `#DEF2F1` | Subtle bg, table rows |
| `--muted` | `#2B7A78` | Secondary text |
| `--border` | `rgba(...)` | Borders |

Custom CSS classes: `pebl-surface`, `pebl-eyebrow`, `pebl-button-secondary`

## Database

Run scripts with: `npx tsx --env-file=.env.local scripts/<script>.ts`

Seed: `npm run db:seed`

Schema summary:
- `Snippet`: id, externalId (folder name), videoUrl, thumbnailUrl, site, deployment, depthM, lat, lon, recordingDatetime, **`staffAnswer: String?`** (nullable since S7-T1 — null means "no reference identification yet"), bboxJson
- `Answer`: userId, snippetId, chosenOption, **`isCorrect: Boolean?`** (null when the snippet has no reference yet), **`points: Int`** (S7-T1; 2 = correct match against reference, 1 = pending bonus on a no-reference snippet, 0 = unmatched guess)
- `User`: id, email, displayName, name
- `SpeciesProbability`: cached OBIS species composition per (lat₀.₁°, lon₀.₁°, depth₁₀m, month) bucket
- `SpeciesNameMap`: cached GBIF resolution of `staffAnswer` → canonical scientific name (only resolved when `staffAnswer` is non-null)
- `SpeciesImage`: cached iNaturalist photo rows keyed on (scientificName, sourceUrl); columns for lifeStage / sex / license / attribution / ordering / curated flag. Manual `overrides` from `src/data/species-images.json` are upserted with `curated=true` and never overwritten by the script.
- `DiagnosticMark` (S9-T1): admin-authored labelled rings on a `SpeciesImage`. Columns: `scientificName`, `speciesImageId` (FK), `order`, `label`, `description`, `overlayX`/`overlayY` (normalised 0..1), `overlayRadius` (normalised to `min(width, height)` so rings stay circular across aspect ratios), `createdBy` (admin email for audit). Indexed on `(scientificName, order)` and `(speciesImageId)`. A species counts as "published" by the wizard once it has >=1 mark; no separate status flag.

## Scoring model (S7-T1, 27 May 2026)

The leaderboard ranks spotters by sum of `Answer.points`, not by raw
correct count. The per-row payout is set by `matchAnswer()` in
`src/lib/answer-matching.ts`:

| Verdict | `isCorrect` | `points` | When |
|---|---|---|---|
| Correct against reference | `true` | `POINTS_CORRECT_REF = 2` | Snippet has a `staffAnswer` and the user's pick matches it (alias-aware) |
| Pending (bonus) | `null` | `POINTS_PENDING_REF = 1` | Snippet has no reference yet — the user's submission is treated as a community hypothesis and earns a flat participation bonus |
| Incorrect | `false` | `POINTS_INCORRECT = 0` | Snippet has a reference but the user's pick didn't match |

`POINTS_PENDING_REF < POINTS_CORRECT_REF` is enforced by a test
(`answer-matching.test.ts`) so spam-guessing un-referenced clips can't
out-yield identifying referenced ones.

Phase 2 (consensus retro-bonus, deferred):
- When K ≥ 3 independent users converge on the same name for a
  no-reference snippet, a background job will retro-credit each matcher
  with `POINTS_CONSENSUS_BONUS` (e.g. +2), making the total payout for
  a consensus-pioneer (1 + 2 = 3) exceed a referenced correct (2).
- No further schema migration is needed — the column shape already
  supports any future top-up by mutating `Answer.points` in place.

Operator note: when a no-reference snippet later gets a reference
backfilled into `Snippet.staffAnswer`, the existing pending `Answer`
rows DO NOT auto-rescore. A retro-scoring SQL would look like:

```sql
UPDATE "Answer" a
SET "isCorrect" = lower(a."chosenOption") = lower($1),
    "points"    = CASE WHEN lower(a."chosenOption") = lower($1) THEN 2 ELSE 0 END
WHERE a."snippetId" = $2 AND a."isCorrect" IS NULL;
```

(Use the matcher's alias-aware logic in code, not raw `lower()`, for a
production retro-score.)

## Probability data flow (OBIS + GBIF)

The fish-probability feature reads from two external APIs at backfill time
**only** — never during user requests. The user-facing API routes read the
cached rows from Postgres.

### Sources

| API | What we ask | Where it lands |
|---|---|---|
| OBIS `api.obis.org/v3` | `/taxon/Chondrichthyes` + `/taxon/Actinopterygii` (resolve AphiaIDs once); `/occurrence` paginated per bucket, multi-year (16y), month ± 1 | `SpeciesProbability` |
| iNaturalist `api.inaturalist.org/v1` | `/observations?taxon_name=<sci>&photo_license=cc0,cc-by,cc-by-sa,cc-by-nc&quality_grade=research&order_by=votes`, with optional life-stage / sex annotation filter per species | `SpeciesImage` |
| GBIF `api.gbif.org/v1` | `/species/match?name=<staffAnswer>&verbose=false`, use `canonicalName` to avoid authorship suffix | `SpeciesNameMap` |

### Operational scripts

| Command | Purpose | When |
|---|---|---|
| `npm run db:check-apis` | 5 probes: OBIS reachable, AphiaIDs resolve, `/occurrence` schema sane, GBIF canonical name, DB connected | Before any backfill; after every env/deploy change |
| `npm run db:backfill` | Fill missing/errored buckets + resolve missing common names | After seeding new snippets |
| `npm run db:backfill -- --stale-only` | Only refresh buckets whose `staleAfter` has passed | Same logic the cron uses; safe to run manually |
| `npm run db:backfill -- --limit 5` | Cap buckets touched | Spot-check after a code change |
| `npm run db:refresh-images` | Refresh SpeciesImage rows for all 26 catalogue species from iNat (priority species get male/female/juvenile/egg buckets per the manifest) | After editing `src/data/species-images.json` |
| `npm run db:refresh-images -- --species "Labrus mixtus"` | Refresh one species only | Spot-check a manifest tweak |

Shared implementations:
- Probabilities + name-map → `src/lib/biodiversity/refresh.ts` (used by `db:backfill` and the probabilities cron).
- Species images → `src/lib/biodiversity/refresh-images.ts` (used by `db:refresh-images` and the images cron).

### Automated refresh

`vercel.json` registers two weekly crons. Both guarded by
`Authorization: Bearer ${CRON_SECRET}`.

| Path | Schedule | What it does |
|---|---|---|
| `/api/cron/refresh-probabilities` | `0 6 * * 1` (Mon 06:00 UTC) | Tops up OBIS probability buckets + GBIF name resolution. Cap: 20 buckets/run. |
| `/api/cron/refresh-images` | `0 6 * * 2` (Tue 06:00 UTC) | Refreshes iNat photo cache for species whose oldest row is >7 days old. Cap: 12 species / 50s budget per run. |

For first-time population of the image cache (the weekly cron only refreshes
stale rows), trigger a manual run with `?force=1`:

```
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://fish-spotter.vercel.app/api/cron/refresh-images?force=1
```

Each call processes up to 12 species; for the full 26 species, hit the
endpoint 2-3 times in a row (rows are idempotent upserts).

Probability cache TTL is 90 days, so weekly cron keeps every bucket
comfortably fresh.

Required env var: **`CRON_SECRET`** — any long random string; set in Vercel
project settings under the production environment.

### Failure modes

- **OBIS 429 / 5xx** — `refresh.ts` retries 3× with exponential backoff; persistent failure persists an `ERROR` row and continues.
- **OBIS schema drift** — `check-apis.ts` probe C catches missing `species` / `scientificName` / `id` keys before they corrupt the cache.
- **GBIF unresolved name** — stored with `scientificName=null`; the probability route falls back to `staffAnswerScientific=null` and the UI hides the staff-answer badge.
- **Cron auth fail** — returns 401; check `CRON_SECRET` is set in Vercel production env.

## Current State (May 2026)

- Video playback is working on fish-spotter.vercel.app after H.264 transcode fix
- Feed, browse archive, leaderboard pages all working
- Species quiz with community stats working
- BBox tracking overlay (Catmull-Rom smooth trail) working
- Debug strip has been removed (was temporary diagnostic tool)
- Species image gallery feature **activated 18 May 2026** — `SpeciesImage` table populated (113 rows across 26 species), `CRON_SECRET` set in Vercel, weekly cron live.
- Bootstrap kit **shipped 22 May 2026** (`26bbf10`) — one-command operator setup for all infra tokens, env vars, DNS, R2, Resend. See `scripts/bootstrap/README.md`.
- Resend email domain `pebl-cic.co.uk` **registered and DNS live 26 May 2026** — DKIM + SPF records added to Wix DNS; domain status `pending` (sending already enabled). Run `npm run bootstrap -- --doctor` to check verification status.
- **S3-01 schema drift fixed 27 May 2026** — `prisma db push` applied the auth-lifecycle columns + tables (`User.emailVerified`, `Account`, `Session`, `VerificationToken`, `PasswordResetToken`) that had been merged in code but never pushed to prod. Backfilled existing users with `emailVerified = createdAt`. Forgot-password + the rest of the S3 flows are now functional in prod.
- **S7-T1 shipped 27 May 2026** — nullable references + points-based scoring + contrast pass. See "Scoring model" section above. UI copy across the onboarding tour, landing page, reveal panel, and rarity panel retired the "PEBL staff" branding in favour of "reference ID (when available)" — references can come from PEBL, academic partners, fisheries bodies, or be temporarily absent. The reveal pills (Correct/Wrong/Pending) are solid-bg + dark text so they read against any video background.
- **S7-T3 (IdGuide sheet expansion, 27 May 2026)** — the "How to spot a X next time" / wizard / chat sheet now opens at `96vw × 94vh` (capped at `max-w-7xl` / 1280px) instead of the previous `max-w-2xl × 88vh`. Two-column desktop layout on the field-note view (gallery left, prose + traits right) so the extra real estate gets used; mobile layout unchanged.
- **S8-T1 (per-user random feed ordering, 27 May 2026)** — `/feed` no longer shows everyone the same reverse-chronological list. The default card is now the first **unanswered** snippet for the viewer, with the rest of the list shuffled deterministically.
  - **Signed-in:** shuffle seed = `session.user.id`, so each user has their own stable order. Reload = same first card until they answer something.
  - **Anonymous:** shuffle seed = `fs.anon_seed` cookie minted by `src/middleware.ts` on first hit to `/` or `/feed/*`. Stable per browser, fresh per browser.
  - **Exhausted feed:** once a user has answered everything, the answered snippets remain visible at the back of the shuffle so they can scroll back / edit.
  - Pure ordering logic in `src/lib/feed-ordering.ts` + `src/lib/shuffle.ts` (PRNG lifted out of `candidates.ts` and shared). 8 unit tests in `feed-ordering.test.ts`.
  - **Optimistic move-to-back on submit deferred** — current behaviour: a card answered mid-session stays in its scroll position; reload re-evaluates and pushes it to the answered tail. Wire client-side reorder if user testing surfaces it as a pain point.
- **S9-T1 (admin-authored diagnostic marks, 27 May 2026)** — turns the existing `IdGuideWizard` from a guessing aid into a teaching tool. Admins (`@pebl-cic.co.uk` email suffix) can author "diagnostic marks" via a new `/admin` interface; those marks render as numbered SVG rings on a reference photo in the wizard's final reveal so a spotter sees exactly *where* on the fish to look for the chin barbel / pectoral spot / projecting jaw / etc.
  - **DiagnosticMark schema** (`prisma/schema.prisma`): one row per labelled ring. Normalised (0..1) `overlayX` / `overlayY` and `overlayRadius` (radius is fraction of `min(width, height)` so rings stay circular across aspect ratios). FK to `SpeciesImage`. `createdBy` audit field. No separate status flag — a species counts as published once it has >=1 mark.
  - **Admin gate** (`src/lib/admin.ts`): suffix check on `@pebl-cic.co.uk`, derived from a one-shot DB lookup so the JWT token surface stays unchanged. `requireAdminSession()` redirects non-admins to `/`. Admin routes carry `robots: noindex` via `src/app/admin/layout.tsx`.
  - **/admin/species** list (`src/app/admin/species/page.tsx`): all 26 catalogue species, joined with mark-count from a `groupBy(scientificName)`. Pilot gadoids pinned at top with a "Pilot" badge. Pilot is **3 species** (pollack, bib, cod); whiting and haddock were in the original spec but are not in the trait catalogue, so they were dropped from PILOT per Q3A-T3 to match reality. Status pill: Not started (0) / In progress (1-2) / Published (>=3).
  - **Authoring UI** (`src/app/admin/species/[name]/SpeciesAnnotator.tsx`): img + absolute SVG overlay. Click empty space to drop a mark with default 6% radius. Click a ring to select; drag body to move, drag corner handle to resize. Sidebar shows ordered list with up/down reorder arrows, plus a label (60 char) + description (280 char) editor that saves on blur. Optimistic local updates; server actions persist behind `useTransition` so the UI stays responsive.
  - **Server actions** (`src/app/admin/species/[name]/actions.ts`): `createMark` / `updateMark` / `deleteMark` / `swapMarkOrder`. All gated by `requireAdminSession()`. Coords clamped to 0..1 and radius to 0.01..0.5 before persisting. `createMark` verifies the `speciesImageId` belongs to the species being edited (no cross-species mark assignment via tampered IDs). `swapMarkOrder` runs in a Prisma transaction so the list can't end up with duplicate `order` values mid-swap.
  - **Wizard integration** (`src/components/AnnotatedSpeciesPhoto.tsx` + `IdGuideWizard.tsx`): the species-images API now includes `marks` per photo (Prisma `include`, no new round-trip). `AnnotatedSpeciesPhoto` renders the first photo with marks as numbered rings + a legend listing label + description. Returns null when no marks exist, so the existing thumb-strip + field-note path keeps working for the unauthored long tail.
  - **"Why ask this?" hints**: each `STEPS` entry in `IdGuideWizard.tsx` now carries a `whyHint` surfaced behind a small disclosure under the question. Explains the marine biologist's rationale at each rung — body shape locks family, size eliminates lookalikes, habitat is often as diagnostic as morphology, single marks settle three-way ambiguity, behaviour is the clincher.
  - **Authoring is the bottleneck, not the build** — the framework + admin UI ship in this release but mark content is editorial work in `/admin/species`, no further deploys required. Author the remaining gadoid pilot (bib, pollack, cod, haddock) first, then expand to the wider catalogue.
- **S9-T1 follow-up (27 May 2026, evening session)**: fins/tail wizard step, image preload hardening, and the gadoid pilot is partially seeded.
  - **IdGuideWizard Stage 2 (fins/tail)**: new step inserted between `size` and `habitat` in `src/components/IdGuideWizard.tsx`. Asks about dorsal layout and tail shape with four options (split-dorsal, single-dorsal, forked-tail, rounded-tail). `lyre-shaped` and `long-anal` from `FIN_SHAPE` stay in the predicate engine but are not surfaced as wizard options (too niche for citizen-science phrasing). Carries the same "Why ask this?" disclosure pattern as the other steps. Note: whiting (`Merlangius merlangus`) and haddock (`Melanogrammus aeglefinus`) are listed in the pilot in `/admin/species/page.tsx` but are NOT in the 26-species `src/data/species-traits.json` catalogue, so the pilot effectively reduces to 3 species (pollack, bib, cod).
  - **MCQ candidate picker preload** (`src/components/MCQCandidatePicker.tsx`): after the `/api/snippets/[id]/quiz` fetch resolves, the picker now warms every thumbnail via `new Image()` and only flips to `ready` once all have loaded (capped at 1500ms so a dead URL can't stall). `<img>` switched from `loading="lazy"` to `loading="eager"` + `decoding="async"`. Candidates with no `thumbUrl` (typically the staff slot when a species like jellyfish has no `SpeciesImage` row cached) now render a fish silhouette placeholder instead of an empty grey box.
  - **Feed UX polish** (`src/components/FeedCard.tsx`): the bottom-gradient overlay that darkens the lower video to make the panel readable now only renders on mobile, where the panel is bottom-anchored. On desktop the panel sits mid-screen so the gradient was just obscuring the seabed. The minimize affordance on the open panel changed from a 7x7 ghost chevron to a labelled "Hide" pill (icon + text on >=sm) at higher opacity so users can actually find it. Added an `H` keyboard shortcut to toggle the panel from anywhere on the active card (skipped when focus is in an input). Tooltip + aria-label on the collapsed pill hint at the shortcut.
  - **Gadoid pilot status**: 3 pollack marks live in prod DB and rendering via `AnnotatedSpeciesPhoto`. Bib and cod marks were seeded but the cached iNat reference photos are unsuitable for teaching (bib is a mixed school of ~7-8 fish; cod is a dead beach-cast specimen with no live ID features). Seed marks for both species deleted via `scripts/adjust-gadoid-marks.ts`. To author bib and cod, curate a clean single-specimen lateral photo for each, add an entry to the `overrides` block in `src/data/species-images.json`, run `npm run db:refresh-images -- --species "Trisopterus luscus"` (and again for `Gadus morhua`), then re-run `npm run db:seed-gadoid-marks`.
  - **Photo-curation gap surfaced**: iNat's "research grade" filter sorts by community species-ID agreement, not by photo composition. Useful for OBIS but not for ID teaching. The `curated=true` flag in the existing `species-images.json` manifest is the escape hatch. Recommendation for future authoring passes: vet primary reference photos manually before running the seed script.
  - **Post-push smoke checklist**: run `implementation/2026-05-27/smoke-checklist.md` after any push that touches feed, wizard or picker code. Takes ~60 seconds and catches the obvious regressions (broken H toggle, missing wizard step, stuck candidate fetch).
- **Q3A-T4 (photo-quality gate, 27 May 2026, evening)**: diagnostic marks now only render on `SpeciesImage` rows with `curated = true`. Three enforcement points:
  - `/api/species-images/[scientificName]` strips marks from non-curated photos before responding.
  - `createMark` server action throws if the target photo is non-curated. The admin UI surfaces this proactively: species with photos cached but none curated get an amber notice + curation instructions instead of the annotator.
  - Migration: `scripts/migrate-curated-flag.ts` (run via `npm run db:migrate-curated-flag`) flips any photo that already hosts authored marks to `curated = true`. Run once on 27 May; flipped 1 photo (pollack's iNat reference) so the existing 3 marks didn't go dark when the gate shipped. Idempotent.
  - Net effect: iNat photos can't be silently promoted to "this is the canonical reference for teaching" just because they were the first thing the cron fetched. Add to `src/data/species-images.json` overrides (with `curated: true`) and re-run `db:refresh-images` before authoring marks.

## Activation history — 18 May 2026

Species image gallery shipped across commits `5c38274` → `1958d35` → `0760106` → `2ec503b` → `cf2187c`.

Activation steps performed on 18 May:
1. Backed up the 4 stale taxonomy tables + 3 columns being dropped by the schema change (`Taxon`, `TaxonAlias`, `TaxonAttribute`, `BiogeographicChecklist`, `Answer.pointsAwarded`, `Snippet.labelStatus`, `Snippet.staffTaxonId`) → JSON dumps in `backups/` (gitignored). Script: `scripts/backup-pre-drop.ts`.
2. `npx prisma db push --accept-data-loss` — synced schema, added `SpeciesImage`.
3. `npm run db:refresh-images` — 26 species processed, **113 rows upserted, 0 errors**, 2 empty buckets (plaice larva, catshark egg case — expected).
4. `CRON_SECRET` added to Vercel (Production + Preview, sensitive) and redeployed.
5. Verified live: `https://fish-spotter.vercel.app/api/species-images/Symphodus%20melops` returns 5 photos; DOM contains 5 `<img>` tags with CC-attributed iNat URLs on the candidate-reveal card.

### Deferred to v2 (not blocking)
- Wikimedia Commons fallback for species iNat returns thin photos for (mainly larval plaice).
- Manual `overrides` in `species-images.json` — currently empty; can be populated editorially.
- `IntersectionObserver`-staggered fetches on the candidate grid (likely premature — typical narrow returns 3–5 candidates).
- Retry-on-429 in the iNat client.

## Env vars (.env.local)

```
POSTGRES_PRISMA_URL=...         # pooled connection
POSTGRES_URL_NON_POOLING=...    # direct connection for migrations
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=...
NEXT_PUBLIC_SUPABASE_URL=https://aazxphcrexkggbmmceli.supabase.co
SUPABASE_URL=https://aazxphcrexkggbmmceli.supabase.co
SUPABASE_STORAGE_BUCKET=snippets
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...             # ID-guide chat (server-side only)
ANTHROPIC_MODEL=claude-sonnet-4-6 # optional override
CRON_SECRET=...                   # required in production for /api/cron/*

# Storage provider (see "Storage provider" section above)
STORAGE_PROVIDER=supabase         # "r2" or "supabase" (default)
R2_ACCOUNT_ID=...                 # only required when STORAGE_PROVIDER=r2
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=fishspotter-snippets
R2_PUBLIC_URL=https://pub-<hash>.r2.dev   # or a custom domain
```
