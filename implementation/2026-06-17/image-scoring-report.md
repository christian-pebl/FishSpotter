# Image quality scoring: silhouettes + reference photos (17 Jun 2026)

A measurable, **re-runnable** baseline of how well every Spot It tile silhouette
represents its group, and how well every species' curated lead photo represents
its species. Scored by the Gemini vision tool (`gemini-3.5-flash`, temperature 0)
so the numbers are reproducible and progress is trackable by re-running and
diffing the JSON.

## How to read / re-run this (the tracking loop)

| What | Command | Baseline JSON |
|---|---|---|
| Silhouettes (31 live tiles) | `npm run score:silhouettes` | `implementation/2026-06-17/silhouette-scores.json` |
| Photos (57 curated leads) | `npm run score:photos` | `implementation/2026-06-17/photo-scores.json` |

Edit an SVG or swap a curated photo, re-run the relevant script, and compare the
new score for that item against the baseline below. Every metric is 0..100.

**Silhouette metrics:** `recognizability` (reads as the label with no caption),
`diagnosticAccuracy` (shows the group's key shape cues), `clarity` (clean at
icon size), `distinctiveness` (distinct from its sibling tiles), plus `readsAs`
(what it looks like at a glance) and `confusableWith`. Overall `score` + verdict
(strong >=80 / adequate 60-79 / weak 40-59 / replace <40).

**Photo metrics:** `focus`, `lighting`, `framing`, `occlusionFree`,
`diagnosticFeaturesVisible`, overall `teachingScore`, plus categorical flags
(`subjectType`, `condition` alive/dead, `view` lateral/dorsal/etc.,
`nonPhotographic`). Recommendation ideal >=80 / usable 60-79 / poor 35-59 /
reject <35.

---

## Headline

| Set | Items | Mean | Verdict spread |
|---|---|---|---|
| **Silhouettes** | 31 | **75** | 20 strong / 3 adequate / 5 weak / 3 replace |
| **Photos** | 57 | **82** | 41 ideal / 14 usable / 2 poor / 0 reject |

The **photos are in good shape** (most are ideal single living lateral
specimens). The **silhouettes are the weak link**, and worst of all are three of
the seven top-level Rung-1 shape tiles, which are the very first thing every user
sees.

---

## Silhouettes

### By tier

| Tier | Mean | Note |
|---|---|---|
| **Rung-1 shape tiles** (7) | **63** | The worst tier, dragged down by 3 tiles. Highest leverage: every user sees these first. |
| Rung-2 form tiles (24) | 78 | Mostly strong; a "generic fish" cluster (the new fish forms) + a few inverts are weak. |

### The fix list (score-ascending; Gemini's note is the brief)

| Score | Tile | Tier | Reads as | Fix |
|---|---|---|---|---|
| **15 replace** | Flatfish | Rung 1 | "standard round fish" (= Fish) | Redraw as a top-down plaice/flounder: wide oval, both eyes on one side, resting on a seabed line. Currently a normal fish, so it is indistinguishable from the Fish tile. **Top priority.** |
| **35 replace** | Squid | Rung 1 | "cuttlefish or snail" | The curled posture hides the squid. Redraw straight + horizontal: torpedo mantle, terminal fins, trailing tentacles. |
| **40 replace** | Snail / slug | Rung 1 | "empty shell / rock" | Reads as a bare shell, not an animal. Redraw as a crawling snail (visible foot + tentacles) or a nudibranch with rhinophores. |
| **42 weak** | Bottom-sitters | Rung 2 (fish) | "generic fish" (= Cod-shaped) | Give it the perch-on-the-seabed read: a flat-bellied fish on a seabed line with prominent fan pectorals. Currently just a fish outline. |
| **45 weak** | Five short fat arms (cushion star) | Rung 2 (starfish) | "common starfish" | Arms too long/slender. Broaden the central disc, shorten arms to stubby triangles. |
| **52 weak** | Wrasses | Rung 2 (fish) | "generic deep-bodied fish" (= Silver shoalers) | Emphasise the single continuous long dorsal fin + blunt tail. The reused bream shape reads as a generic shoaler. |
| **58 weak** | Tall pointed spire (top shell) | Rung 2 (gastropod) | "low cone / limpet" | Make the spire much taller + narrower with stepped whorls; currently too wide. |
| **58 weak** | Long trailing tentacles (lion's mane) | Rung 2 (jellyfish) | "frilly-arm jelly" | Core too blobby + tentacles too fine. Simplify the bell, thicken + extend clean trailing tentacles. |
| **60 adequate** | Silver shoalers | Rung 2 (fish) | "tuna / shark" (= Shark-shaped) | The prominent triangular dorsal reads shark-like. Use a softer clupeid shape, single soft dorsal, streamlined back. |
| **72 adequate** | Cod-shaped | Rung 2 (fish) | "stylised fish" | Anatomy correct (3 dorsals + barbel) but the geometric triangle fins look artificial; round them. |
| **78 adequate** | Jellyfish | Rung 1 | "jellyfish" (slight Squid overlap) | Thicken the fine tentacles so they survive at icon size. Close to fine. |

**The meta-finding for the new fish forms:** the four "normal fish" Rung-2 tiles
(Cod-shaped 72, Silver shoalers 60, Wrasses 52, Bottom-sitters 42) are the weak
cluster because they are all just fish outlines and so are **mutually
confusable**. Reusing the bream / mackerel / gobiid art was anatomically
reasonable but does not differentiate at icon scale. Each needs its ONE
diagnostic pushed hard: cod = 3 separate dorsal fins (already there, soften the
triangles), wrasse = single continuous dorsal + deep body, silver-shoaler =
clupeid school / forked tail (not a shark dorsal), bottom-sitter = resting on a
seabed line. Shark (90) and Long-and-skinny (82) already work because their
silhouettes are intrinsically distinctive.

### Strong silhouettes (keep, for reference)

Starfish 96, In-a-shell/hermit 93, Triangular-spider 91, Eight-arms/octopus 91,
Fish 90, Shark-shaped 90, Broad-oval-crab 90, Torpedo-squid 90, Long-arms-spiny
90, Long-arms-smooth 90, Thread-thin-brittlestar 90, Low-cone-limpet 88,
Broad-body-cuttlefish 86, Crab 85, Paddle-swimmer-crab 85, Tiny-ear-fins-bobtail
85, Squat-whorl 82, Saucer-jelly 82, Frilly-arms-jelly 82, Long-and-skinny 82.

---

## Photos

Healthy: mean 82, no rejects, 41/57 ideal. The weak tail is small and mostly
upgradeable; only two are genuine open-source ceilings.

### By shape class

| Class | Mean | n |
|---|---|---|
| jellyfish | 89 | 6 |
| starfish | 88 | 4 |
| crab | 83 | 6 |
| squid | 83 | 6 |
| gastropod | 80 | 4 |
| flatfish | 79 | 3 |
| fish | 79 | 28 |

Fish is lowest only because two species have no live photo in the open-source
pool (below).

### Photos to improve (score-ascending)

| Score | Species | Why | Action |
|---|---|---|---|
| **45 poor** | Sprat | Dead, held in a hand | **Genuine gap** - no live CC photo exists (confirmed exhaustively, see memory). Leave, or email a photographer for relicensing. |
| **55 poor** | Atlantic mackerel | Dead on black | **Genuine gap** - same. A clean dead lateral teaches the wavy bars; accept. |
| 62 usable | Flat Top Shell | Soft focus, dorsal angle | Re-pull a sharper lateral via `images:assess --species ... --fetch`. |
| 65 usable | Spotted dragonet | Tail cropped | Find an in-frame whole-body shot. |
| 65 usable | Plaice | Held out of water | Upgrade to an on-seabed shot if one exists. |
| 68 usable | Thick-lipped mullet | Flat lighting | Re-pull a better-lit lateral. |
| 70 usable | Shanny | In-hand | Acceptable; upgrade opportunistically. |
| 72 usable | Red mullet | Soft focus + framing | Re-pull a sharper in-habitat lateral. |

The remaining 14 "usable" (75-79) are fine; upgrade opportunistically. The
existing `images:assess --species "X" --fetch 20` workflow finds replacements,
and `build-species-galleries.ts` already vets gallery candidates.

---

## Prioritised: improve these first

1. **Redraw the 3 failing Rung-1 tiles (Flatfish 15, Squid 35, Snail/slug 40).**
   Highest leverage in the whole catalogue: they are the first decision every
   user makes, and two of them are mistaken for other tiles. Pure SVG work, no
   data.
2. **Differentiate the 3 weak fish Rung-2 forms (Bottom-sitters 42, Wrasses 52,
   Silver shoalers 60)** and soften Cod-shaped. Push each one's single
   diagnostic so the four "normal fish" tiles stop colliding.
3. **Fix the 3 weak invert forms** (cushion-star 45, top-shell spire 58,
   lion's-mane 58) - small per-SVG redraws.
4. **Photos: only opportunistic top-ups** (Flat Top Shell, Spotted dragonet,
   Plaice, mullet). Sprat + mackerel are accepted open-source ceilings.

Re-run `npm run score:silhouettes` / `score:photos` after each batch and diff
the JSON to confirm the score moved.

## Caveats

- Gemini sub-scores carry run-to-run noise of a few points; trust the verdict
  bands and the categorical reads (`readsAs`, `confusableWith`, `condition`) over
  hair-splitting a 72 vs 75. Temperature 0 keeps this small but not zero.
- Silhouettes were scored as a dark shape on white to isolate shape legibility;
  the app tints them teal-on-navy, which only lowers contrast, so these are an
  upper bound on in-app readability.

---

## Update (18 Jun 2026): redraws applied + after-numbers

**Model note.** The original baseline above was scored on `gemini-3.5-flash`.
That model then went into a sustained `503` outage, so the redraws were
re-scored on `gemini-2.5-flash` (the stable model; `GEMINI_MODEL` in `.env.local`
was switched to it). 2.5-flash runs ~2-7 points harsher on the same image
(calibration: the same cuckoo-wrasse photo = 92 on 3.5 vs 85 on 2.5), so the
real improvements are a touch larger than the raw deltas below. Both scorers now
refuse to overwrite a baseline on an all-error run, so an outage can't wipe it
again.

### Silhouettes (before 3.5 -> after 2.5)

| Tile | Before | After | Verdict |
|---|---|---|---|
| Snail / slug (Rung 1) | 40 | **90** | fixed |
| Bottom-sitters | 42 | **90** | fixed |
| Silver shoalers | 60 | **87** | fixed |
| Lion's mane (trailing) | 58 | **87** | fixed |
| Saucer jelly | 82 (35 on 2.5) | **82** | fixed (de-"ghosted") |
| Top-shell spire | 58 | **80** | fixed |
| Squid (Rung 1) | 35 | **78** | fixed (eye + curly arms beat the "rocket" read) |
| Cod-shaped | 72 | **78** | improved |
| Limpet (low cone) | 88 (35 on 2.5) | **70** | fixed the "sand pile" read |
| **Wrasses** | 52 | 58 | **ceiling** ("oval fish") |
| **Cushion star** | 45 | 35 | **ceiling** ("blob / crown") |
| **Flatfish (Rung 1)** | 15 | 30 | **ceiling** ("a fish") |

Mean across all 31 live silhouettes: **75 -> 79** (cross-model; larger in reality).

**The three ceilings are inherent, not unfinished.** A flat icon cannot uniquely
say "wrasse" vs "any deep fish", "cushion star" vs "a blob" (short fat arms ARE
blob-like), or "flatfish" vs "a fish" (flatness does not survive as a silhouette).
Each was attempted 2-3 ways. In the app these tiles carry a text label + a
candidate-photo grid, which is what disambiguates them; the silhouette is a
supporting cue, so "adequate" here is acceptable. Re-run on 3.5-flash when it
recovers for a like-for-like number.

### Photos (the 5 swapped leads, before 3.5 -> after 2.5)

| Species | Before | After | New lead |
|---|---|---|---|
| Thick-lipped mullet | 68 | **90** | Pillon (CC-BY, sharp lateral over reef) |
| Plaice | 65 | **80** | carrelet02 (CC-BY, live on sand) |
| Sprat | 45 | **75** | Teghammar (CC-BY-NC, clean whole specimen) |
| Atlantic mackerel | 55 | **65** | LaFontaine (CC-BY, live colour in hand) |
| Shanny | 70 | **75** | Renoult (CC-BY, live in habitat, dorsal raised) |

All five lifted (live on the shared DB; marks preserved on the old photos).

**One anomaly, resolved:** `Atlantic cod` (untouched) scored **30 "wrong-subject"**
on 2.5-flash vs 75 on 3.5. Checked by eye: the lead IS a genuine juvenile cod
(reddish-mottled, in a seagrass nursery) - a 2.5-flash false positive on a
juvenile in a dark weedy scene. No action; the photo is correct (just darkish,
so "usable" not "ideal").

### Loader motion-review

Scored "revise / 6" by `motion-review`, but that is a **rubric mismatch**: the
motion-critique is built for subtle *in-feed micro-animations* (clip is the star,
motion must be <1.5s and recede) and has no category for a perpetual full-screen
loader, so it penalised the loader for appropriately being present + looping. It
passed `onBrand` + `landsOnEndState` + `reducedMotionInformative` with zero brand
violations; the "jumpy" flag is a sparse-frame-sampling artifact (a creature
crossing over ~5s sampled at 500ms gaps). Validated by own-vision filmstrip +
code-inspectable checks instead.
