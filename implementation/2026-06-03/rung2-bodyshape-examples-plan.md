# Rung 2 (body-shape sub-split) redesign + "Examples" feature — plan

**Status: PLANNED 3 Jun 2026.** Christian is authoring the real body-shape
silhouette assets in parallel; this plan builds Rung 2 with placeholders that
auto-upgrade when those assets land.

## Goal

Make Rung 2 (the "What was the overall body shape?" sub-split) match Rung 1
(the shape gate): a **dark, draggable card** with **silhouette tiles**. Add an
**"Examples" button under each tile** that pops up a few real photos of species
with that body type — a major identification helper.

## Current state

- Rung 1 = `ShapeGate.tsx` — dark, draggable, silhouette tiles, video behind. ✅ (just shipped)
- Rung 2 = the `subSplit` block **inside** `CandidateStrip.tsx` (lines ~284-309)
  — a light teal-bordered box in the floating panel, text-only options, not
  draggable, not styled like the gate. This is what looks "very different."
- Rung 3 = the candidate chips in `CandidateStrip`.

## Architecture (the core decision)

**Generalise `ShapeGate` into a reusable `TileGate`** and render Rung 2 as a
**second TileGate**, so it inherits the dark card chrome, drag, Hide, and tile
styling for free.

```
TileGate (new, extracted from ShapeGate)
  props: title, tiles[], onSelect, onSkip, onClose, footer slots
  tile: { key, label, count, silhouette (mask-image), Examples button? }
Rung 1: <TileGate title="What shape is it, roughly?" tiles={SHAPE_TILES} ... />
Rung 2: <TileGate title="What was the overall body shape?" tiles={formTilesFor(shapeClass)} withExamples ... />
```

Flow in `FeedCard`:
```
ShapeGate (Rung1) --pick shape--> if class has a sub-split: BodyShapeGate (Rung2)
   --pick form / skip--> CandidateStrip (Rung3 chips, narrowed)
```
New FeedCard state: `bodyGateOpen` + `selectedForm`. On Rung-1 pick, if
`SUB_SPLITS[shape]` exists, open Rung 2 instead of going straight to the strip;
on Rung-2 pick, set the form into the strip's `mustHave` and proceed. "Not sure"
on Rung 2 skips the form (proceed unfiltered). Keep the strip's existing
sub-split as a fallback for any class still rendering it inline (or remove once
Rung 2 owns it).

The 20 body-form options already exist in `CandidateStrip.SUB_SPLITS` — lift
them into a shared `src/lib/idflow/body-forms.ts` so both the gate and the
strip's narrowing read one source.

## Silhouette assets — placeholder → real drop-in

Mirror the gate's proven approach (mask-image + `bg-current` tinting):

- **Path convention:** `public/silhouettes/forms/<shapeClass>__<form>.svg`
  e.g. `fish__fusiform.svg`, `squid__octopus.svg`, `jellyfish__saucer.svg`.
  20 files total (fish 5, squid 4, starfish 4, gastropod 4, jellyfish 3).
- **Format:** single-path stroked/filled SVG in `currentColor` (so mask-image
  tints it teal and it hover-recolours, exactly like the gate's shape assets).
- **Manifest:** `src/data/body-form-silhouettes.json` lists which form keys have
  a real asset (mirror of `silhouette-credits.json`). A `HAS_FORM_SILHOUETTE`
  set drives whether the tile masks the real SVG or shows the placeholder.
- **Placeholder (now):** a neutral ghost — a dashed rounded tile with the
  parent shape-class silhouette at low opacity + the form label. Reads as
  "art coming" without looking broken.
- **Drop-in:** Christian adds `fish__fusiform.svg` to `public/silhouettes/forms/`
  and the key to the manifest → the tile shows the real teal silhouette, no code
  change. (Document this in the manifest `_README`.)

## "Examples" feature

Under each Rung-2 tile, an **"Examples"** button → popup of real photos of
catalogue species with that body form.

- **Data:** filter `species-traits.json` for `shapeClass === <class>` AND the
  form trait array includes `<value>` (e.g. fish `bodyShape` includes
  `fusiform`). Verified working: fusiform → Pollack, Saithe, Bib, Mackerel, …
  Cap at ~4-6 representative species (prefer ones with a curated photo).
- **Photos:** reuse the existing `/api/species-images/<scientificName>` route +
  `SpeciesGallery` (already a portaled, focus-trapped, CC-attributed lightbox).
  New thin wrapper `BodyFormExamples` that, given a list of species, shows one
  representative photo each in a small grid; tap → existing lightbox.
- **Popup chrome:** dark, matches the gate; focus-trapped; Escape closes;
  returns focus to the Examples button. Renders above the gate (z-index).
- **Selection:** photos are illustrative only — they do NOT commit a guess
  (tapping a photo opens the lightbox, not submit). A separate "this one" on the
  species name could commit later, but v1 is purely a teaching aid.

## Build phases

1. **Extract `TileGate`** from `ShapeGate` (no behaviour change to Rung 1).
   Verify Rung 1 still works identically.
2. **Rung 2 as a TileGate** (`BodyShapeGate`): dark draggable card, placeholder
   silhouette tiles, wired into the FeedCard flow (Rung1→Rung2→Rung3). Ship the
   placeholder version. ← *"design rung2 now with placeholder images"*
3. **Examples popup** (`BodyFormExamples` + per-tile button) using real species
   photos. Ship.
4. **Real assets** drop in as Christian delivers them (manifest updates only).
5. **Validate** (below).

## Validation

- Each form value resolves to ≥1 catalogue species with a photo (script over
  `species-traits.json` × `SpeciesImage`); flag any empty form so its Examples
  button hides rather than showing an empty popup.
- Narrowing still correct: picking a Rung-2 form sets `mustHave[formKey]` and
  the strip count drops accordingly (regression-test the fish 26→N path).
- a11y: gate + Examples popup focus management, 44px targets, reduced-motion on
  the new card + popup, draggable grip (drag-from-handle only).
- Singleton classes (scooter/flatfish: 1 species) get no Rung 2 (no sub-split) —
  unchanged.

## Risks

- Live core feed — extract `TileGate` carefully so Rung 1 is byte-identical in
  behaviour; verify before wiring Rung 2.
- Examples photos are CC-licensed — keep attribution (SpeciesGallery already does).
- Don't let the Examples popup + draggable gate + lightbox create z-index/focus
  conflicts; test the gate→Examples→lightbox→back chain.
