# FishSpotter — Architecture

A map of how the app fits together, for humans and for Claude Code sessions
picking up cold. CLAUDE.md is the reference index (stack, key files, conventions,
env); this is the "how the pieces talk to each other" view.

---

## 1. The product in one paragraph

FishSpotter shows short underwater video clips ("snippets") and asks the viewer
to identify the species. A viewer can guess via a quick **MCQ** (multiple-choice
tiles) or via the guided **"Spot It"** flow (a shape-class-first funnel). Guesses
are scored against a reference identification when one exists, or pooled toward a
community consensus when one doesn't. Points drive a leaderboard and a daily
streak. Reference photos, species probabilities, and diagnostic teaching marks
are all pre-computed offline and cached in Postgres; the request path never calls
an external biology API.

---

## 2. Three subsystems

```
            ┌─────────────────────────────────────────────────────┐
            │  A. REQUEST PATH (user-facing, fast, cache-only)     │
            │     feed → guess (MCQ or Spot It) → score → reveal   │
            └─────────────────────────────────────────────────────┘
                          ▲ reads cached rows
            ┌─────────────────────────────────────────────────────┐
            │  B. OFFLINE DATA PIPELINE (cron + CLI, slow, external)│
            │     OBIS / GBIF / iNaturalist / Gemini → cache tables │
            └─────────────────────────────────────────────────────┘
            ┌─────────────────────────────────────────────────────┐
            │  C. THE CATALOGUE (static, in-repo, validated)        │
            │     species-traits.json + traits.ts → CATALOGUE       │
            └─────────────────────────────────────────────────────┘
```

The golden rule: **B and C feed A; A never reaches outward.** A user request only
reads Postgres + the in-repo catalogue. OBIS/GBIF/iNat/Gemini are touched only by
crons (`vercel.json`) and the `scripts/` CLIs.

---

## 3. The catalogue (subsystem C) — source of truth for species

- **`src/data/species-traits.json`** — the catalogue. One entry per species,
  keyed by scientific binomial: `commonName`, `shapeClass`, trait arrays
  (`bodyShape`, `markings`, `behavior`, `movement`, …), plus optional Rung-3 /
  invert "form" splitters and a prose `fieldNote`.
- **`src/lib/idguide/traits.ts`** — the *vocabulary*: every trait enum as an
  `as const` array, the `ShapeClass` union, and the `SpeciesTraits` type.
- **`src/lib/idguide/catalogue.ts`** — the *loader*: builds a zod schema **from**
  those enum arrays, validates the JSON once, and exports the typed `CATALOGUE`.
  Import `CATALOGUE` from here; never import the raw JSON. `catalogue.test.ts` is
  the CI gate.
- **Sibling editorial files**, also keyed by binomial:
  - `species-aliases.json` → synonyms for answer matching (seeded to the
    `SpeciesAlias` table by `scripts/seed-aliases.ts`).
  - `species-images.json` → iNat fetch manifest + pinned `curated` photo
    overrides (consumed by the image pipeline).

`catalogue.test.ts` cross-checks that every catalogue species has an alias entry
and a curated override, so a half-onboarded species fails CI rather than
degrading silently. See `docs/runbooks/add-a-species.md`.

---

## 4. The request path (subsystem A)

### 4.1 Feed → guess → score → reveal

```
/feed (server component, src/app/feed/page.tsx)
  → feed-ordering.ts: per-user deterministic shuffle, first-unanswered first
  → FeedPlayer (IntersectionObserver) sets the active card
  → FeedCard (the orchestrator) renders one snippet + the guess UI
       ├─ MCQ path:    MCQCandidatePicker  → /api/snippets/[id]/quiz
       └─ Spot It path: ShapeGate → BodyShapeGate → CandidateGate → SpeciesGuidePopup
  → submit → /api/answers → answer-matching.ts (scoring) → Answer row
  → reveal (in-place): verdict pill + community stats + AnnotatedSpeciesPhoto + gallery
```

### 4.2 The "Spot It" rung flow

The guided funnel. Today's control flow lives in **`FeedCard.tsx`** as boolean
state flags (there is no central router yet — see "Extending" below).

| Rung | Component | What it does | Data source |
|------|-----------|--------------|-------------|
| 1 | `ShapeGate` (via `TileGate`) | Pick a shape class (hard filter) | `SHAPE_CLASS` + catalogue counts |
| 2 | `BodyShapeGate` (via `TileGate`) | Sub-split within a class (body form) | `SUB_SPLITS` in `idflow/body-forms.ts` |
| 3 | `CandidateGate` | Narrowed species tiles → `SpeciesGuidePopup` flash-card | `narrowCandidates()` in `idguide/narrow.ts` |
| 4 | reveal (in `FeedCard`) | Verdict + `AnnotatedSpeciesPhoto` rings + gallery | `DiagnosticMark` + `SpeciesImage` |

Shared chrome (draggable card, focus trap, scroll-lock, tile grid) is
`idflow/TileGate.tsx`. The narrowing engine is `idguide/narrow.ts`:
`shapeClass` is a HARD filter (wrong class excluded), other traits soft-score.

> **Note — orphaned adaptive engine.** `src/lib/idguide/next-trait.ts` (an
> information-gain "best next question" picker) and `src/lib/idflow/trait-questions.ts`
> are fully implemented and unit-tested but currently wired to nothing live —
> their only importer is the dead `src/components/idflow/CandidateStrip.tsx`
> (replaced by `CandidateGate` on 3 Jun, which dropped the adaptive questions).
> **If you are adding "deeper trait trees", reconnect this — do not rebuild it.**

> **Note — legacy wizard.** `src/components/IdGuideWizard.tsx` is a separate,
> older 5-step funnel. It is now reachable ONLY post-submit as a teaching surface
> (via `IdGuideTrigger` → `IdGuideSheet`), not as a live ID path. Treat it as
> teaching content, not as the ID flow.

### 4.3 Scoring (`src/lib/answer-matching.ts`)

`matchWithAliases(staffAnswer, userOption, aliases, shapeClassByForm?)`:

| Outcome | `isCorrect` | `points` |
|---------|-------------|----------|
| Species match (alias-aware) | `true` | `POINTS_CORRECT_REF` = 2 |
| Right shape class, wrong species | `false` | `POINTS_SHAPE_CLASS` = 1 |
| Miss | `false` | `POINTS_INCORRECT` = 0 |
| No reference yet | `null` | `POINTS_PENDING_REF` = 1 |

Aliases come from two merged sources: the catalogue's own `scientificName ↔
commonName` pairing (`CATALOGUE_ALIASES`, always available) + the editorial
`SpeciesAlias` table (seeded from `species-aliases.json`). Consensus retro-bonus
(`src/lib/consensus.ts`, daily cron) credits +2 to pending answers once 3+ users
converge on the same name for a no-reference snippet.

---

## 5. The offline data pipeline (subsystem B)

Runs only via crons (`vercel.json`, guarded by `CRON_SECRET`) and `scripts/`
CLIs. Shared libraries are reused by both the cron route and the CLI — never
copy-pasted (see `src/lib/biodiversity/refresh-images.ts` header for the pattern).

| Cache table | Filled from | By |
|-------------|-------------|-----|
| `SpeciesProbability` | OBIS occurrences (per lat/lon/depth/month bucket) | `refresh.ts` ← `db:backfill`, probabilities cron |
| `SpeciesNameMap` | GBIF canonical-name match of `staffAnswer` | `refresh.ts` |
| `SpeciesImage` | iNaturalist (+ Wikimedia top-up), vetted by Gemini | `refresh-images.ts` ← `db:refresh-images`, images cron; `build-species-galleries.ts` |
| `SpeciesAlias` | `species-aliases.json` | `seed-aliases.ts` |
| `DiagnosticMark` | hand-authored in `/admin/species`, or seeded | admin UI / `seed-*-marks.ts` |

**Gemini vision** (`src/lib/biodiversity/gemini-vision.ts`) is the image-quality
judge: Claude orchestrates, Gemini reads the pixels. Free tier is ~20 req/day —
a full catalogue sweep must be spread across days or run on a billed key.

---

## 6. Data model (Prisma, `prisma/schema.prisma`)

Core: `Snippet` (the clip + nullable `staffAnswer` reference), `Answer`
(`isCorrect: Boolean?` + `points: Int`), `User`. Cache: `SpeciesProbability`,
`SpeciesNameMap`, `SpeciesImage`, `DiagnosticMark`, `ConsensusEvent`. Auth:
`Account`, `Session`, `VerificationToken`, `PasswordResetToken`.

> **Known structural debt.** Species are identified by a free `scientificName`
> string across `SpeciesImage`, `DiagnosticMark`, `SpeciesAlias`, the probability
> blob, and the in-repo JSON — joined *by convention, not by foreign key*. There
> is no canonical `Species` table. A typo creates a silent orphan. A `Species`
> table (FK'd from the above) is the recommended next structural investment as
> the catalogue grows; it would make "add a species" a single insert.

---

## 7. Extending the system

- **Add a species** → `docs/runbooks/add-a-species.md`.
- **Add a trait or a rung** → `docs/runbooks/add-a-rung-or-trait.md`.
- **A genuinely more complex rung flow** → the current routing is imperative
  boolean state inside `FeedCard.tsx` (~1,600 lines). Before adding a Rung 2.5 or
  per-class custom flows, consider lifting the flow into a **rung registry +
  reducer** (one config-driven engine over the existing `TileGate` /
  `narrowCandidates` / `next-trait` primitives) rather than adding more bespoke
  gate components and FeedCard flags. This is the single highest-leverage
  refactor for the stated roadmap.
