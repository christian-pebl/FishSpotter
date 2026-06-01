# Implementation plan — visual ID flow ("Spot It")

Date: 1 June 2026. The executable build. Rationale lives in
`guide-integration-plan.md` (engine model) and `ux-id-flow-plan.md` (UX design).

**Approved decisions (1 June):**
1. Guided flow sits **alongside** the MCQ, launched by a "Help me ID it" entry;
   MCQ stays the default fast path; "skip to guess" jumps from any rung to the
   MCQ.
2. **Scored by rung** confirmed (coarse shape-class match earns partial credit).
3. Assets: **PhyloPic silhouettes** (recolored) for the gate; **annotated real
   photos** via the existing `DiagnosticMark` system for trait diagrams;
   Canva/Claude-generate only for throwaway prototype placeholders.
4. **Prototype the gate first** (UX-0) before the full asset set.

---

## Workstreams and dependencies

```
A. Schema foundation ──┬─> B. Engine ──┐
                       │               ├─> F. UX build (UX-0..UX-5)
C. Catalogue content ──┤               │
D. Assets (PhyloPic) ──┘               │
A + C ─> E. Scoring (by rung) ─────────┘
```

A blocks everything. B, C, D can run in parallel after A. E needs A + C. F
consumes B/C/D/E as they land.

---

## A. Schema foundation  (critical path, ~half day)

Files: `src/lib/idguide/traits.ts`, `src/data/species-traits.json`.

1. Add `SHAPE_CLASS` enum: `crab, fish, flatfish, scooter, jellyfish,
   starfish, gastropod, squid` (Hermit Crab folded into crab).
2. Add `MOVEMENT` enum: `stationary, fits-and-starts, undulating,
   water-column, drifting, crawl`.
3. Extend `SpeciesTraits`: add `shapeClass: ShapeClass` (single value, like
   `size`) and `movement: Movement[]`. Extend `TraitSelection`: add
   `shapeClass?: ShapeClass[]` and `movement?: Movement[]`.
4. Backfill all 28 existing species with `shapeClass` (all `fish` except
   Plaice = `flatfish`, Dragonet = `scooter`) and a `movement` array.
5. Do NOT add a `context` trait. Context stays in `SpeciesProbability`.

**Done when:** `tsc` clean, all 28 species carry `shapeClass` + `movement`,
JSON valid.

---

## B. Engine  (~1 day)

File: `src/lib/idguide/narrow.ts` (+ new `src/lib/idguide/next-trait.ts`).

1. **Shape class = hard filter.** Add a `shapeClass?: ShapeClass` arg to
   `narrowCandidates`. When set, exclude every species not of that class
   *before* trait scoring (not a down-weight). One guard at the top of the
   per-species loop.
2. **Movement scored as a normal trait.** Add `movement` to `TRAIT_KEYS` and
   `ALLOWED_VALUES`. No other change; the existing overlap scorer handles it.
3. **Information-gain picker** (new file `next-trait.ts`):
   `nextBestTrait(candidates, askedKeys)` -> the unanswered trait whose values
   most evenly split the remaining candidate set (max entropy reduction).
   Drives Rung 3 ordering. Pure function, unit-testable.

**Done when:** new unit tests pass (shape filter excludes off-class species;
`nextBestTrait` picks the most-splitting trait on a fixture); existing 167
tests still green.

---

## C. Catalogue content  (parallel after A; the long pole)

File: `src/data/species-traits.json`. Method per `guide-integration-plan.md`
Phase 2 (parse-and-verify, Christian signs off).

The gate is only useful once non-fish classes have species, or tapping "Crab"
returns zero candidates. Order by leverage:
1. **Crab** (5-6 species, from `merryweather-crabs-slef.pdf`) — the branch we
   designed; unblocks the first non-fish gate tile.
2. **Gadoids already present**; verify their `movement` + marks (feeds Rung 3
   confusion pairs).
3. **Jellyfish, Starfish, Gastropod, Squid** (from the invert guides + Cefas).
4. **Rest of fish** long tail.

**Done when:** each of the 8 shape classes has >= 3 species so every gate tile
lands somewhere real.

---

## D. Assets  (parallel after A)

Silhouettes: `public/silhouettes/<shapeclass>.svg` (+ fish body-forms).
1. Pull 8 shape-class silhouettes from **PhyloPic** (CC0/CC-BY). Record
   author + license per file in `src/data/silhouette-credits.json` (mirror the
   iNat attribution pattern).
2. Recolor to brand teal via SVG `fill` (PhyloPic art is single-color) or a
   CSS `currentColor` swap so we can theme it.
3. ~5 fish body-form silhouettes for the Rung 2 sub-split.
4. Trait diagrams: **none commissioned.** Rung 3 uses real photos +
   `DiagnosticMark` rings (Workstream covered by Phase 3 mark authoring).

**Done when:** 8 + ~5 SVGs in `public/silhouettes/`, teal, credited.

Prototype shortcut: for UX-0 only, generate 8 quick placeholders via the
connected design tool so F is not blocked on D.

---

## E. Scoring — by rung  (after A + C)

Files: `src/lib/answer-matching.ts`, scoring/points model, `prisma/schema.prisma`
if a shape-class reference column is needed.

1. A snippet's species reference **implies its shape class** via
   `species-traits.json` (no new reference data needed for referenced
   snippets). Derive `referenceShapeClass` from `staffAnswer`.
2. Extend `matchAnswer()` so a submission is scored at the **deepest rung it
   got right**:
   - species match = `POINTS_CORRECT_REF` (2, unchanged)
   - shape-class match only = new `POINTS_SHAPE_CLASS` (**LOCKED at 1**, 1 Jun)
   - wrong shape class = 0
   - **no sub-class tier** (locked): `Answer.points` is an Int, nothing fits
     between 1 and 2, and bumping species to 3 would break the consensus
     invariant. A correct Rung 2 sub-class scores as the shape-class rung.
   - no-reference snippet = existing pending/consensus path, now also able to
     award shape-class consensus.
3. **Reframes the parked nullify audit:** "Fish / Crab / Jellyfish" become
   valid coarse references, not junk. Update the audit/backfill scripts to
   treat them as shape-class-level refs rather than nullify candidates.

**Done when:** `answer-matching.test.ts` extended and green; partial-credit
path verified; ordering invariant preserved (species > shape-class > 0).

**Point values (LOCKED 1 Jun):** species 2, shape-class 1, wrong 0. No
sub-class tier (Int points + consensus invariant). Workstream E unblocked.

---

## F. UX build — the rungs  (consumes B/C/D/E)

Files: `src/components/FeedCard.tsx`, new `src/components/idflow/*`, reuse
`IdGuideWizard`, `MCQCandidatePicker`, `AnnotatedSpeciesPhoto`,
`narrowCandidates`.

- **UX-0 — Gate prototype.** "Help me ID it" button on FeedCard opens a bottom
  sheet with the 8-silhouette grid (placeholder art). Tap sets `shapeClass`.
  Show a live candidate count. Proves the feel. *(Needs A, B step 1; D
  placeholders.)*
- **UX-1 — Candidate strip + skip-to-guess.** Render `narrowCandidates()`
  output as a shrinking thumbnail strip; "skip to guess" -> existing
  `MCQCandidatePicker`. *(Needs C started so the strip isn't empty off-fish.)*
- **UX-2 — Adaptive Rung 3.** Wire `nextBestTrait`; ask one visual trait at a
  time; auto-stop at `NARROW_ENOUGH = 3`. *(Needs B step 3.)*
- **UX-3 — Sub-splits (Rung 2)** for fish / flatfish / crab.
- **UX-4 — Reveal + scored-by-rung.** Finalists with `DiagnosticMark` rings;
  commit; score via E. *(Needs E.)*
- **UX-5 — Real assets.** Swap placeholders for PhyloPic SVGs + annotated-photo
  trait prompts. *(Needs D complete + Phase 3 marks.)*

Each UX phase ships testable on the live feed. Respect CLAUDE.md UI rules
(no emoji icons, design tokens, 44px touch targets, `inert` on off-screen
cards, immediate reveal feedback).

---

## Recommended execution order

1. **A** (schema) — unblocks all.
2. **B step 1** (shape hard filter) + **D placeholders** -> **UX-0**. Feel the
   gate this week.
3. **C: Crab** + **B step 3** (info-gain) in parallel.
4. **UX-1, UX-2** as B/C land.
5. **E** (scored-by-rung) once Crab is in -> **UX-4**.
6. **C: inverts** + **D: PhyloPic** -> **UX-3, UX-5**.

---

## Verification gates

- `tsc --noEmit`, `npm run test`, `npm run lint`, `npm run build` green at each
  phase (matches the 28-May handoff bar).
- New unit tests: shape hard-filter, `nextBestTrait`, scored-by-rung.
- Live-feed smoke per `implementation/2026-05-27/smoke-checklist.md` after any
  FeedCard change.
- Code-review agent pass before any push (stakes are high on scoring).

## Open decisions for Christian

1. ~~**Point values** for the rungs.~~ **RESOLVED 1 Jun:** species 2,
   shape-class 1, wrong 0; no sub-class tier.
2. **"Help me ID it" entry point**: a button alongside the MCQ (lowest risk), or
   the gate shown first with skip-to-guess? (Plan assumes the button.)
3. **Audit reframe**: confirm "Fish / Crab / Jellyfish" move from nullify to
   valid coarse references (follows from decision 2 being approved).
