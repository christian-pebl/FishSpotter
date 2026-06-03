# Session handoff — 1 June 2026

Pick-up notes for a fresh chat. This session designed (did **not** yet build)
the **"Spot It" visual ID flow**: a shape-class-first, scored-by-rung
identification game layered over the feed clips, plus the plan to feed it from
British marine ID guides.

**Progress (1 June, build session):** Workstreams **A and B are now shipped**
on branch `spot-it-visual-id` (commits: planning `e575bca`, A `1173734`,
B `f1e73c8`; not pushed). A = `shapeClass` + `movement` schema + 28-species
backfill. B = shapeClass hard filter + movement scored + info-gain
`nextBestTrait` picker, all unit-tested (179 tests green). `movement` values
are a first pass pending marine-bio spot-check. Remaining: C (catalogue
content), D (assets), E (scoring by rung), F (UX build, starting at UX-0).

---

## TL;DR — where we landed

1. **Reassessed the model.** The original "5 sequential levels" (Shape ->
   Sub-class -> Context -> Movement -> Species) does not survive contact with
   the real branches. The app actually wants: **a hard Shape-class gate + one
   shallow sub-split + an adaptive bag of weighted traits, with Context as a
   silent prior** the app already computes from snippet metadata
   (`SpeciesProbability`/OBIS). Movement is a scored trait, not a level. The
   decision tree is the **authoring/teaching artifact**, not the runtime.
2. **This is an evolution of existing code, not a rewrite.** The runtime is
   `IdGuideWizard` + `narrow.ts` + `MCQCandidatePicker` + `AnnotatedSpeciesPhoto`
   + the `DiagnosticMark` system + `SpeciesProbability`. We add: shape as a hard
   filter, an information-gain next-question picker, and scored-by-rung.
3. **Three plan docs written** (read in this order):
   - `implementation/2026-06-01/guide-integration-plan.md` — engine model + how
     the 6 guides map to the catalogue.
   - `implementation/2026-06-01/ux-id-flow-plan.md` — the user-facing flow.
   - `implementation/2026-06-01/implementation-plan.md` — **the executable build
     (start here for doing).**

## Approved decisions (Christian, 1 June)

1. Guided flow sits **alongside** the MCQ; launched by a "Help me ID it" entry;
   "skip to guess" jumps to the MCQ from any rung.
2. **Scored by rung** — coarse shape-class match earns partial credit. This
   reframes the parked nullify audit: "Fish / Crab / Jellyfish" become valid
   coarse references, not junk.
3. **Assets:** PhyloPic silhouettes (recolored teal) for the gate; **annotated
   real photos via `DiagnosticMark`** for trait diagrams (no commissioned
   illustration); Canva/Claude-generate only for throwaway prototype placeholders.
4. **Prototype the gate first** (UX-0) before the full asset set.

## The ONE open input — RESOLVED (Christian, 1 June)

**Point values per rung: LOCKED at two tiers.** Species = 2 (unchanged
`POINTS_CORRECT_REF`), correct shape-class only = 1 (new `POINTS_SHAPE_CLASS`),
wrong shape = 0. **No sub-class tier:** `Answer.points` is an Int so nothing
fits between 1 and 2, and bumping species to 3 to make room would ripple through
the consensus invariant (the pioneer bonus must out-rank a referenced correct).
A correct Rung 2 sub-class ("it's a gadoid") therefore scores the same as the
shape-class rung for now. Workstream E is unblocked.

---

## Recommended execution order (from implementation-plan.md)

1. ~~**A** — schema foundation.~~ DONE (`1173734`).
2. ~~**B** — engine (shape hard filter, movement scored, info-gain
   `nextBestTrait`).~~ DONE (`f1e73c8`). NEXT recommended: **D placeholders ->
   UX-0** gate prototype over a clip.
3. **C: Crab** content (makes the gate non-hollow off-fish) — editorial, needs
   marine-bio sign-off.
4. **UX-1** (candidate strip + skip-to-guess), **UX-2** (adaptive Rung 3).
5. **E** (scored-by-rung) once Crab is in -> **UX-4** (reveal + score).
6. **C: inverts** + **D: PhyloPic** -> **UX-3, UX-5**.

Long pole = **Workstream C (catalogue content)**, which is editorial and needs
Christian's sign-off (parse-and-verify per guide-integration-plan Phase 2). The
gate is hollow until each of the 8 shape classes has >= 3 species.

---

## Artifacts produced this session

| Path | What |
|---|---|
| `decision-tree/index.html` | Standalone decision-tree visual (8 shape classes, ~58 species, diagnostics). Authoring/teaching artifact. |
| `public/decision-tree.html` | Same file, served by the running Next dev server at `http://localhost:3000/decision-tree.html` (the python static server didn't persist; serving via `public/` is the reliable route). |
| `decision-tree/id-guides/*.pdf` | 6 free UK marine ID guides (EA fish key, Merryweather crabs, Cefas cephalopods, Sussex IFCA fish, ZSL estuarine, Devon WT rocky shore). 48MB. |
| `implementation/2026-06-01/guide-integration-plan.md` | Engine model + guide->catalogue mapping. |
| `implementation/2026-06-01/ux-id-flow-plan.md` | User-facing flow design. |
| `implementation/2026-06-01/implementation-plan.md` | Executable build (workstreams A-F). |
| `src/data/species-traits.json` | +2 gobies (Two-spotted `Gobiusculus flavescens`, Common `Pomatoschistus microps`). Now **28 species**. Note: `shapeClass`/`movement` fields NOT yet added (that is Workstream A). |

## To view the decision tree in a new session

The Next dev server serves it: `npm run dev`, then open
`http://localhost:3000/decision-tree.html`. (It is a static file under
`public/`, independent of the React app.)

## Paid guides — decision made

We did **not** buy any. The 6 free PDFs cover the branch logic. If ever
spending, Baldock & Dipper "Inshore Fishes of Britain and Ireland" (~£11) is the
one with a real USP (live-fish-in-water photos), but it is a nice-to-have, not a
blocker.
