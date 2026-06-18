# Silhouette review + redraw plan — `bottom-other` ("Other bottom fish")

**Status:** DRAFT for review. No live SVG or app code modified by this document.
**Tile:** Rung-2 fish family-gestalt option `fishGroup = bottom-other`, label **"Other bottom fish"**.
**Asset:** `public/silhouettes/forms/bottom-other.svg`
**Date:** 18 Jun 2026
**Author of plan:** silhouette review pass (Claude orchestration).

---

## 0. Context recap (why this tile exists, and the constraint)

On 18 Jun 2026 the `bottom-sitter` group (9 species, at the 10-ceiling and
heterogeneous) was split in two in `src/lib/idflow/body-forms.ts`:

- `bottom-sitter` → **"Gobies & dragonets"** — the small, smooth, round-headed
  perch-and-dart fish.
- `bottom-other` → **"Other bottom fish"** (THIS tile) — the chunkier/odder
  seabed fish so that *every gurnard has a home*.

This tile covers **7 species**: Red mullet, Long-spined sea scorpion, Shanny
(blenny), and four gurnards (Grey, Red, Tub, Streaked). It is gurnard-heavy
(4 of 7) and the gurnard is by far the most iconic + numerous member, so the
silhouette **should lead with the gurnard gestalt**.

**Hard rendering constraint** (from `TileGate.tsx` `MaskSilhouette`): the SVG is
painted as a **flat single-colour teal mask** via CSS `mask-image` +
`background-color: currentColor`. There is:

- NO stroke colour, NO shading, NO gradient, NO interior line work that reads as
  anything other than "filled" vs "empty".
- Only the **filled outline** and the **negative space between separate filled
  paths** carry information. A thin gap between two paths reads as a notch; a
  path drawn over another just fuses into one blob.
- Display is small: an 8×8 area in the grid; rendered at `h-20 w-20` (the "2x"
  silhouette) in the Rung-2 **list** variant rows, `maskSize: contain`,
  centred. Detail finer than ~1px at that scale disappears.

**Scoring baseline:** `bottom-other` is **NEW (18 Jun) and is NOT in**
`implementation/2026-06-17/silhouette-scores.json` (confirmed — the file ends at
`form:fish:shark`; only the six pre-split fish forms are scored). Treat it as
**unscored**. Its sibling `bottom-sitter` scored **85 ("strong")** in that pass
("The horizontal line clearly indicates the seabed, reinforcing the
'bottom-sitter' concept"). Our target is **>80** AND **demonstrably not
confusable with `bottom-sitter`**.

---

## 1. Current read — walking the existing SVG

The current `public/silhouettes/forms/bottom-other.svg` (`viewBox="0 0 64 40"`):

| Path | Geometry | What it contributes |
|---|---|---|
| Seabed line | `M2 35 … L2 36.6 Z` — a ~1.6-tall full-width bar at y≈35 | Good. The "on the bottom" cue, shared deliberately with `bottom-sitter` (y≈34 there). |
| Body | `M8 19 C9 13.5 14 11 22 11 C33 … 50.5 18 …` | A blunt-headed left, body tapering right to ~x50. Elongated, gently humped on top, flat-ish belly. Reads as a generic fish body. |
| Spiny first dorsal | `M19 11 C20.5 6.5 … Z` | A small ~5-tall triangular bump near the head. Tiny. |
| Soft second dorsal | `M31 11 C32.5 7.3 … Z` | A second small bump. Two-bump dorsal profile is correct for a gurnard, but both bumps are small (~3-4 units) and barely clear the back. |
| Wing pectoral | `M19 22 C12.5 24.5 8.5 30 8.5 36.5 … Z` | A fan that drops from x≈19 down to the seabed (y≈36.5). This is the intended gurnard give-away. |
| Forked tail | `M50.5 18 L58.5 13.5 … Z` | A forked caudal at the right. |

**Assessment — does it lead with the gurnard gestalt? Partially, and weakly.**

1. **The wing pectoral is the right idea but mis-placed and ambiguous.** It hangs
   *down and back* (from x19 toward x8.5/y36.5), tucking into the body's lower-left
   and *touching the seabed*. At small size it fuses visually with the seabed line
   and the body, reading as "fish with a big belly / fish sitting on the bottom" —
   **exactly the bottom-sitter read**, not "fish with wings spread". A gurnard's
   signature is a pectoral that **fans UP and OUT like a butterfly/bat wing**,
   held away from the body, with a distinct gap of negative space between fin and
   flank. The current fan has no such gap.
2. **Compare directly to `bottom-sitter`** (which scored 85): bottom-sitter is
   `M9 21 C10 14.5 17 12 26 12 … 49 20 …` with a fan pectoral
   `M18 30 C13.5 32.5 …` dropping to y38.8. **The two bodies are nearly the same
   length, both blunt-headed-left, both have a single big down-dropping fan
   pectoral, both sit on a seabed line.** The ONLY differences in the current
   `bottom-other` are: a slightly longer/flatter body, two small dorsal bumps
   instead of one, and a forked (vs short) tail. **These differences are too
   subtle to survive the flat-mask + 8px render.** A novice glancing at the two
   tiles will see "two fish on the seabed" and not know which is the gurnard.
3. **The armoured/spiny head is essentially absent.** The head is a smooth blunt
   curve, identical in character to bottom-sitter's. Nothing reads as "armour
   plates" or "bony spiny head". The dorsals are too small to register as
   "spiny".
4. **The forked tail is a reasonable secondary cue** (gurnards have a forked/
   emarginate tail vs the goby's rounded one) but it is a weak, small detail and
   not the lead signal.

**Verdict:** the current icon does NOT clearly lead with the gurnard gestalt and
is **at high risk of confusion with `bottom-sitter`**. It needs a redraw whose
single dominant, unmistakable feature is the **gurnard's spread wing pectoral**,
visibly distinct from the goby's tucked fan.

---

## 2. The `bottom-other` vs `bottom-sitter` problem (MOST IMPORTANT)

This is the section that matters. The two tiles are **adjacent rows in the same
Rung-2 list** ("Gobies & dragonets" directly above "Other bottom fish"), both
showing a teal fish on a seabed line at the same 20×20 size. If a beginner can't
tell them apart at a glance, the split has failed.

### How similar they are right now

Overlaying the two current SVGs:

| Feature | `bottom-sitter` (Gobies & dragonets) | `bottom-other` (current) | Discriminating? |
|---|---|---|---|
| Seabed line | bar at y≈34 | bar at y≈35 | No (shared by design) |
| Body length | x9→x49 (~40 wide) | x8→x50 (~42 wide) | No — basically equal |
| Head | blunt, smooth, left | blunt, smooth, left | No — identical character |
| Belly | flat along seabed | flat-ish | No |
| Pectoral fin | one big fan dropping to y38.8 | one big fan dropping to y36.5 | **No — same gesture** |
| Dorsal | one small bump | two small bumps | Marginally (too small to read) |
| Tail | short triangle | forked triangle | Marginally |

**Five of seven features are effectively identical.** The split is invisible at
glance scale. This is the core defect.

### The deliberate contrast to design in

Make **this** tile read as a **BIGGER, ARMOUR/SPIKY-HEADED fish with WINGS
SPREAD**, against the goby's *small, smooth, plump, tucked* form. Concrete moves:

1. **Wing pectorals are the headline — and they must SPREAD, not tuck.**
   - Goby fan (bottom-sitter): a single modest fan that *drops down* and *hugs*
     the lower body, reading as "fish resting, fins down".
   - Gurnard wing (bottom-other): a **large, swept pectoral that fans UP-and-OUT
     from the flank**, with a **clear gap of negative space between the wing and
     the body** so the wing reads as a separate spread structure (butterfly/bat
     wing), not part of the belly. Make the wing **as tall as the body or
     taller** and **lobed/scalloped** at its trailing edge. This is the single
     biggest lever; it is what makes a gurnard a gurnard.
   - Consider **two wing tips** (the fin held semi-open) or **finger-like
     walking rays** at the wing's leading edge (the gurnard's free pectoral rays
     it "walks" on) — see §5 for whether these survive the render.

2. **Make the body visibly BIGGER / chunkier-headed than the goby.** The goby is
   small and plump; the gurnard has a **large, deep, armoured head tapering
   sharply to a slim tail** (a wedge / "tadpole-on-the-bottom" profile). Give
   `bottom-other` a **noticeably bigger blunt/blocky head** and a more
   **wedge-shaped taper** so the overall mass sits forward — opposite to the
   goby's even sausage.

3. **Armour / spiky head.** A gurnard's head is bony-armoured with a steep
   forehead and (in some) a snout step/spines. In flat-mask terms, give the head
   a **steep, slightly angular/stepped top profile** (not the goby's smooth
   dome) and a **small spike or two** off the gill/cheek so the silhouette edge
   reads "armoured/spiny" rather than "smooth round goby".

4. **Two distinct, taller dorsals.** Gurnards have two separate dorsal fins; the
   first is **spiny and taller**. Draw the first dorsal as a **tall, clearly
   pointed triangle** (not a 4-unit bump) with a **visible gap of negative space**
   before the second (lower, longer) dorsal. The two-peak back-profile, with a
   real notch between, is a secondary contrast cue (the goby has one low dorsal).

5. **Keep the forked tail** (gurnard) vs the goby's short/rounded tail — but treat
   it as tertiary.

**Priority of contrast cues (what a beginner will actually use):**
spread up-and-out wing (with body-to-wing negative-space gap) >> bigger
blocky/wedge head >> tall pointed first dorsal + notch >> spiky head edge >>
forked tail.

> Design rule: the wing must be the one feature that survives shrinking the icon
> to 8px. If only one thing reads, it must read as "this fish has its wings
> spread" — that is what no goby tile will ever show.

---

## 3. Diagnostic priorities (silhouette-only, ranked)

For "gurnard / armoured walking bottom fish", in order of glance value:

1. **Spread wing pectoral fans** — large, swept UP-and-OUT from the flank, with a
   negative-space gap between fin and body. THE signature. Ideally lobed/
   scalloped trailing edge; bonus: a second wing tip or finger-rays.
2. **Big blunt/blocky armoured head with a wedge taper** — mass forward, tapering
   to a slim tail. Distinguishes from the even goby sausage.
3. **Two separate dorsal fins, first tall + pointed (spiny), with a notch
   between** — the two-peak back.
4. **Steep/angular (armoured, spiny) head edge** — vs the goby's smooth dome; add
   a small head/cheek spike.
5. **Forked / emarginate tail** — vs the goby's rounded tail.
6. **Seabed line** — REQUIRED (shared with bottom-sitter); it keeps the fish in
   the correct Rung-2 "bottom fish" mental column. Do NOT drop it.

Note features 2–5 are *reinforcers*; feature 1 alone must do the heavy lifting.

---

## 4. Distinguishability matrix

The one outline cue that separates `bottom-other` from each sibling Rung-2 fish
tile. `bottom-sitter` first and most detailed (the critical pair).

| Sibling | Their silhouette | The ONE cue that separates `bottom-other` |
|---|---|---|
| **`bottom-sitter`** (Gobies & dragonets) — THE critical pair | Small, smooth, plump even-sausage body on a seabed line; one modest fan pectoral **tucked down** against the belly; one low dorsal; rounded short tail; smooth dome head. | **The pectoral.** Ours is a **large wing SPREAD up-and-out with a clear negative-space gap to the body**, plus a **bigger, blockier, spikier head** and a **tall pointed first dorsal**. Theirs reads "small smooth fish resting, fins down"; ours reads "bigger armoured fish, wings spread, walking". Both keep the seabed line — the wing-spread + head bulk is what tells them apart. |
| `cod-like` (Cod-shaped) | Chunky mid-water fish, **three separate dorsal fins**, **no seabed line**, neutral horizontal posture. | **The seabed line** (ours has it, cod doesn't) + ours has wing pectorals and a forward-heavy wedge, not three even dorsals on a level body. |
| `wrasse` (Wrasses) | Deep oval body, pointed thick-lipped snout, **single long-based dorsal**, rounded tail, **no seabed line**, mid-water. | **The seabed line + spread wing pectoral.** Wrasse is a deep mid-water oval with one long dorsal; ours sits on the bottom with wings out and a two-peak spiny back. |
| `silver-shoaler` (Silver swimmers) | Slim torpedo, deeply forked tail, **two small fish / open-water**, **no seabed line**. | **The seabed line + bulky armoured head.** Silver swimmer is a slim free-swimming torpedo; ours is a forward-heavy bottom fish with spread wings. |
| `long-skinny` (Long and skinny) | Eel-like, **much longer than deep**, gently bent/curved, tiny or no obvious fins. | **Body proportion + wings.** Ours is a normal length-to-depth bottom fish with prominent wing pectorals and a distinct head/tail; the eel is a near-uniform ribbon with no wing. |
| `shark` (Shark-shaped) | Classic shark: pointed snout, tall triangular dorsal, heterocercal (upper-lobe-dominant) tail, no seabed line. | **Whole gestalt + seabed line.** Shark is a streamlined predator silhouette in open water; ours is a bottom-sitting wing-spread armoured fish. |

The seabed line resolves all four mid-water siblings (cod/wrasse/silver/shark)
on its own. The whole design budget for `bottom-other` should therefore go into
the **`bottom-sitter` contrast** (wing-spread + head bulk), because that is the
only sibling that shares the seabed line.

---

## 5. Concrete redraw spec

**Recommended viewBox:** keep **`0 0 64 40`** — identical to all sibling fish
forms (`bottom-sitter`, `cod-like`, etc.) so the mask-`contain` scaling is
consistent across the Rung-2 list rows. Do NOT change the canvas; consistency of
relative size between adjacent rows is part of the read.

**Overall composition (left = head, right = tail, seabed along the bottom):**

- **Seabed line:** keep a full-width bar, ~1.6 tall, at **y≈35** (matches
  bottom-sitter's y≈34 closely so the two read as the same "ground"). Path like
  the existing `M2 35 L62 35 L62 36.6 L2 36.6 Z`.

- **Body — bigger blocky head, hard wedge taper.** Make the head end visibly
  **deeper and blockier** than bottom-sitter and taper **harder** to a slim tail,
  so mass sits forward (gurnard wedge). Suggested envelope: head top at
  **y≈12**, head bottom near the seabed (**y≈30**) giving a deep front; body
  tapers to a narrow caudal peduncle at **x≈48, y≈22–25**. Give the **top of the
  head a steep, slightly angular rise** (armoured forehead) rather than a smooth
  dome — e.g. a near-straight diagonal from the snout up to the first-dorsal
  base.

- **THE WINGS (headline).** Draw the pectoral as a **large fan that springs from
  the mid-flank (~x22–26) and sweeps UP-and-BACK and OUT**, its tip reaching
  **above the body's mid-line or higher** (e.g. up to **y≈8–14** and back to
  **x≈40**), with a **deliberate sliver of negative space (a 1–2 unit gap)
  between the wing's lower edge and the body's back**, so the wing reads as a
  *separate spread structure*, not a dorsal hump. Scallop/lobe the trailing
  edge with 2–3 shallow concave arcs (reads as a fanned, rayed wing). This is a
  **separate `<path>`** from the body; the gap between them is what sells "wing".
  - **Walking finger-rays (optional, test it):** at the wing's **leading/lower
    edge near the head**, add **2–3 short stubby prongs** pointing down-forward
    toward the seabed (the free pectoral rays a gurnard "walks" on). At 8px these
    may blur into the body; at the 20×20 list size they likely read. Ship them as
    small but present, and let the Gemini re-score + an eyeball at both sizes
    decide whether to keep or simplify them. They are a strong, almost
    cartoon-recognisable gurnard cue if they survive.

- **First dorsal — tall, pointed, spiny.** A clearly **pointed triangle** rising
  from the back near **x≈18–22** to **y≈6–8** (taller than the current ~y6.5 bump
  but as a sharp spike, not a soft hump). Separate `<path>`.

- **Second dorsal — lower, longer, with a notch.** A lower, more rectangular/
  rounded fin from **x≈28–42**, peaking ~**y≈10**, with a **visible gap of
  negative space** between it and the first dorsal (the two-peak back). Separate
  `<path>`.

- **Spiky head edge (optional reinforcer):** a small spike off the cheek/gill
  cover (~x10–12, pointing back-up) so the head outline reads "armoured/spiny".
  Keep it tiny so it doesn't fuse into a blob.

- **Forked tail:** keep the emarginate fork at the right (~x48→x58), like the
  current `M50.5 18 L58.5 13.5 L56 18.5 L58.5 23.5 Z` but re-anchored to the new
  narrower peduncle.

**Negative-space discipline (flat-mask rules):**
- The wing must NOT overlap-and-fuse with the body — leave the 1–2 unit gap.
- The two dorsals must have a real gap between them.
- Do NOT let the wing touch the seabed line (that's the bottom-sitter "fins down,
  resting" read). The wing should float ABOVE/clear of the seabed.
- Everything that should read as one fish (body + tail) can share/abut edges;
  everything that should read as a *spread appendage* (wing, dorsals) needs a
  gap.

---

## 6. Proposed redrawn SVG (DRAFT for review)

Flat `fill="currentColor"` mask style, `viewBox="0 0 64 40"`. The wing is a
separate path held clear of the body with a negative-space gap; the head is
blockier and the wedge taper sharper than bottom-sitter; two distinct dorsals
with a notch; optional walking finger-rays as a separate small path (drop if it
muddies at 8px).

```svg
<svg width="100%" height="100%" aria-hidden="true" fill="currentColor" viewBox="0 0 64 40" xmlns="http://www.w3.org/2000/svg">
  <!-- the seabed it walks on (shared cue with bottom-sitter) -->
  <path d="M2 35 L62 35 L62 36.6 L2 36.6 Z"/>

  <!-- big blocky armoured head (left), deep front, hard wedge taper to a slim
       caudal peduncle. Steep angular forehead, not a smooth goby dome. -->
  <path d="M7 28
           C6 22 7.5 16 12 13.5
           C15 12 19 11.5 23 12
           C33 13 42 16 48 20.5
           C45 22.5 40 23.8 34 24.4
           C26 25 17 26.2 11 28.6
           C9.2 29.3 7.6 29.4 7 28 Z"/>

  <!-- spiny FIRST dorsal: tall pointed triangle (separate; notch before #2) -->
  <path d="M18 13.2 L22 5 L25.5 13.6 C23 13 20.5 13 18 13.2 Z"/>

  <!-- soft SECOND dorsal: lower, longer, clear negative-space gap from #1 -->
  <path d="M29 13.6 C31 9.5 38 9 43 11.4 C40 12.2 35 13 29 13.6 Z"/>

  <!-- THE WING: big pectoral fanned UP-and-OUT from the mid-flank, held clear of
       the body by a negative-space sliver, scalloped trailing edge. The gurnard
       give-away — must read as a spread wing, not a belly. -->
  <path d="M24 22
           C20 15 16 11 11.5 9.5
           C13 13 14.5 16.5 15.5 19.5
           C12.5 18.5 9.5 18 6.5 18.6
           C10 21 13.5 23 17 24
           C13.5 25.5 10.5 27.8 8.5 30.5
           C13 28.8 18.5 26 22.5 23.4
           C23 23 23.4 22.4 24 22 Z"/>

  <!-- walking finger-rays (gurnard signature): 3 short prongs down-forward
       toward the seabed. DRAFT — drop or thicken if they blur at 8px. -->
  <path d="M13 27.5 L11.5 31.5 L13.2 31.4 L14.4 27.8 Z"/>
  <path d="M16 28 L15 32 L16.7 32 L17.6 28.3 Z"/>
  <path d="M19 28.4 L18.4 32.2 L20.1 32.3 L20.6 28.7 Z"/>

  <!-- forked tail on the slim peduncle -->
  <path d="M48 20.5 L57.5 15.5 L54.5 20.8 L57.5 26 Z"/>
</svg>
```

> Notes for the implementer:
> - The wing path is intentionally a *closed lobe* sitting on the lower-left
>   flank with the gap to the body created by NOT joining it to the body path.
>   If at render the wing reads as a separate "blob" floating off the fish,
>   nudge its top-right anchor (the `M24 22 … C23 23.4 22.4 24 22 Z` end) closer
>   to the body so they *abut at one point* but still leave the wing arcing out.
> - If the three finger-ray paths blur into a smear at 8px, **delete them** —
>   the wing + head + dorsals must stand alone. They are a "nice if it survives"
>   cue, not load-bearing.
> - First-dorsal apex (y=5) is the tallest point; verify it doesn't collide with
>   the wing tip after any nudging.

---

## 7. Open questions / tradeoffs + verification

### Can one silhouette fairly represent gurnard + sea scorpion + shanny + red mullet?

This is a genuine **heterogeneous catch-all**, and the answer is "lead with the
plurality, accept the tail":

- **Gurnards (4/7)** — the wing-pectoral gurnard gestalt fits them perfectly.
  Leading with it is correct.
- **Long-spined sea scorpion (1/7)** — big armoured spiny head, large pectorals,
  bottom ambusher. The "bigger, spiky-armoured-head, broad-pectoral bottom fish"
  silhouette **also fits it reasonably well** — arguably the second-best fit
  after gurnards. Good.
- **Red mullet (1/7)** — slimmer, barbel-chinned, NOT wing-pectoralled. The
  gurnard silhouette is a **weak fit** for red mullet (it has no wings and a more
  streamlined body). Tradeoff accepted: red mullet is 1 of 7 and shares the
  "reddish forward-heavy bottom forager" niche; a beginner who saw a red mullet
  will still land here via the "other bottom fish" label even if the icon doesn't
  picture it. We are NOT going to draw a barbel (won't read at 8px and would
  fight the wing).
- **Shanny / blenny (1/7)** — blunt-headed bottom-clinger, no wings, more of a
  long-skinny-adjacent shape. Also a **weak icon fit**. Same acceptance: the
  label carries it; the icon leads with the numerically dominant gurnard.

**Conclusion:** one silhouette canNOT depict all four equally. The right call
(consistent with the whole "lead with the iconic/numerous member" approach used
across these tiles) is to make it an **unmistakable gurnard**, lean on the
**"Other bottom fish" text label + the inline Examples accordion** (the Rung-2
list rows expand to show photos of all members via `renderExpanded`) to carry
the non-gurnards, and accept that red mullet/shanny are represented by membership
rather than likeness. Flag this explicitly to the marine-biologist reviewer.

**Alternative considered (rejected):** a more neutral "generic chunky bottom
fish" silhouette that fits all four equally well — rejected because it would be
*even harder* to separate from `bottom-sitter` (the whole problem in §2). A
distinctive-but-imperfect gurnard beats a neutral-but-confusable blob.

### Other open questions for review

1. **Finger-rays in or out?** They are the most charming gurnard cue but the most
   fragile at 8px. Decide via the dual-size eyeball + Gemini re-score.
2. **Wing-up vs wing-down.** This plan commits to **wing UP-and-out** to maximise
   contrast with bottom-sitter's down-tucked fan. If a reviewer feels "up" reads
   as a dorsal/sail rather than a pectoral, the fallback is wing **out-and-level**
   (horizontal spread) — still clearly distinct from the goby's tucked fan, just
   less butterfly-like.
3. **Should we also nudge `bottom-sitter`** to make its pectoral read even more
   "tucked/down/resting" to widen the gap? Out of scope for THIS tile's plan, but
   worth noting: the contrast is a *pair* property. If `bottom-other` alone can't
   get clear daylight from it, a tiny tweak to bottom-sitter's fan is the lever.
   (bottom-sitter scored 85 standalone, so touch it only if the pair-confusion
   test below fails.)

### Verification step (required before shipping)

1. **Render at both sizes.** Rasterise the new SVG and eyeball it at ~8px (grid
   icon) AND ~40px (the `h-20 w-20` "2x" list row). Confirm the wing reads as a
   spread wing at BOTH sizes; if not, simplify (drop finger-rays first, then
   reduce wing scalloping).
2. **Run the scorer:** `npm run score:silhouettes` (→ `scripts/score-silhouettes.ts`,
   Gemini vision). It will add a `form:fish:bottom-other` entry to
   `implementation/2026-06-1X/silhouette-scores.json`. **Target score > 80** with
   `verdict: strong` (matching/beating bottom-sitter's 85), `readsAs` containing
   "gurnard"/"wing"/"bottom fish", and `confusableWith: "none"`.
3. **Explicitly test the pair.** This is the acceptance gate the generic scorer
   may not cover: ask the Gemini pass (or a targeted prompt) to look at
   `bottom-other.svg` and `bottom-sitter.svg` **side by side** and answer "which
   is the gurnard / bigger armoured wing-fish, which is the small goby?" — it must
   answer correctly and call them **clearly distinguishable**. If it confuses
   them, the redraw has not solved §2 regardless of the standalone score; iterate
   the wing (more spread, bigger head, bigger size delta) before shipping.
4. **Update credits** only if the source attribution changes — it stays
   `bottom-other` → PEBL CIC original, CC0 1.0 in
   `src/data/bodyform-silhouette-credits.json` (already present, no change
   needed for a redraw of an original).
5. **Standard pre-push gate** if/when the SVG is committed:
   `npx tsc --noEmit && npm test && npm run lint && npm run lint:tokens`
   (the SVG itself is a static asset, but `body-forms.test.ts` enforces the fish
   coverage/≤10 ceiling that this tile participates in).

All silhouette output is a **DRAFT pending expert sign-off** (marine-biologist
review of whether the gurnard-led icon fairly stands in for the catch-all group).
