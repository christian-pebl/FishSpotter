# `bottom-sitter` silhouette review — "Gobies & dragonets"

**Icon:** `public/silhouettes/forms/bottom-sitter.svg`
**Tile label:** "Gobies & dragonets" (Rung-2 fish family-gestalt cut)
**Covers:** Two-spotted goby, Common goby, Rock goby, Sand goby, Dragonet, Spotted dragonet
**Current Gemini score:** 85 ("strong"), readsAs "fish on seabed"
**Status:** DRAFT plan for review. No live SVG or app code changed by this document.

> Render constraint (load-bearing): the silhouette renders as a FLAT, SINGLE-COLOUR
> teal mask (`mask-image` + `background-color: currentColor` in
> `MaskSilhouette`, `TileGate.tsx`). No stroke, shading, or gradient survives —
> only **filled outline** and **negative space between separate paths** carry
> information. It renders small: an `h-20 w-20` ("2x") box in the Rung-2 list rows,
> shrunk to `contain`. Every cue must read at ~40px.

---

## 1. Current read — walking the existing paths

The current file (viewBox `0 0 64 40`) has five paths:

1. **Seabed line** — `M2 34 ... 62 35.6` — a thin full-width horizontal bar near
   the bottom. This is the single strongest cue and the reason the icon scores
   85: it instantly says "this fish is ON the bottom", separating the whole tile
   from the mid-water groups (cod-like / wrasse / silver-shoaler).
2. **Body** — `M9 21 C10 14.5 17 12 26 12 C35 12 ...` — a blunt-headed,
   flat-bellied lozenge whose underside sits parallel to and just above the
   seabed line (belly ~y31, seabed ~y34). The head end (left) is rounded/blunt;
   the body tapers rightward to the tail. It occupies roughly the left 75% of
   the canvas and is moderately deep.
3. **First dorsal** — `M22 12 C24 9 27 9 29 11` — a small low bump on the back.
4. **Fan pectoral** — `M18 30 C13.5 32.5 11.5 36 ...` — a triangular fin
   splaying down-and-forward from the lower body toward the seabed. This is the
   intended "bottom-percher give-away" and it does touch/near the seabed line,
   reinforcing the perch posture.
5. **Tail** — `M49 20 L57 16.5 ...` — a short shallow-forked caudal at the right.

**Why 85, not higher:** the seabed line does the heavy lifting and is
unambiguous. But the *body* is a generic medium fish lozenge — nothing about it
says "small smooth goby/dragonet" specifically. The pectoral fan is present but
modest and reads more as a generic ventral fin than a dramatic splayed
dragonet/goby fan. Gemini's note ("the horizontal line clearly indicates the
seabed") confirms the line is carrying the score; the body shape is not adding
diagnostic value.

---

## 2. THE problem: `bottom-sitter` vs `bottom-other` (most important section)

### What `bottom-other.svg` depicts today

`public/silhouettes/forms/bottom-other.svg` (also viewBox `0 0 64 40`) is
**structurally almost identical** to `bottom-sitter`:

| Element | `bottom-sitter` (gobies/dragonets) | `bottom-other` (gurnards etc.) |
|---|---|---|
| Seabed line | `M2 34 → 62 35.6` (y≈34) | `M2 35 → 62 36.6` (y≈35) — same bar |
| Body | blunt lozenge, left 75%, belly flat | longer lozenge, tapers further to tail |
| Dorsal fins | ONE small bump (`M22 12`) | TWO bumps — spiny `M19 11` + soft `M31 11` |
| Pectoral | down-forward triangular fan touching seabed | larger "wing-like" fan, lower + wider |
| Tail | short shallow fork | slightly larger fork |

As **flat single-colour silhouettes at 40px**, the two are nearly
indistinguishable. The only real differences are (a) one dorsal bump vs two, and
(b) a marginally longer body and bigger pectoral on `bottom-other`. Both
"read as a blunt fish on a seabed line with a fan pectoral." A novice glancing at
two adjacent Rung-2 rows will not be able to tell which is which — and worse,
the tile labels ("Gobies & dragonets" vs "Other bottom fish") give no shape
hint, so the icon is the *only* disambiguator and it currently fails to
disambiguate. **This is the core defect to fix.**

> Note: two dorsal bumps on `bottom-other` is *biologically* the gurnard cue, but
> at 40px two tiny bumps collapse into "a bumpy back" and don't reliably separate
> from one bump. We cannot rely on the sibling's two-dorsal cue to do the work;
> `bottom-sitter` must look different in **gross form**, not fin-count detail.

### The deliberate visual contrast to establish

Push the two icons to opposite ends of a **size / smoothness / posture** axis.
`bottom-other` keeps (or should keep, in its own review) the "armoured, spiky,
elongated, wing-pectoral gurnard." `bottom-sitter` should become the
**small, smooth, plump, round-headed, low-resting** opposite:

1. **Smaller + plumper, not elongated.** Gobies/dragonets are short and tubby.
   Make the body noticeably **shorter and rounder** than `bottom-other` — a stubby
   tadpole/teardrop, not a long taper. The body should occupy *less* horizontal
   span, leaving clear seabed to either side (emptiness = "small").
2. **Rounded, smooth head — no spikes.** The head end must be a clean smooth
   curve. Crucially, **add NO spiny dorsal points and NO head spines** — the
   *absence* of spiky negative-space jaggies, read against `bottom-other`'s
   spiky profile, is itself the "smooth vs armoured" signal.
3. **Hunched / downturned resting posture.** Gobies prop on their pectorals with
   the head slightly raised and the body sloping down to the tail resting on the
   sand — a gentle "perched" wedge. Tilt the body so the tail end nearly meets
   the seabed; this differs from `bottom-other`'s level horizontal posture.
4. **One single rounded dorsal at most** (or a continuous smooth back), versus
   the sibling's two bumps. Keep it low and rounded.
5. **TWO little fish (strongly consider — see §5).** The cleanest "small + many"
   contrast against `bottom-other`'s single chunky gurnard. `silver-shoaler`
   already proves a two-fish silhouette reads well (it scored 87, readsAs "Two
   fish"). Two small gobies on the seabed = "small gregarious darters", a
   gestalt no gurnard icon would ever show.

The contrast sentence to design to: **"bottom-other is one big armoured fish;
bottom-sitter is small smooth fish (maybe two) hunkered on the sand."**

---

## 3. Diagnostic priorities (ranked, silhouette-only)

For "small smooth seabed fish", in order of value at 40px:

1. **Seabed line** (keep — it is the whole tile's anchor and what earned the 85).
2. **Small body footprint + empty seabed around it** — "small" reads as scale
   relative to the canvas: short body, lots of bare sand line.
3. **Plump rounded head + smooth continuous dorsal profile** — "smooth, not
   armoured"; the deliberate absence of spikes.
4. **Splayed fan pectoral planted on the sand** — the perch-and-dart posture cue
   (already present; make it bigger and more obviously splayed/triangular).
5. **Two fish** — adds the "small + gregarious" gestalt and a hard visual break
   from the single-fish `bottom-other`.
6. **Downturned/hunched stance** — tail dropping toward the sand.

Deprioritise: dorsal fin *count* (collapses at small size), tail fork shape
(too fine), spot markings (a mask can't show the two-spotted goby's spots).

---

## 4. Distinguishability matrix (one outline cue each)

| Sibling | Tile label | The ONE outline cue that separates `bottom-sitter` from it |
|---|---|---|
| **`bottom-other`** (CRITICAL) | "Other bottom fish" | **Scale + smoothness + count.** `bottom-sitter` = small, short, plump, round-headed, smooth-backed body (ideally TWO of them) on bare sand. `bottom-other` = one larger, longer, spiky-/two-dorsal armour-headed fish with a big wing pectoral. The reader should see "little smooth fish" vs "big armoured fish" *as gross silhouette mass*, never needing to count dorsal bumps. |
| `cod-like` | "Cod-shaped" | **Seabed line + low posture.** Cod-like is a free-swimming mid-water fish (no ground line); bottom-sitter is pinned to the sand with a flat/dropping belly. |
| `wrasse` | "Wrasses" | **Seabed line + small plump body.** Wrasse is a deep, mid-water, thick-lipped pointed-snout fish, no ground line; bottom-sitter is small, blunt, and grounded. |
| `silver-shoaler` | "Silver swimmers" | **Seabed line + posture.** Both may show two fish, but silver-shoaler's pair are slim streamlined mid-water swimmers stacked diagonally with NO seabed; bottom-sitter's pair sit ON the sand line, plumper and blunt-headed. The ground line is the hard separator — keep the bottom-sitter fish clearly resting on it. |
| `long-skinny` | "Long and skinny" | **Aspect ratio.** Long-skinny is an eel — length ≫ depth, ribbon-like; bottom-sitter is short and tubby (depth-to-length far higher). |
| `shark` | "Shark-shaped" | **Whole gestalt.** Shark = pointed snout, tall triangular dorsal, crescent tail, sleek; bottom-sitter = tiny blunt grounded fish. No realistic confusion; the seabed line plus small scale settles it. |

The `silver-shoaler` overlap is the one to watch if §5 (two fish) is adopted —
both would be two-fish icons. The mitigation is posture (resting vs swimming)
and the seabed line; keep bottom-sitter's pair low, blunt, and grounded.

---

## 5. Concrete redraw spec

**Goal:** keep the seabed line that earns the 85; replace the generic medium
lozenge with an unmistakably *small, smooth, plump, hunched* goby/dragonet — and
break the visual tie with `bottom-other`.

**viewBox:** keep `0 0 64 40` (matches the sibling and other fish forms; the
mask scales by `contain` so the aspect just needs to stay consistent). A wider
box is unnecessary; the "small" cue comes from a small body inside the existing
box with bare seabed around it.

**Decision on TWO fish — recommend YES.** Rationale:
- It is the single clearest break from the single-fish `bottom-other`.
- `silver-shoaler`'s two-fish icon already validates the read (scored 87).
- It directly encodes the "small + gregarious darters" gestalt.
- **Tradeoff / risk:** convergence with `silver-shoaler` (also two fish) and
  general busyness at 40px. Mitigate by (a) keeping both bottom-sitter fish
  **low and resting on the seabed line** (silver-shoaler's pair float with no
  line), (b) making them visibly **plump and blunt** (silver-shoaler's are slim
  forked-tail streamliners), and (c) keeping them small with clear sand between
  and around them. The seabed line is the decisive separator and is retained.
- **Fallback if the two-fish version tests busy/confusable:** a single
  small, plump, hunched, splay-pectoral fish on the seabed (still markedly
  smaller and rounder than `bottom-other`). Score both and keep the winner.

**Geometry for the recommended two-fish draft:**
- **Seabed line:** unchanged thin full-width bar low in the frame (y≈34–35.6).
- **Foreground fish (lower, larger of the two):** a short plump teardrop — blunt
  rounded head at left, body no longer than ~40% of the width, belly resting on
  the seabed, tail end gently dropping toward the line (hunched stance). One low
  rounded dorsal hump (no spikes). A **prominent splayed triangular pectoral fan**
  planted forward-and-down onto the sand — bigger and more obviously fan-like
  than the current modest fin. Short rounded/shallow-fork tail.
- **Background fish (upper, smaller):** a second, smaller blunt teardrop above and
  behind, also clearly small and plump, no spiky features — adds the "many small"
  read without a second seabed line. Keep it simple (body + tiny tail), no fins,
  so it doesn't clutter.
- **Keep negative space generous:** bare sand to the left and right of the
  foreground fish so "small" reads by scale.
- **No spikes anywhere** — every contour smooth and rounded. The smoothness is
  doing the "not a gurnard" work.

---

## 6. Proposed redrawn SVG (DRAFT — for review)

Flat `fill="currentColor"` mask style, viewBox `0 0 64 40`. Two small plump
blunt-headed fish resting on the seabed; the lower one has a big splayed
pectoral fan; everything smooth (no spikes), generous bare sand around them.

```svg
<svg width="100%" height="100%" aria-hidden="true" fill="currentColor" viewBox="0 0 64 40" xmlns="http://www.w3.org/2000/svg">
  <!-- the seabed it perches on (the tile's anchor cue) -->
  <path d="M2 34 L62 34 L62 35.6 L2 35.6 Z"/>

  <!-- FOREGROUND goby: short, plump, blunt-headed teardrop, hunched so the
       tail dips toward the sand; smooth back, no spikes. Smaller footprint
       than bottom-other's elongated body. -->
  <path d="M14 25
           C15 19 20 16.5 27 16.5
           C33 16.5 38 19 41 23
           C39.5 27.5 35 30.5 28 31.5
           L20 32
           C16 32 14 29.5 14 25 Z"/>

  <!-- one low ROUNDED dorsal hump (single, smooth — not the sibling's two bumps) -->
  <path d="M24 16.5 C26 13.8 29.5 13.8 31.5 16 C29.5 16.2 26.5 16.2 24 16.5 Z"/>

  <!-- big splayed fan pectoral planted down-and-forward onto the sand
       (the perch-and-dart give-away; deliberately larger than the old one) -->
  <path d="M21 30
           C15 32 11.5 35.5 12 38.6
           C17 36.6 23.5 33.6 26 30.5 Z"/>

  <!-- short rounded tail dropping toward the seabed (hunched stance) -->
  <path d="M41 23 L48 21 L45.5 25 L48 29 Z"/>

  <!-- BACKGROUND goby: a second, smaller blunt teardrop above/behind, to read
       as "small + many"; kept simple (body + tiny tail, no fins) so it doesn't
       clutter at 40px. -->
  <path d="M30 8
           C31 5.2 35 4 40 4.4
           C44 4.7 47 6 48.5 8
           C46.5 10.2 43 11 38.5 10.8
           C34 10.6 31.5 9.6 30 8 Z"/>
  <path d="M48.5 8 L54 5.6 L51.5 8 L54 10.4 Z"/>
</svg>
```

Design notes on the draft:
- Foreground body spans ~x14–41 (≈42% of width) vs the old x9–49 (≈63%) and
  `bottom-other`'s x8–50.5 — visibly **smaller**.
- Single rounded dorsal + all-smooth contours = "not armoured" against the
  sibling's two spiky bumps.
- The two fish + bare sand = "small gregarious darters".
- The pectoral fan is enlarged and clearly planted on the sand for the perch
  posture.
- If Gemini reports it reads as "two fish" and confuses with silver-shoaler,
  the single-fish fallback (drop the background fish, keep foreground enlarged
  slightly) is the next candidate to score.

---

## 7. Open questions, tradeoffs, and verification

**Open questions / tradeoffs**
- **Two fish vs one.** Two fish maximises contrast with `bottom-other` but risks
  convergence with `silver-shoaler`. Recommendation: score the two-fish draft
  first; if it confuses with silver-shoaler, fall back to the single hunched
  fish. (This is the main thing to settle empirically.)
- **Coordinated sibling edit.** This icon and `bottom-other` are two halves of
  one contrast. Even though this plan only touches `bottom-sitter`, the
  *intended* end state is: bottom-sitter = small/smooth/plump/(two); bottom-other
  = big/armoured/spiky/elongated/single. The `bottom-other` review should pull
  its silhouette toward that pole (longer body, keep/emphasise the two dorsals
  and bigger wing pectoral) so the pair separate. Flag the dependency.
- **Label support.** The tile labels ("Gobies & dragonets" / "Other bottom
  fish") carry no shape hint, so the icons bear the full disambiguation load —
  reinforcing why the gross-form contrast (not fin detail) matters.
- **Spots.** A flat mask can't render the two-spotted goby's spots or the
  dragonet's colours; do not attempt — rely on body gestalt + seabed.

**Verification step**
1. Drop the proposed SVG into `public/silhouettes/forms/bottom-sitter.svg`
   (after review).
2. Run `npm run score:silhouettes` (Gemini re-score, `scripts/score-silhouettes.ts`).
3. **Acceptance criteria:**
   - `score` ≥ 85 (hold or beat the current strong rating).
   - `readsAs` still references a fish on the seabed (e.g. "fish on seabed",
     "small fish on the bottom", "two fish on seabed").
   - **`confusableWith` does NOT list "Other bottom fish" / `bottom-other`** —
     this is the explicit new test for this icon. Equally check that
     `bottom-other`'s entry does not list `bottom-sitter`.
   - `confusableWith` should also not list "Silver swimmers"/`silver-shoaler`
     (the two-fish convergence risk).
4. If the two-fish draft fails any of the above (esp. silver-shoaler confusion),
   score the single-fish fallback and keep the higher, non-confusable variant.
5. Eyeball the rasterised mask at ~40px (the actual Rung-2 row size) to confirm
   the "small smooth fish on sand" read survives the `contain` downscale, and
   place it next to a rendered `bottom-other` to confirm they are distinguishable
   side by side.
6. Re-run the standard gate before any push:
   `npx tsc --noEmit && npm test && npm run lint && npm run lint:tokens`
   (the SVG is a static asset, but `body-forms.test.ts` guards the fish
   grouping; no code changes are expected from a pure asset swap).

All output here is a DRAFT pending design sign-off; no live SVG or app code has
been modified.
```
