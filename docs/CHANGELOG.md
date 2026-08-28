# FishSpotter: Changelog
# FishSpotter Changelog

> Dated, session-by-session shipping log. Moved out of CLAUDE.md on 2026-06-04 so the
> instruction file stays a stable reference (CLAUDE.md is re-read every session; this is not).
> Entries are roughly chronological (oldest first). Append new milestones at the bottom.

## Current State (May 2026)

- Video playback is working on fish-spotter.vercel.app after H.264 transcode fix
- Feed, browse archive, leaderboard pages all working
- Species quiz with community stats working
- BBox tracking overlay (Catmull-Rom smooth trail) working
- Debug strip has been removed (was temporary diagnostic tool)
- Species image gallery feature **activated 18 May 2026**: `SpeciesImage` table populated (113 rows across 26 species), `CRON_SECRET` set in Vercel, weekly cron live.
- **Invert photo cache populated 2 Jun 2026** (Section 2a, `implementation/2026-06-02/section-2-invert-content.md`), ran `db:refresh-images --stale-only` so all 26 Workstream-C inverts (crab/squid/starfish/gastropod/jellyfish) now carry 3-5 `SpeciesImage` rows each (iNat, with Wikimedia top-up where iNat was thin). 0 inverts with zero rows; verified via the `/api/species-images/<sci>` route. This unblocks invert MCQ thumbnails + reveal gallery. Invert *snippets/footage* in the feed are still outstanding (Section 2b, footage-dependent). Photos live in the DB, not git.
- **Landing page redesigned 2 Jun 2026** (`implementation/2026-06-02/landing-redesign.md`), the flat text-only `/` page became an "underwater" hero: a real looping snippet with a self-playing species-pick overlay, drifting CC0 silhouettes + light shafts + bubbles, a live clips/species/spotters count-up, a real-photo species marquee, and visual Spot→Compare→Streak step cards. Server component pulls live Prisma data; distractors are shape-class-aware; all motion is reduced-motion-safe and pauses off-screen (`src/lib/useInView.ts`). Verified: `tsc` clean, `lint:tokens` exit 0, `build` clean. Known follow-up: only 2/54 species have a curated reference photo, so marquee/MCQ photo quality is editorial debt (tracked separately).
- **Visual/UX design audit + fixes + marine auth background, 2 Jun 2026** (`implementation/2026-06-02/design-audit.md`, commit `4a74a2d`), a multi-agent audit (12 finder lenses, per-finding adversarial verification, 61 confirmed findings → 21 themes) drove three things, all shipped + `tsc`/`build` green: (1) the one **P1**, a shared `src/lib/useModalFocus.ts` hook (trap + restore + scroll-lock) applied to `MapModal`, which previously let keyboard users tab onto the live feed behind the open map; (2) **8 quick wins**: Unicode status glyphs → stroked SVGs (profile/RarityPanel/SnippetPlayer/browse/admin), verdict + `danger` tokens for semantic pills, `white/35`→`/60` contrast lifts on the dark feed panels, `motion-reduce:animate-none` on every skeleton, deterministic browse "Open" badge contrast, leaderboard+signin CSS-var→Tailwind-alias, `teal-800` (lighter than 600) renamed to `teal-hover`, cookie button "Dismiss"→"Got it"; (3) **core-loop hierarchy**: demoted the duplicate "Help me identify" CTA so "Spot It" is the single guided entry, separated the "Where is this?" utility action, and moved the feed panel + MCQ tiles to `rounded-card`/`rounded-modal`. Plus a **WhatsApp-doodle marine background** behind all `/auth` pages (`src/app/auth/layout.tsx` + `MarinePattern`): a seamless tile of **21 UK** CC0/PD PhyloPic silhouettes (non-UK like turtle + ink-blobs excluded), tinted teal via `mask` + `currentColor`, gentle `fs-pattern-sway` wave, 80% translucent card, fixing the audit's bare-auth-page finding (F-EMPTY-AUTH-STATES). Remaining systemic P2s (full glyph/radius/touch-target sweeps, type-token + editorial-auth work) tracked in the audit doc.
- **Wikimedia top-up false-positive found + remediated 2 Jun 2026**: while curating for 2c, the `Aurelia aurita` cache held a Wikimedia photo of a *person* (file `Aurelia_Aurita_..._Fnac` named after someone called Aurélia, not the species). Root cause: `fetchPhotosFromWikimedia` searches by filename/description text, so it can return wrong-subject photos, historical engravings (Haeckel/Iconographia plates) and non-web `.tif`s. Fixes: (1) added `looksNonPhotographic()` to `src/lib/biodiversity/wikimedia.ts` (rejects `.tif/.svg/.pdf/...` + plate/engraving/print/lithograph/old-year titles; 3 unit tests); (2) **purged all 40 Wikimedia invert rows** so every shipped invert photo is now iNat research-grade (content-verified by community ID), every invert still has >=1 iNat photo. The text-match filter still cannot catch a wrong-subject *modern photo*, which is why teaching content (`DiagnosticMark`) is gated to `curated` photos. Going forward, prefer **viewed curated overrides** in `species-images.json` for inverts over the Wikimedia top-up.
- **2c invert DiagnosticMark pilot started 2 Jun 2026**. Proved the full pipeline on Moon Jellyfish: pinned a viewed CC-BY-SA Luc Viatour photo as a `curated` override, then seeded 3 starter marks (four gonad rings / four frilly oral arms / short tentacle fringe) via `scripts/seed-invert-marks.ts` (sibling of `seed-gadoid-marks.ts`; attaches to the lowest-ordering *curated* photo, idempotent). Verified the `/api/species-images/Aurelia aurita` route returns the curated photo first with all 3 marks (so `AnnotatedSpeciesPhoto` renders them in the wizard). - **Jellyfish tile fully marked 2 Jun 2026**. Extended the pilot to the whole tile: viewed iNat candidates and pinned a curated lead photo for all 6 jellyfish (Moon = Luc Viatour CC-BY-SA; the other 5 = curated CC-BY-NC iNat observations in `species-images.json` overrides), then seeded draft marks via `seed-invert-marks.ts` (Moon 3, Compass 3, Lion's Mane 2, Barrel 2, Blue 2, Mauve 3 = 15 marks). All 6 verified via `/api/species-images` returning the curated photo first with its marks. Coords are starter drafts for `/admin/species` tuning.
- **Fish DiagnosticMarks: 21 species seeded, 2 Jun 2026** (commits `e2d8933`, `3229c46`, `057d8de`, `e3246de`), `scripts/seed-fish-marks.ts` authored draft marks for 4 batches: **gadoids** (Saithe, Bib/Pouting, Poor Cod, Atlantic Cod, completing the S9-T1 pilot), **wrasses** (Ballan, Cuckoo, Corkwing, Goldsinny), **gobies/benthic** (Two-spotted Goby, Common Goby, Rock Goby, Sand Goby, Butterfish, Shanny, Long-spined Sea Scorpion), and **pelagic/schooling** (Horse Mackerel, Atlantic Mackerel, Sprat, Sand Smelt, Sea Bass, Thick-lipped Grey Mullet). Each batch required curated iNat photo overrides in `species-images.json`. Draft mark coords are starters; tune in `/admin/species/[name]`. Combined with the S9-T1 gadoid pilot (Pollack seeded earlier) this brings the admin-authored fish set to **22 species** with draft marks in the DB.
- **Remaining 20 inverts (crab/squid/starfish/gastropod) follow the same steps:** view cached photos -> pin the best as a curated override in `species-images.json` -> add a draft to `INVERT_DRAFTS` in `scripts/seed-invert-marks.ts` -> `db:refresh-images --species` -> run the seeder -> tune coords in `/admin/species`.
- Bootstrap kit **shipped 22 May 2026** (`26bbf10`), one-command operator setup for all infra tokens, env vars, DNS, R2, Resend. See `scripts/bootstrap/README.md`.
- Resend email domain `pebl-cic.co.uk` **registered and DNS live 26 May 2026**: DKIM + SPF records added to Wix DNS; domain status `pending` (sending already enabled). Run `npm run bootstrap -- --doctor` to check verification status.
- **S3-01 schema drift fixed 27 May 2026**: `prisma db push` applied the auth-lifecycle columns + tables (`User.emailVerified`, `Account`, `Session`, `VerificationToken`, `PasswordResetToken`) that had been merged in code but never pushed to prod. Backfilled existing users with `emailVerified = createdAt`. Forgot-password + the rest of the S3 flows are now functional in prod.
- **S7-T1 shipped 27 May 2026**: nullable references + points-based scoring + contrast pass. See "Scoring model" section above. UI copy across the onboarding tour, landing page, reveal panel, and rarity panel retired the "PEBL staff" branding in favour of "reference ID (when available)", references can come from PEBL, academic partners, fisheries bodies, or be temporarily absent. The reveal pills (Correct/Wrong/Pending) are solid-bg + dark text so they read against any video background.
- **S7-T3 (IdGuide sheet expansion, 27 May 2026)**: the "How to spot a X next time" / wizard / chat sheet now opens at `96vw × 94vh` (capped at `max-w-7xl` / 1280px) instead of the previous `max-w-2xl × 88vh`. Two-column desktop layout on the field-note view (gallery left, prose + traits right) so the extra real estate gets used; mobile layout unchanged.
- **S8-T1 (per-user random feed ordering, 27 May 2026)**: `/feed` no longer shows everyone the same reverse-chronological list. The default card is now the first **unanswered** snippet for the viewer, with the rest of the list shuffled deterministically.
- Species image gallery feature **activated 18 May 2026**, `SpeciesImage` table populated (113 rows across 26 species), `CRON_SECRET` set in Vercel, weekly cron live.
- **Invert photo cache populated 2 Jun 2026** (Section 2a, `implementation/2026-06-02/section-2-invert-content.md`), ran `db:refresh-images --stale-only` so all 26 Workstream-C inverts (crab/squid/starfish/gastropod/jellyfish) now carry 3-5 `SpeciesImage` rows each (iNat, with Wikimedia top-up where iNat was thin). 0 inverts with zero rows; verified via the `/api/species-images/<sci>` route. This unblocks invert MCQ thumbnails + reveal gallery. Invert *snippets/footage* in the feed are still outstanding (Section 2b, footage-dependent). Photos live in the DB, not git.
- **Landing page redesigned 2 Jun 2026** (`implementation/2026-06-02/landing-redesign.md`), the flat text-only `/` page became an "underwater" hero: a real looping snippet with a self-playing species-pick overlay, drifting CC0 silhouettes + light shafts + bubbles, a live clips/species/spotters count-up, a real-photo species marquee, and visual Spot→Compare→Streak step cards. Server component pulls live Prisma data; distractors are shape-class-aware; all motion is reduced-motion-safe and pauses off-screen (`src/lib/useInView.ts`). Verified: `tsc` clean, `lint:tokens` exit 0, `build` clean. Known follow-up: only 2/54 species have a curated reference photo, so marquee/MCQ photo quality is editorial debt (tracked separately).
- **Visual/UX design audit + fixes + marine auth background, 2 Jun 2026** (`implementation/2026-06-02/design-audit.md`, commit `4a74a2d`), a multi-agent audit (12 finder lenses, per-finding adversarial verification, 61 confirmed findings → 21 themes) drove three things, all shipped + `tsc`/`build` green: (1) the one **P1**, a shared `src/lib/useModalFocus.ts` hook (trap + restore + scroll-lock) applied to `MapModal`, which previously let keyboard users tab onto the live feed behind the open map; (2) **8 quick wins**, Unicode status glyphs → stroked SVGs (profile/RarityPanel/SnippetPlayer/browse/admin), verdict + `danger` tokens for semantic pills, `white/35`→`/60` contrast lifts on the dark feed panels, `motion-reduce:animate-none` on every skeleton, deterministic browse "Open" badge contrast, leaderboard+signin CSS-var→Tailwind-alias, `teal-800` (lighter than 600) renamed to `teal-hover`, cookie button "Dismiss"→"Got it"; (3) **core-loop hierarchy**, demoted the duplicate "Help me identify" CTA so "Spot It" is the single guided entry, separated the "Where is this?" utility action, and moved the feed panel + MCQ tiles to `rounded-card`/`rounded-modal`. Plus a **WhatsApp-doodle marine background** behind all `/auth` pages (`src/app/auth/layout.tsx` + `MarinePattern`): a seamless tile of **21 UK** CC0/PD PhyloPic silhouettes (non-UK like turtle + ink-blobs excluded), tinted teal via `mask` + `currentColor`, gentle `fs-pattern-sway` wave, 80% translucent card, fixing the audit's bare-auth-page finding (F-EMPTY-AUTH-STATES). Remaining systemic P2s (full glyph/radius/touch-target sweeps, type-token + editorial-auth work) tracked in the audit doc.
- **Wikimedia top-up false-positive found + remediated 2 Jun 2026**, while curating for 2c, the `Aurelia aurita` cache held a Wikimedia photo of a *person* (file `Aurelia_Aurita_..._Fnac` named after someone called Aurélia, not the species). Root cause: `fetchPhotosFromWikimedia` searches by filename/description text, so it can return wrong-subject photos, historical engravings (Haeckel/Iconographia plates) and non-web `.tif`s. Fixes: (1) added `looksNonPhotographic()` to `src/lib/biodiversity/wikimedia.ts` (rejects `.tif/.svg/.pdf/...` + plate/engraving/print/lithograph/old-year titles; 3 unit tests); (2) **purged all 40 Wikimedia invert rows** so every shipped invert photo is now iNat research-grade (content-verified by community ID), every invert still has >=1 iNat photo. The text-match filter still cannot catch a wrong-subject *modern photo*, which is why teaching content (`DiagnosticMark`) is gated to `curated` photos. Going forward, prefer **viewed curated overrides** in `species-images.json` for inverts over the Wikimedia top-up.
- **2c invert DiagnosticMark pilot started 2 Jun 2026**, proved the full pipeline on Moon Jellyfish: pinned a viewed CC-BY-SA Luc Viatour photo as a `curated` override, then seeded 3 starter marks (four gonad rings / four frilly oral arms / short tentacle fringe) via `scripts/seed-invert-marks.ts` (sibling of `seed-gadoid-marks.ts`; attaches to the lowest-ordering *curated* photo, idempotent). Verified the `/api/species-images/Aurelia aurita` route returns the curated photo first with all 3 marks (so `AnnotatedSpeciesPhoto` renders them in the wizard). - **Jellyfish tile fully marked 2 Jun 2026**, extended the pilot to the whole tile: viewed iNat candidates and pinned a curated lead photo for all 6 jellyfish (Moon = Luc Viatour CC-BY-SA; the other 5 = curated CC-BY-NC iNat observations in `species-images.json` overrides), then seeded draft marks via `seed-invert-marks.ts` (Moon 3, Compass 3, Lion's Mane 2, Barrel 2, Blue 2, Mauve 3 = 15 marks). All 6 verified via `/api/species-images` returning the curated photo first with its marks. Coords are starter drafts for `/admin/species` tuning.
- **Fish DiagnosticMarks: 21 species seeded, 2 Jun 2026** (commits `e2d8933`, `3229c46`, `057d8de`, `e3246de`), `scripts/seed-fish-marks.ts` authored draft marks for 4 batches: **gadoids** (Saithe, Bib/Pouting, Poor Cod, Atlantic Cod, completing the S9-T1 pilot), **wrasses** (Ballan, Cuckoo, Corkwing, Goldsinny), **gobies/benthic** (Two-spotted Goby, Common Goby, Rock Goby, Sand Goby, Butterfish, Shanny, Long-spined Sea Scorpion), and **pelagic/schooling** (Horse Mackerel, Atlantic Mackerel, Sprat, Sand Smelt, Sea Bass, Thick-lipped Grey Mullet). Each batch required curated iNat photo overrides in `species-images.json`. Draft mark coords are starters; tune in `/admin/species/[name]`. Combined with the S9-T1 gadoid pilot (Pollack seeded earlier) this brings the admin-authored fish set to **22 species** with draft marks in the DB.
- **Remaining 20 inverts (crab/squid/starfish/gastropod) follow the same steps:** view cached photos -> pin the best as a curated override in `species-images.json` -> add a draft to `INVERT_DRAFTS` in `scripts/seed-invert-marks.ts` -> `db:refresh-images --species` -> run the seeder -> tune coords in `/admin/species`.
- Bootstrap kit **shipped 22 May 2026** (`26bbf10`), one-command operator setup for all infra tokens, env vars, DNS, R2, Resend. See `scripts/bootstrap/README.md`.
- Resend email domain `pebl-cic.co.uk` **registered and DNS live 26 May 2026**, DKIM + SPF records added to Wix DNS; domain status `pending` (sending already enabled). Run `npm run bootstrap -- --doctor` to check verification status.
- **S3-01 schema drift fixed 27 May 2026**, `prisma db push` applied the auth-lifecycle columns + tables (`User.emailVerified`, `Account`, `Session`, `VerificationToken`, `PasswordResetToken`) that had been merged in code but never pushed to prod. Backfilled existing users with `emailVerified = createdAt`. Forgot-password + the rest of the S3 flows are now functional in prod.
- **S7-T1 shipped 27 May 2026**, nullable references + points-based scoring + contrast pass. See "Scoring model" section above. UI copy across the onboarding tour, landing page, reveal panel, and rarity panel retired the "PEBL staff" branding in favour of "reference ID (when available)", references can come from PEBL, academic partners, fisheries bodies, or be temporarily absent. The reveal pills (Correct/Wrong/Pending) are solid-bg + dark text so they read against any video background.
- **S7-T3 (IdGuide sheet expansion, 27 May 2026)**, the "How to spot a X next time" / wizard / chat sheet now opens at `96vw × 94vh` (capped at `max-w-7xl` / 1280px) instead of the previous `max-w-2xl × 88vh`. Two-column desktop layout on the field-note view (gallery left, prose + traits right) so the extra real estate gets used; mobile layout unchanged.
- **S8-T1 (per-user random feed ordering, 27 May 2026)**, `/feed` no longer shows everyone the same reverse-chronological list. The default card is now the first **unanswered** snippet for the viewer, with the rest of the list shuffled deterministically.
  - **Signed-in:** shuffle seed = `session.user.id`, so each user has their own stable order. Reload = same first card until they answer something.
  - **Anonymous:** shuffle seed = `fs.anon_seed` cookie minted by `src/middleware.ts` on first hit to `/` or `/feed/*`. Stable per browser, fresh per browser.
  - **Exhausted feed:** once a user has answered everything, the answered snippets remain visible at the back of the shuffle so they can scroll back / edit.
  - Pure ordering logic in `src/lib/feed-ordering.ts` + `src/lib/shuffle.ts` (PRNG lifted out of `candidates.ts` and shared). 8 unit tests in `feed-ordering.test.ts`.
  - **Optimistic move-to-back on submit deferred**. Current behaviour: a card answered mid-session stays in its scroll position; reload re-evaluates and pushes it to the answered tail. Wire client-side reorder if user testing surfaces it as a pain point.
- **S9-T1 (admin-authored diagnostic marks, 27 May 2026)**: turns the existing `IdGuideWizard` from a guessing aid into a teaching tool. Admins (`@pebl-cic.co.uk` email suffix) can author "diagnostic marks" via a new `/admin` interface; those marks render as numbered SVG rings on a reference photo in the wizard's final reveal so a spotter sees exactly *where* on the fish to look for the chin barbel / pectoral spot / projecting jaw / etc.
  - **Optimistic move-to-back on submit deferred**, current behaviour: a card answered mid-session stays in its scroll position; reload re-evaluates and pushes it to the answered tail. Wire client-side reorder if user testing surfaces it as a pain point.
- **S9-T1 (admin-authored diagnostic marks, 27 May 2026)**, turns the existing `IdGuideWizard` from a guessing aid into a teaching tool. Admins (`@pebl-cic.co.uk` email suffix) can author "diagnostic marks" via a new `/admin` interface; those marks render as numbered SVG rings on a reference photo in the wizard's final reveal so a spotter sees exactly *where* on the fish to look for the chin barbel / pectoral spot / projecting jaw / etc.
  - **DiagnosticMark schema** (`prisma/schema.prisma`): one row per labelled ring. Normalised (0..1) `overlayX` / `overlayY` and `overlayRadius` (radius is fraction of `min(width, height)` so rings stay circular across aspect ratios). FK to `SpeciesImage`. `createdBy` audit field. No separate status flag, a species counts as published once it has >=1 mark.
  - **Admin gate** (`src/lib/admin.ts`): suffix check on `@pebl-cic.co.uk`, derived from a one-shot DB lookup so the JWT token surface stays unchanged. `requireAdminSession()` redirects non-admins to `/`. Admin routes carry `robots: noindex` via `src/app/admin/layout.tsx`.
  - **/admin/species** list (`src/app/admin/species/page.tsx`): all 26 catalogue species, joined with mark-count from a `groupBy(scientificName)`. Pilot gadoids pinned at top with a "Pilot" badge. Pilot is **3 species** (pollack, bib, cod); whiting and haddock were in the original spec but are not in the trait catalogue, so they were dropped from PILOT per Q3A-T3 to match reality. Status pill: Not started (0) / In progress (1-2) / Published (>=3).
  - **Authoring UI** (`src/app/admin/species/[name]/SpeciesAnnotator.tsx`): img + absolute SVG overlay. Click empty space to drop a mark with default 6% radius. Click a ring to select; drag body to move, drag corner handle to resize. Sidebar shows ordered list with up/down reorder arrows, plus a label (60 char) + description (280 char) editor that saves on blur. Optimistic local updates; server actions persist behind `useTransition` so the UI stays responsive.
  - **Server actions** (`src/app/admin/species/[name]/actions.ts`): `createMark` / `updateMark` / `deleteMark` / `swapMarkOrder`. All gated by `requireAdminSession()`. Coords clamped to 0..1 and radius to 0.01..0.5 before persisting. `createMark` verifies the `speciesImageId` belongs to the species being edited (no cross-species mark assignment via tampered IDs). `swapMarkOrder` runs in a Prisma transaction so the list can't end up with duplicate `order` values mid-swap.
  - **Wizard integration** (`src/components/AnnotatedSpeciesPhoto.tsx` + `IdGuideWizard.tsx`): the species-images API now includes `marks` per photo (Prisma `include`, no new round-trip). `AnnotatedSpeciesPhoto` renders the first photo with marks as numbered rings + a legend listing label + description. Returns null when no marks exist, so the existing thumb-strip + field-note path keeps working for the unauthored long tail.
  - **"Why ask this?" hints**: each `STEPS` entry in `IdGuideWizard.tsx` now carries a `whyHint` surfaced behind a small disclosure under the question. Explains the marine biologist's rationale at each rung, body shape locks family, size eliminates lookalikes, habitat is often as diagnostic as morphology, single marks settle three-way ambiguity, behaviour is the clincher.
  - **Authoring is the bottleneck, not the build**: the framework + admin UI ship in this release but mark content is editorial work in `/admin/species`, no further deploys required. Author the remaining gadoid pilot (bib, pollack, cod, haddock) first, then expand to the wider catalogue.
  - **Authoring is the bottleneck, not the build**, the framework + admin UI ship in this release but mark content is editorial work in `/admin/species`, no further deploys required. Author the remaining gadoid pilot (bib, pollack, cod, haddock) first, then expand to the wider catalogue.
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
- **Rung 2 as a draggable dark gate + "Examples" (3 Jun 2026)** (`implementation/2026-06-03/rung2-bodyshape-examples-plan.md`, commit `f15a780`, merged to main), the body-shape sub-split (Rung 2) was lifted out of the inline `CandidateStrip` box and made a draggable dark card that matches the Rung-1 shape gate. The gate chrome (draggable floating card, drag-from-grip, "Hide", focus trap, body-scroll lock, tile grid + Not-sure/Skip footer) was **extracted into a reusable `src/components/idflow/TileGate.tsx`** (+ `MaskSilhouette`); `ShapeGate` now renders from it (Rung 1 behaviour unchanged) and the new `src/components/idflow/BodyShapeGate.tsx` renders Rung 2 from it. Each Rung-2 tile is a body-form silhouette (the existing PhyloPic `public/silhouettes/forms/<value>.svg` assets, tinted via mask-image; **bespoke art drops in over the same filenames, no code change**: the 2 forms without an asset, `flat-dorsoventral` + `no-shell`, show a neutral placeholder) with a per-tile **"Examples" button** → `src/components/idflow/BodyFormExamples.tsx`, a focus-trapped portaled popup of real CC-attributed photos of catalogue species with that body form (reuses `SpeciesGallery`; teaching aid only, never commits a guess; the gate `suspendKeyboard`s while it's open so the two focus traps don't fight). The `SUB_SPLITS` table + helpers were lifted to **`src/lib/idflow/body-forms.ts`** (one source of truth; `bodyFormConfigFor`, `exampleSpeciesForForm`). `FeedCard` routes Rung1 → Rung2 (only for classes whose sub-split discriminates, i.e. not crab/flatfish/scooter) → strip, `seed`ing the chosen form into the strip's narrowing and suppressing its now-redundant inline sub-split. Validated: tsc, lint, lint:tokens, prod build, 205 tests (4 new in `body-forms.test.ts` prove every form maps to ≥1 photographed species so no Examples button is ever empty). NB the live interactive preview couldn't be driven (the feed's IntersectionObserver scroll container doesn't respond to the eval harness); static gates + the user's on-device check are the verification path.

- **Rung 3 species-tile guide popup (3 Jun 2026)**: tapping a species tile in the Rung-3 `CandidateGate` no longer commits the guess instantly. It now opens **`src/components/idflow/SpeciesGuidePopup.tsx`**, a portaled focus-trapped "flash card" that surfaces, in one place, the three things we author per species: (1) the diagnostic guide (`AnnotatedSpeciesPhoto` numbered circles on the curated photo, renders nothing if the species has no marks), (2) a `SpeciesGallery size="large"` photo gallery + lightbox, (3) the `fieldNote` prose from the trait catalogue. A **"This is my pick"** button commits via the existing `onPick` path; "Back"/"Keep looking" dismisses without committing. This is what makes the diagnostic-mark guide reachable in the live app (previously only the post-submit reveal + the wizard's FinalReveal rendered it, so most users never saw it). Focus management is inline (mirrors `useModalFocus`) but **guards Escape/Tab while the gallery's own lightbox (z-[100], `aria-modal="true"`) is open** so one keypress can't close both; `CandidateGate` passes `suspendKeyboard` to the gate so it goes `inert` underneath. Decided entry point = the live ID-flow tiles (not a separate dex page); MCQ tiles still commit instantly (fast path preserved). Validated: tsc, eslint, prod build, `/feed` route compiles + 200. Interactive tap-through is on-device (harness can't drive the feed's IntersectionObserver). Photo-quality curation to feed better gallery images is gated on Gemini quota (see the image-analysis tool section: free tier ~20 req/day).
- **Marks-on-bad-photo fix (3 Jun 2026, `scripts/reauthor-quality-flagged-marks.ts`)**: the Gemini sweep found 7 species whose CURATED, mark-bearing photo was a dead/poor/multi specimen (so the wizard drew rings on a dead fish). Each already had a good curated lead photo at `ordering=1` with 0 marks; `AnnotatedSpeciesPhoto` renders "the first photo WITH marks", so it showed the bad one. The script moves each species' marks onto the good lead photo with fresh coordinates (placed by viewing each photo, orientation-verified, then render-checked), keeps the label/description text, and deletes the old dead photo (all 7 are already in `photo-blocklist.json`, so deletion is durable). Species: Bib, Shanny, Poor cod, Veined squid, Painted top shell, Barrel jelly, Cuckoo wrasse. Verified via `/api/species-images` (each now returns the good lead photo with its marks first). Idempotent (skips a species whose good photo already has marks). DB changes are live on prod. (Two borderline species, Common Limpet + Moon Jelly, "usable" multi-specimen, left as acceptable.)
- **Diagnostic-ring polish + alignment fix + Gemini verification (3 Jun 2026)**. Three things: (1) `AnnotatedSpeciesPhoto.tsx` rings are now thinner (`ringStroke` `S*0.006`→`S*0.004`) and the numbered badge sits just OUTSIDE the ring on the first in-frame diagonal (UR→UL→LR→LL) instead of on the ring edge, so a number never covers the feature and never clips off-frame near an edge. (2) **Latent alignment bug fixed**: `AnnotatedSpeciesPhoto` builds its SVG viewBox from the stored `width`/`height` and falls back to a 1000×1000 square (4/3 container) when null, skewing every ring on non-square photos. `scripts/backfill-image-dims.ts` (`npm run db:backfill-image-dims`) reads true pixel size from each JPEG/PNG header and backfilled **33 SpeciesImage rows** that had null dims (incl. portrait crab/whelk/limpet photos that were badly skewed). The admin annotator places coords as fractions of an `object-cover` container at the stored aspect, so once true dims are set the public component matches the authoring intent. (3) **Verification via Gemini 3.5 Flash**: rendered each annotated photo with the exact component geometry and had Gemini check, per mark, that the ring is centered on its labelled feature and the badge doesn't obscure it; iterated coords until clean. The 7 re-authored species verify 19/20 (the one residual (Barrel jelly's frilly arms) is `onFeature=True`, badge just clips a frame-filling feature). NB the **parallel-authored marks on the other ~14 null-dim species** (Edible Crab pie-crust, Horse Mackerel eye, Dog Whelk aperture-not-visible-in-dorsal-view, Hyas ring clutter, etc.) have their own pre-existing placement imprecision that the dim fix surfaced; they want the same Gemini verify+fix pass. The reusable verify recipe: render with component geometry, send to Gemini with a per-mark `{onFeature, badgeClear, note}` schema.
- **Reference galleries built out to 6-8 vetted photos/species (4 Jun 2026, `scripts/build-species-galleries.ts`)**: the photo strip a user sees when they tap a species at the Rung-3 decision point (`SpeciesGuidePopup` → `SpeciesGallery`) was previously whatever the iNat cron grabbed unfiltered (1-5 rows/species, some dead/mixed-school). The new builder fills each gallery to a TARGET of 8 Gemini-vetted teaching photos: the `curated` diagnostic-mark reference stays first (marks intact), then the best alive/in-frame/single-specimen CC photos from a pooled iNat-vote + Wikimedia top-up sweep, ordered by Gemini teachingScore. It deletes the non-curated mark-free junk that didn't make the cut and blocklists the dead/wrong/drawing rejects. **First full run: 57 species, +306 photos, 86 rows deleted, 392 new `photo-blocklist.json` entries (490 total), 385 gallery rows (~6.75 avg).** Verified end-to-end (API returns curated-first 8-photo payloads, all photo URLs 200, all CC-licensed with attribution intact). Photos live in the DB (not git). Genuine open-source ceilings left short (mostly-dead-specimen food fish, 20+ rejects each): Sprat (2), Atlantic mackerel (2), Barrel jelly (3); several more at 4 (saithe, conger, horse mackerel, poor cod, veined squid, dragonet, sand smelt). The builder is idempotent + re-runnable, so coverage improves as iNat gains live photos.
- **Catalogue-wide diagnostic-mark verification + fix (4 Jun 2026)**: ran the Gemini-3.5-Flash verify recipe across ALL 42 marked species (render each curated lead photo with the exact `AnnotatedSpeciesPhoto` geometry; per-mark `{onFeature, badgeClear, featureVisible, correctX, correctY}` schema; sort flags by how far Gemini wants to move each ring). Outcome on **98 marks**: auto-applied Gemini's corrected centre for **17 clear misplacements** (delta ≥0.13, with a backup + re-verify gate; 7 species went green), hand-fixed the egregious ones by viewing the photo (Pollack's lateral-line ring was floating in open water on the murky pilot photo; catshark "dorsal fins" ring was on sand), and **deleted 6 feature-not-visible marks** (octopus ×2 sucker rows on the hidden underside, dog-whelk aperture under a dorsal-up shell, catshark nostril flaps, and 2 male-only dragonet marks on a female photo). Restored Dog Whelk after mistakenly deleting its curated marks (re-authored "Pointed spire" + "Colour varies"). Final state: **only sub-0.15 noise-level flags remain** (Gemini's single-run spatial verdict is noisy (e.g. Bib/Poor cod flip OK↔BAD between runs), so chasing 100% green is a moving target; ground-truth is viewing the render). All DB changes live on prod. KEY LESSON: trust the categorical flags (featureVisible / drawing / dead) and large position deltas; treat small deltas as noise; always view the render before/after a hand-fix (orientation footgun).
- **Gallery quality re-check + photo-provenance 'i' popover (4 Jun 2026)**: second pass over every gallery photo with the builder now ranking on a 50/50 `teachingScore`+`diagnosticFeaturesVisible` blend (the user ask: images must "show off the key traits"); it re-assessed all + swapped in trait-richer photos -> **403 rows (~7/species)**, only Sprat + Atlantic mackerel still short (genuine dead-specimen ceilings). Added two nullable `SpeciesImage` columns `observedOn` + `placeGuess`, captured from iNat at fetch time and backfilled onto older/curated rows by `scripts/enrich-image-meta.ts` (322 rows enriched; 320/320 iNat obs had date+place). The `/api/species-images` payload now carries them, and `SpeciesGallery` renders a per-thumbnail **'i' button** -> portaled `InfoPopover` (reference + location + year + subject + source link + license chip); the lightbox shows a location·year line too. Verified end-to-end in the dev preview (popover renders the real provenance), `tsc` + `eslint` + `lint:tokens` + prod `build` all green. Fixed a latent crash found during verification: the 'i' handler must capture `getBoundingClientRect()` before `setInfo` (reading the synthetic event inside the updater throws on React's reducer replay). Photos + metadata live in the DB; schema + code committed.

## Activation history: 18 May 2026
- **Rung 2 as a draggable dark gate + "Examples" (3 Jun 2026)** (`implementation/2026-06-03/rung2-bodyshape-examples-plan.md`, commit `f15a780`, merged to main), the body-shape sub-split (Rung 2) was lifted out of the inline `CandidateStrip` box and made a draggable dark card that matches the Rung-1 shape gate. The gate chrome (draggable floating card, drag-from-grip, "Hide", focus trap, body-scroll lock, tile grid + Not-sure/Skip footer) was **extracted into a reusable `src/components/idflow/TileGate.tsx`** (+ `MaskSilhouette`); `ShapeGate` now renders from it (Rung 1 behaviour unchanged) and the new `src/components/idflow/BodyShapeGate.tsx` renders Rung 2 from it. Each Rung-2 tile is a body-form silhouette (the existing PhyloPic `public/silhouettes/forms/<value>.svg` assets, tinted via mask-image; **bespoke art drops in over the same filenames, no code change**, the 2 forms without an asset, `flat-dorsoventral` + `no-shell`, show a neutral placeholder) with a per-tile **"Examples" button** → `src/components/idflow/BodyFormExamples.tsx`, a focus-trapped portaled popup of real CC-attributed photos of catalogue species with that body form (reuses `SpeciesGallery`; teaching aid only, never commits a guess; the gate `suspendKeyboard`s while it's open so the two focus traps don't fight). The `SUB_SPLITS` table + helpers were lifted to **`src/lib/idflow/body-forms.ts`** (one source of truth; `bodyFormConfigFor`, `exampleSpeciesForForm`). `FeedCard` routes Rung1 → Rung2 (only for classes whose sub-split discriminates, i.e. not crab/flatfish/scooter) → strip, `seed`ing the chosen form into the strip's narrowing and suppressing its now-redundant inline sub-split. Validated: tsc, lint, lint:tokens, prod build, 205 tests (4 new in `body-forms.test.ts` prove every form maps to ≥1 photographed species so no Examples button is ever empty). NB the live interactive preview couldn't be driven (the feed's IntersectionObserver scroll container doesn't respond to the eval harness); static gates + the user's on-device check are the verification path.

- **Rung 3 species-tile guide popup (3 Jun 2026)**, tapping a species tile in the Rung-3 `CandidateGate` no longer commits the guess instantly. It now opens **`src/components/idflow/SpeciesGuidePopup.tsx`**, a portaled focus-trapped "flash card" that surfaces, in one place, the three things we author per species: (1) the diagnostic guide (`AnnotatedSpeciesPhoto` numbered circles on the curated photo, renders nothing if the species has no marks), (2) a `SpeciesGallery size="large"` photo gallery + lightbox, (3) the `fieldNote` prose from the trait catalogue. A **"This is my pick"** button commits via the existing `onPick` path; "Back"/"Keep looking" dismisses without committing. This is what makes the diagnostic-mark guide reachable in the live app (previously only the post-submit reveal + the wizard's FinalReveal rendered it, so most users never saw it). Focus management is inline (mirrors `useModalFocus`) but **guards Escape/Tab while the gallery's own lightbox (z-[100], `aria-modal="true"`) is open** so one keypress can't close both; `CandidateGate` passes `suspendKeyboard` to the gate so it goes `inert` underneath. Decided entry point = the live ID-flow tiles (not a separate dex page); MCQ tiles still commit instantly (fast path preserved). Validated: tsc, eslint, prod build, `/feed` route compiles + 200. Interactive tap-through is on-device (harness can't drive the feed's IntersectionObserver). Photo-quality curation to feed better gallery images is gated on Gemini quota (see the image-analysis tool section: free tier ~20 req/day).
- **Marks-on-bad-photo fix (3 Jun 2026, `scripts/reauthor-quality-flagged-marks.ts`)**, the Gemini sweep found 7 species whose CURATED, mark-bearing photo was a dead/poor/multi specimen (so the wizard drew rings on a dead fish). Each already had a good curated lead photo at `ordering=1` with 0 marks; `AnnotatedSpeciesPhoto` renders "the first photo WITH marks", so it showed the bad one. The script moves each species' marks onto the good lead photo with fresh coordinates (placed by viewing each photo, orientation-verified, then render-checked), keeps the label/description text, and deletes the old dead photo (all 7 are already in `photo-blocklist.json`, so deletion is durable). Species: Bib, Shanny, Poor cod, Veined squid, Painted top shell, Barrel jelly, Cuckoo wrasse. Verified via `/api/species-images` (each now returns the good lead photo with its marks first). Idempotent (skips a species whose good photo already has marks). DB changes are live on prod. (Two borderline species, Common Limpet + Moon Jelly, "usable" multi-specimen, left as acceptable.)
- **Diagnostic-ring polish + alignment fix + Gemini verification (3 Jun 2026)**, three things: (1) `AnnotatedSpeciesPhoto.tsx` rings are now thinner (`ringStroke` `S*0.006`→`S*0.004`) and the numbered badge sits just OUTSIDE the ring on the first in-frame diagonal (UR→UL→LR→LL) instead of on the ring edge, so a number never covers the feature and never clips off-frame near an edge. (2) **Latent alignment bug fixed**: `AnnotatedSpeciesPhoto` builds its SVG viewBox from the stored `width`/`height` and falls back to a 1000×1000 square (4/3 container) when null, skewing every ring on non-square photos. `scripts/backfill-image-dims.ts` (`npm run db:backfill-image-dims`) reads true pixel size from each JPEG/PNG header and backfilled **33 SpeciesImage rows** that had null dims (incl. portrait crab/whelk/limpet photos that were badly skewed). The admin annotator places coords as fractions of an `object-cover` container at the stored aspect, so once true dims are set the public component matches the authoring intent. (3) **Verification via Gemini 3.5 Flash**: rendered each annotated photo with the exact component geometry and had Gemini check, per mark, that the ring is centered on its labelled feature and the badge doesn't obscure it; iterated coords until clean. The 7 re-authored species verify 19/20 (the one residual, Barrel jelly's frilly arms, is `onFeature=True`, badge just clips a frame-filling feature). NB the **parallel-authored marks on the other ~14 null-dim species** (Edible Crab pie-crust, Horse Mackerel eye, Dog Whelk aperture-not-visible-in-dorsal-view, Hyas ring clutter, etc.) have their own pre-existing placement imprecision that the dim fix surfaced; they want the same Gemini verify+fix pass. The reusable verify recipe: render with component geometry, send to Gemini with a per-mark `{onFeature, badgeClear, note}` schema.
- **Reference galleries built out to 6-8 vetted photos/species (4 Jun 2026, `scripts/build-species-galleries.ts`)**, the photo strip a user sees when they tap a species at the Rung-3 decision point (`SpeciesGuidePopup` → `SpeciesGallery`) was previously whatever the iNat cron grabbed unfiltered (1-5 rows/species, some dead/mixed-school). The new builder fills each gallery to a TARGET of 8 Gemini-vetted teaching photos: the `curated` diagnostic-mark reference stays first (marks intact), then the best alive/in-frame/single-specimen CC photos from a pooled iNat-vote + Wikimedia top-up sweep, ordered by Gemini teachingScore. It deletes the non-curated mark-free junk that didn't make the cut and blocklists the dead/wrong/drawing rejects. **First full run: 57 species, +306 photos, 86 rows deleted, 392 new `photo-blocklist.json` entries (490 total), 385 gallery rows (~6.75 avg).** Verified end-to-end (API returns curated-first 8-photo payloads, all photo URLs 200, all CC-licensed with attribution intact). Photos live in the DB (not git). Genuine open-source ceilings left short (mostly-dead-specimen food fish, 20+ rejects each): Sprat (2), Atlantic mackerel (2), Barrel jelly (3); several more at 4 (saithe, conger, horse mackerel, poor cod, veined squid, dragonet, sand smelt). The builder is idempotent + re-runnable, so coverage improves as iNat gains live photos.
- **Catalogue-wide diagnostic-mark verification + fix (4 Jun 2026)**, ran the Gemini-3.5-Flash verify recipe across ALL 42 marked species (render each curated lead photo with the exact `AnnotatedSpeciesPhoto` geometry; per-mark `{onFeature, badgeClear, featureVisible, correctX, correctY}` schema; sort flags by how far Gemini wants to move each ring). Outcome on **98 marks**: auto-applied Gemini's corrected centre for **17 clear misplacements** (delta ≥0.13, with a backup + re-verify gate; 7 species went green), hand-fixed the egregious ones by viewing the photo (Pollack's lateral-line ring was floating in open water on the murky pilot photo; catshark "dorsal fins" ring was on sand), and **deleted 6 feature-not-visible marks** (octopus ×2 sucker rows on the hidden underside, dog-whelk aperture under a dorsal-up shell, catshark nostril flaps, and 2 male-only dragonet marks on a female photo). Restored Dog Whelk after mistakenly deleting its curated marks (re-authored "Pointed spire" + "Colour varies"). Final state: **only sub-0.15 noise-level flags remain** (Gemini's single-run spatial verdict is noisy, e.g. Bib/Poor cod flip OK↔BAD between runs, so chasing 100% green is a moving target; ground-truth is viewing the render). All DB changes live on prod. KEY LESSON: trust the categorical flags (featureVisible / drawing / dead) and large position deltas; treat small deltas as noise; always view the render before/after a hand-fix (orientation footgun).
- **Gallery quality re-check + photo-provenance 'i' popover (4 Jun 2026)**, second pass over every gallery photo with the builder now ranking on a 50/50 `teachingScore`+`diagnosticFeaturesVisible` blend (the user ask: images must "show off the key traits"); it re-assessed all + swapped in trait-richer photos -> **403 rows (~7/species)**, only Sprat + Atlantic mackerel still short (genuine dead-specimen ceilings). Added two nullable `SpeciesImage` columns `observedOn` + `placeGuess`, captured from iNat at fetch time and backfilled onto older/curated rows by `scripts/enrich-image-meta.ts` (322 rows enriched; 320/320 iNat obs had date+place). The `/api/species-images` payload now carries them, and `SpeciesGallery` renders a per-thumbnail **'i' button** -> portaled `InfoPopover` (reference + location + year + subject + source link + license chip); the lightbox shows a location·year line too. Verified end-to-end in the dev preview (popover renders the real provenance), `tsc` + `eslint` + `lint:tokens` + prod `build` all green. Fixed a latent crash found during verification: the 'i' handler must capture `getBoundingClientRect()` before `setInfo` (reading the synthetic event inside the updater throws on React's reducer replay). Photos + metadata live in the DB; schema + code committed.

## Guide-hero audit + auto-placement fix (4 Jun 2026)

- **Audit (`implementation/2026-06-04/species-image-audit.md`):** validated all 42 annotated guide-hero photos (curated photo + `DiagnosticMark` rings, rendered by `AnnotatedSpeciesPhoto.tsx`) with Gemini 3.5 Flash, scoring a composite of each hero rendered with the live ring geometry. Found only 8/42 well-aligned, 15 species with no hero at all, and 3 on unusable (dead/captive) photos. Root cause: the ring coordinates seeded by `seed-fish-marks.ts` / `seed-invert-marks.ts` were hand-estimated drafts, never tuned.
- **Tooling:** extracted the overlay/compositing/validation into `scripts/lib/mark-overlay.ts`; built `scripts/place-diagnostic-marks.ts`, Gemini localises each feature via its native `box_2d` detection format (converted to a centred ring), then a verify-and-correct loop re-prompts any ring graded off-target. Modes: `relocate` (re-place existing marks; skips already-aligned) and `author` (create from `scripts/data/p2-mark-drafts.ts`). Dry-run default; `--apply` writes; marks tagged `createdBy=gemini-place@pebl-cic.co.uk` (drafts). `scripts/render-hero.ts` renders a hero composite to PNG for human ground-truthing.
- **Results (`implementation/2026-06-04/species-image-fix-report.md`):** guide-heroes 42 -> **57/57** (gap closed); heroes graded keep 8 -> **16**; photo-replacement needed 3 -> **0** (Dragonet + Edible Crab swapped to IDEAL photos, old ones blocklisted); **32 species improved**, 2 regressions reverted to baseline. All marks remain drafts pending expert sign-off. 24 species still have >=1 off ring or redundant marks (many-mark fish, multi-specimen or murky photos, duplicate labels) and are listed for a manual `/admin/species/[name]` pass in the fix report.
- **Continuation (same day):** improved the auto-placer (`scripts/place-diagnostic-marks.ts`), Gemini now classifies each feature point vs region and point features (eye/barbel/spot) are capped to a small ring so they stop reading as oversized; the verify loop corrects every off/near ring over 4 rounds with a final fresh re-localise; `loadImage` retries CDN 429s and one species erroring no longer aborts a sweep. Added `scripts/data/mark-redraft.ts` + an author `--redraft` path that deletes a species' draft marks and recreates a clean set: **trimmed 7 over-marked species** (sea bass, butterfish, rock goby, great spider crab, velvet swimming crab, horse mackerel, dog whelk) to 3 distinct marks each, and **re-anchored 2 photo-limited species** (Flat Top Shell, Dragonet) onto features their photo actually shows. Re-audit: **keep 16 -> 26, aligned 17 -> 28, over-marked species -> 0, total off-marks 47 -> 20 (0.35/hero), stragglers 24 -> 15**. The 15 residual are mostly one borderline ring on a good hero or genuinely-hard photos (Pollack head, Poor cod, Flounder, the spider/velvet crabs); listed for a manual admin pass. `tsc`/`test`/`lint` green.
- **Upside-down photo fix (Ballan wrasse):** the curated Ballan hero (iNat 231750633) was uploaded upside-down with no EXIF flag, so it rendered belly-up in the wizard. Swapped to an upright green-morph shot (iNat 266328776, score 88 IDEAL), demoted + blocklisted the old one, and re-placed the marks. Added `scripts/check-photo-orientation.ts` (Gemini-based) to sweep all heroes for inverted/rotated photos. **Caveat: that checker is noisy**. It false-positived the 3 jellyfish (no fixed "up") + the held-vertical plaice and false-negatived this Ballan, so its flags are human-review candidates only. Visually triaged all 7 of its flags; none were genuine problems. The Ballan fix is DB-backed and already live in prod (verified via the species-images API).
- **Upside-down photo fix (Ballan wrasse):** the curated Ballan hero (iNat 231750633) was uploaded upside-down with no EXIF flag, so it rendered belly-up in the wizard. Swapped to an upright green-morph shot (iNat 266328776, score 88 IDEAL), demoted + blocklisted the old one, and re-placed the marks. Added `scripts/check-photo-orientation.ts` (Gemini-based) to sweep all heroes for inverted/rotated photos. **Caveat: that checker is noisy**, it false-positived the 3 jellyfish (no fixed "up") + the held-vertical plaice and false-negatived this Ballan, so its flags are human-review candidates only. Visually triaged all 7 of its flags; none were genuine problems. The Ballan fix is DB-backed and already live in prod (verified via the species-images API).

## Engagement: play before the signup wall + UX fixes (12 Jun 2026, commit `5180822`)

The acquisition funnel's worst leak, fixed. A signed-out visitor invited to "start
spotting" used to be bounced to a sign-up form the instant they committed their
first ID, before ever seeing the reveal. Now they get the real reveal locally,
then a soft "save your finds" ask.

- New public, read-only `POST /api/answers/preview` grades a guess (same
  alias-aware matcher) and returns the full reveal payload (verdict, points,
  reference, community split) WITHOUT writing a row, so the leaderboard /
  anti-spam path is untouched. `useCreatureQuiz` no longer redirects guests; it
  renders the reveal and queues each guess in localStorage, carried in and
  persisted on sign-up.
- Surfaced the Google/Apple sign-in buttons (wired in `lib/auth.ts` but never
  rendered) on the sign-in page; they appear when the provider env vars are set.
- Fixed the landing "at a glance" stats that served `0/0/0` to SSR / no-JS /
  crawlers (`StatsBand` now SSRs the real values; the count-up is enhancement).
- Feed: moved the depth/location/date HUD to the bottom-left (shown only after
  the first identify tap) and the minimized magnifier bubble to the bottom-right
  corner so they no longer collide; clearer "Tap to name species" prompt.

## Production hardening: observability, env validation, security, CI (12 Jun 2026, commit `c4da1c9`)

- Sentry error monitoring (`instrumentation.ts` + `sentry.{client,edge,server}.config.ts`),
  inert until `SENTRY_DSN` is set so it ships safely unconfigured. Set the DSN in
  Vercel to turn on error capture.
- Fail-fast env validation (`src/lib/env.ts`), validated once at server boot.
- Web-vitals sink: `POST /api/vitals` to a new `Vital` table (10% sampling). The
  table was added to prod via `prisma db push`, then `npm run db:enable-rls`
  re-run (17/17 public tables protected).
- Health route `/api/health`, default OG share image, structured logging, CSRF +
  rate-limit hardening, and a CI workflow.

## Vision-based UX review of the whole app (14 Jun 2026, commit `c94f1ef`)

A comprehensive agent-team visual UX review: a 40-screenshot Playwright capture of
the live app, 7 specialist vision agents, a synthesis pass, and an adversarial
completeness critic. Result: 38 prioritised findings across 6 themes, with a
sequenced 7-wave implementation plan. All artifacts in
`implementation/2026-06-14/ux-vision-review/` (start at `README.md`, then
`02-implementation-plan.md`).

Headline: the bones are strong (credible product; the guest reveal sequence is the
screen to protect), but it leaks at activation to retention: no real-science
contribution narrative anywhere, demotivating empty first-run states (the pokedex
57-tile "Locked" wall, "0% accuracy"), a reward that never accumulates progress,
colour-alone meaning (acute given the colour-blind owner), and auth friction.

## UX plan Wave 0: quick wins + tokens (14 Jun 2026, commit `10adaa0`)

- Landing leads with one dominant "Start spotting" CTA; the deflating "spotters"
  stat becomes "identifications" (answer count). Removed the duplicate identify
  prompt. Rung-gate questions render sentence-case and no longer truncate. The
  minimized resume control is a labelled "Resume" pill (was an unlabelled
  magnifier). The verify-email banner is reframed as an optional perk with a calm
  `notice` token. Legal copy points at the canonical fishspotter.app. Brand
  em-dash sweep of user-facing copy.
- Deferred with notes: T-05 (hero demo) is a content task (curate a clip with a
  visible subject); T-21 verified NOT a real bug.

## UX plan Waves 1+2: reward moment + first-run retention states (14 Jun 2026, commits `6738572`, `82748a0`)

Wave 1 (make the win land and mean something):
- The reward now visibly accumulates: a correct ID surfaces "{species} added to
  your collection, N of 57" + the day-streak tick on the reveal (new `unlock`
  field on `POST /api/answers`, threaded through the quiz hook).
- A coarse "PEBL ID" (e.g. "Fish") is framed as an invitation ("Closest confirmed
  ID", "your guess is logged and counts toward the community ID"). Honest low-n
  community framing (no misleading 50/50), and the user's own guess is always
  shown. Bigger verdict pill.
- The real-science contribution narrative threads through the landing sub-hero,
  onboarding, profile, and a new leaderboard collective banner.

Wave 2 (first-run retention states):
- The pokedex/profile reframes from deficit to momentum: accuracy withheld below
  5 scored answers (no "0%"), the collection header reads "N to discover",
  collected species lead the grid, and the 57-tile "Locked" word-wall is gone.
  The leaderboard leads with the collective contribution. Friendlier collection
  group names. Species pages end with a "Spot it in the feed" loop CTA.
- Deferred (P2 polish, tracked in the plan): collection show-all expander +
  tappable group filters, onboarding per-step visuals, T-32 teaching-link
  prominence. **Waves 3 to 6 remain** (browse, auth, design-system + secondary
  reveal, accessibility sweep).

Every commit above verified: `tsc`, 334 tests, `next lint`, `lint:tokens` green;
the live site re-verified by curl + Playwright after each deploy. Two disposable
prod test accounts (created for signed-in captures) were deleted afterward.


## Fish sub-silhouette redraw (18 Jun 2026)

- **Reviewed + redrew the 7 fish Rung-2 "What kind of fish was it?" tile
  silhouettes** so each reads as its family group and stays mutually
  distinguishable at the flat-mask icon size (~40-64px). One agent reviewed each
  icon against the Gemini-vision baseline (`implementation/2026-06-17/silhouette-scores.json`),
  the field-guide rationale, and the `MaskSilhouette` render constraint; the per-icon
  plans + draft SVGs live in `implementation/2026-06-18/fish-silhouettes/` (README has
  the cross-cutting findings). Applied 6 redraws (shark left as-is, it already scored
  90/"strong"):
  - **cod-like**: three dorsal sails now rise ~7-9 units with deep V-notches of true
    negative space, so the cod give-away ("three separate fins on the back") survives
    downsampling instead of slurring into a "bumpy back" (was readsAs "Fish with fins").
  - **wrasse**: the single long dorsal is lifted off the back (negative-space gap) so it
    reads as ONE continuous fin vs cod's three humps; sharper thick-lipped pointed snout;
    bold rounded (unforked) paddle tail. Targets the cod-confusion that capped it at 73.
  - **silver-shoaler**: switched from the 2-fish shoal (readsAs "Two fish") to a single
    slim fish with a deep symmetric fork, matching the other single-subject fish tiles and
    the "Silver swimmers" relabel.
  - **bottom-sitter** vs **bottom-other**: the 18-Jun split left these two near-identical
  - **cod-like**, three dorsal sails now rise ~7-9 units with deep V-notches of true
    negative space, so the cod give-away ("three separate fins on the back") survives
    downsampling instead of slurring into a "bumpy back" (was readsAs "Fish with fins").
  - **wrasse**, the single long dorsal is lifted off the back (negative-space gap) so it
    reads as ONE continuous fin vs cod's three humps; sharper thick-lipped pointed snout;
    bold rounded (unforked) paddle tail. Targets the cod-confusion that capped it at 73.
  - **silver-shoaler**, switched from the 2-fish shoal (readsAs "Two fish") to a single
    slim fish with a deep symmetric fork, matching the other single-subject fish tiles and
    the "Silver swimmers" relabel.
  - **bottom-sitter** vs **bottom-other**, the 18-Jun split left these two near-identical
    seabed silhouettes; pulled them to opposite poles, bottom-sitter = small/plump/smooth
    two-goby cluster, bottom-other = big/armoured/spiky gurnard with a spread wing pectoral
    + walking finger-rays, so the icon (the sole disambiguator, since labels carry no shape
    hint) actually separates them.
  - **long-skinny**: replaced the potrace "boomerang" (the lone non-hand-authored icon)
  - **long-skinny**, replaced the potrace "boomerang" (the lone non-hand-authored icon)
    with a clean hand-drawn slender eel: gentle S, a negative-space eye, a small symmetric
    tail fin; no longer reads as a boomerang/snake.
  - Attribution: `long-skinny` was a reused PhyloPic potrace and is now a PEBL-original CC0
    hand drawing, updated `bodyform-silhouette-credits.json` accordingly; also corrected two
    stale taxon labels (wrasse was *Abramis brama*, a freshwater bream → Labridae;
    silver-shoaler *Scomber* → Clupeidae/silvery shoalers).
  - Verified: `tsc` clean, **336 tests pass**, `lint` + `lint:tokens` clean, and every tile
    rasterised + eyeballed at a 40px "small render" simulation (the size users actually see).
    Remaining validation: the Gemini re-score (`npm run score:silhouettes`) needs `GEMINI_API_KEY`
    in `.env.local` (not present in CI/remote), run it after merge and diff the baseline; targets
    are cod/wrasse >80 and no `bottom-sitter`↔`bottom-other` `confusableWith` flag.


## End-to-end audit fixes, 8 of 11 findings (17 Jul 2026)

Working from an 11-finding audit report (compiled 16 Jul 2026, published as a
Claude artifact). Branch `fix/audit-findings-jul2026`, 9 commits on top of
`main` at `89112b6`. **Not yet merged** and this branch was never committed
against the main working checkout, so a fresh session needs to know where it
actually lives: see the handoff doc, `implementation/2026-07-17/audit-fixes-handoff.md`,
for the exact path and everything a verification pass should check.

- **Critical: guest to admin privilege escalation, fixed.** `isAdminUser()`
  (was `isAdminEmail()`) now requires a verified email in addition to the
  `@pebl-cic.co.uk` domain match. Previously any signed-in guest could
  `POST /api/guest/claim` with an unclaimed `@pebl-cic.co.uk` address and
  become a full admin instantly, since guest claim writes `User.email`
  without proof of ownership and `emailVerified` stays null. Same gap fixed
  on the private per-user answers view (`/u/[id]`). `src/lib/admin.test.ts`
  added (8 tests); this was the first test to import `admin.ts`, which
  surfaced a separate gap (`npm test` needs `NEXTAUTH_SECRET` from
  `.env.local`, not loaded by a bare `vitest run`), fixed in
  `vitest.config.ts` via Vite's `loadEnv`.
- **`DriftingSilhouettes` hydration mismatch, fixed.** `Math.cos`/`Math.sin`
  are not spec-guaranteed bit-identical across engines, so a returning
  visitor's server and client could disagree on the last float bit of a
  computed offset, tripping a hydration warning on every page load. Rounding
  every computed value to a fixed, coarse precision before stringifying
  fixes it. Cleared 8 of the Playwright suite's 9 failures (25/34 to 34/34
  passing); the 9th was an unrelated cold-compile flake, confirmed by
  rerunning clean.
- **Copy and accessibility nits, fixed.** The species flash card's "Usually
  seen at: Not recorded" placeholder (depth data is a live OBIS cache, not
  always populated) now omits the row instead, matching the pattern
  `SpeciesComparison` already used. Account deletion redirects to
  `/?deleted=1` but nothing rendered that confirmation; added
  `DeletedAccountToast.tsx`. The homepage "How it works" section had three
  `<h3>` step cards with no `<h2>` before them (skips a level after the hero
  `<h1>`), the Lighthouse moderate heading order finding; added a visible
  heading for the section.
- **2020 dated Algapelago archive clip, investigated, not changed.** The
  audit flagged one Bideford Bay clip dated January 2020 as worth a sense
  check against PEBL's Algapelago work (documented elsewhere as starting
  2025). There are actually **9 such clips**, not one, spanning 22 Jan to 10
  Feb 2020, all sharing the same site name and exact lat/lon, with time
  stamps consistent with a real time lapse deployment (09:00:40 /
  12:00:40 capture times). This reads like genuine early footage under the
  Algapelago name predating the eDNA programme's 2025 start, not a typo, but
  Claude does not have the ground truth to say for certain. Needs Christian's
  call; no data was touched.
- **Full source listed CSP, fixed.** Replaces the 4 directive, zero risk
  only policy from the 15 Jul hardening pass with a complete
  `script-src`/`style-src`/`img-src`/`media-src`/`font-src`/`connect-src`
  policy. Every host was confirmed empirically (a live DB query for every
  `SpeciesImage`/`Snippet` URL actually in use, plus reading the Leaflet
  `tileLayer()` call directly), tested first as `Content-Security-Policy-Report-Only`
  across every major page with zero violations, then flipped to enforcing
  and reverified against a real `next build && next start` production
  server.
- **Rate limiter shared store, implemented (opt-in).** Added a pluggable
  Redis backend via `@upstash/redis`, auto-selected when
  `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are set, falling back
  to the existing in-memory behaviour with zero change otherwise (no Upstash
  account exists yet; provisioning one is an infra step for whoever owns
  deployment). Fails open on any Redis error. All 6 `checkXRateLimit()`
  exports are now `async`; all 13 call sites across 9 files updated. Also
  consolidated 4 duplicated client-IP extraction call sites onto the
  existing `client-ip.ts` helper, which had zero test coverage before this
  despite backing every IP-keyed rate limit in the app (11 tests added).
  Verified live: guest sign-in exercised end to end through the refactored
  `authorize()` (real session created, then the test row deleted).
- **`npm audit` cleanup + Next.js major upgrade scoped, not attempted.** Ran
  `npm audit fix` (non-breaking) plus an isolated `@react-email/components`
  major bump (confirmed `prismjs`'s vulnerable dependency chain was dead
  code via grep before touching it; spot-checked by actually rendering
  `PasswordResetEmail` through the new version and asserting on the real
  HTML output). Production `npm audit`: 36 to 26 vulnerabilities. The
  remaining findings all trace back to the Next.js 14 to 16 and NextAuth 4
  to 5 upgrades, both correctly out of scope for an audit-fixes pass per
  the report's own call (no reachable RCE/auth bypass, several
  Vercel-mitigated). Scoped in
  `implementation/2026-07-17/next-major-upgrade-scope.md`: what actually
  breaks in this codebase specifically, a recommended sequence, and an
  effort estimate.
- **Back/forward cache, fixed.** Root cause: the root layout called
  `readConsent()` (`next/headers` `cookies()`) unconditionally to compute
  the cookie banner's initial state. Calling `cookies()` anywhere in that
  shared tree forces every page in the app into fully dynamic,
  `Cache-Control: no-store` rendering, which disqualifies every page from
  the browser's back/forward cache, exactly the audit's "fails on every
  page" finding. Moving the check to the client restored static/ISR caching
  for `/`, `/privacy`, `/terms`, `/accessibility`, `/auth/signin`,
  `/auth/forgot`, and `/species`; `/feed`, `/feed/browse`, `/leaderboard`,
  `/account`, and `/admin/*` correctly stay dynamic (real per-user
  personalisation, not a bug). While verifying this, found and fixed a
  genuine hydration mismatch it exposed: reading `document.cookie` in a
  `useState` lazy initializer made the server (no cookie access) and a
  returning client (cookie exists) disagree on the first render, and React
  left an orphaned, unmanaged DOM node behind rather than reconciling it,
  so the cookie banner's buttons silently stopped responding to clicks.
  Fixed via the standard defer-to-a-post-mount-effect pattern; the same
  latent pattern existed in `VerificationBanner.tsx` and got the identical
  fix. Also caught and fixed a regression from this session's own copy-nit
  work: `DeletedAccountToast` had been reading `searchParams` server-side,
  which silently broke the homepage's own ISR.

Deliberately not pursued this pass (Christian's call, not essential to the
launch-readiness goal): **homepage image optimisation** and **`/feed`
main-thread blocking (TBT)**. On TBT specifically: the reported 3.3 to 4.0s
did not reproduce locally in the same way, and a plausible, well-reasoned
fix (video `poster` was loading eagerly for all ~73 off-screen feed cards,
since `<video poster>` has no equivalent of `<img loading="lazy">`) produced
a confusing, inconclusive before/after Lighthouse comparison, likely because
another concurrent session's dev server was competing for CPU on the same
machine during measurement. The attempted fix was reverted, not shipped;
`FeedCard.tsx` is unchanged from `main`.

**Operational note:** partway through this session, the shared main working
directory (`C:\Users\Christian Abulhawa\FishSpotter`) was switched to a
different branch (`feat/difficulty-ladder`) by another concurrent Claude Code
session, without this session's knowledge. One commit briefly landed there
by mistake; it was recovered via `git cherry-pick` into an isolated worktree
at `C:\Users\Christian Abulhawa\FishSpotter-recovery-tmp` (checked out to
`fix/audit-findings-jul2026`), which is where the rest of this work happened
and where the branch currently lives. `feat/difficulty-ladder` was left
untouched since it is not this session's branch to rewrite, but it still has
that one stray commit sitting on top of its own work and will want cleanup
(for example `git branch -f feat/difficulty-ladder <their-last-real-commit>`)
by whoever owns that branch.

Every commit above verified: `tsc` clean, vitest green (394 to 400 tests
depending on the commit), `next lint` clean, and a real `next build && next
start` production server reverified after the CSP, back/forward cache, and
dependency changes specifically (not just `next dev`). Playwright 34/34.
Not yet merged to `main`, and Lighthouse has not been rerun as a full,
low-noise, final pass, both intentionally handed to the next session; see
the handoff doc for the exact checklist.


## Spot It close/reopen loop fix (17 Jul 2026)

- **Fixed:** pressing Close (X) on any "Spot It" gate (the shape picker, the
  body-shape picker, or the species photo grid) left the floating
  Identify/Where-is-this?/Skip action panel visible underneath, `panelCollapsed`
  was never reset on close, so dismissing the gate surfaced a second, unlabelled
  box instead of returning to a clean clip, and there was no obvious way back
  in. `src/components/FeedCard.tsx`'s three gate `onClose` handlers now also
  call `togglePanel(true)`, the same call the panel's own Hide button already
  makes, so Close always lands on a bare clip with the tap-to-identify catcher
  as the one consistent way back in: open → close → tap → open now loops
  indefinitely instead of stranding the user.
- Verified: `tsc` clean, full test suite green, `lint` clean, and the actual
  loop driven end-to-end twice in a live preview browser (opened the shape
  gate, closed it, confirmed zero visible floating panel with the tap catcher
  restored, tapped, confirmed the gate reopened).

## Difficulty ladder for the feed (17 Jul 2026, SHIPPED LIVE via PR #105, main `31ddf8b`)

New spotters get clear, easy clips first; harder/more cryptic ones mix in as they gain
experience. Built in two phases (validate the signal, then commit to a schema change) per
experience. Built in two phases, validate the signal, then commit to a schema change, per
Christian's steer.

- **Phase 0 (throwaway validation):** checked whether apparent organism size (median bbox area
  from the existing `bboxJson` track) actually separates clips the way a human would expect
  before building anything durable on it. 73/77 active clips have a usable bbox track, 262x
  spread in area, and the ranking passed a gut check (small crabs/gastropods sink to "hard,"
  larger/closer subjects rise to "easy"). Confusability data (`confusion-matrix.ts`) was also
  considered but is too sparse to trust yet, only 24 wrong answers recorded, half against coarse
  placeholder references ("Fish"/"Crab"), so it's deferred to a later empirical pass once there's
  real per-clip answer volume.
- **Schema:** `Snippet.difficultyScore Float @default(0.5)` (1 = easiest, 0 = hardest,
  corpus-relative percentile). Live on prod DB; 73 clips seeded via `scripts/seed-difficulty.ts`
  (`npm run db:seed-difficulty`, idempotent, safe to re-run after `db:sync` adds clips).
- **Ordering** (`src/lib/difficulty.ts` + `src/lib/feed-ordering.ts`): `orderFeed` gained an
  optional `readiness` param (0 = brand new, ramps to 1 over 15 answered clips) that soft-weights
  the unanswered tier toward easy/medium/hard bands, never a hard filter, so the feed never
  dead-ends into all-hard or all-easy. Omitting `readiness`, or an item missing
  `difficultyScore`, reproduces the exact prior shuffle, so every existing caller/test is
  unaffected. Anonymous visitors and signed-in users with no answer history both start at
  readiness 0.
- **Deliberately deferred, not oversights:** Phase 2 (migrating the score from intrinsic/bbox-size
  to empirical/answer-accuracy-derived, once there's traffic to trust) and a user-facing
  difficulty badge, an invisible pacing curve is arguably the better product call than a visible
  "Level 3!" indicator, but that's Christian's to weigh in on.
- **Bonus fix, same pass:** `main`'s own CI had been failing on every push since PR #103 landed
  (`admin.test.ts`'s import chain hits `src/lib/auth.ts`'s `NEXTAUTH_SECRET` fail-fast guard, and
  CI never had a dummy value for it). Fixed with a one-line addition to `.github/workflows/
  ci.yml`'s existing dummy-env-var block, pre-existing gap, unrelated to this feature.
- **How it shipped, worth knowing given the operational note above:** the original build (commit
  `c1ecce4`) landed on a branch based off the now-merged `fix/audit-findings-jul2026`, and picked
  up one unrelated commit when this shared checkout's branch changed under it mid-session. Since
  the two commits touched disjoint files, the difficulty-ladder diff was cherry-picked cleanly
  into an isolated worktree, pushed as `feat/difficulty-ladder-v2`, and merged via PR #105, no
  content lost.
- **Verified:** `tsc --noEmit` clean, full suite green (400+ tests, 28 directly on this), `lint` +
  `lint:tokens` clean, and separately live-verified against prod: `/feed` renders 200 with real
  content, the `difficultyScore` raw-SQL query executes without error, no console/server errors.

## Seaweed farm mission integration (16-17 Jul 2026, SHIPPED LIVE)

Connects the fish clips to the real UK seaweed farms PEBL monitors under the NLCAF/WWF
"Unlocking the Power of Seaweed" programme, so spotting a fish also surfaces why that farm
exists: mostly biostimulants, a natural fertiliser alternative, for climate-resilient
agriculture. Built across several passes, each shipped and verified independently rather than
held back for one big merge.

- **Research, grounded not guessed:** transcribed all 4 available March 2026 PEBL farmer
  interviews (Adrian/Atlantic Mariculture, Alex & Martin/Kelp Crofters, Beth/Câr-y-Môr,
  Luke/Algapelago; Kaly and Norfolk Seaweed have no interview footage) and researched all 6
  farms' own websites for mission/story copy. Cross-checked the DB rather than assuming: of the
  91 live clips, only Algapelago/Atlantic Mariculture/Kelp Crofters map to a farm by exact
  `Snippet.deployment`; three other deployments (Dale Bay/Project Seagrass, Veerse
  Meer/Netherlands oyster project, East Pickard Bay/BRUV trial) are unrelated PEBL projects
  reusing this app and were deliberately excluded from any farm framing. Blakeney Overfalls =
  Norfolk Seaweed, confirmed by Christian.
- **Content model:** `src/lib/farms/traits.ts` + `catalogue.ts` (zod-validated, mirrors the
  species-catalogue pattern) + `src/data/seaweed-farms.json`, all 6 farms. `catalogue.test.ts` is
  the CI gate (schema strictness, no duplicate deployment claims, every referenced media file
  exists in `public/`).
- **Pages + discovery:** `/farms` hub + `/farms/[slug]` profiles (mission, biostimulant story,
  attributed interview quotes, founding story, live clip/species counts). Three low-friction
  discovery routes, not a hard gate: a `SideMenu` nav entry, a landing-page thumbnail strip, and
  a visual "Filmed at [farm]" card on the feed reveal (only on clips actually from a mapped farm).
- **Real photography:** scraped each farm's own website (permission confirmed by Christian) for
  operational imagery, 36 photos total, optimised to local WebP via
  `scripts/farm-media/build.mjs` (`sharp`), never hotlinked.
- **Video, added then removed:** three farms briefly had an embedded YouTube/Vimeo film; per
  Christian's steer ("we dont need video... just have the pictures"), all farm video was removed
  and the now-fully-unreachable `FarmVideo` component + its schema field were deleted outright
  rather than left as dead code.
- **Shipped in 5 pushes, each independently verified** (`tsc`, `lint`, `lint:tokens`, full test
  suite, and, for the first two, a full production build) before going out: `5b23c61` (the
  core feature; took 3 merge attempts, since PR #103 and #104 both landed on `main` mid-verification,
  each one handled via a disposable test worktree, never touching another session's checkout and
  never force-pushing), `3782668` (fixed a pre-existing, unrelated local-build error:
  `/opengraph-image` hit a Windows-only bug in Next's bundled `@vercel/og`,
  [vercel/next.js#77164](https://github.com/vercel/next.js/issues/77164); replaced the dynamic
  route with a pre-rendered static PNG via `scripts/build-opengraph-image.mjs`, sidestepping the
  bug entirely since the card's content never varied per-request anyway), `ee21e4f` and `57d40d4`
  (video removal, above).
- **Operational note:** this thread of work hit the shared-repo concurrent-session hazard
  repeatedly (three separate pushes were rejected mid-session by other sessions landing first).
  Every recovery followed the same pattern: disposable worktree, re-fetch, re-verify the actual
  merge target, push immediately.
- **Leaderboard accessibility fix, 20 Jul 2026**: `MIN_ANSWERS_FOR_RANKING` dropped from 10 to 1
- **Leaderboard accessibility fix, 20 Jul 2026**, `MIN_ANSWERS_FOR_RANKING` dropped from 10 to 1
  (`src/lib/leaderboard.ts`): every spotter with at least one submitted answer now qualifies for
  the ranking, including a brand-new guest's very first guess. An audit against the live DB found
  the old 10-answer bar wasn't filtering noise, it was hiding real performance: two spotters (9 and
  8 answers, 210 and 176 Pebbles) outscored a third spotter who WAS visible on the board (15
  answers, 165 Pebbles), and 3 of the 5 people who had ever played were invisible. Also fixed a
  latent inconsistency where `/api/leaderboard` (the public JSON endpoint) hand-rolled its own
  `.sort()` with no minimum-answers floor and no accuracy tiebreak, silently disagreeing with
  whatever renders the ranking on both who qualifies and tie order; it now calls the shared
  `rankSpotters()` helper and includes `rank` in its response, so it's the single source of truth.
  The `leaderboardOptIn` ICO Children's Code gate for declared 13-17 minors is unrelated and
  untouched. `tsc`, full test suite (418 tests), and `lint` all clean; verified live in a dev
  preview against the real DB (5 spotters, all correctly ranked, JSON and the then-current
  `/leaderboard` page matched exactly). **Note:** `/leaderboard` itself was concurrently rewritten
  by separate in-flight work (now a redirect into a new `/pebbles` hub, ranking as a tab via
  `src/components/leaderboard/LeaderboardPanel.tsx`) while this fix was landing, so the page-level
  "N more to qualify" banner cleanup from this pass didn't ship. `MIN_ANSWERS_FOR_RANKING` is a
  shared constant, so the new panel inherits the accessibility fix automatically, but it still
  carries the old "Minimum {N} identifications" copy verbatim, harmless at N=1, worth a pass
  whenever that panel is finished.
- **Pebbles anti-gaming Plan 1 Phase 1, 20 Jul 2026** (commit `6bd41b4`, design record
  `docs/pebbles-anti-gaming-and-prizes-plan.md`), closes the Sybil hole in the crowd-authority
  consensus model: a ring of 3+ colluding accounts could previously self-consensus on a rare
  species and farm the rarity multiplier, since "truth" was an unweighted crowd-of-3
  (`CONSENSUS_THRESHOLD_USERS`). Adds a hidden `trustScore` per user (`User.isTrustSeed` /
  `trustScore` / `trustUpdatedAt`), propagated from a handful of manually-seeded real accounts
  (`christian@pebl-cic.co.uk`, `anjali@pebl-cic.co.uk`, `daniabulhawa@gmail.com`) via personalized
  PageRank over co-occurrence in **winning** consensus camps (`src/lib/trust.ts`, new). Teleport is
  seed-only (not classic PageRank's uniform-everyone teleport), which gives a provable, exact
  property: an isolated ring with zero graph path to any seed earns exactly `0` trust, no matter how
  densely it agrees with itself. Runs daily in the existing `consensus-rescore` cron, right after
  `rescoreConsensus` (sequencing is load-bearing, every reached camp needs a fresh `ConsensusEvent`
  row for decay weighting). `isPrizeEligible` gates on verified email + trust bar + account age +
  non-bursty activity spread; nothing consumes it yet beyond the new read-only `/admin/trust` page
  (trust is never shown to spotters, never removes Pebbles or status, gates upside only). A
  dedicated adversarial review pass caught three real bugs before implementation, all fixed: the
  seed-trust pin has to be the unconditional last step (not fed into the cross-run smoothing blend,
  or re-flagging an existing user as a seed produces a blended ~40 instead of 100); the decay
  formula needed true half-life math (`0.5 ** (age/halfLife)`, not `exp(-age/halfLife)`, which
  reaches 0.5 at the wrong point); and zero seeds must short-circuit rather than divide by a zero
  median (would otherwise write `NaN` into every user's `trustScore` if the code deployed before the
  seed script ran). `src/lib/consensus.ts` gained one new pure export, `pickLeaderGroup` (mechanical
  extraction of the existing inline leader-selection logic, zero behavior change, `rescoreConsensus`
  now calls it too) so the trust graph and the Pebble payout can never disagree about who won a
  clip. Verified two ways: `tsc`/full test suite (456 tests, 39 new)/`lint`/`lint:tokens` all clean,
  **and** a direct run against real production data (bypassing the cron's `CRON_SECRET`, which isn't
  in local `.env.local`) confirmed all 3 seeds pinned at exactly `100.00`, one active guest account
  picked up a genuine non-degenerate `47.57`, everyone else `0.00`, zero `NaN` anywhere. Shipped
  alongside a large concurrent "Pebbles shop" session building `/pebbles`, wallet, and purchases,
  coordinated rather than clashed: confirmed via `git diff` that shared-file edits
  alongside a large concurrent "Pebbles shop" session building `/pebbles`, wallet, and purchases, coordinated rather than clashed: confirmed via `git diff` that shared-file edits
  (`prisma/schema.prisma`'s new `PebblePurchase` model, `consensus.ts`) landed side by side cleanly,
  and staged only this feature's 10 files by explicit path for the commit (never `git add -A`).
  **Not built yet** (later phases per the plan doc): trust-weighting the actual consensus payout,
  the rarity-multiplier cap, coarse taxonomy, collusion-cluster detection, and none of the five
  prizes. **Known gaps:** `PRIZE_TRUST_BAR=40` and the decay/damping/smoothing constants are
  reasonable defaults, not yet calibrated against real accumulated data; Anjali's seed account still
  isn't `emailVerified` (fine as a trust anchor, blocks her personally claiming a prize later); a
  documented, deliberately-accepted burst-loophole in the activity-spread check (see
  `isPrizeEligible`'s docstring).
- **Pebbles shop, 20 Jul 2026** (commit `7b820a2`, LIVE on fish-spotter.vercel.app). A
  Duolingo-style shop layered on the Pebbles economy. Tapping the header pebble bag now opens a
  new `/pebbles` hub with **Shop | Leaderboard** tabs; the old `/leaderboard` route redirects into
  it and its body was extracted to `src/components/leaderboard/LeaderboardPanel.tsx`. The currency
  is split in two so spending never costs a spotter their rank: lifetime **earned**
  (`sum(Answer.points)`) still ranks the leaderboard and never decreases, while a spendable
  **wallet** (`earned - shop spend`) drives the bag and shop (`/api/me/pebbles` now returns
  `{earned, spent, wallet}`). Items live in a code catalogue (`src/lib/shop/catalogue.ts`) backed
  by a new `PebblePurchase` ledger table, not a DB item table. Three items shipped: **Gold
  nameplate** (150) and **Coral accent** (300), one-time cosmetics that render on the public
  `/u/[id]` profile; and **Tide Freeze** (80, hold up to 2), a consumable that protects the
  day-streak. The freeze is correct and one-time: a freeze-aware streak
  (`computeStreakWithFreezes` in `src/lib/streak.ts` + `src/lib/streak-service.ts`) bridges a
  missed day by spending a held freeze and stamps `PebblePurchase.consumedForDate` with the
  protected date, so the bridge stays permanent on recompute and cannot be double-spent;
  `/api/answers` is the single writer, other streak reads (`/api/streak`, profile, hub banner) are
  read-only. Purchases go through `POST /api/shop/purchase` (auth + same-origin + zod +
  `checkShopRateLimit` + server-side affordability/ownership/hold-cap). Also removed the rotating
  SwimLoader captions ("Chasing the shoal", etc.) at Christian's request. Prod DB migrated
  (`PebblePurchase` + `consumedForDate`) with RLS enabled (19/19). Verified: `tsc`, 463 tests
  (new shop/wallet/streak suites), `lint`, `lint:tokens`, production build; real purchase and
  freeze-consumption integration runs against the DB; shop/leaderboard/profile checked at desktop
  1280 and mobile 375 (no horizontal overflow, touch targets >=44px); and confirmed live on prod
  after deploy. Built alongside the concurrent trust session above; staged by explicit path (never
  `git add -A`). **Not built yet:** more shop inventory; a live end-to-end purchase click on the
  deployed build (logic is DB-integration-tested, but no funded account was signed into via the UI).
- **Traffic-source observability, 20 Jul 2026**: prompted by the first Reddit share of
- **Traffic-source observability, 20 Jul 2026**, prompted by the first Reddit share of
  fishspotter.app; goal was to see whether a channel is converting without adding any user-facing
  friction. Added `@vercel/analytics` to the root layout (pageviews/referrers/geo/device, no
  cookies, no consent required). Separately, extended the existing consent-gated `Event` pipeline:
  `session_start` now carries a one-time referrer hostname (`document.referrer`, host only, never
  the full URL) + `utm_source`/`utm_medium`/`utm_campaign` from the landing URL
  (`src/lib/engagement.ts`), stored on 4 new nullable `Event` columns and surfaced as a "Top sources
  (30d)" panel on `/admin/metrics`, so a channel like Reddit can be tied directly to the existing
  funnel (signups, watch time, IDs, consensus accuracy) instead of living in a separate dashboard.
  Zero incremental friction: the capture only fires for spotters who already accepted analytics
  consent; nothing new is asked of anyone. Prod DB migrated (`prisma db push`, additive-only), RLS
  reconfirmed 19/19. Verified: `tsc`, 463 tests, `lint`, `lint:tokens`.
- **Community-launch seeding, 20-22 Jul 2026** (full status in memory `project_community_launch.md`):
  first public outreach push for FishSpotter, honest-builder voice with an AI-tell QA pass on
  every draft (no em/en dashes, no corporate register, a real founder detail like the pipefish
  clip). **Live and verified**: r/uknature, r/CitizenScience, r/WebGames (Reddit, anon account
  u/No-Front-6594; r/WebGames has genuine engagement, a feature-suggestion thread already
  answered), BMLSS and ID Please (Facebook, Christian's real identity, both mod-approved and
  visible). A SciStarter project listing was drafted, filled in across all form sections, and
  submitted by Christian (22 Jul), pending SciStarter editorial review. **Attempted, not yet
  confirmed live**: Fish Identification UK Facebook post (text staged in the composer, submission
  not verified) and a Snorkelling in Britain post (built around the seal clip, not yet drafted in
  the composer). **Still open**: r/UKecosystem modmail sent, awaiting a mod reply before posting;
  the send-yourself outreach drafts (MarineMumbles, The Rock Pool Project, MBS Plymouth, Free Range
  Ocean, Sea Tales, The Marine Biologist Podcast) are written but not sent, per the house rule that
  outbound emails/DMs are always drafted, never sent, by the assistant. **Hard constraint
  discovered**: the browser-automation tool cannot upload local files by any path (OneDrive, a
  session-scratch copy, or a pasted-into-chat attachment all rejected with "only files the user has
  shared with this session"), so any post that needs a specific photo/video attached (not just the
  auto-generated link-preview card) has to be attached by Christian himself.
- **Social share card rebuilt around real footage, 21-22 Jul 2026** (`scripts/og-card.ts`,
  `src/app/opengraph-image.jpg`, `public/og/hero.jpg`, `src/app/og-fonts/`): the previous
  `opengraph-image.png` was a dead text-only card (wordmark on a plain dark box); every link share
  to Reddit/Facebook/directories was leading with it. Replaced with a Playwright-rendered JPEG built
  around a real seabed-camera frame (a velvet swimming crab off Skye, extracted from a Kelp Crofters
  clip) plus the "by PEBL" logo lockup (same asset/treatment as the app header) and the FishSpotter
  wordmark. Iterated with the existing Gemini 3.5 Flash `ui-critique` loop until PASS 95/90. A real
  bug surfaced and got fixed along the way: Facebook's **comment**-level link preview is a small
  center-cropped square, not the full 1200x630 card, and the original left-anchored text sliced
  "FishSpotter" to "hSpotter" in that crop. `og-card.ts` now renders and Gemini-critiques that exact
  square crop on every run (not just the full card), so this class of bug can't ship silently again.
  Also fixed `metadataBase`'s fallback domain in `src/app/layout.tsx` from the stale
  `fish-spotter.vercel.app` to the canonical `fishspotter.app`. **Not yet committed to git** (working
  tree has the new/changed files staged but uncommitted), needs a commit + push to deploy, then a
  Facebook Sharing Debugger re-scrape so the two already-live Facebook posts pick up the new card.

## 2026-08-01: Spider crab generalised from species to group level

`Hyas araneus` / "Great Spider Crab" is now `Majoidea` / "Spider Crab". Christian's call:
the UK spider crabs (great, spiny, scorpion) can't reliably be told apart on a video clip,
so asking a spotter to pick the great one was a distinction the footage doesn't support.
The card no longer claims a species-level ID it can't back.

- **Catalogue** (`species-traits.json`, `species-aliases.json`, `species-images.json`) re-keyed
  to `Majoidea`. Field note rewritten group-wide and now says outright that the UK spider crabs
  are lumped here. Aliases widened to absorb the old label plus `Hyas` / `Maja` / `Inachus` /
  `Majidae` surface forms, so historical and free-text answers still match.
- **New `fetchName` manifest field** + `src/lib/biodiversity/fetch-name.ts`. A superfamily-level
  query to iNaturalist / Wikimedia / OBIS returns the whole clade worldwide (Japanese spider crab,
  Libinia), which would poison the gallery and the distribution map, so photo and OBIS pulls for
  `Majoidea` are pinned to `Hyas araneus`. Applied in `refresh-images.ts`,
  `build-species-galleries.ts`, and `species-cache.ts` (depth + distribution). Rows are still
  stored under the catalogue key.
- **DB migrated** via `scripts/rename-spider-crab.ts --apply` (idempotent, re-runs clean):
  5 `SpeciesImage`, 3 `DiagnosticMark`, 6 `UnlockedSpecies`, 11 `Answer.chosenOption`,
  1 `ConsensusEvent` re-normalised, stale depth/distribution cache rows dropped so they refetch.
  The three authored rings (pear-shaped carapace / two rostral horns / long spindly legs) were
  already worded group-wide, so they carried over unchanged.
- Food web rebuilt (`node food-web/build-foodweb.mjs`, 72 species / 234 links unchanged);
  photo-blocklist annotations re-keyed.
- **Note:** the species profile URL moved from `/species/hyas-araneus` to `/species/majoidea`;
  no redirect was added.

## 2026-08-01: Public clip comments + PEBL feedback inbox (SHIPPED LIVE, PR #119, main `0ad167f`)

Spotters can now leave a comment on a clip after committing their own ID: the species isn't in
the list, the clip is too murky to call, it looks like a juvenile, or anything else. Comments
form a **public thread** per clip, and land in a staff triage + moderation inbox at
`/admin/comments` with instant email to verified `@pebl-cic.co.uk` accounts. Full design record
in `implementation/2026-08-01/user-comments-plan.md`.

- **The load-bearing rule: the thread is invisible until you have answered that clip.** Not
  politeness. `src/lib/consensus.ts` pays Pebbles for INDEPENDENT convergence and
  `src/lib/trust.ts` propagates reputation through the winning camps, so a thread readable
  before you commit would quietly turn consensus into a measurement of copying. Mirrors the
  gate `GET /api/snippets/[id]/stats` already applies to the histogram.
- **New tables** `Comment` + `CommentReport` (pushed to prod, RLS enabled and verified). Also
  carried forward the `Event.label` column DECLARATION: it already existed in production but was
  never committed to `main`, so a `db push` from a fresh branch would have DROPPED it and its
  data. Confirmed purely additive via `prisma migrate diff` first; `--accept-data-loss` never used.
- **One serialisation door.** `toPublicComment()` in `src/lib/comments.ts` names every field
  explicitly and never spreads a Prisma row, so `adminNote` and author emails cannot leak. The
  author's email is not even a parameter to that module. Mutation-tested.
- **Blocklist** merged with the LDNOOBW open-source English list (MIT; basis of the `bad-words`
  npm package): 403 entries filtered to 250. **44 words deliberately excluded** because they
  collide with this app's own content: `sex`/`sexual` ("sexual dimorphism" is standard
  field-guide language), `anus`/`penis` (real crustacean + cephalopod anatomy), `shrimping` (a
  real fishing activity), `xx`/`xxx` (near-universal UK texting sign-off), `sucks`/`sexy` (not
  unambiguous profanity by the module's own bar). Matcher is word-level, so it stays immune to
  the Scunthorpe problem ("bass", "cockle", "assess"). A hit HOLDS for review, never rejects.
- **Minors' names protected.** Declared 13-17 accounts default `leaderboardOptIn: false`, which
  already hid their name from the leaderboard; comments now honour the same signal via
  `publicAuthorName()`, showing an anonymised `Spotter <id6>` handle to other spotters. Staff
  still see the real name for moderation. This closed a real inconsistency, not a hypothetical.
- **Moderation:** report control on every comment (5 reasons, one per person per comment),
  auto-hide at 3 distinct reporters, admin hide/unhide/delete, canned one-tap replies, outcome
  codes on resolve. Hard link rejection at post time. Rate limits 20/hr/user, 3 top-level per
  clip (replies exempt, so a conversation can't be cut off).
- **OSA risk assessments** in `docs/safety/` (illegal-content s.10 + children's s.12 + ICO
  Children's Code cross-reference), written against the actual implementation and **adopted by
  Christian Berger on 2026-08-01**. The children's assessment records an explicit decision NOT
  to build age-segregated comment threads, with reasoning: segregation built on self-declared
  age would only protect users who declared honestly, adding complexity and false assurance
  without reducing real risk. Structural mitigations (no private messaging anywhere, the
  answer-gate, public-only visibility, reactive reports) do not depend on declared age.
- Terms of Service gained a "Comments and discussion" section; Privacy Policy gained a
  collection row + retention line describing the public nature and the anonymisation behaviour.
- **Bug found by live validation, not tests:** the per-clip cap was also blocking REPLIES, so a
  spotter with 3 comments on a clip could never answer anyone there again. Fixed + regression
  tested. Also fixed from a Gemini 3.5-flash visual pass: composer reason chips wrapped to four
  rows and pushed Post off a 390px screen, admin controls were 36px against the repo's 44px rule.
- Verified on the live domain after deploy: anonymous `GET /api/comments` returns exactly
  `{"gated":true}` with no leaked fields, bare GET is 400, anonymous POST refused, RLS 21/21.

## 2026-08-03 - Workshop deck rebuilt: real photography, a narrower farm-built claim, drawn master solutions

Full pass over the "Who lives on a seaweed farm?" workshop deliverables (species cards,
facilitator guide, food-web classification) for the St Davids seaweed festival. Two commits,
plus an unfinished A1-mat thread.

- **Species cards rewritten** (`2d4e1d0`, `food-web/workshop/make-cards.mjs` + `card-photos.json`).
  Removed the Welsh-name field (coverage was inconsistent across the deck, 28 of 40). Replaced
  around 13 bad photos (hand-held, wrong species, dead/beach-cast, occluded) with Gemini-vision-scored
  alternatives found via the DB cache plus fresh iNaturalist/Wikimedia search; every final photo now
  scores USABLE or better on whole-body visibility. Found a real data bug along the way: the cached
  Atlantic cod photo in FishSpotter's own `SpeciesImage` table is a misidentified different fish (no
  cod features at all); the workshop card was re-pointed to a verified genuine cod, but **the live
  app's DB cache still has the wrong photo** (flagged to Christian, not yet fixed, no response yet).
  Corrected "Curled Octopus" to "Common Octopus" after confirming with Christian these are genuinely
  different species (Eledone cirrhosa vs Octopus vulgaris, single vs double row of suckers); the
  card's biology, photo and diet text were rebuilt for the real species, done locally in
  `make-cards.mjs` via a `CARD_OVERRIDE` shim rather than touching the live catalogue. Added the
  scientific name in grey italic under the common name. Rewrote all 40 nicknames from punchy taglines
  to plain factual one-liners. One accepted caveat: the Sprat photo is the only living-specimen
  option in the entire worldwide print-safe pool (8 of 9 candidates were dead or beach-cast); the one
  usable option is a New Zealand observation.
- **Farm-impact classification narrowed, master-solution answer sheets added** (`e68559b`,
  `food-web/build-foodweb.mjs`, `food-web/workshop/guide.html`, new `food-web/workshop/build-mats.mjs`).
  Re-graded the `FARM` map on an attraction-vs-production test: `created` (farm-built) is now
  restricted to animals that cannot physically occupy bare sediment (hard-substrate obligates plus
  small site-attached crevice fish); large mobile animals a farm merely draws in (ballan wrasse,
  cuckoo wrasse, both octopuses) moved to `enhanced`. Baseline flips from 72->47 species / 238->133
  links to **72->51 species / 238->151 links**; the honest claim on feeding connections is now "just
  over a third", not "just under a half". `public/food-web.html` regenerated from the same data;
  `food-web/verify.mjs` clean, 0 errors. Also found and fixed a genuine blocker: the guide's minute-24
  reveal tells people to "turn over the card with the filled circle" but no card printed a farm-status
  symbol at all, so the reveal could not physically run. Cards now carry a farm badge
  (created/enhanced/anyway/harmed) above the QR code. The facilitator guide's page 10 expanded into 5
  master-solution page-pairs, one per table: a generated SVG of the finished A1 mat with every card
  placed and every arrow drawn, a numbered why-this-arrow key, per-card placement reasoning, and a
  second small mat showing the same table after the reveal. Every arrow drawn is cross-checked
  programmatically against the real food-web edge list (a build-time assertion, not a visual guess),
  which caught one real error (table 4 was missing the `plankton -> farmed mussels` arrow) before it
  shipped. Guide grew from 11 to 21 pages, verified page by page against the 271mm printable-height
  limit.
- **A1 print mat: two parallel builds exist, neither committed.** `food-web/workshop/build-mat-a1.mjs`
  (new, untracked) generates a true-size 841x594mm print PDF locally, iterated against a Gemini
  vision critique loop (`scripts/critique-image.ts`, also new, a general local-image counterpart to
  the existing `ui-review.ts`) across 4 rounds to a 96/100 pass. Separately, at Christian's request,
  the same mat was built directly inside the Claude Design portal (claude.ai/design, project
  "diagram seaweed") as `Workshop Mat A1.html`, reusing the actual "Biodiversity Mechanisms"
  diagram's artwork; that build independently found and fixed the same right-edge anchor collision
  the local version had, plus a real pre-existing fill bug in the Mechanisms diagram's anchor symbol.
  The portal version came out over-desaturated relative to the original diagram's character; a
  follow-up prompt to fix saturation was drafted but not sent (the Claude Design session was at 90%
  of its quota, resets 1:10pm). **Open decision: which build becomes the real asset**, or whether to
  reconcile the two. Also still open from the original guide spec: 5 mats printed vs. 6 tables
  planned for at high attendance (the kit budgets a spare card deck for a 6th table but not a 6th
  mat, roughly £20 to close), and the encapsulation gauge is unspecified (250 micron gloss
  suggested, not confirmed).
- Christian test-printed the guide, species-cards and evidence-cards PDFs on 2026-08-03; all three
  were rebuilt from source and byte-verified against the committed versions before sending (result
  of the test print not yet reported back).


## 2026-08-13: End-of-feed state + new-clip notifications

**Triggered by a user report, not a test.** DilutedTea (the app's top spotter) emailed to say they
had "suddenly stopped being able to vote on any video, on any browser". Nothing was broken. They
had answered all **73 of 73** clips the feed serves, and they were the only spotter in that
position (next highest had 43 left). Because `FeedCard` renders the quiz only when the viewer has
no answer for that clip, a spotter with nothing left sees a reveal on every card, no vote
affordance anywhere, and no explanation. Finishing the feed was indistinguishable from a crash.

Ruled out first: last deploy was 1 Aug (12 days earlier), other spotters voted successfully after
their last vote, and the answer path was healthy.

Shipped:

- **End-of-feed card** (`src/components/feed/FeedComplete.tsx`). A final feed section, shown once a
  spotter has identified everything: confirms the count and their Pebble total, says plainly that
  nothing is broken, and carries the notification opt-in inline (the moment they most want it).
  `cleared` is derived live from `unansweredCount - recentlyAnswered.size`, so someone who finishes
  their last clip mid-session gets the card immediately rather than after a reload.
- **New-clip email opt-in**, mirroring the existing `digestOptIn` pattern: `User.newClipsOptIn`
  (default **false**, PECR Reg. 22), `lastNewClipsNotifiedAt` as the outbound watermark, a PATCH
  route, an account-settings checkbox, an HMAC one-click unsubscribe on its own token namespace
  (so it can never silence the weekly digest), a `NewClipsEmail` template, and
  `/api/cron/new-clips` daily at 10:00 UTC. Sends only when something is genuinely new.
- **In-app banner** (`src/components/feed/NewClipsBanner.tsx`): "N new clips since your last visit",
  measured from `User.lastFeedSeenAt` and dismissed explicitly (never stamped on page load, so an
  accidental reload cannot burn the notice). Falls back to `User.createdAt` when null, so nobody is
  greeted with "73 new clips" on their first load.
- **Shared `src/lib/new-clips.ts`** is the single definition of "a new clip" for all three
  consumers. It applies `excludeBlockedSnippetsWhere()`, which is load-bearing: 24 of the 97
  Snippet rows are hidden from every user-facing surface, so counting raw `createdAt` would promise
  footage the spotter can never be shown. 18 unit tests.
- **Fixed an adjacent bug in the weekly digest cron**, which counted new snippets *without* the
  blocklist filter and could therefore advertise hidden clips.

**Deliberately NOT shipped: a "change my ID" button on an answered clip.** It looked like a cheap
way to give exhausted spotters something to do, but `consensus.ts` groups on the CURRENT
`chosenOption` and credits per (clip, name) event via `creditedAnswerIds`. An answer sitting in a
losing camp has never been credited, so switching it to the leader after reading the community
histogram would collect the consensus payout. That defeats the blind-submission anti-herding
design the whole Pebbles economy rests on. Revisit only with the consensus camp frozen at first
submission.

Prod: `prisma db push` applied (3 additive columns, verified by `migrate diff` beforehand as
add-only), RLS re-checked 21/21. `tsc` clean, 576 tests pass, `lint` + `lint:tokens` clean.

**Operational finding:** only **3** accounts are currently verified and non-guest, so only 3 people
can receive this email at all. 19 real accounts are unverified and 44 are guests. DilutedTea is
among the unverified, so they see the verify-your-email prompt rather than the checkbox. Email
verification, not the opt-in, is the binding constraint on this feature's reach.

## 2026-08-28: Fish Rung-2 re-cut to two zone tiles (seabed vs water column)

The fish gate's second rung asked "What kind of fish was it?" and offered **seven**
family-gestalt tiles (Cod-shaped / Wrasses / Silver swimmers / Small bottom fish /
Bigger bottom fish / Long and skinny / Shark-shaped). Two problems with that, both
raised from use: seven tiles is a lot of reading before the first photo, and every
one of them asks a beginner to name a **family** off a short clip, which is the
hardest thing on the screen rather than the easiest.

It now asks **"Where was the fish?"** and offers **two** tiles:

| Tile | Species | What moved in |
|---|---|---|
| Moving along the seabed | 15 | small bottom fish + bigger bottom fish + the catshark (it lies on the sand, it is not a mid-water shark) + the conger and the butterfish (both thread along the bottom) |
| Moving above the seabed | 18 | cod-shaped + wrasses + silver swimmers + the fifteen-spined stickleback (it hangs in the weed above the bottom) + the two-spotted goby (the one goby that hovers in mid-water over the kelp) |

Both tiles then open the Rung-3 photo grid, which is where users are strongest.

- **New trait `fishZone` (`seabed` / `water-column`)** in `src/lib/idguide/traits.ts`,
  on all 33 fish in `species-traits.json`, wired through `narrow.ts`, the catalogue
  zod schema and `trait-questions.ts`. It is its own trait rather than a bundle of
  `fishGroup` values because the `long-skinny` group splits across both zones.
- **`fishGroup` is NOT retired.** It stays the authoritative family grouping behind
  the scenes: silhouettes, comparison sets, the food web, the (orphaned) yes/no
  narrowing engine. `fishZone` is a presentation cut layered over it, so a future
  re-grouping does not need a data migration.
- **Coarse commit** now reads "It's just a fish on the seabed" / "...up in the water"
  (`FISH_ZONE_COARSE_NOUN`), and both nouns resolve to the fish shape class in
  `answer-matching`, so a zone-level commit still earns shape-class credit.
- **Two new tile silhouettes** (`public/silhouettes/forms/seabed.svg`,
  `water-column.svg`, PEBL CC0). They deliberately draw the same seabed line in the
  same place, so the only difference between the icons is the gap of open water
  under the fish.
- **The 10-species Rung-2 ceiling no longer applies to fish.** That rule (17 Jun)
  was about how many *named things* a node may ask a user to choose between; this
  node offers two. The tests now enforce the ceiling where it still means
  something: max 10 options at any node, max 24 species per bucket (the Rung-3
  photo-grid cap, beyond which species become unreachable), and the old 10-species
  ceiling still holds for every non-fish class.
- Verified in the running app: both tiles reachable, every species in each bucket
  renders at Rung 3, breadcrumb and coarse-commit copy correct. `tsc`, 465 tests,
  `lint` and `lint:tokens` all green.

**Two-spotted goby, settled the same day:** it first came over with the whole
bottom-sitter group into "Moving along the seabed", but it is the one goby that
genuinely hovers in mid-water above the kelp (the catalogue already noted this and
the food web places it in the canopy). Christian's call: it moved to "Moving above
the seabed", making the buckets 15 / 18. Its `fishGroup` stays `bottom-sitter`.

## 2026-08-28: Burnt-in detector overlays, 11 clips re-cut and two gates added

**The bug.** Eleven NORF-1 (Blakeney Overfalls) clips exported on 25 Aug shipped with
the ML detector's own output burned into the pixels: a black HUD bar across the
top-left reading `FUSED TRACKS (n) Frame N` on 100% of frames, plus red RT-DETR
boxes on 2 to 82% of frames. A species-ID game showing the player the machine's
answer, drawn on the animal, defeats the point of the exercise.

**Root cause.** TRDesk4's `_resolve_snip_source()` silently falls back to cutting
from the pipeline's own render (`*_unified_tracked.mp4`) when it cannot resolve the
raw footage. TRDesk4's own log said so at the time: `[TRACKBUILD] Original not on
disk; cutting from NORF-1_..._unified_tracked.mp4`. A fix on 26 Aug (DesktopML
`56b42f0`) routed resolution through `data/clip_registry.json`, but **that fix never
worked**: it referenced `REPO_ROOT`, which was not imported in that module, so every
lookup raised `NameError`, was swallowed by a bare `except`, and cached an empty
registry. TRDesk4's log was still printing
`Could not read clip_registry.json: name 'REPO_ROOT' is not defined` on 28 Aug.

**The repair.** The raw sources are frame-for-frame 1:1 with the annotated render
(proved from the HUD's own counter, which reads `clip_start + k` exactly), so all 11
were re-cut from the originals over the same `clip_start..clip_end` ranges via
`reexport_snippets_hq.py`, re-uploaded with `reupload-snippets-hq.ts` (`?v=3`), and
the canonical G: snips folder was brought in step. Verified on every frame at three
stages (local re-cut, G: folder, and the bytes Supabase actually serves): 0 HUD
frames, 0 box frames, 1920x1080, H.264/yuv420p, frame counts identical to the
originals. The 1088-tall render is a vertical *stretch*, not a pad (tested both
hypotheses), so normalised `bboxJson` / `manualTrackJson` coordinates transfer 1:1
and needed no correction.

**Gate 1, FishSpotter (`scripts/lib/burn-in.ts`).** New detector wired into both
`sync.ts` (HOLD, with its own `--allow-burned-in` override kept separate from
`--allow-incomplete`) and `snip-preflight.ts` (HOLD verdict). Two independent
signals: the provenance TRDesk4 now records in `metadata.source_video_used`, and a
pixel check on the top-left band. **A "is the top-left dark?" test is not usable** and
was rejected during development after it false-positived a clean live Skye clip;
a HUD verdict requires a near-black background *and* white glyph pixels together.
Measured populations separated with no overlap (burnt-in black 0.67-0.71 / white
0.047-0.051; clean 0.00 / 0.000). Validated against all 11 burnt-in clips and their
11 clean re-cuts, plus 12 live clips across 8 sites: 0 false negatives, 0 false
positives. Fails open (`unknown`) when ffmpeg is absent.

**Gate 2, DesktopML (`track_review_app.py`).** Fixed the dead `REPO_ROOT` import so
the registry lookup actually resolves (verified: 12/12 of the affected videos now
find their clean original, where every one previously returned `None`). Routed the
snip editor's own source list through the registry too, which the 26 Aug fix had not
covered, and labelled a render-backed entry `[video: BURNED-IN]`. The manual /
track-builder export now stamps `source_video_used` + `source_is_original`, which it
previously never recorded, so an affected snip is self-identifying downstream.

**Scope check.** A sweep of all 163 clips found exactly these 11, all already hidden
via the TRDesk4 exclusion toggle, so nothing burnt-in was ever publicly visible.
`NORF-1_2026-06-18_08-01` was excluded too but was always clean (no pipeline render
existed for it yet), so it was left untouched.

## 2026-08-28: Crab Rung-2 merged to three tiles, and the spider-crab answer merge

**Crab gate.** "Broad oval crab" (2 species) and "Paddle back legs (swimmer)"
(2 species) are now one **"Broad oval crabs"** tile (4). The old cut asked the user
to spot a flattened rear leg on a moving crab in a short clip, which is a detail
rather than a gestalt; all four read as broad oval crabs to a beginner, and the
paddle is better found in the Rung-3 photo comparison. The crab gate is now three
tiles: Broad oval crabs (4) / Triangular, long legs (spider) (1) / In a shell
(hermit) (1).

Implemented as a **presentation bundle, not a data change**: a `SubSplit` option can
now declare `values: string[]`, so one tile covers several trait values while the
species keep their own. `crabForm: swimming` and `crabFeatures: swimming-paddle`
are untouched, so the swimmer distinction survives in the trait data, the
silhouettes and the narrowing engine. Threaded through `FormSeed.values` →
`CandidateGate`'s `mustHave`, and a new test asserts a bundled tile's identity value
is one of the values it covers (it drives the silhouette and the breadcrumb).

**Spider crab.** The catalogue was renamed `Hyas araneus` / "Great Spider Crab" →
`Majoidea` / "Spider Crab" on 1 Aug, but the production `Answer` rows were never
migrated, so the two names were competing as separate community answers on the same
clips. Ran `scripts/rename-spider-crab.ts --apply` against production:

- **7 answers** moved from "Great Spider Crab" to "Spider Crab" (now 18 total on the
  one label, 0 on the old one). Backup of the pre-change rows in
  `backups/spider-crab-merge-2026-08-28.json`.
- 2 stale `Hyas araneus` cache rows (depth, distribution) dropped so they refetch
  under the new key. `SpeciesImage` / `DiagnosticMark` / `UnlockedSpecies` /
  `Snippet.staffAnswer` were already migrated (0 rows each).
- Then ran `rescoreConsensus` by hand rather than waiting for the 07:00 cron, since
  the merge changes who is in which camp: **8 answers credited, 711 pebbles, 6
  species unlocked, 1 new consensus event**. Four answers on the main spider-crab
  clip flipped `isCorrect` false → true, which is the point: people who said "Great
  Spider Crab" had been scored as disagreeing with a community that had settled on
  "Spider Crab" for the same animal.

"great spider crab" stays in `species-aliases.json`, so anyone typing the old name
still matches. The rename is in the working tree but **not yet committed or
deployed**, so the live site still shows the old label until it ships.

## 2026-08-28: snip uploads gated on complete metadata, Ramsey Sound split farm/control

**The failure this fixes.** Twelve NORF-1 clips synced on 25 Aug with `site`,
`deployment`, `depthM`, `lat`, `lon` and `recordingDatetime` all empty, and nothing
noticed for three days. Root cause confirmed by reading the source: TRDesk4's
`metadata.json` carried no deployment record at all (only track and frame data), and
`sync.ts`'s `?? "Unknown"` / `?? null` fallbacks wrote the blanks without complaint.
Blank geo is invisible at upload time and expensive after: `Snippet.deployment` is the
join key to the farm catalogue, so the clips detached from their farm page, and
lat/lon/depth/month are what `bucketFor()` needs for the OBIS probability bucket,
without which the Pebbles consensus payout is stuck at rarity x1. Consensus freezes
each payout permanently on first credit, so the window to fix it silently closes.

**The gate.** `sync.ts` now HOLDS a snip whose `metadata.json` is missing any of
`REQUIRED_META` rather than uploading it, names the missing fields, and deliberately
leaves it out of the manifest so a corrected re-export is retried next run.
`--allow-incomplete` is the override. The gate lives in `sync.ts`, not in the weekly
runner, so a manual `npm run db:sync` is protected too. (Later the same day another
session added a second, independent pixel gate for burnt-in detector overlays; the two
coexist, see the burn-in entry above.)

**New tooling.** `scripts/snip-preflight.ts` (`npm run snips:check`) reports the same
READY / HOLD / SKIP / SYNCED verdicts without touching anything.
`scripts/weekly-snip-sync.ps1` wires the pair into a Windows task
(`PEBL-FishSpotter-SnipSync`, Mondays 07:00) that uploads what is complete and prints
what needs a human, exiting 3 when anything is held so Task Scheduler's last-result
column shows it. It has to be a Windows task rather than a Vercel cron because it needs
the G: Drive snips folder, the local repo and `.env.local`.

**Source repairs** (`scripts/fix-cym-metadata.py`, backs up every file it touches):

- Every Car-y-Mor snip declared `deployment: "Ramsey Sound"` whether it came from the
  farm array or the control site, so the farm-versus-control comparison could not be
  made at all. Split into **"Ramsey Sound Farm" (36)** and **"Ramsey Sound Control"
  (16)**, and `car-y-mor`'s `deploymentNames` went from `[]` to both, attaching 52
  previously orphaned clips to its farm page. Car-y-Mor is now the largest farm on the
  site by clip count.
- Eleven snips had `recording_datetime: null`, exactly those whose name uses an
  underscore after the year (`2026_05-11`) rather than a hyphen (`2026-05-10`).
  **TRDesk4's date parser only handles the hyphen form.** The timestamps were
  recoverable from the filenames so nothing was lost, but the parser bug is still live
  and will recur on the next export.
- The twelve NORF-1 sources were repaired the same way. Their DB rows had been
  backfilled by hand, but the source was still blank, so a re-export would have
  silently re-blanked them.

**Corpus after the run.** 64 snips synced (`processed=64 skipped=101 held=0 failed=0`),
zero missing fields across all live rows, `seed-difficulty` scored 140 of 143 (the 3
have no bbox signal), and `backfill-probability` took bucket coverage from 3 of 13 to
**17 needed / 19 cached / 0 missing**, so rarity multipliers now work corpus-wide
rather than only on Algapelago clips.

**Two diagnostics that were wrong, both worth knowing.** `npm run db:check-apis` probe
D reports GBIF failing, but it queries the vernacular `"pollack"`, which GBIF returns
`matchType: NONE` for; the binomial resolves fine at confidence 99. It is a false alarm
and should query a binomial. Separately, two throwaway verification scripts written
this session gave wrong answers and the data was fine both times: one re-implemented
the depth-bucket rule (`Math.round` instead of `Math.floor`, local instead of UTC
month) rather than importing `bucketFor`, and one split a file on `\n` when Windows had
written `\r\n`, so only the last line ever matched and it wrongly reported clean. Import
the real function; do not re-implement the thing you are checking.

- **Shop removed; the Pebbles page becomes one leaderboard with a real prize (20 Jul 2026)**, the Phase-1 shop (gold nameplate, coral accent, Tide Freeze) was retired the day it shipped,
  per Christian's steer that cosmetics read as gimmicky. In its place: `/pebbles` is now a single
  streamlined page, your totals, a **prize-progress card** (reach **1,000 lifetime earned
  Pebbles** and PEBL posts you the **Seasearch marine life ID guide**), and the community
  leaderboard, no tabs. The prize is a **gift, not a spend**: claiming records a `PebblePurchase`
  row with `pebbleCost 0` via the new `POST /api/prize/claim`, so Pebbles and rank are untouched
  (the whole earned/wallet split is gone, one number rules the bag, the rank, and the progress
  bar; `/api/me/pebbles` now returns lifetime earned). Claims are the first consumer of the
  Plan-1 **`isPrizeEligible` anti-gaming gate** (verified email + trust bar + account age +
  non-bursty activity), enforced server-side and precomputed on the page so the card pre-warns
  ("verify your email") instead of surprising a spotter at 1,000. Fulfilment is manual:
  claimed rows are `PebblePurchase` entries for `seasearch-guide`; PEBL emails the spotter.
  Prize imagery prefers a real photo at `public/shop/seasearch-guide.jpg` (drop-in, no code
  change) over the committed PEBL SVG illustration. Retired shop item ids must never be reused
  (prod may hold their purchase rows); `TIDE_FREEZE_ID` moved into `streak-service.ts`, which
  still honours held freezes. Deleted: `ShopPanel`/`ShopGrid`, `src/lib/shop/*`,
  `POST /api/shop/purchase`. New: `src/lib/prize.ts`, `PrizeCard`, claim route + tests.
  Verified: `tsc`, 461 tests, `lint`, `lint:tokens`.

- **Prize target 1,000 → 2,000 Pebbles; nav renamed to "Stats" (21 Jul 2026)**, the Seasearch
  guide now takes 2,000 lifetime earned Pebbles (`PRIZE_TARGET_PEBBLES`), and the side-menu entry
  + page title for `/pebbles` are simply "Stats".

- **Prize fulfilment desk at `/admin/prizes` (1 Aug 2026)**, the first spotter reached 2,000
  Pebbles and there was no way to find out who, or to reach them. `POST /api/prize/claim` writes a
  zero-cost `PebblePurchase` and returns `{ok:true}`; nothing notified PEBL, no admin view existed,
  and `/admin/trust` sorts by trust score and doesn't show Pebbles at all, so a claim sat unnoticed
  until someone thought to run SQL. New admin page lists everyone at/over `PRIZE_TARGET_PEBBLES`
  ordered by what needs doing (to post → not claimed → unreachable → posted), with the contact
  email + copy button, the `isPrizeEligible` verdict, and a "Mark posted" toggle. Two new nullable
  columns on `PebblePurchase` (`fulfilledAt`, `fulfilledBy`) record who posted a book so a
  two-person team can't send it twice; plus an `@@index([itemId])` since the desk scans claims
  across all users. **Guests are called out as unreachable:** they carry a *synthetic placeholder*
  in `User.email`, so the column looks populated but nothing can be posted to it, the only route
  is the in-app save prompt. Row derivation is pure (`buildPrizeWinnerRows` in `src/lib/prize.ts`),
  10 new unit tests. Requires `npm run db:push` before deploy (the page 500s until the columns
  exist); column adds keep RLS, but re-run `npm run db:enable-rls -- --check` to confirm.
  Verified: `tsc`, 465 tests, `lint`, `lint:tokens`, `build` compiles.

- **Deploy-order hardening: `select`-less Prisma writes on `PebblePurchase` (1 Aug 2026)**, the
  `/admin/prizes` schema change above landed in prod as merge-then-migrate, and a Vercel deploy
  always beats a manual `prisma db push`. In that window the new code talked to a database without
  `fulfilledAt`/`fulfilledBy`, and two writes that passed no explicit `select` emitted
  `RETURNING <every scalar column>` and 500'd: **`POST /api/prize/claim`** (the claim button, for
  the very spotter who had just reached the target) and the **Tide Freeze spend inside
  `settleStreak`**, which runs on `POST /api/answers`. Reads that already passed an explicit
  `select` were unaffected. Both call sites now select `{ id: true }` (the rows were discarded
  anyway) with a comment explaining the `select` is load-bearing, not tidiness. Two integration
  tests drop the two columns, replay those exact query shapes, and restore them, so a future
  `select`-less write fails CI instead of production. Lesson for the next additive column: push the
  schema FIRST, a nullable column add is backward-compatible with the old code, so that ordering
  has no window at all.

- **Streamlined metrics access via Claude Code (1 Aug 2026, PRs #117, #121)**, "what are the
  latest FishSpotter stats?" used to mean opening `/admin/metrics` by hand; that dashboard only
  covers Reach/Engagement/Learning from the consent-gated `Event` log and says nothing about the
  Discovery pillar (First Sighting), retention, or the consensus machinery. Three pieces:
  `npm run db:stats` (`scripts/stats-roundup.ts`) is a read-only CLI one-pager covering all seven
  sections; `src/lib/metrics/roundup.ts` (`computeRoundup()`) is the shared aggregation lib behind
  it, splitting SQL-side totals (`count`/`aggregate`/`groupBy`) from the genuinely order-dependent
  First-Sighting/contested-clip maths, which runs over a narrow 4-column `Answer` projection;
  `GET /api/metrics/summary` exposes the same data remotely, gated on a new `METRICS_TOKEN`
  (deliberately separate from `CRON_SECRET`) and rate-limited at 60/hour. First-Sighting numbers
  needed no new instrumentation, arrival order reconstructs exactly from `Answer.createdAt`
  ordering, since the submit-time award already keys off "count of prior answers on this clip."
  `src/lib/cron-auth.ts` generalised into `isAuthorisedBearer(req, secret)` with `isAuthorisedCron`
  kept as a wrapper, zero behaviour change to the five existing crons.
  **Two real bugs surfaced by testing against a genuine throwaway Postgres, not a mocked Prisma**
  (`src/lib/metrics/roundup.integration.test.ts`): a re-guess test written as two `Answer.create()`
  calls failed on `Answer`'s actual `@@unique([userId, snippetId])` constraint before it even
  reached the code under test, fixed to model the real `upsert().update` path the answers route
  uses; and running this suite alongside `prize-desk.integration.test.ts` (both `TRUNCATE`
  overlapping tables in `beforeEach` against one shared CI database) raced across vitest's parallel
  file workers the moment a second integration suite existed, surfacing as a foreign-key violation, fixed with `--no-file-parallelism` on the CI integration step.
  **Also corrected a standing doc error**: `CLAUDE.md` said `fish-spotter.vercel.app` was canonical
  and to ignore `fishspotter.vercel.app` as "a different deployment", backwards. The actual
  production domain, confirmed by Christian and by checking the Vercel project's Domains tab, is
  the custom domain **`www.fishspotter.app`** (weeks of real traffic; `fishspotter.app` 308s to it).
  Every hardcoded reference in `CLAUDE.md` was corrected.
  **Verified live end-to-end, not just deployed**: since this kind of remote/web Claude Code
  session cannot reach `www.fishspotter.app` directly (its network policy denies the host at the
  proxy, confirmed repeatedly with `curl`/`WebFetch`, both 403), the live check was done via
  Claude in Chrome operating a real browser: `METRICS_TOKEN` generated and set in Vercel
  Production, a redeploy triggered (new env vars don't apply to an already-built deployment, worth remembering for the next one), then `GET /api/metrics/summary` with the correct token
  returned a full payload and a wrong token correctly 401'd.
  **Still open**: the network-policy allowlist for `www.fishspotter.app` was never actually added
  to this kind of session's environment, so "ask Claude Code right here" for the numbers still
  fails from a remote/web session specifically, it works from a local session with `.env.local`,
  or from any session/browser with normal internet access. Full design rationale + the remaining
  phases (`MetricSnapshot` + trend deltas, a weekly push Routine) are in
  `implementation/2026-08-01/metrics-access-plan.md`.

- **Remote-safe prize desk: `GET /api/admin/prize-desk/summary` (1 Aug 2026)**, Christian used the new
  `/admin/prizes` page from his browser via Claude in Chrome and asked to reach the same data from a
  Claude Code session directly (no browser, no DB credentials, network policy blocks the live app, the
  exact gap the metrics roundup endpoint above was built for). Unlike `/api/metrics/summary`, this one is
  **not aggregate-only**: the entire point of the desk is a specific spotter's email, so real PII travels
  in the response. Deliberately asked which posture Christian wanted rather than assuming; he chose a
  token-gated endpoint over a local-only CLI. Mirrors the metrics pattern closely: own secret
  (`PRIZE_DESK_TOKEN`, separate from `METRICS_TOKEN`/`CRON_SECRET`), `checkPrizeDeskRateLimit` in
  `rate-limit.ts` (12 req/hour, tighter than metrics' 60, reflecting the PII stakes of a leaked token),
  `isAuthorisedBearer` for the check. New `toPrizeDeskSummary()` in `src/lib/prize-desk.ts` is an explicit
  allow-list (never `...row`) so a future field added to `PrizeWinnerRow` can't leak into the response
  without a deliberate, reviewed change, pinned by a unit test that snapshots the exact key set and
  asserts a guest's placeholder address never appears anywhere in the serialized body. `CLAUDE.md` gained
  a "Prize desk via Claude Code" section mirroring the stats-roundup one, with explicit PII-handling
  guidance (never paste a spotter's email somewhere public) since this is the first remote-access
  endpoint in the codebase that isn't aggregate-only. Verified against a live dev server + real Postgres:
  401 with no/wrong token, real email in the body for a verified spotter, `null` for a guest with their
  placeholder domain absent from the response entirely, and the rate limit tripping to 429 on exactly the
  12th request. Verified: `tsc`, 546 tests (13 new), `lint`, `lint:tokens`. **Still needs**: `PRIZE_DESK_TOKEN`
  set in Vercel prod env, and, per the metrics entry above, a redeploy after setting it, since new env
  vars don't apply to an already-built deployment.

- **Profile Record: three categories, ranks and milestones, 28 Aug 2026** (PRs #130 `cc065f6`,
  #135 `025f189`, #137 `c93e50f`). The profile now says what a spotter is actually good at, on the
  principle that **rewards follow consensus, not volume**: naming an animal and having other
  spotters independently arrive at the same answer is the thing worth marking, and the profile
  never said so. `/u/[id]` gained a **Record** block with three categories, each showing the count,
  that spotter's **rank on the category's leaderboard**, and a tap-to-open list of the species
  behind it with curated thumbnails. Three milestones each, nine in total: Pioneer 10/25/50,
  Consensus 20/50/100, Pathfinder 30/75/150.
  - **Pioneer is deliberately stricter than the payout tier.** `consensusTier` calls you a pioneer
    for being among the first three to answer a clip at all; the category needs you to be first to
    name the animal the crowd then converged on. Baseline at ship: 48 of 86 spotters had a
    confirmed call, only 19 had ever pioneered one.
  - **Pathfinder is the exploration counterweight.** 72 of 163 clips had no answer at all, and
    consensus alone only ever rewards piling onto clips other people already found.
  - **Unreachable rungs are hidden** (#137). The ladders are long-horizon on purpose, but showing a
    target nobody can reach with today's footage is the same discouraging fiction as "59 to find".
    A rung shows when it is within the category ceiling or the spotter already passed it (a falling
    ceiling must never retract a held milestone). Ceilings derive per render, so rungs reveal
    themselves as clips land: pioneer/consensus are bounded by clips that have reached consensus
    (40 of 163 at ship), pathfinder by unclaimed clips plus the best run anyone holds (72 + 27).
    Four of nine were hidden at ship.
  - **No join-date badge, by decision.** It rewards a calendar accident and permanently shuts the
    door on anyone who finds the app later. Every milestone stays winnable by someone signing up
    today. The same reasoning removed the `N to find` denominator from the collection header: we do
    not know every catalogue species appears in the clips.
  - **Zero-count spotters are excluded from a category's rank field.** Being told you are 48th of 48
    for having done nothing is a punishment, not a credential. Ties share a rank.
  - Derived live from `Answer` plus the reached consensus leader using the same
    `groupPendingAnswers` / `pickLeaderGroup` pair the rescore cron uses, so a milestone can never
    disagree with the Pebbles that were paid. No new tables. Ranks cost nothing extra because the
    whole Answer table is already in memory. New: `src/lib/badges.ts` (pure ladders),
    `src/lib/spotter-record.ts` (derivation), `src/components/profile/SpotterRecord.tsx`.
  - The old **Accuracy tile was stale** and is now the live Confirmed rate: it read persisted
    `Answer.isCorrect`, which only updates when the cron runs, and showed 16 of 21 for a spotter
    whose live figure was 14 of 18.

- **Rarity bug: every invertebrate ID had been paying a 5x legendary multiplier, 28 Aug 2026**
  (PR #130 `3b8ab6e`, `src/lib/rarity-scope.ts`). The OBIS occurrence pull is scoped to
  `FISH_CLASS_NAMES = ["Actinopterygii", "Chondrichthyes"]` (`src/lib/biodiversity/obis.ts`), so no
  invertebrate, seabird or seal is ever requested and none can appear in a `SpeciesProbability`
  bucket. `rarityForProbability` read that absence as a genuinely off-the-charts sighting and
  returned legendary at x5. Measured against prod: 19 populated buckets, 39 distinct species, every
  one a fish; `Aurelia aurita`, `Necora puber` and `Asterias rubens` all absent, as they
  structurally must be. Roughly half the catalogue was affected. The fix does not touch
  `rarityForProbability`, whose contract already says it must not inflate on missing data; it stops
  lying to it about whether data exists. **Not retroactive**: the cron never recomputes a credited
  amount, so Pebbles already paid at x5 stand. Widen `OBIS_VISIBLE_SHAPE_CLASSES` if the OBIS pull
  is ever widened.

- **Profile cosmetics: built, then removed the same day, 28 Aug 2026** (PR #132 `0f94fca` added,
  PR #135 `025f189` removed). Frames, site backdrops and species crests, all as unlocks rather than
  purchases. Removed on sight as gimmicky. Recorded because the reasoning is durable: **do not
  rebuild frames, backdrops or crests without asking.** The `User.crestSpecies` and
  `User.backdropSite` columns were added and then dropped, in that order relative to the deploys, so
  live code never selected a column that was gone; schema and prod verified back in sync and RLS at
  21 of 21.
  - **Trap worth keeping: Tailwind never scans `src/lib`.** `tailwind.config.ts` lists only
    `src/pages`, `src/components` and `src/app`, so a class string written in `src/lib` generates no
    CSS and the styling is silently invisible while the markup still looks completely correct.
    Caught by grepping the built bundle for `.from-navy-600\/25` and finding zero matches. Verify a
    new visual by grepping `.next/static/css/*.css` with `grep -F`, not by trusting the HTML.

- **On-clip speed and play/pause controls, 28 Aug 2026** (PR #141, `851e448`). The zoom capsule in
  `FeedCard` gained two siblings below it: a playback-rate stepper and a play/pause button, three
  capsules rather than one long strip so the stack reads as three tools. Studying an animal on a
  short clip needs more than magnification; a goby darting across frame is unreadable at 1x and
  legible at 0.25x, and holding a frame still is how you read a fin. Speed drives the **existing
  persisted `videoSettings.speed`** rather than a second source of truth, so the clip stepper and
  the side menu always agree (verified: setting 0.25x on the clip lights the 0.25x pill in the
  menu). The ladder widened from `0.5 / 1 / 1.5` to `0.25 / 0.5 / 0.75 / 1 / 1.5 / 2`, three rungs
  being too thin for a stepper and the slow end being the useful one; every previously stored value
  stays valid, guarded by a test. The rate sits between the two presses so the stepper is never
  blind, and both buttons grey out at the ends. `VideoSettingsPanel`'s pills moved to a 3-column
  grid so six of them keep a 44px target at 375px. Visibility matches the zoom control (panel open,
  or zoomed) plus `speed !== 1`, so a feed left at 0.25x always carries the control that undoes it
  and the idle full-bleed feed stays clean at defaults.
  - **`autoplayBlocked` is now split out of `videoPaused`, and the distinction is load-bearing.**
    The big scrim and centre triangle are the right recovery affordance when the browser refused to
    start the clip and the user has nothing else to press. They are wrong over a frame someone
    paused on purpose, because they hide the animal behind the very control just used. The
    tap-to-identify catcher (and its hint) follow the overlay they were mutually exclusive with, so
    a deliberately paused frame can still be named, which is the flow you want: freeze a good
    frame, then say what is on it. Anything gating on "is it paused" must now pick the right one of
    the two.
  - The `<video>` reports its own state via `onPlay`/`onPause`, which keeps every route truthful
    and fixed an existing bug in passing: the space/k key paused the clip without anything on
    screen saying so.

- **Rung-3 tile picture becomes a comparison viewer, 28 Aug 2026.** The species tile in the Spot It
  gate did one thing with the picture: tap anywhere, open the guide. It now does the thing the gate
  is actually for. **Tap the left or right half of the photo to flick through that species' other
  reference shots**, against the clip that is still playing beside it (docked) or above it (phone),
  so a user can compare six angles of a catshark without ever leaving the grid. Up to six photos per
  tile, the same one `?limit=N` request per species that was already being made, and only the
  visible frame is mounted, so a 24-tile grid still loads 24 images rather than 150. Wraps at both
  ends (a dead end on a viewer this small reads as a broken tap), dots show position, Left/Right
  arrows do the same job from the keyboard, and each flick is announced through the existing
  rule-out live region.
  - **The name row underneath is now the select control**, at the 44px mobile minimum. Picture to
    look, name to choose. A species with only one cached photo has nothing to flick to, so its
    picture still selects: a tap that does nothing is worse than a slightly uneven rule.
  - **The rule-out control became a cut-off top-right corner of the photo**, replacing the disc that
    floated over it. The disc had to be opaque to survive dark footage (`7e42060`), which made "I do
    not want this one" the loudest thing on a grid whose whole job is looking at fish. The clip path
    is on the button, not just the fill, so the hit area is exactly the triangle you can see: a
    plain 44px square behind it would put half its area over open photo, an invisible trap sitting
    inside the "next photo" half. Contrast is carried by three separable cues (dark fill, white fold
    line, white glyph) so no single photo can hide it.
  - **Tile photos went 4:3, from square.** Almost every reference photo is landscape and almost
    every animal here is wider than it is tall, so a square centre-crop was cutting off the head and
    tail, exactly what the user is being asked to compare. It also buys back more height than the
    new name row costs, so the phone's default half-and-half sheet still shows a whole tile, name
    included, without scrolling (measured: tile bottom 716px, sheet bottom 716px, with a two-line
    species name).
  - Verified in a real browser on both surfaces, 21 checks: flick forward/back/wrap by mouse and by
    touch, arrow keys, the announcement, the name row opening the guide, the corner ruling a species
    out, that the area under the fold is photo and not a hidden rule-out target, the 44px name row,
    the whole-tile fit, and axe clean in the gate. Eight of those are now a CI test
    (`TileGate.test.tsx`); the rest needed a live browser.
  - **Known gap, unchanged by this work but multiplied by it:** tiles show CC-licensed photos with no
    visible attribution (the credit is one tap away in the guide). One photo or six, the posture is
    the same, but six is a better reason to fix it.

## 2026-08-28: every window becomes a split screen citizen, and the legacy guide goes

The split screen shipped on 28 Aug applied to the Spot It rung tiles and nothing
else. Every other surface was still a floating or full-screen overlay, so the
layout collapsed at exactly the moments it mattered most: the side-by-side
comparison and the species card dimmed the clip and straddled the seam while the
spotter was deciding which of two animals they were looking at, and the reveal
went back to a draggable card centred over the animal they had just named. PR #143.

**The audit.** Every overlay in the app, checked against the split at 1440px and
on a Pixel 7. Six were wrong and are fixed: the reveal panel, the guess panel,
`SpeciesComparison`, `SpeciesGuidePopup`, `MapModal`, and the verification
banner (a bottom-centred toast that landed on the phone sheet's action row).
Three are deliberately left full-screen and that is now written down: the
`SpeciesGallery` lightbox (shrinking "zoom into this photo" into a 500px panel
defeats it), the guest sign-up wall, and `SideMenu` (both are "you are leaving
the flow" moments).

**The contract** now lives in `src/lib/split-screen.ts`, so the width the viewer
drags on the tiles is the width the reveal inherits. Rung 3 turns into the reveal
in place, in the same half, with the clip live beside it. Two new shells:
`SplitPanel` (the working half, used by the reveal and guess panel) and
`PanelOverlay` (a dialog that lands on the working half, used by the comparison,
the species card and the map). Portaled overlays position off `--fs-panel-*`
custom properties, which fall back to the whole viewport when nothing is split,
so an overlay opened from a non-split context needs no branch at the call site.

**Two bugs found only by measuring, both now regression tests.** The frame bus
needs a CACHED snapshot: an overlay that mounts into an already-open split has no
event to wait for, and without the cache renders full screen for its whole life.
And the panel rect must be re-measured until it settles: the panel enters on a
framer-motion transform that moves it 12px without ever changing its size, so a
ResizeObserver alone leaves the rect stale and every overlay 12px low, which
showed up on the phone as the gate's "Full video" button bleeding through the
comparison header.

**Removed: the post-submit "How to spot a [X] next time" button.** It was the only
render site of `IdGuideTrigger` (always `submitted={true}`), so it was also the
only way to reach the old 5-step wizard, the ID chat, the chip fallback and the
group guide. All eight files went: `IdGuideTrigger`, `IdGuideSheet`,
`IdGuideWizard`, `IdGuideChat`, `IdGuideChipFallback`, `GroupGuide`,
`src/data/shape-class-guides.ts`, `src/lib/idguide/shape-class-ref.ts`.

Two consequences worth knowing. For a SPECIES reference nothing is lost: the
reveal already renders the annotated photo with its diagnostic-mark rings plus the
gallery, and `/species/[slug]` carries the full guide. For a COARSE reference
("Crab", "Fish") the group-level guide had no other home and is gone with it.
`POST /api/idguide/chat` still exists but now has no caller.

Verified: type-check, 673 unit tests, both linters, CI green on PR #143, then the
whole flow driven on live production (fish-spotter.vercel.app) at desktop and
phone widths, confirming the split holds from rung 1 through the reveal and that
the removed button is gone.

## 2026-08-28: small pinned markers replace the big rings on "How to spot it"

The diagnostic-mark rings on the species-guide photo (`AnnotatedSpeciesPhoto.tsx`)
were a big semi-transparent circle per feature, which read as visual clutter
rather than a clean numbered pointer. Replaced with a single small numbered
marker pinned exactly on the feature's authored centre, no ring. The reference-
photo gallery moved to sit directly below "How to spot it" instead of the foot
of the page (a real photo is the clearest confirmation of what a species looks
like) and got a proper wrapping grid, ~2.6x the old thumbnail size, with a new
`layout="grid"` / `theme="light"` mode on `SpeciesGallery.tsx` (the component
was built dark-first; the light variant fixes what would otherwise be
white-on-white loading/empty/error chrome on the light species-guide surface).
The redundant field-note paragraph now only renders as a fallback for the
handful of species with no annotated diagram yet, since the diagram's own
legend already covers the same visual-ID ground. Merged as PR #144 (`a11adb4d`).

**A real bug surfaced by the redesign, not by the sweep below.** Two marks that
both describe a whole-body or radiating feature (a starfish's "five stubby
arms" and "pentagon outline"; an urchin's overall shape and its all-over fur)
land on the same or near-identical authored centre, because that kind of
feature genuinely has no single correct point. A drawn ring tolerated the
overlap; a solid dot does not; one can fully hide the other. Confirmed directly
in the Gemini grading output: Sea potato's first marker came back "completely
missing from the image", it was sitting exactly under the second. Fixed with a
deterministic separation pass (`separateOverlaps` in both
`AnnotatedSpeciesPhoto.tsx` and `scripts/lib/mark-overlay.ts`, kept in sync by
hand since the script has no import path to the component) that nudges two
close markers apart by a fixed minimum distance, computed purely at render
time so the stored coordinates stay the untouched ground truth.

**Gemini-verified relocation swept all 67 marked species**, run as 5 parallel
background shards (`place-diagnostic-marks.ts --mode relocate --all --slice a:b
--apply`) after the Workflow tool's multi-agent path hit a machine-wide agent
cap from other concurrent sessions; plain parallel OS processes did the same
job with no orchestration overhead, since the actual "thinking" happens inside
each Gemini call, not in an agent's own reasoning. 45 species were already
correctly placed; 18 were corrected and confirmed aligned by an independent
re-grade. Along the way, found and fixed a live bug in the placement script:
its Gemini caller was still sending `thinkingConfig.thinkingBudget: 0`
unconditionally, which `gemini-3.6-flash` (`.env.local`'s current model)
rejects outright with a 400, silently failing every relocate call. Same
one-retry-without-thinkingConfig fix already shipped in `gemini-vision.ts`,
ported across.

**Three species still need a human look, all content/photo limits, not
placement bugs:**
- **Cushion Star** and **Sea potato**, the whole-body-feature pair described
  above. Legible now (separation fix), but Gemini's strict per-mark grading
  still calls them imperfect since neither mark has a true single point. Would
  need re-authoring the marks (most likely merging the pair into one), not a
  coordinate fix.
- **Velvet Swimming Crab**'s "paddle-shaped rear legs" mark. Tried by the
  automated sweep (5 rounds) and then by hand with a coordinate-grid overlay
  for precision, still never resolved, both "Red eyes" and "Velvety carapace"
  did resolve the same way. The front-facing reference photo doesn't clearly
  show the flattened swimming leg from any angle tried; needs a different
  photo, not another placement attempt.

**A live production collision, worth knowing if this pattern recurs.** Mid-fix
on Velvet Swimming Crab, another concurrent FishSpotter session wrote to the
exact same `DiagnosticMark` rows (a single-transaction update touching a mark
this session had never even queried), overwriting the in-progress fix. Backed
off rather than race it; confirmed via each row's `updatedAt` and the
single-transaction signature that it was a real second writer, not a bug in
this session's own scripts. Separately, `SpeciesGuideContent.tsx`'s edit
turned out to depend on a substantial "grounded species guide" (citations/
provenance) feature that was sitting uncommitted in the shared checkout from a
different session; rather than commit a stale snapshot of someone else's
in-progress work, the redesign was rebased onto that feature once its own
author merged it properly (PR #146, landed independently), so the final merged
diff is only the 5 files above.

Verified: `tsc`, both linters and the full test suite (692 tests) clean on an
isolated worktree build (the primary checkout was under heavy concurrent edits
from other sessions all day), CI green on PR #144 (type-check/lint/tests,
integration against real Postgres, Vercel build), then re-checked directly
against live production (fish-spotter.vercel.app) after merge: marker geometry,
gallery grid, and the field-note fallback in both directions (a marked species
and an unmarked one) all confirmed live.
