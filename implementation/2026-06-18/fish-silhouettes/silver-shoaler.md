# `silver-shoaler` silhouette review + redraw plan (18 Jun 2026)

Tile: **`form:fish:silver-shoaler`** — label **"Silver swimmers"** (renamed from
"Silver shoalers"; the value/trait/silhouette filename are unchanged).
Covers: Thick-lipped grey mullet, European sea bass, Atlantic horse mackerel,
Atlantic mackerel, Sprat, Sand smelt.
Glance test: **"Slim and silver, out in open water."**
Current Gemini score: **87 ("strong")**, `readsAs: "Two fish"`, note "Consider
adding more fish to emphasize 'shoalers'."

This is a DRAFT plan. No live SVG or app code is modified here. The only output
is this document. Verification (`npm run score:silhouettes`) is the gate before
anything ships.

---

## 0. Render constraints (the hard frame)

`MaskSilhouette` (TileGate.tsx) paints the SVG as a **flat single-colour teal
mask** via CSS `mask-image` + `background-color: currentColor`:

- No stroke colour, no fill colour, no gradient, no shading survives. Only the
  **filled outline** and the **negative space between separate filled paths**
  carry information.
- `maskSize: contain`, `maskPosition: center` — the art is scaled to fit the
  box and centred; the viewBox aspect ratio is preserved.
- Rung-2 ("list" variant) renders the icon in a **`h-20 w-20`** box (the "2x"
  size). That is the size to design for. (Rung-1 uses `h-16 w-16`; this tile is
  Rung-2 only.) Thin features below ~1.5px at 80px on a retina phone vanish.

Practical rules this imposes for THIS icon:
- The forked tail is read entirely from the **notch (negative space)** cut into
  the caudal fin. That notch must be wide and deep, or it closes up at 80px and
  the tail reads square/rounded → wrasse confusion.
- A dorsal fin is read only as a **bump on the dorsal contour**; it cannot be a
  separate hairline.
- If two fish are drawn, the **gap between them** is the shoal cue and must stay
  open at small size.

---

## 1. Current read (walking the SVG)

```
viewBox="0 0 70 40", fill="currentColor"
```

Five paths, composing a small shoal of **two** fish (lead fish lower/larger,
follower upper/smaller):

1. **Lead body** (`M8 25 C…Z`) — a clean lens/ellipse from x≈8 (snout) to x≈55
   (caudal peduncle), centred on y≈25, max depth ≈7px (y 18→32). Body
   length:depth ≈ 47:14 ≈ **3.4:1** — properly slim/streamlined. Smooth fusiform
   curve, blunt-ish rounded snout.
2. **Lead dorsal** (`M29 18 C…Z`) — a tiny low triangular bump on the top
   contour mid-body. Soft, single, small. Good clupeid/mullet cue and (crucially)
   a non-shark cue.
3. **Lead tail** (`M55 25 L66 19.5 L61 25 L66 30.5 Z`) — a chevron/arrow: outer
   tips at (66,19.5) and (66,30.5), inner notch vertex at (61,25). Notch depth =
   66−61 = **5px**; fork half-spread = 5.5px each lobe. A clear, symmetric,
   deeply forked tail. This is the strongest diagnostic path.
4. **Follower body** (`M9 8 C…Z`) — smaller lens, x 9→35, depth ≈7px, same slim
   ratio, sitting above and slightly ahead.
5. **Follower tail** (`M35 9 L42 5.6 L38.5 9 L42 12.4 Z`) — same chevron motif,
   scaled down.

**Why it scores 87 (and why it's the best fish tile after shark):**
- recognizability 90, clarity 95 — the lens body + forked tail is an
  unambiguous "fish", crisply drawn, no clutter.
- diagnosticAccuracy 85 — the forked tail + slim ratio are exactly the
  give-aways for this group, and they're both legible.
- distinctiveness 80 (the soft spot) — two fish stacked reads as "a shoal" only
  weakly; Gemini literally reported `readsAs: "Two fish"`, i.e. it counted them
  rather than naming a group. The two-fish motif buys a little "open-water /
  multiple" feeling but also invites the "why two?" question and slightly muddies
  the single clean diagnostic.

The geometry is genuinely good. The only real lever left is the **metaphor
decision** (below) and a couple of millimetre polishes to harden the tail notch
and snout against small-size collapse.

---

## 2. The label-vs-metaphor question: KEEP 2 fish, or switch to 1?

The label changed from "Silver shoalers" → **"Silver swimmers"** precisely
because bass and adult mullet are *not* reliable shoalers (the body-forms.ts
comment is explicit). So the icon no longer needs to assert "many fish". Its job
is now **"slim silver fish out in open water"** — a body-shape + posture cue, not
a count cue.

### Recommendation: **switch to a SINGLE clean streamlined fish** (with a soft dorsal).

Reasoning, weighted:

1. **Consistency with the rest of the fish gate.** Every other fish Rung-2 tile
   is a *single* subject: `cod-like` (one fish, 3 dorsals), `wrasse` (one deep
   fish), `shark` (one shark), `long-skinny` (one eel), `bottom-sitter` /
   `bottom-other` (one fish on a seabed line). A two-fish tile is the odd one
   out in the row and adds a "count" variable the user must interpret ("does the
   number mean something? do the others not shoal?"). A single fish makes the
   row visually parallel — the user compares **shapes**, which is the actual
   question being asked.

2. **The label no longer implies plurality.** "Silver *swimmers*" describes the
   posture/body of one fish as well as many. The semantic justification for the
   shoal motif is gone with the rename; keeping it is now decoration that costs
   distinctiveness (Gemini's `readsAs: "Two fish"` and the 80 distinctiveness
   are the symptom).

3. **A single fish is the cleaner diagnostic.** With one subject we can spend the
   full 80×80 box on the two features that actually separate this group from its
   siblings: a **deeper, unmistakable tail fork** and a **longer, slimmer body
   ratio**. At small size, one large crisp fork reads better than two small ones.

4. **Shark-confusion risk is manageable and is the one real argument FOR the
   shoal.** A lone slim torpedo + forked tail *can* drift toward "shark". But the
   `shark` sibling defends itself with a **strongly asymmetric (heterocercal)
   tail, raked tall dorsal, and pointed snout** — and our defence is the
   **symmetric** fork + **small soft** dorsal + **blunt rounded** snout. Those
   are strong enough on their own (the current single lead fish already reads as
   a normal fish, not a shark). I would NOT keep two fish solely as anti-shark
   insurance; instead bank the symmetry/soft-dorsal/blunt-snout cues. See the
   matrix (§4).

### Hedge (kept honest)
If a quick re-score of the single-fish draft *drops below 87* or starts reading
shark-ish, the fallback is **"two fish but more clearly a loose pair / school"**:
keep the current composition and only (a) deepen both tail notches, (b) add a
third tiny fish far back to push `readsAs` from "Two fish" → "school", per
Gemini's own note. This is the lower-risk path (the current art already scores
87) but it doubles down on the metaphor the rename walked away from, so it is the
**fallback, not the recommendation.** Score both; ship the higher.

---

## 3. Diagnostic priorities (silhouette-only, ranked)

What this group's identity rests on, in order of how much it must survive the
80px flat mask:

1. **Deeply forked (symmetric) tail.** THE signature. Read from the notch
   negative space. Must be the deepest, most deliberate feature. Distinguishes
   from wrasse (rounded), and the *symmetry* distinguishes from shark
   (asymmetric). Survives small size IF the notch is wide+deep.
2. **Slim, elongated, smooth-fusiform body (≥3:1 length:depth).** The "swimmer"
   read. Survives small size easily (it's the gross outline). Separates from
   wrasse (deep oblong) and cod-like (chunkier).
3. **Single small SOFT dorsal bump, low and mid-body.** Secondary but
   load-bearing for the anti-shark and anti-cod reads (one bump, not three; soft,
   not a raked tall triangle). Reads at 80px only as a gentle convexity — keep it
   low and rounded, never a spike.
4. **Blunt / gently rounded snout.** Mild cue; mostly an anti-shark guard
   (shark = pointed). Easy to lose at small size, so don't rely on it alone.
5. **(Fallback metaphor only) inter-fish gap / multiple subjects.** Only relevant
   if we keep ≥2 fish. Lowest priority given the rename.

Things to deliberately NOT add (they collapse to noise at 80px): pelvic/anal
fins as separate paths, gill lines, eye dots, lateral line, scale texture.

---

## 4. Distinguishability matrix

The fish Rung-2 row currently has **7 tiles** (the old `bottom-sitter` was split
on 18 Jun into "Gobies & dragonets" + "Other bottom fish", per body-forms.ts).
For each sibling, the single outline cue that must keep `silver-shoaler` distinct:

| Sibling tile | Its silhouette signature | The cue that keeps `silver-shoaler` distinct |
|---|---|---|
| `cod-like` ("Cod-shaped") | Chunky body, **three separate dorsal-fin bumps**, blunt head, weakly forked tail | **One** small dorsal bump (not three) + a slimmer body + a *deeper* tail fork |
| `wrasse` ("Wrasses") | Deep oblong body, pointed lipped snout, one long-based dorsal, **ROUNDED unforked tail** | **Deeply forked tail** (the wrasse tail is convex/rounded) + slimmer body ratio |
| `bottom-sitter` ("Gobies & dragonets") | Small fish on a **seabed groundline**, perched posture | **No groundline** — open-water posture, fish drawn level/horizontal in free space |
| `bottom-other` ("Other bottom fish") | Armour-headed gurnard on a **seabed groundline**, big head/spread pectorals | **No groundline**, slim even body, small head (no spread pectoral fans) |
| `long-skinny` ("Long and skinny") | Eel-like, length:depth very high, ~uniform ribbon, no forked tail | Distinct **lens body with a clear caudal peduncle + forked tail** (eel is a continuous ribbon to a point) |
| `shark` ("Shark-shaped") | **Pointed snout, tall raked dorsal, ASYMMETRIC (heterocercal) tail** | **Symmetric** fork (equal lobes) + **small soft low** dorsal + **blunt** snout |
| (self) `silver-shoaler` | Slim lens, soft single dorsal, deep symmetric fork, open water | — |

The two cells that matter most and must be unmissable in the redraw:
**vs `wrasse` = the tail fork** and **vs `shark` = tail symmetry + soft small
dorsal + blunt snout.**

---

## 5. Concrete redraw spec (recommended: single clean fish)

### Canvas
- **viewBox `0 0 64 40`** (slightly squarer than the current 70×40 so a single
  fish fills the `h-20 w-20` box without large empty side margins; `contain`
  centres it). Length ≈ 56 units used, depth ≈ 16 units → ~3.5:1, firmly slim.

### Body
- Smooth fusiform lens, snout at left, caudal peduncle at right.
- Midline y = 20. Snout tip ≈ (4, 20), blunt/rounded (not pointed — anti-shark).
- Widest point ≈ x 22 (slightly forward of centre), half-depth ≈ 7.5 (top y≈12.5,
  bottom y≈27.5). Taper to a narrow peduncle at x≈48 (half-depth ≈ 2.5).
- Keep the dorsal and ventral curves gently asymmetric (back a touch straighter
  than belly) so it reads "fish", not "leaf".

### Dorsal fin (the soft single bump)
- A low, rounded triangular bump on the **top** contour, peak at ≈ x 26, rising
  ~3 units above the back line, base ~10 units wide. Soft apex (rounded), NOT a
  raked spike. This is the explicit anti-shark / anti-cod (one, not three) cue.
- Optional matching tiny anal bump on the belly at ≈ x 34 — only if a quick
  render shows it survives; otherwise omit (belly clutter risks the slim read).

### Forked tail (the make-or-break feature)
- Caudal peduncle joins at ≈ (48, 20). Tail spans x 48→62.
- Outer lobe tips at **(62, 9)** and **(62, 31)** → full vertical spread 22 units
  (generous, so the fork dominates).
- **Notch vertex at (51, 20)** → notch depth = 62 − 51 = **11 units** (~28% of
  canvas height). Deliberately deeper than the current 5-unit notch so it cannot
  close up at 80px.
- **Symmetric** lobes (equal top/bottom) — this is what separates it from the
  shark's heterocercal tail. Draw as one closed path:
  `M48 20 L62 9 L51 20 L62 31 Z`, lobes optionally given a slight outward
  concave sweep on the trailing edges for elegance (keep the notch a clean V).

### Why this reads at small size
- The tail fork is now ~11/40 of the canvas height — a large, obvious V of
  negative space that stays open when down-sampled to 80px.
- A single subject means each feature gets ~2× the pixels it had in the two-fish
  layout.
- Soft single dorsal + blunt snout actively push away from the shark tile.

### Fallback spec (keep the shoal, if the single fish under-scores)
- Keep the existing two-fish composition and geometry.
- Deepen **both** tail notches: lead `…L66 25` → `…L62 25` (notch 4→8);
  follower proportionally.
- Add a **third** very small fish further back/below (e.g. body lens
  x 40→56 at y≈33, tiny chevron tail) so `readsAs` shifts "Two fish" → "school"
  and distinctiveness rises, per Gemini's note. Keep gaps open.

---

## 6. Proposed redrawn SVG (DRAFT — single clean fish)

```svg
<svg width="100%" height="100%" aria-hidden="true" fill="currentColor" viewBox="0 0 64 40" xmlns="http://www.w3.org/2000/svg">
  <!-- Silver swimmer: slim streamlined body, one small SOFT dorsal bump,
       blunt snout, deep SYMMETRIC forked tail. Single subject (label is no
       longer "shoalers"), so it sits parallel to the other one-fish fish tiles
       and spends the whole box on the two diagnostics: slim ratio + deep fork.
       Anti-shark = symmetric fork + soft low dorsal + blunt snout. -->
  <!-- body: fusiform lens, snout x=4, peduncle x=48, ~3.5:1 slim -->
  <path d="M4 20
           C8 13.5 16 11 24 11.5
           C34 12 43 14.5 48 18
           C48.5 18.7 48.5 21.3 48 22
           C43 25.5 34 28 24 28.5
           C16 29 8 26.5 4 20 Z"/>
  <!-- soft single dorsal bump, low + rounded, peak ~x26 (NOT a shark spike) -->
  <path d="M20 12 C24 8.6 30 8.4 34 11.4 C30 11.2 24 11.3 20 12 Z"/>
  <!-- deep symmetric forked tail: outer tips (62,9)/(62,31), notch vertex (51,20) -->
  <path d="M48 20 L62 9 L51 20 L62 31 Z"/>
</svg>
```

Notes on the draft:
- The body path keeps a near-flat join (x≈48, y 18→22) into the tail so the
  peduncle reads narrow and the tail visually attaches.
- Snout (x=4) is a rounded curve apex, not a point.
- The dorsal bump base sits *on* the back curve so the mask merges them into one
  silhouette (a bump on the contour), not a floating fin.
- If the optional anal bump is wanted later, mirror the dorsal: e.g.
  `M30 28.6 C33 31.5 37 31.6 40 28.9 C37 28.8 33 28.7 30 28.6 Z` — render-test
  first; omit if it muddies the slim read.

---

## 7. Open questions / tradeoffs

1. **1 fish vs 2** — the central call. Recommended: 1 (consistency +
   distinctiveness + label no longer implies count). Tradeoff: gives up the
   loose "open-water shoal" connotation. Mitigation: the slim+fork+level posture
   still reads "open-water swimmer". **Decide by scoring both** (§7 verification).
2. **Shark drift** — a lone slim torpedo is the one place this could regress. The
   symmetric fork + soft low dorsal + blunt snout are the defences; if the
   re-score reports `readsAs: shark` or confusableWith `shark`, exaggerate the
   dorsal bump and blunt the snout further before falling back to the shoal.
3. **Posture / groundline** — no groundline is correct (separates from the two
   bottom tiles). No change needed, just don't add one.
4. **Anal fin** — include only if it survives 80px without muddying the slim
   read. Default: omit.
5. **Credits file** — if the art changes from the reused source to PEBL-authored,
   update `src/data/bodyform-silhouette-credits.json` (note in
   fish-category-review.md that `silver-shoaler` currently "reuses" art). Not
   part of this plan's output, but required at ship time.

### Verification step (the gate)
1. Drop the draft SVG in place of `public/silhouettes/forms/silver-shoaler.svg`
   on a branch (do not commit yet).
2. Rasterise + eyeball at 80px (the Rung-2 list size) and at Rung-1 64px for
   safety.
3. Run **`npm run score:silhouettes`** (Gemini re-score; `scripts/score-silhouettes.ts`).
   Read the `form:fish:silver-shoaler` entry.
4. **Pass condition: hold or beat 87**, AND `confusableWith` does not become
   `wrasse`/`shark`/`cod-like`, AND `readsAs` is a single fish / "fish" (or, for
   the fallback, "school"). Distinctiveness should rise off 80.
5. If the single-fish draft fails either condition, ship the §5 fallback (deepen
   notches + third fish) and re-score; ship whichever scores higher and is
   sibling-clean.
6. Before any push: `npx tsc --noEmit && npm test && npm run lint && npm run lint:tokens`
   (per CLAUDE.md), and confirm `body-forms.test.ts` (the <=10 fish-coverage /
   ceiling guard) still passes — the trait/value `silver-shoaler` is unchanged,
   so this should be unaffected, but verify.
```
