# CLAUDE.md - FishSpotter Project Notes

## Project Overview

**FishSpotter** (fish-spotter.vercel.app) is a PEBL CIC marine monitoring web app built with Next.js 14 (App Router), Prisma, Supabase Storage, and NextAuth.

- Repo: https://github.com/christian-pebl/FishSpotter
- Live URL: **https://fish-spotter.vercel.app** (canonical — ignore fishspotter.vercel.app, different deployment)
- Local dev: `npm run dev` runs on **localhost:3000**
- Database: Supabase Postgres (project ID: `aazxphcrexkggbmmceli`, region: West EU / Ireland)
- Storage: Supabase Storage bucket `snippets` — public URLs at `https://aazxphcrexkggbmmceli.supabase.co/storage/v1/object/public/snippets/{externalId}/snippet.mp4`

### Docs

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — how the subsystems fit together (request path, data pipeline, the catalogue, the rung flow). Read this first when picking up cold.
- **[docs/runbooks/add-a-species.md](docs/runbooks/add-a-species.md)** — the step-by-step for onboarding a new species.
- **[docs/runbooks/add-a-rung-or-trait.md](docs/runbooks/add-a-rung-or-trait.md)** — adding a trait value or extending the "Spot It" funnel.
- **[docs/runbooks/migrate-to-species-table.md](docs/runbooks/migrate-to-species-table.md)** — planned canonical Species table migration (prod DB; not yet run).
- **[docs/CHANGELOG.md](docs/CHANGELOG.md)** — dated shipping history (moved out of this file).

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
| `scripts/seed-fish-marks.ts` | Bulk fish DiagnosticMark seeder (2 Jun 2026). Covers **21 fish species** across 4 batches: gadoids (Saithe, Bib/Pouting, Poor Cod, Atlantic Cod), wrasses (Ballan, Cuckoo, Corkwing, Goldsinny), gobies/benthic (Two-spotted Goby, Common Goby, Rock Goby, Sand Goby, Butterfish, Shanny, Long-spined Sea Scorpion), and pelagic/schooling (Horse Mackerel, Atlantic Mackerel, Sprat, Sand Smelt, Sea Bass, Thick-lipped Grey Mullet). Idempotent — skips species that already have marks. Requires a curated `SpeciesImage` row per species (add to `species-images.json` overrides + run `db:refresh-images --species` first). Run via `npx tsx --env-file=.env.local scripts/seed-fish-marks.ts`. |
| `scripts/audit-reference-ids.ts` | Q4-B1 diagnostic (read-only). Groups `Snippet.staffAnswer` by normalised label, joins SpeciesNameMap resolution, and proposes a per-label action: `keep` (species-level binomial), `backfill` (identifiable but coarse, needs a human binomial), `nullify` (indeterminate like "Fish"/"Crab" -> should become a no-reference snippet), `none` (already null). Run `npm run db:audit-references` (add `-- --json` for a machine dump). Never writes; the approved backfill/nullify + retro-score is a separate step. |
| `scripts/confusion-matrix.ts` | Q4-B3 diagnostic (read-only). Ranks `(reference, guessed-as)` pairs from incorrect Answers (`isCorrect=false`), grouped by the live matcher's normalise key, plus a most-confused-reference rollup. This is the authoring brief for mark expansion (where the wizard most needs a discriminating mark). Run `npm run db:confusion-matrix` (`-- --limit N`, `-- --json`). Note: junk references like "Fish"/"Crab" dominate until they're nullified via the audit above. |
| `src/lib/biodiversity/gemini-vision.ts` | **Gemini vision client (image quality tool).** Claude orchestrates; Gemini 3.5 Flash (override `GEMINI_MODEL`) does the actual vision. `assessImageQuality()` downloads a photo, sends it inline to Gemini with a strict JSON `responseSchema`, and returns a teaching-suitability assessment (subjectType, individualCount, condition, view, nonPhotographic, focus/lighting/framing/occlusion/diagnostic-feature scores 0..100, teachingScore + ideal/usable/poor/reject + a one-line note). Never throws on expected failures (returns `{ok:false,error}`); retries 429/503/500. Reads `GEMINI_API_KEY` from `.env.local` (gitignored, never commit). This is the escape hatch for the photo-curation gap: iNat "research grade" = community ID agreement, not photo composition. **Use this tool whenever a task needs accurate image analysis.** |
| `scripts/assess-image-quality.ts` | CLI for the image quality tool. `npm run images:assess -- --species "Labrus mixtus"` ranks every cached `SpeciesImage` row for a species and recommends which to pin as a `curated` override; `--url <u> --species <s>` scores one ad-hoc image (no DB); `--all [--limit N]` sweeps the catalogue; `--json` for a machine dump. Read-only (never writes the DB). |
| `scripts/build-species-galleries.ts` | **Gallery builder (4 Jun 2026).** Fills each species' reference GALLERY (the photo strip shown in `SpeciesGuidePopup` / `SpeciesGallery` at the Rung-3 decision point) to a clean TARGET (default 8) of Gemini-vetted teaching-grade photos. Per species: keeps every `curated` row untouched (the diagnostic-mark reference + its marks stay first), builds a candidate pool (existing non-curated rows + a fresh iNat vote-ranked pull + Wikimedia top-up when thin, deduped by observation, minus blocklist), assesses EVERY candidate with the Gemini-vision tool, writes the best (alive / photographic / in-frame / single-specimen) as `curated=false` rows ordered by score, DELETES the non-curated mark-free leftovers that didn't make the cut, and adds the dead/wrong/drawing rejects to `photo-blocklist.json` so the weekly cron can't re-add them. Photos live in the DB (not git); blocklist additions ARE committed. Run `npx tsx --env-file=.env.local scripts/build-species-galleries.ts --all` (`--species "X"`, `--slice a:b` for parallel shards, `--target 8`, `--pool 24`, `--min 4`, `--dry-run`, `--no-delete`). Needs `GEMINI_API_KEY`. Selection ranks by Gemini recommendation, then single-specimen, then a 50/50 blend of `teachingScore` + `diagnosticFeaturesVisible` so photos that actually SHOW the key traits win the slots. Captures `observedOn` + `placeGuess` for the 'i' provenance popover. First full run (4 Jun): 57 species, +306 photos, 385 rows. Second run (trait-weighted re-check, 4 Jun): re-assessed all + swapped in trait-richer photos -> 403 rows (~7 avg). Genuine open-source ceilings (mostly-dead-specimen food fish) left short: Sprat (2), Atlantic mackerel (2). |
| `scripts/enrich-image-meta.ts` | Backfills `observedOn` (date/year) + `placeGuess` (location) onto `SpeciesImage` rows cached before those columns existed — chiefly the `curated` reference photos the builder never re-fetches. Extracts the iNat observation id from `sourceUrl`, batch-queries iNat (`fetchObservationMeta`, 30/call), patches the rows. Only enriches iNaturalist rows (Wikimedia/manual have no obs metadata). Idempotent (`observedOn IS NULL` only; `--force` to refresh all). Run `npx tsx --env-file=.env.local scripts/enrich-image-meta.ts`. First run (4 Jun): 322 rows enriched, 320/320 iNat observations had both a date and a place. |
| `scripts/audit-species-images.ts` | **Guide-hero audit (4 Jun 2026).** Read-only inventory of every species' reference photos + annotated guide-hero (curated photo + `DiagnosticMark` rings). With `-- --validate` it composites each hero's rings via the shared `scripts/lib/mark-overlay.ts` (exact `AnnotatedSpeciesPhoto` geometry) and grades placement/clarity per ring with Gemini 3.5 Flash. Writes `implementation/2026-06-04/species-image-audit-data.json`. Run `npx tsx --env-file=.env.local scripts/audit-species-images.ts -- --validate`. |
| `scripts/place-diagnostic-marks.ts` | **Auto-placement tool (4 Jun 2026).** Fixes/fills `DiagnosticMark` ring coordinates (the hand-seeded ones were misaligned). Gemini localises each feature via its native `box_2d` format (converted to a centred ring), then a verify-and-correct loop (`validateHero` from `mark-overlay.ts`) re-prompts any ring graded off-target. `--mode relocate` re-places existing marks (skips already-aligned unless `--force`; re-points to the current curated hero, so it also finishes a P1 photo swap); `--mode author` creates marks from `scripts/data/p2-mark-drafts.ts`. Dry-run is the default; `--apply` writes. Tags `createdBy=gemini-place@pebl-cic.co.uk`; all output is a DRAFT pending expert sign-off. Appends before/after coords + grades to `implementation/2026-06-04/placement-log.json`. `scripts/render-hero.ts -- --species "X"` renders a hero composite PNG (DB coords or `--from-log`) for human ground-truthing. |
| `src/lib/biodiversity/refresh.ts` | Shared library for the OBIS/GBIF probability + name-map refresh (used by `db:backfill` and the probabilities cron) |
| `src/lib/biodiversity/refresh-images.ts` | Shared library for the iNat photo refresh (used by `db:refresh-images` and the images cron) |
| `src/lib/biodiversity/inaturalist.ts` | iNaturalist v1 API client (CC-licensed photo fetch with optional life-stage / sex annotation filters) |
| `src/components/SpeciesGallery.tsx` | Photo strip + lightbox for candidate cards and field-note view (portaled, focus-trapped, CC-attributed). Each thumbnail carries a corner **'i' button** (4 Jun 2026) opening an `InfoPopover` (portaled to body so the scroll strip can't clip it, viewport-clamped) with the photo's provenance: reference (author + license), location (`placeGuess`), year (`observedOn`), subject (lifeStage/sex), a "View on iNaturalist/Wikimedia" source link + license-deed chip. The lightbox also shows the location · year line. NB the 'i' onClick captures `getBoundingClientRect()` synchronously into a const before `setInfo` — reading `e.currentTarget` inside the state-updater crashes when React replays the reducer. |
| `src/components/AnnotatedSpeciesPhoto.tsx` | S9-T1: renders a reference photo with numbered SVG rings + legend for admin-authored diagnostic marks (used in the IdGuideWizard's final reveal). Returns null for species without authored marks, so the existing thumb-strip + field-note path keeps working as fallback. |
| `src/components/IdGuideWizard.tsx` | 5-step trait funnel (body shape → size → habitat → markings → behaviour). Each step now has a "Why ask this?" disclosure surfacing the marine biologist's rationale (S9-T1). FinalReveal renders AnnotatedSpeciesPhoto above the existing gallery + field note. |
| `src/data/species-images.json` | Per-species fetch manifest: which life-stage / sex buckets to request, plus optional pinned `overrides` |
| `src/lib/idguide/catalogue.ts` | **Validated catalogue loader (4 Jun 2026).** The single typed entry point for the species catalogue: builds a zod schema from the `as const` trait enums in `traits.ts`, validates `species-traits.json` once, and exports `CATALOGUE`. Every consumer imports `CATALOGUE` from here — the old `speciesTraitsData as unknown as SpeciesCatalogue` cast is gone. `catalogue.test.ts` strict-parses the JSON and cross-checks that every species has an alias entry + a curated photo override, so a malformed or half-onboarded species fails CI instead of degrading silently at runtime. |
| `src/data/species-traits.json` | Trait catalogue for the IdGuideWizard (body shape, size, markings, behaviour, habitat, plus the prose `fieldNote`). Read at request time by the wizard's narrowing engine in `src/lib/idguide/narrow.ts`. **57 species as of 4 Jun 2026** (28 fish incl. 2 dragonets, 3 flatfish, 6 crabs, 6 squid/cephalopods, 4 starfish, 4 gastropods, 6 jellyfish). Loaded + zod-validated via `src/lib/idguide/catalogue.ts` — import `CATALOGUE` from there, **never the raw JSON**; `catalogue.test.ts` is the CI gate that rejects an invalid enum value or missing field. Every entry carries `shapeClass` + `movement` (Workstream A). Invert entries carry one optional class-specific "form" trait each: crabs `carapaceTexture` + `crabFeatures`, squid `cephalopodForm` (octopus folded in), starfish `armForm`, gastropods `shellShape`, jellyfish `bellForm` (Workstream C); fish entries omit them. **Fish Rung-3 splitters (3 Jun 2026, `implementation/2026-06-03/fish-silhouette-rung3-review.md`):** two optional fish-only scored traits `bodyDepth` (deep/medium/slender) + `lateralLine` (pale-straight/dark-curved/arched-over-pectoral/indistinct), plus new values `caudal-spot` (markings), `finlets` (finShape), `pelvic-sucker`+`lateral-scutes` (features); duplicate `snake-like` body shape retired (use `eel-like`). Added because 21/26 fish were `fusiform`: re-tagging (deep wrasses/bib → laterally-compressed; gobies → elongated dual-tag; butterfish → eel-like; dragonet/conger trims; sprat → laterally-compressed) + the new traits drop the fusiform bucket to 17 and give the existing `nextBestTrait` Rung-3 picker real discriminating signal (it was already wired in `CandidateStrip`; it just lacked data). **"Bottom scooters" fish Rung-2 bucket (4 Jun 2026):** added a `bottom-scooter` `bodyShape` value + retagged the 2 dragonets (off `flat-dorsoventral`) and the 3 bottom-dwelling gobies (Common/Rock/Sand, added alongside their existing `elongated`/`fusiform`) onto it, so the fish sub-split tile reads "Bottom scooters" (5 species) instead of "Flat, on the bottom" (2). It is an ecology/posture grouping (perch-and-dart seabed fish), per Christian's steer that beginners group gobies with dragonets. `flat-dorsoventral` now belongs only to the 3 flatfish (Plaice/Dab/Flounder). The two-spotted goby stays out (water-column hoverer). Silhouette is an original PEBL filled SVG at `public/silhouettes/forms/bottom-scooter.svg` (no PhyloPic UUID; `fetch-bodyform-silhouettes.cjs` now preserves such hand-authored credits on re-run). All invert content is grounded in `decision-tree/id-guides/` sources: squid from the Cefas cephalopod PDF; starfish/gastropods from Devon WT; jellyfish + every invert name cross-verified against Hayward & Ryland's *Handbook of the Marine Fauna of NW Europe* (2017) on 2 Jun (all 20 names valid; `Steromphala umbilicalis` is the current name for the Handbook's older `Gibbula umbilicalis`; the barrel jelly is `Rhizostoma octopus`, the NE-Atlantic/UK species per WoRMS + MarLIN, not the Handbook's broader-range `R. pulmo`). See `implementation/2026-06-01/`. |
| `decision-tree/index.html` (+ `public/decision-tree.html`) | Standalone decision-tree visual built 1 Jun 2026: 8 shape classes -> sub-class -> species with the single best diagnostic per species. The **authoring/teaching artifact** for the Spot It flow, NOT the runtime. View at `http://localhost:3000/decision-tree.html` (served from `public/`). |
| `decision-tree/id-guides/*.pdf` | UK marine ID sources. 6 free guides downloaded 1 Jun (EA fish key, Merryweather crabs, Cefas cephalopods, Sussex IFCA, ZSL estuarine, Devon WT rocky shore) + Hayward & Ryland's *Handbook of the Marine Fauna of NW Europe* (2017, OUP, 808pp) added 2 Jun — the authoritative academic reference for all phyla, used to verify invert names/traits. NB the Handbook is 107MB, over the Read tool's 100MB limit: extract via PyMuPDF (`fitz`) per page-range, not the Read tool (see TOC: jellyfish/Scyphozoa p91-100, crustacea p306-463, molluscs incl. cephalopods p478-625, echinoderms p662-687, fish p716-763). |
| `implementation/2026-06-01/*.md` | **Spot It visual ID flow plan** (3 docs + handoff). Start at `implementation-plan.md` for the build; `session-handoff.md` to pick up cold. |
| `scripts/fetch-silhouettes.cjs` | Workstream D / UX-5: pulls one PhyloPic silhouette per gate shape-class via the PhyloPic v2 API, refusing NonCommercial licenses (FishSpotter is a PEBL CIC product) by falling back to a non-NC clade image. Sanitises each SVG, writes `public/silhouettes/<class>.svg`, and records author + license in `src/data/silhouette-credits.json`. Re-run to refresh. |
| `public/silhouettes/*.svg` + `src/data/silhouette-credits.json` | The 8 gate shape-class silhouettes (all CC0 / Public Domain Mark as of 2 Jun 2026) + their attribution. The gate (`ShapeGate.tsx`) tints them via CSS `mask-image` + `bg-current`, so they inherit the tile's brand teal and hover-recolor with zero JS-bundle cost. The hand-drawn inline SVGs in `ShapeGate.tsx` remain as a per-class fallback when a class has no asset (credits-file keys decide which path is used). |
| `src/components/MarinePattern.tsx` + `scripts/build-marine-pattern.cjs` + `scripts/fetch-pattern-silhouettes.cjs` + `public/patterns/*` + `src/data/pattern-silhouette-credits.json` | Decorative WhatsApp-doodle-style marine background (2 Jun 2026). `fetch-pattern-silhouettes.cjs` pulls ~20 extra UK marine taxa from PhyloPic (commercial-safe / non-NC, into `public/patterns/silhouettes/`); `build-marine-pattern.cjs` scatters a **curated UK-only** pool (ink-blobs + non-UK species like `turtle` listed in its `EXCLUDE` set) into a seamless, edge-wrapped tile and rasterises a cheap PNG via `sharp`. `MarinePattern` tiles the PNG via `mask-image` + `background-color: currentColor` (same technique as `ShapeGate`/`UnderwaterBackdrop`); `animated` adds the `fs-pattern-sway` wave loop. Tune density/size/rotation/excludes via the build-script knobs, then re-run it. Dev-only helpers (archived in `scripts/archive/`): `silhouette-contact-sheet.cjs` (curation grid), `preview-pattern.cjs` (in-context mock). |
| `src/lib/useModalFocus.ts` | Shared modal focus-management hook (remember opener + restore, initial focus, Tab trap, Escape, body-scroll lock) — the WCAG 2.1.2 contract, extracted from `IdGuideSheet`'s proven implementation. Applied to `MapModal` (which had none, so keyboard users could tab onto the live feed behind the open map). |
| `src/app/auth/layout.tsx` | Shared chrome for all `/auth` routes (signin/forgot/reset/verify): renders an animated `MarinePattern` behind the card and drops the card to 80% white (`[&_.pebl-surface]:bg-white/80`) so the water shows through (frosted feel). Fixes the design-audit F-EMPTY-AUTH-STATES bare-card finding. |
| `implementation/2026-06-02/design-audit.md` | Multi-agent visual/UX design audit (2 Jun 2026) + its implementation status. 12 finder lenses, per-finding adversarial verification, 61 confirmed findings deduped to 21 themes. The one P1 (`MapModal` focus) + 8 quick wins + core-loop fixes are shipped; the remaining systemic P2s (full glyph/radius/touch-target sweeps, editorial auth pages, type tokens) are tracked there. |
| `src/lib/admin.ts` | S9-T1 admin gate: `isAdminEmail()` checks for the `@pebl-cic.co.uk` suffix; `requireAdminSession()` does the lookup and redirects non-admins to `/`. Used by the `/admin` layout + the diagnostic-mark server actions. |
| `src/components/landing/*` | Landing-page redesign (2 Jun 2026, `implementation/2026-06-02/landing-redesign.md`). `UnderwaterBackdrop` (depth gradient + drifting CC0 silhouettes + light shafts + bubbles), `HeroPreview` (real looping snippet with a self-playing faux species-pick overlay), `StatsBand` (live clips/species/spotters count-up), `StepCards` (Spot→Compare→Streak, stroked-teal icons + scroll-in stagger), `SpeciesMarquee` (auto-scrolling real `SpeciesImage` photos with `© Author · LICENCE` credit). All on-brand, reduced-motion-safe, off-screen-paused. |
| `src/lib/useInView.ts` | Shared client IntersectionObserver hook (`[ref, inView]`) used by the landing components to pause always-on CSS animations + the hero video when scrolled off-screen. Pairs with the `.fs-paused` utility in `globals.css`. |
| `src/app/admin/layout.tsx` | Single gate + top nav for everything under `/admin`. Carries `robots: noindex` so admin pages never get indexed. |
| `src/app/admin/species/page.tsx` | S9-T1 species catalogue list — pilot gadoids pinned at the top with a "Pilot" badge, mark-count per species via `groupBy`, status pill (Not started / In progress / Published). |
| `src/app/admin/species/[name]/page.tsx` | Per-species editor shell. Loads SpeciesImage rows + DiagnosticMark rows in parallel, hands them to the client annotator. Shows the canonical `db:refresh-images` command if no photos are cached yet. |
| `src/app/admin/species/[name]/SpeciesAnnotator.tsx` | Click-to-add / drag-to-move / edge-handle-resize annotator. Img + absolute SVG overlay with normalised (0..1) coords. Save-on-blur for label/description; optimistic local updates with `useTransition` for the server actions. |
| `src/app/admin/species/[name]/actions.ts` | Server actions for DiagnosticMark CRUD (`createMark` / `updateMark` / `deleteMark` / `swapMarkOrder`). All gated by `requireAdminSession()`. Coords clamped to 0..1, radius to 0.01..0.5. Cross-species mark assignment is rejected. `swapMarkOrder` runs in a Prisma transaction so the order list can't end up with duplicates mid-swap. |
| `.github/workflows/bootstrap-image-cache.yml` | One-click GitHub Actions workflow that runs `prisma db push` + populates the cache; requires `POSTGRES_PRISMA_URL` + `POSTGRES_URL_NON_POOLING` repo secrets |
| `public/sw.js` | Service worker (network-first; only caches app-shell icons) |

## Conventions

Enforced or strongly-held patterns. New and touched code should follow them; the
drift narrows as files are edited.

- **Imports:** use the `@/` path alias (no `../` parent traversal). 246 call-sites, zero `../`.
- **Species catalogue:** import `CATALOGUE` from `@/lib/idguide/catalogue`, never `@/data/species-traits.json` directly. Adding/editing a species is gated by `catalogue.test.ts`.
- **TypeScript:** `strict: true`. No new `as unknown as` casts on data files — add a zod schema instead (zod is already a dependency).
- **Design tokens:** `npm run lint:tokens` bans arbitrary Tailwind colour/radius values. Use the named tokens (see Design Tokens + UI rules below).
- **Tests:** co-located `*.test.ts` (vitest). Pure logic (scoring, narrowing, matching) must stay covered.
- **Before pushing:** `npx tsc --noEmit && npm test && npm run lint && npm run lint:tokens`.
- **No emoji as UI icons; H.264-only video** (see the dedicated sections below — both are load-bearing invariants).

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

## Image analysis (Gemini vision tool)

**When a task needs accurate image analysis, use this tool — Claude is the
orchestrator, Gemini does the vision** (it is the stronger image model). Built 3
Jun 2026.

- **Lib:** `src/lib/biodiversity/gemini-vision.ts` — `assessImageQuality({ scientificName, commonName?, imageUrl | imageBase64 })`. Downloads the image, posts it inline to the Gemini `generateContent` REST API with `temperature: 0` and a strict JSON `responseSchema`, returns a typed `ImageQuality`. Generic enough to repurpose: change `buildPrompt` + `RESPONSE_SCHEMA` for other vision tasks (counting, OCR, feature extraction).
- **CLI:** `npm run images:assess` (`scripts/assess-image-quality.ts`). Read-only. Modes: `--url <u> --species <s>` (one ad-hoc image, no DB), `--species <s>` (rank all cached `SpeciesImage` rows + recommend the best to pin as `curated`), `--all [--limit N]` (catalogue sweep), `--json`.
- **Auth:** `GEMINI_API_KEY` in `.env.local` (gitignored — never commit, never write to memory/CLAUDE.md). Model via `GEMINI_MODEL` (default `gemini-3.5-flash`, the latest Flash; verify ids against the ListModels API).
- **Quota gotcha (confirmed 3 Jun 2026):** the current key is on the Gemini **free tier (~20 requests/day**, `GenerateRequestsPerDayPerProjectPerModel-FreeTier`). An `--all` catalogue sweep is 150+ images and dies with `429 RESOURCE_EXHAUSTED` partway. The lib retries per-minute 429s but cannot beat the daily cap. For a full sweep: spread small `--species` batches across days, or move the key to a billed/paid project. `gemini-2.5-flash-lite` sometimes has separate quota when the others are exhausted.
- **Why it exists:** the photo-curation gap. iNat "research grade" means the community agrees on the *species*, not that the photo is a clean single living lateral specimen good for *teaching*. This tool reads the pixels (mixed school? dead beach-cast? engraving? wrong subject like the Aurelia-aurita-photo-of-a-person case?) and scores teaching suitability, so curation isn't a manual eyeball pass.
- **Workflow it slots into:** `db:refresh-images` (populate cache) → `images:assess --species` (find the best photo) → pin it as a `curated` override in `species-images.json` → `db:refresh-images --species` → seed/author diagnostic marks.

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

## UI / Design rules (to avoid regressions)

Distilled from the 14-agent design review (27 May 2026) and enforced by the
Q4-A/C/D sprints. Follow these when touching any UI:

- **Never use emoji as UI icons.** Replace any 🐟, 🔥, 🔍, ✨, 🚀 in JSX with
  stroked SVGs in `text-teal-500`. Emoji are platform-specific and read as
  "hackathon", not "marine science product."
- **Verdict / semantic colour states must use design tokens, not Tailwind
  stock utilities.** `emerald-400`, `rose-400`, `amber-300` are not in the PEBL
  palette. Use the `correct` / `incorrect` / `pending` tokens in
  `tailwind.config.ts` (each has a `DEFAULT` bg + an `ink` text shade). Add a
  named token before reaching for any new semantic state.
- **Motion timing comes from `src/lib/motion.ts`.** Use `DURATION` /
  `EASE` / `TRANSITION` / `spring` for generic enter/exit/layout transitions
  rather than inlining `{ duration: 0.2 }`. Bespoke motion (shake keyframes,
  infinite-repeat pulses, non-standard springs) may stay inline.
- **Named design tokens must be used at call-sites.** If `rounded-card`,
  `shadow-menu`, or a named type-scale token exists in `tailwind.config.ts`,
  use it; don't substitute `rounded-2xl`, `shadow-2xl`, or `text-sm`.
- **Auth/empty pages need editorial content in unused viewport.** Never ship a
  `max-w-md` card centred on a blank background; add a contextual still, a
  field-note quote, or a species silhouette to show what the user is signing
  up for.
- **All interactive elements ≥ 44×44px on mobile.** Applies to pills, text
  links, icon buttons, and collapse affordances, not just primary CTAs. Check
  at 390px width before committing any feed or sheet change.
- **Off-screen overlay content must be `inert`.** Any component that renders
  multiple items where only one is "active" (feed cards, carousel slides,
  off-screen drawers) must set `inert` on inactive items. `tabIndex=-1` alone
  does not remove items from the accessibility tree. Note: React 18.3 needs
  `inert` spread as a string (`{ inert: "" }`) cast for Framer compatibility.
- **Reveal / result feedback must be immediate.** Any action where a user
  submits and expects a score must show the result *in place* before
  navigating away; never rely on the user finding it in a different scroll
  position or page.

### Design-system conventions (deferred consolidations)

Q4-D consolidated motion (`src/lib/motion.ts`) and verdict colours (Q4-D2).
Three other clean-ups were intentionally *not* swept (the global churn /
visual-regression risk outranged the value), but the canonical choices below
are the standard for new and touched code, so the drift narrows over time:

- **Border radius: use `rounded-card` for surfaces, `rounded-modal` for
  inputs / small notices, `rounded-full` for pills.** Do NOT introduce
  `rounded-2xl` (it duplicates `rounded-modal`'s 16px) or `rounded-lg`. The
  legacy `rounded-hero` (28px) was **fully retired and removed from
  `tailwind.config.ts` on 2 Jun 2026** (all call-sites migrated to
  `rounded-card`); do not reintroduce it. Remaining `rounded-2xl`/`lg`/`xl`
  drift is migrated opportunistically when a file is edited (the bulk left
  sits in `admin/*`).
- **Type scale: the named tokens (`display`/`h1`/`h2`/`h3`/`eyebrow`) are
  for headings only.** There is deliberately no token for small body/label
  text yet, so `text-xs` / `text-[11px]` / `text-[10px]` are the accepted
  utilities there. If a small-text token is ever needed, add it centrally in
  `tailwind.config.ts` rather than scattering more ad-hoc sizes.
- **Colour source of truth: use the Tailwind aliases (`teal-600`,
  `navy-900`, `correct`, ...) in `className`.** Reserve the `:root` CSS vars
  (`--foreground`, `--primary`, `--muted`, ...) for the few places that need
  `[color:var(--x)]` (theming hooks, the `pebl-*` component classes). `--primary`
  and `teal-600` are the same hex; don't add new parallel definitions of a
  colour; extend the Tailwind palette and reference it.

## Database

Run scripts with: `npx tsx --env-file=.env.local scripts/<script>.ts`

Seed: `npm run db:seed`

### Row-Level Security (RLS) — load-bearing security invariant

**Every table in the `public` schema MUST have RLS enabled.** The app reaches
the DB only through Prisma, which connects as the table-owner role and bypasses
RLS — so RLS-with-no-policy is the correct steady state (it blocks the Supabase
PostgREST path without affecting the app). The Supabase **anon key is public**
(it ships in the browser bundle), so any `public` table with RLS *off* is
directly readable by anyone via `/rest/v1/<Table>` — which previously exposed
`User` emails + password hashes and would have exposed `Account` OAuth tokens.

- Canonical statement: `prisma/rls.sql` (a dynamic, idempotent loop that enables
  RLS on all current **and future** public tables — `prisma db push` does not
  manage RLS, so a freshly recreated table lands with RLS off until this runs).
- Apply + verify: **`npm run db:enable-rls`**. Add `-- --check` for a read-only
  audit that exits non-zero if any public table is unprotected (CI-friendly).
- After any `prisma db push` that creates a table, re-run `npm run db:enable-rls`.
  Do NOT add anon/authenticated policies unless a feature genuinely needs the
  client-side Supabase SDK to read a table (none do today).

Schema summary:
- `Snippet`: id, externalId (folder name), videoUrl, thumbnailUrl, site, deployment, depthM, lat, lon, recordingDatetime, **`staffAnswer: String?`** (nullable since S7-T1 — null means "no reference identification yet"), bboxJson
- `Answer`: userId, snippetId, chosenOption, **`isCorrect: Boolean?`** (null when the snippet has no reference yet), **`points: Int`** (S7-T1; 2 = correct match against reference, 1 = pending bonus on a no-reference snippet, 0 = unmatched guess)
- `User`: id, email, displayName, name
- `SpeciesProbability`: cached OBIS species composition per (lat₀.₁°, lon₀.₁°, depth₁₀m, month) bucket
- `SpeciesNameMap`: cached GBIF resolution of `staffAnswer` → canonical scientific name (only resolved when `staffAnswer` is non-null)
- `SpeciesImage`: cached iNaturalist photo rows keyed on (scientificName, sourceUrl); columns for lifeStage / sex / license / attribution / ordering / curated flag / **`observedOn`** (date or year of the source observation) / **`placeGuess`** (human location of the source observation) — the last two added 4 Jun 2026 to power the gallery 'i' provenance popover; both nullable and only populated for iNaturalist rows (Wikimedia/manual carry no structured obs metadata). Manual `overrides` from `src/data/species-images.json` are upserted with `curated=true` and never overwritten by the script.
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

Phase 2 (consensus retro-bonus, **shipped 27 May 2026 evening, Q3A-T8**):
- When `CONSENSUS_THRESHOLD_USERS` (3) or more distinct users converge on
  the same normalised name for a no-reference snippet, the
  `consensus-rescore` cron retro-credits each matching `Answer.points`
  with `POINTS_CONSENSUS_BONUS` (+2). A consensus-pioneer (1 + 2 = 3)
  thus outranks a referenced correct (2), incentivising the first ID on
  a no-reference clip.
- Schema: new `ConsensusEvent` table (one row per `snippetId` x
  `normalisedName`) tracks `creditedAnswerIds` so re-runs are no-ops and
  late-joiners get retro-credited on subsequent ticks.
- Library: `src/lib/consensus.ts`, pure `groupPendingAnswers` +
  `eligibleGroups` exposed for unit testing (8 tests in
  `consensus.test.ts`); `rescoreConsensus(prisma)` does the DB work in a
  transaction per group.
- Cron: `/api/cron/consensus-rescore` registered in `vercel.json` daily
  at 07:00 UTC. Guarded by `CRON_SECRET`.
- Grouping is strict normalised-equal (case + whitespace collapsed) so
  "Pollack" and "POLLACK" group, but "Pollack" and "Pollock" do not.
  Alias-aware grouping is a future enhancement (would use the same
  matcher path as `matchAnswer()`).

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
| `npm run db:refresh-images` | Refresh SpeciesImage rows for all catalogue species from iNat (priority species get male/female/juvenile/egg buckets per the manifest) | After editing `src/data/species-images.json` |
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

Each call processes up to 12 species; for the full catalogue, hit the
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

## "Spot It" — visual ID flow (SHIPPED)

A shape-class-first, scored-by-rung identification game layered over the feed
clips, fed from British marine ID guides. **Shipped and live** — runtime architecture in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Original plan
in `implementation/2026-06-01/` — read `session-handoff.md` first, then
`implementation-plan.md`.

- **The model (revised from a naive 5-level funnel):** a hard **Shape-class
  gate** (Crab / Fish / Flatfish / Jellyfish / Starfish / Gastropod /
  Squid) + one shallow **sub-split** + an **adaptive bag of weighted traits**,
  with **Context as a silent prior** the app already computes from snippet
  metadata (`SpeciesProbability`/OBIS). Movement is a scored trait, not a level.
- **It is an evolution, not a rewrite.** Runtime = `IdGuideWizard` + `narrow.ts`
  + `MCQCandidatePicker` + `AnnotatedSpeciesPhoto` + `DiagnosticMark` +
  `SpeciesProbability`. New code = shape as a hard filter, an information-gain
  next-question picker (`src/lib/idguide/next-trait.ts`, planned), and
  scored-by-rung in `answer-matching.ts`.
- **The four rungs:** (1) shape gate silhouette grid; (2) visual sub-split;
  (3) **as shipped, a photo-tile candidate grid** (`CandidateGate.tsx`, capped at
  24 tiles, ordered by likelihood) — tap a tile to compare, then commit; (4)
  reveal with diagnostic-mark rings + commit. **NB:** the adaptive yes/no
  "narrowing engine" (`CandidateStrip.tsx` + `trait-questions.ts`) from the
  original spec is **NOT currently wired into the runtime** — it is orphaned
  (imported nowhere) pending a decision to revive (one information-gain cut
  before rendering >~8 tiles) or remove it. Each rung offers "Not sure"
  (re-narrow / step back) and "Pick from a list" (jump to the MCQ).
- **Approved decisions:** guided flow sits ALONGSIDE the MCQ (button entry);
  scored-by-rung (coarse shape match = partial credit); PhyloPic silhouettes +
  annotated-photo trait diagrams (no commissioned art); prototype the gate first.
- **Scored-by-rung reframes the parked nullify audit:** "Fish / Crab /
  Jellyfish" become valid coarse references, not junk to nullify.
- **Scoring (locked 1 Jun):** two tiers. Species match = 2
  (`POINTS_CORRECT_REF`, unchanged), correct shape-class = 1 (new
  `POINTS_SHAPE_CLASS`), wrong shape = 0. No sub-class tier: `Answer.points` is
  an Int so nothing fits between 1 and 2, and bumping species to 3 would ripple
  through the consensus invariant (pioneer bonus). This unblocks Workstream E.
- **Long pole:** catalogue content (Workstream C) — editorial, needs marine-
  biologist sign-off; the gate is hollow until each shape class has >= 3 species.

## Changelog / shipped history

The dated, session-by-session shipping log lives in **[docs/CHANGELOG.md](docs/CHANGELOG.md)**
(moved out of this file 2026-06-04 to keep CLAUDE.md a stable reference). Append new
milestones there, not here.

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
GEMINI_API_KEY=...                # image-quality / vision tool (gemini-vision.ts); free tier ~20 req/day
GEMINI_MODEL=gemini-3.5-flash     # optional override (default gemini-3.5-flash)
SENDGRID_API_KEY=...              # transactional email (src/lib/email/client.ts) — replaced Resend
CRON_SECRET=...                   # required in production for /api/cron/*

# Storage provider (see "Storage provider" section above)
STORAGE_PROVIDER=supabase         # "r2" or "supabase" (default)
R2_ACCOUNT_ID=...                 # only required when STORAGE_PROVIDER=r2
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=fishspotter-snippets
R2_PUBLIC_URL=https://pub-<hash>.r2.dev   # or a custom domain

# Q4-B2 MCQ candidate-photo gate (optional, default off)
MCQ_CURATED_PHOTOS_ONLY=1         # when "1", MCQ candidate thumbnails only use
                                  # SpeciesImage rows with curated=true; species
                                  # with no curated photo fall back to a fish
                                  # silhouette. Leave unset until the top MCQ
                                  # species each have a curated photo, else most
                                  # tiles silhouette (only pollack is curated today).
```
