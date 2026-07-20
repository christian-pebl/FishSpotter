# FishSpotter — Changelog

> Dated, session-by-session shipping log. Moved out of CLAUDE.md on 2026-06-04 so the
> instruction file stays a stable reference (CLAUDE.md is re-read every session; this is not).
> Entries are roughly chronological (oldest first). Append new milestones at the bottom.

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
- **Gallery quality re-check + photo-provenance 'i' popover (4 Jun 2026)** — second pass over every gallery photo with the builder now ranking on a 50/50 `teachingScore`+`diagnosticFeaturesVisible` blend (the user ask: images must "show off the key traits"); it re-assessed all + swapped in trait-richer photos -> **403 rows (~7/species)**, only Sprat + Atlantic mackerel still short (genuine dead-specimen ceilings). Added two nullable `SpeciesImage` columns `observedOn` + `placeGuess`, captured from iNat at fetch time and backfilled onto older/curated rows by `scripts/enrich-image-meta.ts` (322 rows enriched; 320/320 iNat obs had date+place). The `/api/species-images` payload now carries them, and `SpeciesGallery` renders a per-thumbnail **'i' button** -> portaled `InfoPopover` (reference + location + year + subject + source link + license chip); the lightbox shows a location·year line too. Verified end-to-end in the dev preview (popover renders the real provenance), `tsc` + `eslint` + `lint:tokens` + prod `build` all green. Fixed a latent crash found during verification: the 'i' handler must capture `getBoundingClientRect()` before `setInfo` (reading the synthetic event inside the updater throws on React's reducer replay). Photos + metadata live in the DB; schema + code committed.

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

## Guide-hero audit + auto-placement fix (4 Jun 2026)

- **Audit (`implementation/2026-06-04/species-image-audit.md`):** validated all 42 annotated guide-hero photos (curated photo + `DiagnosticMark` rings, rendered by `AnnotatedSpeciesPhoto.tsx`) with Gemini 3.5 Flash, scoring a composite of each hero rendered with the live ring geometry. Found only 8/42 well-aligned, 15 species with no hero at all, and 3 on unusable (dead/captive) photos. Root cause: the ring coordinates seeded by `seed-fish-marks.ts` / `seed-invert-marks.ts` were hand-estimated drafts, never tuned.
- **Tooling:** extracted the overlay/compositing/validation into `scripts/lib/mark-overlay.ts`; built `scripts/place-diagnostic-marks.ts` — Gemini localises each feature via its native `box_2d` detection format (converted to a centred ring), then a verify-and-correct loop re-prompts any ring graded off-target. Modes: `relocate` (re-place existing marks; skips already-aligned) and `author` (create from `scripts/data/p2-mark-drafts.ts`). Dry-run default; `--apply` writes; marks tagged `createdBy=gemini-place@pebl-cic.co.uk` (drafts). `scripts/render-hero.ts` renders a hero composite to PNG for human ground-truthing.
- **Results (`implementation/2026-06-04/species-image-fix-report.md`):** guide-heroes 42 -> **57/57** (gap closed); heroes graded keep 8 -> **16**; photo-replacement needed 3 -> **0** (Dragonet + Edible Crab swapped to IDEAL photos, old ones blocklisted); **32 species improved**, 2 regressions reverted to baseline. All marks remain drafts pending expert sign-off. 24 species still have >=1 off ring or redundant marks (many-mark fish, multi-specimen or murky photos, duplicate labels) and are listed for a manual `/admin/species/[name]` pass in the fix report.
- **Continuation (same day):** improved the auto-placer (`scripts/place-diagnostic-marks.ts`) — Gemini now classifies each feature point vs region and point features (eye/barbel/spot) are capped to a small ring so they stop reading as oversized; the verify loop corrects every off/near ring over 4 rounds with a final fresh re-localise; `loadImage` retries CDN 429s and one species erroring no longer aborts a sweep. Added `scripts/data/mark-redraft.ts` + an author `--redraft` path that deletes a species' draft marks and recreates a clean set: **trimmed 7 over-marked species** (sea bass, butterfish, rock goby, great spider crab, velvet swimming crab, horse mackerel, dog whelk) to 3 distinct marks each, and **re-anchored 2 photo-limited species** (Flat Top Shell, Dragonet) onto features their photo actually shows. Re-audit: **keep 16 -> 26, aligned 17 -> 28, over-marked species -> 0, total off-marks 47 -> 20 (0.35/hero), stragglers 24 -> 15**. The 15 residual are mostly one borderline ring on a good hero or genuinely-hard photos (Pollack head, Poor cod, Flounder, the spider/velvet crabs); listed for a manual admin pass. `tsc`/`test`/`lint` green.
- **Upside-down photo fix (Ballan wrasse):** the curated Ballan hero (iNat 231750633) was uploaded upside-down with no EXIF flag, so it rendered belly-up in the wizard. Swapped to an upright green-morph shot (iNat 266328776, score 88 IDEAL), demoted + blocklisted the old one, and re-placed the marks. Added `scripts/check-photo-orientation.ts` (Gemini-based) to sweep all heroes for inverted/rotated photos. **Caveat: that checker is noisy** — it false-positived the 3 jellyfish (no fixed "up") + the held-vertical plaice and false-negatived this Ballan, so its flags are human-review candidates only. Visually triaged all 7 of its flags; none were genuine problems. The Ballan fix is DB-backed and already live in prod (verified via the species-images API).

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
  the cross-cutting findings). Applied 6 redraws (shark left as-is — it already scored
  90/"strong"):
  - **cod-like** — three dorsal sails now rise ~7-9 units with deep V-notches of true
    negative space, so the cod give-away ("three separate fins on the back") survives
    downsampling instead of slurring into a "bumpy back" (was readsAs "Fish with fins").
  - **wrasse** — the single long dorsal is lifted off the back (negative-space gap) so it
    reads as ONE continuous fin vs cod's three humps; sharper thick-lipped pointed snout;
    bold rounded (unforked) paddle tail. Targets the cod-confusion that capped it at 73.
  - **silver-shoaler** — switched from the 2-fish shoal (readsAs "Two fish") to a single
    slim fish with a deep symmetric fork, matching the other single-subject fish tiles and
    the "Silver swimmers" relabel.
  - **bottom-sitter** vs **bottom-other** — the 18-Jun split left these two near-identical
    seabed silhouettes; pulled them to opposite poles — bottom-sitter = small/plump/smooth
    two-goby cluster, bottom-other = big/armoured/spiky gurnard with a spread wing pectoral
    + walking finger-rays — so the icon (the sole disambiguator, since labels carry no shape
    hint) actually separates them.
  - **long-skinny** — replaced the potrace "boomerang" (the lone non-hand-authored icon)
    with a clean hand-drawn slender eel: gentle S, a negative-space eye, a small symmetric
    tail fin; no longer reads as a boomerang/snake.
  - Attribution: `long-skinny` was a reused PhyloPic potrace and is now a PEBL-original CC0
    hand drawing — updated `bodyform-silhouette-credits.json` accordingly; also corrected two
    stale taxon labels (wrasse was *Abramis brama*, a freshwater bream → Labridae;
    silver-shoaler *Scomber* → Clupeidae/silvery shoalers).
  - Verified: `tsc` clean, **336 tests pass**, `lint` + `lint:tokens` clean, and every tile
    rasterised + eyeballed at a 40px "small render" simulation (the size users actually see).
    Remaining validation: the Gemini re-score (`npm run score:silhouettes`) needs `GEMINI_API_KEY`
    in `.env.local` (not present in CI/remote) — run it after merge and diff the baseline; targets
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
  Identify/Where-is-this?/Skip action panel visible underneath — `panelCollapsed`
  was never reset on close, so dismissing the gate surfaced a second, unlabelled
  box instead of returning to a clean clip, and there was no obvious way back
  in. `src/components/FeedCard.tsx`'s three gate `onClose` handlers now also
  call `togglePanel(true)` — the same call the panel's own Hide button already
  makes — so Close always lands on a bare clip with the tap-to-identify catcher
  as the one consistent way back in: open → close → tap → open now loops
  indefinitely instead of stranding the user.
- Verified: `tsc` clean, full test suite green, `lint` clean, and the actual
  loop driven end-to-end twice in a live preview browser (opened the shape
  gate, closed it, confirmed zero visible floating panel with the tap catcher
  restored, tapped, confirmed the gate reopened).

## Difficulty ladder for the feed (17 Jul 2026, SHIPPED LIVE via PR #105, main `31ddf8b`)

New spotters get clear, easy clips first; harder/more cryptic ones mix in as they gain
experience. Built in two phases — validate the signal, then commit to a schema change — per
Christian's steer.

- **Phase 0 (throwaway validation):** checked whether apparent organism size (median bbox area
  from the existing `bboxJson` track) actually separates clips the way a human would expect
  before building anything durable on it. 73/77 active clips have a usable bbox track, 262x
  spread in area, and the ranking passed a gut check (small crabs/gastropods sink to "hard,"
  larger/closer subjects rise to "easy"). Confusability data (`confusion-matrix.ts`) was also
  considered but is too sparse to trust yet — only 24 wrong answers recorded, half against coarse
  placeholder references ("Fish"/"Crab") — so it's deferred to a later empirical pass once there's
  real per-clip answer volume.
- **Schema:** `Snippet.difficultyScore Float @default(0.5)` (1 = easiest, 0 = hardest,
  corpus-relative percentile). Live on prod DB; 73 clips seeded via `scripts/seed-difficulty.ts`
  (`npm run db:seed-difficulty`, idempotent, safe to re-run after `db:sync` adds clips).
- **Ordering** (`src/lib/difficulty.ts` + `src/lib/feed-ordering.ts`): `orderFeed` gained an
  optional `readiness` param (0 = brand new, ramps to 1 over 15 answered clips) that soft-weights
  the unanswered tier toward easy/medium/hard bands — never a hard filter, so the feed never
  dead-ends into all-hard or all-easy. Omitting `readiness`, or an item missing
  `difficultyScore`, reproduces the exact prior shuffle, so every existing caller/test is
  unaffected. Anonymous visitors and signed-in users with no answer history both start at
  readiness 0.
- **Deliberately deferred, not oversights:** Phase 2 (migrating the score from intrinsic/bbox-size
  to empirical/answer-accuracy-derived, once there's traffic to trust) and a user-facing
  difficulty badge — an invisible pacing curve is arguably the better product call than a visible
  "Level 3!" indicator, but that's Christian's to weigh in on.
- **Bonus fix, same pass:** `main`'s own CI had been failing on every push since PR #103 landed
  (`admin.test.ts`'s import chain hits `src/lib/auth.ts`'s `NEXTAUTH_SECRET` fail-fast guard, and
  CI never had a dummy value for it). Fixed with a one-line addition to `.github/workflows/
  ci.yml`'s existing dummy-env-var block — pre-existing gap, unrelated to this feature.
- **How it shipped, worth knowing given the operational note above:** the original build (commit
  `c1ecce4`) landed on a branch based off the now-merged `fix/audit-findings-jul2026`, and picked
  up one unrelated commit when this shared checkout's branch changed under it mid-session. Since
  the two commits touched disjoint files, the difficulty-ladder diff was cherry-picked cleanly
  into an isolated worktree, pushed as `feat/difficulty-ladder-v2`, and merged via PR #105 — no
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
- **Leaderboard accessibility fix, 20 Jul 2026** — `MIN_ANSWERS_FOR_RANKING` dropped from 10 to 1
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
  `docs/pebbles-anti-gaming-and-prizes-plan.md`) — closes the Sybil hole in the crowd-authority
  consensus model: a ring of 3+ colluding accounts could previously self-consensus on a rare
  species and farm the rarity multiplier, since "truth" was an unweighted crowd-of-3
  (`CONSENSUS_THRESHOLD_USERS`). Adds a hidden `trustScore` per user (`User.isTrustSeed` /
  `trustScore` / `trustUpdatedAt`), propagated from a handful of manually-seeded real accounts
  (`christian@pebl-cic.co.uk`, `anjali@pebl-cic.co.uk`, `daniabulhawa@gmail.com`) via personalized
  PageRank over co-occurrence in **winning** consensus camps (`src/lib/trust.ts`, new). Teleport is
  seed-only (not classic PageRank's uniform-everyone teleport), which gives a provable, exact
  property: an isolated ring with zero graph path to any seed earns exactly `0` trust, no matter how
  densely it agrees with itself. Runs daily in the existing `consensus-rescore` cron, right after
  `rescoreConsensus` (sequencing is load-bearing — every reached camp needs a fresh `ConsensusEvent`
  row for decay weighting). `isPrizeEligible` gates on verified email + trust bar + account age +
  non-bursty activity spread; nothing consumes it yet beyond the new read-only `/admin/trust` page
  (trust is never shown to spotters, never removes Pebbles or status — gates upside only). A
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
  alongside a large concurrent "Pebbles shop" session building `/pebbles`, wallet, and purchases —
  coordinated rather than clashed: confirmed via `git diff` that shared-file edits
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
- **Traffic-source observability, 20 Jul 2026** — prompted by the first Reddit share of
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
