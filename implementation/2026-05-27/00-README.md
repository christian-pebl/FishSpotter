# FishSpotter Implementation Plan (2026-05-27)

**Source:** Session of 2026-05-27 (commits `7588315` → `95b8259`). Outstanding work surfaced when the user asked "any outstanding jobs?" after the gadoid pilot seed + adjustment landed.

**Executor:** Claude Code agents, picked up cold from this file.

**Total:** 10 agent tickets across 1 sprint + 3 editorial follow-ups noted for sequencing.

| Sprint | File | Tickets | Status | Headline |
|---|---|---|---|---|
| Q3-2026-A | [tickets.md](tickets.md) | 10 | ✅ 9/10 shipped (27 May, T9 parked) | Hygiene + photo-pipeline robustness + scoring phase 2 + progression layer |

---

## What's already shipped (context for cold start)

| Date | Ship | Commits |
|---|---|---|
| 2026-05-27 (am) | S9-T1: admin-authored diagnostic marks framework | `298b3ff`, `d89a8b3`, `a9ea2d4`, `e16266a`, `53202cb` |
| 2026-05-27 (pm) | Fins/tail wizard step, picker preload, feed UX polish, gadoid pilot seed (pollack live; bib/cod deleted pending photo curation) | `7588315`, `2f29b2d`, `5d6272a`, `95b8259` |

State of the gadoid pilot:
- ✅ `Pollachius pollachius`: 3 marks in prod DB (right-facing photo, coords mirrored by `scripts/adjust-gadoid-marks.ts`)
- ❌ `Trisopterus luscus`: 0 marks. Seeded then deleted (cached iNat photo is a mixed school, unusable for teaching).
- ❌ `Gadus morhua`: 0 marks. Seeded then deleted (cached iNat photo is a dead beach-cast specimen, unusable).
- `Merlangius merlangus` (whiting) and `Melanogrammus aeglefinus` (haddock) are in the `/admin/species` PILOT set but NOT in the 26-species `src/data/species-traits.json` catalogue, so they don't render in the admin list (see T3).

---

## Sequencing

Hard dependencies are noted per-ticket. Recommended order:

```
T1 (gitignore)         standalone, ship anytime
T2 (H-toggle on sheet) standalone, fast
T6 (iNat retry-429)    standalone, fast, prerequisite for any future fetch reliability work

T4 (photo-quality gate) ─┐
T5 (Wikimedia fallback) ─┴─→ unblocks E1 (bib/cod curation)

T3 (whiting/haddock)   editorial decision required first (drop from pilot, or author trait entries)

T7 (optimistic reorder) standalone, UX polish

T8 (consensus bonus)   needs cron + retro-scoring; ship after the rest stabilises

T9 (progression layer) XL. Multi-PR feature. Park until usage data justifies.

T10 (Vercel smoke)     run after every push that affects feed/idguide/picker
```

---

## How to use this plan

In a future Claude Code session:

> Read `implementation/2026-05-27/tickets.md`. Pick up at ticket Q3A-T{XX}. Acceptance criteria are in the file; mark tickets done as you land them, and add a commit hash to the status column when merged.

Each ticket follows the same shape as `implementation/2026-05-18/`:
- Priority (Critical / High / Medium / Low)
- Effort (S < 1hr, M 1-4hr, L 4-12hr, XL multi-session)
- Files to touch (with line numbers where stable)
- Current state → Target state
- Implementation approach
- Acceptance criteria (numbered, testable)
- Testing notes
- Risk / rollback
- Dependencies

---

## Editorial follow-ups (NOT agent work)

These need human marine-biology judgement and can't be agent-executed. Listed here so agents don't get blocked or duplicate work.

### E1: Curate bib + cod reference photos
Action: pick a clean single-specimen lateral live-fish photo for each of `Trisopterus luscus` and `Gadus morhua`. Add an entry under the `overrides` block in `src/data/species-images.json` for each. Then:

```
npm run db:refresh-images -- --species "Trisopterus luscus"
npm run db:refresh-images -- --species "Gadus morhua"
npm run db:seed-gadoid-marks
```

The seed script is idempotent and only inserts into species with zero marks, so bib + cod will be re-seeded onto the new photos. Coord tuning then happens in `/admin/species/[name]`.

Blocked by: nothing (can start immediately). Unblocks: full gadoid pilot completion.

### E2: Tune pollack ring coords
Action: open `/admin/species/Pollachius%20pollachius` in the live app. Drag each of the 3 rings onto the actual anatomical feature in the photo (kinked lateral line, projecting jaw, smooth chin). The seeded coords are educated guesses for a generic right-facing pollack and will be roughly but not precisely right.

Blocked by: nothing. The wizard already renders the seeded coords; tuning improves accuracy.

### E3: Author the wider catalogue (23 non-gadoid species)
Action: editorial pass in `/admin/species` for each non-gadoid species. The framework is ready; this is pure subject-matter work. Suggest starting with the most-frequently-seen species in FishSpotter snippets (run a quick SQL on `Snippet.staffAnswer` to rank).

Blocked by: photo-quality gate (T4) recommended first so the primary reference photo is admin-vetted before authoring marks on it.

---

## Cross-sprint dependency graph

```
T4 (curated photo gate) ──→ E1, E3
T5 (Wikimedia fallback) ──→ helps E1 when iNat returns are thin

T6 (retry-429) ──→ T5 (Wikimedia client should also retry on 429)

T8 (consensus bonus) ──→ depends on enough no-reference snippets accumulating
                         enough user answers (data dependency, not code)

T9 (progression) ──→ depends on per-user trait-encounter telemetry, which
                     itself needs a schema addition. Park.
```
