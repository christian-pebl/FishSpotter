# CLAUDE.md - FishSpotter Project Notes

## Project Overview

**FishSpotter** (fish-spotter.vercel.app) is a PEBL CIC marine monitoring web app built with Next.js 14 (App Router), Prisma, Supabase Storage, and NextAuth.

- Repo: https://github.com/christian-pebl/FishSpotter
- Live URL: **https://fish-spotter.vercel.app** (canonical, ignore fishspotter.vercel.app, different deployment)
- Local dev: `npm run dev` runs on **localhost:3000**
- Database: Supabase Postgres (project ID: `aazxphcrexkggbmmceli`, region: West EU / Ireland)
- Storage: Supabase Storage bucket `snippets`, public URLs at `https://aazxphcrexkggbmmceli.supabase.co/storage/v1/object/public/snippets/{externalId}/snippet.mp4`

### Docs

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**: how the subsystems fit together (request path, data pipeline, the catalogue, the rung flow). Read this first when picking up cold.
- **[docs/runbooks/add-a-species.md](docs/runbooks/add-a-species.md)**: the step-by-step for onboarding a new species.
- **[docs/runbooks/add-a-rung-or-trait.md](docs/runbooks/add-a-rung-or-trait.md)**: adding a trait value or extending the "Spot It" funnel.
- **[docs/runbooks/migrate-to-species-table.md](docs/runbooks/migrate-to-species-table.md)**: planned canonical Species table migration (prod DB; not yet run).
- **[docs/CHANGELOG.md](docs/CHANGELOG.md)**: dated shipping history (moved out of this file).

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
| `src/components/FeedCard.tsx` | Main video card: video playback, bbox tracking overlay (prefers `manualTrackJson` over `bboxJson` for the trail), species quiz. `getBoxAtProgress` positions a track ABSOLUTELY when its points carry `t_norm`, and stretches it across the whole clip only as the fallback for tracks without one. |
| `src/lib/trackCoverage.ts` | Where a track actually has data inside its clip, and how strongly to draw it (`trackCoverage` / `coverageAlpha` / `inCoverage`). Exists because the 28 Aug 2026 minimum-duration re-cut gave 69 clips padding either side of their tracked window; the old stretch-to-fit renderer would have dragged the trace through frames the animal was never marked in. Points without `t_norm` return null coverage, which preserves the original behaviour for every older clip. See "Minimum clip duration" below. |
| `src/components/FeedPlayer.tsx` | IntersectionObserver scroll container; sets activeIndex |
| `src/app/feed/page.tsx` | Live feed page (server component, fetches snippets). Accepts the same `?species=` / `?site=` / `?q=` filter the archive uses, so "Launch feed of current filtered videos" lands on exactly the clips the grid was showing. The end-of-feed completion card is suppressed while filtered: its claim is "that is all N clips on the feed, you have genuinely run out", which is true of the whole feed and false of a selection. |
| `src/app/feed/browse/page.tsx` | Archive grid page. Filter row is **Species → Location → Sort** (30 Aug 2026); the free-text "Search species, site, deployment" box is gone, because the only species text it could match was `staffAnswer`, which is shape words. |
| `src/lib/snippet-species.ts` | **Which species is in a clip (30 Aug 2026).** There is no column for this. `Snippet.staffAnswer` looks like one and is not: measured against the live DB its ONLY values are `""` (69 of 163 clips), `Fish`, `Crab`, `Scooter`, `Jellyfish`, `Flatfish`, `Gastropod`, `Starfish`, `hermit`, `jelly`, `large fish`, `small fish`. So the species is the **community's settled ID**, the same leader `consensus.pickLeaderGroup` pays Pebbles on: most distinct spotters on one `normalizeForMatch` key, once `CONSENSUS_THRESHOLD_USERS` agree. Two narrowings on top: a leader only becomes an option if it resolves to a CATALOGUE species (so a clip settled on "flatfish" settles on a SHAPE and is left out rather than forced onto one of the three flatfish), and the label is the catalogue `commonName`, not whichever surface form won the vote. Covers only what the crowd has settled (39 of 143 visible clips / 20 species on 30 Aug 2026) and grows with play; a clip nobody has settled is reachable only with the filter cleared, which is the honest behaviour. Pure builder + unit tests; `loadSpeciesIndex` is the one grouped Answer query. |
| `src/lib/snippet-filter.ts` | The clip filter (`site` / `species` / `q`) shared by the archive grid and the live feed, so the "Launch feed" button cannot promise a set the feed does not deliver. `q` has no input of its own any more but is still honoured: `/farms/[slug]` deep-links to `/feed/browse?q=<deployment>`, and the archive carries it through Apply as a hidden field. `sort`/`page` are deliberately NOT part of it (presentation, and the feed has its own difficulty-ramped order). |
| `src/components/FeedFilterNotice.tsx` | "You are watching a filtered feed" pill on `/feed`, and the only route back to the whole feed. Exists because five hermit-crab clips and a five-clip site look identical from inside the player. Hides itself while a Spot It gate is open (same `fs-gate` event FeedPlayer's nav hint listens to), since the gate turns the layout into a split screen. |
| `src/app/leaderboard/page.tsx` | Community leaderboard |
| `prisma/schema.prisma` | DB schema: User, Snippet, Answer |
| `scripts/seed.ts` | One-time seed: reads local snips folders, uploads to Supabase, inserts DB records (now also ingests `manual_track` -> `manualTrackJson`) |
| `scripts/sync.ts` | **Incremental snippet sync (`npm run db:sync`).** Reads `SNIPS_DIR`, upserts only NEW/CHANGED folders (tracked via a local `.sync-manifest.json` of size+mtime signatures), re-uploads media + cache-busts ONLY when the clip bytes changed (so the editor's manual-track-only rewrites don't re-upload video), and writes `bboxJson` + `manualTrackJson`. This is what DesktopML's `fishspotter_sync.py` invokes after every export; `seed.ts` stays the upload-everything bootstrap. Three gates HOLD a snip rather than publishing it: incomplete metadata (`REQUIRED_META`), a burnt-in detector overlay (`scripts/lib/burn-in.ts`), and a video codec no browser can decode (`scripts/lib/video-codec.ts`); none writes a manifest entry, so a corrected re-export is picked up next run. Flags: `--all`, `--dry-run`, `--limit N`, `--allow-incomplete`, `--allow-burned-in`, `--allow-bad-codec`. |
| `scripts/lib/burn-in.ts` | **Burnt-in overlay detector (28 Aug 2026).** Refuses to publish a clip that has the ML detector's own output drawn INTO the pixels. TRDesk4 falls back to cutting from a pipeline render (`*_unified_tracked.mp4`, `*_yolo_tracked_web.mp4`, `*_step2_motion.mp4`) when it cannot resolve the raw footage; those carry a black HUD bar reading `FUSED TRACKS (n) Frame N` plus detection rectangles, which shows a player the machine's answer. Two independent signals: `pipelineRenderName()` reads `metadata.source_video_used` (cheap, exact, only on exports new enough to record it), and `detectBurnedInOverlay()` samples frames with ffmpeg and measures the top-left 500x26 band. **A "is the top-left dark?" test is NOT usable** (murky green footage trips it; it false-positived a clean live Skye clip), so a HUD verdict requires a near-black background AND white glyph pixels together: measured over 11 burnt-in clips vs 11 clean re-cuts the populations were black 0.67-0.71 / white 0.047-0.051 versus 0.00 / 0.000, no overlap. Returns `unknown` (never `burned-in`) when ffmpeg is absent, so a missing toolchain warns instead of freezing every sync. Used by `sync.ts` and `snip-preflight.ts`. |
| `scripts/lib/video-codec.ts` | **Codec gate (28 Aug 2026).** Refuses to publish a clip a browser cannot decode. TRDesk4's exporter pipes frames to `ffmpeg -c:v libx264` ONLY when `shutil.which("ffmpeg")` resolves inside its own process; otherwise it falls back to the cv2 `mp4v` writer (MPEG-4 Part 2) and merely logs a warning. On 28 Aug 2026 that shipped all 52 Car-Y-Mor clips as `mpeg4`: they uploaded fine, served a healthy HTTP 206, carried complete metadata and clean pixels, and rendered as "This clip didn't load." in every browser. The existing `npm run check:codecs` catches this, but only by probing live DB URLs, i.e. after the public has seen it; this gate runs before upload. `isPlayableCodec()` is the pure predicate (H.264 only, deliberately: HEVC/AV1 are refused because widening the set is a product decision, not something a sync should infer). `checkSnipCodec()` returns `unknown` (warn, fail open) when ffprobe is absent, but `unplayable` (hold) when ffprobe IS present and cannot parse the file, since that is a truncated or corrupt clip rather than a missing tool. Used by `sync.ts` and `snip-preflight.ts`. |
| `scripts/fix-unplayable-snippets.ts` | **Codec repair (`npm run db:fix-codecs`, 28 Aug 2026).** The remediation half of the gate above: probes every live `Snippet.videoUrl`, re-encodes any non-H.264 clip to H.264, uploads over the same storage key, and bumps the `?v=` cache-buster so browsers and the CDN drop the undecodable bytes they cached. Prefers re-encoding from `SNIPS_DIR/<externalId>/snippet.mp4` (the exact uploaded bytes) and downloads only when there is no local copy. NB this is a SECOND lossy pass over a weak mp4v intermediate, the very thing the 10 Jun 2026 re-cut existed to stop, so it is the emergency fix, not the best output: the clean fix is to make ffmpeg resolvable to TRDesk4 and re-export from the raw footage (one encode at crf 16). `--dry-run`, `--limit N`, `--external <id>`. Verify with `npm run check:codecs`. |
| `scripts/transcode-to-h264.ts` | Utility: downloads all mp4v snippets, transcodes to H.264, re-uploads, updates DB URLs |
| `scripts/reupload-snippets-hq.ts` | Re-uploads the high-quality re-cut clips (from `DesktopML/reexport_snippets_hq.py`, default `--from` the local export dir or pass `--from "<G: Fish Spotter Snips>"`) to the active storage provider and cache-busts the DB `videoUrl`/`thumbnailUrl` with a `?v=` bump. Idempotent: skips rows already on the active provider's host (`--all` to force). `--dry-run` / `--limit N`. Used for the 10 Jun 2026 quality re-cut; also the tool to re-consolidate onto R2 once R2 creds are present. |
| `scripts/refresh-images.ts` | CLI runner for the species-image cache (thin wrapper around `src/lib/biodiversity/refresh-images.ts`) |
| `scripts/backup-pre-drop.ts` | Pre-migration safety net: dumps tables/columns about to be dropped by a `prisma db push --accept-data-loss` to `./backups/` as JSON. Edit the table list before running. |
| `scripts/seed-fish-marks.ts` | Bulk fish DiagnosticMark seeder (2 Jun 2026). Covers **21 fish species** across 4 batches: gadoids (Saithe, Bib/Pouting, Poor Cod, Atlantic Cod), wrasses (Ballan, Cuckoo, Corkwing, Goldsinny), gobies/benthic (Two-spotted Goby, Common Goby, Rock Goby, Sand Goby, Butterfish, Shanny, Long-spined Sea Scorpion), and pelagic/schooling (Horse Mackerel, Atlantic Mackerel, Sprat, Sand Smelt, Sea Bass, Thick-lipped Grey Mullet). Idempotent, skips species that already have marks. Requires a curated `SpeciesImage` row per species (add to `species-images.json` overrides + run `db:refresh-images --species` first). Run via `npx tsx --env-file=.env.local scripts/seed-fish-marks.ts`. |
| `scripts/audit-reference-ids.ts` | Q4-B1 diagnostic (read-only). Groups `Snippet.staffAnswer` by normalised label, joins SpeciesNameMap resolution, and proposes a per-label action: `keep` (species-level binomial), `backfill` (identifiable but coarse, needs a human binomial), `nullify` (indeterminate like "Fish"/"Crab" -> should become a no-reference snippet), `none` (already null). Run `npm run db:audit-references` (add `-- --json` for a machine dump). Never writes; the approved backfill/nullify + retro-score is a separate step. |
| `scripts/confusion-matrix.ts` | Q4-B3 diagnostic (read-only). Ranks `(reference, guessed-as)` pairs from incorrect Answers (`isCorrect=false`), grouped by the live matcher's normalise key, plus a most-confused-reference rollup. This is the authoring brief for mark expansion (where the wizard most needs a discriminating mark). Run `npm run db:confusion-matrix` (`-- --limit N`, `-- --json`). Note: junk references like "Fish"/"Crab" dominate until they're nullified via the audit above. |
| `src/lib/biodiversity/gemini-vision.ts` | **Gemini vision client (image quality tool).** Claude orchestrates; Gemini 3.6 Flash (override `GEMINI_MODEL`) does the actual vision. `assessImageQuality()` downloads a photo, sends it inline to Gemini with a strict JSON `responseSchema`, and returns a teaching-suitability assessment (subjectType, individualCount, condition, view, nonPhotographic, focus/lighting/framing/occlusion/diagnostic-feature scores 0..100, teachingScore + ideal/usable/poor/reject + a one-line note). Never throws on expected failures (returns `{ok:false,error}`); retries 429/503/500. Reads `GEMINI_API_KEY` from `.env.local` (gitignored, never commit). This is the escape hatch for the photo-curation gap: iNat "research grade" = community ID agreement, not photo composition. **Use this tool whenever a task needs accurate image analysis.** |
| `scripts/assess-image-quality.ts` | CLI for the image quality tool. `npm run images:assess -- --species "Labrus mixtus"` ranks every cached `SpeciesImage` row for a species and recommends which to pin as a `curated` override; `--url <u> --species <s>` scores one ad-hoc image (no DB); `--all [--limit N]` sweeps the catalogue; `--json` for a machine dump. Read-only (never writes the DB). |
| `scripts/onboard-species.ts` | **One-command species onboarding (19 Jun 2026).** Chains the per-species DATA steps so a newly-added catalogue species lands with photos + a vetted gallery + provenance + diagnostic-mark rings, instead of falling through the old 5-script manual chain (which left whiting with reference photos but no ID circles). Runs, in order: `refresh-images --species` → `build-species-galleries --species` (Gemini) → `place-diagnostic-marks --mode author --species --apply` (Gemini, only if the species has a draft in `scripts/data/p2-mark-drafts.ts`) → `enrich-image-meta` → `seed-aliases`. Orchestrator only, it spawns the existing tested scripts, doesn't re-implement them. `npm run db:onboard-species -- --species "Genus species"` (`--skip-gallery`, `--skip-marks`, `--dry-run`, `--continue`). Needs `.env.local` + `GEMINI_API_KEY`. Placed rings are DRAFTS pending expert sign-off (review in `/admin/species/...`). |
| `scripts/photo-contact-sheet.ts` + `scripts/apply-photo-picks.ts` | **Human/Claude photo review (`npm run photos:sheet`, `npm run photos:apply-picks`, 30 Aug 2026).** The fallback for vetting gallery candidates when the Gemini vision tool is unavailable, and a better check than it in one specific way. `photos:sheet` assembles the same candidate pool as the gallery builder and composites it into numbered 5x4 contact sheets, so a reviewer judges twenty photos in one look instead of one at a time; `photos:apply-picks` reads the reviewed `implementation/photo-review/picks.json` and upserts the keeps in pick order, adding the named rejects to the blocklist. **It deliberately does NOT delete.** The builder deletes what it did not re-choose, which is right when it has re-assessed the whole pool; a reviewer who has looked at a sample and said "these are good" has not made the claim "everything else is bad". **Why it catches things the vision tool cannot:** the model is asked "is this a good photo of X?", a leading question, and it answers yes about a congener. Seeing all candidates side by side found five SQUID sitting in the common cuttlefish pool, a flock of auks among the eiders, and a comb jelly among the barrel jellyfish. Contact sheets are regenerable and gitignored; `picks.json` is committed, because it is the record of what was chosen and why. |
| `scripts/check-photos.ts` | **Reference-photo health check (`npm run check:photos`, 29 Aug 2026).** The sibling of `check:codecs` and `check:durations`, and it exists for the same reason: every one of the things it looks for has already shipped to production. Reports coverage per species (never fatal: some ceilings are genuine), and FAILS on a photo that is unreachable, uncredited, or of the wrong species. Three details that are load-bearing. (1) **Wikimedia gets its own serial, delayed lane.** A run that fetched 666 URLs in two minutes flagged 46 as broken and every one returned 200 when asked on its own; a 429 from our own checker is not a broken photo, and a real visitor loading ten images never comes close to the limit. (2) **Liveness is decided by the file's MAGIC BYTES, not its length.** A first cut failed anything under 5KB and rejected seven good rows, because a 500x281 WebP is 4.4KB and a 286x177 one is 2KB. It also has to be a header check rather than a status check, since a throttled CDN serves an HTML error page that renders as a broken tile. (3) **The entry point is guarded** (`process.argv[1]` check) so importing `looksLikeImage` for its unit test does not open a DB connection and start fetching hundreds of photos. `--min N`, `--max-kb N` (flags oversized archive originals), `--species "X"`, `--skip-liveness`. |
| `scripts/build-species-galleries.ts` | **Gallery builder (4 Jun 2026; deepened + guarded 29 Aug 2026).** Fills each species' reference GALLERY (the photo grid on the species guide page, and the strip at the Rung-3 decision point) with Gemini-vetted teaching-grade photos. **Prefer `--extra N` over `--target N`**: `--target` is a flat TOTAL, so with curated counts running 1..4 across the catalogue it quietly leaves the most heavily curated species with the fewest reference photos; `--extra` asks for N gallery photos *on top of* whatever curated rows exist, which is the promise the guide page actually makes. Per species: keeps every `curated` row untouched (the diagnostic-mark reference + its marks stay first), builds a candidate pool (existing non-curated rows + a **paged** iNat vote-ranked pull + an **always-on** Wikimedia Commons pull, deduped by observation, minus blocklist), assesses EVERY candidate with the Gemini-vision tool, writes the best (alive / photographic / in-frame / single-specimen) as `curated=false` rows ordered by score, DELETES the non-curated mark-free leftovers that didn't make the cut, and adds the dead/wrong/drawing rejects to `photo-blocklist.json` so the weekly cron can't re-add them. Photos live in the DB (not git); blocklist additions ARE committed. Run `npx tsx --env-file=.env.local scripts/build-species-galleries.ts --all --extra 9 --min 8 --pool 120` (`--species "X"`, `--slice a:b`, `--dry-run`, `--no-delete`, `--assess-conc`/`--species-conc`). Needs `GEMINI_API_KEY`. **Throughput is client-bound, not rate-limited**: measured 29 Aug 2026 at 1.47 calls/s at concurrency 16 and 3.47 calls/s at 32, zero errors either way, so a full sweep is a concurrency setting, not an overnight job. Selection ranks by Gemini recommendation, then single-specimen, then a 50/50 blend of `teachingScore` + `diagnosticFeaturesVisible`. Captures `observedOn` + `placeGuess` for the 'i' provenance popover. **Three guards, all added 29 Aug 2026 after each fired for real, and all load-bearing because this script DELETES:** (1) it **HOLDS** a species untouched when more than `MAX_ASSESS_FAIL_RATE` of its candidates cannot be scored, because dropping unscored candidates and then deleting the unchosen rows composes into a silent gallery wipe (see the mp4v-shaped failure in the Gemini-vision section below); (2) it **refuses to blocklist a species' entire pool**, since 100% rejection is a statement about the rubric, not the photos (`Echinocardium cordatum`, the sea potato, is a burrowing urchin whose whole open-licence record is empty tests on a beach, so a blanket block would permanently bar the only images of it that exist); (3) **`--dry-run` no longer writes the blocklist** - it used to, so a "write nothing" preview was silently editing a committed data file. Full runs: 4 Jun, 57 species -> 403 rows (~7 avg). 29 Aug, 72 species -> `--extra 9`, see the changelog for the counts and the species left short by a genuine open-source ceiling. |
| `scripts/enrich-image-meta.ts` | Backfills `observedOn` (date/year) + `placeGuess` (location) onto `SpeciesImage` rows cached before those columns existed, chiefly the `curated` reference photos the builder never re-fetches. Extracts the iNat observation id from `sourceUrl`, batch-queries iNat (`fetchObservationMeta`, 30/call), patches the rows. Only enriches iNaturalist rows (Wikimedia/manual have no obs metadata). Idempotent (`observedOn IS NULL` only; `--force` to refresh all). Run `npx tsx --env-file=.env.local scripts/enrich-image-meta.ts`. First run (4 Jun): 322 rows enriched, 320/320 iNat observations had both a date and a place. |
| `scripts/audit-species-images.ts` | **Guide-hero audit (4 Jun 2026).** Read-only inventory of every species' reference photos + annotated guide-hero (curated photo + `DiagnosticMark` rings). With `-- --validate` it composites each hero's rings via the shared `scripts/lib/mark-overlay.ts` (exact `AnnotatedSpeciesPhoto` geometry) and grades placement/clarity per ring with Gemini 3.5 Flash. Writes `implementation/2026-06-04/species-image-audit-data.json`. Run `npx tsx --env-file=.env.local scripts/audit-species-images.ts -- --validate`. |
| `scripts/place-diagnostic-marks.ts` | **Auto-placement tool (4 Jun 2026; --slice added 28 Aug 2026).** Fixes/fills `DiagnosticMark` coordinates (the hand-seeded ones were misaligned). Gemini localises each feature via its native `box_2d` format (converted to a centred point), then a verify-and-correct loop (`validateHero` from `mark-overlay.ts`) re-prompts any marker graded off-target. `--mode relocate` re-places existing marks (skips already-aligned unless `--force`; re-points to the current curated hero, so it also finishes a P1 photo swap); `--mode author` creates marks from `scripts/data/p2-mark-drafts.ts`. `--slice a:b` runs a contiguous alpha-sorted index range, for sharding a full-catalogue sweep across parallel processes (28 Aug: the 67-species sweep ran as 5 parallel shards this way). Dry-run is the default; `--apply` writes. Tags `createdBy=gemini-place@pebl-cic.co.uk`; all output is a DRAFT pending expert sign-off. Appends before/after coords + grades to `implementation/2026-06-04/placement-log.json`. `scripts/render-hero.ts -- --species "X"` renders a hero composite PNG (DB coords or `--from-log`) for human ground-truthing. **The Gemini caller retries once without `thinkingConfig` on a 400** (28 Aug fix, same gotcha as `gemini-vision.ts`: `gemini-3.6-flash` rejects `thinkingBudget: 0` outright, which was silently failing every relocate call). |
| `src/lib/biodiversity/range.ts` | **Species range claim (28 Aug 2026).** Turns an OBIS occurrence grid into a sentence a beginner can read ("Mostly seen in the English Channel, and only here and there elsewhere"), scoring six lay-named seas as common / occasional / notRecorded. **The load-bearing fact: OBIS record counts measure SURVEY EFFORT at least as much as animals, so never shade, rank or weight anything by raw per-cell count.** 51% of every grey seal record in the UK window comes from ONE cell off Brest, so the old per-cell heatmap drew its darkest square in Brittany. What is robust is COVERAGE, the share of a region's surveyed cells holding the species: one huge survey inflates a cell's count but cannot spread a species across a region it does not live in. Records are used only as a floor, based on the MEDIAN region (a floor built on the species total is set by the spike it is meant to defuse, which published thick-lipped grey mullet as "Scarce everywhere"). Thresholds were grid-searched against 16 species with documented ranges and 55 constraints; region `capacity` is a data-derived survey mask from one OBIS `Animalia` pull. Pure and unit-tested; the Brittany and mullet cases are regression tests. |
| `src/components/species/DistributionMap.tsx` | Renders the range sentence plus a six-region presence map (the sentence is the claim, the map is its evidence). Land draws over the sea shading, three shades on a LIGHTNESS ramp (not hue) for colourblind safety, sea names instead of degree graticules, and all six PEBL filming sites from `FARMS`. Pure SVG, no JS, no map library. |
| `scripts/build-coastline.mjs` | Generates `src/data/ne-atlantic-coastline.ts` from Natural Earth 50m land (public domain): clips to the map window, simplifies with Douglas-Peucker, drops specks. **Re-run only if the map window changes, and keep it in step with `VIEW` in `DistributionMap.tsx` or land and the sea-region boxes land on different projections.** |
| `src/lib/biodiversity/refresh.ts` | Shared library for the OBIS/GBIF probability + name-map refresh (used by `db:backfill` and the probabilities cron) |
| `src/lib/biodiversity/refresh-images.ts` | Shared library for the iNat photo refresh (used by `db:refresh-images` and the images cron) |
| `src/lib/biodiversity/inaturalist.ts` | iNaturalist v1 API client (CC-licensed photo fetch with optional life-stage / sex annotation filters) |
| `src/components/SpeciesGallery.tsx` | Photo strip + lightbox for candidate cards and field-note view (portaled, focus-trapped, CC-attributed). Each thumbnail carries a corner **'i' button** (4 Jun 2026) opening an `InfoPopover` (portaled to body so the scroll strip can't clip it, viewport-clamped) with the photo's provenance: reference (author + license), location (`placeGuess`), year (`observedOn`), subject (lifeStage/sex), a "View on iNaturalist/Wikimedia" source link + license-deed chip. The lightbox also shows the location · year line. NB the 'i' onClick captures `getBoundingClientRect()` synchronously into a const before `setInfo`, reading `e.currentTarget` inside the state-updater crashes when React replays the reducer. **`layout="grid"` + `theme="light"` (28 Aug 2026):** a wrapping multi-column photo grid (~2.6x the old thumb tile size) with light-theme-aware loading/empty/error chrome, for the species-guide's "Reference photos" section (`SpeciesGuideContent.tsx`); the default `layout="strip"` + `theme="dark"` is unchanged for the other (dark-surface) call sites. |
| `src/components/AnnotatedSpeciesPhoto.tsx` | **Redesigned 28 Aug 2026: small numbered markers, not rings.** Renders a reference photo with one small numbered marker pinned exactly on each admin-authored diagnostic mark's centre, plus a legend. The original design drew a big semi-transparent ring per mark; that read as visual clutter and was replaced with a marker-only dot. A deterministic separation pass (`separateOverlaps`) nudges two markers apart when their authored centres coincide or nearly do, so a solid dot can't fully hide an identical one beneath it (surfaced by species whose marks both describe a whole-body feature, e.g. a starfish's "five stubby arms" and "pentagon outline"). `scripts/lib/mark-overlay.ts`'s `buildOverlaySvg` mirrors this exact geometry so Gemini's automated grading judges what the app actually renders. Returns null for species without authored marks, so `SpeciesGuideContent`'s field-note fallback (only shown when `!marked`) keeps working for the unauthored long tail. Call sites: `FeedCard.tsx`'s reveal (the old `IdGuideWizard` this fed was deleted the same day in favour of the split-screen redesign; `FeedCard` reimplements the reveal directly) and the species profile page / `SpeciesGuidePopup` via the shared `SpeciesGuideContent`. |
| `src/components/IdGuideWizard.tsx` | 5-step trait funnel (body shape → size → habitat → markings → behaviour). Each step now has a "Why ask this?" disclosure surfacing the marine biologist's rationale (S9-T1). FinalReveal renders AnnotatedSpeciesPhoto above the existing gallery + field note. |
| `src/data/species-images.json` | Per-species fetch manifest: which life-stage / sex buckets to request, plus optional pinned `overrides`. Also carries the optional **`fetchName`** field (1 Aug 2026), read via `src/lib/biodiversity/fetch-name.ts`: for a GROUP-level catalogue entry (`Majoidea`, the UK spider crabs, which are not separable on video) a query at that rank returns the whole clade worldwide, so photo and OBIS pulls are pinned to a representative species (`Hyas araneus`) while rows stay stored under the catalogue key. Honoured by `refresh-images.ts`, `build-species-galleries.ts` and `species-cache.ts` (depth + distribution). Any future group-level entry needs one. |
| `src/lib/idguide/catalogue.ts` | **Validated catalogue loader (4 Jun 2026).** The single typed entry point for the species catalogue: builds a zod schema from the `as const` trait enums in `traits.ts`, validates `species-traits.json` once, and exports `CATALOGUE`. Every consumer imports `CATALOGUE` from here, the old `speciesTraitsData as unknown as SpeciesCatalogue` cast is gone. `catalogue.test.ts` strict-parses the JSON and cross-checks that every species has an alias entry + a curated photo override, so a malformed or half-onboarded species fails CI instead of degrading silently at runtime. |
| `src/data/species-traits.json` | Trait catalogue for the IdGuideWizard (body shape, size, markings, behaviour, habitat, plus the prose `fieldNote`). Read at request time by the wizard's narrowing engine in `src/lib/idguide/narrow.ts`. **57 species as of 4 Jun 2026** (28 fish incl. 2 dragonets, 3 flatfish, 6 crabs, 6 squid/cephalopods, 4 starfish, 4 gastropods, 6 jellyfish). Loaded + zod-validated via `src/lib/idguide/catalogue.ts`, import `CATALOGUE` from there, **never the raw JSON**; `catalogue.test.ts` is the CI gate that rejects an invalid enum value or missing field. Every entry carries `shapeClass` + `movement` (Workstream A). Invert entries carry one optional class-specific "form" trait each: crabs `carapaceTexture` + `crabFeatures`, squid `cephalopodForm` (octopus folded in), starfish `armForm`, gastropods `shellShape`, jellyfish `bellForm` (Workstream C); fish entries omit them. **Fish Rung-3 splitters (3 Jun 2026, `implementation/2026-06-03/fish-silhouette-rung3-review.md`):** two optional fish-only scored traits `bodyDepth` (deep/medium/slender) + `lateralLine` (pale-straight/dark-curved/arched-over-pectoral/indistinct), plus new values `caudal-spot` (markings), `finlets` (finShape), `pelvic-sucker`+`lateral-scutes` (features); duplicate `snake-like` body shape retired (use `eel-like`). Added because 21/26 fish were `fusiform`: re-tagging (deep wrasses/bib → laterally-compressed; gobies → elongated dual-tag; butterfish → eel-like; dragonet/conger trims; sprat → laterally-compressed) + the new traits drop the fusiform bucket to 17 and give the existing `nextBestTrait` Rung-3 picker real discriminating signal (it was already wired in `CandidateStrip`; it just lacked data). **"Bottom scooters" fish Rung-2 bucket (4 Jun 2026):** added a `bottom-scooter` `bodyShape` value + retagged the 2 dragonets (off `flat-dorsoventral`) and the 3 bottom-dwelling gobies (Common/Rock/Sand, added alongside their existing `elongated`/`fusiform`) onto it, so the fish sub-split tile reads "Bottom scooters" (5 species) instead of "Flat, on the bottom" (2). It is an ecology/posture grouping (perch-and-dart seabed fish), per Christian's steer that beginners group gobies with dragonets. `flat-dorsoventral` now belongs only to the 3 flatfish (Plaice/Dab/Flounder). The two-spotted goby stays out (water-column hoverer). Silhouette is an original PEBL filled SVG at `public/silhouettes/forms/bottom-scooter.svg` (no PhyloPic UUID; `fetch-bodyform-silhouettes.cjs` now preserves such hand-authored credits on re-run). All invert content is grounded in `decision-tree/id-guides/` sources: squid from the Cefas cephalopod PDF; starfish/gastropods from Devon WT; jellyfish + every invert name cross-verified against Hayward & Ryland's *Handbook of the Marine Fauna of NW Europe* (2017) on 2 Jun (all 20 names valid; `Steromphala umbilicalis` is the current name for the Handbook's older `Gibbula umbilicalis`; the barrel jelly is `Rhizostoma octopus`, the NE-Atlantic/UK species per WoRMS + MarLIN, not the Handbook's broader-range `R. pulmo`). See `implementation/2026-06-01/`. **Fish Rung-2 family-gestalt restructure (17 Jun 2026, `implementation/2026-06-17/fish-category-review.md`):** the fish Rung-2 gate now cuts on a NEW optional `fishGroup` trait (cod-like / wrasse / silver-shoaler / bottom-sitter / long-skinny / shark), NOT `bodyShape`. Reason: the old `bodyShape` cut piled 20 of 28 fish into one "Torpedo or deep-bodied" bucket (2x the 10-option ceiling) and the deep-vs-torpedo split proved unreliable on a 28-photo vision pass. The six family groups are each <=10 (largest = bottom-sitter, 9) so no fish Rung-3 is needed; `body-forms.test.ts` now enforces the <=10 ceiling + full fish coverage. `bodyShape` stays as a secondary scored descriptor; `fishGroup` is authoritative for the fish gate AND the Rung-3 fallback silhouette. Mis-tags fixed: catshark -> `shark` (off torpedo), sea scorpion grouped `bottom-sitter`, sprat/corkwing `bodyDepth` de-deepened. Six new `public/silhouettes/forms/<fishGroup>.svg` tiles (cod-like + shark authored PEBL CC0; wrasse/silver-shoaler/long-skinny reuse PhyloPic art; bottom-sitter reuses the PEBL gobiid). **Bottom-fish size split (18 Jun 2026):** `bottom-sitter` had hit the 10-species ceiling, so the chunkier seabed fish moved to a new `bottom-other` group, and the two tiles now cut on SIZE (a beginner judges size off a clip far more reliably than goby-vs-gurnard): `bottom-sitter` = **"Small bottom fish"** (6 gobies + dragonets, ~4-8 cm); `bottom-other` = **"Bigger bottom fish"** (gurnards, red mullet, + the bigger sea scorpion + shanny). Long-spined sea scorpion + shanny were re-tagged `size` small→medium so the cut is clean (both 12-17 cm, genuinely bigger than a goby). New `public/silhouettes/forms/bottom-other.svg`; the `cod-like` + `bottom-sitter` silhouettes were redrawn for icon-size clarity (single bold contour, cod's 3 dorsal + 2 anal humps are drawn into the body outline with real negative-space gaps instead of merging into one ridge; the goby is one clean bottom-perched shape instead of a two-fish blob). **SUPERSEDED AT THE GATE, 28 Aug 2026:** the fish Rung-2 tiles no longer cut on `fishGroup` at all. They cut on a new `fishZone` trait (`seabed` / `water-column`), so the gate asks "Where was the fish?" and offers TWO tiles (15 / 18 species) instead of seven family groups. Reason: seven tiles is a lot of reading before the first photo, and each one asked a beginner to name a FAMILY off a short clip, which is the hardest thing on screen rather than the easiest. `fishGroup` is NOT retired: it stays the authoritative family grouping for silhouettes, comparison sets, the food web and `trait-questions.ts`, and `fishZone` is a presentation cut layered over it. It had to be its own trait rather than a bundle of `fishGroup` values because two groups split across both zones: `long-skinny` (conger + butterfish work the bottom, the fifteen-spined stickleback hangs above it) and `bottom-sitter` (the two-spotted goby hovers in mid-water over the kelp). The 10-species Rung-2 ceiling no longer applies to fish; see `body-forms.test.ts`, which now caps OPTIONS at 10 everywhere and BUCKET size at the Rung-3 photo-grid's 24-tile limit. |
| `decision-tree/index.html` (+ `public/decision-tree.html`) | Standalone decision-tree visual built 1 Jun 2026: 8 shape classes -> sub-class -> species with the single best diagnostic per species. The **authoring/teaching artifact** for the Spot It flow, NOT the runtime. View at `http://localhost:3000/decision-tree.html` (served from `public/`). |
| `food-web/build-foodweb.mjs` (+ `public/food-web.html`, `food-web/README.md`) | **"The Food web" (23 Jul 2026).** Interactive food-web diagram of all 72 catalogue species on a seaweed+shellfish farm, rebuilt from PEBL's "Biodiversity Mechanisms" cross-section. 238 prey->predator links (verified vs UK/NE-Atlantic diet records), trophic-tier colour + farm-proximity, click a species to trace what it eats (blue) / what eats it (amber). Has a **with / without-farm toggle**: a `FARM` map classifies each species (21 `created` = gone without the farm, 11 `enhanced` = faded, 1 `harmed` = sea potato does better without, 39 `anyway`); baseline view ghosts the created species + prunes their links (72->51 species, 238->151 links), mode-aware so a selected species' diet contracts. **`created` is deliberately narrow (3 Aug 2026):** only animals that physically cannot occupy bare sediment (hard-substrate obligates + small site-attached weed/crevice fish). Wide-ranging animals a farm merely draws in are `enhanced`, the attraction-vs-production distinction; ballan + cuckoo wrasse and both octopuses were re-graded down on that basis. Self-contained HTML (inline CSS+JS+silhouette sprite). Rebuild: `node food-web/build-foodweb.mjs` (`DUMP=1` prints all diets + a trophic-direction check). Teaching schematic, not a quantified survey. See `food-web/README.md`. |
| `decision-tree/id-guides/*.pdf` | UK marine ID sources. 6 free guides downloaded 1 Jun (EA fish key, Merryweather crabs, Cefas cephalopods, Sussex IFCA, ZSL estuarine, Devon WT rocky shore) + Hayward & Ryland's *Handbook of the Marine Fauna of NW Europe* (2017, OUP, 808pp) added 2 Jun, the authoritative academic reference for all phyla, used to verify invert names/traits. NB the Handbook is 107MB, over the Read tool's 100MB limit: extract via PyMuPDF (`fitz`) per page-range, not the Read tool (see TOC: jellyfish/Scyphozoa p91-100, crustacea p306-463, molluscs incl. cephalopods p478-625, echinoderms p662-687, fish p716-763). |
| `implementation/2026-06-01/*.md` | **Spot It visual ID flow plan** (3 docs + handoff). Start at `implementation-plan.md` for the build; `session-handoff.md` to pick up cold. |
| `scripts/fetch-silhouettes.cjs` | Workstream D / UX-5: pulls one PhyloPic silhouette per gate shape-class via the PhyloPic v2 API, refusing NonCommercial licenses (FishSpotter is a PEBL CIC product) by falling back to a non-NC clade image. Sanitises each SVG, writes `public/silhouettes/<class>.svg`, and records author + license in `src/data/silhouette-credits.json`. Re-run to refresh. |
| `public/silhouettes/*.svg` + `src/data/silhouette-credits.json` | The 8 gate shape-class silhouettes (all CC0 / Public Domain Mark as of 2 Jun 2026) + their attribution. The gate (`ShapeGate.tsx`) tints them via CSS `mask-image` + `bg-current`, so they inherit the tile's brand teal and hover-recolor with zero JS-bundle cost. The hand-drawn inline SVGs in `ShapeGate.tsx` remain as a per-class fallback when a class has no asset (credits-file keys decide which path is used). |
| `src/components/MarinePattern.tsx` + `scripts/build-marine-pattern.cjs` + `scripts/fetch-pattern-silhouettes.cjs` + `public/patterns/*` + `src/data/pattern-silhouette-credits.json` | Decorative WhatsApp-doodle-style marine background (2 Jun 2026). `fetch-pattern-silhouettes.cjs` pulls ~20 extra UK marine taxa from PhyloPic (commercial-safe / non-NC, into `public/patterns/silhouettes/`); `build-marine-pattern.cjs` scatters a **curated UK-only** pool (ink-blobs + non-UK species like `turtle` listed in its `EXCLUDE` set) into a seamless, edge-wrapped tile and rasterises a cheap PNG via `sharp`. `MarinePattern` tiles the PNG via `mask-image` + `background-color: currentColor` (same technique as `ShapeGate`/`UnderwaterBackdrop`); `animated` adds the `fs-pattern-sway` wave loop. Tune density/size/rotation/excludes via the build-script knobs, then re-run it. Dev-only helpers (archived in `scripts/archive/`): `silhouette-contact-sheet.cjs` (curation grid), `preview-pattern.cjs` (in-context mock). |
| `src/lib/useModalFocus.ts` | Shared modal focus-management hook (remember opener + restore, initial focus, Tab trap, Escape, body-scroll lock), the WCAG 2.1.2 contract, extracted from `IdGuideSheet`'s proven implementation. Applied to `MapModal` (which had none, so keyboard users could tab onto the live feed behind the open map). |
| `src/app/auth/layout.tsx` | Shared chrome for all `/auth` routes (signin/forgot/reset/verify): renders an animated `MarinePattern` behind the card and drops the card to 80% white (`[&_.pebl-surface]:bg-white/80`) so the water shows through (frosted feel). Fixes the design-audit F-EMPTY-AUTH-STATES bare-card finding. |
| `implementation/2026-06-02/design-audit.md` | Multi-agent visual/UX design audit (2 Jun 2026) + its implementation status. 12 finder lenses, per-finding adversarial verification, 61 confirmed findings deduped to 21 themes. The one P1 (`MapModal` focus) + 8 quick wins + core-loop fixes are shipped; the remaining systemic P2s (full glyph/radius/touch-target sweeps, editorial auth pages, type tokens) are tracked there. |
| `src/lib/admin.ts` | S9-T1 admin gate: `isAdminUser()` requires BOTH the `@pebl-cic.co.uk` suffix AND a verified email (`emailVerified` non-null), domain alone is not enough because guest-claim (`POST /api/guest/claim`) can write an unverified, arbitrary email into `User.email` (fixed 2026-07-16 Critical audit finding, was a guest->admin escalation). `getAdminSession()`/`requireAdminSession()` do the lookup and redirect non-admins to `/`. Used by the `/admin` layout + the diagnostic-mark server actions + the private per-user answers view on `/u/[id]`. |
| `src/components/landing/*` | Landing-page redesign (2 Jun 2026, `implementation/2026-06-02/landing-redesign.md`). `UnderwaterBackdrop` (depth gradient + drifting CC0 silhouettes + light shafts + bubbles), `HeroPreview` (real looping snippet with a self-playing faux species-pick overlay), `StatsBand` (live clips/species/spotters count-up), `StepCards` (Spot→Compare→Streak, stroked-teal icons + scroll-in stagger), `SpeciesMarquee` (auto-scrolling real `SpeciesImage` photos with `© Author · LICENCE` credit). All on-brand, reduced-motion-safe, off-screen-paused. |
| `src/lib/useInView.ts` | Shared client IntersectionObserver hook (`[ref, inView]`) used by the landing components to pause always-on CSS animations + the hero video when scrolled off-screen. Pairs with the `.fs-paused` utility in `globals.css`. |
| `src/app/admin/layout.tsx` | Single gate + top nav for everything under `/admin`. Carries `robots: noindex` so admin pages never get indexed. |
| `src/app/admin/species/page.tsx` | S9-T1 species catalogue list, pilot gadoids pinned at the top with a "Pilot" badge, mark-count per species via `groupBy`, status pill (Not started / In progress / Published). |
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
- **TypeScript:** `strict: true`. No new `as unknown as` casts on data files, add a zod schema instead (zod is already a dependency).
- **Design tokens:** `npm run lint:tokens` bans arbitrary Tailwind colour/radius values. Use the named tokens (see Design Tokens + UI rules below).
- **Tests:** co-located `*.test.ts` (vitest). Pure logic (scoring, narrowing, matching) must stay covered.
- **Species-guide claims must be sourced, and the page renders nothing that is not.** Any new user-facing factual statement about a species (fact tile, field note, diagnostic mark, diet bullet) needs a binding in `src/data/species-references.json` carrying a passage somebody read, AND its source needs a verification row (`npm run refs:verify`). Missing either one means the claim is silently dropped before rendering. See the "Grounded species guide" section below and `docs/runbooks/ground-a-species-claim.md`.
- **Before pushing:** `npx tsc --noEmit && npm test && npm run lint && npm run lint:tokens`. Add `npm run refs:verify -- --check` when reference data changed.
- **No emoji as UI icons; H.264-only video** (see the dedicated sections below, both are load-bearing invariants).

## Video / Codec Notes (IMPORTANT)

All snippet videos must be **H.264 (avc1)**: Chrome cannot play MPEG-4 Part 2 Visual (mp4v/mpeg4). This was the root cause of videos not playing on the live site.

- As of May 2026: all 30 clips are H.264 (`?v=3` cache-busting on re-uploaded clips)
- 23 clips were already H.264 from the original seed
- 7 clips (the 2020 footage and one SC14 manual track) were mp4v and have been re-encoded
- If adding new clips, always ensure H.264 encoding. Use:
  ```
  ffmpeg -i input.mp4 -c:v libx264 -crf 22 -preset medium -profile:v high -level 4.0 -c:a aac -b:a 128k -movflags faststart output.mp4
  ```
- To re-transcode the DB, run: `npx tsx --env-file=.env.local scripts/transcode-to-h264.ts`

### Quality re-cut (10 Jun 2026): fixed at the TRDesk4 export

The real legibility bottleneck was NOT FishSpotter: the TRDesk4 export
(`track_review_app.py`, `SnippetExporter`) wrote clips with OpenCV's `mp4v`
encoder (MPEG-4 Part 2 Simple Profile, weak, no rate control), and the codec
guard above then re-encoded *that* to H.264, two lossy passes through a poor
intermediate, dropping ~1.8-3.0 Mbps source footage to a mushy ~1.5 Mbps.

- **Export fixed** in TRDesk4: `SnippetExporter.run` now pipes frames to
  `ffmpeg libx264 -crf 16 -preset slow` (single H.264 encode, `+faststart`,
  q95 thumbnail; mp4v fallback only if ffmpeg is absent). Same cv2 frame loop,
  so `bbox_data.json` overlay stays frame-aligned.
- **All 30 live clips re-cut** straight from source via
  `DesktopML/reexport_snippets_hq.py` (re-cuts the exact `clip_start..clip_end`
  range; frame counts verified against metadata) and re-uploaded with
  `scripts/reupload-snippets-hq.ts`. New clips are H.264 High / yuv420p at
  3.4-8 Mbps (faithful to source; source bitrate is the hard ceiling, not the
  encoder anymore).
- Canonical `Fish Spotter Snips` folder on G: was re-exported too, so the
  source-of-record matches what's live.

### Minimum clip duration (28 Aug 2026): 69 clips widened to >= 7s

An audit of all 163 live clips found **57 under 6 seconds, the shortest 1.77s**.
Not a codec or export bug: the frame ranges in the folder names match the
durations exactly, so the manual tracks were simply cut tight around the animal.
A 2 second clip loops before a spotter can look at it. 31 of the 57 were the
Car-Y-Mor batch, i.e. about 60% of that one export.

**The 6 second audit threshold was itself the bug.** Fixing those 57 left 16
more clips sitting between 6 and 7 seconds, which the first sweep never looked
at. They were re-cut in a second round on the same machinery, so the real total
is 69. `npm run check:durations` now takes `--min` precisely so the bar and the
audit can never drift apart again; it defaults to 7.

Each clip was widened EQUALLY either side of its existing window and re-cut from
the raw footage in a single `libx264 -crf 16` pass. For the CYM batch that is a
quality GAIN, since those clips were mp4v then re-encoded to H.264, two lossy
passes over a weak intermediate.

**The alignment trap, and the rule it produced.** `clip_start_frame` indexes
whatever video the snip was cut from, and for CYM that was NOT the raw
recording: `video_name` reads `CYM_Farm_S_2026-05-27_08-00_wrassepollack00006095`,
an intermediate cut from `CYM_Farm_S_2026-05-27_08-00.mp4` at about frame 6095.
Parsing that suffix gets close and is never exactly right (measured offsets sat
0 to 10 frames out, varying per clip). **So the parse only seeds a search
window; the true offset is MEASURED** by matching the snip's own frames against
the raw video at four probe points and requiring the same delta at each. A real
alignment gives one constant delta; a coincidence does not. The first pass
refused 8 clips on that test, and a second pass that scanned the whole source
instead of a hint window recovered all of them at 4/4 agreement, which says the
refusals were the gate working, not the clips being bad.

**`t_norm`, and why the padding needed a frontend change.** `FeedCard`'s trail
renderer had no way to know how far through a clip a track ran, so it stretched
the track across the WHOLE clip. That is right for a tight cut and wrong the
moment a clip has padding: the trace would smear across footage the animal was
never marked in. Every re-cut point now carries **`t_norm`**, its position as a
fraction of the clip's duration, and `src/lib/trackCoverage.ts` turns those into
a coverage window. Inside it the trail draws normally; outside it fades over
`TRACK_FADE_FRACTION` rather than asserting a position nobody recorded. Points
WITHOUT `t_norm` return null coverage, which keeps every older clip on its
original behaviour. **`manualTrackToBoxes` must keep spreading the point** (it
used to copy three fields by name, which silently dropped `t_norm`, and manual
tracks are exactly what the re-cut clips use).

**Three clips could not reach 7s** and are the honest limit, not a failure:
their source IS the extract (`KEL33_...twospotgobyandstar.mp4` is 85 frames, the
clip itself), and the parent recordings match at only 1 of 4 probes, so they are
not simple cuts of it. KEL33 stays 3.55s, KEL37 4.84s, EXO_3 seal 5.03s.

| Tool (in DesktopML) | Purpose |
|---|---|
| `reexport_snippets_min_duration.py` | The re-cut. Backs originals up first, re-cuts from raw, shifts `frame_clip`, stamps `t_norm`, rewrites metadata. Idempotent: refuses a snip already re-cut, since a second run would shift its track AGAIN and slide the trace off the animal silently. `--force` resets from the backup first. |
| `refine_min_duration_alignment.py` | Second pass for clips the first refused. Scans candidate sources end to end, requires 3 of 4 probes to agree, and prefers the aligned source with the MOST footage (stopping at the first match picked a clip's own extract, leaving it zero headroom). |
| `verify_min_duration_recut.py` | The external gate. Checks the re-cut against the BACKUP of the clip it replaced: if aligned, `new[pad_before + k] == old[k]` for every k. That one identity covers the source lookup, the measured alignment, the window arithmetic and the padding at once. Verifying the new clip against itself could only ever prove self-consistency. |

Backups of every replaced snip live in
`DesktopML/data/snip_backups_20260828_min_duration/`.

## Storage provider

The Next.js runtime treats `Snippet.videoUrl` and `Snippet.thumbnailUrl` as opaque public URLs, it never imports the storage SDK. Only the seed and migration scripts upload, and they use the abstraction in `scripts/lib/storage.ts` to pick a provider.

Two providers are supported:

| Provider | Egress fees | Storage | Notes |
|---|---|---|---|
| `supabase` (default) | $0.09/GB on Pro after 5GB free | $25/mo Pro for >1GB | Where snippets live today. Simple. Egress is the surprise line at scale. |
| `r2` | **$0 forever** | 10GB free, then $0.015/GB | S3-compatible. Recommended once seed grows past ~5GB egress/mo (≈10 active users at 5min/day). |

Select with `STORAGE_PROVIDER=r2` or `STORAGE_PROVIDER=supabase` (omit env var to default to supabase, no behaviour change).

**Current state (10 Jun 2026):** the clips were migrated to R2 earlier, but the
quality re-cut (see Video / Codec Notes) was shipped from a machine without R2
creds, so **all 30 snippet rows now point back at Supabase Storage** (HQ). Vercel
still has `STORAGE_PROVIDER=r2`, so any *new* seed/upload lands on R2, i.e.
storage is currently split (30 video rows on Supabase, the old R2 objects are
now orphaned). To re-consolidate onto R2: put the R2_* creds in `.env.local` and
run `npx tsx --env-file=.env.local scripts/reupload-snippets-hq.ts --from "<G: Fish Spotter Snips>"`
with `STORAGE_PROVIDER=r2` (the script is idempotent and cache-busts the DB URLs).

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

**When a task needs accurate image analysis, use this tool, Claude is the
orchestrator, Gemini does the vision** (it is the stronger image model). Built 3
Jun 2026.

- **Lib:** `src/lib/biodiversity/gemini-vision.ts`, `assessImageQuality({ scientificName, commonName?, imageUrl | imageBase64 })`. Downloads the image, posts it inline to the Gemini `generateContent` REST API with `temperature: 0` and a strict JSON `responseSchema`, returns a typed `ImageQuality`. Generic enough to repurpose: change `buildPrompt` + `RESPONSE_SCHEMA` for other vision tasks (counting, OCR, feature extraction).
- **CLI:** `npm run images:assess` (`scripts/assess-image-quality.ts`). Read-only. Modes: `--url <u> --species <s>` (one ad-hoc image, no DB), `--species <s>` (rank all cached `SpeciesImage` rows + recommend the best to pin as `curated`), `--all [--limit N]` (catalogue sweep), `--json`.
- **Auth:** `GEMINI_API_KEY` in `.env.local` (gitignored, never commit, never write to memory/CLAUDE.md). Model via `GEMINI_MODEL` (default `gemini-3.6-flash`, the latest Flash; verify ids against the ListModels API).
- **Quota gotcha (confirmed 3 Jun 2026):** the current key is on the Gemini **free tier (~20 requests/day**, `GenerateRequestsPerDayPerProjectPerModel-FreeTier`). An `--all` catalogue sweep is 150+ images and dies with `429 RESOURCE_EXHAUSTED` partway. The lib retries per-minute 429s but cannot beat the daily cap. For a full sweep: spread small `--species` batches across days, or move the key to a billed/paid project. `gemini-2.5-flash-lite` sometimes has separate quota when the others are exhausted.
- **3.6-flash thinking-budget gotcha (confirmed 22 Jul 2026):** unlike 2.5/3.5-flash, `gemini-3.6-flash` REJECTS `thinkingConfig.thinkingBudget: 0` outright (400 invalid argument), it can't be told to skip thinking. `geminiGenerate()` in `gemini-vision.ts` auto-detects this 400 and retries once with `thinkingConfig` omitted entirely (letting the model pick its own budget), so callers don't need to change. **That retry only actually landed on 29 Aug 2026**: it had lived uncommitted in a working tree since 22 Jul while this file described it as shipped, so on `main` every `assessImageQuality` call against `gemini-3.6-flash` returned a 400. It failed silently rather than loudly, because `build-species-galleries.ts` drops unscored candidates, so the gallery builder was scoring nothing, choosing nothing, and (outside dry-run) would have deleted every existing gallery photo while reporting a clean "+0 new". Treat "the doc says it is fixed" as a claim to check against `git log`, not as evidence. Side effect: every call now spends real thinking tokens (~600 seen in testing) where 3.5-flash spent ~0, so per-call cost is higher and the free-tier daily cap bites sooner than before.
- **Image downloads retry (29 Aug 2026):** the photo CDNs rate-limit by IP, and a batch caller assessing dozens of candidates at once trips that routinely ("Your bot is making too many requests"). `downloadImage` now backs off and retries 429/5xx, because without it a good photo was dropped as "unscored" for a reason that had nothing to do with the photo. Wikimedia candidates are also assessed via their 600px `thumbUrl` render, not the archive original: Commons originals are routinely 10-20MB, over the 8MB inline cap, so they all failed to download and Commons was contributing nothing on exactly the species that needed a second source.
- **Why it exists:** the photo-curation gap. iNat "research grade" means the community agrees on the *species*, not that the photo is a clean single living lateral specimen good for *teaching*. This tool reads the pixels (mixed school? dead beach-cast? engraving? wrong subject like the Aurelia-aurita-photo-of-a-person case?) and scores teaching suitability, so curation isn't a manual eyeball pass.
- **Workflow it slots into:** `db:refresh-images` (populate cache) → `images:assess --species` (find the best photo) → pin it as a `curated` override in `species-images.json` → `db:refresh-images --species` → seed/author diagnostic marks.

## Grounded species guide (provenance)

Every user-facing factual claim on a species guide rests on a passage somebody
read. The audit counts **935 rendered claims** across the 72 catalogue species
(288 fact tiles, 179 diagnostic-mark descriptions, 72 field notes, 396 diet
bullets) and **935 are evidenced**. Run `npm run refs:audit`.

**The guide does not render the Spot It wizard's trait tokens.** Those tokens
(`size` has three values; `habitat` and `behavior` a short controlled
vocabulary) exist to CUT a candidate list off a short clip. They are good
questions and bad facts: the corkwing wrasse read "Small (under 10 cm)" against
its own source's 25 cm, and the harbour crab read "Medium (10-50 cm)" for an
8 cm animal. Tiles read `src/data/species-facts.json`, the wizard keeps its
tokens, and the two no longer have to agree.

**"I eat / Eats me" is not read off the farm food web.** Every row it could show
had to be another catalogue species, which is a statement about our catalogue
rather than about the animal. It reads `src/data/species-diet.json`: up to three
broad statements a side, each bound to a published account. The farm-web trophic
tier is not on the guide. The food-web page and workshop deck still use the
older species-level `diet:eats` / `diet:eatenBy` claims, which the guide ignores.

**Two trust levels, deliberately separate.** `linkVerified` is machine: the URL
resolves and the document says *in its own title* that it is about this species.
`claimSupported` is only ever set from a passage that was actually read. A
script that cannot read the source may never set it. A gate that verifies
against its own subject proves self-consistency and nothing else.

**Only verified sources are shown to a reader.** Unverified citations are held
back in `getSpeciesProvenance`, never rendered with a caveat. **This means a
claim needs BOTH flags to reach the page**, and forgetting the second one is how
8 fact tiles and 89 diet bullets once went live invisible while the audit called
them evidenced: `refs:verify` reaches the network, so a source added without
running it has no verification row and `payload.ts` drops its claims silently.
`src/lib/references/payload.test.ts` gates exactly that, asserting against the
payload the page is HANDED rather than the file it is built from. **After adding
any source, run `npm run refs:verify`**, then `confirm-by-document` for the ones
the live check cannot settle.

**There is no disclaimer on the page.** Both the "How we know this" note and the
food-web footnote were removed, because a page that renders only evidenced
claims cannot be in the state they described. An unsourced tile, ring, bullet or
field note is not rendered at all, and `SourceCite` draws a marker only for a
claim carrying a read passage. That promise is enforced by tests, not by prose.

**Two traps, both hit in practice, both now guarded:**
- MarLIN's common-mussel page names plaice *and* dab in its body, so a
  body-containment match bound two flatfish to a bivalve. The identity test is
  the page `<title>`. BTO is the documented exception (vernacular titles), so it
  matches title-names-the-bird plus body-names-the-binomial.
- FishBase's `TrophicEco/FoodItemsList.php` renders its heading from the URL's
  genus/species but its rows from the stock code, so a constructed URL returns a
  page headed "Food Items - Pollachius pollachius" listing freshwater African
  tilapia prey. **Never construct that URL** - `refs:diet` follows only the link
  FishBase itself publishes, then re-checks the page names the predator.

Also note **FishBase answers in ~30s**, so every fetch of it uses a 90s timeout;
the default clipped it and showed up as intermittent "http 0" misses.

| Command | Purpose |
|---|---|
| `npm run refs:resolve` | WoRMS identity + MarLIN / FishBase / BTO links, each proved by page title. `--fill-gaps` retries only missing sub-sources. |
| `npm run refs:verify` | The external gate: re-checks every link against the live web. `-- --check` for CI, `-- --stale-only` for links older than 30 days. |
| `npm run refs:extract` | Binds field notes, marks, traits and diet to read passages by deterministic section parse. |
| `npm run refs:diet` | Binds individual food-web feeding links to FishBase diet records. |
| `npm run refs:audit` | The scorecard: bound / evidenced / unbound per surface. `-- --queue` lists the work. |

| File | Purpose |
|---|---|
| `src/data/species-references.json` | Source registry + per-species identity and claim bindings. Committed. |
| `src/data/reference-verification.json` | Machine-written verification results. Committed so CI has a baseline. |
| `src/lib/references/schema.ts` | Zod schema (source kinds, claims, support passages). |
| `src/lib/references/catalogue.ts` | Validated loader. **Import `REFERENCES` from here, never the raw JSON.** |
| `src/lib/references/payload.ts` | Server-side provenance payload (verified sources only). |
| `src/lib/references/catalogue.test.ts` | Structural CI gate: no dangling ids, no unciteable source, no hollow `claimSupported`. |
| `src/components/species/SpeciesSources.tsx` | Sources block, taxonomic identity line, superscript markers. |
| `src/app/api/species/references/route.ts` | Serves provenance so the reference catalogue never ships to the browser. |

Pages are cached to `.refs-cache/` (gitignored). Full detail in
**[docs/runbooks/ground-a-species-claim.md](docs/runbooks/ground-a-species-claim.md)**.

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

## Rate limiting

`src/lib/rate-limit.ts` backs every IP/user-keyed limit in the app (auth,
guest claim, answer submission, idguide chat, events, vitals, preview).
Two backends, auto-selected at module load:

- **In-memory (default, no env vars set).** A single process-local `Map`.
  Correct for a single instance, but on Vercel every warm serverless
  instance keeps its own counters, so the effective limit loosens by
  however many instances are warm at once (2026-07-16 audit finding 3.2/6).
- **Redis (Upstash), when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
  are set.** One shared counter regardless of instance count. Uses
  `@upstash/redis`'s REST client (works over HTTP, no persistent connection
  needed, the right shape for serverless) with a fixed-window `INCR` +
  one-time `EXPIRE` per key. Fails OPEN on any Redis error (allows the
  request rather than blocking everyone if Upstash has an outage), a rate
  limiter's job is abuse resistance, not core auth.

All six `checkXRateLimit()` exports are `async` (the Redis path is a real
network call), every call site already awaits them from inside an async
route handler or NextAuth's `authorize()`. To actually enable the shared
store, provision an Upstash Redis database (small free tier is enough for
this app's volume) and set the two env vars above in Vercel; no code
change needed. Client-IP extraction (`x-forwarded-for` first entry,
`x-real-ip` fallback) lives in `src/lib/client-ip.ts`, every rate-limited
route imports it rather than re-parsing headers itself.

## Database

Run scripts with: `npx tsx --env-file=.env.local scripts/<script>.ts`

Seed: `npm run db:seed` (one-time bootstrap, uploads everything)

Incremental sync: `npm run db:sync` (after every TRDesk4 export; uploads/upserts only new or changed snips, reads `SNIPS_DIR`). See `scripts/sync.ts`.

After adding `Snippet.manualTrackJson` (June 2026): run `npm run db:push` once to apply the column, then `npm run db:enable-rls -- --check` (column add keeps RLS, but it is the load-bearing invariant, so confirm it).

### Row-Level Security (RLS): load-bearing security invariant

**Every table in the `public` schema MUST have RLS enabled.** The app reaches
the DB only through Prisma, which connects as the table-owner role and bypasses
RLS, so RLS-with-no-policy is the correct steady state (it blocks the Supabase
PostgREST path without affecting the app). The Supabase **anon key is public**
(it ships in the browser bundle), so any `public` table with RLS *off* is
directly readable by anyone via `/rest/v1/<Table>`, which previously exposed
`User` emails + password hashes and would have exposed `Account` OAuth tokens.

- Canonical statement: `prisma/rls.sql` (a dynamic, idempotent loop that enables
  RLS on all current **and future** public tables, `prisma db push` does not
  manage RLS, so a freshly recreated table lands with RLS off until this runs).
- Apply + verify: **`npm run db:enable-rls`**. Add `-- --check` for a read-only
  audit that exits non-zero if any public table is unprotected (CI-friendly).
- After any `prisma db push` that creates a table, re-run `npm run db:enable-rls`.
  Do NOT add anon/authenticated policies unless a feature genuinely needs the
  client-side Supabase SDK to read a table (none do today).

Schema summary:
- `Snippet`: id, externalId (folder name), videoUrl, thumbnailUrl, site, deployment, depthM, lat, lon, recordingDatetime, **`staffAnswer: String?`** (nullable since S7-T1, null means "no reference identification yet"), bboxJson, manualTrackJson (hand-marked 16-point fish-centre path from TRDesk4's Snip Editor; FeedCard prefers it over bboxJson when drawing the fish-trail)
- `Answer`: userId, snippetId, chosenOption, **`isCorrect: Boolean?`** (null when the snippet has no reference yet), **`points: Int`** (S7-T1; 2 = correct match against reference, 1 = pending bonus on a no-reference snippet, 0 = unmatched guess)
- `User`: id, email, displayName, name
- `SpeciesProbability`: cached OBIS species composition per (lat₀.₁°, lon₀.₁°, depth₁₀m, month) bucket
- `SpeciesNameMap`: cached GBIF resolution of `staffAnswer` → canonical scientific name (only resolved when `staffAnswer` is non-null)
- `SpeciesImage`: cached iNaturalist photo rows keyed on (scientificName, sourceUrl); columns for lifeStage / sex / license / attribution / ordering / curated flag / **`observedOn`** (date or year of the source observation) / **`placeGuess`** (human location of the source observation), the last two added 4 Jun 2026 to power the gallery 'i' provenance popover; both nullable and only populated for iNaturalist rows (Wikimedia/manual carry no structured obs metadata). Manual `overrides` from `src/data/species-images.json` are upserted with `curated=true` and never overwritten by the script.
- `DiagnosticMark` (S9-T1): admin-authored labelled rings on a `SpeciesImage`. Columns: `scientificName`, `speciesImageId` (FK), `order`, `label`, `description`, `overlayX`/`overlayY` (normalised 0..1), `overlayRadius` (normalised to `min(width, height)` so rings stay circular across aspect ratios), `createdBy` (admin email for audit). Indexed on `(scientificName, order)` and `(speciesImageId)`. A species counts as "published" by the wizard once it has >=1 mark; no separate status flag.

## Scoring model: Pebbles (sea-currency redesign, 18 Jun 2026)

> **This supersedes the reference-based S7-T1 model documented below.** PEBL no
> longer hands down an official correct answer, **the crowd is the authority**.
> `Snippet.staffAnswer` is vestigial (ignored by scoring). `Answer.points` now
> holds **Pebbles**, the leaderboard currency. The economy lives in
> `src/lib/pebbles.ts` (pure, unit-tested); the immediate award is in
> `src/app/api/answers/route.ts` and the retro consensus payout in
> `src/lib/consensus.ts`.
>
> Two pillars, no "correctness":
> - **Discovery (immediate, at submit):** base sighting (`PEBBLE_BASE_SIGHTING=5`)
>   + a **First Sighting** / early-spotter bonus (`PEBBLE_EARLY_SPOTTER=[25,12,6]`
>   by arrival order). Awards are locked on first submit, re-guessing can't farm.
> - **Consensus (retro, by the `consensus-rescore` cron):** when
>   `CONSENSUS_THRESHOLD_USERS=3` distinct spotters converge on a normalised name,
>   the leader's camp is credited `PEBBLE_CONSENSUS` (pioneer 30 / joiner 15 /
>   confirmer 8, by arrival tier) × **rarity** (OBIS `SpeciesProbability` at the
>   clip's bucket → `rarityForProbability`, ×1 common … ×5 legendary) × **Current**
>   (a reliability streak of consecutive vindicated calls → `currentMultiplier`,
>   cap ×2.5). Idempotent per-answer credit via `ConsensusEvent.creditedAnswerIds`;
>   `isCorrect` is re-settled to mean "matched the live community leader".
>
> **Anti-herding:** the community histogram is gated behind the spotter's own
> answer (blind submission, `GET /api/snippets/[id]/stats`), so consensus rewards
> measure *independent* agreement. `isContested()` flags split clips in the reveal.
> **Header bag:** `PebbleBag` shows the running total and animates earned pebbles
> into a pouch (`pebble-bus` event → bag). **Migration:** legacy points were
> scaled ×10 via `scripts/migrate-points-to-pebbles.ts`. The day-streak ("Tide")
> was intentionally NOT made a scoring multiplier; it stays a re-engagement badge.

---

### Legacy reference model (S7-T1, 27 May 2026): retired, kept for context

The leaderboard ranks spotters by sum of `Answer.points`, not by raw
correct count. The per-row payout was set by `matchAnswer()` in
`src/lib/answer-matching.ts`:

| Verdict | `isCorrect` | `points` | When |
|---|---|---|---|
| Correct against reference | `true` | `POINTS_CORRECT_REF = 2` | Snippet has a `staffAnswer` and the user's pick matches it (alias-aware) |
| Pending (bonus) | `null` | `POINTS_PENDING_REF = 1` | Snippet has no reference yet, the user's submission is treated as a community hypothesis and earns a flat participation bonus |
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

## Engagement metrics (Climate Action Fund impact, 19 Jun 2026)

First-party, privacy-first measurement so PEBL can show the National Lottery
Climate Action Fund that people are engaging. **Data-minimal by design:** no IP,
user-agent, referrer, or cross-visit device id is ever stored.

- **Capture only what isn't derivable.** New `Event` table logs three types:
  `session_start`, `clip_view`, `clip_watch` (active seconds). IDs, accuracy and
  species-learned are **derived** from `Answer` / `UnlockedSpecies`, never
  duplicated. `Event.sessionId` is a random per-tab id (sessionStorage, dies with
  the tab); `userId` links to an account only while signed in (cascade-delete for
  erasure).
- **Consent-gated end to end.** The cookie banner now offers *Essential only* /
  *Accept* (sets `analytics` in the `pebl_consent` cookie). The client tracker
  (`src/lib/engagement.ts` + `useEngagement.ts`, wired in `FeedPlayer`) no-ops
  without consent via `hasAnalyticsConsent()`; `POST /api/events`
  (consent-gated, same-origin, zod-validated, batched for `sendBeacon`,
  rate-limited) returns 204 and stores nothing if `analytics !== true`.
- **Watch-time** = the active clip's on-screen, tab-visible time, banked in short
  segments (visibility/pagehide/25s-interval) so a close loses ~nothing.
- **Reporting:** `/admin/metrics` (admin-gated) shows aggregate Reach /
  Engagement / Learning; `/api/admin/metrics/export` streams a 90-day per-day CSV
  for funder reports.
- **Demographics** (coastal/region, "connection to the sea") are a **separate,
  later** progressive-onboarding workstream, not collected here.
- **Deploy step:** schema change → run `prisma db push` **then**
  `npm run db:enable-rls` (the `Event` table lands with RLS off until that runs;
  it's Prisma-only/owner-role accessed, so RLS-with-no-policy is correct).

## Probability data flow (OBIS + GBIF)

The fish-probability feature reads from two external APIs at backfill time
**only**: never during user requests. The user-facing API routes read the
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

Required env var: **`CRON_SECRET`**: any long random string; set in Vercel
project settings under the production environment.

### Failure modes

- **OBIS 429 / 5xx**: `refresh.ts` retries 3× with exponential backoff; persistent failure persists an `ERROR` row and continues.
- **OBIS schema drift**: `check-apis.ts` probe C catches missing `species` / `scientificName` / `id` keys before they corrupt the cache.
- **GBIF unresolved name**: stored with `scientificName=null`; the probability route falls back to `staffAnswerScientific=null` and the UI hides the staff-answer badge.
- **Cron auth fail**: returns 401; check `CRON_SECRET` is set in Vercel production env.

## "Spot It": visual ID flow (SHIPPED)

A shape-class-first, scored-by-rung identification game layered over the feed
clips, fed from British marine ID guides. **Shipped and live**: runtime architecture in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Original plan
in `implementation/2026-06-01/`, read `session-handoff.md` first, then
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
  24 tiles, ordered by likelihood), tap a tile to compare, then commit; (4)
  reveal with diagnostic-mark rings + commit. **NB:** the adaptive yes/no
  "narrowing engine" (`CandidateStrip.tsx` + `trait-questions.ts`) from the
  original spec is **NOT currently wired into the runtime**: it is orphaned
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
- **Long pole:** catalogue content (Workstream C), editorial, needs marine-
  biologist sign-off; the gate is hollow until each shape class has >= 3 species.

## Changelog / shipped history

The dated, session-by-session shipping log lives in **[docs/CHANGELOG.md](docs/CHANGELOG.md)**
(moved out of this file 2026-06-04 to keep CLAUDE.md a stable reference). Append new
milestones there, not here.

## Deploy region (vercel.json)

`vercel.json` pins `"regions": ["dub1"]` (Dublin). **Do not remove it and do not
add a comment key beside it**: Vercel validates `vercel.json` strictly and
rejects unknown top-level properties, so a `"//regions"` note fails the deploy.
The reasoning lives here instead.

The Postgres instance is Supabase **West EU (Ireland)**. With no region pinned,
Vercel picks a US default: measured 29 Aug 2026, every route returned
`X-Vercel-Id: lhr1::iad1::...`, i.e. the edge answered from London while the
function ran in Washington DC. Every DB round-trip on `/feed`, `/leaderboard`
and the auth routes therefore crossed the Atlantic and came back. `dub1` puts
the function next to the database.

Check it after any deploy with:

```bash
curl -sI https://fish-spotter.vercel.app/feed | grep -i x-vercel-id
```

The middle segment is the function region and should read `dub1`.

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
GEMINI_MODEL=gemini-3.6-flash     # optional override (default gemini-3.6-flash)
SENDGRID_API_KEY=...              # transactional email (src/lib/email/client.ts), replaced Resend
CRON_SECRET=...                   # required in production for /api/cron/*

# Rate limiter shared store (optional, see "Rate limiting" section below)
UPSTASH_REDIS_REST_URL=...        # both unset -> falls back to in-memory (per-instance) limiting
UPSTASH_REDIS_REST_TOKEN=...

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
