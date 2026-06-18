# Side-by-side "tell them apart" comparison (18 Jun 2026)

A literature-grounded compare view for genuine look-alikes, wired first for the
three right-eyed flatfish (the classic UK mix-up). Opened from the Rung-3
candidate gate via a "Compare side by side" button; lines the look-alikes up with
the ONE cue that separates each.

## Why

All three flatfish change colour to match the seabed, so colour alone never
decides it. A single-photo tile grid does not teach the difference; a side-by-side
with the diagnostic cue under each does.

## Diagnostics (cross-checked across sources)

The three killer, video-visible cues:

| Species | The one cue | Supporting |
|---|---|---|
| **Plaice** (*Pleuronectes platessa*) | Bold, bright orange spots on smooth skin | A row of bony knobs between the eyes to the gill cover (bigger fish); lateral line only gently curved |
| **Dab** (*Limanda limanda*) | Lateral line arches in a high half-circle ("D") over the pectoral fin | Rough, sandy-looking skin; pale and mottled, faint spots at most; the smallest of the three |
| **Flounder** (*Platichthys flesus*) | Rough, prickly ridges along the bases of the top and bottom fins | Duller brown with muddy reddish spots; nearly straight lateral line; the estuary one |

**Quickest route:** look at the lateral line over the pectoral fin. A "D" arch =
dab. Nearly straight + bright orange spots + smooth = plaice. Nearly straight +
dull spots + rough fin-edge ridges (often estuarine) = flounder.

**Caveat surfaced to users:** plaice and flounder hybridise, so weigh two or three
cues, not one.

## Sources

All agree on every load-bearing cue:
- **Sussex IFCA Fish ID Guide** (local: `decision-tree/id-guides/sussex-ifca-fish-id.pdf`, pp. 19, 22-24): "plaice topside smooth apart from bony tubercles between eyes"; "flounder rows of short prickles along the fin bases"; "dab lateral line curved above pectoral fin (D for dab)"; the finger-stroke fin-base test (plaice smooth, flounder rough).
- **ZSL estuarine fish guide** (local: `zsl-estuarine-fish.pdf`, pp. 8-9): dab "deeply curved lateral line, toothed scales rough to touch"; flounder "rough tubercles along the edges of the body and the lateral line".
- **MarLIN** species pages (plaice 2172, dab 2174, flounder 1495), **FishBase**, the **Wildlife Trusts** (hybrid note).

## Build

- `src/lib/idflow/comparisons.ts` — generic `COMPARISON_GROUPS` + `comparisonGroupForCandidates()` (offers a group only when all its members are present AND the candidate set is small, so the whole-catalogue path does not surface it). Flatfish group populated; structure ready for more (gadoids, gurnards) later.
- `src/components/idflow/SpeciesComparison.tsx` — portaled modal, 3 self-contained cards side by side (photo + name + killer cue + supporting cue), quickest-check tip, caveat, cited sources. Tap a card to commit. Colour is never the only link between a cue and a photo (owner is colour-blind). WCAG focus contract inline.
- `src/components/idflow/TileGate.tsx` — optional `compare` affordance (outline button below the grid), mirroring `coarse`/`notSure`/`skip`.
- `src/components/idflow/CandidateGate.tsx` — computes the group from the candidates, passes the affordance, renders the comparison.
- `src/lib/idflow/comparisons.test.ts` — guards that every member is a real catalogue species with a matching common name, plus the threshold logic.

## Verified

tsc 0 errors, lint + lint:tokens clean, comparisons.test.ts 5/5. Driven live in
the dev preview: Flatfish gate -> candidate grid shows the 3 flatfish + "Compare
side by side" -> the modal opens with all cues, the quickest-check tip, sources,
caveat, and the 3 curated lead photos, laid out as 3 equal columns (sideBySide
confirmed, modal fits the viewport, no errors from the new code).
