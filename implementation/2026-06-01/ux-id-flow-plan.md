# UX plan — the visual ID flow ("Spot It")

Date: 1 June 2026. Companion to `guide-integration-plan.md`.

How a citizen scientist navigates shape-gate -> sub-split -> adaptive traits ->
species, in a way that is engaging, visual, fast, and forgiving of murky video.

---

## Design principle

It is **not a taxonomic key. It is a narrowing game played over the live
clip.** The snippet keeps looping behind the whole interaction; you are
identifying *this* animal, comparing it against silhouettes and photos in real
time. Four rules:

1. **Knowledge-free entry.** The first move is a tap on a picture, no jargon.
2. **Visible progress.** A candidate strip shrinks as you choose. Watching
   28 -> 6 -> 2 is the dopamine.
3. **Scored at every rung.** "It's a crab" already earns points; nailing the
   species earns more. Nobody leaves empty-handed.
4. **Murky-safe.** "Not sure" is offered at every step and routes to the
   weighted scorer's best guess instead of dead-ending.

This is the evolution of the existing `IdGuideWizard`, re-skinned and made
adaptive, with the shape gate prepended and context made silent. It is **not a
rewrite** (see "Mapping to existing code").

---

## Screen anatomy (mobile-first, over the looping snippet)

- **Clip loops behind**, slightly dimmed. Always visible.
- **Bottom sheet** hosts the interaction (matches the current FeedCard
  bottom-anchored panel; desktop keeps the mid-screen panel).
- **Candidate strip** along the top of the sheet: small thumbnails of the
  species still in contention. Greys out / drops as you narrow. This is the
  progress bar and the dopamine engine.
- **One question at a time**, large and visual, in the body of the sheet.

---

## The four rungs

### Rung 1 — Shape gate (silhouette grid)
"What is it, roughly?" A grid of 8 shape-class **silhouette tiles** (Crab,
Fish, Flatfish, Scooter, Jellyfish, Starfish, Gastropod, Squid). One tap. Big,
knowledge-free, satisfying. A "Not sure" tile is always present. This tap is
also the **coarse scored answer** (Phase 4 of the integration plan).

### Rung 2 — Sub-split (visual, branch-specific, 0-1 steps)
Shown only when it discriminates. Examples:
- **Fish:** tap a body-form silhouette (gadoid torpedo / deep wrasse / eel /
  flat bottom-dweller / schooling pelagic).
- **Flatfish:** a tiny "eyes on which side?" diagram, tap left or right.
- **Crab:** "shell on its back?" yes/no icons, then "legs longer than the
  body?" Spider-crab split.
Skippable. Many branches will have zero sub-splits.

### Rung 3 — Adaptive trait prompts (the smart bit)
The app asks the **single most-discriminating remaining trait**, shown
visually: two side-by-side thumbnails to tap between ("kinked vs straight
lateral line"), or a zoomed diagram ("chin barbel? yes / no / can't see").
Powered by `narrow.ts` choosing the highest-information-gain trait. Each answer
shrinks the candidate strip. Stops automatically when <= 3 candidates remain
(reuse the existing `NARROW_ENOUGH = 3`).

### Rung 4 — Reveal and commit
The <= 3 finalists shown as photo cards with **diagnostic-mark rings overlaid**
(reuse `AnnotatedSpeciesPhoto` + `DiagnosticMark`): "here is the saithe's
straight lateral line; here is the pollack's kink." Tap your pick. Score by the
rung you reached.

A confident user can **"skip to guess"** at any rung and jump straight to the
photo MCQ (the current fast path), so we never slow down experts.

---

## Engagement mechanics

- Shrinking candidate strip = continuous visible progress.
- Every interaction is a tap on an image; no typing, no Latin.
- Jargon hidden behind icons/diagrams, with an optional "why does this matter?"
  disclosure for learners (the existing `whyHint` pattern).
- Clip stays live behind the sheet the whole time.
- Scored at every rung, so the flow is inclusive and forgiving.
- Final screen carries the teaching payload (diagnostic marks), so spotters get
  measurably better over sessions.

---

## Mapping to existing code (why this is an evolution, not a rewrite)

| New flow piece | Existing asset |
|---|---|
| Rungs 2-3 narrowing | `IdGuideWizard` + `narrow.ts` (already a trait funnel) |
| Candidate strip | output of `narrowCandidates()` rendered live |
| Context prior | `SpeciesProbability` (OBIS) already weights candidates |
| Rung 4 reveal | `AnnotatedSpeciesPhoto` + `DiagnosticMark` |
| Skip-to-guess MCQ | `MCQCandidatePicker` (the current quiz) |
| Scored rungs | `matchAnswer()` + the points model (extend per Phase 4) |

**Genuinely new engine logic = one piece:** an *information-gain* next-question
picker. Given the remaining candidate set, choose the trait whose answer most
evenly splits it (max entropy reduction). Modest addition on top of
`narrow.ts`.

**Genuinely new content = the visual assets** (next section).

---

## Asset / content needs (the real cost)

- **8 shape-class silhouettes** (SVG line art, brand teal). The gate lives or
  dies on these looking like marine science, not clip-art. No emoji (per the
  UI rules in CLAUDE.md).
- **Fish body-form silhouettes** for the Rung 2 sub-split (~5).
- **A handful of trait diagrams** for Rung 3 (lateral line kinked vs straight,
  chin barbel, eyed-side). These are real illustration work; source carefully
  or commission, then vet by eye.
- **Diagnostic marks** for the confusion pairs (already planned, Phase 3 of the
  integration plan) feed Rung 4 directly.

---

## Phased build

- **UX-0 — Prototype the gate over a clip.** Static 8-silhouette grid on the
  FeedCard, tap sets a `shapeClass` filter, candidate strip shrinks. No sub-
  splits, no adaptive picker yet. Proves the feel. (Placeholder silhouettes ok.)
- **UX-1 — Wire the candidate strip to `narrow.ts`.** Shape as hard filter;
  strip reflects live candidate count. Add "skip to guess" -> existing MCQ.
- **UX-2 — Information-gain picker + adaptive Rung 3.** The smart trait
  ordering; auto-stop at <= 3.
- **UX-3 — Branch sub-splits (Rung 2)** for fish / flatfish / crab.
- **UX-4 — Reveal with diagnostic marks (Rung 4)** + scored-by-rung.
- **UX-5 — Real silhouette + diagram asset pass.** Replace placeholders.

Each phase ships something testable on the live feed.

---

## Open decisions for Christian

1. **Does the guided flow replace the current MCQ, or sit alongside it** as the
   "help me ID" path with MCQ as the fast lane? (Recommend: alongside, with
   skip-to-guess.)
2. **Scored-by-rung confirmed?** (Ties to integration-plan Phase 4 Option A.)
   "It's a crab" = partial credit.
3. **Silhouette assets:** commission an illustrator, or generate-then-vet?
4. **Build order:** prototype the gate first (UX-0) to feel it, or design the
   full asset set before any code?
