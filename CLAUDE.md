# CLAUDE.md — FishSpotter project brief

> Quick context for future Claude sessions in this repo. Read this file first.

## What this is

**PEBL FishSpotter** — a mobile-first web app where users watch short underwater clips from PEBL's *Algapelago* deployment (Bideford Bay, North Devon, UK) and guess the creature. Engagement-led marine biodiversity outreach + crowd-graded labelling.

- Stack: **Next.js 14** (App Router) · React 18 · TypeScript · Tailwind · **Prisma → Supabase Postgres** · NextAuth credentials · Supabase Storage · PWA · Framer Motion
- Local: `npm run dev` → **http://localhost:3000** (port 3000 is hard-coded into NextAuth callback URLs; don't change without updating `.env.local`)

## Audience (not Algarve!)

> **All footage is from Bideford Bay, North Devon, UK** — *not* the Algarve, despite the `ALG_…` filename prefix (which is short for **Algapelago**, PEBL's deployment name). The audience is North Devon coastal communities: pot fishermen, sailors, surfers, divers, schools.
>
> Vernacular is **British coastal English** (whiting, pouting, scad, lemon sole, spider crab) — *not* Portuguese.

## Architecture in one diagram

```
            ┌──────────────────────────┐
            │  Supabase Postgres       │
            │  ─ Taxon, TaxonAlias     │
            │  ─ TaxonAttribute        │
            │  ─ Snippet (+ bboxJson)  │
            │  ─ Answer, User          │
            │  ─ BiogeographicChecklist│ ← cached OBIS data
            └──────────────────────────┘
                       ▲
                       │  Prisma
            ┌──────────┴────────────────────────┐
            │  Next.js app                      │
            │  ┌─────────────────────────────┐  │
            │  │ /api/answers   /api/snippets│  │
            │  │ /api/id-guide/match         │  │
            │  │ /api/me/taxa  /api/taxon/[id]│  │
            │  └─────────────────────────────┘  │
            │  ┌─────────────────────────────┐  │
            │  │ /feed (vertical-scroll TikTok│  │
            │  │   FeedCard + TaxonRevealPanel│  │
            │  │   + IdGuideSheet            │  │
            │  │ /me/taxa  (life list)       │  │
            │  │ /taxon/[id]                 │  │
            │  └─────────────────────────────┘  │
            └───────────────────────────────────┘
                       │
                       ▼
            ┌──────────────────────────┐
            │  Supabase Storage        │  ← (currently /public/media/snippets)
            │   snippets/*.mp4, *.jpg  │
            └──────────────────────────┘
```

## What's shipped (current state)

**Lean Phase 1** — taxon model, alias matcher, two-state clip system (🟢 Verified / 🟠 Help us ID), reveal panel with 3 states, life list, simple 10/1/5 scoring, place context, Leaflet map per clip, bbox dot-and-trace tracker with toggle, answer correction.

**Phase 2 (ID Guide)** — Days 1–3 done:
- Day 1: schema (`TaxonAttribute`), question config, `/api/id-guide/match` with scoring
- Day 2: question funnel UI (`IdGuideSheet`, 5 components), wired into FeedCard + SnippetPlayer
- Day 3: smart pre-fill from bbox path (`deriveIdGuidePrefill`) — Q2 + Q3 auto-suggested

**Phase B (Biogeographic prior)** — done:
- OBIS client (`src/lib/obis.ts`), `BiogeographicChecklist` cache table, refresh script, prior in matcher, `localStatus` labels (*common / occasional / rare for this site*) on candidate cards

**Auto-ingest pipeline** — done:
- `scripts/ingest-from-drive.mjs --storage` reads PEBL's Drive folder, uploads to Supabase Storage, upserts DB rows
- `force-dynamic` patch applied to mgtaco baseline so Vercel reflects DB writes within seconds (no redeploy)
- All 30 clips migrated from `/public/media` to Supabase Storage. **One-command daily workflow.**

**Public deployment** — live:
- **https://fish-spotter.vercel.app** (mgtaco baseline + force-dynamic + Storage migration)
- Auto-deploys from `christian-pebl/FishSpotter:main` on push
- Shares the Supabase DB with localhost dev (any DB write is visible everywhere within seconds)

## How to run things

```bash
# Dev
npm run dev                          # → http://localhost:3000

# Tests (95 currently passing: 53 unit + 42 E2E)
npm test                             # both
npm run test:unit                    # vitest, ~500ms
npm run test:e2e                     # playwright, ~2 min
PW_REUSE=1 npm run test:e2e          # if dev server already running

# Database
npx prisma db push                   # push schema changes
npx prisma studio                    # GUI

# ★ Daily ingest — auto-syncs all 3 deployments (see docs/operational-runbook.md)
node scripts/ingest-from-drive.mjs --storage

# Less-frequent data scripts (idempotent; see scripts/README.md for order)
node scripts/seed-taxa.mjs                     # Taxon + TaxonAlias from data/species-master.json
node scripts/seed-taxon-attributes.mjs         # hand-curated body shape, locomotion, etc.
node scripts/link-clips-to-taxa.mjs            # Snippet.staffTaxonId from clip-matches.json
node scripts/cleanup-taxa.mjs                  # one-shot rename/dedupe (already run)
node scripts/refresh-biogeographic-cache.mjs   # OBIS prior, weekly
```

## Where things live

| | Path |
|---|---|
| Project brief (this file) | `CLAUDE.md` |
| Human-facing readme | `README.md` |
| Strategy + plans | `docs/` (see `docs/README.md` for index) |
| Data scripts | `scripts/` (see `scripts/README.md` for order) |
| Raw data inputs | `data/species-master.json`, `data/clip-matches.json` |
| Test suites | `tests/unit/` (Vitest), `tests/e2e/` (Playwright) |
| Test plan for humans | `docs/app-test-run.md` |
| Question config | `src/lib/id-guide-questions.ts` |
| Match scoring | `src/app/api/id-guide/match/route.ts` |
| Bbox prefill heuristic | `src/lib/id-guide-prefill.ts` |
| OBIS client + prior | `src/lib/obis.ts`, `src/lib/biogeographic-prior.ts` |

## Conventions worth knowing

- **Idempotent scripts** — every script in `scripts/` can be re-run without breaking state.
- **Type-check before committing** — `npx tsc --noEmit` is fast and catches regressions across the FeedCard/Quiz/Reveal triangle.
- **Test after each step** — `npm run test:unit` is ~500ms; run it after any logic change.
- **E2E tests start their own dev server** unless `PW_REUSE=1` is set; otherwise port conflicts.
- **The Drive path** — clip metadata + raw CSVs live at:
  `G:\.shortcut-targets-by-id\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\Ocean\08 - Data\01 - SubCam data\`
  Scripts in `scripts/` that pull from Drive use a hard-coded absolute path.
- **Tracker overlay toggle** localStorage key: `fishspotter:trackingOn` (`"1"` | `"0"`). Cross-card synced via `CustomEvent("fishspotter:trackingChanged")`.

## Deferred work (in priority order)

These are explicitly **not built** yet and ready to pick up:

1. **Phase C — WoRMS vernacular + Wikipedia hero photos** for individual species (the only thing that makes taxon pages feel *finished*). ~2 days.
2. **Seasonal OBIS buckets** — schema supports it, one-liner: `node scripts/refresh-biogeographic-cache.mjs --seasonal`.
3. **CI workflow (GitHub Actions)** to run the test suite on PR.
4. **Hands-on test pass** through `docs/app-test-run.md`.
5. **First-spotter mechanic**, comments per clip, deployment map (all from `docs/engagement-strategy.md` Phase 2).

## Open ⚠️ items flagged for PEBL review

- **Trisopterus luscus** (renamed from typo *iuscus*). Confirm correct.
- **Cyanea capillata** (renamed from typo *capitata*). Confirm correct.
- **Scyliorhinus canicula** display name updated to *Small-spotted Catshark* (was the confused "Nursehound/catshark"). Confirm.
- **Paralichthys dentatus** was a US species mistake — removed; Platichthys flesus is the European flounder.
- See `scripts/cleanup-taxa.mjs` for the full change log.

## Why each unusual choice was made

- **Lean Phase 1 over full plan** — get to user feedback in 1 week, not 3. Every cut feature is additive later. See `docs/phase-1-species-pages.md` §9.
- **Two-state clips (Verified / Help-us-ID), not three** — `COMMUNITY_GRADED` deferred; needs user volume that doesn't exist yet.
- **5 / 10 / 1 scoring, no retroactive** — three numbers vs five plus retroactive math. Simpler is better at this stage.
- **OBIS over GBIF** — marine-purpose-built, `/checklist` endpoint is exactly what we need.
- **Tracker as suggestion, not assistant** — pure visual aid, no auto-classify. Manual ID is the educational point.
