# Rung 3 (final pick) redesign — visual narrowing, silhouettes → species photos

**Status: PLANNED 3 Jun 2026.** Decisions locked with Christian (below). Brings
Rung 3 into line with the Rung-1/2 gates: a draggable dark card, every step
visual — silhouettes while a shape trait still splits the set, real species
photos once we're at species level. Tap commits; Back is easy on every rung.

## Decisions (3 Jun 2026)

1. **Drop the text yes/no questions.** No more "Does it have a chin barbel?
   Yes/No". Narrowing becomes visual.
2. **Tap commits**, but **going back is easy on all rungs** — a consistent Back
   affordance Rung3 → Rung2 → Rung1, and easy re-do after committing.
3. **Silhouette vs photo by level:** if the remaining split is still a
   morphological/shape trait → show **silhouette tiles** (Rung-2 style); once
   we're at **species level** → show **real species photos**.

## What Rung 3 is today

`src/components/idflow/CandidateStrip.tsx` (in the bottom panel): an adaptive
yes/no question loop (`nextBestTrait` → `traitQuestion`) plus a row of candidate
species as **text chips** that commit on tap. The narrowing brain
(`narrowCandidates` / `nextBestTrait` / `mustHave` / `seed` from Rung 2) is
correct and stays; the text-question UI and text chips are what change.

## Target model — one funnel, always visual

After Rung 1 (shape class) and Rung 2 (body form), Rung 3 repeatedly asks:
"is there still a *shape* trait that splits the remaining set, and do we have a
silhouette for it?"

- **Yes → silhouette split** (a draggable gate of silhouette tiles for that
  trait's values, exactly like Rung 2). Narrows, then re-asks.
- **No → species photo grid** (a draggable gate of the remaining species, each
  tile a real lead photo + common name). Tap commits.

This unifies the whole flow: Rungs 1-3 are all silhouette gates until the set is
species-level, then one photo gate. The yes/no text step disappears.

### Which traits can be a silhouette split?

`nextBestTrait` ranks traits by information gain over the remaining set. We split
visually only on **shape-able** traits we have (or will have) art for; appearance
traits (colour, pattern, spots) are NOT silhouette-able and are better resolved
by the photo grid. Phase 1 must enumerate, from `species-traits.json`, which
trait keys are shape-able:
- Already have art: `bodyShape` + the invert form traits (consumed at Rung 2).
- Candidate new silhouette sets (Christian's call, only if they discriminate
  often enough to be worth the art): e.g. tail shape (forked / rounded / lunate),
  dorsal-fin layout (single / split), head/snout profile. Each value needs one
  simple `currentColor` SVG at `public/silhouettes/traits/<trait>__<value>.svg`
  (same mask-image + manifest mechanism as Rungs 1/2; drop-in, no code change).
- **Reality today:** `bodyShape` is consumed at Rung 2, so until trait-silhouette
  art exists, Rung 3 is almost always the **species photo grid**. The
  silhouette-split branch is wired and waiting for that art — it is the forward
  hook, not blocking.

## Species photo grid (the common Rung-3 case)

- One tile per remaining species: a **real lead photo** (`/api/species-images`)
  + the common name. Prefetch photos when the gate enters this stage (small set,
  ~3-8). No-photo species fall back to their body-form silhouette so a tile is
  never empty.
- Tiles drop out as earlier rungs change (keep the shrink animation — the
  "dopamine engine").
- **Tap commits** the species (existing `onPick` path; scoring + consensus
  untouched).

## Navigation — easy Back on every rung (decision #2)

A single, consistent model across all three gates:

- Each gate gets a **Back** control (← to the previous rung) in addition to the
  existing **Hide** (back to the video). Rung2 Back → Rung1; Rung3 Back → Rung2
  (or to the last silhouette split). Rung1 Back = Hide (nothing before it).
- A breadcrumb of the picks so far ("Fish › Torpedo") doubles as tap-to-jump-back
  targets.
- **Re-do after commit:** the reveal panel already exists; add a clear "Change
  my answer" that re-opens the flow at Rung 1 with prior picks pre-filled. (Note:
  changing a committed `Answer` re-scores — confirm the scoring/consensus
  implications before building this part; the in-flow Back, pre-commit, is the
  cheap win and ships first.)

## Architecture

- Reuse the gate chrome. `TileGate` already gives the draggable dark card, grip,
  Hide, focus trap, tile grid + footer. Add: (a) an optional **Back** footer
  action, (b) a **breadcrumb** header slot, (c) a tile variant that stacks
  silhouette-over-nothing (split) or **photo + name** (species).
- **`CandidateGate`** owns Rung 3: it runs the existing narrowing logic, decides
  silhouette-split vs species-grid each render, and renders the right tiles via
  TileGate. FeedCard renders it as the Rung-3 step, replacing the in-panel strip.
- The Rung-2 `BodyShapeGate` and Rung-3 silhouette splits become the same thing
  (a "trait silhouette gate"); factor the shared bit so Rung 2 is just the first
  trait split.

## Build phases

1. Enumerate shape-able traits + confirm which (if any) get silhouette art now;
   add the `Back` + breadcrumb to `TileGate`; wire Rung1/2 Back.
2. `CandidateGate`: species photo grid (the common case) — gate chrome, photo
   tiles, prefetch, shrink, commit, photo-less fallback. This is the bulk of the
   visible win and ships first.
3. Silhouette-split branch in `CandidateGate` for any shape-able trait with art
   (drop-in `public/silhouettes/traits/`).
4. "Change my answer" re-do after commit (pending scoring sign-off).
5. Validate.

## Validation

- Narrowing parity: fish 26 → … → species-level lands on the same candidates as
  today (`narrowCandidates` regression).
- Every species tile resolves to a photo OR a silhouette fallback (no empty
  tiles); test over all 54 species.
- Commit path unchanged (common name → `onPick`; points/consensus identical).
- Back never strands the user or loses state; breadcrumb jumps are consistent.
- a11y: focus/drag/Hide/Back on every gate; 44px tiles; reduced-motion on shrink
  + zoom.
- Performance: cap concurrent photo fetches; prefetch only at the species stage.

## Risks

- Live core loop — keep the narrowing identical; re-skin + re-route only.
- Photo latency at the species stage — prefetch + silhouette fallback.
- Re-do-after-commit touches scoring — gate it behind sign-off; ship in-flow Back
  first.
- Don't lose the shrink-to-narrow animation.
