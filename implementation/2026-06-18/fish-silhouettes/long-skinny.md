# Fish sub-silhouette review: `long-skinny` ("Long and skinny")

**Icon:** `public/silhouettes/forms/long-skinny.svg`
**Rung:** Fish Rung-2 (`fishGroup` family-gestalt cut)
**Covers:** Conger eel, Butterfish, Fifteen-spined stickleback
**Glance test:** "Eel-like, much longer than it is deep."
**Current Gemini score:** 78 ("adequate") — `readsAs: "boomerang, eel, snake"`
**Status of this doc:** DRAFT improvement plan + a candidate redraw for review. No live SVG or app code is modified by this plan.

---

## 1. Current read

The live file is **not a hand-authored icon** — it is a potrace dump:

- `viewBox="0 0 1536.000000 770.000000"` (a ~2:1 raster canvas), with the usual
  potrace `<g transform="translate(0,770) scale(0.1,-0.1)">` flip-and-scale wrapper
  and a `Created by potrace 1.16` metadata comment.
- A **single enormous `<path>`** — one continuous traced outline, ~120 cubic-Bézier
  segments of raw coordinate soup (`M9920 7693 c-14 -2 -95 -15 ...`). There is no
  semantic structure: head, body, fins and tail are all one blob. Nothing can be
  tuned without re-tracing.
- The traced subject is a **strongly S-curved / boomerang-bent slender form**. The
  body sweeps from a thick "head" end down through a deep bend and tapers to a
  point. Because it is a single filled silhouette with a pronounced bend and a
  tapering far end, the negative space around the bend dominates the read.

**Why it scores 78 and reads as "boomerang, eel, snake":**

- The **bend is the loudest feature**, louder than the fish-ness. Gemini's note is
  explicit: *"The bent shape is a bit distracting; a straighter or gently curved
  'long and skinny' form might be clearer."* A strong arc with a tapering end is
  the canonical silhouette of a **boomerang / banana**, an inanimate object — the
  worst possible mis-read for a *fish* tile.
- It also reads as **snake / eel** — correct phylum-ish, but the tile must say
  "this is a FISH that is long", not "this is a worm". At ~8x8 px there is **no
  visible head landmark** (no eye notch, no mouth, no gill line) and **no tail
  fin** — the far end just tapers to nothing. Without a head cue and a tail-fin
  cue, a long filled curve is indistinguishable from a snake or a smooth arc.
- It is **stylistically inconsistent** with its siblings. `cod-like.svg`,
  `silver-shoaler.svg` etc. are small (`viewBox 0 0 64 40` / `0 0 70 40`),
  hand-authored, *multi-path* icons with commented, tweakable geometry and explicit
  fin shapes. This icon is a 1536x770 single-path machine trace. That mismatch
  alone is worth flagging: the set should be one coherent authored family, and a
  potrace outlier (a) can't be iterated, (b) renders at a different effective
  weight/detail level, and (c) is the one that under-performs.

The sub-scores (`recognizability 70`, `diagnosticAccuracy 80`, `clarity 90`,
`distinctiveness 80`) confirm the diagnosis: it is *clear* (one clean shape) and
*distinct* (nothing else is a long curve), but **recognizability is the weak axis**
— people aren't reliably reading it as the intended thing (a long fish), because the
bend pushes "boomerang" and the missing head/tail push "snake".

---

## 2. Diagnostic priorities (silhouette-only, ranked)

What must survive the flat single-colour teal mask at ~8x8 (Rung-2 rows render the
silhouette at "2x", i.e. an `h-20 w-20` box, so a touch more headroom than Rung-1,
but still tiny). Ranked by how much each earns its pixels:

1. **Extreme length-to-depth ratio (THE give-away).** The body must read as *much*
   longer than it is deep — target roughly **6:1 to 8:1**. This is the single trait
   that separates the tile from every normal-proportioned fish sibling (cod, wrasse,
   silver-shoaler all sit around 2.5:1–3:1). If only one feature reads, it must be
   "very long, very thin." Reads well even at icon size — elongation is a gestalt
   property, not a detail.

2. **A clear fish head + tiny eye notch (the "it's a FISH, not a snake/boomerang"
   guard).** A blunt, slightly deeper rounded head at one end, with a small **eye**
   cue and a hint of **mouth/jaw**. The eye is best done as a tiny *negative-space
   hole* (a punched dot) since stroke colour is unavailable — negative space is the
   only way to carry an eye on a flat mask. Even a 1px eye-hole flips the read from
   "worm" to "fish" because it asserts a head/front. Reads at small size **only if**
   the head end is visibly deeper than the tail end (asymmetry = directionality =
   animal, not a symmetric arc).

3. **A small tail fin (the second "it's a fish" guard).** A modest fin flare at the
   far end — even a small leaf/lance or a shallow fork. This stops the body
   tapering to an ambiguous point (snake/boomerang) and asserts a posterior end.
   Conger and butterfish have a continuous, low, rounded tail confluent with the
   dorsal/anal; a stickleback has a small distinct caudal. A **small rounded/lance
   tail** is the safe generic choice. Reads at small size as "the pointy end has a
   little flag = fish tail."

4. **Gentle curve, NOT a strong bend (clarity fix).** Replace the boomerang arc with
   either a near-straight body or a *shallow* single S (a gentle sine, amplitude
   well under the body length). The body should read as a relaxed swimming eel, not
   a bent stick. A gentle curve adds life (and disambiguates from a ruler/stick)
   while a hard bend imports "boomerang." This is the literal fix Gemini asked for.

5. **(Nice-to-have) a low continuous dorsal/anal margin.** Conger and butterfish
   have a long unbroken low fin running most of the body. A faint continuous
   bottom/top fin band reinforces "eel/ribbon fish." This is a small-size luxury —
   keep it subtle so it doesn't thicken the body and kill the thin read; drop it
   first if it muddies anything.

**What does NOT read at small size (don't spend pixels on):** fin rays, gill covers,
spines (the stickleback's namesake spines are invisible at 8px and would just look
like noise), lateral-line, mouth detail beyond a hint. Lead with silhouette gestalt.

---

## 3. Distinguishability matrix

For each sibling in the fish Rung-2 list, the one outline cue that keeps `long-skinny`
distinct, plus the inanimate/animal guards.

| Sibling tile | Its silhouette | The cue that keeps `long-skinny` distinct |
|---|---|---|
| **`silver-shoaler`** ("Silver swimmers") | Two normal-proportioned fish, forked tails (~2.7:1) | **Ratio + count.** long-skinny is ONE body at 6–8:1; shoaler is multiple stubby fish. The extreme length is unmistakable against the chunky pair. |
| **`cod-like`** ("Cod-shaped") | Robust ~2.5:1 body, three dorsal fins, blunt head | **Ratio.** Cod is deep-ish and finny; long-skinny is a thin ribbon with almost no body depth. Keep long-skinny's max depth ≤ ~1/6 of its length so there's no overlap. |
| **`wrasse`** ("Wrasses") | Deep oval body, pointed snout, single long dorsal (~2:1, the *deepest* sibling) | **Ratio (maximally opposed).** Wrasse is the deep extreme; long-skinny is the slender extreme. These two should be visually antipodal — make long-skinny conspicuously the thinnest tile. |
| **`bottom-sitter`** ("Gobies & dragonets") | Small fish perched on a **ground line** (seabed) | **No ground line + extreme length.** long-skinny must NOT sit on a horizontal baseline (that's the bottom-sitter signature) and is far longer/thinner than a stubby goby. Keep it free-floating, gently angled. |
| **`bottom-other`** ("Other bottom fish") | Chunky/odd seabed fish (gurnard/red mullet/scorpion), likely on/near a ground line | **No baseline + ratio.** Same guard as bottom-sitter; these are deep-bodied bottom forms, the opposite of a thin ribbon. |
| **`shark`** ("Shark-shaped") | Classic shark profile: tall triangular dorsal + strong heterocercal (upper-lobe) tail | **No tall dorsal, symmetric small tail.** long-skinny has a low/continuous fin margin and a small even tail, never a tall triangular fin or a big asymmetric shark tail. |

**Anti-boomerang / anti-snake guards (the load-bearing fixes):**

- **Anti-boomerang:** kill the strong arc — use straight or a *shallow* S only; and
  give one end a deeper head and the other a tail fin so the form is **asymmetric**
  (boomerangs/bananas are symmetric tapered arcs). Asymmetry + a fin = "animal."
- **Anti-snake:** assert a **head** (deeper rounded front + negative-space **eye**)
  and a **tail fin**. A snake silhouette has neither a fin nor an eye-hole at this
  scale. Either cue alone substantially de-snakes it; both together make it a fish.

---

## 4. Concrete redraw spec

Replace the potrace blob with a clean, hand-authored, multi-path icon matching the
sibling family (small viewBox, commented paths, flat `fill="currentColor"`).

- **Canvas:** `viewBox="0 0 72 40"` — slightly wider than the cod (`64x40`) /
  shoaler (`70x40`) to give the elongate body room to span horizontally while
  staying in the family's 40-tall band. The mask renders `maskSize: contain`,
  centred, so the icon self-scales; the wide box just lets the body be long without
  clipping.
- **Orientation:** horizontal, head **left**, tail **right** (matches cod and
  shoaler, so the whole Rung-2 list faces the same way — consistency aids scanning).
- **Body:** one long tapering ribbon spanning ~`x6 → x60`, so ~54 units long.
  **Max depth ~8–9 units** at the head third, tapering to ~3 units before the tail.
  That gives a ~6:1 length:depth read — unambiguously the thinnest tile. Build it
  as a single closed path: a top edge and a bottom edge that are **gently S-curved
  in parallel** (both edges follow the same shallow sine so the *thickness* stays
  roughly constant while the *centreline* gently waves). Amplitude of the wave:
  small — about ±4 units off the midline (≈ y20). NOT a boomerang bend.
- **Head (left):** the body's left end is the deepest and **rounded** (a soft blunt
  nose), clearly fuller than the tail end. This asymmetry is the anti-boomerang and
  anti-snake worker.
- **Eye:** a small **negative-space circle** punched in the head, ~`r1.1` at roughly
  `(12, 18)`. Implement as a separate sub-path with opposite winding (even-odd /
  nonzero hole) so the teal mask shows a hole = an eye. This is the strongest
  single "it's a fish, and this is the front" cue available on a flat mask.
- **Mouth hint (optional):** a tiny notch at the very front of the nose (a small
  concavity in the outline ~`y19–20`) reads as a slightly open jaw. Keep subtle.
- **Tail fin (right):** a small symmetric **lance/leaf** flare at `x60 → x66`,
  ~6–7 units tall — bigger than the body is deep there, so it reads as a distinct
  fin, but small and even (NOT the tall asymmetric shark tail, NOT a deep clupeid
  fork). A gently rounded paddle is the safe generic eel/butterfish tail.
- **Continuous low fin (optional, recommended subtle):** a faint shallow scalloped
  band along the **lower** margin of the rear two-thirds (the long anal/ventral fin
  of an eel/butterfish), height ≤1.5 units. Adds "ribbon fish" character without
  thickening the body. Drop if it muddies the thin read at small size.

**Straight-ish vs gentle curve — recommendation: GENTLE SINGLE S (shallow).**
A perfectly straight body risks reading as a ruler/stick/baseline and is lifeless;
a strong curve reimports the boomerang. A *shallow* single S (one gentle wave,
amplitude ≪ length) is the sweet spot: it reads as a relaxed swimming eel (alive,
fish-like) while staying far from "bent boomerang." This is exactly what Gemini's
note asks for ("a straighter or gently curved form"). Keep the wave subtle enough
that the overall impression is still "a long thin thing," with the curve adding life
rather than dominating.

---

## 5. Proposed redrawn SVG (DRAFT — for review)

Hand-authored, multi-path, flat `fill="currentColor"`, family-consistent. The eye is
a negative-space hole (uses the default nonzero rule with a reversed sub-path winding
inside the body path so it punches through). Geometry is a first pass to be
eyeballed at render size and tuned.

```svg
<svg width="100%" height="100%" aria-hidden="true" fill="currentColor" viewBox="0 0 72 40" xmlns="http://www.w3.org/2000/svg">
  <!-- long slender eel/ribbon body: blunt rounded head (left), gentle single S,
       tapering toward the tail (right). ~6:1 length:depth — the give-away.
       The reversed inner sub-path punches the eye as negative space. -->
  <path fill-rule="evenodd" d="
    M7 20
    C7 16 9.5 13.8 13 13.6
    C22 13 31 16 40 18
    C48 19.6 55 21 60 22.4
    C60 23.6 60 24.4 60 25.6
    C55 24.4 48 23.2 40 22.2
    C31 21 22 19.8 14 21.6
    C10 22.4 7.4 22 7 20
    Z
    M12.6 18.4
    C11.5 18.4 11.5 19.9 12.6 19.9
    C13.7 19.9 13.7 18.4 12.6 18.4
    Z
  "/>
  <!-- small even tail fin: a rounded lance, taller than the slim body end but
       symmetric and modest (NOT a forked clupeid or an asymmetric shark tail) -->
  <path d="M60 21 C65 17.5 68 16.8 69 16.8 C67.6 19.6 67.2 21 67.2 22.3 C67.2 23.6 67.6 25 69 27.8 C68 27.8 65 27.1 60 24.6 Z"/>
  <!-- faint long low fin along the rear underside (eel/butterfish character);
       kept very shallow so it doesn't thicken the thin-body read -->
  <path d="M30 21.4 C34 22.7 40 23.4 47 23.9 C44 24.7 38 24.5 31 23.2 C30.4 23 30 22.2 30 21.4 Z"/>
</svg>
```

Notes on the draft:
- The body is intentionally near-constant in thickness with a slight downward then
  upward wave (gentle S), head end blunter/deeper than the tail end — asymmetric, so
  it can't read as a symmetric boomerang.
- `fill-rule="evenodd"` + the small reversed circle sub-path renders the **eye as a
  hole**; if the punch doesn't appear at render size, bump the eye radius slightly
  or move it forward/up — it must be visibly inside the head mass.
- The tail and low-fin coordinates are first-pass; expect to nudge them after a
  render. The low fin is the first thing to delete if the icon looks busy or the
  body looks too deep at 8px.
- This is a DRAFT pending review; treat the geometry as a starting point, not final.

---

## 6. Open questions / tradeoffs + verification

**Which species to lead the silhouette with?** The three members are genuinely
different animals:
- **Conger eel** — true eel: cylindrical, no obvious tail fin (dorsal/anal/caudal
  are one continuous low margin), no scales, blunt head.
- **Butterfish** — laterally compressed ribbon, a single long low dorsal running the
  whole back, small rounded tail, a row of eye-spots (invisible at icon size).
- **Fifteen-spined stickleback** — slender but a *distinct* fish: pointed snout, tiny
  isolated dorsal spines, a small distinct caudal fin.
  
  **Recommendation: lead with the generic eel/ribbon gestalt** (blunt-headed,
  uniformly slender, gentle S, small modest tail, low continuous fin hint). It is the
  modal read for "long and skinny," it is the most *un-fishlike* of the three so it
  needs the head/eye/tail guards most, and it averages well across all three. The
  stickleback's spines and the butterfly's eye-spots simply don't survive 8px, so
  optimising for them would waste pixels. The label "Long and skinny" already does
  the conceptual grouping; the icon only needs to say "a fish much longer than it is
  deep."

**Tradeoffs to weigh on review:**
- *Low continuous fin vs clean ribbon* — the fin adds eel character but risks
  thickening the body and weakening the all-important thin read. Render both with and
  without before committing.
- *Tail-fin size* — too big drifts toward "normal fish"; too small drifts back toward
  "snake/boomerang." Aim for "small but unmistakably a fin."
- *Eye-hole legibility* — a punched hole can fill in at very small sizes /
  low-DPI mask rasterisation. Verify the eye actually reads at the Rung-2 `h-20 w-20`
  render; if not, enlarge or drop it and lean harder on head-depth asymmetry + tail.
- *viewBox width* — 72 wide vs the cod's 64 is a small family inconsistency; acceptable
  because the elongate subject needs the room and `maskSize: contain` normalises it.

**Verification step (before/after):**
1. Drop the candidate in as `long-skinny.svg` on a branch (do not touch other assets).
2. Render at the actual Rung-2 size (`h-20 w-20`, flat teal mask via
   `MaskSilhouette`) and eyeball it next to the five fish siblings — confirm it is
   visibly the thinnest, faces left like the others, and reads as a fish.
3. Re-run the silhouette scorer: **`npm run score:silhouettes`** (the Gemini vision
   pass that produced `implementation/2026-06-17/silhouette-scores.json`).
4. **Targets:** `score > 80` (up from 78), `readsAs` no longer contains
   "boomerang" (ideally reads as "eel" / "long fish" / "fish"), and `recognizability`
   up from 70 (that was the weak axis). `distinctiveness` should stay high (it's
   already the only long-thin tile).
5. If still flagged as boomerang/snake: straighten the body further and/or enlarge
   the tail fin and eye; re-score. Iterate the geometry, not the authoring style.
6. Confirm `npm run lint` / `lint:tokens` and the existing `body-forms.test.ts`
   ceiling/coverage guards are unaffected (this is an asset swap; no data/code change).
```
