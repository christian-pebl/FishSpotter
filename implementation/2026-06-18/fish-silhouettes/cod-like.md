# Fish sub-silhouette review: `cod-like` ("Cod-shaped")

**Icon under review:** `public/silhouettes/forms/cod-like.svg`
**Rung:** 2 (fish family-gestalt sub-split, the `fishGroup` trait)
**Tile label:** "Cod-shaped"
**Covers:** Pollack, Saithe, Bib, Whiting, Poor cod, Atlantic cod
**Glance test (from the field guides):** *"Chunky reef-hangers, three separate fins on the back."*
**Current Gemini score:** 78 / "adequate" · readsAs **"Fish with fins"** · note: *"Emphasize the three distinct dorsal fins more clearly."*

> **Status: DRAFT for review.** Nothing in this document has been applied to the live SVG or any app code. The proposed SVG in §5 is a candidate hand-off for a designer, to be re-scored before it replaces the live file.

---

## 0. Rendering constraints (why this is hard)

The tile is **not** a drawing — it is a **flat, single-colour teal mask**. `MaskSilhouette` in `src/components/idflow/TileGate.tsx` paints the SVG via CSS `mask-image` + `background-color: currentColor`. Consequences that drive every decision below:

- **No stroke, no fill colour, no gradient, no internal shading.** Only two things carry information: (a) the **filled outline**, and (b) the **negative space between separate filled paths**. A line drawn *inside* a filled body is invisible — it must be a true gap (hole) or a separate detached shape.
- **It renders small.** Rung-2 list rows show the silhouette in an `h-20 w-20` (80px) box, `maskSize: contain`. The grid variant uses `h-16 w-16` (64px). At 64–80px on a phone, fin detail below ~3px of separation merges into a blob.
- **It is mono-silhouette.** There is no way to "label" the three dorsals except by making them *physically separate filled humps with clear sky between them*. If two humps are <3px apart at render size, they read as one lump = "generic fish".

This is the same technique as `ShapeGate`/`UnderwaterBackdrop`; the icon must survive being reduced to a one-bit alpha mask.

---

## 1. Current read — what the SVG actually depicts

Walking `cod-like.svg` (viewBox `0 0 64 40`, fish faces **left**, head at x≈7, tail at x≈62):

| Path | What it draws | Reads at 64–80px? |
|---|---|---|
| **Body** `M7 21 … Z` | A blunt-fronted ellipse ~44 units long × ~17 tall (depth ≈ 0.39 of length). Reasonable "chunky fish" body. | Yes — reads as a fish body. |
| **3 dorsal fins** `M15… / M25… / M34…` | Three small rounded humps along the top, each only ~6 units wide and ~4–5 units tall, **gaps of ~5 units between them** (15→21, 25→30.5, 34.5→41). | **Marginal.** Humps are shallow (rise only ~4–5px above the back) and the gaps are narrow. At icon size they slur into a "slightly bumpy back," not three discrete fins. This is exactly Gemini's complaint. |
| **2 anal fins** `M26.5… / M34…` | Two tiny rounded nubs under the belly, ~5 units wide, ~4 tall. | Barely. Useful as a *secondary* cue but invisible as "two." |
| **Tail** `M50.5 20 … Z` | A shallow concave-edged caudal — a *soft fork*, fork depth only ~3 units. | Reads as "a tail," fork ambiguous. |
| **Chin barbel** `M9 23.5 … Z` | A small downward nub under the chin, ~2 units. | Essentially invisible at icon size; a nice-to-have at best. |

**Why it scored 78 / "Fish with fins":**
- `clarity 90` — the shape is clean and unambiguously a fish.
- `recognizability 70`, `diagnosticAccuracy 80` — the cod signature (three dorsals) is *present in the geometry* but **under-emphasised**: the humps are too small and too low relative to body depth, so the eye integrates them into the dorsal line.
- `confusableWith: none` was returned, but that is the *optimistic* read; the brief flags the genuine risk: against `wrasse` (one continuous dorsal) and `silver-shoaler` (slim, forked), a generic-fish silhouette with mushy dorsals does not actively *assert* "cod." It passes by not looking like anything else strongly — not by looking like a cod.

**Verdict:** the bones are right (blunt head, three dorsals, two anals, soft fork, barbel — anatomically faithful). The failure is **graphic, not conceptual**: the single load-bearing feature is drawn too timidly to win at 64px.

---

## 2. Diagnostic priorities — the silhouette-only ranking

What a beginner (and Gemini) can actually use to say "cod, **not** wrasse / silver-shoaler," ranked by how much signal survives the flat mask at small size:

| Rank | Feature | Why it's diagnostic | Reads at 64–80px? | Action |
|---|---|---|---|---|
| **1** | **Three separate dorsal fins** with real sky between them | The single feature that separates cod from *every* other fish group. Wrasse = one continuous dorsal; silver-shoaler = one tiny dorsal; sharks = raked triangles. | Only if **exaggerated**: taller humps + wider gaps. | **Make this unmistakable. Bigger, taller, fewer-but-clearer, with deep notches between.** This is the whole job. |
| **2** | **Blunt / rounded head** (chunky front end) | Cod/gadoids have a heavy rounded head; silver-shoalers have a tapered streamlined nose; sharks/wrasse a pointed snout. | Yes — gross body cue, survives small. | Keep blunt; slightly emphasise the round forehead. |
| **3** | **Two separate anal fins** below | Reinforces the "matching mirror of the back" gadoid look; complements the three dorsals. | Marginally — reads as "fins underneath," not "two." | Keep, draw as **two clear separated humps** mirroring the dorsals (echo aids reading). Secondary cue. |
| **4** | **Slightly forked / square tail** (not a deep fork, not a round paddle) | Separates from silver-shoaler's deep fork **and** from wrasse's round paddle — cod tail is shallowly emarginate/squarish. | Partially. | Keep a **shallow** fork — important *contrast* with the two confusables. |
| **5** | **Chin barbel** | Textbook cod give-away (Atlantic cod, bib, poor cod). | **No** — too small to survive the mask at icon size. | Optional/decorative. Do not rely on it. Keep as a tiny nub if it doesn't muddy the chin outline. |
| — | **Body depth** (medium-chunky) | Weakly diagnostic; overlaps wrasse (deep) and shoaler (slim) ranges. | N/A | Use medium depth (~0.4 of length) — chunkier than shoaler, shallower than wrasse. |

**Headline:** priorities 1 is worth more than 2–5 combined. The redraw must spend its "graphic budget" on making the three dorsals scream.

---

## 3. Distinguishability matrix

For each sibling, the **one outline cue** that must keep `cod-like` distinct from it:

| Sibling tile | Its silhouette | The cod-distinct cue to preserve | Risk if we don't |
|---|---|---|---|
| **`wrasse`** ("Wrasses") | Deep oblong, pointed thick-lipped snout, **ONE long continuous dorsal** running the whole back, rounded paddle tail. | **Three *separate* dorsals with sky between** (vs one unbroken ridge) **+ blunt round head** (vs pointed snout) **+ forked tail** (vs round paddle). | **Highest confusion risk.** Both are "normal mid-water fish." A continuous-looking bumpy back = looks like the wrasse. The notches between dorsals are the firewall. |
| **`silver-shoaler`** ("Silver swimmers") | Slim streamlined fish, **deeply forked tail**, drawn as a **shoal of 2**. | **Single fish** (never two) **+ chunkier body + three dorsals + only a *shallow* fork** (vs deep fork). | 2nd-highest risk — both mid-water. Keep cod a lone, bulkier fish with a shallow tail and a triple-humped back. |
| **`bottom-sitter`** ("Gobies & dragonets") | Small fish **perched on a horizontal seabed line**, big fan pectoral. | **No seabed line; mid-water posture; chunky cod body**. | Low risk (the ground line is decisive). Just never add a baseline under the cod. |
| **`bottom-other`** ("Other bottom fish") | Armour-headed gurnard/scorpionfish on a seabed line, **big wing pectoral**. | **No seabed line; no oversized wing pectoral; smooth rounded head**. | Low risk. Avoid big splayed pectorals. |
| **`long-skinny`** ("Long and skinny") | Eel-like, much **longer than deep**. | **Medium body depth (~0.4×length)**, not ribbon-thin. | Low risk if depth ratio stays ~0.4. |
| **`shark`** ("Shark-shaped") | Pointed snout, **raked triangular dorsal**, **asymmetric heterocercal tail**, swept fins. | **Rounded dorsal humps (not raked triangles) + symmetric forked tail + blunt head**. | Low risk — but keep dorsals *rounded humps*, not sharp triangles, so they never read shark-fin. |

**Synthesis:** the redraw is pinned between two opposing failure modes — too-smooth a back ⇒ wrasse; too-deep a tail fork or too-slim a body ⇒ silver-shoaler; too-sharp dorsal triangles ⇒ shark. The safe zone is: **blunt head + three rounded but *deeply separated* dorsal humps + medium body + shallow fork.**

---

## 4. Concrete redraw spec

Actionable geometry for a designer. Coordinates assume the fish **faces left**, head at left.

### Canvas & proportions
- **viewBox `0 0 64 44`** — bump height from 40 to 44 vs the current file, to buy ~4 units of vertical room so the dorsal humps can be *taller* without clipping at `maskSize: contain`. (Wrasse already uses a 44-tall box.)
- **Body:** length ~46 units (x≈6 → x≈52), max depth ~18 units (depth/length ≈ 0.39 — chunkier than shoaler's ~0.35, shallower than wrasse's ~0.45). Centre line at y≈24.
- **Head:** **blunt and rounded** — the front of the body should be a near-circular forehead, not a taper. Snout slightly squared, mouth roughly mid-height. Distinctly NOT pointed (the anti-wrasse cue).

### The three dorsal fins (the whole point — exaggerate)
- **Three discrete rounded humps** along the top of the back, between x≈14 and x≈48.
- **Make them BIG and TALL:** each hump should rise **~7–9 units** above the back line (vs the current ~4–5). Tall enough that the silhouette's top edge is visibly *serrated into three peaks*, readable at 64px.
- **Widen the gaps:** the negative space (notch) between adjacent humps must be **≥4 units wide and cut down close to the back line** so real "sky" shows between them. Deep V-notches, not shallow scallops. The notch is the load-bearing feature — if in doubt, cut it deeper.
- **Size progression:** middle/rear humps can be marginally larger than the front (gadoid soft dorsals are a touch taller behind), but keep all three clearly present; do **not** let the first dwindle to a nub.
- **Rounded, not pointed:** humps are dome/sail-shaped (cod soft dorsals), **never** the sharp raked triangle of the shark dorsal.
- Trade anatomical accuracy for legibility: real cod dorsals are subtle; here they should be loud. Three obvious sails > six faithfully-rayed lumps.

### The two anal fins (secondary reinforcement)
- **Two rounded humps below the belly**, mirroring the dorsals, between x≈28 and x≈46, rising ~5 units below the belly line, with a clear notch between.
- Purpose: the top↔bottom echo helps the eye *count* the dorsals ("matched pairs") and adds gadoid character. Keep them clearly smaller than the dorsals so the back stays the hero.

### Tail (shallow fork — contrast cue)
- **Shallowly forked / emarginate** caudal at the rear (x≈52 → x≈62). Fork depth ~3–4 units only.
- Must read as **neither** the wrasse's fully-rounded paddle **nor** the silver-shoaler's deep V. A gently concave trailing edge with two soft lobes.

### Pectoral & chin barbel
- **Pectoral:** small, low on the body behind the head — keep it modest (a small lobe). Do **not** draw a big splayed wing/fan (that cues `bottom-other`/`bottom-sitter`).
- **Chin barbel:** optional tiny nub under the chin. It will not survive at icon size; include only if it doesn't blur the head outline. Do not spend budget here.

### Overall silhouette target
A lone, chunky, blunt-headed fish whose **top edge is unmistakably broken into three tall rounded sails separated by deep notches**, with a matching pair of bumps below and a shallow tail fork. The triple-sail back should be legible even as a 48px thumbnail.

---

## 5. Proposed redrawn SVG (DRAFT — not applied)

Same flat `fill="currentColor"` mask style. Fish faces left. The three dorsals are exaggerated into tall, deeply-notched sails; the body is constructed so the notches between dorsals are true negative space (the back dips back down to the body line between each sail). Anal fins mirror below; tail is a shallow fork; a small barbel and pectoral are included as low-cost extras.

```svg
<svg width="100%" height="100%" aria-hidden="true" fill="currentColor" viewBox="0 0 64 44" xmlns="http://www.w3.org/2000/svg">
  <!-- Chunky blunt-headed gadoid body. Faces left; head a rounded forehead at
       the left, tapering to the caudal peduncle at the right. Top edge is the
       baseline the three dorsal sails rise from; it dips to ~y17 between sails
       so the notches are real sky. -->
  <path d="M6 24
           C6 17.5 11 13.5 18 12.8
           C20 16.5 20 16.5 22 16.8
           C24 16.6 24 16.6 26 12.4
           C28 12.4 30 12.4 32 12.6
           C34 16.4 34 16.4 36 16.6
           C38 16.4 38 16.4 40 12.6
           C44 13 48 14.5 50 17.2
           L52 18.5
           C53 20 53 28 52 29.5
           L50 30.8
           C48 33.5 44 35 40 35.4
           C38 31.6 38 31.6 36 31.4
           C34 31.6 34 31.6 32 35.4
           C30 35.6 28 35.6 26 35.4
           C24 31.6 24 31.6 22 31.2
           C20 31.5 20 31.5 18 35.2
           C11 34.5 6 30.5 6 24 Z"/>
  <!-- DORSAL SAIL 1 (front) — tall rounded dome, deep notch after it -->
  <path d="M14 14 C15 6 19 4.5 23 6 C24 8.5 25 11 25.5 13 C21 13 17.5 13.4 14 14 Z"/>
  <!-- DORSAL SAIL 2 (middle) — the tallest, asserts "separate fin" hardest -->
  <path d="M25 13 C26.5 4.5 31 3.2 35 5 C36 7.8 37 10.6 37.5 13 C33 13 29 13 25 13 Z"/>
  <!-- DORSAL SAIL 3 (rear) -->
  <path d="M37 13 C38.5 5.5 43 4.5 47 6.5 C48 9 48.5 11.4 49 13.6 C45 13 41 13 37 13 Z"/>
  <!-- ANAL FIN 1 — rounded hump mirroring the dorsals, smaller -->
  <path d="M26 35.4 C27.5 41 31 41.8 33 38.6 C31 38 29 37.4 28 36 C27.2 35.8 26.6 35.6 26 35.4 Z"/>
  <!-- ANAL FIN 2 -->
  <path d="M36 35.4 C37.5 41 41 41.6 43 38.4 C41 38 39 37.2 38 36 C37.2 35.8 36.6 35.6 36 35.4 Z"/>
  <!-- Small pectoral fin, low behind the head (modest, not a wing) -->
  <path d="M16 28 C13.5 32.5 15 36.5 19 37 C19.5 33.5 19 30.5 19 28.8 C18 28.4 17 28.2 16 28 Z"/>
  <!-- Shallow-forked (emarginate) caudal — neither round paddle nor deep V -->
  <path d="M52 21 C57 17.5 61 16.5 62.5 16.5 C61 19.5 60.5 21.5 60.5 24 C60.5 26.5 61 28.5 62.5 31.5 C61 31.5 57 30.5 52 27 C52.7 25 52.7 23 52 21 Z"/>
  <!-- Chin barbel — tiny nub under the head (low-cost, may vanish at icon size) -->
  <path d="M8 27.5 C7.2 30.5 7.8 32.5 9.4 33.4 C9.8 31 9.4 29 9 27.6 Z"/>
</svg>
```

**Designer notes on the draft:**
- The **body path deliberately dips its top edge to ~y13–17 between the sail roots** (the little C-curves at x≈20, x≈26, x≈32, x≈36 in the body path) so each notch between the three dorsal sails is genuine negative space, not just an overlaid bump on a smooth back. This is what makes "three fins" survive the flat mask.
- The dorsal sails **overlap the body root** by ~1–2 units so there is no hairline gap artifact when rasterised, while the notches stay open.
- Verify at **48px and 64px** that the three peaks remain visually distinct; if the middle/rear notch closes up, deepen the notch (lower the body dip) before widening the gap.
- If the barbel or pectoral muddies the head silhouette at small size, drop them — they are not load-bearing.

---

## 6. Open questions, tradeoffs, and verification

### Tradeoffs
- **Anatomical accuracy vs legibility.** Real cod dorsals are modest, evenly-spaced soft fins; this draft exaggerates them into three tall sails. That is intentional — the icon's job is to *teach the rule* "three separate fins on the back," not to be a field-accurate plate. The field guides and `AnnotatedSpeciesPhoto` carry the accurate detail later in the flow.
- **Taller box vs consistency.** Bumping the viewBox to `0 0 64 44` (from 40) matches the wrasse box and buys vertical room, but means the cod renders slightly shorter relative to siblings still on a 40-tall box under `maskSize: contain`. Acceptable (each tile is contained independently), but worth an eyeball pass across all six fish tiles together.
- **Three-vs-two dorsals reading as a shark fin.** Tall humps risk reading as raked shark dorsals. Mitigation: keep them **rounded domes** and keep the tail a **symmetric shallow fork** (the shark's asymmetric heterocercal tail is its firewall — as long as cod's tail stays symmetric and only shallowly forked, the pair never collide).
- **Barbel is essentially decorative** at icon size — included for completeness but not relied on.

### Open questions for the reviewer
1. Is the exaggeration acceptable to the marine biologist signing off the catalogue, or should the sails be toned toward realism (risking a regression to "bumpy back")?
2. Should the two anal fins be kept at all, or dropped to reduce clutter and let the back be the sole hero? (They aid "counting" but add bottom-edge noise.)
3. Do we want the whole fish-tile set on a consistent viewBox height for visual rhythm, or is per-tile `contain` sufficient?

### Verification — how to re-score
The project ships a Gemini-vision scorer: **`npm run score:silhouettes`** (`scripts/score-silhouettes.ts`), which rasterises each live tile SVG with `sharp`, sends it to `assessSilhouette()` with its group context + sibling labels, and writes `implementation/2026-06-17/silhouette-scores.json`.

Process to validate this redraw:
1. Drop the §5 SVG into a scratch copy (e.g. `cod-like.draft.svg`) — **do not** overwrite the live file yet.
2. Rasterise at 48px and 64px and eyeball the three-peak reading (the manual gate the script's caption can't fully replace).
3. Once it looks right, swap it in and run `npm run score:silhouettes` and **diff the baseline**. Target: `readsAs` moves from "Fish with fins" to something cod-specific (e.g. "Cod / fish with three dorsal fins"), `recognizability` and `diagnosticAccuracy` up from 70/80, and **no new `confusableWith` flag for `wrasse` or `silver-shoaler`** (the matrix in §3 is the guard).
4. If Gemini still says "emphasise the three dorsals," the notches are not deep enough — lower the body's between-sail dip and re-score.
5. Note the free-tier quota cap (~20 Gemini req/day); a full `score:silhouettes` run is ~13 tiles, so a single re-score fits, but batch sparingly.

Mirror the wrasse precedent: that tile went 58 → 73 by a single redraw (deep body + pointed snout + one long dorsal) and the win was recorded in the same scores file. The same one-feature-done-loudly approach (here: three deeply-notched dorsal sails) is the path to lifting cod-like above 78.
