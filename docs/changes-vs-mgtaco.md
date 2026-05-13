# Changes since mgtaco's latest

> Base: **mgtaco's `main` @ `121bdab`** ("Fixed issues") — the commit we reset to before starting this work.
>
> 75 unique files added or changed (excluding video binaries and worktree caches).

Grouped by feature/concern so it's scannable.

---

## 1. Database schema (`prisma/schema.prisma`)

mgtaco's base had: `User`, `Snippet`, `Answer`.

**Added 3 new tables:**
- `Taxon` — the central taxonomic record (species, genus, family, or functional group); fields for hero photo, fun fact, description, habitat note
- `TaxonAlias` — `(alias → taxonId)` lookup for the matcher; sources are `"scientific" | "common" | "vernacular"`
- `TaxonAttribute` — `(taxonId, key, value)` triples used by the ID guide for filtering (functional group, body shape, locomotion, screen zone, colour tags)
- `BiogeographicChecklist` — cached OBIS occurrence counts per `(deployment, depth bucket, season)`; powers the biogeographic prior in the matcher

**Extended:**
- `Snippet` → added `staffTaxonId`, `labelStatus` (`UNLABELLED` | `STAFF_LABELLED` enum)
- `Answer` → added `taxonId`, `pointsAwarded`

---

## 2. Data layer & one-off scripts

```
scripts/
├── README.md                          (NEW — runbook + order)
├── seed-local.mjs                     (NEW — Snippet rows from public/media/snippets)
├── enrich-snippets-from-drive.mjs     (NEW — pulls site/depth/lat/lon/bbox from Drive metadata.json)
├── seed-taxa.mjs                      (NEW — seeds Taxon + TaxonAlias from species-master.json)
├── seed-taxon-attributes.mjs          (NEW — hand-curated attribute mapping for 51 taxa, 288 attribute rows)
├── link-clips-to-taxa.mjs             (NEW — sets Snippet.staffTaxonId from clip-matches.json)
├── cleanup-taxa.mjs                   (NEW — one-shot renames + dedupes)
├── refresh-biogeographic-cache.mjs    (NEW — fetches OBIS data → BiogeographicChecklist)
└── extract-species-data.py            (NEW — extracts species + per-clip candidates from PEBL CSVs on Drive)
```

**Source data files (NEW):**
- `data/species-master.json` — 56 taxa extracted from PEBL's processed SubCam CSVs
- `data/clip-matches.json` — per-clip candidate species from CSV observations overlapping the bbox time window

**Taxonomic corrections made via `cleanup-taxa.mjs`:**
| Was | Now | Why |
|---|---|---|
| *Cyanea capitata* | *Cyanea capillata* | Typo (lion's mane jellyfish) |
| *Trisopterus iuscus* | *Trisopterus luscus* | Typo (pouting/bib) |
| *Psetta maxima* | *Scophthalmus maximus* | WoRMS-accepted name (turbot) |
| Display "Nursehound/catshark" (sci *S. canicula*) | "Small-spotted Catshark" | Was confused; *canicula* is the catshark, *stellaris* is the nursehound |
| *Paralichthys dentatus* | (deleted) | US summer flounder — wrong species for N. Atlantic; *Platichthys flesus* covers our flounders |
| 5 `(no sci)` placeholders | (deleted) | Cod / Dragonet / Sand Goby / Sideways Crab / Whelk — all dupes of species-level rows |
| "Trisopterus sp" / "Trisopterus sp." | merged into "Trisopterus sp." | Punctuation-only dupe |

Net: 58 → 51 taxa, all cleanly mapped.

---

## 3. Video pipeline

- **6 Jan 2020 clips imported from Drive** and added to `public/media/snippets/` (mgtaco had only the 23 newer 2024 clips)
- **All 6 transcoded MPEG-4 Part 2 → H.264 baseline** (originals kept as `snippet_original.mp4`). Without this, those clips returned `FFmpegDemuxer: no supported streams` in Chrome
- **Bbox tracks (`bboxJson`) imported from Drive `bbox_data.json`** for every clip — mgtaco's seeded data had this null

---

## 4. API routes

### Refactored (existing routes)
- **`/api/answers`** (POST) — completely rewritten: alias-based matching via `TaxonAlias` table, fuzzy fallback with "Did you mean?", point scoring (10 / 1 / 5), returns full taxon details for the reveal panel
- **`/api/answers/my`** (GET) — returns richer payload including resolved taxon, staff taxon, and label status
- **`/api/snippets`** (GET) — extra fields (`depthM`, `lat`, `lon`, `labelStatus`)
- **`/api/snippets/[id]/stats`** (GET) — aggregates community answers by `taxonId` (falling back to chosen text for legacy answers), returns `labelStatus` and `staffTaxon`
- **`/api/leaderboard`** (GET) — now scores by `pointsAwarded` sum (was `correct * 1 + wrong * 0.5`)

### New routes
- **`/api/id-guide/match`** (POST) — the ID guide matcher: attribute scoring, biogeographic prior, top 5 candidates with `localStatus` labels
- **`/api/me/taxa`** (GET) — life-list data (spotted vs helped-ID counts, last-seen site, locked/unlocked status)
- **`/api/taxon/[id]`** (GET) — taxon detail with related clips + aliases

---

## 5. Library code (`src/lib/`)

All new:
- **`taxon-matching.ts`** — `normalizeAlias`, `resolveAnswerToTaxon` (exact + fuzzy)
- **`id-guide-questions.ts`** — 5-question funnel config + `visibleQuestions` helper
- **`id-guide-prefill.ts`** — pure function deriving smart suggestions from bbox path (screen zone, locomotion)
- **`obis.ts`** — typed OBIS API client (paged `/checklist`, WKT bbox builder)
- **`biogeographic-prior.ts`** — `BiogeographicPrior` class with O(1) per-taxon scoring + `LocalStatus` ("common" / "occasional" / "uncommon" / "no_data")

Extended:
- **`useCreatureQuiz.ts`** (hook) — now handles the richer API response, exposes `editAnswer` for the change-my-answer flow

---

## 6. UI components (`src/components/`)

### New components

```
src/components/id-guide/
├── IdGuideButton.tsx          🤔 entry pill under the input
├── IdGuideSheet.tsx           bottom-sheet mobile / centered modal desktop, esc + body-scroll-lock
├── IdGuideStepIndicator.tsx   ● ● ○ ○ progress dots + "Q2 of 4" label
├── IdGuideQuestion.tsx        big-button grid with prefill highlight + skip
├── IdGuideCandidateCard.tsx   hero + name + scientific + fun fact + match % + localStatus pill
├── IdGuideResults.tsx         composes candidate cards, "Adjust answers" + "Type instead" exits
└── useIdGuide.ts              reducer + hook wiring to /api/id-guide/match
```

Plus:
- **`TaxonRevealPanel.tsx`** — replaces the bare percentage display; 3 states (correct / wrong / contributed), hero card, points badge, community % bar, change-my-answer link
- **`ClipLocationMap.tsx`** — Leaflet OSM tile map with teal pin at the clip's lat/lon, only mounts on active clip, zoom/drag enabled

### Heavily reworked components
- **`FeedCard.tsx`** — added: place context line, map, tracker dot+halo+trace SVG (was bbox rectangle), tracker toggle with localStorage persistence, reveal panel integration, ID guide button + sheet, bbox-derived prefill, answer correction support, **Strict-Mode-safe toggle handler** (caught by tests)
- **`SnippetPlayer.tsx`** — reveal panel, ID guide button + sheet, label badge
- **`Header.tsx`** — added "My taxa" nav link (signed-in users)

---

## 7. New pages

```
src/app/
├── me/taxa/page.tsx          🐚 Pokédex-style life list with All / Spotted / Helped ID tabs
└── taxon/[id]/page.tsx       species/group detail page with hero, fun fact, description, clip gallery, aliases
```

---

## 8. Testing infrastructure (none in mgtaco's base)

```
tests/
├── README.md                                  setup + how to run
├── unit/                                      Vitest, ~500ms total
│   ├── biogeographic-prior.test.ts            8 tests — prior class
│   ├── id-guide-prefill.test.ts              10 tests — bbox heuristic + boundary conditions
│   ├── id-guide-questions.test.ts             6 tests — question tree config
│   ├── obis.test.ts                           7 tests — URL builder, paging, errors
│   ├── taxon-matching.test.ts                 7 tests — alias normalization
│   └── use-id-guide-reducer.test.ts          14 tests — state machine transitions
└── e2e/                                       Playwright Chromium, ~2 min
    ├── helpers.ts                             signUpFresh + findClipByStatus helpers
    ├── 01-home-and-auth.spec.ts               5 tests
    ├── 02-feed.spec.ts                        3 tests (incl. tracker toggle persistence)
    ├── 03-answer-flow.spec.ts                 4 tests (verified correct/wrong, change-answer, help-us-ID)
    ├── 04-life-list-and-taxon-page.spec.ts    5 tests
    ├── 05-corrections-and-cleanup.spec.ts     3 tests (post-rename verification)
    ├── 06-id-guide-ui.spec.ts                 7 tests (incl. hermit-crab-in-4-taps)
    ├── 07-id-guide-prefill.spec.ts            2 tests (bbox prefill hint visible)
    ├── api-id-guide.spec.ts                   9 tests (matcher API + prior)
    └── api-snippets.spec.ts                   3 tests
```

**Net: 53 unit + 42 E2E = 95 tests, all passing** (see [`test-snapshot.md`](test-snapshot.md) for the live run).

Test infra: `vitest.config.ts`, `playwright.config.ts`, npm scripts for `test:unit`, `test:e2e`, `test:e2e:ui`, `test:e2e:headed`, `test:e2e:report`.

**Real bug caught by the suite:** the tracker toggle had a Strict-Mode-unsafe `setState(prev => …)` updater that included side effects (`localStorage.setItem` + `dispatchEvent`). In dev mode the updater ran twice and flipped the side effects twice — toggle appeared to do nothing. Fixed in `FeedCard.tsx`.

---

## 9. Documentation

```
CLAUDE.md                              (NEW) project brief for future Claude sessions
README.md                              (refreshed) human-facing setup + features
docs/
├── README.md                          (NEW) index of strategy + plan docs
├── engagement-strategy.md             (NEW) N. Devon audience analysis, north-star principles, phased plan
├── phase-1-species-pages.md           (NEW) lean Phase 1 spec
├── id-guide-proposal.md               (NEW) research: OBIS / GBIF / WoRMS / Merlin pattern study
├── id-guide-implementation.md         (NEW) detailed implementation plan + 9 UX constraints
├── app-test-run.md                    (NEW) manual hands-on walkthrough
└── changes-vs-mgtaco.md               (this file)
scripts/README.md                      (NEW) data-scripts runbook
tests/README.md                        (NEW) test infra docs
```

---

## 10. Dependencies added (`package.json`)

| Dep | What for |
|---|---|
| `leaflet` + `react-leaflet` + `@types/leaflet` | Side-panel map showing each clip's location |
| `vitest` | Unit test runner |
| `@vitejs/plugin-react` | Vitest React integration |
| `@playwright/test` | E2E test runner |
| `@testing-library/react` | (installed but not yet used; available for component tests) |

`package-lock.json` regenerated accordingly.

---

## 11. Place / audience reframing

mgtaco's app was written assuming Algarve / Portuguese vernacular (visible in earlier session-level docs and commits). This work corrected to:

- **North Devon, UK** — Bideford Bay coastal community
- **"Algapelago" is the deployment name** (PEBL's branding for the offshore monitoring zone), not a place name despite the `ALG_…` filename prefix
- **British coastal English vernacular** throughout: whiting, pouting, scad, spider crab, etc. — not Portuguese (*salema*, *sargo*, etc.)
- All copy and the engagement strategy rewritten with this in mind

---

## 12. Functional summary — what the app can do *now* that it couldn't on mgtaco's base

1. **Identify creatures** with fuzzy name matching, "did you mean?", and vernacular aliases (mgtaco had only exact text match against `staffAnswer`)
2. **Show a reveal panel** with hero, scientific name, fun fact, points earned, community %, and a "change" link
3. **Two clip states (🟢 Verified / 🟠 Help us ID)** with different scoring (10 / 5 contribution) — mgtaco's clips all required a verified staff answer
4. **See each clip's location on a Leaflet map** with a teal pin at Bideford Bay
5. **See a subtle dot + trace tracker overlay** with a localStorage-persistent toggle (mgtaco had a bright rectangle, always on)
6. **Open an ID Guide** ("🤔 Help me figure it out") with 3-5 big-button questions, bbox-derived auto-prefill of locomotion/screen-zone, and OBIS-informed candidate ranking
7. **Browse a personal life list** (`/me/taxa`) Pokédex-style with All / Spotted / Helped ID tabs
8. **See taxon detail pages** (`/taxon/[id]`) with description, fun fact, habitat, alias list, and clip gallery
9. **Get OBIS-biased candidates** — locally-common species rank above rare visitors, labelled *Common at this site* / *Occasional locally* / *Rare for this site*
10. **Run an automated test suite** with 95 passing checks (see [`test-snapshot.md`](test-snapshot.md))
11. **Auto-ingest pipeline** — `node scripts/ingest-from-drive.mjs --storage` pulls new clips from Drive, uploads to Supabase Storage, and updates the DB — all 3 deployments reflect the change within seconds (no redeploy)
12. **Public Vercel deployment** at https://fish-spotter.vercel.app showing mgtaco's baseline + force-dynamic patch (so it reflects live DB changes) + the Storage migration
