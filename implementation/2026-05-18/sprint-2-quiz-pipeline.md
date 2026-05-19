# Sprint 2 — Quiz Pipeline Alignment

## Product decision required (flag prominently)

> **DECISION ASSUMED FOR THIS PLAN: multiple-choice quiz with 3-5 OBIS-derived candidates surfaced pre-answer.**
>
> The audit's most consequential finding (`03-quiz-flow.md` F1) is that the brief describes MCQ but the implementation is free-text + Levenshtein fuzzy match. The whole OBIS → GBIF → iNat pipeline (`/api/snippets/[id]/probability`, `SpeciesImage` cache) is designed to feed an MCQ candidate set, and it currently fires only *after* the answer is submitted.
>
> This sprint plan assumes the MCQ direction is chosen. If product decides differently:
> - **Free-text retained:** drop S2-T05 / S2-T06 / S2-T07 / S2-T16; keep S2-T01 (alias support), S2-T02 (server normalize + groupBy), S2-T03 (scoring fix), S2-T08 (gallery inlining via `staffAnswerScientific` only), S2-T09 (confetti dedupe), S2-T10 (preserve typed answer), S2-T11 (watch-first gate), S2-T12 (RarityPanel label).
> - **Hybrid (MCQ + "type instead" expert mode):** keep the full sprint and add a follow-up ticket in Sprint 3 for the expert-mode toggle.
>
> Flag and confirm before S2-T05 onwards lands. Tickets S2-T01 through S2-T04 are safe to ship under either decision.

## Goal

Align the implementation with the brief. Replace the free-text quiz with a multiple-choice quiz whose candidates come from the OBIS probability pipeline; surface the iNat photo cache inline at the reveal moment (its highest-leverage use); fix the leaderboard scoring formula that currently rewards wrong answers; eliminate the confetti / sound / typed-answer-loss / community-histogram fragmentation bugs that the audit flagged across `useCreatureQuiz`, `FeedCard`, `RarityPanel`, the answers/stats endpoints, and `/leaderboard`.

## Definition of done

1. `/feed` renders 3-5 species candidate buttons (OBIS top-N including the staff answer, shuffled, with iNat thumbnails) **before** the user answers. Free-text input is removed (or hidden behind an "expert mode" toggle deferred to S3).
2. `SpeciesGallery` renders inline in the post-answer stats card, not only inside the "How to spot a X" sheet.
3. Leaderboard scoring formula no longer rewards wrong answers; rule is surfaced in copy beneath the H1; rank ties are handled.
4. Confetti fires exactly once per snippet per session, regardless of edit-resubmit or rare-find rarity tier.
5. Anonymous users typing an answer (or tapping a candidate) are redirected to signin and their selection is rehydrated on return.
6. `normalizeAnswer` accepts scientific-name synonyms and per-species aliases; the community histogram and leaderboard "most common answers" panel both group by canonical key.
7. The quiz panel does not commit the user to an answer before the clip has played one loop (a watch-first gate is in place — either deferred panel open, or auto-shrink to pill).
8. `RarityPanel` no longer labels the staff scientific name "Your answer:".
9. `/api/snippets/[id]/stats` and `/api/snippets/[id]/probability` are answer-gated so the pre-answer MCQ candidate fetch does not leak the staff answer (depends on Sprint 1's E-theme fix; see "Dependencies on Sprint 1").
10. End-of-feed terminal card has a non-dead-end CTA.
11. Edge cases land: degenerate single-candidate buckets, empty image cache placeholder, ID-guide chat MAX_TURNS soft-handled, lightbox swipe, license attribution under thumb strip, streak race fixed by inlining streak into POST `/api/answers` response.
12. Vitest covers `normalizeAnswer` synonym matrix, scoring formula, MCQ candidate selection (degenerate bucket fallback), confetti dedupe.

## Audit findings addressed

| Audit ref | Severity | Sprint 2 ticket |
|---|---|---|
| §03 F1 — no MCQ, free-text + fuzzy match | High | S2-T05, S2-T06, S2-T07 |
| §03 F2 — quiz appears before clip is watched | Med | S2-T11 |
| §03 F3 — synonyms / scientific names marked wrong | High | S2-T01 |
| §03 F4 — `findMany` over Snippet table on every wrong answer | Med | S2-T02 (obviated by MCQ; correction lane removed) |
| §03 F8 — SpeciesGallery hidden behind ID-guide sheet | Med | S2-T08 |
| §03 F9 — gallery silently renders nothing for thin species | Med | S2-T17 |
| §03 F10 — lightbox lacks swipe / attribution clarity | Low | S2-T18 |
| §03 F11 — `editAnswer` doesn't refocus input | Low | S2-T09 (rolled into confetti/edit ticket) |
| §03 F12 — confetti double-fires on rare-find correct | Low | S2-T09 |
| §03 F13 — streak follow-up GET race | Low | S2-T13 |
| §03 F14 — typed answer lost on auth redirect | Med | S2-T10 |
| §03 F19 — stats histogram grouped by raw `chosenOption` | Med | S2-T02 |
| §03 F22 — edit + resubmit re-fires confetti | Low | S2-T09 |
| §03 F23 — last-clip terminal state stranded | Low | S2-T15 |
| §03 F24 — "Your answer:" mislabel on staff name | Med | S2-T12 |
| §03 F25 — license attribution weak inside thumb strip | Low | S2-T18 |
| §05 F-LB-02 — scoring rewards wrong answers (P0) | P0 | S2-T03 |
| §05 F-LB-06 — rank ties not handled | P2 | S2-T03 |
| §05 F-LB-08 — `chosenOption` bucketed by raw string | P1 | S2-T02 |
| §03 edge-case — degenerate bucket (single candidate) | — | S2-T07 |
| §03 edge-case — `staffAnswerScientific=null` | — | S2-T06 (graceful fallback) |
| §03 edge-case — ID-guide chat MAX_TURNS hard error | — | S2-T19 |
| §03 edge-case — chat closure bug (F15) | Low | S2-T19 |

## Dependency graph

```
                       ┌──────────────────────────────────────────────┐
                       │  Sprint 1 dependency: spoiler-leak fix on    │
                       │  /api/snippets/:id/stats + /probability      │
                       │  (audit §03 F6, F7; Theme E)                 │
                       └─────────────────────┬────────────────────────┘
                                             │
                                             ▼
   ┌─────────── data layer (land first) ──────────────┐
   │                                                  │
   │ S2-T01  normalizeAnswer + alias table            │
   │ S2-T02  groupBy(normalizeAnswer) + alias usage   │
   │ S2-T03  leaderboard scoring + ties + copy        │
   │ S2-T04  POST /api/answers returns streak inline  │
   │                                                  │
   └────────────────────┬─────────────────────────────┘
                        │
                        ▼
   ┌─────────── MCQ candidate endpoint ───────────────┐
   │                                                  │
   │ S2-T05  /api/snippets/:id/quiz   (new)           │
   │         derives 3-5 candidates from probability  │
   │         + iNat thumbs; auth-gated so it can      │
   │         legitimately return the staff option     │
   │ S2-T06  candidate selection logic + fallbacks    │
   │ S2-T07  degenerate-bucket fallback (catalogue)   │
   │                                                  │
   └────────────────────┬─────────────────────────────┘
                        │
                        ▼
   ┌─────────── client UI (depends on data) ──────────┐
   │                                                  │
   │ S2-T08  inline SpeciesGallery in stats card      │
   │ S2-T09  confetti / sound / edit-refocus dedupe   │
   │ S2-T10  preserve typed answer through signin     │
   │ S2-T11  watch-first gate                         │
   │ S2-T12  RarityPanel "Staff answer:" label        │
   │ S2-T13  remove sharedBaselineStreak race         │
   │ S2-T14  MCQ render in FeedCard (replaces input)  │
   │ S2-T15  end-of-feed terminal CTA                 │
   │                                                  │
   └────────────────────┬─────────────────────────────┘
                        │
                        ▼
   ┌─────────── polish / edge cases ──────────────────┐
   │ S2-T16  remove correction chip + dead code       │
   │ S2-T17  SpeciesGallery empty / error UX          │
   │ S2-T18  lightbox swipe + caption attribution     │
   │ S2-T19  ID-guide chat MAX_TURNS soft-handle      │
   │ S2-T20  Vitest coverage for the above            │
   └──────────────────────────────────────────────────┘
```

## Dependencies on Sprint 1

These S1 tickets **must land before S2-T05** ships (otherwise the new MCQ endpoint inherits the same spoiler leak):

- **S1 Theme E fix on `/api/snippets/[id]/stats`** — `staffAnswer` must be gated on an existing `Answer` row from the requester. The new MCQ endpoint (S2-T05) reuses the same gating pattern. (Audit §03 F6, §00 Theme E.)
- **S1 Theme E fix on `/api/snippets/[id]/probability`** — `staffAnswerScientific` must be gated on an existing `Answer` row OR the response must omit it pre-answer. S2-T05 needs an authenticated, server-side path that *can* see the staff answer (to ensure it's included as one of the candidates) without leaking it to the unauth client. (Audit §03 F7.)
- **S1 `callbackUrl` redirect lock** — S2-T10 (preserve typed answer through signin) depends on the validated callback URL surface; without it, the rehydration query param becomes an open-redirect vector.

If S1 has not yet landed Theme E fixes by the time Sprint 2 starts, S2-T05/T06 must internalise the gating (server-side fetch of staff answer never exposed to client) and add a regression test that the public `/probability` endpoint stops returning `staffAnswerScientific` to anonymous callers.

---

## Tickets

### S2-T01 — Synonym + alias support in `normalizeAnswer`

**Priority:** P1 · **Effort:** M · **Audit refs:** §03 F3

**Files:**
- `src/app/api/answers/route.ts` (lines 16-26 `normalizeAnswer`, lines 121-123 equality check)
- `prisma/schema.prisma` (new `SpeciesAlias` table or extend `SpeciesNameMap` with `aliases String[]`)
- `src/lib/biodiversity/` (new `species-aliases.ts` helper)
- `src/data/species-aliases.json` (new — editorial alias list)

**Current:** `normalizeAnswer` lowercases, strips diacritics, removes punctuation, drops articles. `isCorrect = normalizedStaffAnswer === normalizedOption`. A user typing `Pollachius pollachius` is marked wrong; `cuckoo-wrasse` vs `cuckoo wrasse` is OK (punctuation stripped) but `Labrus mixtus` is wrong.

**Target:** `isCorrect` true if normalized submission matches normalized staff answer **or** any registered alias for that staff answer. Aliases include: scientific binomial from `SpeciesNameMap`, common variants from editorial JSON (e.g. `["pollack", "pollock", "atlantic pollack"]`), plus auto-generated singular/plural pairs.

**Approach:**
1. Add `SpeciesAlias` table: `{ staffAnswer String @id, aliases String[] }`. Seed from `src/data/species-aliases.json` (editorial).
2. Auto-populate scientific aliases by joining `SpeciesNameMap` on `normaliseCommonName(staffAnswer)` → `scientificName`. Run once at backfill time (extend `scripts/seed-aliases.ts` or hook into `npm run db:backfill`).
3. In `POST /api/answers`: load aliases for the snippet's staff answer (single keyed read, cache in module scope with 5-min TTL), match normalized submission against `[staffAnswer, ...aliases]`.
4. Keep `normalizeAnswer` itself unchanged in behaviour but add a `normalize(value)` export so the leaderboard / stats endpoints (S2-T02) reuse it.

**Acceptance criteria:**
- Typing the Linnaean binomial for any of the 26 catalogued species is marked correct.
- Common synonyms (`pollack` / `pollock`) are both correct for the same clip.
- Plural variants (`catsharks` / `catshark`) are correct.
- `chosenOption` is still stored as-typed (the original surface form) so the stats endpoint can show what people actually wrote.
- Vitest: `expect(isCorrectAlias("Pollachius pollachius", "Pollack")).toBe(true)`.

**Testing:** unit tests for alias matrix; integration test that POSTs each of the 26 staff species' scientific name and gets `isCorrect: true`.

**Risk:** alias drift — if `SpeciesNameMap` re-resolves a species to a different canonical scientific name later, stale aliases persist. Mitigate by refreshing aliases in the same weekly cron that touches `SpeciesNameMap`.

**Dependencies:** none. Safe to land first under either MCQ or free-text product decision (still useful for the autocomplete in MCQ-with-search variants).

---

### S2-T02 — Group community histograms by `normalizeAnswer` everywhere

**Priority:** P1 · **Effort:** S · **Audit refs:** §03 F19, §05 F-LB-08

**Files:**
- `src/app/api/snippets/[id]/stats/route.ts:17-32`
- `src/app/leaderboard/page.tsx:20-33`

**Current:** Stats endpoint groups by raw `chosenOption` (case-sensitive, whitespace-sensitive). Leaderboard "Most common species answers" groups by `chosenOption.trim()`. Result: `"pollack"`, `"Pollack"`, `"pollack "`, `"the pollack"` count as four distinct rows.

**Target:** Both endpoints group by `normalizeAnswer(chosenOption)`; display the most common surface form per group, or the staff canonical if it appears.

**Approach:**
1. Extract `normalizeAnswer` from `api/answers/route.ts` into `src/lib/normalize-answer.ts` (no behaviour change).
2. In stats route, reduce `answers` into `Map<normalizedKey, { count, surfaceForms: Map<string, count> }>`, pick canonical surface as `staffAnswer` if normalized match, else most frequent.
3. Same pattern in leaderboard page reduction.
4. Add an optional `+N variants` tooltip surface for hover (deferred polish — not blocking).

**Acceptance criteria:**
- Seeding 5× `"Pollack"`, 3× `"pollack"`, 1× `"the pollack"` yields a single row with count 9 and surface `"Pollack"`.
- No regression in current displayed numbers when all answers happen to share a single surface form.

**Testing:** Vitest on the reducer; manual: seed varied case answers locally, hit `/api/snippets/{id}/stats`.

**Risk:** very low. Pure server-side reduce; no schema change.

**Dependencies:** S2-T01 extraction of `normalizeAnswer` into a shared module (do them together).

---

### S2-T03 — Fix leaderboard scoring formula + ties + rule transparency

**Priority:** P0 · **Effort:** S · **Audit refs:** §05 F-LB-02 (P0), F-LB-06, F-LB-04, F-LB-07

**Files:**
- `src/app/leaderboard/page.tsx:40-52, 79-89`

**Current:** `score = correct * 1 + (total - correct) * 0.5` — every wrong answer is worth 0.5. Ties broken by `Object.entries` insertion order. No rule explanation visible. No self-row highlight. No empty-state for users with 0 answers.

**Target:**
- Score = `correct` (pure count) with a minimum-volume gate of `≥10 answers` for ranking eligibility. Rationale: aligns with the brief's "celebrate accurate observations".
- Rank ties share rank (`1, 2, 2, 4` style).
- Subhead beneath H1: `"Score = correct identifications. Each clip counts once per spotter. Minimum 10 answers to enter the ranking."`
- Self-row highlight via `auth()` server-side, with sticky footer row showing "Your rank: #N" if signed-in user is off-leaderboard.
- Personal empty-state: signed-in user with 0 answers gets a "Head to the live feed" CTA card below the table.

**Approach:**
1. Replace score formula. Add `eligible = total >= 10` filter before sort.
2. Sort, then walk list with `previousScore` pointer to assign rank.
3. Read session in the server component (`auth()` from `@/lib/auth`); join `byUser[session.user.id]` to compute self-rank.
4. Add a small `<p>` under the H1 with the rule.

**Acceptance criteria:**
- 100 random answers (~50% correct) scores 50, **not** 75.
- Two users with 12 correct both display `#3`; next user is `#5`.
- The rule paragraph is visible on the leaderboard hero.
- Signed-in user sees their row highlighted with `bg-[color:var(--surface-muted)]`; if off-list, sticky footer renders "Your rank: #87 (8 correct)".
- Signed-in user with 0 answers sees the empty-state CTA card.

**Testing:** Vitest on scoring + tie-breaking logic; Playwright snapshot of the rule paragraph + self-row highlight; contract test asserting top-N order is stable across two requests with the same DB state.

**Risk:** P0 visible change to leaderboard; if external screenshots have been shared with funders citing current rank, surface the change in release notes. Editorial: confirm the 10-answer threshold with PEBL before merging.

**Dependencies:** none.

---

### S2-T04 — Return streak in `POST /api/answers` response (kill the follow-up GET)

**Priority:** P2 · **Effort:** S · **Audit refs:** §03 F13

**Files:**
- `src/app/api/answers/route.ts:142-163`
- `src/lib/useCreatureQuiz.ts:117-123`

**Current:** Client does a `fetch("/api/answers")` POST, then a follow-up `fetch("/api/streak")` GET to read the new streak, comparing against module-scoped `sharedBaselineStreak`. Race condition: rapid mount/unmount of cards reads `sharedBaselineStreak` before the previous answer's commit lands.

**Target:** POST `/api/answers` response includes `{ streak: { previous, current } }`. Client uses the diff directly; `sharedBaselineStreak` global is removed.

**Approach:**
1. In `POST /api/answers` after the upsert, call the existing streak computation (the same logic that backs `/api/streak`) inside the same transaction. Return `streak: { previous, current }`.
2. In `useCreatureQuiz.handleSubmit`, replace the GET + `sharedBaselineStreak` block with `if (data.streak.current > data.streak.previous) playStreak();`.
3. Delete the `let sharedBaselineStreak` and the second `useEffect` that primes it.
4. Keep the `fishspotter:streak` CustomEvent dispatch.

**Acceptance criteria:**
- POST response shape includes `streak.current` and `streak.previous`.
- Rapid scroll across cards does not over-trigger `playStreak()`.
- `/api/streak` endpoint still works (header / leaderboard use it).

**Testing:** Vitest on the route response shape; manual: rapid scroll on `/feed`, listen for streak sound, verify single trigger per actual streak increment.

**Risk:** low. Mostly a code-clean win.

**Dependencies:** S2-T09 (confetti dedupe) will read the streak diff from the same place, so land T04 first.

---

### S2-T05 — `GET /api/snippets/[id]/quiz` (new endpoint, MCQ candidate set)

**Priority:** P1 · **Effort:** M · **Audit refs:** §03 F1, F8

**Files:**
- `src/app/api/snippets/[id]/quiz/route.ts` (new)
- `src/lib/biodiversity/candidates.ts` (new — candidate selection logic)
- `src/lib/auth.ts` (no change; consumed)

**Current:** No MCQ endpoint exists. `/probability` returns the full OBIS species ranking and (audit §03 F7) leaks `staffAnswerScientific` to anonymous callers.

**Target:** New authenticated endpoint that returns 3-5 species candidates for the quiz UI. Candidates = staff answer **plus** top OBIS species at the snippet's bucket, shuffled, with iNat thumbnail + scientific name. Endpoint does NOT separately disclose which candidate is the staff answer (the client is supposed to be guessing). Endpoint is authenticated so it can legitimately include the staff option without leaking against the public `/probability` route.

**Approach:**
1. Auth gate: require `session.user.id`. (Anonymous users go through the signin flow before they see candidates — see S2-T10. Pre-signin they see a teaser pill.)
2. Resolve snippet, bucket, cached `SpeciesProbability`. If `INSUFFICIENT_DATA` or `ERROR`, fall back to S2-T07 logic.
3. Build candidate pool:
   - Always include the staff answer (resolved via `SpeciesNameMap` for scientific name + common name).
   - Take top-N OBIS species by probability (configurable, default N=8) **excluding** the staff species.
   - Filter to species that have at least one `SpeciesImage` row (so every option has a thumb).
   - Pick `numCandidates - 1` randomly from the filtered pool, weighted by probability (so plausible distractors).
   - Shuffle the final 3-5.
4. For each candidate, fetch the top-1 `SpeciesImage` (curated first, then by `ordering`).
5. Response shape:
   ```ts
   {
     candidates: Array<{
       scientificName: string;
       commonName: string;
       thumbUrl: string | null;
       attribution: string | null;
     }>;
     fallback: "OBIS" | "CATALOGUE" | "DEGENERATE";
   }
   ```
6. Cache the candidate set in a new `SnippetQuizCandidates` table keyed by `snippetId` (so the same user sees the same candidates on reload — the shuffle is deterministic per snippet) **or** seed with a snippet-keyed PRNG (simpler, no migration). Recommend the PRNG path for sprint 2.

**Acceptance criteria:**
- Endpoint returns 3-5 candidates for any snippet with a populated `SpeciesProbability` row.
- The staff answer is always one of the candidates.
- Anonymous requests get 401.
- Deterministic per snippet: two calls return the same candidates in the same order.
- Fallback `"CATALOGUE"` path returns candidates from the 26-species catalogue when bucket data is missing.
- Fallback `"DEGENERATE"` path: if only the staff answer is available (no plausible distractors), the endpoint flags it so the UI can degrade gracefully (S2-T07).

**Testing:** Vitest with seeded buckets — assert candidate count, staff inclusion, determinism, anonymous rejection. Contract test asserting `staffAnswerScientific` is not separately surfaced (the staff option is just one of the candidate objects).

**Risk:** core new endpoint — get the determinism right. Use a stable hash of `snippetId` as the PRNG seed.

**Dependencies:** Sprint 1 spoiler-leak fix on `/probability` (so the public endpoint stops leaking; this one is the authenticated replacement for the candidate use-case).

---

### S2-T06 — Candidate selection algorithm + `staffAnswerScientific=null` fallback

**Priority:** P1 · **Effort:** S · **Audit refs:** §03 F1; edge case "what happens when `staffAnswerScientific` is null"

**Files:**
- `src/lib/biodiversity/candidates.ts` (new — implementation for S2-T05)

**Current:** No selection logic.

**Target:** Pure function `selectCandidates({ probability, staffAnswer, staffScientific, imageIndex, n = 4, seed })` that returns an ordered, shuffled list. Handles three branches:
1. **OBIS**: probability row + `staffScientific` resolved + at least 3 photo-having distractors → ideal MCQ.
2. **CATALOGUE**: probability row missing OR `staffScientific=null` → draw distractors from the 26-species catalogue (excluding staff), still seeded by `snippetId`.
3. **DEGENERATE**: fewer than 2 photo-having distractors available → return `{ candidates: [staffAnswer], fallback: "DEGENERATE" }`. The UI (S2-T07) will hide the MCQ and surface a "no comparable candidates" message with a free-text fallback for this rare case.

**Approach:** pure unit; no I/O. Tested in isolation.

**Acceptance criteria:**
- Given a probability row with 10 photo-having species + staff included, returns 4 candidates with staff in position randomized by seed.
- Given `staffScientific=null`, falls back to CATALOGUE and still includes the staff common name as a candidate.
- Given a bucket with 0 photo-having distractors, returns `{candidates:[staff], fallback:"DEGENERATE"}`.
- Same `(snippetId, n)` always yields the same shuffle.

**Testing:** Vitest property tests — for any seed, candidates always include the staff answer, length is in `[1, n]`, no duplicates.

**Risk:** low — pure function.

**Dependencies:** S2-T05.

---

### S2-T07 — Degenerate-bucket UI fallback (single-candidate + catalogue mode)

**Priority:** P2 · **Effort:** S · **Audit refs:** §03 F1; edge case "degenerate single-candidate buckets"

**Files:**
- `src/components/FeedCard.tsx` (MCQ render block from S2-T14)

**Current:** MCQ block doesn't exist yet.

**Target:** When the `/quiz` endpoint returns `fallback: "DEGENERATE"`, the FeedCard renders:
- A small "Not enough comparable species in OBIS for this site. Free-text fallback below." note.
- The legacy free-text input behind a hidden expert path (do NOT remove the input from the codebase until S2-T16, just hide it under this branch for now).

When `fallback: "CATALOGUE"`, render normally but show a discreet "candidates drawn from catalogue (OBIS data unavailable here)" microcopy under the buttons.

**Acceptance criteria:**
- Degenerate snippets do not show a 1-button "quiz" that auto-reveals.
- Microcopy is muted but readable.

**Testing:** Playwright on a seeded snippet with deliberately empty bucket.

**Risk:** low.

**Dependencies:** S2-T05, S2-T06, S2-T14.

---

### S2-T08 — Inline `SpeciesGallery` in the reveal stats card

**Priority:** P1 · **Effort:** S · **Audit refs:** §03 F8

**Files:**
- `src/components/FeedCard.tsx:958-1057` (stats card block)
- `src/components/SpeciesGallery.tsx` (no change; consumed)

**Current:** After answering, the user sees a text-only stats card. The photo of the actual species lives only inside the "How to spot a X" sheet, behind a click.

**Target:** A 3-thumb `SpeciesGallery size="thumb"` strip appears directly inside the reveal card, between the "was X" line and the community histogram. Tap a thumb → opens existing lightbox.

**Approach:**
1. In the reveal block, after the staff-answer line, render `<SpeciesGallery size="thumb" scientificName={staffAnswerScientific} commonName={stats.staffAnswer} />`.
2. `staffAnswerScientific` comes from the `/api/snippets/[id]/probability` response which `RarityPanel` already fetches; lift it into `useCreatureQuiz` (or fetch once in `FeedCard` and pass down).
3. If `staffAnswerScientific` is null → gracefully render nothing inline; the fall-through stays as the field-note sheet path.
4. Add a single small caption line: "Photos: iNaturalist community, CC-licensed" (folds in part of S2-T18).

**Acceptance criteria:**
- Inline gallery visible on every snippet where `SpeciesImage` rows exist for the staff species (24 of 26 species per `CLAUDE.md`).
- Empty species (plaice larva, catshark egg case) do not render a broken strip — they fall through to the existing "How to spot a X" sheet path (still useful for the field-note text).
- Clicking a thumb opens the lightbox; closing returns focus to the originating thumb.

**Testing:** Playwright: answer a clip → assert 3 `<img>` tags visible in reveal card → click first → lightbox opens.

**Risk:** layout — the reveal card is already dense on mobile. Verify on 375px viewport; the gallery's existing 3-up grid should fit.

**Dependencies:** decision on whether to gate `staffAnswerScientific` in `/probability` behind an answer check (Sprint 1 E theme). If gated, the inline gallery only renders post-answer (which is exactly what we want — it IS the reveal).

---

### S2-T09 — Confetti / sound / edit-resubmit dedupe + edit refocus

**Priority:** P1 · **Effort:** S · **Audit refs:** §03 F11, F12, F22

**Files:**
- `src/lib/useCreatureQuiz.ts:107-123, 148-157`
- `src/components/RarityPanel.tsx:69-80`
- `src/components/FeedCard.tsx` (input ref usage)

**Current:**
- Confetti fires inside `handleSubmit` immediately on correct, then again 60ms after `RarityPanel` decides the species is rare (`probability < 0.05`).
- Edit-then-resubmit fires fresh confetti + sound.
- `editAnswer` removes stats card but does not refocus the input.

**Target:**
- One celebratory effect per (user, snippet) per session. Rare-find tier upgrades the visual (e.g. longer / wider burst, gold tint) but does not stack on top of the standard burst.
- `editAnswer` queues a `requestAnimationFrame` focus on the input ref.
- Sound is governed by the same dedupe ref.

**Approach:**
1. Add `celebratedSnippetIds: Set<string>` in `useCreatureQuiz` (ref, not state).
2. Remove confetti / `playCorrect` from `handleSubmit`'s correct branch. Move the trigger into a `useEffect` keyed on `(myAnswer?.isCorrect, rarityTier)` where `rarityTier` is fed in from `RarityPanel` via a callback (or compute rarity inside the hook by lifting the probability fetch).
3. The effect calls `playCorrect()` + `triggerCorrectConfetti(tier)` exactly once, then adds `snippet.id` to the celebrated set.
4. `editAnswer` clears `myAnswer` but does NOT clear `celebratedSnippetIds` — resubmit is silent.
5. `editAnswer` schedules `requestAnimationFrame(() => inputRef.current?.focus())`. Pass the ref into the hook or expose an `onEditAnswer` callback.

**Acceptance criteria:**
- Rare-find correct: exactly one confetti burst (upgraded visual).
- Common correct: exactly one confetti burst.
- Edit + resubmit same correct answer: zero new confetti, zero new sound.
- Clicking "Edit answer" → input is focused without further user click.

**Testing:** Playwright with confetti DOM observer (mock `triggerCorrectConfetti` to a spy in test mode); assert call count == 1 across the scenarios.

**Risk:** rarity tier coupling — currently `RarityPanel` owns the rarity check. Either lift it or expose a callback. Lifting is cleaner but touches `useCreatureQuiz` shape. Prefer lifting since the data is already fetched by `RarityPanel` and the hook owns celebration logic.

**Dependencies:** S2-T04 (streak diff arrives inline so the celebration effect can subsume the streak ping in the same orchestrator).

---

### S2-T10 — Preserve typed / tapped answer through signin redirect

**Priority:** P1 · **Effort:** S · **Audit refs:** §03 F14; Theme D

**Files:**
- `src/lib/useCreatureQuiz.ts:78-82`
- `src/components/FeedCard.tsx:843-955` (signin pill copy)
- `src/app/auth/signin/page.tsx` (rehydration on return)

**Current:** Anonymous user types `pollack`, presses Enter → `window.location.href = "/auth/signin?callbackUrl=..."`; the typed text is lost. The "Sign in to save your streak" microcopy is `text-[10px] white/45`, barely visible.

**Target:** Anonymous user's pending answer (free-text OR tapped MCQ candidate) is preserved across the signin round-trip. Microcopy is bumped to readable.

**Approach:**
1. In `handleSubmit`, before the redirect, stash `{ snippetId, chosenOption }` in `sessionStorage` under a stable key `fishspotter:pendingAnswer`.
2. Build the signin redirect URL with `callbackUrl=/feed/{snippetId}` (already keyed) AND a `pending=1` flag.
3. On `/feed` mount, if `sessionStorage["fishspotter:pendingAnswer"]` matches the currently visible snippet, populate `answerText` (free-text mode) or pre-select the MCQ candidate, then auto-submit once `session?.user` is present.
4. Clear the sessionStorage entry after consumption.
5. Bump the "Sign in to save your streak" pill to `text-xs text-white/70` and reword to "Sign in to save your answer and streak."

**Acceptance criteria:**
- Anonymous user submits → after signin, lands on the same clip with their answer auto-submitted; reveal card is visible.
- Cancel signin → typed answer is still in the input on return to `/feed`.
- Pending answer for snippet A does NOT auto-submit if the user lands on snippet B.

**Testing:** Playwright with a clean session: open `/feed`, type, submit, complete signin flow, assert reveal card visible.

**Risk:** auto-submit on return could surprise users who changed their mind. Alternative: rehydrate the input but require an explicit confirm click. Pick that if PEBL prefers "no surprise auto-actions" — flag in the PR.

**Dependencies:** Sprint 1 `callbackUrl` lock (§04 F11) — without it, the rehydration path becomes an open-redirect vector. If S1 hasn't landed, gate this ticket behind a strict allowlist (`/feed`, `/feed/[id]`, `/feed/browse`).

---

### S2-T11 — Watch-first gate before MCQ appears

**Priority:** P2 · **Effort:** S · **Audit refs:** §03 F2

**Files:**
- `src/components/FeedCard.tsx:481-495` (rVFC loop), `539-575` (panel mount), `714-746`

**Current:** Identification panel is mounted dead-centre from the moment the card paints, encouraging users to commit before they've watched the fish.

**Target:** Panel starts collapsed to its pill state until the video has completed one loop. After one loop, the pill auto-expands (or wiggles to invite) and the MCQ buttons appear.

**Approach:**
1. Track `hasCompletedFirstLoop: boolean` in `FeedCard` state.
2. In the rVFC loop, when `videoRef.current.currentTime` resets to <0.1s and `firstLoopElapsed >= duration`, set true.
3. Gate the "expanded panel" render on `(hasCompletedFirstLoop || userHasExpandedManually)`.
4. The collapsed pill stays interactive — user can manually expand at any time. Add subtle "Watching..." copy on the pill until the first loop completes.

**Acceptance criteria:**
- Fresh card paint: pill is visible, MCQ buttons are not.
- After ~30s (first loop), pill auto-expands and MCQ is visible.
- User can tap the pill at any time to expand early.
- Respects `prefers-reduced-motion` (no wiggle on reduced).

**Testing:** Playwright with a mocked short video (e.g. 2s clip) to keep test runtime sane; assert MCQ buttons appear after first loop ends.

**Risk:** UX trade-off — power users may find the gate annoying. Consider an optional setting in Sprint 5. Defaults must be confirmed with PEBL.

**Dependencies:** S2-T14 (MCQ render lands first).

---

### S2-T12 — Fix `RarityPanel` "Your answer:" label

**Priority:** P2 · **Effort:** XS · **Audit refs:** §03 F24

**Files:**
- `src/components/RarityPanel.tsx:137-141`

**Current:** Line 140 reads `Your answer: {staffSci}` but displays the staff scientific name.

**Target:** `Staff answer: {staffSci}`. Reserve "Your answer:" for `myAnswer.chosenOption`.

**Approach:** one-line label swap. Optionally add a separate "Your answer: {chosenOption}" row above it (decide editorially).

**Acceptance criteria:** label is correct on reveal cards.

**Testing:** manual; covered by snapshot diff.

**Risk:** none.

**Dependencies:** none.

---

### S2-T13 — Remove `sharedBaselineStreak` race

**Priority:** P2 · **Effort:** XS · **Audit refs:** §03 F13

**Files:**
- `src/lib/useCreatureQuiz.ts:28-30, 57-66, 117-123`

**Current:** Module-scoped `let sharedBaselineStreak: number | null = null` is primed by a separate `useEffect` and read after each submit. Race on rapid mount/unmount.

**Target:** Removed entirely. Streak diff comes from POST `/api/answers` response (S2-T04).

**Approach:** Delete the global, delete the priming `useEffect`, replace the consuming block with `if (data.streak.current > data.streak.previous) playStreak()`.

**Acceptance criteria:** module-scoped `let` is gone; tests still pass; streak sound still triggers on legitimate increment.

**Dependencies:** S2-T04.

---

### S2-T14 — MCQ render in `FeedCard` (replaces free-text input)

**Priority:** P0 · **Effort:** M · **Audit refs:** §03 F1; Theme D

**Files:**
- `src/components/FeedCard.tsx:843-955` (cold-state input block)
- `src/lib/useCreatureQuiz.ts` (new `handleCandidateTap(scientificName)`)

**Current:** Cold state renders a free-text `<input>` + submit arrow + Skip + signin pill.

**Target:** Cold state renders the 3-5 candidate cards returned by `/api/snippets/[id]/quiz` (S2-T05). Each card: thumb + common name + scientific name (smaller). Tap → submit. Skip pill stays. Anonymous tap triggers the signin flow with answer preservation (S2-T10).

**Approach:**
1. Add a `useQuizCandidates(snippetId)` hook that fetches the new endpoint and handles loading / `INSUFFICIENT_DATA` / `DEGENERATE`.
2. Render candidates as a 2x2 grid (or 1xN on mobile) of tappable cards. Style: PEBL teal border on hover, slightly elevated card, focus ring for keyboard nav.
3. Tap → `handleSubmit({ answerText: candidate.commonName })`. The submission still uses common-name string so the existing API contract (with S2-T01 alias support) does the right thing.
4. Replace the input only — keep the panel chrome (drag handle, collapse pill, "Where is this?" link). The "Help me identify" link is now redundant for the MCQ case but still useful for fallback — keep it.
5. Keyboard: 1-5 number keys select candidates; Enter confirms; Esc skips.

**Acceptance criteria:**
- `/feed` cold state shows 3-5 candidate buttons (no input).
- Tap submits the candidate's common name.
- Keyboard 1-5 works.
- Loading state: skeleton 4-up grid.
- Empty / degenerate state: free-text fallback (S2-T07).

**Testing:** Playwright on the full flow; visual regression at 375 / 768 / 1280.

**Risk:** highest-visibility change in the sprint. Stage behind a feature flag (`NEXT_PUBLIC_QUIZ_MODE=mcq|freetext`) so it can be toggled if rollout reveals issues.

**Dependencies:** S2-T05, S2-T06, S2-T11 (watch-first gate composes here).

---

### S2-T15 — End-of-feed terminal CTA card

**Priority:** P2 · **Effort:** XS · **Audit refs:** §03 F23

**Files:**
- `src/components/FeedCard.tsx:1043-1055`

**Current:** Last clip's reveal hides the "Next" button, leaving only Edit + Archive.

**Target:** When `!hasNext`, show a celebratory terminal block: "You've reached the end of the feed" + buttons for "View leaderboard", "Browse archive", "Start over".

**Approach:** conditional render swap when `!hasNext`. Reuse PEBL surface styling.

**Acceptance criteria:** last clip's reveal shows terminal CTA; not-last clips unchanged.

**Testing:** Playwright on a clip list of length 1 (or seed a 2-clip dataset and answer both).

**Risk:** none.

**Dependencies:** none.

---

### S2-T16 — Retire the correction chip + free-text dead code

**Priority:** P2 · **Effort:** S · **Audit refs:** §03 F18 (correction chip auto-focus bug); §03 F4 (`findMany` on every wrong answer)

**Files:**
- `src/app/api/answers/route.ts:74-88, 125-140`
- `src/lib/useCreatureQuiz.ts:38, 102-105, 133-143`
- `src/components/FeedCard.tsx:783-831`

**Current:** Server returns `{correction: ...}` for first-time misspellings; client renders the "Did you mean: X?" chip; chip auto-focuses "Yes". Levenshtein full-table scan on every wrong first answer.

**Target:** Correction chip + Levenshtein code path **removed** because MCQ candidates eliminate spelling ambiguity entirely. The `skipCorrection` flag and the `findMany` call go with it.

**Approach:**
1. Delete `levenshteinDistance`, `tokenOverlapScore`, `similarityScore`, `suggestionThreshold`, `getCorrectionSuggestion` from the route.
2. Delete the `correction` branch in `handleSubmit`; delete `acceptCorrection` / `submitOriginal` / `correction` state from the hook.
3. Delete the correction chip render in `FeedCard`.
4. Keep the route's response shape backwards-compatible (consumers just won't see `correction` anymore).

**Acceptance criteria:**
- `POST /api/answers` no longer touches `prisma.snippet.findMany`.
- Hook surface no longer exposes `correction`, `acceptCorrection`, `submitOriginal`.
- Linter / TypeScript pass (no unused imports).

**Testing:** ensure existing tests that asserted the correction branch are updated/removed.

**Risk:** if the free-text fallback (S2-T07 degenerate path) ever re-enters, we lose the spelling forgiveness. Acceptable — degenerate is rare and the alias system (S2-T01) catches most synonyms.

**Dependencies:** S2-T14 must land first (so MCQ is the active path before this is removed).

---

### S2-T17 — `SpeciesGallery` empty / error UX

**Priority:** P2 · **Effort:** S · **Audit refs:** §03 F9, F20

**Files:**
- `src/components/SpeciesGallery.tsx:48, 84-94`

**Current:** Empty status → `return null` silently. Error status in thumb mode → `return null`. Error in large mode → "Photos unavailable right now." with no retry.

**Target:**
- Field-note view, empty: render "Photos coming soon — iNaturalist has no community CC photos for this life stage yet." with a small fallback link to the parent species' adult photos if a parent mapping exists.
- Error mode: render a "Retry" button that re-triggers the fetch; auto-retry once with 1s backoff for transient 5xx.

**Approach:** add a "retry" callback that re-runs the existing fetch effect; render a placeholder block in empty mode. Don't touch thumb mode (still silent — fine for the inline reveal).

**Acceptance criteria:**
- Plaice-larva field note shows the placeholder copy, not a blank gap.
- Forcing a 500 in the dev tools network panel shows the retry button; clicking re-fetches.

**Testing:** Storybook story for the three states; Playwright on the plaice-larva snippet.

**Risk:** none.

**Dependencies:** none.

---

### S2-T18 — Lightbox swipe navigation + caption attribution

**Priority:** P2 · **Effort:** S · **Audit refs:** §03 F10, F25

**Files:**
- `src/components/SpeciesGallery.tsx:200-205, 272-278, 304-323`

**Current:** Lightbox supports arrow keys + on-screen chevrons but no swipe. Per-image attribution lives only inside the lightbox. CC-BY arguably requires per-image credit alongside the work where reasonable.

**Target:**
- Add `touchstart` / `touchmove` / `touchend` handlers on the lightbox image area: swipe left/right → next/prev photo, swipe down → close. Honour `prefers-reduced-motion`.
- Add a single caption beneath the inline thumb strip: "Photos: iNaturalist community, CC-licensed".
- Add an external-link icon next to the per-image attribution link in the lightbox so the tap affordance is clear.

**Approach:** straight-forward touch handler with a 60px threshold; caption is a `<p>` under the grid.

**Acceptance criteria:**
- Swipe-left advances photo on touch devices.
- Caption visible beneath inline strip.
- External-link icon visible in lightbox attribution.

**Testing:** Playwright with `device: iPhone 12`; visual regression diff.

**Risk:** none.

**Dependencies:** S2-T08 (since the caption attaches to the inline strip introduced there).

---

### S2-T19 — ID-guide chat: soften MAX_TURNS + fix `awaitingFirstToken` closure

**Priority:** P2 · **Effort:** S · **Audit refs:** §03 F15, F16

**Files:**
- `src/app/api/idguide/chat/route.ts:223-228, 328-336`
- `src/components/IdGuideChat.tsx:120-130, 158, 261`

**Current:** Hitting `MAX_TURNS=8` returns a 400; client surfaces as an error with disabled input — user must close & reopen to continue. `awaitingFirstToken` is read from a stale closure inside the stream loop; `useCallback` deps include it, churning identity.

**Target:**
- Server: at MAX_TURNS, return a 200 with a final "Open a fresh chat to keep narrowing" assistant message rather than a 400.
- Client: replace `awaitingFirstToken` state with a `useRef` to dodge the stale-closure read. Drop it from the `useCallback` deps.

**Approach:** small refactor in both files.

**Acceptance criteria:**
- Hitting turn 9 shows a graceful "fresh chat" CTA, not a red error.
- `sendMessage` callback identity is stable across stream ticks.

**Testing:** mock the SSE stream in Vitest; manual smoke on the chat.

**Risk:** none.

**Dependencies:** none.

---

### S2-T20 — Vitest coverage for normalize / scoring / candidate selection / dedupe

**Priority:** P2 · **Effort:** S · **Audit refs:** all of the above

**Files:**
- `src/__tests__/normalize-answer.test.ts` (new)
- `src/__tests__/leaderboard-scoring.test.ts` (new)
- `src/__tests__/quiz-candidates.test.ts` (new)
- `src/__tests__/celebration-dedupe.test.ts` (new)

**Target:**
- `normalizeAnswer`: idempotence, alias matching matrix for all 26 species.
- Leaderboard scoring: pure scoring fn, tie ranking, eligibility threshold.
- Candidate selection: determinism by seed, staff inclusion invariant, degenerate / catalogue fallbacks.
- Celebration dedupe: confetti spy + edit-resubmit asserts call count == 1.

**Acceptance criteria:** all four suites green in CI; coverage report shows the normalized / scoring / candidate modules at >90%.

**Testing:** itself.

**Risk:** none.

**Dependencies:** all the tickets above whose logic is under test.

---

## Estimate roll-up

| Effort | Count | Tickets |
|---|---|---|
| XS | 3 | T12, T13, T15 |
| S | 12 | T01–04 (partial), T06, T07, T08, T09, T10, T11, T16, T17, T18, T19, T20 |
| M | 4 | T01, T02 shared module pull, T05, T14 |

Total: 20 tickets. Realistic two-week sprint with one engineer if S2-T05 / S2-T14 are sequenced first; faster with two.
