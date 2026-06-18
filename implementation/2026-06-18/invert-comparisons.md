# Invertebrate "tell them apart" comparisons (18 Jun 2026)

Completes the side-by-side compare feature across the whole catalogue. Six invert
groups added, one per multi-member Rung-3 candidate set (the invert "form"
sub-splits). Single-member forms (spider crab, hermit crab, cuttlefish, bobtail,
the four starfish forms, limpet, flat top shell, lion's mane, barrel jelly)
correctly get no compare. Cues from a 4-agent literature sweep cross-checked vs
MarLIN, the Wildlife Trusts, the Cefas cephalopod guide, the Merryweather crab
guide and Devon Wildlife Trust; every cue is video-visible.

Total: 13 comparison groups, 49 members (flatfish + 6 fish + 6 invert).

## Broad oval crabs: edible vs shore
- Edible crab: smooth reddish-brown shell, crimped "pie-crust" edge, black-tipped claws.
- Shore crab: smaller, sawn/toothed shell edge, often glossy green, no black tips.
- Caveat: tooth-counting is unreliable on a clip; judge the edge shape + claw tips.
- Sources: MarLIN, Wildlife Trusts, Merryweather crab guide.

## Swimming crabs: velvet vs harbour
- Velvet: bright RED eyes on a furry velvety shell, blue leg lines.
- Harbour: paler smoother sandy shell, NO red eyes, violet-tinged back paddle.
- Sources: MarLIN, Wildlife Trusts, Merryweather.

## Squid: veined vs European (honest non-split)
- Both are torpedo Loligo squid; the only reliable separator (tentacle-club sucker
  sizes) needs the arms in the hand, so the honest call is "a Loligo squid".
- Soft leanings only: veined leans larger/northern/longer-finned; European smaller/southern.
- Sources: Cefas/NMBAQC cephalopod guide, MarLIN.

## Octopus: curled vs common (separable)
- Curled (Eledone): SINGLE row of suckers per arm, warty orange-brown, smaller. The
  one you actually get in UK waters.
- Common (Octopus vulgaris): DOUBLE row of suckers, smoother grey, much larger; a
  rare southern stray (most "common octopus" sightings here are really curled).
- Sources: Cefas/NMBAQC, MarLIN, Glaucus/BMLSS.

## Pointed-cone shells: dog whelk vs painted top shell
- Dog whelk: rough, ridged, stubby shell, short blunt spire, among barnacles; colour
  hugely variable (go by texture/shape, not colour).
- Painted top shell: smooth glossy straight-sided cone, sharp apex, pink/purple streaks.
- Sources: MarLIN, Devon Wildlife Trust, Wildlife Trusts.

## Saucer jellyfish: moon, compass, blue, mauve stinger
- Moon: four pale horseshoe rings through a clear bell; short tentacle fringe only.
- Compass: 16 brown V-marks radiating like a compass; long tentacles + frilly arms.
- Blue: bluish-purple bell over a dense tentacle mass; no brown V-marks.
- Mauve stinger: small mauve bell stippled with warty stinging spots; glows at night.
- Caveat: a pale young blue jelly is hard to tell from a young lion's mane (blue/purple
  tint leans blue; warm red/orange + bigger leans lion's mane).
- Sources: MarLIN, Marine Conservation Society, Wildlife Trusts.

## Starfish (class-level, surfaced at Rung-2)
Starfish are the one shape class where every arm-form is a single species
(cushion / spiny / common / brittlestar), so the four never meet in one Rung-3
candidate set. The starfish group is therefore CLASS-LEVEL (`shapeClass:
"starfish"`): `comparisonGroupForShapeClass` surfaces a "Compare side by side"
button at the Rung-2 arm-form gate (`BodyShapeGate`), and tapping a starfish in
the compare commits it directly (FeedCard wires `onPickSpecies` to the same
submit path the Rung-3 grid uses). The Rung-3 matcher deliberately skips
class-level groups. The arm-form silhouette tiles are untouched; the compare is
additive.
- Common starfish: orange, five tapering arms, a low knobbly line of pale spines.
- Spiny starfish: greyish, long arms with three rows of white blue-based spines.
- Cushion star: small, puffy, five short fat arms (a five-pointed cushion).
- Common brittlestar: a small spiny disc trailing five long thread-thin arms that snap off.
- Sources: MarLIN, Devon Wildlife Trust, Wildlife Trusts.

## Verified
tsc 0, lint + lint:tokens clean, 0 em/en dashes (new code), comparisons.test.ts
(every member is a real catalogue species with a matching common name) + full
suite 341/341. Driven live in the dev preview: the saucer-jellyfish compare opens
with all four (moon-rings + compass-V cues, lion's-mane caveat, swipe hint,
horizontal scroll), and the starfish "Compare side by side" surfaces at the Rung-2
arm-form gate and opens the four-starfish view with its cues.

Total: 14 comparison groups, 53 members. The compare feature now covers every
confusable set in the catalogue, at the rung where the confusion actually lives.
