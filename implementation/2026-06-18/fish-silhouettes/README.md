# Fish sub-silhouette review + improvement plans (18 Jun 2026)

A per-icon review of the **7 fish Rung-2 sub-silhouettes** (the "What kind of
fish was it?" tiles in the Spot It flow), with a detailed improvement plan and a
DRAFT redrawn SVG for each, so every tile reads as its group and stays
distinguishable from its siblings. One agent reviewed each icon against the
Gemini vision baseline (`implementation/2026-06-17/silhouette-scores.json`),
the field-guide rationale (`implementation/2026-06-17/fish-category-review.md`),
and the flat-mask render constraint in `src/components/idflow/TileGate.tsx`.

**Nothing here is applied to the live SVGs.** Each `*.md` carries a draft `<svg>`
ready for a designer/reviewer; apply + re-score (`npm run score:silhouettes`) is
a separate, gated step.

## The render constraint that shapes every recommendation

Tiles render as a **flat, single-colour teal mask** (`mask-image` +
`background-color: currentColor`) at small size (~8×8 icon; the "2x" silhouette
in the Rung-2 list rows is ~40–80px). There is **no internal shading, stroke
colour, or gradient** — only the filled outline and the **negative space between
separate filled paths** carry information. Every diagnostic feature must survive
as pure silhouette at ~40px. The recurring fix across the plans is the same:
spend the graphic budget on *negative space* (gaps between fins, deep tail
notches, an eye hole) rather than fine internal detail that vanishes.

## The 7 tiles, current scores, and the headline fix

| Tile (`fishGroup`) | Label | Score | Verdict | Headline fix |
|---|---|---|---|---|
| `cod-like` | Cod-shaped | 78 | adequate | Three dorsal fins drawn too timidly — widen the V-notches into real "sky" so it reads as **three** fins, not a bumpy back. |
| `wrasse` | Wrasses | 73 (lowest) | adequate | Single dorsal is fused flush to the back → invisible. **Lift it off** with a negative-space gap so the ONE long dorsal reads (the key cue vs cod's three). Sharpen the lipped snout. |
| `silver-shoaler` | Silver swimmers | 87 | strong | Reads as "Two fish" (counted, not grouped). Recommend **switch to a single clean streamlined fish** with a deep symmetric fork, to match the other single-subject tiles and avoid the count read. |
| `bottom-sitter` | Gobies & dragonets | 85 | strong | **Near-identical to `bottom-other`.** Pull it to the small/plump/round-headed/smooth pole (two little darters on the sand). |
| `bottom-other` | Other bottom fish | (new, unscored) | — | **Near-identical to `bottom-sitter`.** Pull it to the big/elongated/armoured-head/wing-pectoral gurnard pole. |
| `long-skinny` | Long and skinny | 78 | adequate | It's a potrace boomerang (reads "boomerang/eel/snake") and the lone style outlier. **Hand-redraw** as a gentle-S slender fish with a head, eye-hole, and tail fin. |
| `shark` | Shark-shaped | 90 (best) | strong | **Leave as-is.** Already instantly reads "shark"; only the heterocercal-tail-vs-symmetric-fork contrast with `silver-shoaler` matters, and it holds. |

## Cross-cutting findings (read these first)

1. **The "normal fish" trio — `cod-like` / `wrasse` / `silver-shoaler`.** All
   three are mid-water fish outlines; the *only* reliable separators at icon
   size are: **three gapped dorsals** (cod) vs **one continuous dorsal +
   rounded unforked tail** (wrasse) vs **slim body + deep symmetric fork**
   (silver-shoaler). Every one of those cues currently underperforms (cod's
   gaps too shallow, wrasse's dorsal fused flat, shoaler's count read). Fixing
   the trio is the highest-value cluster.

2. **The paired seabed problem — `bottom-sitter` vs `bottom-other`.** These were
   split on 18 Jun but their silhouettes are still structurally the same
   (seabed line + blunt body + fan pectoral). Since the tile labels carry no
   shape hint, the icon is the sole disambiguator and it currently fails. The
   two plans are **deliberately paired**: push them to opposite poles of a
   size/smoothness/armour axis. Apply and re-score them **together**, and add an
   explicit acceptance test that neither lists the other in `confusableWith`.

3. **`long-skinny` is the only non-hand-authored icon** (a potrace trace at
   `viewBox 0 0 1536 770`). Replacing it with a clean multi-path icon at
   `viewBox ~0 0 72 40` also fixes the family style inconsistency.

4. **`shark` is the benchmark** — the only "leave it alone" verdict. Note its
   Rung-1 `fish.svg` cousin *also* reads as "Shark" per Gemini; de-sharking the
   Rung-1 fish gate (out of scope here) would leave this tile as the sole shark
   in the flow, which is desirable.

## Suggested apply order (when greenlit)

1. `wrasse` + `cod-like` together (the one-vs-three-dorsal contrast is mutual).
2. `bottom-sitter` + `bottom-other` together (paired poles).
3. `silver-shoaler` (single-fish redraw) and `long-skinny` (hand-redraw).
4. `shark` — no change.

After each cluster: `npm run score:silhouettes`, diff
`implementation/2026-06-17/silhouette-scores.json`, confirm each target tile
holds/beats its score with no new `confusableWith` flag. Mind the Gemini
free-tier ~20 req/day cap (a 429 is a quota stop, not a regression). Update
`src/data/bodyform-silhouette-credits.json` for any redrawn PEBL-original icon.

## Files

- [`cod-like.md`](./cod-like.md)
- [`wrasse.md`](./wrasse.md)
- [`silver-shoaler.md`](./silver-shoaler.md)
- [`bottom-sitter.md`](./bottom-sitter.md)
- [`bottom-other.md`](./bottom-other.md)
- [`long-skinny.md`](./long-skinny.md)
- [`shark.md`](./shark.md)
