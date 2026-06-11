# FishSpotter: community-consensus-first reframe — app changes (11 Jun 2026)

From the `/pebl-ask` call: make community-consensus the DEFAULT (most clips carry
no PEBL answer), keep a thin verified layer, and gate the flip behind a small user
test. Strategically this IS the crowd-to-ML loop the Business Brain names: the
"PEBL answer" is the £75/hr biologist, and having the community produce the IDs is
the loop ([[09-Operations-and-Delivery]], [[06-Competitive-Edge]]). It also
dissolves the blocker we hit this week (staff often cannot ID to species).

## What already supports this (do NOT rebuild)
- **No-reference scoring path** (S7-T1): `staffAnswer = null` -> `isCorrect = null`,
  `POINTS_PENDING_REF = 1`. Already live.
- **Consensus engine** (`src/lib/consensus.ts`, `ConsensusEvent`, daily
  `/api/cron/consensus-rescore`): groups no-reference answers by normalised name,
  credits `POINTS_CONSENSUS_BONUS = 2` once `CONSENSUS_THRESHOLD_USERS = 3` distinct
  users agree. Idempotent. This is the backbone.
- **The scoring already encodes the consensus-first incentive:** a consensus
  pioneer (1 pending + 2 consensus = 3) outranks a verified-correct (2). No scoring
  re-weight needed; it was built for this.
- **`scripts/audit-reference-ids.ts`** (keep / backfill / nullify) is the tool to
  reclassify the current staffAnswers.

## Three clip tiers (the data model)
- **Verified** (`staffAnswer` = a catalogue species, set by a biologist/admin):
  keeps the expert reveal, 2 pts, instant pokedex unlock. A deliberate minority.
- **Community** (`staffAnswer = null`): pending + consensus; consensus reveal;
  unlock on consensus.
- The current coarse `functional_group` references ("Gastropod"/"Fish") migrate to
  **Community** (null the staffAnswer) since they are not species-level and make a
  poor "answer". Preserve the group elsewhere so the migration is reversible (a new
  nullable `Snippet.functionalGroup`, or re-derivable from the snips metadata).

## Phased changes

### Phase 1 — Consensus-first reveal (the engagement core)  [M]
- **Live consensus read:** extend `/api/snippets/[id]/stats` (already loaded at
  reveal) with, for no-reference clips, the distinct-user counts per normalised
  name (reuse `groupPendingAnswers`). No new cron; computed on read.
- **`RevealResult`** (`src/components/idflow/RevealResult.tsx`): for no-reference
  clips, replace "bonus awarded" with a community panel: "You said X. The community
  is converging on Y (N spotters)." States: *first to call it*, *with the pack*,
  *minority view*. Keep the existing expert reveal for Verified clips.
- **Copy:** community clips read as "help build the record", never wrong/right.

### Phase 2 — Pokedex unlock on consensus  [M]
- Extend `rescoreConsensus` (and a submit-time check when consensus is already met)
  to upsert `UnlockedSpecies` for the matching users, resolving the normalised name
  to a catalogue species via `scientificFromLocalName`. Collections now fill from
  Community clips, not just Verified ones (essential, since Verified is now a
  minority).
- Collection copy: "collected by your own correct ID, or by joining the community
  consensus."

### Phase 3 — Quality / crowd-to-ML confirm (admin)  [M]
- The admin reference editor (from `remaining-work-plan.md`) shifts ROLE: its main
  job becomes **confirming consensus** ("community says X, N agree, confirm as a
  verified reference?") so a biologist cheaply promotes a strong crowd label to a
  training-grade one. This is the £75/hr -> spot-review reduction and the concrete
  crowd-to-ML wiring. Plus setting the Verified minority directly. Show a
  confidence/agreement indicator.

### Phase 4 — Validation gate (BEFORE the irreversible flip)  [test]
- Small user test of consensus-mode engagement at current scale. Watch: do people
  still contribute and return when most clips give "bonus + emerging consensus"
  instead of "correct vs the expert"? Does the "first / with the pack" reveal land
  with a tiny crowd? Only run Phase 5 if this passes ([[10-Decision-Frameworks]]:
  speculative bets pass a validation gate).

### Phase 5 — Flip the default (data migration, gated + reversible)  [S]
- Run `audit-reference-ids.ts`, null the coarse/indeterminate staffAnswers (->
  Community), keep verified species. Reversible (functional_group preserved). This
  is the actual "drop the PEBL answer as the default" step; it goes last, after the
  gate.

## Risks to carry (in Christian's terms)
- **Scale chicken-and-egg:** consensus needs 3 users/clip; at current scale (6
  correct answers in all of prod) it rarely fires, so early engagement rests on
  contribution + leaderboard + pokedex + streak, NOT consensus feedback. The gate
  (Phase 4) tests exactly this. Do not flip the default before it passes.
- **Label quality for the moat:** the moat is the MODELS ([[06-Competitive-Edge]]),
  and raw consensus from few novices is noisy training data. Keep the biologist
  spot-confirm (Phase 3) before any consensus label is treated as training-grade.
- **FishSpotter is a side project** ([[09-Operations-and-Delivery]]); this reframe
  is mostly LESS work (no per-clip biologist answer) which suits that, but Phases
  1-3 are real build. Scope to the gate first.

## How this reconciles with `remaining-work-plan.md`
- The **admin editor (A)** stays, but its purpose shifts from "the only way the
  pokedex fills" to "confirm consensus + set the verified minority" (Phase 3 here).
- The **pokedex** now fills via consensus (Phase 2), so it is no longer hollow at
  launch even with zero verified species refs.
- The **tutorial (B)**, **next-trait (C)**, **a11y/nav (E/F)** are unaffected.
- Suggested order: Phase 1 + 2 (consensus reveal + unlock) -> validation gate ->
  Phase 3 (admin confirm) + Phase 5 (flip), interleaved with the quick wins.

## Decisions to confirm
1. **Null the coarse refs now or only after the gate?** (Recommend: build Phases
   1-2 against the existing no-reference path, keep a few Verified clips for the
   test, flip the rest only after Phase 4.)
2. **Live consensus on the stats endpoint vs a new endpoint?** (Recommend: extend
   stats; it is already fetched at reveal.)
3. **Preserve functional_group as a column or rely on metadata re-seed for
   reversibility?** (Recommend: a nullable `functionalGroup` column, additive.)
4. **Validation-gate metric + cohort:** who tests, and what number says "it engages"?
