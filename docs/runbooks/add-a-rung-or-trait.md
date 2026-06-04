# Runbook — Add a trait, or extend the rung flow

Two related but distinct tasks: adding a **trait value** (vocabulary the ID flow
can discriminate on) vs adding a **rung** (a step in the funnel). Read
`docs/ARCHITECTURE.md` §4.2 first for how the rungs are wired.

---

## A. Add a trait value (or a whole trait category)

The trait vocabulary lives in **`src/lib/idguide/traits.ts`** as `as const`
arrays. The catalogue (`species-traits.json`), the zod schema (`catalogue.ts`),
and the narrowing engine all derive from these, so this is the one place to edit.

1. **Add the value to the enum** in `traits.ts` (e.g. a new `MARKINGS` value, or
   a whole new `as const` array + type + a field on `SpeciesTraits`).
2. If you added a new *category* (not just a value): the zod schema in
   `src/lib/idguide/catalogue.ts` is built from these arrays, so add the field
   there too; add it to `TraitSelection` and (if it should be scored) to the
   trait keys the narrowing engine reads in `narrow.ts`.
3. **Add the question copy** in `src/lib/idflow/trait-questions.ts` (and keep the
   coverage test `trait-questions.test.ts` green — it asserts every enum value
   has a question).
4. **Tag species** with the new value in `species-traits.json`.
5. Gate: `npx tsc --noEmit && npm test`. The catalogue schema + the trait-question
   coverage test will catch a value that's used but unspelled, or spelled but
   unused.

> A trait is only useful if it *discriminates*. Adding a value that every species
> in a bucket shares buys nothing. The Rung-3 picker (`next-trait.ts`) ranks
> traits by information gain — a new trait earns its place by splitting a crowded
> bucket (e.g. the over-stuffed `fusiform` fish pool).

---

## B. Add / change a rung in the "Spot It" flow

### The honest state of the flow (read this first)

Rung routing today is **imperative boolean state in `src/components/FeedCard.tsx`**
(~1,600 lines): one `useState` flag per gate, two hand-written reset helpers, and
a branch in `onSelectShape` that decides Rung-1 → Rung-2-or-3. There is **no rung
registry or state machine**. Adding a rung the current way means: a new flag, a
new reset path, a new render block, and editing the duplicated "is a gate open?"
guard in two places.

Also note two things that already exist (don't rebuild them):

- **The adaptive engine is built but disconnected.** `next-trait.ts`
  (information-gain question picker) + `trait-questions.ts` are implemented and
  tested but their only importer is the **dead** `CandidateStrip.tsx`. If your
  rung is "ask an adaptive trait question," **reconnect this**, don't reimplement.
- **`IdGuideWizard.tsx` is a second, legacy funnel** (now teaching-only,
  post-submit). Don't extend it as if it were the live flow.

### Recommended approach for anything non-trivial

Before adding a 4th boolean flag to `FeedCard`, lift the flow into a small
**config-driven engine** and reuse the existing primitives:

- A **rung registry**: an array of `{ id, appliesWhen(state), component,
  deriveNext(pick, state) }`. The engine renders "the current rung"; adding a
  rung becomes adding a registry entry.
- A **flow reducer** (`useReducer`) holding `selectedShape`, the accumulated
  `mustHave` / `mustNotHave` / `askedKeys` trait filters, the current rung, and
  the breadcrumb — instead of scattered booleans. The live `CandidateGate`
  currently re-derives candidates from `{shape, seed}` only and can't accumulate
  a chain of answers; a reducer is what unblocks "deeper trait trees."
- Keep using the good primitives as-is: `TileGate` (gate chrome),
  `narrowCandidates` (`narrow.ts`), `next-trait.ts` (which question next).

This refactor is itself the highest-leverage item on the roadmap (see
`docs/ARCHITECTURE.md` §7). If you only need a tiny tweak, follow the existing
`FeedCard` pattern; if you're building "a more complex rung system," do the
registry + reducer first.

### Scoring a new rung

Scoring lives in `src/lib/answer-matching.ts`, decoupled from the UI (it scores
the final answer string). Tiers are `Answer.points` integers: species = 2, shape
class = 1, miss = 0. Note there's deliberately no value between 1 and 2 (it would
break the consensus-pioneer invariant: pending 1 + bonus 2 must out-rank a
referenced correct 2). A new intermediate rung does **not** automatically get its
own score tier — changing the tiers ripples through `consensus.ts` and its tests.
