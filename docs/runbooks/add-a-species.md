# Runbook — Add a species

The catalogue is the source of truth (`src/data/species-traits.json`). Adding a
species is mostly editing in-repo data; `catalogue.test.ts` will tell you when
you've done it correctly. Photos and marks are DB-side and need a script run.

> **TL;DR:** edit 3 JSON files → `npm test` until green → pin a photo →
> `db:refresh-images --species` → author diagnostic marks. The test is your
> checklist.

---

## 1. Add the trait entry (required)

Edit **`src/data/species-traits.json`**. Add one entry keyed by the scientific
binomial. Every field below is validated against the enums in
`src/lib/idguide/traits.ts` — an invalid value or a missing required field fails
`catalogue.test.ts`.

```jsonc
"Genus species": {
  "commonName": "Common Name",
  "shapeClass": "fish",            // one of SHAPE_CLASS in traits.ts
  "bodyShape": ["fusiform"],       // [] is valid for inverts (they use a form enum)
  "size": "medium",
  "coloration": ["uniform"],
  "markings": ["none"],
  "finShape": ["forked-tail"],
  "features": ["none"],
  "behavior": ["solitary"],
  "habitat": ["open-water"],
  "movement": ["water-column"],
  "fieldNote": "One or two sentences a spotter can act on."
  // optional splitters, only if the species needs them to separate within a
  // crowded bucket: bodyDepth, lateralLine (fish); crabForm/carapaceTexture/
  // crabFeatures (crab); cephalopodForm, armForm, shellShape, bellForm (inverts)
}
```

Rule of thumb: if a trait value isn't in `traits.ts`, it's not allowed — add the
value to the enum **first** (that's the other runbook) or pick an existing one.

## 2. Add an alias entry (required)

Edit **`src/data/species-aliases.json`** so scoring accepts the synonyms a real
person would type. `commonName` must match the catalogue (case-insensitive).
Avoid bare generic aliases that collide across species (e.g. "squid", "goby").

```jsonc
"Genus species": {
  "commonName": "Common Name",
  "aliases": ["alt name", "old binomial", "Genus"]
}
```

## 3. Add a curated photo override (required for teaching)

Edit the `overrides` block of **`src/data/species-images.json`** with a vetted,
single-specimen, alive, lateral photo (CC-licensed, attributed). This is the
photo diagnostic marks attach to and the first gallery image.

```jsonc
"Genus species": [
  { "url": "...", "sourceUrl": "...", "attribution": "© Author",
    "license": "CC-BY-NC", "ordering": 1 }
]
```

Use the Gemini image tool to pick the best candidate:
`npm run images:assess -- --species "Genus species"` (read-only; ranks cached
rows and recommends one to pin). Free tier ~20 req/day.

## 4. Make the test green

```bash
npm test -- src/lib/idguide/catalogue.test.ts
```

This strict-parses the catalogue and checks the alias + override cross-files. Fix
whatever it reports. Then run the full gate before pushing:

```bash
npx tsc --noEmit && npm test && npm run lint && npm run lint:tokens
```

## 5. Populate photos + marks (DB side, needs `.env.local`)

**Before running:** add the species' diagnostic-mark draft (label + description
per feature, grounded in its `fieldNote` + the UK guides) to
**`scripts/data/p2-mark-drafts.ts`**. Without it the species onboards with photos
but **no ID rings** — this is exactly the gap that left whiting with reference
photos and no circles. The draft is what makes the marks step auto-author.

Then run the single onboarding command — it chains every per-species data step
(refresh photos → Gemini-vet gallery + hero → Gemini-place the mark rings from
your draft → backfill provenance → sync aliases):

```bash
npm run db:onboard-species -- --species "Genus species"
# --skip-gallery to skip the quota-heavy Gemini gallery pass
# --dry-run to print the plan; --continue to keep going past a failed step
```

Needs `GEMINI_API_KEY` for the gallery + marks steps (free tier ~20 req/day, so
do one species at a time). The placed rings are **DRAFTS pending expert
sign-off** — review them in **`/admin/species/Genus%20species`** (admin = a
`@pebl-cic.co.uk` login): click to add/move/relabel rings on the curated photo.
A species counts as "published" by the wizard once it has ≥1 mark.

> Running the steps by hand instead? `db:refresh-images -- --species "X"`,
> `db:build-galleries -- --species "X"`, then
> `place-diagnostic-marks.ts --mode author --species "X" --apply`,
> `db:enrich-image-meta`, `db:seed-aliases`. The onboard command just runs these
> in order.

## 6. If it's a new shape class

A brand-new `shapeClass` (rare) also needs: the value in `SHAPE_CLASS`
(`traits.ts`), a gate tile + silhouette in `ShapeGate.tsx` / `public/silhouettes/`,
and a `SUB_SPLITS` entry in `idflow/body-forms.ts` if it should sub-split. The
`ShapeClass` union drives exhaustive `Record`s, so `tsc` will list everywhere
that needs updating — follow the compiler.
