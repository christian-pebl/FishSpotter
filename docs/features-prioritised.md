# New features & fixes vs mgtaco's base — by priority

> Same scope as [`changes-vs-mgtaco.md`](changes-vs-mgtaco.md), but ordered by **expected impact on the user** rather than by file/area. Use this for stakeholder demos, "what to lean on in marketing", or "what to demo to a tester first".

> Priority labels:
> - **P0** — *Must-have.* App feels broken or unwinnable without it.
> - **P1** — *High-leverage UX.* Each one substantially improves the core experience.
> - **P2** — *Polish + intelligence.* Surfaces the underlying smarts; not blocking.
> - **P3** — *Infrastructure.* Zero direct user value, but compounds future velocity.

---

## P0 — without these the app feels broken or unwinnable

### 1. Alias matcher + "Did you mean?" + answer correction
**File:** [`src/lib/taxon-matching.ts`](../src/lib/taxon-matching.ts), [`src/app/api/answers/route.ts`](../src/app/api/answers/route.ts), [`src/lib/useCreatureQuiz.ts`](../src/lib/useCreatureQuiz.ts)
mgtaco's match was strict text-equality against `staffAnswer`. A user typing "hermit-crab" or "Hermit Crab" or "*Pagurus bernhardus*" all hit wall. Now: normalized alias lookup, fuzzy fallback ("Did you mean…?"), and a **"change" link** to re-submit if the user changes their mind.
**Why P0:** Without this, beginners give up by the second wrong guess. This is the difference between "winnable game" and "frustrating quiz."

### 2. Video transcoding for the 6 Jan-2020 clips
**Where:** `public/media/snippets/ALG_2020-*/snippet.mp4` (originals kept as `_original.mp4`)
Those 6 clips were MPEG-4 Part 2 — Chrome returns `FFmpegDemuxer: no supported streams`. They're at the **top of the feed**, so a new visitor lands on 6 unplayable videos before seeing one that works. Transcoded to H.264 baseline.
**Why P0:** First impression bug. Fatal for retention.

### 3. Taxon data model + cleanup
**Files:** `prisma/schema.prisma` (new tables), [`scripts/cleanup-taxa.mjs`](../scripts/cleanup-taxa.mjs)
58 → 51 clean taxa, with:
- *Cyanea capitata* → *capillata*, *Trisopterus iuscus* → *luscus*, *Psetta maxima* → *Scophthalmus maximus* (typos fixed)
- *Paralichthys dentatus* removed (US species, wrong continent)
- *Scyliorhinus canicula* display fixed (was confused as "Nursehound/catshark")
- 5 placeholder duplicates removed
**Why P0:** Data integrity. Without this an attentive user spots a US fish in a UK app and loses trust.

### 4. Reveal panel after every answer
**File:** [`src/components/TaxonRevealPanel.tsx`](../src/components/TaxonRevealPanel.tsx)
mgtaco's app showed only a community percentage bar. Now: hero photo/emoji, scientific name, fun fact, points earned, community %, life-list increment, "Learn more" link to taxon page. Three states (correct / wrong / contributed).
**Why P0:** Every answer is now a teaching moment. This is the *educational* layer the strategy promises; without it the app is just a quiz.

---

## P1 — high-leverage UX additions

### 5. ID Guide — "🤔 Help me figure it out"
**Files:** [`src/components/id-guide/*`](../src/components/id-guide/) (7 components), [`src/app/api/id-guide/match/route.ts`](../src/app/api/id-guide/match/route.ts)
A 3–5 question funnel with big-button answers, candidate ranking, hero photos, match-reason annotations, and three exit ramps (back / type instead / skip clip). The headline UX feature: **hermit-crab-in-4-taps**, no typing required.
**Why P1:** Closes the biggest remaining friction point — beginners who can't spell what they see. This is what makes the app accessible to non-experts.

### 6. Smart pre-fill from bbox path
**File:** [`src/lib/id-guide-prefill.ts`](../src/lib/id-guide-prefill.ts)
Computes locomotion (swimming / darting / crawling / stationary / drifting / hidden) and screen-zone (seabed / mid-water / surface) from the bbox track geometry. Q2 and Q3 of the guide get auto-highlighted with a "We've spotted: …" hint.
**Why P1:** Turns the guide from "answer 5 questions" into "confirm 2–3 things we already noticed." This is the *delight* moment for repeat users.

### 7. Life list at `/me/taxa` + taxon pages at `/taxon/[id]`
**Files:** [`src/app/me/taxa/page.tsx`](../src/app/me/taxa/page.tsx), [`src/app/taxon/[id]/page.tsx`](../src/app/taxon/[id]/page.tsx)
Pokédex-style grid with locked silhouettes for unseen taxa, three filter tabs (All / Spotted / Helped ID), per-taxon detail pages with description + fun fact + aliases + clip gallery.
**Why P1:** Consistently the highest-retention feature in nature apps (Merlin Bird ID, iNaturalist). Gives users a long-term goal across sessions.

### 8. Place context + Leaflet map per clip
**Files:** [`src/components/ClipLocationMap.tsx`](../src/components/ClipLocationMap.tsx), [`src/components/FeedCard.tsx`](../src/components/FeedCard.tsx)
Every clip shows `BIDEFORD BAY, NORTH DEVON, UK · 20M · JUL 2024` with a Leaflet map and a teal pin. Zoomable + draggable.
**Why P1:** Makes the app feel like *their* coast, not "the ocean somewhere." Critical for local-community engagement.

### 9. Two-state clip system (🟢 Verified / 🟠 Help us ID)
**Files:** schema + [`src/app/api/answers/route.ts`](../src/app/api/answers/route.ts) + reveal panel
Verified clips give 10 / 1 points (correct / wrong). Unlabelled clips give +5 contribution points to any sensible answer, with no "true species" reveal. Unblocks adding clips faster than PEBL can label them.
**Why P1:** Scales beyond PEBL's labelling capacity. Also lets the app keep growing without staff bottleneck.

---

## P2 — polish + intelligence

### 10. Biogeographic prior (OBIS integration)
**Files:** [`src/lib/obis.ts`](../src/lib/obis.ts), [`src/lib/biogeographic-prior.ts`](../src/lib/biogeographic-prior.ts), `prisma/schema.prisma`, [`scripts/refresh-biogeographic-cache.mjs`](../scripts/refresh-biogeographic-cache.mjs)
Cached OBIS occurrence counts re-rank ID-guide candidates: *Whiting* (locally common, 61k records) outranks *Twaite Shad* (rare visitor, 0 records). Surfaced to users as pills: **🟢 Common at this site** / **🩵 Occasional locally** / **🟠 Rare for this site**.
**Why P2:** Re-ranks results from real biogeographic data — credible identification rather than blind matching. But: only kicks in when the user uses the ID Guide and gets multiple plausible candidates. Lower frequency than P0/P1 features.

### 11. Tracker overlay — subtle dot + trace, with toggle
**Files:** [`src/components/FeedCard.tsx`](../src/components/FeedCard.tsx)
mgtaco had a bright white bbox rectangle, always on. Now: small semi-transparent dot (r=3, 55% opacity) with soft trace, plus a toggle switch that persists across reloads and clips. Subtle by default, dismissable for purists.
**Why P2:** Accessibility + non-distracting. The rectangle was visually loud and felt like the app was giving the answer away.

### 12. Smart answer-edit + Header navigation
**Files:** [`src/components/Header.tsx`](../src/components/Header.tsx), `useCreatureQuiz.editAnswer`
Header gets a **"My taxa"** link when signed in. After submitting an answer, a **"change"** link lets the user reconsider without losing their session/streak.
**Why P2:** Small but cumulative UX wins. Reduces dead-ends.

---

## P3 — infrastructure (agent/team value, not direct user value)

### 13. Comprehensive test suite (95 tests)
**Where:** [`tests/unit/`](../tests/unit/), [`tests/e2e/`](../tests/e2e/), [`playwright.config.ts`](../playwright.config.ts), [`vitest.config.ts`](../vitest.config.ts)
53 unit tests (~500ms) + 42 E2E tests (~2 min). Caught **two** real bugs to date: (a) the tracker toggle was Strict-Mode-unsafe (side effects inside a setState updater fired twice in dev, flipping the value back); (b) the bbox prefill heuristic bailed silently on single-frame tracks (manual-track clips) instead of suggesting screenZone from the one bbox.
**Why P3:** Zero direct user value today. Massive value for any future iteration — every refactor is now safe.

### 14. Documentation suite
**Files:** [`CLAUDE.md`](../CLAUDE.md), refreshed `README.md`, `docs/` index + 5 plan docs, `scripts/README.md`, `tests/README.md`
The strategy doc, lean Phase 1 spec, ID Guide proposal + implementation plan, manual test walkthrough, scripts runbook.
**Why P3:** Pure project/team leverage. Lets any new contributor (or future me) come up to speed in 30 minutes instead of reverse-engineering decisions.

### 15. Data pipeline scripts
**Where:** [`scripts/*.mjs`](../scripts/), [`scripts/extract-species-data.py`](../scripts/extract-species-data.py)
9 idempotent scripts that turn Drive metadata + PEBL CSVs + OBIS API into a populated DB. None of them are run during normal operation — they're the build chain.
**Why P3:** Operational hygiene. Without these the project would have lived in Christian's head.

---

## TL;DR — if you had to demo three things

1. **Watch a clip, type a name — get a reveal panel with hero + fun fact + points + community %** (P0 features 1, 4 combined)
2. **Open the ID Guide, answer 3 questions, get a candidate marked "Common at this site"** (P1 #5, #6 + P2 #10 combined — the headline)
3. **Open My Taxa, see your collection grow** (P1 #7)

Everything else compounds those three.

---

## One critique of this list

The **Biogeographic prior (P2)** is *technically* impressive but only fires when (a) the user uses the ID guide and (b) the matcher returns multiple candidates. For new users, the P0/P1 features dominate first impressions. If demo time is short, lean into the ID Guide + Life List, mention the OBIS labels as a "and look, the matches are ranked by what's actually been seen here historically."

The **test suite (P3)** is invisible to users but pays for itself the second time anyone changes a non-trivial file. Right now its dollar value is zero; in a month with more contributors it could be the most leveraged item on this list.
