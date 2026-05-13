# PEBL FishSpotter

A mobile-first web app where you watch short underwater clips from PEBL's *Algapelago* deployment (Bideford Bay, North Devon, UK), guess the creature, build a streak, and contribute to community-graded marine biodiversity data.

**Stack:** Next.js 14 (App Router) · React 18 · TypeScript · Tailwind · Prisma → Supabase Postgres · NextAuth · Supabase Storage · PWA · Framer Motion · Leaflet.

> **For contributors / future agents:** start with [CLAUDE.md](CLAUDE.md). It has the architecture, where things live, conventions, and the deferred punch list.
>
> **For product context:** see [docs/](docs/) — strategy, phase plans, manual test scripts.

---

## Local setup

```bash
# 1. Install
npm install

# 2. Set up env
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, POSTGRES_PRISMA_URL,
# POSTGRES_URL_NON_POOLING, NEXTAUTH_SECRET, NEXTAUTH_URL=http://localhost:3000

# 3. Push schema to Supabase Postgres
npx prisma db push

# 4. First-time data seed — see scripts/README.md for the full chain
node scripts/seed-local.mjs                    # Snippet rows from public/media/snippets/
node scripts/enrich-snippets-from-drive.mjs    # site/depth/lat/lon/bbox from Drive metadata
node scripts/seed-taxa.mjs                     # Taxon + TaxonAlias
node scripts/seed-taxon-attributes.mjs         # ID-guide attributes
node scripts/link-clips-to-taxa.mjs            # Snippet.staffTaxonId
node scripts/refresh-biogeographic-cache.mjs   # OBIS prior data

# 5. Run dev
npm run dev   # → http://localhost:3000
```

---

## What you can do today

- 🐟 **Watch underwater clips** in a TikTok-style vertical scroll feed with a Leaflet pin for each clip's location at Bideford Bay
- 🎯 **Type a species name** to guess (with fuzzy "Did you mean?" suggestions, vernacular aliases, and answer correction)
- 🤔 **Help me figure it out** — open the **ID Guide** modal: 3-5 big-button questions about the creature's group, movement, position, shape, and colour, with locomotion/position **auto-pre-filled from the bbox track**, ranked candidates labelled *Common at this site* / *Occasional locally* / *Rare for this site* (from cached OBIS data)
- 🟢🟠 **Verified vs Help-us-ID clips** — earn points either way; help-us-ID contributions feed community grading
- ⭐ **Build a streak** + climb the leaderboard
- 🐚 **Life list** at `/me/taxa` — Pokédex of taxa you've spotted or helped ID, with taxon detail pages
- 👁 **Subtle tracker overlay** with toggle — a small dot + trace shows where the creature is in frame

---

## Testing

```bash
npm test                     # unit + E2E (currently 95 passing — see docs/test-snapshot.md)
npm run test:unit            # vitest, ~500ms
npm run test:e2e             # playwright chromium, ~2 min
PW_REUSE=1 npm run test:e2e  # if dev server already running on :3000
npm run test:e2e:ui          # Playwright UI for debugging
npm run test:e2e:headed      # visible browser
```

Tests live in `tests/unit/` (Vitest) and `tests/e2e/` (Playwright). The Playwright config auto-starts the dev server unless `PW_REUSE=1` is set.

---

## Documentation

| Path | What it is |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Project brief for future agent sessions |
| [`docs/README.md`](docs/README.md) | Index of strategy + plan docs |
| [`docs/engagement-strategy.md`](docs/engagement-strategy.md) | Audience, north-star principles, phased plan |
| [`docs/phase-1-species-pages.md`](docs/phase-1-species-pages.md) | Lean Phase 1 spec (shipped) |
| [`docs/id-guide-proposal.md`](docs/id-guide-proposal.md) | ID Guide research + design |
| [`docs/id-guide-implementation.md`](docs/id-guide-implementation.md) | ID Guide implementation plan |
| [`docs/app-test-run.md`](docs/app-test-run.md) | Manual hands-on test walkthrough |
| [`scripts/README.md`](scripts/README.md) | Data scripts runbook (order + idempotency) |

---

## Deploying to Vercel

1. Create a Supabase project + public storage bucket named `snippets`
2. Add env vars from `.env.example` to Vercel
3. Push to the repo connected to Vercel — `postinstall` runs `prisma generate` automatically
4. After first deploy: run the seed chain above against the production database

The PWA manifest, service worker, and install button are all wired — Chrome/Edge/Android show an install prompt; iOS uses Share → Add to Home Screen.

---

## Conventions

- **Idempotent scripts.** Every script in `scripts/` is safe to re-run.
- **Type-check before commit.** `npx tsc --noEmit` is fast and catches FeedCard/Quiz/Reveal regressions.
- **Place context is canonical.** All clips are from Bideford Bay, N. Devon, UK at 20m depth. The `ALG_…` filename prefix is short for **Algapelago** (PEBL's deployment name), *not* Algarve.

---

## License

Internal PEBL CIC project.
