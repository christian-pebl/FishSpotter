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
| `scripts/seed-fish-marks.ts` | Bulk fish DiagnosticMark seeder (2 Jun 2026). Covers **21 fish species** across 4 batches: gadoids (Saithe, Bib/Pouting, Poor Cod, Atlantic Cod), wrasses (Ballan, Cuckoo, Corkwing, Goldsinny), gobies/benthic (Two-spotted Goby, Common Goby, Rock Goby, Sand Goby, Butterfish, Shanny, Long-spined Sea Scorpion), and pelagic/schooling (Horse Mackerel, Atlantic Mackerel, Sprat, Sand Smelt, Sea Bass, Thick-lipped Grey Mullet). Idempotent — skips species that already have marks. Requires a curated `SpeciesImage` row per species (add to `species-images.json` overrides + run `db:refresh-images --species` first). Run via `npx tsx --env-file=.env.local scripts/seed-fish-marks.ts`. |
| `scripts/reauthor-upgraded-fish-marks.ts` | One-off (3 Jun 2026, kept for reference). Re-authors 3 draft `DiagnosticMark`s each for the 4 fish whose curated photo was upgraded in the Gemini quality pass (Rock goby, sea bass, butterfish, horse mackerel) — their old draft marks went dormant when the old photos were demoted to `curated=false`. Coords read off the NEW curated photo; attaches to the lowest-ordering curated `SpeciesImage`; idempotent (skips if the curated photo already has marks). Run via `npx tsx --env-file=.env.local scripts/reauthor-upgraded-fish-marks.ts`. |
| `scripts/seed-gadoid-marks.ts` | Inserts starter `DiagnosticMark` rows for the gadoid pilot (pollack, bib, cod), 3 per species. Idempotent (skips species that already have marks) and warns if a species has no `SpeciesImage` row cached. Defaults assume a left-facing lateral fish photo; coords usually need tuning in `/admin/species/[name]` after seeding. Run via `npm run db:seed-gadoid-marks`. |
| `scripts/adjust-gadoid-marks.ts` | One-off (kept in tree for reference) that applies the 27 May marine-biologist review: mirrors pollack coords for the right-facing iNat photo, and deletes the bib + cod seed marks because their iNat photos (mixed school, dead beach-cast) are unsuitable for teaching. Only touches rows tagged `createdBy = seed-script@pebl-cic.co.uk` so admin edits are safe. |
| `scripts/audit-reference-ids.ts` | Q4-B1 diagnostic (read-only). Groups `Snippet.staffAnswer` by normalised label, joins SpeciesNameMap resolution, and proposes a per-label action: `keep` (species-level binomial), `backfill` (identifiable but coarse, needs a human binomial), `nullify` (indeterminate like "Fish"/"Crab" -> should become a no-reference snippet), `none` (already null). Run `npm run db:audit-references` (add `-- --json` for a machine dump). Never writes; the approved backfill/nullify + retro-score is a separate step. |
| `scripts/confusion-matrix.ts` | Q4-B3 diagnostic (read-only). Ranks `(reference, guessed-as)` pairs from incorrect Answers (`isCorrect=false`), grouped by the live matcher's normalise key, plus a most-confused-reference rollup. This is the authoring brief for mark expansion (where the wizard most needs a discriminating mark). Run `npm run db:confusion-matrix` (`-- --limit N`, `-- --json`). Note: junk references like "Fish"/"Crab" dominate until they're nullified via the audit above. |
| `src/lib/biodiversity/gemini-vision.ts` | **Gemini vision client (image quality tool).** Claude orchestrates; Gemini 3.5 Flash (override `GEMINI_MODEL`) does the actual vision. `assessImageQuality()` downloads a photo, sends it inline to Gemini with a strict JSON `responseSchema`, and returns a teaching-suitability assessment (subjectType, individualCount, condition, view, nonPhotographic, focus/lighting/framing/occlusion/diagnostic-feature scores 0..100, teachingScore + ideal/usable/poor/reject + a one-line note). Never throws on expected failures (returns `{ok:false,error}`); retries 429/503/500. Reads `GEMINI_API_KEY` from `.env.local` (gitignored, never commit). This is the escape hatch for the photo-curation gap: iNat "research grade" = community ID agreement, not photo composition. **Use this tool whenever a task needs accurate image analysis.** |
| `scripts/assess-image-quality.ts` | CLI for the image quality tool. `npm run images:assess -- --species "Labrus mixtus"` ranks every cached `SpeciesImage` row for a species and recommends which to pin as a `curated` override; `--url <u> --species <s>` scores one ad-hoc image (no DB); `--all [--limit N]` sweeps the catalogue; `--json` for a machine dump. Read-only (never writes the DB). |
| `scripts/build-species-galleries.ts` | **Gallery builder (4 Jun 2026).** Fills each species' reference GALLERY (the photo strip shown in `SpeciesGuidePopup` / `SpeciesGallery` at the Rung-3 decision point) to a clean TARGET (default 8) of Gemini-vetted teaching-grade photos. Per species: keeps every `curated` row untouched (the diagnostic-mark reference + its marks stay first), builds a candidate pool (existing non-curated rows + a fresh iNat vote-ranked pull + Wikimedia top-up when thin, deduped by observation, minus blocklist), assesses EVERY candidate with the Gemini-vision tool, writes the best (alive / photographic / in-frame / single-specimen) as `curated=false` rows ordered by score, DELETES the non-curated mark-free leftovers that didn't make the cut, and adds the dead/wrong/drawing rejects to `photo-blocklist.json` so the weekly cron can't re-add them. Photos live in the DB (not git); blocklist additions ARE committed. Run `npx tsx --env-file=.env.local scripts/build-species-galleries.ts --all` (`--species "X"`, `--slice a:b` for parallel shards, `--target 8`, `--pool 24`, `--min 4`, `--dry-run`, `--no-delete`). Needs `GEMINI_API_KEY`. First full run (4 Jun): 57 species, +306 photos, 86 junk rows deleted, 392 blocklist entries, 385 gallery rows total (~6.75 avg). Genuine open-source ceilings (mostly-dead-specimen food fish) left short: Sprat (2), Atlantic mackerel (2), Barrel jelly (3), + several at 4. |
| `src/lib/biodiversity/refresh.ts` | Shared library for the OBIS/GBIF probability + name-map refresh (used by `db:backfill` and the probabilities cron) |
| `src/lib/biodiversity/refresh-images.ts` | Shared library for the iNat photo refresh (used by `db:refresh-images` and the images cron) |
| `src/lib/biodiversity/inaturalist.ts` | iNaturalist v1 API client (CC-licensed photo fetch with optional life-stage / sex annotation filters) |
| `src/components/SpeciesGallery.tsx` | Photo strip + lightbox for candidate cards and field-note view (portaled, focus-trapped, CC-attributed) |
| `src/components/AnnotatedSpeciesPhoto.tsx` | S9-T1: renders a reference photo with numbered SVG rings + legend for admin-authored diagnostic marks (used in the IdGuideWizard's final reveal). Returns null for species without authored marks, so the existing thumb-strip + field-note path keeps working as fallback. |
| `src/components/IdGuideWizard.tsx` | 5-step trait funnel (body shape → size → habitat → markings → behaviour). Each step now has a "Why ask this?" disclosure surfacing the marine biologist's rationale (S9-T1). FinalReveal renders AnnotatedSpeciesPhoto above the existing gallery + field note. |
| `src/data/species-images.json` | Per-species fetch manifest: which life-stage / sex buckets to request, plus optional pinned `overrides` |
| `src/data/species-traits.json` | Trait catalogue for the IdGuideWizard (body shape, size, markings, behaviour, habitat, plus the prose `fieldNote`). Read at request time by the wizard's narrowing engine in `src/lib/idguide/narrow.ts`. **54 species as of 2 Jun 2026** (26 fish, 1 flatfish, 1 scooter, 6 crabs, 6 squid/cephalopods, 4 starfish, 4 gastropods, 6 jellyfish). Every entry carries `shapeClass` + `movement` (Workstream A). Invert entries carry one optional class-specific "form" trait each: crabs `carapaceTexture` + `crabFeatures`, squid `cephalopodForm` (octopus folded in), starfish `armForm`, gastropods `shellShape`, jellyfish `bellForm` (Workstream C); fish entries omit them. **Fish Rung-3 splitters (3 Jun 2026, `implementation/2026-06-03/fish-silhouette-rung3-review.md`):** two optional fish-only scored traits `bodyDepth` (deep/medium/slender) + `lateralLine` (pale-straight/dark-curved/arched-over-pectoral/indistinct), plus new values `caudal-spot` (markings), `finlets` (finShape), `pelvic-sucker`+`lateral-scutes` (features); duplicate `snake-like` body shape retired (use `eel-like`). Added because 21/26 fish were `fusiform`: re-tagging (deep wrasses/bib → laterally-compressed; gobies → elongated dual-tag; butterfish → eel-like; dragonet/conger trims; sprat → laterally-compressed) + the new traits drop the fusiform bucket to 17 and give the existing `nextBestTrait` Rung-3 picker real discriminating signal (it was already wired in `CandidateStrip`; it just lacked data). All invert content is grounded in `decision-tree/id-guides/` sources: squid from the Cefas cephalopod PDF; starfish/gastropods from Devon WT; jellyfish + every invert name cross-verified against Hayward & Ryland's *Handbook of the Marine Fauna of NW Europe* (2017) on 2 Jun (all 20 names valid; `Steromphala umbilicalis` is the current name for the Handbook's older `Gibbula umbilicalis`; the barrel jelly is `Rhizostoma octopus`, the NE-Atlantic/UK species per WoRMS + MarLIN, not the Handbook's broader-range `R. pulmo`). See `implementation/2026-06-01/`. |
| `decision-tree/index.html` (+ `public/decision-tree.html`) | Standalone decision-tree visual built 1 Jun 2026: 8 shape classes -> sub-class -> species with the single best diagnostic per species. The **authoring/teaching artifact** for the Spot It flow, NOT the runtime. View at `http://localhost:3000/decision-tree.html` (served from `public/`). |
| `decision-tree/id-guides/*.pdf` | UK marine ID sources. 6 free guides downloaded 1 Jun (EA fish key, Merryweather crabs, Cefas cephalopods, Sussex IFCA, ZSL estuarine, Devon WT rocky shore) + Hayward & Ryland's *Handbook of the Marine Fauna of NW Europe* (2017, OUP, 808pp) added 2 Jun — the authoritative academic reference for all phyla, used to verify invert names/traits. NB the Handbook is 107MB, over the Read tool's 100MB limit: extract via PyMuPDF (`fitz`) per page-range, not the Read tool (see TOC: jellyfish/Scyphozoa p91-100, crustacea p306-463, molluscs incl. cephalopods p478-625, echinoderms p662-687, fish p716-763). |
| `implementation/2026-06-01/*.md` | **Spot It visual ID flow plan** (3 docs + handoff). Start at `implementation-plan.md` for the build; `session-handoff.md` to pick up cold. |
| `scripts/fetch-silhouettes.cjs` | Workstream D / UX-5: pulls one PhyloPic silhouette per gate shape-class via the PhyloPic v2 API, refusing NonCommercial licenses (FishSpotter is a PEBL CIC product) by falling back to a non-NC clade image. Sanitises each SVG, writes `public/silhouettes/<class>.svg`, and records author + license in `src/data/silhouette-credits.json`. Re-run to refresh. |
| `public/silhouettes/*.svg` + `src/data/silhouette-credits.json` | The 8 gate shape-class silhouettes (all CC0 / Public Domain Mark as of 2 Jun 2026) + their attribution. The gate (`ShapeGate.tsx`) tints them via CSS `mask-image` + `bg-current`, so they inherit the tile's brand teal and hover-recolor with zero JS-bundle cost. The hand-drawn inline SVGs in `ShapeGate.tsx` remain as a per-class fallback when a class has no asset (credits-file keys decide which path is used). |
| `src/components/MarinePattern.tsx` + `scripts/build-marine-pattern.cjs` + `scripts/fetch-pattern-silhouettes.cjs` + `public/patterns/*` + `src/data/pattern-silhouette-credits.json` | Decorative WhatsApp-doodle-style marine background (2 Jun 2026). `fetch-pattern-silhouettes.cjs` pulls ~20 extra UK marine taxa from PhyloPic (commercial-safe / non-NC, into `public/patterns/silhouettes/`); `build-marine-pattern.cjs` scatters a **curated UK-only** pool (ink-blobs + non-UK species like `turtle` listed in its `EXCLUDE` set) into a seamless, edge-wrapped tile and rasterises a cheap PNG via `sharp`. `MarinePattern` tiles the PNG via `mask-image` + `background-color: currentColor` (same technique as `ShapeGate`/`UnderwaterBackdrop`); `animated` adds the `fs-pattern-sway` wave loop. Tune density/size/rotation/excludes via the build-script knobs, then re-run it. Dev-only helpers: `silhouette-contact-sheet.cjs` (curation grid), `preview-pattern.cjs` (in-context mock). |
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

## "Spot It" — visual ID flow (PLANNED, 1 June 2026)

A shape-class-first, scored-by-rung identification game layered over the feed
clips, fed from British marine ID guides. **Designed, not yet built.** Full plan
in `implementation/2026-06-01/` — read `session-handoff.md` first, then
`implementation-plan.md`.

- **The model (revised from a naive 5-level funnel):** a hard **Shape-class
  gate** (Crab / Fish / Flatfish / Scooter / Jellyfish / Starfish / Gastropod /
  Squid) + one shallow **sub-split** + an **adaptive bag of weighted traits**,
  with **Context as a silent prior** the app already computes from snippet
  metadata (`SpeciesProbability`/OBIS). Movement is a scored trait, not a level.
- **It is an evolution, not a rewrite.** Runtime = `IdGuideWizard` + `narrow.ts`
  + `MCQCandidatePicker` + `AnnotatedSpeciesPhoto` + `DiagnosticMark` +
  `SpeciesProbability`. New code = shape as a hard filter, an information-gain
  next-question picker (`src/lib/idguide/next-trait.ts`, planned), and
  scored-by-rung in `answer-matching.ts`.
- **The four rungs:** (1) shape gate silhouette grid; (2) visual sub-split;
  (3) adaptive trait prompts (auto-stop at `NARROW_ENOUGH=3`); (4) reveal with
  diagnostic-mark rings + commit. A persistent shrinking candidate strip is the
  engagement engine. "Not sure" at every rung; "skip to guess" jumps to the MCQ.
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

## Current State (May 2026)

- Video playback is working on fish-spotter.vercel.app after H.264 transcode fix
- Feed, browse archive, leaderboard pages all working
- Species quiz with community stats working
- BBox tracking overlay (Catmull-Rom smooth trail) working
- Debug strip has been removed (was temporary diagnostic tool)
- Species image gallery feature **activated 18 May 2026** — `SpeciesImage` table populated (113 rows across 26 species), `CRON_SECRET` set in Vercel, weekly cron live.
- **Invert photo cache populated 2 Jun 2026** (Section 2a, `implementation/2026-06-02/section-2-invert-content.md`) — ran `db:refresh-images --stale-only` so all 26 Workstream-C inverts (crab/squid/starfish/gastropod/jellyfish) now carry 3-5 `SpeciesImage` rows each (iNat, with Wikimedia top-up where iNat was thin). 0 inverts with zero rows; verified via the `/api/species-images/<sci>` route. This unblocks invert MCQ thumbnails + reveal gallery. Invert *snippets/footage* in the feed are still outstanding (Section 2b, footage-dependent). Photos live in the DB, not git.
- **Landing page redesigned 2 Jun 2026** (`implementation/2026-06-02/landing-redesign.md`) — the flat text-only `/` page became an "underwater" hero: a real looping snippet with a self-playing species-pick overlay, drifting CC0 silhouettes + light shafts + bubbles, a live clips/species/spotters count-up, a real-photo species marquee, and visual Spot→Compare→Streak step cards. Server component pulls live Prisma data; distractors are shape-class-aware; all motion is reduced-motion-safe and pauses off-screen (`src/lib/useInView.ts`). Verified: `tsc` clean, `lint:tokens` exit 0, `build` clean. Known follow-up: only 2/54 species have a curated reference photo, so marquee/MCQ photo quality is editorial debt (tracked separately).
- **Visual/UX design audit + fixes + marine auth background, 2 Jun 2026** (`implementation/2026-06-02/design-audit.md`, commit `4a74a2d`) — a multi-agent audit (12 finder lenses, per-finding adversarial verification, 61 confirmed findings → 21 themes) drove three things, all shipped + `tsc`/`build` green: (1) the one **P1**, a shared `src/lib/useModalFocus.ts` hook (trap + restore + scroll-lock) applied to `MapModal`, which previously let keyboard users tab onto the live feed behind the open map; (2) **8 quick wins** — Unicode status glyphs → stroked SVGs (profile/RarityPanel/SnippetPlayer/browse/admin), verdict + `danger` tokens for semantic pills, `white/35`→`/60` contrast lifts on the dark feed panels, `motion-reduce:animate-none` on every skeleton, deterministic browse "Open" badge contrast, leaderboard+signin CSS-var→Tailwind-alias, `teal-800` (lighter than 600) renamed to `teal-hover`, cookie button "Dismiss"→"Got it"; (3) **core-loop hierarchy** — demoted the duplicate "Help me identify" CTA so "Spot It" is the single guided entry, separated the "Where is this?" utility action, and moved the feed panel + MCQ tiles to `rounded-card`/`rounded-modal`. Plus a **WhatsApp-doodle marine background** behind all `/auth` pages (`src/app/auth/layout.tsx` + `MarinePattern`): a seamless tile of **21 UK** CC0/PD PhyloPic silhouettes (non-UK like turtle + ink-blobs excluded), tinted teal via `mask` + `currentColor`, gentle `fs-pattern-sway` wave, 80% translucent card — fixing the audit's bare-auth-page finding (F-EMPTY-AUTH-STATES). Remaining systemic P2s (full glyph/radius/touch-target sweeps, type-token + editorial-auth work) tracked in the audit doc.
- **Wikimedia top-up false-positive found + remediated 2 Jun 2026** — while curating for 2c, the `Aurelia aurita` cache held a Wikimedia photo of a *person* (file `Aurelia_Aurita_..._Fnac` named after someone called Aurélia, not the species). Root cause: `fetchPhotosFromWikimedia` searches by filename/description text, so it can return wrong-subject photos, historical engravings (Haeckel/Iconographia plates) and non-web `.tif`s. Fixes: (1) added `looksNonPhotographic()` to `src/lib/biodiversity/wikimedia.ts` (rejects `.tif/.svg/.pdf/...` + plate/engraving/print/lithograph/old-year titles; 3 unit tests); (2) **purged all 40 Wikimedia invert rows** so every shipped invert photo is now iNat research-grade (content-verified by community ID) — every invert still has >=1 iNat photo. The text-match filter still cannot catch a wrong-subject *modern photo*, which is why teaching content (`DiagnosticMark`) is gated to `curated` photos. Going forward, prefer **viewed curated overrides** in `species-images.json` for inverts over the Wikimedia top-up.
- **2c invert DiagnosticMark pilot started 2 Jun 2026** — proved the full pipeline on Moon Jellyfish: pinned a viewed CC-BY-SA Luc Viatour photo as a `curated` override, then seeded 3 starter marks (four gonad rings / four frilly oral arms / short tentacle fringe) via `scripts/seed-invert-marks.ts` (sibling of `seed-gadoid-marks.ts`; attaches to the lowest-ordering *curated* photo, idempotent). Verified the `/api/species-images/Aurelia aurita` route returns the curated photo first with all 3 marks (so `AnnotatedSpeciesPhoto` renders them in the wizard). - **Jellyfish tile fully marked 2 Jun 2026** — extended the pilot to the whole tile: viewed iNat candidates and pinned a curated lead photo for all 6 jellyfish (Moon = Luc Viatour CC-BY-SA; the other 5 = curated CC-BY-NC iNat observations in `species-images.json` overrides), then seeded draft marks via `seed-invert-marks.ts` (Moon 3, Compass 3, Lion's Mane 2, Barrel 2, Blue 2, Mauve 3 = 15 marks). All 6 verified via `/api/species-images` returning the curated photo first with its marks. Coords are starter drafts for `/admin/species` tuning.
- **Fish DiagnosticMarks: 21 species seeded, 2 Jun 2026** (commits `e2d8933`, `3229c46`, `057d8de`, `e3246de`) — `scripts/seed-fish-marks.ts` authored draft marks for 4 batches: **gadoids** (Saithe, Bib/Pouting, Poor Cod, Atlantic Cod — completing the S9-T1 pilot), **wrasses** (Ballan, Cuckoo, Corkwing, Goldsinny), **gobies/benthic** (Two-spotted Goby, Common Goby, Rock Goby, Sand Goby, Butterfish, Shanny, Long-spined Sea Scorpion), and **pelagic/schooling** (Horse Mackerel, Atlantic Mackerel, Sprat, Sand Smelt, Sea Bass, Thick-lipped Grey Mullet). Each batch required curated iNat photo overrides in `species-images.json`. Draft mark coords are starters; tune in `/admin/species/[name]`. Combined with the S9-T1 gadoid pilot (Pollack seeded earlier) this brings the admin-authored fish set to **22 species** with draft marks in the DB.
- **Remaining 20 inverts (crab/squid/starfish/gastropod) follow the same steps:** view cached photos -> pin the best as a curated override in `species-images.json` -> add a draft to `INVERT_DRAFTS` in `scripts/seed-invert-marks.ts` -> `db:refresh-images --species` -> run the seeder -> tune coords in `/admin/species`.
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
- **Q3B-T1 (CI URL-parse fix, 27 May 2026)**: `next.config.mjs` was crashing in GH Actions for 10+ commits because `new URL(SUPABASE_URL)` threw on a malformed secret value, killing `next dev` before Playwright / Lighthouse / Codec guard could start. Wrapped in try/catch so unparseable URLs degrade gracefully (no host whitelisted; image loads from that host would fail but the app boots). No production behaviour change when the URL is valid.
- **Q3A-T4 (photo-quality gate, 27 May 2026, evening)**: diagnostic marks now only render on `SpeciesImage` rows with `curated = true`. Three enforcement points:
  - `/api/species-images/[scientificName]` strips marks from non-curated photos before responding.
  - `createMark` server action throws if the target photo is non-curated. The admin UI surfaces this proactively: species with photos cached but none curated get an amber notice + curation instructions instead of the annotator.
  - Migration: `scripts/migrate-curated-flag.ts` (run via `npm run db:migrate-curated-flag`) flips any photo that already hosts authored marks to `curated = true`. Run once on 27 May; flipped 1 photo (pollack's iNat reference) so the existing 3 marks didn't go dark when the gate shipped. Idempotent.
  - Net effect: iNat photos can't be silently promoted to "this is the canonical reference for teaching" just because they were the first thing the cron fetched. Add to `src/data/species-images.json` overrides (with `curated: true`) and re-run `db:refresh-images` before authoring marks.
- **Rung 2 as a draggable dark gate + "Examples" (3 Jun 2026)** (`implementation/2026-06-03/rung2-bodyshape-examples-plan.md`, commit `f15a780`, merged to main) — the body-shape sub-split (Rung 2) was lifted out of the inline `CandidateStrip` box and made a draggable dark card that matches the Rung-1 shape gate. The gate chrome (draggable floating card, drag-from-grip, "Hide", focus trap, body-scroll lock, tile grid + Not-sure/Skip footer) was **extracted into a reusable `src/components/idflow/TileGate.tsx`** (+ `MaskSilhouette`); `ShapeGate` now renders from it (Rung 1 behaviour unchanged) and the new `src/components/idflow/BodyShapeGate.tsx` renders Rung 2 from it. Each Rung-2 tile is a body-form silhouette (the existing PhyloPic `public/silhouettes/forms/<value>.svg` assets, tinted via mask-image; **bespoke art drops in over the same filenames, no code change** — the 2 forms without an asset, `flat-dorsoventral` + `no-shell`, show a neutral placeholder) with a per-tile **"Examples" button** → `src/components/idflow/BodyFormExamples.tsx`, a focus-trapped portaled popup of real CC-attributed photos of catalogue species with that body form (reuses `SpeciesGallery`; teaching aid only, never commits a guess; the gate `suspendKeyboard`s while it's open so the two focus traps don't fight). The `SUB_SPLITS` table + helpers were lifted to **`src/lib/idflow/body-forms.ts`** (one source of truth; `bodyFormConfigFor`, `exampleSpeciesForForm`). `FeedCard` routes Rung1 → Rung2 (only for classes whose sub-split discriminates, i.e. not crab/flatfish/scooter) → strip, `seed`ing the chosen form into the strip's narrowing and suppressing its now-redundant inline sub-split. Validated: tsc, lint, lint:tokens, prod build, 205 tests (4 new in `body-forms.test.ts` prove every form maps to ≥1 photographed species so no Examples button is ever empty). NB the live interactive preview couldn't be driven (the feed's IntersectionObserver scroll container doesn't respond to the eval harness); static gates + the user's on-device check are the verification path.

- **Rung 3 species-tile guide popup (3 Jun 2026)** — tapping a species tile in the Rung-3 `CandidateGate` no longer commits the guess instantly. It now opens **`src/components/idflow/SpeciesGuidePopup.tsx`**, a portaled focus-trapped "flash card" that surfaces, in one place, the three things we author per species: (1) the diagnostic guide (`AnnotatedSpeciesPhoto` numbered circles on the curated photo — renders nothing if the species has no marks), (2) a `SpeciesGallery size="large"` photo gallery + lightbox, (3) the `fieldNote` prose from the trait catalogue. A **"This is my pick"** button commits via the existing `onPick` path; "Back"/"Keep looking" dismisses without committing. This is what makes the diagnostic-mark guide reachable in the live app (previously only the post-submit reveal + the wizard's FinalReveal rendered it, so most users never saw it). Focus management is inline (mirrors `useModalFocus`) but **guards Escape/Tab while the gallery's own lightbox (z-[100], `aria-modal="true"`) is open** so one keypress can't close both; `CandidateGate` passes `suspendKeyboard` to the gate so it goes `inert` underneath. Decided entry point = the live ID-flow tiles (not a separate dex page); MCQ tiles still commit instantly (fast path preserved). Validated: tsc, eslint, prod build, `/feed` route compiles + 200. Interactive tap-through is on-device (harness can't drive the feed's IntersectionObserver). Photo-quality curation to feed better gallery images is gated on Gemini quota (see the image-analysis tool section: free tier ~20 req/day).
- **Marks-on-bad-photo fix (3 Jun 2026, `scripts/reauthor-quality-flagged-marks.ts`)** — the Gemini sweep found 7 species whose CURATED, mark-bearing photo was a dead/poor/multi specimen (so the wizard drew rings on a dead fish). Each already had a good curated lead photo at `ordering=1` with 0 marks; `AnnotatedSpeciesPhoto` renders "the first photo WITH marks", so it showed the bad one. The script moves each species' marks onto the good lead photo with fresh coordinates (placed by viewing each photo, orientation-verified, then render-checked), keeps the label/description text, and deletes the old dead photo (all 7 are already in `photo-blocklist.json`, so deletion is durable). Species: Bib, Shanny, Poor cod, Veined squid, Painted top shell, Barrel jelly, Cuckoo wrasse. Verified via `/api/species-images` (each now returns the good lead photo with its marks first). Idempotent (skips a species whose good photo already has marks). DB changes are live on prod. (Two borderline species — Common Limpet + Moon Jelly, "usable" multi-specimen — left as acceptable.)
- **Diagnostic-ring polish + alignment fix + Gemini verification (3 Jun 2026)** — three things: (1) `AnnotatedSpeciesPhoto.tsx` rings are now thinner (`ringStroke` `S*0.006`→`S*0.004`) and the numbered badge sits just OUTSIDE the ring on the first in-frame diagonal (UR→UL→LR→LL) instead of on the ring edge, so a number never covers the feature and never clips off-frame near an edge. (2) **Latent alignment bug fixed**: `AnnotatedSpeciesPhoto` builds its SVG viewBox from the stored `width`/`height` and falls back to a 1000×1000 square (4/3 container) when null, skewing every ring on non-square photos. `scripts/backfill-image-dims.ts` (`npm run db:backfill-image-dims`) reads true pixel size from each JPEG/PNG header and backfilled **33 SpeciesImage rows** that had null dims (incl. portrait crab/whelk/limpet photos that were badly skewed). The admin annotator places coords as fractions of an `object-cover` container at the stored aspect, so once true dims are set the public component matches the authoring intent. (3) **Verification via Gemini 3.5 Flash**: rendered each annotated photo with the exact component geometry and had Gemini check, per mark, that the ring is centered on its labelled feature and the badge doesn't obscure it; iterated coords until clean. The 7 re-authored species verify 19/20 (the one residual — Barrel jelly's frilly arms — is `onFeature=True`, badge just clips a frame-filling feature). NB the **parallel-authored marks on the other ~14 null-dim species** (Edible Crab pie-crust, Horse Mackerel eye, Dog Whelk aperture-not-visible-in-dorsal-view, Hyas ring clutter, etc.) have their own pre-existing placement imprecision that the dim fix surfaced; they want the same Gemini verify+fix pass. The reusable verify recipe: render with component geometry, send to Gemini with a per-mark `{onFeature, badgeClear, note}` schema.
- **Reference galleries built out to 6-8 vetted photos/species (4 Jun 2026, `scripts/build-species-galleries.ts`)** — the photo strip a user sees when they tap a species at the Rung-3 decision point (`SpeciesGuidePopup` → `SpeciesGallery`) was previously whatever the iNat cron grabbed unfiltered (1-5 rows/species, some dead/mixed-school). The new builder fills each gallery to a TARGET of 8 Gemini-vetted teaching photos: the `curated` diagnostic-mark reference stays first (marks intact), then the best alive/in-frame/single-specimen CC photos from a pooled iNat-vote + Wikimedia top-up sweep, ordered by Gemini teachingScore. It deletes the non-curated mark-free junk that didn't make the cut and blocklists the dead/wrong/drawing rejects. **First full run: 57 species, +306 photos, 86 rows deleted, 392 new `photo-blocklist.json` entries (490 total), 385 gallery rows (~6.75 avg).** Verified end-to-end (API returns curated-first 8-photo payloads, all photo URLs 200, all CC-licensed with attribution intact). Photos live in the DB (not git). Genuine open-source ceilings left short (mostly-dead-specimen food fish, 20+ rejects each): Sprat (2), Atlantic mackerel (2), Barrel jelly (3); several more at 4 (saithe, conger, horse mackerel, poor cod, veined squid, dragonet, sand smelt). The builder is idempotent + re-runnable, so coverage improves as iNat gains live photos.
- **Catalogue-wide diagnostic-mark verification + fix (4 Jun 2026)** — ran the Gemini-3.5-Flash verify recipe across ALL 42 marked species (render each curated lead photo with the exact `AnnotatedSpeciesPhoto` geometry; per-mark `{onFeature, badgeClear, featureVisible, correctX, correctY}` schema; sort flags by how far Gemini wants to move each ring). Outcome on **98 marks**: auto-applied Gemini's corrected centre for **17 clear misplacements** (delta ≥0.13, with a backup + re-verify gate; 7 species went green), hand-fixed the egregious ones by viewing the photo (Pollack's lateral-line ring was floating in open water on the murky pilot photo; catshark "dorsal fins" ring was on sand), and **deleted 6 feature-not-visible marks** (octopus ×2 sucker rows on the hidden underside, dog-whelk aperture under a dorsal-up shell, catshark nostril flaps, and 2 male-only dragonet marks on a female photo). Restored Dog Whelk after mistakenly deleting its curated marks (re-authored "Pointed spire" + "Colour varies"). Final state: **only sub-0.15 noise-level flags remain** (Gemini's single-run spatial verdict is noisy — e.g. Bib/Poor cod flip OK↔BAD between runs — so chasing 100% green is a moving target; ground-truth is viewing the render). All DB changes live on prod. KEY LESSON: trust the categorical flags (featureVisible / drawing / dead) and large position deltas; treat small deltas as noise; always view the render before/after a hand-fix (orientation footgun).

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

# Q4-B2 MCQ candidate-photo gate (optional, default off)
MCQ_CURATED_PHOTOS_ONLY=1         # when "1", MCQ candidate thumbnails only use
                                  # SpeciesImage rows with curated=true; species
                                  # with no curated photo fall back to a fish
                                  # silhouette. Leave unset until the top MCQ
                                  # species each have a curated photo, else most
                                  # tiles silhouette (only pollack is curated today).
```
