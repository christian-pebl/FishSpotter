# Grey gurnard (Eutrigla gurnardus) — onboarding DRAFT

Staged 10 Jun 2026 (remote). NOT yet applied: adding a species touches the live
catalogue/gate AND `catalogue.test.ts` requires a curated photo + alias + (for
"published") diagnostic marks, so onboarding must land atomically with your
sign-off. Everything below is ready to apply at the computer.

## 1. Curated reference photo (Gemini-vetted, score 82 "ideal")
The image-quality tool pulled 18 fresh iNat candidates and rejected every
dead/beachcast/in-hand one; the best living lateral specimen:

Add to `src/data/species-images.json` `overrides`:
```json
"Eutrigla gurnardus": [
  {
    "url": "https://inaturalist-open-data.s3.amazonaws.com/photos/520642874/medium.jpg",
    "attribution": "(c) Xavier Rufray, some rights reserved (CC BY-NC)",
    "sourceUrl": "https://www.inaturalist.org/observations/289463146",
    "license": "cc-by-nc"
  }
]
```
Runner-ups if you want gallery depth (all USABLE, living): iNat photos
280337377 (cc-by-nc, lateral line + pectoral rays), 538572826 (cc-by-nc, oblique
on sand), 344347060 (cc-by).

## 2. Trait entry DRAFT for `src/data/species-traits.json`
Values marked (verify) must be checked against the `as const` enums in
`src/lib/idguide/traits.ts` — `catalogue.test.ts` will reject anything invalid.

- commonName: "Grey gurnard"
- shapeClass: "fish"
- **bodyShape: ["bottom-scooter", "elongated"]  ← YOUR CALL.** Grey gurnard is a
  seabed "walker" (perch-and-step on free pectoral rays), the same ecology you
  used to justify grouping gobies + dragonets as "bottom scooters". It's larger
  than those, so confirm whether it belongs in that bucket or just "elongated".
- size: "medium"  (typically ~30 cm, to ~45 cm)
- bodyDepth: "slender" (verify)
- lateralLine: "pale-straight" (verify) — whitish, lined with small white spots
- coloration: greyish-brown above, paler below (map to existing enum value)
- markings: "spots" + a conspicuous **dark blotch on the FIRST DORSAL fin**
  (diagnostic for grey gurnard). There may be no "dorsal-spot" markings value —
  if not, this is a candidate new enum value (verify).
- finShape: large fan-shaped pectoral fins (map to existing value, verify)
- **features: free finger-like lower pectoral rays used to "walk"/taste the
  seabed — THE diagnostic.** Likely needs a NEW feature enum value
  (e.g. "free-pectoral-rays"); none of the current fish feature values
  (caudal-spot / finlets / pelvic-sucker / lateral-scutes) fit.
- behavior: rests and "walks" on the seabed on its free pectoral rays; can grunt.
- habitat: sandy / gravel / muddy seabed, shallows to ~150 m.
- movement: bottom-associated (perch-and-step).
- fieldNote (prose, draft): "Elongated, armour-headed seabed fish that 'walks'
  on three free finger-like pectoral rays. Greyish-brown with small white spots
  and a white-spotted lateral line; a dark blotch on the first dorsal fin is the
  giveaway. Large fan-shaped pectoral fins flare when it moves."

## 3. Alias DRAFT for `src/data/species-aliases.json`
```json
"Eutrigla gurnardus": {
  "commonName": "Grey gurnard",
  "aliases": ["grey gurnard", "gray gurnard", "gurnard", "grey gurnet"]
}
```
(NB "gurnard" alone also covers tub/red/streaked — fine as a coarse alias while
grey is the only gurnard in the catalogue; revisit if more gurnards are added.)

## 4. Diagnostic marks DRAFT (3 rings, for sign-off)
On the curated photo above:
1. **Free pectoral rays** — the finger-like lower rays it walks on (primary).
2. **Dark first-dorsal blotch** — the grey-gurnard giveaway.
3. **Armoured, spiny head + white-spotted lateral line.**
Place via the usual flow (`place-diagnostic-marks.ts` author mode or the admin
annotator), then render-verify on-animal.

## 5. Apply runbook (atomic, at the computer)
1. Add the override (§1) + the alias (§3).
2. Decide the bodyShape bucket + any new enum values (§2); extend
   `src/lib/idguide/traits.ts` enums first if adding `free-pectoral-rays` /
   `dorsal-spot`.
3. Add the trait entry (§2) to `species-traits.json`.
4. `npx tsx --env-file=.env.local scripts/... db:refresh-images --species "Eutrigla gurnardus"`
   to cache the curated photo (+ gallery via `build-species-galleries.ts`).
5. `npm run db:seed-aliases` to push the alias to the DB.
6. Author the 3 marks (§4), render-verify.
7. `npm test` (catalogue.test must pass: photo + alias + valid enums) + `npm run lint:tokens`.
