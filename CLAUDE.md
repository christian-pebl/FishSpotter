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
| `src/lib/biodiversity/refresh.ts` | Shared library for the OBIS/GBIF probability + name-map refresh (used by `db:backfill` and the probabilities cron) |
| `src/lib/biodiversity/refresh-images.ts` | Shared library for the iNat photo refresh (used by `db:refresh-images` and the images cron) |
| `src/lib/biodiversity/inaturalist.ts` | iNaturalist v1 API client (CC-licensed photo fetch with optional life-stage / sex annotation filters) |
| `src/components/SpeciesGallery.tsx` | Photo strip + lightbox for candidate cards and field-note view (portaled, focus-trapped, CC-attributed) |
| `src/data/species-images.json` | Per-species fetch manifest: which life-stage / sex buckets to request, plus optional pinned `overrides` |
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
- `Snippet`: id, externalId (folder name), videoUrl, thumbnailUrl, site, deployment, depthM, lat, lon, recordingDatetime, staffAnswer, bboxJson
- `Answer`: userId, snippetId, chosenOption, isCorrect
- `User`: id, email, displayName, name
- `SpeciesProbability`: cached OBIS species composition per (lat₀.₁°, lon₀.₁°, depth₁₀m, month) bucket
- `SpeciesNameMap`: cached GBIF resolution of `staffAnswer` → canonical scientific name
- `SpeciesImage`: cached iNaturalist photo rows keyed on (scientificName, sourceUrl); columns for lifeStage / sex / license / attribution / ordering / curated flag. Manual `overrides` from `src/data/species-images.json` are upserted with `curated=true` and never overwritten by the script.

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
