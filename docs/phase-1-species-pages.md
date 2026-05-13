# Phase 1 (Lean) — Taxon Pages, Life List, Help-Us-ID

> **Goal:** Turn every answer into a learning moment + reward users for grading unlabelled clips. Hit all four engagement-strategy goals (engaging, educational, local connection, scales beyond PEBL labelling) with the minimum surface area. Ship in ~5 working days, then learn from real users before adding more.

> **Principle:** every cut feature is *additive later* — no schema rewrites needed to bring back what we deferred. Build small, ship, learn, layer.

---

## What we're shipping

Six things, no more:

1. A **flat `Taxon` table** — one row per species or functional group, no hierarchy yet
2. An **alias matcher** — accepts scientific, common, and vernacular names
3. **Two clip states**: 🟢 Verified (PEBL-labelled) / 🟠 Help us ID (unlabelled)
4. A **reveal panel** with hero photo + 1-line fun fact + life-list increment + place context
5. **Life list** at `/me/taxa` — Pokédex grid of taxa seen / contributed
6. **Simple scoring**: 10 / 1 / 5

That's it. Everything else from the original Phase 1 doc is parked in §10 below.

---

## 1. Data model

### `Taxon` (new — flat, no hierarchy)

```prisma
model Taxon {
  id              String   @id @default(cuid())
  name            String                       // canonical display: "Common Hermit Crab" or "Crab"
  scientificName  String?  @unique             // "Pagurus bernhardus" — null for functional groups
  isFunctionalGroup Boolean @default(false)    // true for "Crab", "Fish", "Jellyfish" etc.
  description     String?  @db.Text            // 2-3 sentences
  funFact         String?                      // 1 line — most important field
  heroImageUrl    String?                      // Wikipedia Commons or PEBL stock
  habitatNote     String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  snippets        Snippet[]
  aliases         TaxonAlias[]
  answers         Answer[]
}
```

### `TaxonAlias` (new)

```prisma
model TaxonAlias {
  id        String  @id @default(cuid())
  taxonId   String
  alias     String  @unique                   // normalized: lowercased, no diacritics, no leading articles
  display   String                              // original form for showing back to user
  source    String                              // "scientific" | "common" | "vernacular"
  taxon     Taxon   @relation(fields: [taxonId], references: [id], onDelete: Cascade)

  @@index([taxonId])
}
```

### `Snippet` (extend)

```prisma
model Snippet {
  // ... existing
  staffTaxonId  String?
  staffTaxon    Taxon?       @relation(fields: [staffTaxonId], references: [id])
  labelStatus   LabelStatus  @default(UNLABELLED)
}

enum LabelStatus {
  UNLABELLED
  STAFF_LABELLED
}
```

(No `COMMUNITY_GRADED` state for now. Help-us-ID clips show contribution view forever; PEBL grades them later via direct DB updates if/when needed.)

### `Answer` (extend)

```prisma
model Answer {
  // ... existing
  taxonId        String?
  taxon          Taxon?    @relation(fields: [taxonId], references: [id])
  pointsAwarded  Int
}
```

`User` and `staffAnswer` (string) stay as-is for now. Leaderboard continues to compute from Answer rows.

---

## 2. The matcher

In [`useCreatureQuiz.ts`](../src/lib/useCreatureQuiz.ts) and [`/api/answers/route.ts`](../src/app/api/answers/route.ts):

```
1. normalize(input) → lowercase, strip diacritics, collapse whitespace, strip leading articles
2. Exact lookup in TaxonAlias → if hit, get taxonId
   - If clip.labelStatus = STAFF_LABELLED:
       - taxonId === clip.staffTaxonId  → CORRECT
       - else                           → WRONG (still show reveal panel — teach!)
   - If clip.labelStatus = UNLABELLED:
       - record taxonId on Answer, contribution mode
3. No exact match → fuzzy across all aliases (Levenshtein/token overlap, threshold 0.7)
   - Top 1-3 candidates → "Did you mean ___?" suggestions
4. Below threshold → "We don't recognise that. Try again?"
```

No hierarchy logic. No partial credit. If the answer is hermit crab and the user types "crab", they're wrong (but the reveal still teaches them what it actually was). We can add partial credit later if it turns out beginners are bouncing off the binary feedback.

---

## 3. Scoring

| Action | Points |
|---|---|
| Correct on 🟢 Verified | **10** |
| Wrong on 🟢 Verified | **1** |
| Any answer on 🟠 Help us ID | **5** |

Three numbers. No retroactive bonuses, no first-spotter, no weighted accuracy. The leaderboard sums `Answer.pointsAwarded`.

---

## 4. UI surfaces

### 4a. Clip badge

Each clip shows a small badge:
- 🟢 **Verified**
- 🟠 **Help us ID · +5**

### 4b. Post-answer reveal panel

Three states. Replaces the bare percentage display in [`FeedCard.tsx`](../src/components/FeedCard.tsx).

**State 1 — Verified + correct:**
```
[hero photo]
✅ Spot on! That was a
COMMON HERMIT CRAB
Pagurus bernhardus

💡 Carries its home — will swap
   shells as it grows

⭐ New to your list (4 / 56)
+10 points

──── Community answers ────
hermit crab    ████████  72%
crab           ██        15%

[View species]  [Next]
```

**State 2 — Verified + wrong:**
```
[hero photo of correct taxon]
⨯ Not this time — that was a
COMMON HERMIT CRAB
Pagurus bernhardus

💡 Carries its home — will swap
   shells as it grows

You said: spider crab
+1 point

[View species]  [Next]
```

(Wrong-answer-still-teaches is critical. The reveal is identical structure to a correct answer; only the verdict bar differs.)

**State 3 — Help us ID:**
```
🟠 HELP US IDENTIFY
You said: hermit crab

⏳ This clip doesn't have a
   verified ID yet — you're
   helping label it. Thank you!

──── Community guesses ────
hermit crab  ████████  3 of 4
spider crab  ██        1 of 4

+5 contribution points ✨

[Next]
```

### 4c. Place context (free win)

On every clip card, surface the data already in the schema: site name + depth + month/year. E.g. `Bideford Bay · 20m · July 2024`. Makes it feel local. No new data needed.

### 4d. Life list — `/me/taxa`

Pokédex-style grid:

```
YOUR TAXA              4 / 56 spotted · 7 contributions

┌───────┬───────┬───────┬───────┬───────┐
│ 🦀    │ 🐟    │  ?    │  ?    │ 🐟    │
│Hermit │Whiting│       │       │Pollack│
│×3     │×1     │       │       │×2     │
└───────┴───────┴───────┴───────┴───────┘
```

- Locked tiles: silhouette + "?" (drives curiosity)
- Unlocked: hero photo, name, count, last-seen site
- Tap → taxon page

### 4e. Taxon page — `/taxon/[id]`

Minimal v1:
- Hero photo
- Name (common + scientific)
- Description (2-3 sentences)
- Fun fact callout
- Habitat note
- Clip gallery (all snippets where this is `staffTaxon`)

No mini-map (Phase 2). No top-spotters list (defer).

---

## 5. Implementation order — 6 steps

Each is a separate commit; smoke-tested before moving on.

1. **Schema migration** — add `Taxon`, `TaxonAlias`, `Snippet.staffTaxonId`, `Snippet.labelStatus` enum, `Answer.taxonId` + `Answer.pointsAwarded`. `prisma migrate dev`.
2. **Seed taxa** (`scripts/seed-taxa.mjs`) — populate `Taxon` from [`data/species-master.json`](../data/species-master.json) (56 entries). Build aliases from common-name + scientific-name.
3. **Link clips to taxa** (`scripts/link-clips-to-taxa.mjs`) — for the 20 confidently-matched clips in [`data/clip-matches.json`](../data/clip-matches.json), set `staffTaxonId` + `labelStatus = STAFF_LABELLED`. The other 10 stay `UNLABELLED`.
4. **Matcher refactor** — port answer logic to alias-based with fuzzy fallback. Handle both label states. Award points server-side.
5. **Reveal panel + clip badge + place context** — new `<TaxonRevealPanel>` component covering the three states. Clip cards show 🟢/🟠 badge and `Site · depth · date`.
6. **Life list page + taxon page** — `GET /api/me/taxa`, `GET /api/taxon/[id]`, plus `/me/taxa` and `/taxon/[id]` pages.

---

## 6. What we need from PEBL

Mostly automated already. Small remaining asks:

1. **Verification of the 20 candidate matches** — quick eyeball check of [`data/clip-matches.json`](../data/clip-matches.json). Anyone who knows the footage; ~30 mins. Manual JSON edit, no UI needed.
2. **Manual labels for the 10 unmatched clips** — same ~30-min pass.
3. **For each of the 56 taxa, three fields** to make taxon pages feel complete (we can pre-fill the rest from FishBase/WoRMS):
   - 1-line fun fact
   - 2–3 sentence description
   - Hero photo URL (Wikipedia Commons fine)
4. **N. Devon vernacular if any** — what local fishermen actually call species (e.g. "scooter" for sand goby?). One per species starts the dictionary.
5. **Site-code names** — friendly names for `ALG_SC_11` and `ALG_SC_14` if PEBL uses any internally.

If (3) is a lot of work for PEBL, we can ship Phase 1 with placeholder fun facts and a script that fetches Wikipedia summaries automatically — then PEBL refines later.

---

## 7. Success criteria

We'll know lean Phase 1 is working when:

- A new user can sign up, answer one verified clip, and see hero photo + fun fact + "1/56 spotted" + points awarded
- The same user can answer a Help-us-ID clip without it feeling like failure — clear contribution framing + +5 points
- `/me/taxa` is satisfying enough to spend 30+ seconds browsing
- The matcher accepts at least 2 forms per taxon (scientific + common)
- A taxon page is shareable as a link and looks complete

---

## 8. Open questions

- **Verification workflow** — JSON edit is fine for 30 clips, but if PEBL plans to add hundreds, we'll want a UI later. Defer until volume forces it.
- **Help-us-ID quota** — should the feed mix Verified and Help-us-ID, or have a dedicated tab? Recommendation: mix them, with a small "Pioneer" filter to surface only unlabelled.

---

## 9. Deliberately out of scope (for later)

| Deferred feature | Comes back when… | Estimated phase |
|---|---|---|
| Hierarchical taxonomy + partial credit | One clip has multiple ranks of valid answers (e.g. "Crab" vs "Hermit crab" vs *Pagurus*) | 1.5 / 2 |
| `COMMUNITY_GRADED` state + consensus algorithm | Help-us-ID clips accumulate 5+ user votes — needs real user volume | 2 |
| Weighted-accuracy voting | Users with high accuracy on Verified become trusted graders | 3 (with Local Expert) |
| First-spotter mechanic (permanent credit on taxon page) | Phase 2 surfaces taxon pages with social context | 2 |
| Retroactive bonus for "you helped grade" | Together with `COMMUNITY_GRADED` | 2 |
| Admin labelling UI (`/admin/label`) | PEBL labels routinely (>50 clips/month) | When volume forces it |
| Header counter (streak + species + helped) | Phase 1 ships without; can add anytime | 1.5 |
| Backfill of existing answers to taxa | If we accumulate test data worth preserving | One-shot script when needed |
| Multi-species clips | When tracking pipeline supports it | 3+ |
| User-submitted vernacular contributions | Once user base exists | 3 |
| Functional-group answers earning full points on unlabelled clips | Maybe never — depends on whether it confuses the data | TBD |

None of these require schema rewrites. `Taxon` can grow `parentId`. `Snippet` can grow `communityTaxonId`. `Answer` can grow `pointsBonus`. They're all additive.

---

## 10. After lean Phase 1 ships

Two-week feedback window with a handful of testers (PEBL staff + local users). We're listening for:

- **Engagement signal**: do people come back? streak length? life-list completion? clips answered per session?
- **Education signal**: do people read the fun facts? click through to taxon pages?
- **Frustration signal**: where do they bounce? Free-text typing? Wrong-answer feedback? "I can't find my answer in the list"?
- **Contribution signal**: do users actually answer Help-us-ID clips, or skip them?

Whatever the data says, that's the input to "what to layer next" from the deferred list.
