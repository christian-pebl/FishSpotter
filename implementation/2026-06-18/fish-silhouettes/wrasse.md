# Wrasse sub-silhouette — review + redraw plan

**Icon:** `public/silhouettes/forms/wrasse.svg`
**Tile:** Rung-2 fish family-gestalt gate, label **"Wrasses"** — covers Ballan, Cuckoo, Corkwing, Goldsinny.
**Glance test:** *"Deep, thick-lipped, one long fin, in the rocks."*
**Current Gemini score:** 73 (`adequate`) — the LOWEST of the six fish tiles. `readsAs: "Deep-bodied fish"`.
**Status of this doc:** review + a DRAFT redrawn SVG for human/Gemini review. **Nothing here is applied to the live asset.**

Render constraints (load-bearing): the SVG is painted as a FLAT single-colour teal mask
(`mask-image` + `background-color: currentColor` in `MaskSilhouette`, `src/components/idflow/TileGate.tsx`).
There is **no stroke, no internal shading, no gradient** — only (a) the filled outline and
(b) the *negative space between separate filled paths* carry information. In the Rung-2 `list`
variant the icon renders at `h-20 w-20` (`80px`, "2x"), `maskSize: contain`. Every diagnostic
feature must survive at ~80px and still read at the ~32px Rung-1-style scale.

---

## 1. Current read — walking the live SVG

`viewBox="0 0 68 44"`, fish faces left, all paths `fill="currentColor"`. Five filled shapes:

| Path | Role | Geometry notes |
|---|---|---|
| `M2 22 C6 14 … Z` | **Body** | An oblong from x≈2 (snout) to x≈52. Top edge peaks at y≈8, bottom at y≈34 → max depth ≈26 over a length ≈50 ⇒ **depth:length ≈ 0.52**. Genuinely deep. Snout end tapers but the leftmost point sits at y≈22 (mid-height), so the "point" is a soft rounded nose, not a sharp wedge. |
| `M2 22 C0.5 21 … Z` | **Lip nub** | A ~2px blob at the snout tip. At 80px this is ≈3–4px of mask; at 32px it vanishes into the body outline entirely. |
| `M15 9 C18 4 … Z` | **Dorsal fin** | A single long shape arching over the back, x≈15→49, peaking toward the rear (y≈3). It is drawn as ONE continuous shape — good intent — but it is *fused flush onto the body's top edge* (its lower border `C40 12 24 11 15 9` rides the body line). With no negative space between fin and back, the eye reads "tall-backed body", not "a fin sitting on the back." |
| `M23 24 C19 30 … Z` | **Pectoral** | A rounded lobe hanging below the belly behind the gill. Reads fine. |
| `M32 34 C35 38 … Z` | **Anal fin** | A low bump under the rear belly. Small; mostly lost at icon size. |
| `M47 22 C53 16 … Z` | **Tail** | A fully convex paddle (x≈47→64), overlapping the body tip. Correctly rounded / unforked. Good. |

### Why the 18-Jun redraw still only scores 73

The note in `silhouette-scores.json` records the history: the icon went **58 → 73**, the
58-version was *confusable with Cod-shaped*, and the spiny-dorsal variant scored only 60.
The current version fixed the cod-confusion (Gemini now lists `confusableWith: none`) by
committing to a smooth single dorsal and a deep body. But three things cap it at "adequate":

1. **The single dorsal does not read AS a fin.** It is the right idea executed as a fused
   silhouette: because the fin's base is flush with the back outline, there is no gap, no
   notch, no ray texture — at icon scale the fin + body merge into one tall hump. Gemini's
   `readsAs: "Deep-bodied fish"` is exactly that: it sees a deep body and *no fin information
   at all*. The very feature that distinguishes a wrasse (one long dorsal) is invisible.
   This is the residual problem the note calls "the intrinsic ceiling of a flat icon."
2. **The snout is rounded, not pointed.** The body's leading point is at mid-height (y≈22)
   and the curves into it are gentle, so the head reads as a generic blunt-ish nose. The 2px
   lip nub is too small to register. The "sharply POINTED thick-lipped snout" — one of the
   four give-aways and a key cod-discriminator — is not delivered.
3. **`recognizability` is 60, the metric dragging the score down.** Distinctiveness (75) and
   clarity (85) are fine; the problem is the icon doesn't *announce* "wrasse" — a viewer can't
   name the family from the outline. That's a direct consequence of (1) and (2): the two cues
   that would say "wrasse not just fish" (pointed lipped head + one obvious long fin) are the
   two that don't render.

**Diagnosis:** the ceiling is not "flat icons can't show dorsals" in general — `cod-like`
shows three fins fine, `shark` shows a raked dorsal fine. The ceiling here is that this
particular drawing fuses the fin into the body. Lift the fin off the back (negative space)
and sharpen the snout, and the score should clear 80.

---

## 2. Diagnostic priorities (silhouette-only, ranked)

Ranked by how much they (a) say "wrasse" and (b) separate it from siblings — **and** whether
they actually survive at ~32–80px as a flat mask.

| # | Feature | Reads small? | Priority | Why |
|---|---|---|---|---|
| 1 | **ONE long continuous dorsal, lifted off the back with a visible gap** | **Yes if drawn with negative space** | **Critical** | The single defining wrasse cue and the primary cod-discriminator. Must be a distinct shape *separated from the body* so the eye counts "one fin," not "tall back." This is the whole fix. |
| 2 | **Pointed, thick-lipped snout** | Yes (if exaggerated) | **Critical** | Second cod-discriminator (cod = blunt + barbel). A clear wedge nose with a small lip pout/notch reads at 80px. Needs exaggeration to survive 32px. |
| 3 | **Deep oblong body (depth:length ≈ 0.5)** | Yes | High | Already present and working — keep it. Separates from silver-shoaler / shark / long-skinny. But it's NOT enough alone (cod is also chunky), hence #1/#2. |
| 4 | **Rounded, unforked paddle tail** | Yes | High | Separates from cod (forked), silver-shoaler (deeply forked), shark (asymmetric). Already correct — keep, maybe make the convex curve even rounder/bolder. |
| 5 | Big rounded pectoral fin | Partly | Medium | Helps the "reef-hanger" gestalt and adds a wrasse-ish lower-body cue; keep but don't rely on it — small fins are the first casualty at 32px. |
| 6 | Long low anal fin | Barely | Low | Mostly invisible at icon size. Keep as a faint silhouette enrichment only; spend no legibility budget on it. |

**Reads small / doesn't:** body depth, tail shape, and (once lifted) the dorsal ridge all
survive shrinking. Lips, anal fin, and pectoral edges blur first — so the lip must be an
*exaggerated nub/wedge*, not a delicate curve, and the anal fin must not be load-bearing.

---

## 3. Distinguishability matrix

For each sibling, the ONE outline cue that must stay unambiguous so wrasse can't be confused
with it. (Sibling geometry read from the live SVGs.)

| Sibling | Its outline signature | Wrasse's distinguishing cue | Risk |
|---|---|---|---|
| **`cod-like` (Cod-shaped)** ← THE confusion | **THREE separate small dorsal humps** with gaps between them; blunt head; **chin barbel** (a down-nub under the throat); soft **forked** tail. | **ONE long continuous dorsal** (no gaps) + **pointed lipped snout** (no barbel) + **rounded** tail. The dorsal count is the make-or-break contrast: cod = three bumps with sky between them; wrasse = one unbroken ridge. | **Highest.** If the wrasse dorsal stays fused/ambiguous, both just read "deep fish." The fix must make ONE-vs-THREE the loudest signal in both icons. |
| **`silver-shoaler` (Silver swimmers)** | Drawn as **two** slim fish; deeply **forked** tail; shallow streamlined body. | **Single** fish; **deep** body (≈0.5 depth ratio vs shoaler's slim); **rounded** tail. | Low — single vs shoal + depth + tail all differ. |
| **`bottom-sitter` (Gobies & dragonets)** | Fish resting on an explicit **seabed line** (horizontal bar at bottom); big splayed **fan pectoral**; flat belly. | **No seabed line** (wrasse floats free in frame); mid-water posture; deep body. | Low — the seabed bar is unmistakable; just keep wrasse off any baseline. |
| **`bottom-other` (Other bottom fish)** | Armour-headed **gurnard** on a seabed line, big head, walking pectoral rays. | No seabed line, no oversized armoured head; smooth deep oval. | Low. |
| **`long-skinny` (Long and skinny)** | **Eel-like**, length ≫ depth (very low depth ratio), often gently curved. | High depth ratio (deep oblong) — the polar opposite proportion. | Very low. |
| **`shark` (Shark-shaped)** | Pointed snout, **raked triangular dorsal**, **asymmetric** (heterocercal) tail with long upper lobe; slender tapering body. | Symmetric **rounded** tail; **long-based** (not triangular-raked) dorsal; deep (not tapering) body. | Low-medium — both have a "pointed" front, so lean on tail shape (rounded vs asymmetric) and dorsal shape (long ridge vs single raked triangle). |

**Net:** the matrix collapses to one job — **make ONE-continuous-dorsal + pointed-lipped-snout
unmistakable**, because every low-risk sibling is already separated by body depth / tail shape /
seabed line, and the only high-risk sibling (cod) is separated by exactly those two cues.

---

## 4. Concrete redraw spec

Keep what works (deep body, rounded tail, pectoral) and fix the two failing cues.

**Canvas / proportions**
- `viewBox="0 0 68 44"` (unchanged — matches siblings' rough aspect; the mask is `contain`-fit
  so exact box size is cosmetic, but keeping it eases visual diffing against the current asset).
- Fish faces **left** (consistent with all fish siblings).
- **Body depth:length ≈ 0.52** — keep the current deep oblong. Body spans x≈4→50, top of body
  edge ≈ y14, bottom ≈ y34 (depth ≈20 over length ≈46). Deep, but read the depth from the BODY
  alone — the dorsal must add to it visually as a *separate* element, not by inflating the body.

**(A) Pointed, thick-lipped snout — make it a wedge with a lip pout**
- Bring the leading point to a sharper apex and raise the lip cue. Instead of a 2px nub at
  mid-height, draw the snout as a short **wedge** whose tip is a small forward-jutting **pout**:
  the upper jaw line dips and the lower jaw line lifts into a blunt rounded knob at x≈2, y≈22,
  ~3–4 units across. The "thick lip" reads as a deliberate rounded protrusion at the wedge tip,
  not a needle.
- Exaggeration that buys legibility: a tiny concave notch on the *underside* just behind the
  lip (mouth-corner) so the lip reads as a distinct rounded module even at 32px. The pout should
  occupy ~6–8% of the body length — over-sized vs life, but that's the icon tax.

**(B) ONE continuous dorsal — LIFT IT OFF THE BACK (the core fix)**
- Draw the dorsal as a **separate filled path that does not share its lower edge with the body
  top**. Leave a thin sliver of negative space (background) between the fin base and the back
  for most of the fin's length, closing to the body only at the two ends (front anchor ≈x18,
  rear anchor ≈x46). The gap need only be ~1–1.5 units to read as "fin on top of body" at 80px;
  test that it doesn't seal shut under `contain` downscaling.
- Make it ONE unbroken ridge running ~⅔ of the back (x≈16→46), **tall** (rises ~6–8 units above
  the back line, peaking toward the rear like the soft-dorsal lobe of a wrasse). A single tall
  smooth arc, NO scallops — scallops would mimic cod's separate humps. The contrast with cod is:
  cod = three small triangles with sky-gaps between them; wrasse = one long tall continuous arc
  with a single sky-gap *underneath* it (between fin and back).
- Optional legibility exaggeration: give the rear of the dorsal a slightly taller, more rounded
  lobe so the fin's length is obvious (a long-based fin, not a single peak). Keep the front-to-
  back base unbroken.

**(C) Rounded paddle tail — keep, make it boldly convex**
- A fully convex fan from x≈50→64, top ≈y16, bottom ≈y28, no fork, no notch. Make the trailing
  edge a clean semicircle so it can never read as the soft fork of cod or the asymmetric lobe of
  shark. Slight overlap with the body tip is fine (it already does this).

**(D) Pectoral — keep, simplify**
- One rounded lobe below the belly behind the head (x≈22, hanging to y≈34). Keep it modest so it
  doesn't compete with the dorsal for attention.

**(E) Anal fin — optional, faint**
- A low long bump under the rear belly is fine as silhouette enrichment but must not be relied on.
  Could be dropped entirely with no loss at icon scale; keeping it makes the 80px view richer.

**Negative-space budget:** the icon now carries TWO meaningful gaps — (1) under the dorsal
(fin vs back) and (2) the mouth-corner notch (lip vs body). Both are small; verify neither
closes when `maskSize: contain` shrinks the 68×44 box into the 80px (or 32px) tile.

---

## 5. Proposed redrawn SVG (DRAFT — not applied)

A complete candidate. Faces left; flat `fill="currentColor"`; dorsal is a *separate* path with
a negative-space gap above the back; snout carries an exaggerated lip pout; tail is a bold
convex paddle. A designer can drop this straight into the file to test, then re-score.

```xml
<svg width="100%" height="100%" aria-hidden="true" fill="currentColor" viewBox="0 0 68 44" xmlns="http://www.w3.org/2000/svg">
  <!-- Wrasse gestalt: DEEP oblong body, sharply POINTED thick-lipped snout with
       a forward lip-pout, ONE tall long-based dorsal LIFTED off the back (a
       sliver of negative space between fin and body so it reads as a single
       continuous fin, NOT cod's three separate humps), big rounded pectoral,
       bold rounded paddle tail (never forked). Faces left. -->

  <!-- BODY: deep oblong. Top edge held LOW (y~14) so the dorsal above it stays a
       separate element; bottom belly bulges to y~34. Leading edge runs to a
       sharp wedge at the snout (x~3) at mid-height. -->
  <path d="M3 22
           C7 15 13 12 21 11
           C31 10 41 12 49 18
           C51 19.5 52 20.8 52 22
           C52 23.2 51 24.5 49 26
           C41 32 31 34 21 33
           C13 32 7 29 3 22 Z"/>

  <!-- THICK-LIPPED POINTED SNOUT: a forward-jutting rounded pout at the wedge
       tip, with a small mouth-corner notch on the underside so the lip reads as
       a distinct module even at icon size. -->
  <path d="M3 22
           C1 20.5 0.5 21.5 0.6 22.4
           C0.7 23.3 1.4 24 2.4 24
           C3.2 24 3.8 23.4 4 22.8
           C3.4 22.6 3.1 22.3 3 22 Z"/>

  <!-- ONE TALL LONG-BASED DORSAL, LIFTED OFF THE BACK. Anchors to the body only
       at the front (x~17) and rear (x~46) tips; in between, the fin's lower edge
       sits ABOVE the body's top edge, leaving a thin negative-space gap that
       makes it read as a single continuous fin on top of the back. Peaks toward
       the rear (the soft wrasse dorsal lobe). One smooth arc — NO scallops, so
       it can never read as cod's three humps. -->
  <path d="M17 12.5
           C20 6 26 4 33 3.6
           C39 3.3 44 4 47 6.5
           C48 9 47.5 12 46.5 14.5
           C42 11.5 33 10.8 27 11
           C23 11.2 20 11.7 17 12.5 Z"/>

  <!-- BIG ROUNDED PECTORAL behind the gill, hanging below the belly. -->
  <path d="M23 25
           C19 31 21 36 27 37
           C28 32 27 28 27 26
           C25.5 25 24 25 23 25 Z"/>

  <!-- LOW LONG ANAL FIN under the rear belly (silhouette enrichment only). -->
  <path d="M33 33.5
           C36 37.5 41 36.5 44 32.5
           C39 34.5 35 34.5 34 33.5 Z"/>

  <!-- BOLD ROUNDED PADDLE TAIL: fully convex semicircular fan, never forked. -->
  <path d="M50 22
           C56 15 63 13 66 14.5
           C67.5 18 67.5 26 66 29.5
           C63 31 56 29 50 22 Z"/>
</svg>
```

### What changed vs the live file and why
- **Dorsal lifted off the back** (front anchor x17, rear anchor x46, lower edge held above the
  body's y14 top): introduces the negative-space gap that makes "one continuous fin" legible —
  the single biggest lever on the `recognizability=60` metric.
- **Snout sharpened + lip pout enlarged** with an underside mouth-corner notch: delivers the
  "pointed thick-lipped" cue that distinguishes wrasse from cod's blunt+barbel head.
- **Body top edge lowered** to y≈14 so the body depth is read from the body alone and the dorsal
  adds visible height *on top* — previously the fused fin was masquerading as body depth.
- **Tail made a bolder, fuller convex semicircle** to harden the unforked contrast vs cod/shark.
- Pectoral, anal kept (lightly redrawn) — they were never the problem.

---

## 6. Open questions / tradeoffs

1. **Will the dorsal negative-space gap survive downscaling?** At `maskSize: contain` into an
   80px tile the 68×44 box renders ~1.2px per unit, so a 1.5-unit gap ≈ 2px — visible but thin.
   At a 32px Rung-1-style scale it's <1px and may seal. Tradeoff: widen the gap to ~2 units (more
   robust, but the fin floats higher and looks less attached) vs keep it tight (more anatomically
   honest, riskier at the smallest scale). **Recommend the wider gap** — at icon scale legibility
   beats realism, and a clearly-separate fin is the whole point. Verify empirically (step below).
2. **Lip exaggeration vs "looks like a beak."** Push the pout too far and Gemini may read a
   parrotfish/beak or even a bird. Keep it a rounded knob, ~3–4 units, not a hook.
3. **One peak vs even ridge.** A rear-peaking lobe is more wrasse-accurate, but a too-tall single
   peak risks reading as ONE big triangular fin like the shark's raked dorsal. Keep the base long
   (x17→46) so "long-based" wins over "single triangle."
4. **Drop the anal fin?** It contributes almost nothing at icon size and adds a path. Leaving it
   in costs little; if Gemini's clarity score dips, remove it.
5. **Does fixing wrasse hurt cod?** No live-file change to `cod-like` is proposed here, but the
   one-vs-three contrast is symmetric — if a future pass touches cod, keep its three humps small,
   clearly separated, and keep the barbel, so the pair stays maximally distinct.

## Verification step

1. Drop the draft SVG into `public/silhouettes/forms/wrasse.svg` on a branch (or a scratch copy).
2. Run the Gemini vision re-score:
   ```
   npm run score:silhouettes
   ```
   This rewrites `implementation/2026-06-17/silhouette-scores.json`. Diff the `form:fish:wrasse`
   entry: target **score > 80** (`strong`), `recognizability` up from 60 (aim ≥ 80),
   `readsAs` moving from "Deep-bodied fish" toward "Wrasse" / "deep fish with one long dorsal fin,"
   and `confusableWith` staying `none` (especially NOT "Cod-shaped").
3. Eyeball-rasterise at **80px and 32px** (the `list`-variant `h-20 w-20` size and a Rung-1-ish
   small size) to confirm: the dorsal gap stays open, the lip pout still registers, the tail still
   reads rounded-not-forked. If the gap seals at 32px, widen it (open question #1) and re-score.
4. If `score:silhouettes` hits the Gemini free-tier daily cap (~20 req/day, see CLAUDE.md), score
   just this one tile by pointing the ad-hoc path at the single file, or retry the next day —
   don't let a 429 be read as a regression.
5. Only after a `strong` (>80) re-score AND a clean small-scale eyeball: propose applying to the
   live asset (separate, reviewed change — not part of this plan).
```
