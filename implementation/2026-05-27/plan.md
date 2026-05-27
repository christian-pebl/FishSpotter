# Implementation & Recommendation Plan — 27 May 2026

Derived from the 14-agent design review (`design-review.md`).

## Strategic framing

The review surfaced **two categories of problem** with very different shapes:

1. **Code-level UX/a11y defects** — small, well-scoped, all under 2 hours each. Most are one-line fixes. Together they're the difference between "feels like a prototype" and "feels like a product".

2. **Content/data-layer problems** — bigger, slower, need editorial judgment, not code. The candidate photo quality, generic reference IDs ("Fish"/"Crab"), and 1-of-26 species mark coverage cap how good the UX can ever feel. No amount of polish on the chassis fixes a wizard that teaches one species.

The implementation plan runs these as **parallel tracks**: Track A (code, my work) ships fast while Track B (content, editorial decisions) gestates. Sprint sequencing reflects this — don't block Track A waiting for content decisions.

A third category — **strategic investments** beyond bug-fixes — sits at the back. Mostly recommendations rather than tickets.

---

## Sprint Q4-A: Critical UX fixes (one session, ~6 hours, all code)

A single PR titled "UX critical fixes" containing 10 commits. All items are < 2 hours, mostly < 30 min. No dependencies between items; can ship in any order. Sequence below is risk-ordered (cheapest first, so the PR keeps shipping even if one item bogs down).

| # | Ticket | What | Effort | Files |
|---|---|---|---|---|
| 1 | A-1 | `inert={!isActive}` on off-screen feed cards | 5 min | `FeedPlayer.tsx:174` |
| 2 | A-2 | Primary button hover: `bg-teal-800` → `bg-teal-600` | 5 min | `globals.css:98` |
| 3 | A-3 | Persistent session redirect: `/` → `/feed` if signed in | 15 min | `middleware.ts` |
| 4 | A-4 | Leaderboard top-3 row tints (gold/silver/bronze) | 20 min | `leaderboard/page.tsx:192-199` |
| 5 | A-5 | `/feed/browse` accessible to anonymous (read-only) | 30 min | `feed/browse/page.tsx` + middleware |
| 6 | A-6 | IdGuideSheet Tab focus-trap (mirror SideMenu pattern) | 30 min | `IdGuideSheet.tsx:86-117` |
| 7 | A-7 | IdGuide click isolation: stopPropagation on sheet pointer events | 30 min | `IdGuideSheet.tsx`, `IdGuideWizard.tsx` |
| 8 | A-8 | Mobile touch-target audit: Hide pill, Skip, Where, Help-me-identify, signup-toggle, wizard footer links — all `min-h/w-[44px]` | 1h | `FeedCard.tsx`, `IdGuideSheet.tsx`, `auth/signin/page.tsx` |
| 9 | A-9 | Emoji → SVG: 🐟 in IdGuideTrigger, 🔥 in SideMenu streak | 1h | `IdGuideTrigger.tsx:109`, `SideMenu.tsx:197` |
| 10 | A-10 | Reveal flash before card advance (300ms inline verdict overlay on submitted card before move-to-back fires) | 1.5h | `FeedCard.tsx` reveal logic + `FeedPlayer.tsx` reorder timing |

**Verification before merge:**
- Run `implementation/2026-05-27/smoke-checklist.md` (existing).
- Re-run a manual cut of journey 12 (daily-driver) — confirm reveal is visible without scrolling.
- Tab-through audit: open IdGuide sheet, confirm focus cycles inside it.
- Lighthouse a11y score on `/feed` and `/leaderboard` — should clear 95+.

**Note on A-10 (reveal flash):** this is the single highest-impact item in the plan. Recommend implementing as: on submit, the card's MCQ panel transitions to a "verdict overlay" state showing the pill (✓/✗/★) + "+N pts" + reference for ~700ms, THEN the move-to-back animation fires. Do not auto-advance on mobile — require a "Next" tap (P-4 from the review).

---

## Sprint Q4-B: Data / content audit (parallel with A, needs Christian)

This track unblocks the biggest UX wins but requires editorial decisions I shouldn't make alone. Structure: I prepare the diagnostics + scripts; Christian makes the calls.

### B-1: Reference ID backfill audit

**My work first (no dependency):** write `scripts/audit-reference-ids.ts` that outputs a table grouping `Snippet.staffAnswer` by frequency, joined with `SpeciesNameMap` resolution status, and proposes per-snippet actions: `keep` (already species-level), `backfill` (genus-level but identifiable), `nullify` (truly indeterminate → treat as no reference, +1 path applies).

**Christian's call:** review the proposed actions for the ~30 snippets, approve the `backfill` proposals.

**Then my work:** execute the backfill via `prisma db push` or a one-off update script. Include the SQL retro-score from CLAUDE.md to update existing `Answer.points` for newly-resolved snippets:
```sql
UPDATE "Answer" a
SET "isCorrect" = (matched_via_alias_aware_logic),
    "points"    = CASE WHEN matched THEN 2 ELSE 0 END
WHERE a."snippetId" IN (newly_backfilled_ids) AND a."isCorrect" IS NULL;
```

**Estimated effort:** 2h my work + 30 min Christian review.

### B-2: MCQ candidate photo curation gate

Extend the `curated=true` gate (built in Q3A-T4 for diagnostic marks) to also gate MCQ candidate tiles. Audit current state:

```sql
SELECT
  scientificName,
  COUNT(*) FILTER (WHERE curated) AS curated_count,
  COUNT(*) AS total_count
FROM "SpeciesImage"
GROUP BY scientificName
ORDER BY total_count DESC;
```

For species used as MCQ candidates with zero curated photos, the picker should fall back to silhouette + species name (acceptable) rather than the first iNat photo (currently unacceptable: textbook diagrams, hands).

**My work:** update `MCQCandidatePicker.tsx` query + render logic; update `/api/snippets/[id]/quiz` to filter candidates by curated availability.

**Christian's work:** for the top 10-15 most-frequent MCQ species, curate one photo each (find a good iNat or Wikimedia URL, add to `src/data/species-images.json` overrides with `curated: true`, run `npm run db:refresh-images -- --species "X"`).

**Estimated effort:** 1.5h my code + ~2h Christian's curation per 10 species. Editorial work paces this; code can ship as soon as the gate is in.

### B-3: Mark authoring expansion (top confused pairs)

The wizard teaches genuinely for pollack but is a guess-funnel for the other 25 species. Strategic investment, not a quick fix.

**My work:** write `scripts/confusion-matrix.ts` that produces a ranked list of confused species-pairs from `Answer` data: `(staffAnswer, chosenOption)` tuples where `isCorrect=false`, grouped by frequency.

**Christian's work:** author marks for the top 5 confused pairs (most likely candidates: pollack ↔ bib ↔ cod, plaice ↔ dragonet, sand goby ↔ dragonet, common goby ↔ sand goby, Ballan wrasse ↔ Corkwing wrasse).

The pollack marks already do this implicitly ("rules out cod and bib at a glance"). Make discrimination the explicit authoring brief: each mark should answer "what does this rule out?"

**Estimated effort:** 30 min my script + ~30-45 min Christian authoring time per species pair. Pace this over the next 2-4 weeks.

---

## Sprint Q4-C: Design polish (one session, ~8 hours)

After Sprint A merges. Mix of layout work, copy edits, and visual restructures. Group into 2-3 logically related PRs rather than one mega-PR.

### PR C1: Auth + landing polish (~3h)
- B-14: Auth page editorial content. Recommend: right-side panel with a single still from a curated PEBL clip + a one-line field-note quote ("From the Bideford Bay deployment, 14m depth"). No new infrastructure; reuse the snippets CDN.
- P-9: Demote "Explore archive" CTA to a text link below the primary two.
- P-10: Rewrite hero headline. Suggested: "Identify species from real underwater footage — and help build a shared observation record."
- P-11/P-15: Landing body text contrast → `--foreground`.
- P-12: Auth error copy rewrite.
- P-14: Forgot-password input style alignment with sign-in.
- P-22: Header gradient leak fix.
- P-19: Silent redirect messages → contextual auth-page copy.

### PR C2: Feed layout (~3h)
- P-1: Mobile panel `max-h: 50vh`.
- P-2: Desktop two-column layout at `>=lg` (video left, MCQ right at 720px panel cap).
- P-4: Disable auto-advance on mobile reveal; require explicit Next tap.
- P-8: Move-to-back animation tightening (0.45 → 0.3s, add scale-down on departing card).
- P-18: "Answered" / "Open" pill overlay on browse archive cards.

### PR C3: IdGuide restructure (~2h)
- P-3: FinalReveal collapses non-top candidates to header + snippet, expandable.
- P-5: "Why ask this?" first sentence inline (always visible), full rationale behind disclosure.
- P-6: AnnotatedSpeciesPhoto `preserveAspectRatio="xMidYMid meet"`.
- P-7: Size step — add "no scale visible" auto-skip option.
- P-23: finShape split into two sub-questions (dorsal count → tail shape).
- P-25: Hide turns-left counter until ≤ 3.
- P-26: Raise `NARROW_ENOUGH` to 3 or add `stepIdx >= 2` guard.

**Verification:** rerun all 5 user journeys after C2 + C3 merge. Particularly journey 13 (stuck novice) — confirm FinalReveal is now the dominant teaching moment, not a wall of cards.

---

## Sprint Q4-D: Foundations cleanup (low priority, high coherence value)

Mostly invisible to users but reduces future drift. Defer until A-C are shipped.

| Item | What | Effort |
|---|---|---|
| D-1 | `src/lib/motion.ts` constants (`DURATION.micro/standard/layout`, `EASE.enter/exit/layout`); migrate all Framer call-sites | 2h |
| D-2 | Verdict pill design tokens: add `correct`/`incorrect`/`pending` to `tailwind.config.ts`, migrate emerald/rose/amber call-sites | 1h |
| D-3 | Type scale migration: replace ad-hoc `text-[10px]`, `text-xs` with named scale (`display`, `h1`, `h2`, etc.) where appropriate | 3h |
| D-4 | Border-radius consolidation: pick `rounded-card` + `rounded-full`, deprecate `rounded-hero` and `rounded-modal`, migrate call-sites | 1h |
| D-5 | CSS-var vs Tailwind-alias deduplication (`--primary` vs `teal-600`) — pick one path, remove the other | 1h |
| D-6 | Nits batch commit (18 items from the review's Nits section) | 2h |
| D-7 | Add the design rules to CLAUDE.md "Guidelines for Claude" section (already drafted at the foot of `design-review.md`) | 15 min |

**Estimated total:** ~10 hours. Spread across two sessions.

---

## What's NOT in this plan

| Item | Why parked |
|---|---|
| Q3A-T9 progression layer (bronze/silver/gold) | Still pre-data. Revisit once consensus-rescore cron has produced 2-3 weeks of points-history signal. |
| P-17 Bottom tab bar on mobile | Needs design exploration (3 tabs vs 4? icon set? badge on /feed for unanswered count?). Worth a separate scoping ticket rather than rolling into a polish PR. |
| P-27 Murky-video companion images in FinalReveal | Content work — each species needs a hand-curated screenshot from the snippet library with the diagnostic feature circled. Park until mark coverage is wider (do after B-3 progresses). |
| IdGuide chat tone audit | The chat path was not deeply tested by the 14-agent fleet (most journeys used the wizard path). Worth a dedicated review pass if the chat becomes a more-used path. |

---

## Strategic recommendations (the longer view)

Beyond the ticket-by-ticket work, three observations from the review worth elevating:

### 1. Content is now the bottleneck, not code

The chassis review (agents 1, 7, 8) found a well-built, well-tokenised, professionally-engineered codebase. The journey reviews (10-14) found the loop breaks down because the data underneath is uneven (generic references, low-quality candidate photos, 1-species mark coverage). **The next sprint after Q4-A should probably be a content sprint** — Christian + 1-2 hours from a marine biologist contributor authoring marks on the top 5 confused species pairs, curating one good iNat photo per high-frequency species. That work is invisible in the codebase but moves the product more than any UI change would.

### 2. The wizard is the strategic differentiator — invest in it

FishSpotter could be a Duolingo-for-fish or just-another-quiz-app. The IdGuide wizard with "Why ask this?" disclosures and annotated diagnostic photos is what makes it the former. The stuck-novice opus journey was unambiguous: when the wizard reaches a species with full mark coverage, it genuinely teaches; everywhere else it's a guess-funnel. The mark-authoring backlog deserves a named role / budget line rather than being one of Christian's many threads. Even 1 species per week takes the wizard from "rare delight" to "consistently the teaching layer it claims to be" in ~6 months.

### 3. The mobile experience needs a dedicated pass, not just touch-target tweaks

A-8 cleans up the worst offenders (44px minimums), but the mobile journey rated one-handed operability **5/10**. The hamburger-only navigation, the lack of an "answered" state on browse, the auto-advancing reveal, the 55%-of-screen MCQ panel are not single-bug problems — they're symptoms of a desktop-first design getting compressed onto mobile. After Q4-A ships, consider commissioning a 1-2 day **mobile-first redesign pass** that takes the feed surface and rethinks it for thumb-only operation rather than patches it. This is the right time to do it (before mark coverage expands and locks in the FinalReveal layout).

### 4. The 14-agent review pattern is reusable

The static-agents + journey-agents structure produced findings that a single reviewer would have missed (the static agents catch code-level issues; the journey agents catch flow-level issues; together they catch the cross-cutting ones like "the H key works but is undiscoverable"). Worth keeping in `.claude/` as a `/design-review` skill that can be re-run before major releases. Estimated effort: 30 min to extract the prompts from this session's transcript into a reusable skill.

---

## Suggested next session

**If one session is available:** Sprint Q4-A in full (~6h). The PR title: "UX critical fixes: reveal feedback, focus management, touch targets, route gating". Single highest-leverage push the codebase has had this month.

**If two sessions:** Q4-A first, then Q4-B's audit scripts (`audit-reference-ids.ts` + `confusion-matrix.ts`) so Christian can start the editorial work in parallel.

**If a week:** Q4-A → Q4-B (with Christian editorial in parallel) → Q4-C in three chunks (C1, C2, C3) → Q4-D nits + foundations as fill-in. Mark authoring continues independently throughout.

Ready to start Q4-A on your word.
