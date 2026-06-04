# Plan: tackle remaining items with agents + the Gemini 3.5 Flash image skill (4 Jun 2026)

## 1. What's left

| # | Item | Size | Approach |
|---|---|---|---|
| **A** | **15 species with NO diagnostic-mark rings** (the "guide gap") | the bulk | agents (research) + Gemini image skill (vision) + the proven verify loop |
| B | Photo-permission follow-ups (sprat, dragonet) | passive | watch for Kuilman/Svensen replies; ingest if granted |
| C | 2 species still photo-thin even after search (Atlantic mackerel 2, Sprat 3) | blocked | only resolvable via B (open-license ceiling already confirmed) |
| D | Ongoing coverage/quality drift as iNat grows | maintenance | the weekly cron + `images:assess` re-runs |

**The 15 (Gap A):** Atlantic mackerel, Sprat, Saithe, Spotted dragonet, Sand smelt, Dab, Atlantic
cod, Ballan wrasse, Corkwing wrasse, Goldsinny wrasse, Two-spotted goby, Plaice, Flounder,
Red mullet, Long-spined sea scorpion.

## 2. The division of labour (agents vs the Gemini image skill)

- **Research agents** decide the *content*: which 2-4 diagnostic features actually separate this
  species from its look-alikes, grounded in the UK ID sources we already hold
  (`decision-tree/id-guides/`: EA fish key, Hayward & Ryland, Sussex IFCA, FishBase). They output a
  structured spec per species: `[{label, description, featureToRing}]`. They never touch pixels.
- **The Gemini 3.5 Flash image skill** does all the *vision* (it is stronger at images than the
  orchestrator):
  1. `assessImageQuality()` — is the curated lead a clean single living specimen that actually shows
     the features? (existing)
  2. `locateFeatures()` — **NEW**: given the photo + the agent's feature labels, return the
     normalised (x, y) centre + suggested radius for each feature. This automates the hand-placement
     I did manually.
  3. verify loop — render the photo with the exact `AnnotatedSpeciesPhoto` geometry, ask Gemini per
     mark `{onFeature, badgeClear, featureVisible, correctX, correctY}`, snap corrections, re-verify.
- **The orchestrator (Claude)** glues it: runs the scripts, applies DB writes, and does the final
  human render-review (the orientation footgun means a person still eyeballs the result).

## 3. New tooling to build (extends the existing skill)

1. **`locateFeatures()` in `src/lib/biodiversity/gemini-vision.ts`** — same inline-image + strict
   `responseSchema` pattern as `assessImageQuality`, returns
   `{features: [{label, x, y, radius, visible, confidence}]}`. Thinking off (temp 0). Reuses the
   download/retry/usage plumbing.
2. **`scripts/author-marks.ts`** — input: a per-species spec file `src/data/mark-specs/<sci>.json`
   (`[{order,label,description}]`). For each species: pick the curated lead photo, call
   `locateFeatures` with the labels, create `DiagnosticMark` rows from the coords. Idempotent
   (skips species whose curated lead already has marks). Clamps coords/radius like the admin action.
3. **`scripts/verify-marks.ts`** — productionise the temp `verifyall.py` loop as a kept tool:
   render (component geometry, edge-safe badge) → Gemini verify → write a report + optional
   `--fix` that snaps onFeature=False marks (delta >= 0.13) to `correctX/Y` with a backup, then
   re-verifies. (Python stays the renderer; a thin `npm run db:verify-marks` wrapper drives it.)
4. **`npm` scripts:** `db:author-marks`, `db:verify-marks`.

## 4. Per-species pipeline (6 phases)

1. **Research (agent)** → feature spec grounded in UK ID sources. 2-4 marks max; each must be a
   feature actually *visible in a photo* (skip "underside aperture"-type features — lesson learned).
2. **Lead-photo check (skill: assess)** → confirm the curated lead is a clean single living lateral
   specimen showing those features. If poor, run the curation loop (`images:assess --fetch`) first.
3. **Locate (skill: locateFeatures)** → coords per feature on the lead photo.
4. **Author (script)** → create the marks.
5. **Verify + iterate (skill: verify loop)** → render + Gemini-check; snap corrections; re-verify
   until all `onFeature && badgeClear` (accept sub-0.15 noise, drop `featureVisible:false` marks).
6. **Human review + ship** → eyeball the final renders (orientation), commit `mark-specs/*` +
   `species-images.json` (any new curated leads), DB writes are live on prod, verify `/api/species-images`.

## 5. Agent orchestration & batching

Group the 15 by morphology so each research agent reuses look-alike context and we can fan out:

- **Batch 1 — gadoids:** Atlantic cod, Saithe (chin barbel / lateral-line / jaw features; reuse the
  bib/pollack/poor-cod patterns already authored).
- **Batch 2 — flatfish:** Dab, Plaice, Flounder (eyed-side spots, lateral-line curve, bony tubercles
  — the three are mutually the look-alikes, so one agent with all three is ideal).
- **Batch 3 — wrasses:** Ballan, Corkwing, Goldsinny (body shape, caudal spot, lips/teeth, colour).
- **Batch 4 — small/other:** Two-spotted goby, Red mullet (barbels), Sand smelt (two dorsals +
  silver stripe), Long-spined sea scorpion (cheek spine), Spotted dragonet (spotted dorsal).
- **Batch 5 — pelagic:** Atlantic mackerel (wavy bars), Sprat (keel scutes) — only once a photo that
  *shows* the feature is in hand (mackerel/sprat are photo-blocked; do last / pending permissions).

Run one research agent per batch (3-5 species each) in parallel = ~5 agents. Then the skill-driven
phases 2-6 run per species via the scripts.

## 6. Quality gates & cautions (carried from this session)

- Gemini's single-run spatial verdict is **noisy** — trust the categorical flags (visible / drawing
  / dead) and *large* position deltas; treat small deltas as noise; **always view the final render**.
- **Orientation footgun**: held/camouflaged fish read backwards at thumbnail scale — confirm head
  side before trusting a head/tail ring.
- **Marks render only on `curated` photos**, and only on a photo that actually shows the feature —
  drop a mark whose feature isn't in the photo rather than ring empty space.
- Coords are normalised to the photo's true aspect — keep dims backfilled (`db:backfill-image-dims`).

## 7. Cost & effort

Gemini 3.5 Flash, thinking off, ~1.5k tokens/call. Per species ≈ 1 assess + 1 locate + 2-3 verify
iterations ≈ 5 calls → ~75 calls for all 15, plus ~5 research agents. Well under ~$1 total. Realistic
shape: 1 day to build the 3 tools + pilot 1 species; then ~2-3 batched passes.

## 8. Sequencing (do this in order)

1. Build `locateFeatures()` + `author-marks.ts` + `verify-marks.ts` (+ npm scripts).
2. **Pilot on Atlantic cod** end-to-end (it has a good photo + clear features) to validate that the
   locate→verify loop reaches all-green with minimal hand-fixing. Tune the locate prompt if needed.
3. If the pilot holds, run Batch 1 research agent → author → verify → human review → ship. Repeat per
   batch (2 → 3 → 4), leaving Batch 5 (mackerel/sprat) pending photos/permissions.
4. Track the permission replies (item B); ingest any granted photo, then mark those species.
5. Re-run the full `db:verify-marks` audit at the end → catalogue-wide all-green confirmation.

## 9. Decision points for Christian

- **Marine-biology accuracy**: the research agents + UK sources produce a strong *draft* of each
  species' diagnostic marks, but ideally you (or a biologist) spot-check the feature choices before
  they go live — especially the flatfish and wrasse splits, which are subtle.
- **Scope**: do all 15, or prioritise the species users actually meet most in the feed first?
- **Permissions**: whether to chase the all-rights-reserved live sprat/dragonet beyond the drafted
  emails (e.g. a paid licence) if the photographers decline.
