# ID Guide — Implementation Plan

> Companion to [id-guide-proposal.md](./id-guide-proposal.md). The proposal explains *why* and *what*. This doc explains *how* — concrete steps, file paths, schemas, component tree, scoring math, and the user journey reduced to its smallest tap-count.

> **Design north star:** *4 taps from "I have no idea" to "I learned it's a hermit crab."*

---

## 1. The user journey we're optimising for

Concrete narrative — Sarah, a beginner, sees a clip of a hermit crab.

```
[ 0s ]  Opens /feed. Sees a small creature shuffling along the seabed.
[ 3s ]  Taps the input field. Types "snail?". Deletes it. Looks down.
[ 5s ]  Notices, below the input: "🤔 Help me figure it out →".  Taps.
        ↓ Sheet slides up from the bottom.
[ 7s ]  Q1: "What kind of creature is this?"  Six big buttons. Taps "Crab".
[ 9s ]  Q2: "How does it move?"  Pre-highlighted "Crawling" (we deduced from bbox).  Confirms.
[10s ]  Q3: "Where in the frame?"  Pre-filled "On the seabed."  Confirms.
[12s ]  Q4 (crab-specific): "What shape?"  Taps "Hidden in a shell (hermit)".
        ↓ Sheet slides to results.
[13s ]  Sees one card: 🦀 Common Hermit Crab — Pagurus bernhardus.
        Below: "💡 Carries its home — will swap shells as it grows."
        Two buttons:  [ Yes, that's it ✓ ]   [ Not quite ]
[14s ]  Taps "Yes, that's it ✓".
[15s ]  Confetti. "+10 pts. Spot on!"  Reveal panel as if she'd typed it.
```

**4 taps. ~15 seconds. Zero typing. One factual learning moment.**

The exit ramps:
- "Not quite" → re-open the questions, pre-filled with her answers, she can adjust
- "Skip this clip" at any step → close the sheet, no answer recorded, no points lost
- "Type it instead" link at the top of every step → bail to the free-text input

---

## 2. Design principles (each one is a constraint)

1. **One question per screen.** Mobile-first. No scrolling within a question.
2. **All-button answers, no typing in the guide.** If you have to type, you'd just use the input directly.
3. **Pre-fill what we know.** Bbox-derived movement and screen position should be highlighted, not asked from a blank state.
4. **Progress is visible** but not nagging — small dotted indicator at top: `● ● ● ○`.
5. **Back is always one tap away** — top-left arrow.
6. **No shame.** Copy never says "wrong" — it says "almost" or "not quite". Skipping is a normal action, not a failure.
7. **Same points whether you used the guide or not.** This is critical. Punishing guide use defeats the purpose.
8. **Funnel ≤ 5 questions.** If we can't narrow it in 5, we show what we have and let the user pick.
9. **Top result must be visually obvious.** Hero photo bigger than a thumbnail. No densely-packed lists.

---

## 3. The question tree (concrete)

A static config in [`src/lib/id-guide-questions.ts`](../src/lib/id-guide-questions.ts):

```ts
export type QuestionKey = "functionalGroup" | "locomotion" | "screenZone" | "bodyShape" | "colorTag";

export interface Option {
  value: string;          // matches TaxonAttribute.value
  label: string;          // user-facing
  emoji: string;          // big icon
  hint?: string;          // optional tooltip
}

export interface Question {
  key: QuestionKey;
  prompt: string;
  options: Option[];
  // Only show this question after these prior answers
  showIf?: (prior: Partial<Answers>) => boolean;
  // Optionally rewrite options based on prior answers (Q4 changes by Q1)
  optionsFor?: (prior: Partial<Answers>) => Option[];
  optional?: boolean;     // user can skip
}
```

### Q1 — Functional group (always asked)
```ts
options: [
  { value: "fish",      emoji: "🐟", label: "Fish" },
  { value: "crab",      emoji: "🦀", label: "Crab / Lobster" },
  { value: "jellyfish", emoji: "🪼", label: "Jellyfish" },
  { value: "gastropod", emoji: "🐚", label: "Shellfish / Whelk" },
  { value: "echinoderm",emoji: "⭐", label: "Starfish / Urchin" },
  { value: "cephalopod",emoji: "🦑", label: "Squid / Octopus" },
  { value: "unsure",    emoji: "❓", label: "Not sure" },
]
```
"Not sure" is allowed — just doesn't filter on this attribute.

### Q2 — Locomotion (auto-prefilled from bbox)
```ts
options: [
  { value: "swimming",  emoji: "↗️", label: "Swimming smoothly" },
  { value: "darting",   emoji: "⚡", label: "Darting in bursts" },
  { value: "drifting",  emoji: "🌬️", label: "Drifting passively" },
  { value: "crawling",  emoji: "🐌", label: "Crawling on seabed" },
  { value: "stationary",emoji: "🛌", label: "Sitting still" },
  { value: "hidden",    emoji: "🕳️", label: "Half-buried / hidden" },
]
```

### Q3 — Screen zone (auto-prefilled from bbox y-coord)
```ts
options: [
  { value: "surface",   emoji: "🛟", label: "Near the surface" },
  { value: "midwater",  emoji: "🌊", label: "Mid-water" },
  { value: "seabed",    emoji: "🪨", label: "On the seabed" },
]
```

### Q4 — Body shape (varies by Q1)

`optionsFor((prior) => ...)` returns different options depending on `prior.functionalGroup`:

```ts
fish:      [streamlined, flat, eel-like, round/globular]
crab:      [squarish, hidden-in-shell, long-legged]
jellyfish: [bell-shape, elongated, comb-like]
// other functional groups → skip Q4
```

### Q5 — Colour (optional, last)
```ts
options: [
  { value: "silvery",     emoji: "🥈", label: "Silvery / metallic" },
  { value: "sandy",       emoji: "🟫", label: "Sandy / brown" },
  { value: "red",         emoji: "🟥", label: "Red / orange" },
  { value: "mottled",     emoji: "🟤", label: "Mottled / camouflaged" },
  { value: "dark",        emoji: "⚫", label: "Dark / black" },
  { value: "striped",     emoji: "🦓", label: "Striped" },
  { value: "translucent", emoji: "👻", label: "Translucent" },
]
optional: true
```

Total questions: **3 to 5** depending on path.

---

## 4. Scoring + ranking math

For each candidate `taxon`, compute:

```
matchScore = matchedAttributes / totalAnsweredQuestions
priorScore = biogeographic_prior(taxon, deployment, depthBucket, month)   // 0..1, default 0.5
finalScore = matchScore * 0.7 + priorScore * 0.3
```

**Hard filters** (taxa that don't match are excluded entirely, not just down-ranked):
- `functionalGroup` if user answered (and didn't pick "unsure")

**Soft filters** (down-rank but don't exclude):
- All other attributes — partial matches still rank if attributes are missing on a taxon

Return top 5 with `finalScore ≥ 0.4`. If fewer than 3 results, relax `functionalGroup` to soft.

The Phase B `priorScore` is a normalised log of the OBIS occurrence count for that taxon at this deployment/depth/month. Defaults to 0.5 when we don't have OBIS data yet (Phase A).

---

## 5. Schema additions

Single new table for attributes, optional cache table for biogeography.

```prisma
model TaxonAttribute {
  id        String  @id @default(cuid())
  taxonId   String
  key       String  // QuestionKey value: "functionalGroup" | "locomotion" | "screenZone" | "bodyShape" | "colorTag"
  value     String  // option.value: "fish" | "crawling" | "seabed" | "hidden-in-shell" | "sandy"
  source    String  @default("manual")  // "manual" | "fishbase" | "worms" | "user"
  createdAt DateTime @default(now())
  taxon     Taxon   @relation(fields: [taxonId], references: [id], onDelete: Cascade)

  @@unique([taxonId, key, value])
  @@index([key, value])
}
```

Phase A adds this and seeds it with manually-curated data. Phase B adds:

```prisma
model BiogeographicChecklist {
  id              String   @id @default(cuid())
  deployment      String   // "Algapelago"
  depthBucketMin  Int      // 15
  depthBucketMax  Int      // 25
  monthOfYear     Int      // 1..12
  // species name → occurrence count
  occurrencesJson String   @db.Text   // JSON: { "Pagurus bernhardus": 1247, ... }
  fetchedAt       DateTime @default(now())

  @@unique([deployment, depthBucketMin, depthBucketMax, monthOfYear])
}
```

---

## 6. Manual taxon tagging — one-time, ~1 hour

Write a seed script `scripts/seed-taxon-attributes.mjs` that takes a hand-curated mapping:

```js
const ATTRS = {
  "Pagurus bernhardus": {
    functionalGroup: "crab",
    bodyShape: "hidden-in-shell",
    locomotion: ["crawling"],
    screenZone: ["seabed"],
    colorTag: ["sandy", "mottled"],
  },
  "Cancer pagurus": {
    functionalGroup: "crab",
    bodyShape: "squarish",
    locomotion: ["crawling", "stationary"],
    screenZone: ["seabed"],
    colorTag: ["red", "sandy"],
  },
  "Trisopterus minutus": {
    functionalGroup: "fish",
    bodyShape: "streamlined",
    locomotion: ["swimming"],
    screenZone: ["midwater", "seabed"],
    colorTag: ["sandy"],
  },
  // ... 56 total
};
```

For each taxon name, look up its `taxonId` and create `TaxonAttribute` rows. Idempotent.

PEBL can hand me the mapping or I can pre-fill from FishBase/Wikipedia and they review. For 58 taxa this is a 1-hour curation task.

---

## 7. Component tree

```
src/components/id-guide/
├── IdGuideButton.tsx          // The "🤔 Help me figure it out" entry point
├── IdGuideSheet.tsx            // Bottom-sheet (mobile) / centered modal (desktop)
├── IdGuideStepIndicator.tsx    // ● ● ● ○  progress dots
├── IdGuideQuestion.tsx         // One question, big-button options
├── IdGuideResults.tsx          // Ranked candidate cards
├── IdGuideCandidateCard.tsx    // Single taxon card with photo + fact + confirm/reject
└── useIdGuide.ts               // State machine: questions, answers, progression
```

### State machine (`useIdGuide`)

```ts
type GuideState =
  | { stage: "questions"; index: number; answers: Partial<Answers> }
  | { stage: "results"; answers: Answers; candidates: TaxonCandidate[] }
  | { stage: "noMatch"; answers: Answers };

actions:
  - answer(key, value)      // record answer, advance to next question
  - skip()                  // skip current question (if optional)
  - back()                  // go to previous question
  - submit()                // hit /api/id-guide/match, transition to "results"
  - selectCandidate(taxonId)  // user confirms a candidate — closes sheet, fills input
  - reject()                // back to questions, pre-filled
  - bail()                  // close sheet entirely
```

### Smart pre-fill — `useIdGuidePrefill(snippet)` hook

Given the snippet's bbox path, returns:

```ts
{
  locomotion: "crawling" | "darting" | "swimming" | "stationary" | undefined,
  screenZone: "seabed" | "midwater" | "surface" | undefined,
  functionalGroup: "fish" | "crab" | ...  // from snippet.staffTaxon.parent or AI tag
}
```

Pre-fill heuristics (Phase D, but small enough to do on day 1):

```
mean_y = mean of bbox.y_norm + bbox.h_norm/2 across track
  > 0.65 → screenZone = "seabed"
  < 0.35 → screenZone = "surface"
  else   → screenZone = "midwater"

path_length = sum of euclidean(prev_centre, curr_centre) for centres in track
spread = stddev of x_norm centres
  path_length / num_frames > threshold      → locomotion = "swimming" or "darting"
  path_length / num_frames < small_threshold → locomotion = "stationary" or "crawling"
  spread < 0.1 (stays in one spot)          → "stationary" / "drifting"
```

These are *suggestions* — the user sees the suggested option pre-selected with a "Sounds right? Tap to confirm or change" affordance.

---

## 8. API surface

### `POST /api/id-guide/match`

Request:
```ts
{
  snippetId: string,
  answers: {
    functionalGroup?: string,
    locomotion?: string,
    screenZone?: string,
    bodyShape?: string,
    colorTag?: string,
  }
}
```

Response:
```ts
{
  candidates: Array<{
    taxon: TaxonSummary,        // existing TaxonSummary type from useCreatureQuiz
    matchScore: number,         // 0..1
    priorScore: number,         // 0..1, defaults 0.5 in Phase A
    finalScore: number,         // 0..1
    matchReasons: string[],     // e.g. ["Crab", "Crawling on seabed", "Hidden in shell"]
  }>,
  totalCandidates: number,      // for "we found N possible matches" copy
}
```

Server-side logic (single SQL query is enough for Phase A):

```sql
SELECT t.*,
       SUM(CASE WHEN ta.key = 'functionalGroup' AND ta.value = $1 THEN 1 ELSE 0 END) AS m_fg,
       SUM(CASE WHEN ta.key = 'locomotion' AND ta.value = $2 THEN 1 ELSE 0 END) AS m_loc,
       ...
FROM "Taxon" t
LEFT JOIN "TaxonAttribute" ta ON ta."taxonId" = t.id
WHERE t."isFunctionalGroup" = false
  AND ($1 IS NULL OR EXISTS (
        SELECT 1 FROM "TaxonAttribute"
        WHERE "taxonId" = t.id AND key = 'functionalGroup' AND value = $1
      ))
GROUP BY t.id
ORDER BY (m_fg + m_loc + m_zone + m_shape + m_color) DESC
LIMIT 8
```

Then in JS, compute `matchScore` from the counts, fold in `priorScore` (0.5 in Phase A), sort, return top 5.

---

## 9. Wire into `FeedCard`

The entry point lives below the input field and is only shown when `myAnswer` is null (user hasn't submitted). Reading the existing layout:

```tsx
<input ... />            // existing answer input
{!correction && !myAnswer && (
  <IdGuideButton onClick={() => setGuideOpen(true)} />
)}
<IdGuideSheet
  open={guideOpen}
  onClose={() => setGuideOpen(false)}
  snippet={snippet}
  prefill={useIdGuidePrefill(snippet)}
  onConfirm={(taxonName) => {
    setAnswerText(taxonName);
    setGuideOpen(false);
    void handleSubmit({ answerText: taxonName, skipCorrection: true });
  }}
/>
```

The sheet calls `handleSubmit` with `skipCorrection: true` because the alias is already an exact match (we picked it from a known taxon). Submission goes through the existing API and triggers all the existing reveal-panel behaviour — confetti, points, life list increment.

**Critical:** the user gets the same points whether they typed or used the guide. No penalty.

---

## 10. The visual sketch (ASCII, for reference)

### Sheet open, Q1
```
┌─────────────────────────────────────┐
│ ←   ● ○ ○ ○         Type instead    │
│                                     │
│   What kind of creature is this?    │
│                                     │
│   ┌────────┐ ┌────────┐ ┌────────┐  │
│   │   🐟   │ │   🦀   │ │   🪼   │  │
│   │  Fish  │ │  Crab  │ │ Jelly  │  │
│   └────────┘ └────────┘ └────────┘  │
│   ┌────────┐ ┌────────┐ ┌────────┐  │
│   │   🐚   │ │   ⭐   │ │   🦑   │  │
│   │ Whelk  │ │ Star   │ │ Squid  │  │
│   └────────┘ └────────┘ └────────┘  │
│                                     │
│            [ Skip this clip ]       │
└─────────────────────────────────────┘
```

### Q2 (pre-filled "Crawling" highlighted)
```
┌─────────────────────────────────────┐
│ ←   ● ● ○ ○         Type instead    │
│                                     │
│   How does it move?                 │
│   We've spotted: crawling 👇        │
│                                     │
│   ┌────────┐ ┌────────┐ ┌────────┐  │
│   │   ↗️   │ │   ⚡   │ │   🌬️   │  │
│   │ Swim   │ │ Dart   │ │ Drift  │  │
│   └────────┘ └────────┘ └────────┘  │
│   ┌════════┐ ┌────────┐ ┌────────┐  │
│   ║   🐌   ║ │   🛌   │ │   🕳️   │  │
│   ║ Crawl  ║ │ Still  │ │ Hidden │  │
│   ╚════════╝ └────────┘ └────────┘  │
│                                     │
│            [ Skip this clip ]       │
└─────────────────────────────────────┘
```

(Pre-fill highlighted with a teal ring + small "We've spotted:" hint)

### Results
```
┌─────────────────────────────────────┐
│ ←        Found 1 likely match        │
│                                     │
│   ┌─────────────────────────────┐   │
│   │  ┌──────┐                   │   │
│   │  │  🦀  │  COMMON HERMIT    │   │
│   │  │      │  CRAB             │   │
│   │  └──────┘  Pagurus bernhar… │   │
│   │                             │   │
│   │  💡 Carries its home —      │   │
│   │     swaps shells as it      │   │
│   │     grows.                  │   │
│   │                             │   │
│   │  Match: crab · crawling ·   │   │
│   │  hidden-in-shell · sandy    │   │
│   │                             │   │
│   │  [ Yes, that's it! ✓ ]      │   │
│   │  [ Not quite, go back ]     │   │
│   └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## 11. Implementation order — 3-day Phase A breakdown

### Day 1 — data layer + scoring
- [ ] Schema: `TaxonAttribute` table, migrate
- [ ] Seed script: `scripts/seed-taxon-attributes.mjs` with hand-curated mapping for 58 taxa
- [ ] API: `POST /api/id-guide/match` with the SQL above + scoring math
- [ ] Smoke test via curl/node: submit `{functionalGroup: "crab", locomotion: "crawling"}` → expect Pagurus bernhardus + Cancer pagurus

### Day 2 — UI shell + question flow
- [ ] `IdGuideButton` — entry point, reuses pebl-button styles
- [ ] `IdGuideSheet` — bottom-sheet on mobile, centered modal on desktop, Framer Motion slide
- [ ] `IdGuideQuestion` — big-button grid component
- [ ] `IdGuideStepIndicator` — dots
- [ ] `useIdGuide` state machine
- [ ] Question config in `src/lib/id-guide-questions.ts`
- [ ] Wire button + sheet into `FeedCard`

### Day 3 — results + smart prefill + polish
- [ ] `IdGuideResults` + `IdGuideCandidateCard`
- [ ] `useIdGuidePrefill` hook: bbox → screenZone, locomotion suggestions
- [ ] Pre-select suggested options in Q2/Q3 with visual hint
- [ ] On confirm: fill `answerText`, submit via existing flow
- [ ] Edge cases: no candidates (Phase A may have empty results until taxa are tagged) → fallback message + "Type it instead" link
- [ ] Manual user-test the journey end-to-end on `/feed`

**Demo checkpoint at end of Day 3:** Sarah can ID a hermit crab in 4 taps starting from the feed.

---

## 12. Phase B — biogeographic prior (optional, 2 days after Phase A ships)

### Day 4 — OBIS fetch worker
- [ ] Schema: `BiogeographicChecklist` table
- [ ] Script: `scripts/refresh-biogeographic-cache.mjs` — for each (deployment, depthBucket, monthOfYear), hit OBIS `/checklist`, store result
- [ ] Run weekly via cron / GitHub Action / manual

### Day 5 — wire prior into matcher
- [ ] Modify `/api/id-guide/match` to look up `BiogeographicChecklist` for the snippet's deployment/depth/month
- [ ] Compute `priorScore` per taxon
- [ ] Fold into `finalScore`
- [ ] Add "Common at this site in summer" / "Rare visitor" labels on candidate cards based on prior

---

## 13. Testing strategy

### Unit
- Question state machine: advancing, skipping, going back
- Scoring math: edge cases (no answers, all unsure, taxon with missing attributes)

### Integration
- API: known answers → known candidates (fixture-based)
- Pre-fill heuristics: bbox samples → expected zone/locomotion

### End-to-end (manual scripted on `/feed`)
- **Easy path**: hermit crab → 4 taps → Pagurus bernhardus
- **Wrong path correction**: pick "fish" by mistake → back → "crab" → still arrives at hermit crab
- **Skip path**: skip Q5 (colour) → still narrows enough
- **No match path**: pick conflicting answers → graceful "Type it instead" fallback
- **Bail path**: close sheet at any step → no answer recorded, no points lost

---

## 14. Metrics to watch after launch

If we wire any analytics in:

| Metric | Why it matters |
|---|---|
| % of answers that came via the guide | Adoption signal |
| Average time-to-first-correct-answer (guide vs typed) | Should *decrease* with guide |
| Drop-off at each question | Reveals which question is unclear |
| Correct rate (guide-confirmed answers) | Should be high (~90%+) since guide pre-filters |
| % of guide sessions that bail | Friction signal — if >40% something's wrong |

These aren't critical for v1 but worth instrumenting once user volume is real.

---

## 15. What's deliberately not in this plan

- **WoRMS vernacular import** — separate Phase C, not blocking the guide
- **FishBase enrichment** — Phase C, complements but doesn't replace manual tagging
- **AI suggestion** — explicit out-of-scope (Phase E in proposal). The guide is meant to be *teachable*, not magical.
- **Multi-creature clips** — one ID per clip remains the contract
- **Audio cues** — no audio in our clips
- **Localisation** — English-only for v1, same scope decision as main strategy doc

---

## 16. Open questions for PEBL

1. **Manual taxon attribute curation** — happy to spend ~1 hour reviewing my pre-fill from FishBase/Wikipedia? Or hand me the mapping yourselves?
2. **"Skip this clip" with no penalty** — agree this is the right default for the guide? Or should we still award some "effort" points?
3. **Pre-fill confidence** — should the suggested locomotion be auto-selected (user just confirms) or merely highlighted (user must still tap)? Recommendation: auto-select, with a clear visual "we suggested this — change if wrong."
4. **Visual style** — should the guide use the same dark teal palette as the side panel, or feel like a distinct surface (e.g. white card with PEBL branding)? Recommendation: dark teal — feels like an extension of the spotting context, not a different app.

---

## 17. Why this specific shape of plan

Three things drove the design:

1. **The sub-15-second journey.** Anything longer and it loses to typing-and-guessing.
2. **Same points whether typed or guided.** Otherwise the guide becomes a "lazy person" branch that good users avoid, and we lose the educational value entirely.
3. **Smart pre-fill from bbox.** This is the difference between "answer 5 questions about something I just saw" and "the app already knows half the answers and just asks me to confirm." The latter is delightful; the former is homework.

If we ship Phase A as described, we close the biggest unhandled friction point in the lean Phase 1 (free-text-only ID for beginners) without any of the heavy machinery from the deferred list. Phase B adds the magic of "Common at this site in summer" on top once the foundation works.
