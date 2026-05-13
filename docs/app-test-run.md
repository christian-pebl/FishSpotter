# PEBL FishSpotter — App Test Run

> **Purpose:** A scripted walk-through covering everything currently shipped, so you can verify each piece works end-to-end and flag anything that doesn't feel right.

> **Time budget:** ~15-20 minutes for the full run.

> **Prerequisite:** Dev server running at **http://localhost:3000**. If not, run `npm run dev` from the project root.

---

## How to use this doc

- Each section is a self-contained test with **steps**, **expected outcomes**, and a **🟢 / 🟠 / 🔴** column for you to mark each as you go.
- 🟢 = works as expected · 🟠 = works but feels off · 🔴 = broken
- Note any odd UX moments or copy issues — they're as valuable as bugs.

---

## 0. Setup

- [ ] Open **http://localhost:3000** in Chrome (or your browser of choice)
- [ ] Have a notepad open for any 🟠/🔴 observations

---

## 1. Home page (signed out)

| Step | Expected | Result |
|---|---|---|
| Land on `/` | PEBL logo top-left, headline *"PEBL FishSpotter turns marine monitoring into a shared, playable observation feed"*, three feature cards | |
| Tap **Start spotting** | Redirects to `/feed` (you'll see clips, not signed in yet) | |

> **Note for review:** the *"Compare answers"* card mentions "the PEBL reference label for each sighting" — this is now slightly misleading because Help-us-ID clips have no reference label. Flag for copy update.

---

## 2. Sign up + sign in

| Step | Expected | Result |
|---|---|---|
| From `/feed`, tap **Sign in** in header | Land on `/auth/signin` | |
| Tap **No account? Sign up** | Form switches to sign-up (Email, Display name, Password) | |
| Use a fresh email like `tester@bideford.test`, display name `Tester`, leave password blank | Account creates, signs in, redirects to `/feed` | |
| Header shows **Sign out**, **My taxa** link, streak counter (might show 1 day after first answer) | | |

---

## 3. Feed — first impressions (signed in)

| Step | Expected | Result |
|---|---|---|
| `/feed` shows a vertical scroll of 29 clips | Each card has video on the left, info panel on the right (or below on mobile) | |
| **Place context** at top of side panel: e.g. `BIDEFORD BAY, NORTH DEVON, UK · 20M · JAN 2020` | | |
| **Map** above place context: ~128px tall, OSM tiles, **teal pin** at Bideford Bay | | |
| **Zoom buttons** visible on map (top-left corner of map) | Click them to verify zoom works | |
| **Drag** the map — works | | |
| **Pinch zoom** (touch device) or **scroll-wheel zoom** — works | | |
| **Clip badge** top-right of side panel: 🟢 Verified or 🟠 Help us ID · +5 | First 6 clips (Jan 2020) should be 🟠 Help us ID; rest mostly 🟢 Verified | |
| **All 29 videos play** — no "Unable to play media" errors anywhere | | |

---

## 4. Tracker overlay + toggle

> Only visible on clips with bbox data (most clips have it).

| Step | Expected | Result |
|---|---|---|
| Active clip has a **subtle white dot** tracking the creature | Small (r=3), 55% opacity | |
| **Soft trace** behind the dot showing the recent path | Faint, 22% opacity | |
| Below the place context: a **toggle button** "👁 Show tracker [●]" | | |
| Toggle off → SVG overlay disappears, dot/trace gone | | |
| Toggle on → SVG returns; rAF loop tracks the creature again | | |
| **Reload the page** — toggle state persists (was off, stays off) | | |
| Toggle once on one card → all other cards reflect the same state (synced) | | |

---

## 5. Verified clip + correct answer

This tests the green/correct flow.

| Step | Expected | Result |
|---|---|---|
| Find a 🟢 Verified clip with hermit crab — try the third or fourth Jul 2024 clip | | |
| Type **`hermit crab`** in the input | | |
| Tap **Confirm and load next video** | Confetti, ✅ "Spot on!", **+10 pts** badge, hero card with crab emoji + "Common Hermit Crab — *Pagurus bernhardus*" | |
| Header streak counter increments | 🔥 1 day streak | |
| Below verdict: community % bar showing your answer at 100% (or as % if others have answered) | | |
| Tap **Learn more** link | Navigates to `/taxon/[id]` for the Common Hermit Crab | |
| Return to feed (back arrow or browser back) | | |

---

## 6. Verified clip + wrong answer (still teaches)

| Step | Expected | Result |
|---|---|---|
| Find another 🟢 Verified clip you haven't answered (e.g. a Whiting one) | | |
| Type something deliberately wrong: **`spider crab`** | | |
| Submit | ↩︎ "Not this time" verdict (orange), **+1 pt** badge, hero card showing the **actual** species ("Actually it was: Whiting — *Merlangius merlangus*") | |
| You said: spider crab, with a small **change** link next to it | | |
| Tap **change** | Returns to input mode with "spider crab" pre-filled | |
| Type **`whiting`** instead, submit | Now ✅ correct, **+10 pts** (replaced the +1) | |

---

## 7. Did-you-mean correction

| Step | Expected | Result |
|---|---|---|
| Find a fresh Verified clip | | |
| Type a typo like **`hermitcrab`** (no space) | | |
| Submit | A "Did you mean: **hermit crab**?" prompt appears with two options: *Yes, use that* and *Use my answer* | |
| Tap **Yes, use that** | Submits as "hermit crab", grades correctly | |

---

## 8. Help-us-ID clip (contribution)

| Step | Expected | Result |
|---|---|---|
| Scroll to the top of the feed (Jan 2020 clips, all 🟠 Help us ID) | | |
| Type any reasonable answer: **`fish`** | | |
| Submit | Orange 🟠 "Help us ID" verdict, **+5 contribution pts**, "Thank you for contributing" panel, community guesses bar | |
| **No reveal of "true" species** (because there isn't one) — only the contribution view | | |
| **change** link still present — you can update your guess | | |

---

## 9. Life list (`/me/taxa`)

| Step | Expected | Result |
|---|---|---|
| Tap **My taxa** in the header | `/me/taxa` page | |
| Header shows: 🟢 N spotted · 🟠 M helped ID · of 51 total | (after step 5/6/8: 1–2 spotted, 1 contributed) | |
| Tabs: **All / Spotted / Helped ID** | Each filters correctly | |
| Locked tiles show silhouette + **?** | | |
| Spotted tiles: hero emoji or photo, name, count, last-seen site | | |
| Tap an unlocked tile | Navigates to `/taxon/[id]` | |
| Taxon page shows: hero, name + scientific name, "Also known as: …", description, fun fact, "Clips of this species" gallery | | |

---

## 10. Place context details (`/feed/[id]` detail page)

| Step | Expected | Result |
|---|---|---|
| From feed, tap any clip's "Learn more" or scroll into a clip's detail (you can tap the article via keyboard or land directly: `/feed/[clip-id]`) | Detail page shows full-size video player + observation card (Site, Deployment, Depth, Recorded date) + Spotter Challenge | |
| If you've already answered: shows the same TaxonRevealPanel with **change** link | | |
| Detail page has the matching badge (🟢 Verified or 🟠 Help us ID) | | |

---

## 11. Edge cases worth poking at

| Test | Expected | Result |
|---|---|---|
| Submit empty input | Confirm button disabled (greyed out) | |
| Type a totally fictional name like **`zarboon`** | Either "Did you mean…" with closest match, or graceful "we don't recognise that" | |
| **Sign out** then **sign back in** with same email | Streak preserved, life list preserved, points preserved | |
| Refresh `/feed` mid-scroll | Active clip resumes; map renders for the new active clip only | |
| Toggle **Sound off** in header | Confetti still happens but no audio cues on correct/wrong/streak | |
| **Leaderboard** (`/leaderboard` or click "Community") | Your name appears with point total | |

---

## 12. The taxon cleanup we just did

After our cleanup, the following should now be true:

| Test | Expected | Result |
|---|---|---|
| Type **`pouting`** on a Verified clip | Resolves to *Trisopterus luscus* (not the old typo *iuscus*) | |
| Type **`lion's mane jellyfish`** | Resolves to *Cyanea capillata* (not the old typo *capitata*) | |
| Type **`turbot`** | Resolves to *Scophthalmus maximus* (modern name; was Psetta maxima) | |
| Type **`small-spotted catshark`** | Resolves to *Scyliorhinus canicula* (was confusingly labelled "Nursehound/catshark") | |
| Look for "Paralichthys dentatus" anywhere | Should not appear — it was a US species mistake, removed | |

---

## 13. Things deliberately not yet built (so don't worry if you can't find them)

These are coming in subsequent days but **aren't shipped yet**:

- **ID Guide** ("🤔 Help me figure it out" button below the input) — built tomorrow
- **Hero photos** for individual species — currently emoji fallbacks
- **Per-species fun facts/descriptions** beyond the 6 functional groups
- **Map zoom-to-deployment-area** affordance (it just opens centred at the clip)
- **First-spotter badges** on taxon pages
- **OBIS biogeographic prior** ("common at this site in summer" labels)

---

## 14. Reporting back

When you're done, share back:

1. **🔴 list** — anything broken, with the section number
2. **🟠 list** — things that work but feel awkward (copy, layout, timing)
3. **🟢 list** — things that genuinely delighted you (helps me know what to lean into)
4. **One thing you wish existed** that isn't on the deferred list above

---

## Quick reference — what's where

| Page | URL |
|---|---|
| Home | `/` |
| Live feed | `/feed` |
| Single clip | `/feed/[id]` |
| Archive (browse) | `/feed/browse` |
| My life list | `/me/taxa` |
| Taxon page | `/taxon/[id]` |
| Leaderboard | `/leaderboard` |
| Sign in / sign up | `/auth/signin` |

---

## After the test run

If everything's solid: **Day 2 of the ID Guide implementation** — the question funnel UI on top of the matching API we built today. The hermit-crab-in-4-taps journey starts working.

If there are blockers: list them in priority order and I'll triage.
