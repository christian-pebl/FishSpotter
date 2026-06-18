# Fish sub-silhouette review — `shark` ("Shark-shaped")

**Icon:** `public/silhouettes/forms/shark.svg`
**Rung-2 tile:** fish → `fishGroup: shark`, label "Shark-shaped"
**Covers exactly ONE species:** Lesser-spotted catshark / lesser-spotted dogfish (*Scyliorhinus canicula*).
**Current Gemini score:** 90 ("strong"), readsAs "Shark", `confusableWith: "none"`, clarity 95, distinctiveness 90, recognizability 90, diagnosticAccuracy 85.
**Note:** "The classic shark silhouette is instantly recognizable and clearly distinct from other fish shapes."

> **Bottom line up front:** This is the best-scoring fish tile and the strongest of the six fish forms. The recommendation is to **LEAVE IT AS-IS** (or apply at most one tiny optional polish to the tail, given below). Do NOT chase catshark anatomical accuracy at the cost of the instant "little shark" glance — for this tile, generic-shark recognisability is the whole job. A draft refined SVG is provided for the optional polish path only, clearly flagged as not-recommended-unless-a-rescore-asks-for-it.

---

## 1. Current read — walking the SVG

`viewBox="0 0 64 40"`, flat `fill="currentColor"`, six independent filled paths (snout points left). Renders as a single teal mask; only outline + the negative space between separate paths carries meaning.

| # | Path (line) | Role | What it draws |
|---|---|---|---|
| 1 | `M3 21 C10 16.8 … 3 21 Z` (L3) | **Body** | A slender lens/torpedo from a pointed snout tip at x≈3 to a thin caudal stalk at x≈52. Top edge `C10 16.8 22 15.8 34 17` is shallow; the body is genuinely slim (depth ≈ 8 units against ~49 units of length → depth:length ≈ 1:6). The `52 21.3` pinch is the narrow tail wrist. |
| 2 | `M23 16.8 L30 6.5 L33 17 Z` (L5) | **First dorsal** | A tall triangle rising from the back at x≈23–33, apex raked back to x=30/y=6.5. This is the single most "shark"-reading element — a tall, rearward-leaning dorsal. |
| 3 | `M42 18.4 L46.5 13.4 L49 19.1 Z` (L7) | **Second dorsal** | A smaller triangle set well back (x≈42–49), near the tail. Two dorsals = a real shark cue, and (helpfully) close to catshark truth (catsharks have two dorsals set far back). |
| 4 | `M16 24.4 L19 32 L25 25.6 Z` (L9) | **Pectoral** | A triangle hanging below the body, swept down-and-back from the head region. Reads as a low-slung pectoral. |
| 5 | `M33 25 L36 30.4 L40 25.8 Z` (L11) | **Pelvic** | A smaller triangle below the mid-body. Adds the "multiple paired fins underneath" texture that separates a shark/elasmobranch profile from a plain fish. |
| 6 | `M51.5 20.6 L63 8 L60.5 19.2 L62.6 27.6 L57 23.6 Z` (L13) | **Heterocercal tail** | The asymmetric shark tail: a long upper lobe sweeping up to (63,8), a deep concavity back to (60.5,19.2), then a short stubby lower lobe to (62.6,27.6) and back into the stalk at (57,23.6). Upper lobe travels ~13 units up; lower lobe ~8 units down → clearly asymmetric, not a symmetric fork. |

**Why it scores 90.** Three independent "shark" signals stack and reinforce each other: (a) the **tall raked dorsal** silhouetted against open negative space above the body; (b) **two dorsals**, the rear one set back; (c) the **asymmetric (heterocercal) tail** with a long upper lobe and short lower lobe. No single fin is ambiguous, and the body is slim enough that the tall dorsal dominates the top edge. Gemini reads it as "Shark" with no confusable sibling. Clarity 95 reflects that all six paths stay legible at small size because the dorsal and tail spikes are large relative to the body.

---

## 2. Generic-shark vs catshark accuracy — recommendation

**Recommendation: KEEP the generic-shark read. Do not nudge toward catshark accuracy.**

**Reasoning.**
- The tile's job (per `fish-category-review.md` and the tile label) is the **glance test: "Looks like a little shark."** That is a *generic-shark* judgement, not a species ID. A beginner watching a short underwater clip will never resolve "two dorsals set far back, slim body, rounded eel-like tail = catshark"; they will think "shark." The icon must serve that thought.
- This tile is a **bucket of one species**, so there is no sibling-within-the-bucket the icon needs to distinguish. Its only discrimination duty is *shark vs the other five fish groups* (esp. silver-shoaler), which the generic-shark cues do better than a faithful-but-mushy catshark profile would.
- Catshark accuracy actively **hurts the glance test**: a faithful catshark is slim with two small dorsals crammed near the tail and a low, rounded, almost continuous tail — at 8×8px that reads as a plain slender fish or an eel, i.e. it would start colliding with `silver-shoaler` / `long-skinny`. The exaggerated tall first dorsal + obvious heterocercal tail are precisely the *un-catshark-like* features that make it instantly "shark." This is a case where the recognisability/accuracy tradeoff falls firmly on recognisability.
- Gemini already flags exactly this tension at Rung-1 for the *Fish* gate icon (`shape:fish`, readsAs "Shark", note: "Consider a more generic fish shape, perhaps with a less pronounced shark-like tail"). That note is a *warning for the generic-fish tile* (a shark profile is too specific to stand for all fish). For the Rung-2 `shark` tile the same shark-iness is the **goal**, so that note does not apply here. Worth keeping the two icons distinct in iconography (the Rung-1 fish icon should be de-shark'd; this Rung-2 shark icon should stay shark-y) — see Open Questions.

**The one place current geometry already nods to catshark — keep it.** The two dorsals set far back and the slim body *are* catshark-correct. So the icon is already a pleasant middle: unmistakably "shark" in gestalt, while the two-rearward-dorsals detail happens to be catshark-faithful. No change needed to claim catshark fidelity.

---

## 3. Diagnostic priorities — silhouette-only cues that say "shark, not silver-swimmer"

Ranked by how much each cue carries the read at 8×8px (most load-bearing first):

1. **Asymmetric (heterocercal) tail — long upper lobe, short lower lobe.** This is THE shark/elasmobranch giveaway and the single cue that most separates shark from silver-shoaler (whose tail is a symmetric fork). Must never read as a symmetric V. Currently strong (upper lobe ~13u up vs lower ~8u down).
2. **Tall, raked-back first dorsal.** A large triangle leaning rearward off the back, silhouetted against empty negative space above. This is what makes the top edge unmistakably shark rather than a soft clupeid dorsal nub. Highest single contributor to "shark."
3. **Two dorsal fins (second set well back).** Two bumps on the back is a non-pelagic-fish cue and happens to be catshark-true. Keeps the profile from reading as a one-dorsal swimmer.
4. **Pointed snout.** The body terminating in a clean point at the leading edge (no blunt/rounded head) reinforces the predatory shark gestalt and contrasts with rounder-snouted swimmers.
5. **Swept low pectoral (+ pelvic).** Triangles hanging below the body give the "fins all underneath / cruiser" elasmobranch texture. Lowest priority — these read more as texture than as a decisive cue at icon scale, but they cost nothing and add richness.

---

## 4. Distinguishability matrix (one outline cue per sibling)

| Sibling tile | Their silhouette | The ONE cue that keeps shark distinct |
|---|---|---|
| **`silver-shoaler`** ("Silver swimmers") | Two slim torpedo fish, each with a **symmetric deep forked tail** (`L66 19.5 L61 25 L66 30.5` = clean V-notch), soft little dorsal | **Asymmetric heterocercal tail** (long upper / short lower lobe) vs their symmetric fork — this is the critical separator. Backed up by shark's tall raked dorsal + the fact shark is a single body, not a pair. |
| **`cod-like`** ("Cod-shaped") | Chunky deep body, three separate dorsal bumps along the back | Shark is **slim** with a **tall raked dorsal + heterocercal tail**; cod is deep/blocky with a stepped three-fin back and a straight-ish tail. |
| **`wrasse`** ("Wrasses") | Deep oval body, one long-based dorsal, **rounded** tail, thick-lipped snout | Shark's **slim body + asymmetric pointed tail** vs the wrasse's deep oval body and rounded (paddle) tail. |
| **`bottom-sitter` / `bottom-other`** ("Gobies & dragonets" / "Other bottom fish") | Small fish sitting on a **ground line** (horizontal seabed stroke), big-headed/perched posture | Shark is a **free-swimming profile with NO ground line** and a dramatic tail; bottom fish are anchored to the visible seabed line. |
| **`long-skinny`** ("Long and skinny") | Eel-like ribbon, much longer than deep, continuous low fin, blunt/rounded tail, slightly bent | Shark has **distinct triangular fins (tall dorsal) and a forked-asymmetric tail**, not a continuous ribbon fin; shark body is far shorter/deeper than the eel ribbon. |

The asymmetric tail does double duty: it is both the top diagnostic priority (§3) and the decisive separator from the highest-risk sibling (`silver-shoaler`).

---

## 5. Concrete polish spec (only if a rescore ever dips, otherwise skip)

The icon is already at 90 with `confusableWith: none`; the bar for touching it is high. If polish is ever wanted, keep it micro and tail-focused — the tail is the load-bearing cue and the only place a small tweak buys margin:

- **viewBox: keep `0 0 64 40`.** It frames the long upper tail lobe (apex at x=63) right at the edge — fine, but a redraw could use `0 0 66 40` to give the upper lobe ~2u of breathing room so `maskSize:contain` doesn't crop tight against the frame. Optional.
- **Guarantee the tail never reads as a symmetric fork at small size.** Make the upper lobe visibly *longer AND thinner* than the lower lobe (asymmetry should survive downsampling). The current lobes already differ (~13u vs ~8u); a polish could deepen the inter-lobe notch slightly and extend the upper lobe tip so the asymmetry is unmistakable post-rasterise.
- **Do not soften the first dorsal.** It is the strongest single shark cue; leave it tall and raked.
- **Leave body slimness as-is.** Slim is both catshark-true and helps the dorsal dominate; deepening it would push toward `cod-like`/`wrasse`.
- **No new paths, no stroke, no gradient** (mask constraint). Keep exactly the six-path structure; negative space between dorsals/tail is what carries the read.

Net: there is no clarity/recognisability gap to close. Any edit risks regressing a 90. The polish below exists only as a ready candidate if a future rescore on a different Gemini model surfaces a tail-fork ambiguity.

---

## 6. Proposed SVG

**Primary recommendation: LEAVE AS-IS.** The committed file is optimal for the tile's job (instant "little shark" glance), scores 90/strong with no confusable sibling, and any change risks a regression for zero measured gain.

Below is an **optional, DRAFT** lightly-refined candidate to keep on the shelf *only* for the tail-margin polish path in §5 (wider viewBox for breathing room; upper tail lobe extended and notch deepened so the heterocercal asymmetry is rasterise-proof). It is **not recommended for merge** unless a rescore asks for it.

```svg
<svg width="100%" height="100%" aria-hidden="true" fill="currentColor" viewBox="0 0 66 40" xmlns="http://www.w3.org/2000/svg">
  <!-- slender dogfish body, pointed snout left, tapering to a thin tail stalk -->
  <path d="M3 21 C10 16.8 22 15.8 34 17 C42 17.8 48 19.2 52 20.8 C52.6 21 52.6 21 52 21.3 C48 23 42 24.4 34 25.2 C22 26.4 10 25.2 3 21 Z"/>
  <!-- tall first dorsal fin, raked back (the dominant 'shark' cue) -->
  <path d="M23 16.8 L30 6.5 L33 17 Z"/>
  <!-- small second dorsal, set well back (catshark-true) -->
  <path d="M42 18.4 L46.5 13.4 L49 19.1 Z"/>
  <!-- pectoral fin, swept down and back -->
  <path d="M16 24.4 L19 32 L25 25.6 Z"/>
  <!-- pelvic fin -->
  <path d="M33 25 L36 30.4 L40 25.8 Z"/>
  <!-- heterocercal tail: upper lobe extended + notch deepened so the asymmetry
       survives downsampling and never reads as a symmetric fork -->
  <path d="M51.5 20.6 L65 6.5 L60 19.4 L62.6 28 L57 23.6 Z"/>
</svg>
```

Changes vs committed: `viewBox` width 64→66 (margin for the upper lobe), tail upper-lobe tip pushed from (63,8) to (65,6.5) and the inter-lobe waist pulled in to (60,19.4) so the upper lobe is clearly the longer/leaner of the two. Body, both dorsals, pectoral, pelvic untouched. All flat `currentColor`, six paths, no stroke/gradient.

---

## 7. Open questions / tradeoffs & verification

**Open questions / tradeoffs**
- **Rung-1 vs Rung-2 shark collision.** The Rung-1 *Fish* gate icon (`/public/silhouettes/fish.svg`) currently also readsAs "Shark" (Gemini note: make it a more generic fish). If that Rung-1 icon is de-shark'd (recommended separately), this Rung-2 shark tile becomes the *only* shark silhouette in the flow — good, no within-flow duplication. Worth tracking so the two icons don't drift back into looking identical. (Out of scope for this file.)
- **Single-species bucket.** Because `shark` holds one species, the catshark-accuracy question is purely cosmetic for scoring; it would only matter if the bucket ever gained a second shark/skate/ray (then a heterocercal-vs-flat-disc cut would be needed). Not a concern today.
- **Does the icon need to hint "small/bottom-associated catshark" rather than "big pelagic shark"?** Considered and rejected: at icon scale that nuance is unreadable and would only erode the glance test. Reserve it for the field note / Rung-3 photo + diagnostic marks, not the silhouette.

**Verification step (if the optional polish is ever applied)**
1. Swap in the candidate SVG, rasterise/eyeball at 8×8 and at the Rung-2 "2x" row size; confirm the tail still reads asymmetric (not a fork) after downsampling.
2. Re-run `npm run score:silhouettes` (`scripts/score-silhouettes.ts`, Gemini vision) and re-read the `form:fish:shark` entry in the regenerated scores file.
3. **Hold ≥ 90** and require `readsAs` to remain "Shark"/shark and `confusableWith` to stay `none` (especially not "Silver swimmers"). If the rescore drops below 90 or introduces any confusable sibling, **revert to the committed file** — the as-is icon is the safe baseline.
4. No app/code/SVG changes are made by this review; the live `shark.svg` is unchanged.
```
