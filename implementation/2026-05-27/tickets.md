# Sprint Q3A: Tickets

10 tickets surfaced 2026-05-27. Each is self-contained enough that an agent can pick it up cold given this file + the codebase.

| ID | Priority | Effort | Title | Status |
|---|---|---|---|---|
| Q3A-T1 | Low | S | Untrack `tsconfig.tsbuildinfo` and gitignore it | Pending |
| Q3A-T2 | Medium | S | Apply H-key toggle to the IdGuide sheet | Pending |
| Q3A-T3 | Medium | S | Reconcile pilot set with catalogue: whiting + haddock | Pending |
| Q3A-T4 | High | M | Photo-quality gate: only `curated=true` photos drive diagnostic-mark rendering | Pending |
| Q3A-T5 | Medium | M | Wikimedia Commons fallback when iNat returns thin photo sets | Pending |
| Q3A-T6 | Low | S | Retry-on-429 in the iNat client | Pending |
| Q3A-T7 | Medium | M | Optimistic move-to-back when a feed card is answered | Pending |
| Q3A-T8 | Medium | L | S7-T1 phase 2: consensus retro-bonus for no-reference snippets | Pending |
| Q3A-T9 | Low | XL | Progression layer (bronze/silver/gold, adaptive difficulty) | Pending |
| Q3A-T10 | Critical | S | Vercel smoke checklist after every feed/idguide/picker push | Pending |

---

## Q3A-T1: Untrack `tsconfig.tsbuildinfo` and gitignore it

**Priority:** Low **Effort:** S (< 15 min)

**Current state:** `tsconfig.tsbuildinfo` is committed in the repo. It's the TypeScript incremental compiler's cache; it changes on every `tsc` run and shows up in every `git status`. It's not in `.gitignore`.

**Target state:** File is gitignored, not tracked, and `git status` is clean after a fresh `tsc --noEmit`.

**Files to touch:**
- `.gitignore` (add `tsconfig.tsbuildinfo`)
- `tsconfig.tsbuildinfo` (remove from index, keep working copy)

**Implementation:**
```
git rm --cached tsconfig.tsbuildinfo
# edit .gitignore, add: tsconfig.tsbuildinfo
git add .gitignore
git commit -m "chore: untrack tsconfig.tsbuildinfo build cache"
```

**Acceptance criteria:**
1. `git status` shows nothing after running `npx tsc --noEmit`.
2. Future CI / dev sessions don't see `tsconfig.tsbuildinfo` in their diff.

**Risk / rollback:** None. Build cache regenerates locally on next `tsc` run. No production effect.

**Dependencies:** None.

---

## Q3A-T2: Apply H-key toggle to the IdGuide sheet

**Priority:** Medium **Effort:** S (~30 min)

**Current state:** `src/components/FeedCard.tsx` registers an `H` keyboard shortcut that collapses/expands the MCQ panel. The larger `IdGuideSheet` (`src/components/IdGuideSheet.tsx`, 96vw × 94vh modal) only has Escape-to-close. When the user said "all windows should be minimisable" they meant the sheet too.

**Target state:** Pressing `H` while the `IdGuideSheet` is open toggles it closed → reopens to last state (last step + selections preserved). Same skip-when-typing guard as the feed shortcut.

**Files to touch:**
- `src/components/IdGuideSheet.tsx` (lines 89-98, the existing `keydown` handler)
- `src/components/FeedCard.tsx` (currently only the feed-level handler, may need a per-card flag so the sheet handler wins when open)

**Implementation approach:**
1. In `IdGuideSheet.tsx`, extend the `keydown` handler to also match `e.key === "h" || "H"`. Same input-focus guard pattern as `FeedCard.tsx`:
   ```ts
   const t = e.target as HTMLElement | null;
   if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
   ```
2. On H press, call `onClose()` (same as Escape).
3. To preserve state on reopen, lift `stepIdx` + `selections` out of `IdGuideWizard` and into the parent `FeedCard` (the sheet's owner). Or persist them in `sessionStorage` keyed on snippetId. The sessionStorage approach is simpler and survives the sheet remount.
4. The feed-level H handler in `FeedCard.tsx` already skips inputs but doesn't know if the sheet is open. Add a check: if `idGuideOpen` is true, the feed handler should NOT also toggle the picker panel. Use the existing state.

**Acceptance criteria:**
1. With the IdGuide sheet open, pressing `H` closes it.
2. Reopening the sheet restores the user's previous step and selections.
3. Typing "h" in the chat textarea inside the sheet does NOT close the sheet.
4. The feed-panel H toggle still works when the sheet is closed and is suppressed when the sheet is open.

**Testing notes:**
- Manual: open the sheet, navigate to step 3, pick a few traits, press H, re-open, verify position.
- No automated test required; the keyboard plumbing is too thin to be worth Playwright.

**Risk / rollback:** Low. Pure UX layer. If reopen-state preservation is fiddly, ship the close-on-H part alone and follow up.

**Dependencies:** None.

---

## Q3A-T3: Reconcile pilot set with catalogue: whiting + haddock

**Priority:** Medium **Effort:** S (~30 min if dropping; M if adding)

**Current state:** `src/app/admin/species/page.tsx:10-16` lists 5 pilot gadoids:
```
Pollachius pollachius     ← in catalogue ✓
Trisopterus luscus        ← in catalogue ✓
Merlangius merlangus      ← NOT in catalogue ✗
Gadus morhua              ← in catalogue ✓
Melanogrammus aeglefinus  ← NOT in catalogue ✗
```

Whiting and haddock don't render in the admin list because the page iterates `Object.entries(CATALOGUE)`. The seed script silently skips them. The pilot effectively reduces to 3 species.

**Target state:** Pick one:
- **Option A (recommended, fast):** Drop whiting and haddock from `PILOT`. Pilot is 3 species; that's enough to validate the pattern.
- **Option B (slow, more authoring):** Add whiting + haddock entries to `src/data/species-traits.json` with the full trait set + fieldNote, then add their drafts to `GADOID_DRAFTS` in `scripts/seed-gadoid-marks.ts`.

**Files to touch:**
- Option A: `src/app/admin/species/page.tsx` (remove 2 entries from `PILOT`)
- Option B: `src/data/species-traits.json`, `src/data/species-images.json` (override entries if needed), `scripts/seed-gadoid-marks.ts` (extend `GADOID_DRAFTS`), CLAUDE.md (mention)

**Acceptance criteria:**
- Option A: `/admin/species` shows 3 pilot species, all linked + authorable. CLAUDE.md updated to reflect the 3-species pilot.
- Option B: All 5 species in the admin list with mark counts. Both new species have at least 3 trait values per key (so `narrowCandidates` can match them).

**Recommendation for the agent:** Use AskUserQuestion to confirm A vs B before executing. Option B is editorial work that benefits from marine-biologist sign-off on the trait values.

**Dependencies:** None.

---

## Q3A-T4: Photo-quality gate: only `curated=true` photos drive diagnostic-mark rendering

**Priority:** High **Effort:** M (2-4 hours)

**Current state:** `AnnotatedSpeciesPhoto` renders marks on whatever `SpeciesImage` row has the lowest `ordering` for the species. That row is whatever iNat returned first under the "research grade" filter, which sorts by community species-ID agreement, not by photo composition. Today's session surfaced that two of three pilot photos were unusable (bib: mixed school; cod: dead beach-cast). The framework rendered marks on them anyway because the schema is satisfied.

The `SpeciesImage` table already has a `curated: Boolean` column (default `false`, set to `true` for manual `overrides` entries from `src/data/species-images.json`). It's not currently used to gate anything.

**Target state:** `AnnotatedSpeciesPhoto` (and the admin authoring UI) only consider photos with `curated=true` as eligible for diagnostic-mark attachment. Non-curated iNat photos remain available in the `SpeciesGallery` thumb-strip.

**Files to touch:**
- `src/components/AnnotatedSpeciesPhoto.tsx` (the photo-picking query)
- `src/app/admin/species/[name]/page.tsx` (filter the photo dropdown / overlay target)
- `src/app/admin/species/[name]/actions.ts` (in `createMark`, reject if the target photo's `curated === false`)
- `src/app/api/species-images/[name]/route.ts` (if it exists; check where the marks-included query lives)
- `src/data/species-images.json` (audit: which species have curated overrides? probably few)
- CLAUDE.md (document the gate)

**Implementation approach:**
1. Audit current state: `SELECT scientificName, COUNT(*) FILTER (WHERE curated) AS curated_count, COUNT(*) AS total FROM "SpeciesImage" GROUP BY scientificName;` (likely most species have 0 curated photos).
2. In the photo-picker for marks, add `WHERE curated = true` to the query. If no curated photo exists, return null (so `AnnotatedSpeciesPhoto` falls through to the thumb-strip path).
3. In `createMark` server action, add a guard:
   ```ts
   if (!photo.curated) throw new Error("Diagnostic marks can only be attached to curated reference photos. Add this photo to species-images.json overrides first.");
   ```
4. Update CLAUDE.md to document the gate.

**Acceptance criteria:**
1. A species with no `curated=true` photo renders no rings in the wizard, even if it has `DiagnosticMark` rows. (Falls through to thumb-strip + field-note path.)
2. The admin UI prevents attaching new marks to non-curated photos.
3. Existing pollack marks still render (their photo is the iNat one, currently `curated=false`). Either: (a) manually flip the pollack photo to `curated=true`, or (b) curate a better pollack photo first.
4. Re-running `npm run db:seed-gadoid-marks` after curation works idempotently.

**Migration consideration:** The 3 existing pollack marks will go dark when the gate ships unless its photo is flagged curated. Either flip the flag for the existing iNat pollack photo (a known-OK shot), or include the photo-flip in the same PR.

**Risk / rollback:** If the gate ships and breaks the only working pilot (pollack), the wizard's teaching layer regresses. Ship with the pollack photo flagged curated in the same commit.

**Dependencies:** Recommend before E1 (curate bib/cod) and E3 (author wider catalogue).

---

## Q3A-T5: Wikimedia Commons fallback when iNat returns thin photo sets

**Priority:** Medium **Effort:** M (3-5 hours)

**Current state:** `src/lib/biodiversity/inaturalist.ts` is the only photo source. The 18 May activation note in CLAUDE.md flagged "2 empty buckets (plaice larva, catshark egg case, expected)" but other species may also return thin sets in the lifeStage/sex buckets per `src/data/species-images.json`.

**Target state:** When iNat returns < N photos for a species' primary bucket, fall back to Wikimedia Commons API for additional CC-licensed shots. Stored in the same `SpeciesImage` table with `source = "wikimedia"`.

**Files to touch:**
- `src/lib/biodiversity/wikimedia.ts` (new client, mirrors `inaturalist.ts` shape)
- `src/lib/biodiversity/refresh-images.ts` (extend to call the new client when iNat thin)
- `prisma/schema.prisma` (no change needed; `SpeciesImage.source` already accepts arbitrary strings)
- `src/data/species-images.json` (extend manifest schema if per-species toggle wanted)
- One unit test for the new client (mirror `candidates.test.ts` style)

**Implementation approach:**
1. Wikimedia Commons MediaWiki API: `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=Pollachius+pollachius&gsrnamespace=6&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=600&format=json`. Returns image candidates with EXIF + licence metadata.
2. Filter by licence: accept `cc0`, `cc-by`, `cc-by-sa`, `cc-by-nc` (matching iNat acceptance).
3. Build attribution string from `extmetadata.Artist` + `extmetadata.LicenseShortName`.
4. Trigger fallback when `iNatRows.length < 3` for a species. Top up to a min of 3.
5. Add to the existing weekly cron path (`/api/cron/refresh-images`).

**Acceptance criteria:**
1. Running `npm run db:refresh-images -- --species "Pleuronectes platessa"` returns at least 3 photos (was previously thin on larva bucket).
2. Wikimedia rows are tagged `source = "wikimedia"` and carry correct attribution.
3. Licence filter rejects `cc-by-nd` and unlicensed photos.
4. Unit test covers: thin iNat → Wikimedia tops up; non-thin iNat → Wikimedia not called.

**Testing notes:** Hit a couple of real Wikimedia URLs in the test to verify the parser shape; mock thereafter. Cost is 0 (Wikimedia is free + no rate-limit auth required, just respectful headers).

**Risk / rollback:** Adds a second external dependency. If Wikimedia is down, current behaviour is preserved (iNat-only). Failure path = log + continue.

**Dependencies:** T6 (retry-429) should land first so the Wikimedia client gets retry behaviour for free if the iNat client is refactored to share it.

---

## Q3A-T6: Retry-on-429 in the iNat client

**Priority:** Low **Effort:** S (~1 hour)

**Current state:** `src/lib/biodiversity/inaturalist.ts` makes raw `fetch` calls. iNat rate-limits to 100 req/min; bursts during a full `db:refresh-images` run (26 species × 1-4 buckets each) can hit the limit. Mentioned in CLAUDE.md "Deferred to v2".

**Target state:** When the iNat client gets HTTP 429, it backs off (exponential, jittered) and retries up to 3 times. Mirrors the pattern in `src/lib/biodiversity/refresh.ts` for OBIS.

**Files to touch:**
- `src/lib/biodiversity/inaturalist.ts`
- One unit test

**Implementation approach:**
1. Wrap the iNat `fetch` in a `withRetry` helper that:
   - On 429 or 503: wait `base * 2^attempt + jitter`, retry. `base = 500ms`, max 3 attempts.
   - On other 4xx: throw immediately (don't waste retries on 404s).
   - On 5xx: retry once.
2. Honour the `Retry-After` header if present.

**Acceptance criteria:**
1. Test: mocked 429 → 200 retries successfully.
2. Test: 3 consecutive 429s → throws.
3. Test: 404 → throws on first attempt.
4. `db:refresh-images` end-to-end run completes without manual restart even when the rate limit fires.

**Risk / rollback:** Low. Pure client-side robustness.

**Dependencies:** Should land before T5 if T5 will share the retry helper.

---

## Q3A-T7: Optimistic move-to-back when a feed card is answered

**Priority:** Medium **Effort:** M (2-3 hours)

**Current state:** S8-T1 (per-user shuffle) ships answered snippets at the back of the user's stable shuffle. But a card answered mid-session stays in its scroll position until reload. Noted in CLAUDE.md as "Optimistic move-to-back on submit deferred".

**Target state:** When a user submits an answer on the active card, the card animates out of its position and slots to the back of the queue. Next card scrolls up. Reload doesn't change the order (the answered card is already at the back per the stable shuffle).

**Files to touch:**
- `src/components/FeedPlayer.tsx` (the IntersectionObserver scroll container)
- `src/lib/feed-ordering.ts` (extend to support a client-side `recentlyAnswered` overlay on top of the stable shuffle)
- Possibly `src/lib/useCreatureQuiz.ts` (the submit handler; needs to emit the reorder event)

**Implementation approach:**
1. After `handleSubmit` resolves successfully, the parent `FeedPlayer` receives an event with the answered snippet's ID.
2. `FeedPlayer` maintains a `recentlyAnsweredIds: Set<string>` (session-local). When ordering, snippets in this set sort to the tail of the un-answered queue.
3. Animate via Framer Motion `layout` prop on each card so they re-flow on next render.
4. The next card in view becomes active automatically via the existing observer logic.

**Acceptance criteria:**
1. Submit an answer → answered card slides to the back, next card scrolls into view, ~300ms transition.
2. Reload → same order (the answered card is at the back via stable shuffle; the session-local set is empty but the persistent order matches).
3. `Skip` on a card does NOT move it (only successful submissions do).
4. Edge: submitting on the last unanswered card scrolls back to the top of the now-all-answered tail.

**Testing notes:** Unit test the ordering overlay in `feed-ordering.test.ts` style. Visual behaviour confirmed manually.

**Risk / rollback:** Animation jank if cards are tall. Test on mobile Safari especially.

**Dependencies:** None.

---

## Q3A-T8: S7-T1 phase 2: consensus retro-bonus for no-reference snippets

**Priority:** Medium **Effort:** L (4-8 hours)

**Current state:** S7-T1 ships nullable references + a `points` column on `Answer`. Pending answers (no reference snippet) earn `POINTS_PENDING_REF = 1`. The CLAUDE.md "Scoring model" section already specifies the phase 2 design:

> When K ≥ 3 independent users converge on the same name for a no-reference snippet, a background job will retro-credit each matcher with `POINTS_CONSENSUS_BONUS` (e.g. +2).

**Target state:** A scheduled job detects consensus (K ≥ 3 users with normalised-equal `chosenOption` on the same null-reference snippet), retro-credits each matcher with +2 points, and emits an audit row.

**Files to touch:**
- `prisma/schema.prisma` (new `ConsensusEvent` table for audit: snippetId, consensusName, achievedAt, beneficiaries[])
- `src/app/api/cron/consensus-rescore/route.ts` (new cron endpoint, guarded by `CRON_SECRET`)
- `vercel.json` (register the cron; daily at 06:00 UTC is fine)
- `src/lib/answer-matching.ts` (export the normalised-equal helper for cron reuse)
- One unit test
- CLAUDE.md (move from "Phase 2 (deferred)" to shipped + cron details)

**Implementation approach:**
1. Cron queries: `SELECT snippetId, normalisedName, COUNT(DISTINCT userId) FROM Answer JOIN Snippet ON snippetId WHERE Snippet.staffAnswer IS NULL AND Answer.isCorrect IS NULL GROUP BY snippetId, normalisedName HAVING COUNT(DISTINCT userId) >= 3`.
2. For each consensus group, check `ConsensusEvent` to skip already-credited groups.
3. UPDATE Answer points = points + 2 for each beneficiary; INSERT ConsensusEvent.
4. Run idempotently; re-running the cron should be a no-op.

**Acceptance criteria:**
1. 3 users picking "Pollack" on a no-reference snippet → each user's Answer.points goes from 1 to 3 after cron runs.
2. 4th user picking "Pollack" on the same snippet later → also gets retroactively credited (the cron credits anyone who matches a previously-achieved consensus).
3. Re-running the cron the next day doesn't re-credit anyone.
4. Auditable: each consensus row in `ConsensusEvent` lists who was credited and when.

**Testing notes:** Unit test the consensus detection logic in isolation. E2E test via a seed fixture that creates the 3-user scenario.

**Risk / rollback:** Mass-updates `Answer.points`. Wrap in a transaction per consensus group. If rollback needed: `UPDATE Answer SET points = points - 2 WHERE id IN (SELECT beneficiary FROM ConsensusEvent WHERE eventId = ?)`.

**Dependencies:** None.

---

## Q3A-T9: Progression layer (bronze/silver/gold, adaptive difficulty)

**Priority:** Low **Effort:** XL (multi-session)

**Current state:** S9-T1 plan deferred this explicitly: "Track which traits a user has been taught. First encounter = explanation; subsequent = just ask. 'Marine biologist level': bronze (body shapes), silver (fin configurations), gold (single-mark IDs). Visible on profile / leaderboard. Adaptive difficulty: high-accuracy users default to expert mode; new users get the full wizard."

**Target state:** Per-user telemetry tracks trait encounters and accuracy. Wizard adapts (skip explanations the user has seen, jump straight to candidates for users with high accuracy). Profile + leaderboard display the badge tier.

**Files to touch:** Many. New `UserTraitProgress` table, profile page rework, wizard adaptive logic, leaderboard badge column. Probably 3-4 PRs.

**Why parked:** Needs usage data to justify. Without telemetry on which traits trip users up, the level boundaries are guesswork. Ship T8 first to get more signal in `Answer.points`, then revisit.

**Acceptance criteria:** TBD: write a separate audit doc when this gets pulled forward.

**Risk / rollback:** Big. Scope to be defined before kickoff.

**Dependencies:** Worth deferring until at least 100 active users + 1000 answered snippets so the level thresholds aren't arbitrary.

---

## Q3A-T10: Vercel smoke checklist after every feed/idguide/picker push

**Priority:** Critical **Effort:** S (5 min per push)

**Current state:** No documented post-push smoke test. Today's session pushed `95b8259` and the agent assumed Vercel would auto-deploy cleanly. Should be a 60-second drill.

**Target state:** A documented checklist that the next agent runs whenever a push touches feed UX, the wizard, or the candidate picker.

**Files to touch:**
- `implementation/2026-05-27/smoke-checklist.md` (new, just this list)
- CLAUDE.md (link to it from the Guidelines section)

**Checklist content (~10 lines):**
```
Post-push smoke (fish-spotter.vercel.app):
1. Visit /feed signed in. Confirm a card loads with thumbnails painted (no empty tiles).
2. Press H. Panel collapses → press H again, panel expands.
3. On mobile viewport (Chrome devtools 375px): bottom-gradient renders; on desktop (>768px) it doesn't.
4. Open "Help me identify" → step through body shape → size → FINS/TAIL (the new step) → habitat. Confirm step counter shows 6 total.
5. Reach FinalReveal for pollack → confirm 3 numbered rings render on the photo with the legend below.
6. Reach FinalReveal for bib or cod → confirm NO rings render; thumb-strip + field-note path shows instead.
7. Submit an answer → reveal panel shows points (2 for correct ref, 1 for pending).
8. Check Vercel deploy logs for any build warnings on the latest commit.
```

**Acceptance criteria:** Checklist exists; CLAUDE.md links to it from the "Guidelines for Claude" section.

**Risk / rollback:** None.

**Dependencies:** None.
