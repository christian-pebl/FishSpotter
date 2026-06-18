# Live-testing feedback (round 2) — 18 Jun 2026

Four items from Anjali + Christian's live testing, all fixed and gated.
Branch `improvements-2026-06-12`. NOT yet committed (awaiting go).

## 1. Laptop screen cut off / not resizing

Root cause: a hydration mismatch in `FeedCard.tsx`. `isDesktop` (768px) and
`isLg` (1024px) used `useState(() => matchMedia(...).matches)` lazy initialisers,
which return `false` on the server but `true` on a wide client. The mismatch
crashed the feed's Suspense boundary ("switched to client rendering"), showing as
the cut-off / broken laptop layout. Fixed by initialising both to `false` and
syncing the real value in a mount effect (one frame after first paint). Verified:
0 console errors, clean 1366x768 screenshot.

## 2. Wrasse silhouette "a bit wrong"

`public/silhouettes/forms/wrasse.svg` redrawn from a round blob into a proper
wrasse: deep oblong body, pointed thick-lipped snout, ONE long-based dorsal
(the give-away vs cod's three humps), big rounded pectoral, rounded paddle tail.
Vision-scored with Gemini (2.5-flash) through several iterations:

| version | score | reads as | confusable |
|---|---|---|---|
| original | 58 weak | oval fish | Cod-shaped |
| slim redraw | 55 weak | generic fish | Silver swimmers |
| deeper + level dorsal | 70 adequate | deep-bodied fish | Silver swimmers |
| **shipped (rear-peaking dorsal)** | **73 adequate** | **deep-bodied fish** | **none** |
| spiny-dorsal try | 60 adequate | spiky fin | none (regressed) |

73 is the working ceiling: the residual note is dorsal-fin clarity, which is the
intrinsic limit of a flat filled icon (the spiny version that "shows" the fin
read as a sculpin and scored worse). Confusability is gone, which was the real
defect. Baseline patched in `implementation/2026-06-17/silhouette-scores.json`.

## 3. Bass aren't shoalers / wrong category

Bass visually belong with the silver streamlined midwater fish (not cod-like,
wrasse, bottom-sitter, long-skinny or shark), so the group is right; the LABEL
was wrong. Renamed the fish Rung-2 tile "Silver shoalers" -> **"Silver swimmers"**
in `idflow/body-forms.ts` (appearance-based, not behaviour-based). The trait
value `silver-shoaler` and the silhouette are unchanged. Group still 6 species
(scad, mackerel, sprat, sand smelt, sea bass, thick-lipped mullet).

## 4. Whiting missing from cod-shaped

Added **Merlangius merlangus (Whiting)** as a `cod-like` fishGroup fish, per the
add-a-species runbook:
- trait entry in `species-traits.json` (fish, fusiform+elongated, fin-spots =
  pectoral-base blotch, no barbel, slender, fishGroup cod-like)
- alias entry in `species-aliases.json` ("whiting", "common whiting", "Merlangius")
- curated photo override in `species-images.json`: Roy Anderson, Ireland,
  CC-BY-NC, Gemini-scored **90 IDEAL** (clean live lateral specimen)
- DB photos populated (`db:refresh-images --species "Merlangius merlangus"` ->
  5 rows, curated lead + 4 gallery). Scoped + idempotent; not surfaced on live
  until the code deploys.

cod-like is now 6 species (Cod, Bib, Pollack, Poor cod, Saithe, Whiting), still
<=10. "Whiting" resolves at runtime via `CATALOGUE_ALIASES` (build-time), so basic
scoring needs no seed step. The extra editorial synonyms need `db:seed-aliases`
at deploy time (a global re-seed, deferred).

## Gate

`npx tsc --noEmit` clean, **336 tests pass**, `npm run lint` clean,
`npm run lint:tokens` clean. Whiting verified in the live narrowing engine
(`bodyFormConfigFor("fish")` shows Cod-shaped(6) ... Silver swimmers(6) ... all <=10).

## Not in this batch

- Generic compare-photos decision step + wire flatfish (the carousel half shipped
  last round; the side-by-side compare step awaits Christian's fork: add
  turbot/brill for the left-eyed split, or keep the 3 right-eyed flatfish).
- Working tree also carries unrelated prior/parallel uncommitted work (a
  community-answers feature: `SnippetAnswers.tsx`, `api/snippets/[id]/answers/`,
  `feed/[id]/page.tsx`). Decide commit grouping before shipping.
