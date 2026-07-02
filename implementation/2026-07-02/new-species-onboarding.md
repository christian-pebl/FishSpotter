# New species onboarding — sea urchins + "Other wildlife" (2 Jul 2026)

Two new clips came in (a diving seabird, a sea urchin) and Christian asked for:
1. Sea urchins folded into the existing `starfish` shape class (it's already an
   echinoderm-plus-brittlestar bucket, not just literal stars).
2. A new `wildlife` shape class for non-fish/invert sightings, seeded with the
   most common UK diving seabirds + seals.

Both scaled up per Christian's steer to "pick the top 4 most common" (urchins,
seabirds) and "top 4, but realistically just grey + harbour" (seals) — so 10
species total.

## What's shipped already (this branch)

All of this is live, tested (`npm test` / `npx tsc --noEmit` / `npm run lint` /
`npm run lint:tokens` all green) and needs no further action:

- `wildlife` added to `SHAPE_CLASS` (`src/lib/idguide/traits.ts`), with a new
  `WILDLIFE_FORM` vocabulary (`diving-bird` / `pinniped`).
- Two new `ARM_FORM` values on the existing `starfish` class: `round-spiny`
  (regular urchins) and `heart-shaped` (heart urchin / sea potato). The Rung-2
  prompt broadened from "What were the arms like?" to "What did the body look
  like?" to cover both.
- Schema (`catalogue.ts`), narrowing engine (`narrow.ts`), question copy
  (`trait-questions.ts`), the `starfish` Rung-2 tile relabelled "Starfish &
  urchin", a new "Other wildlife" gate tile + hand-drawn CC0 silhouettes
  (`public/silhouettes/wildlife.svg` + 4 new `forms/*.svg`), group guides
  (`shape-class-guides.ts`), and the coarse-reference resolver
  (`shape-class-ref.ts`) all updated.
- `scripts/data/p2-mark-drafts.ts` already has diagnostic-mark drafts (label +
  description, no coordinates) for all 10 species below — ready for
  `place-diagnostic-marks.ts --mode author` the moment each species has a
  curated photo.

## What's NOT done, and why

`species-traits.json` needs a real curated photo URL in
`species-images.json.overrides` for every entry (enforced by
`catalogue.test.ts`), and the photo pipeline (`db:refresh-images` → iNaturalist,
`images:assess`/`build-species-galleries` → Gemini vision) needs internet
egress + `GEMINI_API_KEY` + the Postgres connection. **This sandbox session had
none of the three** (confirmed: `api.inaturalist.org` returns a 403 from the
egress proxy, there's no `.env.local`, and `prisma generate` itself can't reach
its engine-binary host). Rather than fabricate photo URLs (which would ship
broken images + fake attribution) or add species without them (which fails
`catalogue.test.ts` in CI), the 10 species are staged below, ready to paste in
verbatim once real photos are sourced somewhere with the right access.

Two pieces of code are staged rather than committed for the same reason
(they reference these not-yet-catalogued species, and their own tests —
`body-forms.test.ts` and `comparisons.test.ts` — correctly refuse to let a
sub-split or comparison group reference a species that doesn't exist yet):
the `wildlife` entry for `SUB_SPLITS` in `src/lib/idflow/body-forms.ts`, and
three `comparisons.ts` groups (sea urchins, diving seabirds, seals).

## Finishing the onboarding (needs `.env.local` + `GEMINI_API_KEY` + internet)

Per species, following `docs/runbooks/add-a-species.md`:

```bash
# 1. Photos — pulls candidates from iNaturalist into the SpeciesImage cache
npx tsx --env-file=.env.local scripts/refresh-images.ts --species "Echinus esculentus"
# ...repeat for each of the 10 (see the manifest entries below — add them to
# src/data/species-images.json `species` block first so the fetch knows which
# life-stage/sex buckets to pull; a plain {count:4} default also works)

# 2. Pick + pin the best photo per species (Gemini-vetted)
npm run images:assess -- --species "Echinus esculentus"
# Pin the recommended one into species-images.json `overrides` (see
# add-a-species.md step 3 for the exact shape), OR run the gallery builder to
# do the whole gallery + curated pick in one pass:
npx tsx --env-file=.env.local scripts/build-species-galleries.ts --species "Echinus esculentus"

# 3. Paste the species-traits.json + species-aliases.json entries below in,
#    verbatim, for all 10 species at once.

# 4. Confirm the catalogue gate is green
npm test -- src/lib/idguide/catalogue.test.ts

# 5. Author the diagnostic-mark rings (drafts already in p2-mark-drafts.ts)
npx tsx --env-file=.env.local scripts/place-diagnostic-marks.ts --mode author --species "Echinus esculentus" --apply
# ...repeat per species, or use db:onboard-species to chain 1+2+5 (skip step 2
# manual pin if using the gallery builder):
npm run db:onboard-species -- --species "Echinus esculentus"

# 6. Paste the SUB_SPLITS.wildlife entry back into body-forms.ts, and the
#    three comparison groups back into comparisons.ts (both below).

# 7. Full gate before pushing
npx tsc --noEmit && npm test && npm run lint && npm run lint:tokens
```

Do all 10 species before re-adding `SUB_SPLITS.wildlife` / the wildlife
comparison groups — `body-forms.test.ts` requires every `SUB_SPLITS` key to
already resolve to >=2 species with real photos, so re-adding it with only,
say, the seals done would fail CI until the birds are in too.

---

## Species list (10)

| Scientific name | Common name | Class | Form |
|---|---|---|---|
| *Echinus esculentus* | Common Sea Urchin | starfish | round-spiny |
| *Psammechinus miliaris* | Green Sea Urchin | starfish | round-spiny |
| *Paracentrotus lividus* | Purple Sea Urchin | starfish | round-spiny |
| *Echinocardium cordatum* | Sea Potato | starfish | heart-shaped |
| *Phalacrocorax aristotelis* | European Shag | wildlife | diving-bird |
| *Phalacrocorax carbo* | Great Cormorant | wildlife | diving-bird |
| *Uria aalge* | Common Guillemot | wildlife | diving-bird |
| *Alca torda* | Razorbill | wildlife | diving-bird |
| *Halichoerus grypus* | Grey Seal | wildlife | pinniped |
| *Phoca vitulina* | Harbour Seal | wildlife | pinniped |

## `species-traits.json` entries (paste verbatim)

```jsonc
"Echinus esculentus": {
  "commonName": "Common Sea Urchin",
  "shapeClass": "starfish",
  "bodyShape": [],
  "size": "medium",
  "coloration": ["uniform"],
  "markings": ["none"],
  "finShape": [],
  "features": ["none"],
  "behavior": ["on-bottom"],
  "habitat": ["rocky-crevice"],
  "movement": ["crawl"],
  "armForm": ["round-spiny"],
  "fieldNote": "The biggest of the UK's regular sea urchins: a large pinkish-red ball densely covered in short spines, grazing rock and kelp forest from the lower shore into the shallow subtidal."
},
"Psammechinus miliaris": {
  "commonName": "Green Sea Urchin",
  "shapeClass": "starfish",
  "bodyShape": [],
  "size": "small",
  "coloration": ["uniform"],
  "markings": ["none"],
  "finShape": [],
  "features": ["none"],
  "behavior": ["on-bottom"],
  "habitat": ["rocky-crevice"],
  "movement": ["crawl"],
  "armForm": ["round-spiny"],
  "fieldNote": "A small, bright green ball with violet-purple spine tips, often decorated with bits of shell or weed wedged between the spines for camouflage. Common in rock pools and shallow kelp."
},
"Paracentrotus lividus": {
  "commonName": "Purple Sea Urchin",
  "shapeClass": "starfish",
  "bodyShape": [],
  "size": "small",
  "coloration": ["uniform"],
  "markings": ["none"],
  "finShape": [],
  "features": ["none"],
  "behavior": ["on-bottom"],
  "habitat": ["rocky-crevice"],
  "movement": ["crawl"],
  "armForm": ["round-spiny"],
  "fieldNote": "A deep purple-brown ball with noticeably longer spines than the green sea urchin, often bedded into a self-excavated hollow in rock. A south-western/rocky-shore specialist."
},
"Echinocardium cordatum": {
  "commonName": "Sea Potato",
  "shapeClass": "starfish",
  "bodyShape": [],
  "size": "small",
  "coloration": ["uniform"],
  "markings": ["none"],
  "finShape": [],
  "features": ["none"],
  "behavior": ["burrowing"],
  "habitat": ["sandy-bottom"],
  "movement": ["stationary"],
  "armForm": ["heart-shaped"],
  "fieldNote": "An oval, heart-shaped urchin covered in a fine fur of short spines, living buried in sand. Usually seen as the pale, fragile empty test washed up or lying on the seabed rather than the live burrowing animal."
},
"Phalacrocorax aristotelis": {
  "commonName": "European Shag",
  "shapeClass": "wildlife",
  "bodyShape": [],
  "size": "large",
  "coloration": ["uniform"],
  "markings": ["none"],
  "finShape": [],
  "features": ["none"],
  "behavior": ["solitary", "fast-swim"],
  "habitat": ["near-surface", "open-water"],
  "movement": ["water-column"],
  "wildlifeForm": ["diving-bird"],
  "fieldNote": "All-dark glossy black-green with a slim hooked bill and no white patches; a small forward-curling crest appears in the breeding season. An agile, fast underwater hunter, usually solitary."
},
"Phalacrocorax carbo": {
  "commonName": "Great Cormorant",
  "shapeClass": "wildlife",
  "bodyShape": [],
  "size": "large",
  "coloration": ["mottled"],
  "markings": ["none"],
  "finShape": [],
  "features": ["none"],
  "behavior": ["solitary", "fast-swim"],
  "habitat": ["near-surface", "open-water"],
  "movement": ["water-column"],
  "wildlifeForm": ["diving-bird"],
  "fieldNote": "Larger than a shag, with a yellow-orange patch of bare skin at the base of the bill and a white cheek/throat patch. Often seen surfacing and perching with wings held open to dry."
},
"Uria aalge": {
  "commonName": "Common Guillemot",
  "shapeClass": "wildlife",
  "bodyShape": [],
  "size": "medium",
  "coloration": ["banded"],
  "markings": ["none"],
  "finShape": [],
  "features": ["none"],
  "behavior": ["schooling", "fast-swim"],
  "habitat": ["near-surface", "open-water"],
  "movement": ["water-column"],
  "wildlifeForm": ["diving-bird"],
  "fieldNote": "A dumpy auk with a long, thin, dagger-like bill and dark brown (not black) upperparts over a white belly. Stands and swims upright, small-penguin-style, usually in dense rafts."
},
"Alca torda": {
  "commonName": "Razorbill",
  "shapeClass": "wildlife",
  "bodyShape": [],
  "size": "medium",
  "coloration": ["banded"],
  "markings": ["none"],
  "finShape": [],
  "features": ["none"],
  "behavior": ["schooling", "fast-swim"],
  "habitat": ["near-surface", "open-water"],
  "movement": ["water-column"],
  "wildlifeForm": ["diving-bird"],
  "fieldNote": "A stocky auk with a thick, blunt bill crossed by a bold white stripe, and glossy black (not brown) upperparts over a white belly. Often rafts alongside guillemots."
},
"Halichoerus grypus": {
  "commonName": "Grey Seal",
  "shapeClass": "wildlife",
  "bodyShape": [],
  "size": "large",
  "coloration": ["mottled"],
  "markings": ["none"],
  "finShape": [],
  "features": ["none"],
  "behavior": ["solitary", "fast-swim"],
  "habitat": ["open-water", "rocky-crevice"],
  "movement": ["water-column"],
  "wildlifeForm": ["pinniped"],
  "fieldNote": "A large, bulky seal with a long, straight \"Roman nose\" profile and widely-spaced parallel nostrils. Blotchy, irregular coat pattern; favours rocky and offshore haul-outs."
},
"Phoca vitulina": {
  "commonName": "Harbour Seal",
  "shapeClass": "wildlife",
  "bodyShape": [],
  "size": "large",
  "coloration": ["mottled"],
  "markings": ["none"],
  "finShape": [],
  "features": ["none"],
  "behavior": ["solitary", "fast-swim"],
  "habitat": ["open-water", "near-surface"],
  "movement": ["water-column"],
  "wildlifeForm": ["pinniped"],
  "fieldNote": "A smaller, daintier seal than the grey, with a short, rounded \"dog-like\" head, V-shaped nostrils, and an evenly-spotted coat. Favours estuaries and sheltered bays."
}
```

## `species-aliases.json` entries (paste verbatim)

```jsonc
"Echinus esculentus": { "commonName": "Common Sea Urchin", "aliases": ["edible sea urchin", "common urchin"] },
"Psammechinus miliaris": { "commonName": "Green Sea Urchin", "aliases": ["shore urchin", "green urchin"] },
"Paracentrotus lividus": { "commonName": "Purple Sea Urchin", "aliases": ["rock urchin", "stony sea urchin"] },
"Echinocardium cordatum": { "commonName": "Sea Potato", "aliases": ["heart urchin", "burrowing heart urchin", "sea potato urchin"] },
"Phalacrocorax aristotelis": { "commonName": "European Shag", "aliases": ["shag"] },
"Phalacrocorax carbo": { "commonName": "Great Cormorant", "aliases": ["cormorant", "great cormorant"] },
"Uria aalge": { "commonName": "Common Guillemot", "aliases": ["guillemot", "common murre"] },
"Alca torda": { "commonName": "Razorbill", "aliases": ["razor-billed auk"] },
"Halichoerus grypus": { "commonName": "Grey Seal", "aliases": ["atlantic grey seal"] },
"Phoca vitulina": { "commonName": "Harbour Seal", "aliases": ["common seal"] }
```

Deliberately no bare "sea urchin" / "seal" / "seabird" aliases — those would
collide across the 4 urchins or 2 seals (add-a-species.md's rule against
generic colliding aliases). The bare shape words already resolve at the shape
level via `shape-class-ref.ts` (`otherwildlife`, `starfishurchin`, etc.).

## `species-images.json` manifest entries (fetch buckets — safe to add now, no
photos required; just tells `refresh-images.ts` what to query for)

```jsonc
"Echinus esculentus": { "buckets": [{ "count": 4 }] },
"Psammechinus miliaris": { "buckets": [{ "count": 4 }] },
"Paracentrotus lividus": { "buckets": [{ "count": 4 }] },
"Echinocardium cordatum": {
  "_note": "Live burrowing shots are rare on iNat; expect mostly washed-up empty tests.",
  "buckets": [{ "count": 4 }]
},
"Phalacrocorax aristotelis": { "buckets": [{ "count": 4 }] },
"Phalacrocorax carbo": { "buckets": [{ "count": 4 }] },
"Uria aalge": { "buckets": [{ "count": 4 }] },
"Alca torda": { "buckets": [{ "count": 4 }] },
"Halichoerus grypus": { "buckets": [{ "count": 4 }] },
"Phoca vitulina": { "buckets": [{ "count": 4 }] }
```

## `body-forms.ts` — paste back into `SUB_SPLITS` once all 4 wildlife species exist

```ts
wildlife: {
  key: "wildlifeForm",
  prompt: "What kind of animal was it?",
  options: [
    { value: "diving-bird", label: "Diving bird" },
    { value: "pinniped", label: "Seal" },
  ],
},
```

## `comparisons.ts` — paste back in once all 10 species exist

```ts
{
  id: "sea-urchins",
  title: "Which round sea urchin?",
  intro:
    "All three sit under the same round-spiny Rung-2 tile and genuinely overlap in shape, so size and spine/body colour are the fastest way to split them.",
  members: [
    {
      scientificName: "Echinus esculentus",
      commonName: "Common Sea Urchin",
      headline: "The biggest of the three: a large pinkish-red ball with short, dense spines.",
      also: "Test (shell) is pale pink-white when cleaned; on rock and kelp forest, lower shore and shallow subtidal.",
    },
    {
      scientificName: "Psammechinus miliaris",
      commonName: "Green Sea Urchin",
      headline: "Small and green, with violet-purple tips to the spines.",
      also: "Often carries bits of shell or weed stuck to its spines for camouflage; common in rock pools and shallow kelp.",
    },
    {
      scientificName: "Paracentrotus lividus",
      commonName: "Purple Sea Urchin",
      headline: "Deep purple-brown, sometimes greenish, with noticeably longer spines than the green urchin.",
      also: "South-western/rocky-shore specialist, often in excavated rock hollows.",
    },
  ],
  tip: "Big and pink-red = common sea urchin. Small, green with purple-tipped spines = green sea urchin. Purple-brown with longer spines, tucked in a rock hollow = purple sea urchin.",
  caveat:
    "Green and purple sea urchins can both look dark in low light on camera; lean on spine length (purple = longer) and any visible camouflage debris (green urchins carry more).",
  sources: [MARLIN, WILDLIFE_TRUSTS],
},

{
  id: "diving-seabirds",
  title: "Which diving seabird?",
  intro:
    "Shag and cormorant swim low with a long neck and hooked bill; guillemot and razorbill are dumpier auks with a shorter neck. Bill shape is the fastest single check.",
  members: [
    {
      scientificName: "Phalacrocorax aristotelis",
      commonName: "European Shag",
      headline: "All dark glossy black-green, slim hooked bill, no white patches.",
      also: "Small forward-curling crest in breeding season; more agile underwater than a cormorant; often solitary.",
    },
    {
      scientificName: "Phalacrocorax carbo",
      commonName: "Great Cormorant",
      headline: "Larger than a shag, with a yellow-orange patch of bare skin at the base of the bill.",
      also: "White cheek/throat patch, white thigh patch when breeding; often seen surfacing with wings held open to dry.",
    },
    {
      scientificName: "Uria aalge",
      commonName: "Common Guillemot",
      headline: "Long, thin, dagger-like pointed bill; dark brown (not black) upperparts.",
      also: "Upright, small-penguin posture; white belly; usually in dense rafts/colonies.",
    },
    {
      scientificName: "Alca torda",
      commonName: "Razorbill",
      headline: "Thick, deep, blunt bill with a bold white vertical stripe across it.",
      also: "Glossy black (not brown) upperparts, white belly, a fine white line from the bill to the eye.",
    },
  ],
  tip: "Long neck, hooked bill, no white on the face = shag (all-dark) or cormorant (yellow face patch + white cheek). Short neck, dumpy auk shape: thin pointed bill = guillemot; thick blunt bill with a white stripe = razorbill.",
  caveat:
    "Juvenile shags and cormorants both look browner than adults, so lean on the bare-skin face patch (cormorant) versus none (shag) rather than overall colour.",
  sources: [WILDLIFE_TRUSTS, MARLIN],
},

{
  id: "seals",
  title: "Grey or harbour seal?",
  intro:
    "Both are torpedo-bodied seals with front and rear flippers. The head profile is the single most reliable video cue.",
  members: [
    {
      scientificName: "Halichoerus grypus",
      commonName: "Grey Seal",
      headline: 'A long, straight "Roman nose" sloping profile, with widely-spaced parallel nostrils.',
      also: "Larger and bulkier; blotchy, irregular coat pattern; often hauls out on rocky/offshore sites.",
    },
    {
      scientificName: "Phoca vitulina",
      commonName: "Harbour Seal",
      headline: 'A short, rounded, "dog-like" head with V-shaped nostrils that meet at the bottom.',
      also: "Smaller and daintier than a grey seal; regular small spots on the coat; favours estuaries and sheltered bays.",
    },
  ],
  tip: "Long straight nose, parallel nostrils, blotchy coat, bulky = grey seal. Short round head, V-shaped nostrils, evenly spotted, daintier = harbour seal.",
  sources: [WILDLIFE_TRUSTS, MARLIN],
},
```

Insert all three right before the class-level `starfish` comparison group
entry (the `COMPARISON_GROUPS` array), so `MARLIN` / `WILDLIFE_TRUSTS` (already
defined as constants earlier in the file) are in scope.
