# Plan: fix "How to spot a [X] next time" (the group-reference dead-end)

**Status:** proposal, awaiting Christian's steer on the open questions (section 10).
**Date:** 2026-06-11.

## 1. Diagnosis (why it's broken)

The post-submit CTA "How to spot a {reference} next time"
(`IdGuideTrigger.tsx`) opens `IdGuideSheet` in `fieldNote` mode with
`fieldNoteFor = { commonName: staffAnswer, scientificName? }`.

`IdGuideSheet`'s field-note mode tries to resolve that reference to ONE catalogue
species (scientific match -> normalised common name -> plural -> token-sort).

- **Reference is a species** (e.g. "Plaice", "Ballan wrasse"): resolves, and the
  user sees a genuinely good card: `AnnotatedSpeciesPhoto` (numbered diagnostic
  rings on the curated photo) + `SpeciesGallery` + field-note prose + a trait
  table. This already does the job.
- **Reference is a coarse GROUP** (e.g. "Flatfish", "Fish", "Crab",
  "Jellyfish"): there is no catalogue species literally called "Flatfish", so
  resolution returns `null`, no `scientificName` is present, and the code falls
  through to `CatalogueBrowser` -> a search box + the full A-Z list of every
  species. **That is the broken screen.** The user asked "how do I spot a
  flatfish" and got "search all 57 species."

**Root cause:** coarse group-level references (which became first-class when we
adopted scored-by-rung, where "Fish / Crab / Flatfish" are valid coarse answers)
have no single species to render, and there is no *group* guide, so the view
degrades to a generic catalogue search.

This will only get more common: the "It's just a Fish" coarse submit (a2c95bc)
and group-level-only clips (3f9bd9d) deliberately produce group references.

## 2. What the user actually wants to see

The mental model of "How to spot a [X] next time" is a **field-guide cheat
sheet**: "here's how to recognise this thing when you see it again." Two shapes:

### Case A — reference is a species (already good, minor adds)
Keep the current card. What it shows / should show:
- annotated reference photo with numbered diagnostic rings (the headline),
- reference gallery (CC photos, lightbox),
- field-note prose,
- key traits (shape, size, colour, markings, fins, features, behaviour,
  habitat), typical depth.
- **Proposed adds (P3):** an "Often confused with X, tell them apart by Y" block
  (we already compute confusions in `scripts/confusion-matrix.ts`), and a "See
  full profile" link to `/species/[slug]`.

### Case B — reference is a group (the fix)
Render a **group guide**, e.g. "How to spot a flatfish":
1. the **group silhouette** (we already ship one per shape class) + a one-line
   intro,
2. **2-4 group recognition cues** — the at-a-glance tells ("lies flat on the
   seabed", "both eyes on the upper side", "diamond/oval outline", "often
   half-buried in sand"),
3. **the members you'll actually see here** — the catalogue species in that shape
   class (Flatfish -> Plaice, Dab, Flounder) as tappable photo tiles; tapping one
   drills into that species' Case-A card,
4. a one-liner on **telling the members apart** (the key splitter),
5. honest framing: "Logged at group level - the exact species wasn't certain",
   which is true to the scored-by-rung model.

This turns a dead-end into the most teachable moment in the app.

## 3. Detection: species vs group vs unknown

In the field-note view, classify the reference:
- **group** if `normalise(reference)` is in the shape-class set
  (`fish, flatfish, crab, jellyfish, starfish, gastropod, squid`) or their gate
  labels (`Snail / slug` -> gastropod) or known coarse synonyms ("it's just a
  fish" -> fish). Source of truth: `SHAPE_CLASS` in `traits.ts` +
  `SHAPE_CLASS_LABEL` in `ShapeGate.tsx`.
- else **species** if the existing matcher resolves it.
- else **unknown** -> keep `CatalogueBrowser`, but reframed (rare genuine gap).

Order matters: check group BEFORE the species matcher's `null` falls through to
the browser.

## 4. New content: shape-class recognition guides (editorial)

There is per-species content (marks + field notes) but **no group-level
"how to recognise this shape class" content** yet. Add a small, validated static
source:

`src/data/shape-class-guides.ts` (or `.json` + zod, mirroring how
`catalogue.ts` validates `species-traits.json`):

```ts
type ShapeClassGuide = {
  key: ShapeClass;            // "flatfish"
  label: string;             // "Flatfish"
  intro: string;             // one sentence
  cues: string[];            // 2-4 at-a-glance recognition tells
  tellApart: string;         // one line on splitting the members
};
```

- 7 entries only - small, but **editorial**: grounded in the existing
  `decision-tree/index.html` + the `decision-tree/id-guides/*.pdf` sources, and
  needs the same marine-biologist sign-off bar as field notes. This is the long
  pole, not the code.
- Drafts can be seeded from the decision tree (it already encodes
  "shape class -> sub-class -> best diagnostic").

## 5. Components

- **New `GroupGuide`** (`src/components/idflow/GroupGuide.tsx`): silhouette +
  intro + cues + member photo grid + tell-apart line. Member tiles reuse the
  `CandidateGate` photo-fetch pattern (`/api/species-images/...?limit=1`) and the
  tile look. `onPickSpecies(sci)` drills in.
- **Refactor `IdGuideSheet` field-note mode** to a 3-way branch:
  resolved species -> species card (existing); group -> `<GroupGuide>` (drill-in
  via the existing `setSelectedFallback`, which already overrides the view with a
  chosen species and shows a "Back to {group}" affordance); unknown ->
  `CatalogueBrowser` (reframed copy).
- **Optional cleanup (P3):** `IdGuideSheet`'s species card and
  `SpeciesGuidePopup` (Rung 3) render almost the same thing. Extract a shared
  `SpeciesFieldGuide` component and use it in both, so "how to spot" is one
  component with one look. Reduces drift.

Reuse as-is: `AnnotatedSpeciesPhoto`, `SpeciesGallery`, the `selectedFallback`
drill-in machinery, the sheet's focus-trap / scroll-lock / keyboard handling.

## 6. Data / API

- Member species: client-side from `CATALOGUE` filtered by `shapeClass`
  (`narrowCandidates({ catalogue, shapeClass })` already does this). No new API.
- Member photos: existing `/api/species-images/[name]?limit=1`.
- Group cues: the new static file. No new API.

## 7. Edge cases

- **"Fish" (coarse) is broad** - it spans several fish shape-classes (fusiform,
  laterally-compressed, eel-like, bottom-scooter). Decide whether the "fish"
  group guide shows the single `fish` shape-class or all true-fish classes, and
  cap the member grid by local likelihood (context prior) so it isn't 25 tiles.
  (Open question 10.1.)
- Species with no authored marks: `AnnotatedSpeciesPhoto` self-hides; gallery +
  note still render. Already handled.
- Empty group (no catalogue members for that class): show silhouette + cues only.
- Unknown reference: reframed `CatalogueBrowser` ("We don't have a guide for
  '{X}' yet - browse the species the biologist tracks"). Keep, but it's the
  exception, not the default.
- A11y / reduced motion: inherited from the existing sheet; member grid is
  buttons with aria-labels; keep >=44px targets.

## 8. Phasing

- **P1 - stop the bug (half day):** detect group -> render a *minimal*
  `GroupGuide` (silhouette + a generic one-liner + member photo tiles that drill
  into species cards) using only EXISTING data. No authored cues yet. This alone
  kills the search-dump dead-end and makes "How to spot a flatfish" show
  flatfish.
- **P2 - the teaching value (1 day + editorial):** author the 7 shape-class
  guides (cues + tell-apart), zod-validate, sign-off; render cues in
  `GroupGuide`.
- **P3 - polish (1 day):** species "often confused with" (from confusion-matrix)
  + "See full profile" link; extract shared `SpeciesFieldGuide`; refine "Fish"
  handling.

## 9. Acceptance criteria

- "How to spot a flatfish next time" shows a flatfish group guide (silhouette +
  cues + Plaice/Dab/Flounder tiles), **never** the full-catalogue search.
- Tapping a member tile opens that species' field-guide card; "Back to flatfish"
  returns to the group guide.
- Species references still show the species card (no regression).
- Unknown references show a clear "no guide yet", not a raw dump.
- Verified on mobile + desktop via the visual loop (`scripts/ui-review.ts`).

## 10. Open questions (need Christian's steer)

1. **"Fish" coarse scope:** show a curated "common fish you'll see here" set
   (likelihood-ranked, capped ~8) or the whole `fish` shape-class? Recommend the
   curated/capped set.
2. **Member ordering:** alphabetical, or by local likelihood from the context
   prior (`SpeciesProbability`)? Recommend likelihood (most-likely first).
3. **Depth of the species card in this context:** keep everything inside the
   sheet, or have "See full profile" jump to `/species/[slug]`? Recommend in-sheet
   with an optional profile link.
4. **Scope now:** do you want P1 only (kill the bug fast) or P1+P2 (bug + authored
   cues) in the first pass?
