# Plan — turning the ID guides into FishSpotter knowledge

Date: 1 June 2026. Author: design session with Christian.

## The core insight

FishSpotter already contains the engine this decision-tree work has been
sketching. It is not a greenfield build. The gap is that the existing system
is **fish-only** and **missing two layers** of the tree Christian drew:

1. **Shape class** — the instant, zero-knowledge top-level filter
   (Crab, Hermit Crab, Fish, Flatfish, Scooter, Jellyfish, Starfish,
   Gastropod, Squid).
2. **Movement** — stationary / fits-and-starts / undulating /
   water-column / drifting (+ crawl for crabs).

What already exists and maps directly:

| Decision-tree layer | Existing code |
|---|---|
| Species visual traits | `src/lib/idguide/traits.ts` (8 controlled vocabularies), `src/data/species-traits.json` (26 fish, each tagged + a prose `fieldNote`) |
| "What rules out the lookalike" | `DiagnosticMark` (admin rings on reference photos) + `narrow.ts` scoring |
| Context (location/depth/season) | `SpeciesProbability` (OBIS) already weights candidates by lat/lon/depth/month |
| The funnel UI | `IdGuideWizard.tsx` (5-6 step trait funnel) |

So the work splits cleanly into **structure** (extend the schema to match the
tree) and **content** (mine the six guides to populate it).

---

## Model revision (1 June, after the recap)

We stress-tested the "5 clean sequential levels" idea (Shape -> Sub-class ->
Context -> Movement -> Species) against the branches we actually drew, and it
does not hold:

- **Context is not a fork, it is a silent prior.** Location / depth / season /
  substrate does not branch the tree; it re-weights probability across all
  candidates at once. The snippet already carries lat/lon/depth/date in its
  metadata, so the app *knows* context without asking. It is already wired:
  `SpeciesProbability` (OBIS) feeds `narrow.ts` as a weight today. Context is
  therefore an invisible prior, never a user-facing step.
- **Movement is a trait, not a level.** It is the single best discriminator
  for two-spotted goby (midwater hover vs bottom) and near-definitional for
  jellyfish (all drift), but marginal for pollack-vs-saithe. A thing that is
  decisive in one branch and irrelevant in the next is one weighted trait
  among many, surfaced only when it separates the remaining candidates.
- **A strict tree is brittle for murky video.** If a spotter cannot answer a
  node, a hard tree dead-ends. A weighted scorer degrades gracefully: partial
  information still ranks candidates.

**Revised model the app executes:** a **hard gate** (Shape Class) + **one
shallow morphological sub-split** where it helps (eyed-side, gadoid/wrasse/
goby) + an **adaptive bag of weighted traits** (visual marks + movement),
with **context as a silent prior**. This is what `IdGuideWizard` + `narrow.ts`
already are; we add shape as a hard filter and order questions by what
discriminates.

**The decision tree stays as the authoring / teaching artifact** (how Christian
externalises expert knowledge and where the wizard's rationale comes from). It
is not the runtime. See `ux-id-flow-plan.md` for the user-facing flow.

---

## The six guides → what each one feeds

All saved under `decision-tree/id-guides/`.

| Guide | Type | Feeds |
|---|---|---|
| `ea-fish-key.pdf` (Maitland & Herdson) | Dichotomous key | **Branch logic** for Fish/Flatfish/Scooter classes — the fork characters become wizard step order + `narrow.ts` predicates. The single most structurally useful guide. |
| `merryweather-crabs-slef.pdf` | Key | The **Crab + Hermit Crab branches** (new shape classes, new sub-traits: leg:body ratio, carapace shape, claw, tucked-vs-fanned tail). |
| `cefas-cephalopods-uk.pdf` | Key | The **Squid class** (cuttlebone shape, tentacular club, funnel). |
| `sussex-ifca-fish-id.pdf` | Field guide | **Life-stage variants** (juveniles look nothing like adults — important for video) + inshore fish trait data. |
| `zsl-estuarine-fish.pdf` | Field guide | Gobies, juvenile gadoids/flatfish, pipefish — the small-inshore long tail. |
| `devon-wt-rocky-shore.pdf` | Habitat guide | Cross-class common species, habitat grounding (Plymouth-area). |
| *(British Sea Fishing confusion pages — web, free)* | Pairwise | The **diagnostic-mark content** for the confusion-matrix pairs (pollack/saithe/cod/whiting, plaice/flounder/dab). |

---

## Phase 0 — Reconcile the two models (design decision, no code)

The current wizard starts at `bodyShape` (6 fish-body values). The tree starts
at `shapeClass`. Proposed reconciliation:

- **`shapeClass` becomes the new top-level filter.** It is the first wizard
  step and the first cut in `narrow.ts`.
- The existing 6 `bodyShape` values (fusiform, eel-like, etc.) become
  **sub-class detail _within_ the Fish shape class**, exactly as Christian's
  "body ratio sub-class" sits under Crab.
- New shape classes (Crab, Hermit Crab, Jellyfish, Starfish, Gastropod, Squid)
  become siblings of Fish/Flatfish/Scooter.
- **Trait sub-schemas become conditional on shape class.** Crabs ask
  leg:body ratio + claw + carapace; fish ask fin/barbel/lateral-line;
  jellyfish ask bell shape + tentacle length. `narrow.ts` already ignores
  unset traits, so this is mostly a UI/authoring concern, not an engine rewrite.

**Decision for Christian:** does Shape class also become a *coarse reference
tier* for scoring? (See Phase 4 — this directly reframes the parked
nullify/backfill audit.)

---

## Phase 1 — Extend the trait schema (small, well-scoped code)

In `src/lib/idguide/traits.ts`:

1. Add `SHAPE_CLASS` enum (the 8 classes: Crab, Fish, Flatfish, Scooter,
   Jellyfish, Starfish, Gastropod, Squid; Hermit Crab folded into Crab).
2. Add `MOVEMENT` enum (stationary / fits-and-starts / undulating /
   water-column / drifting / crawl) as a **normal scored trait**, not a
   funnel level. Do NOT add a "context" trait: context stays in
   `SpeciesProbability` as the silent prior, untouched.
3. Add invert-specific trait vocabularies as needed (e.g. `LEG_BODY_RATIO`,
   `CARAPACE_SHAPE`, `CLAW_TYPE`, `BELL_SHAPE`, `ARM_COUNT`). Keep these
   optional so fish entries don't carry empty invert fields.
4. Add `shapeClass` + `movement` to `SpeciesTraits` and `TraitSelection`.
5. Teach `narrow.ts` to treat `shapeClass` as a hard filter (wrong class →
   excluded, not just down-weighted), and `movement` as a normal scored trait.

Low risk: `narrow.ts` is already generic over `TRAIT_KEYS` and tolerant of
unset traits. ~1-2 new hard-filter lines + enum additions.

---

## Phase 2 — Extract guide content into the catalogue (the big content task)

Goal: grow `species-traits.json` from 26 fish to the full common-species set
across all 9 shape classes, each entry tagged to the (extended) schema with a
prose `fieldNote`.

**Method (recommended): a parse-and-verify workflow.**
- One extraction agent per guide reads the PDF and emits draft JSON entries
  conforming to the schema (scientificName, shapeClass, traits, fieldNote,
  + the single best diagnostic character).
- A cross-check agent verifies each draft against MarLIN / British Sea Fishing
  (catches mis-keyed traits, confirms binomials).
- **Christian (marine biologist) signs off** before anything is written to
  `species-traits.json`. This is the editorial gate — same principle as the
  curated-photo gate.

Sequence by leverage: **Crab first** (Merryweather key is clean and it's the
branch we've already designed), then **gadoids** (clears the confusion matrix),
then the rest of Fish, then the inverts.

---

## Phase 3 — Author diagnostic marks for the confusion pairs

The guides hand us exactly the "what rules out the lookalike" content the
`DiagnosticMark` system was built for, and the confusion matrix already tells
us where it's most needed:

- **whiting ↔ saithe / cod, pollack ↔ saithe** — lateral-line shape
  (kinked vs straight) + chin-barbel present/absent + jaw projection. All in
  the EA key + British Sea Fishing pages and already half-written in the
  `fieldNote`s.
- **flatfish ↔ dragonet ("scooter")**, **plaice ↔ flounder ↔ dab** —
  eyed-side features, left-vs-right-eyed, lateral-line curve.

Author these at `/admin/species/[name]` once Phase 2 has curated reference
photos for the species. This retires items from the 28-May handoff backlog.

---

## Phase 4 — Wire Shape class into scoring + reference tiers (reframes the audit)

The parked reference-ID audit wanted to **nullify** "Fish / Crab / Jellyfish"
as references because they aren't species-level. The decision tree **reframes
them as legitimate Shape-class-level answers.** This is a real design fork:

- **Option A — coarse reference tier.** A spotter who gets "Crab" right but
  not the species earns partial credit (e.g. shape-class match = 1pt,
  species match = 2pt). Shape class becomes a first-class scoring rung. The
  "Fish/Crab/Jellyfish" labels stay as valid coarse references — no nullify.
- **Option B — keep the audit as-is.** Nullify the coarse labels; Shape class
  is only an ID-aid funnel, never a scored answer.

Recommendation: **Option A.** It matches how identification actually works
(you're certain it's a crab long before you know which crab), rewards the
zero-knowledge first cut, and turns the "junk references" problem into a
feature. But it's Christian's strategic call and it changes the backfill script.

---

## What this unblocks from the 28-May handoff

- The **nullify/backfill audit** gets a cleaner answer (Phase 4 decides it).
- The **confusion-matrix mark authoring** gets its source content (Phase 3).
- **MCQ photo curation** overlaps with Phase 2's reference-photo curation.

## Open decisions for Christian

1. Shape class as a scored reference tier? (Phase 0 / Phase 4, Option A vs B.)
2. Run the Phase 2 extraction as a multi-agent workflow, or read the guides
   together branch-by-branch the way we did Crab?
3. Order: confirm Crab → gadoids → rest-of-fish → inverts, or different?
