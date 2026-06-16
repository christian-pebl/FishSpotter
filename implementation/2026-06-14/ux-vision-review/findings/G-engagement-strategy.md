# Vision UX Review — Engagement & Retention Strategy (holistic journey)

**Reviewer area:** Engagement & retention strategy — the whole arc as a behavioural funnel (acquisition → activation → reward → retention).
**Finding prefix:** `G`

---

## Summary verdict

The core loop is genuinely well-built and the funnel has the right *parts* — a playable-without-signup landing, a one-tap activation prompt, a reveal that fires immediately in place, a community split, a leaderboard, and a 57-species pokédex. The reward moment (`feed-05-reveal`) is the strongest screen in the journey: it pays out points instantly, shows the PEBL reference ID, shows what the community guessed, and only *then* asks for sign-up. That sequencing is correct and should be protected.

But the funnel leaks badly at two specific joints, and the whole arc is **missing its reason for being**. First, the funnel leaks at **activation→retention** because every retention surface a newcomer first sees is empty and discouraging by construction: the pokédex opens on "0 of 57" with an all-grey locked wall, the profile reads "SCORE 0 / 0% ACCURACY", and the leaderboard advertises a 10-ID gate with a single real spotter on the board ("Anjali · 11"). A first-time visitor is shown their own failure and a near-empty community before they have done anything. Second — and this is the highest-leverage gap of all — **nowhere in the entire journey does the app tell the user they are contributing to real marine science.** The landing sells "Spot the species in real underwater footage", the reveal calls the answer a "PEBL ID", and the pokédex frames everything as a personal collection. A member of the public completes the whole loop and comes away thinking they played a fish-identification trivia game, not that they helped monitor a real reef. For a PEBL CIC citizen-science product whose explicit goal is to turn casual visitors into returning contributors to a marine-monitoring dataset, that is the single biggest missed lever, and it is missing everywhere. The arc rewards the *individual* well but never rewards *contribution* or makes *impact* visible, which is exactly what brings citizen-science participants back.

## What's genuinely good (keep)

- **Play-before-signup is implemented and the reveal proves it.** `feed-05-reveal` shows a full scored reveal (points, PEBL ID, community split) to a signed-out user, *then* a soft "Save my finds — sign up free" ask. This is the correct activation strategy — do not regress it behind a wall.
- **The reward fires in place and immediately.** The verdict ("Close · +1"), the reference ID, and the community breakdown all land on the same card the moment the user commits. No navigation to find your score.
- **Honest, generous scoring is on display.** "Close · +1" for a coarse-but-reasonable guess (Pollack vs the PEBL "Fish" reference) tells a newcomer the game is forgiving, which lowers the barrier — good for first contribution.
- **Landing removes the obvious blockers.** "Free, no card required" plus a primary "Start spotting" that doesn't demand an account is exactly right for top-of-funnel.
- **The pokédex concept and the leaderboard exist at all.** The retention scaffolding (collection, streak, leaderboard, "most-named species") is the right set of mechanics; the problems below are about framing and first-run state, not whether to have them.
- **The onboarding card sets an honest expectation** — "Pick the species in 5 seconds … No typing required" (`authed-01`) accurately describes the low-effort loop and pre-empts the fear that you need to be an expert.

---

### G-01 — The journey never tells the public they're contributing to real science (no impact, anywhere)
- **Screens:** m-landing.png, feed-01-idle.png, feed-05-reveal.png, authed-03-reveal-authed.png, m-profile-pokedex.png, m-leaderboard.png
- **Severity:** P0
- **Lens:** Engagement & motivation
- **Observation:** Across the entire funnel there is not one line that says the user is helping monitor a real reef or contributing to a real dataset. The landing headline is "Spot the species in real underwater footage." The reveal labels the answer "PEBL ID" and the CTA is "Save my finds". The pokédex frames it as "your collection". The leaderboard explains only the points maths ("Score = 2 points per correct ID…"). "Real underwater footage" is the closest the app gets, and it reads as *content provenance*, not *your contribution matters*. A member of the public finishes the loop believing they played a fish-ID trivia game.
- **Why it matters:** This is the defining lever of citizen-science retention and the entire reason a PEBL CIC product exists. People come back to projects like Zooniverse, eBird and iNaturalist because they can see their effort feeds something real — a dataset, a map, a research output. FishSpotter currently captures none of that motivational energy. It is the highest-leverage change in the whole review: the same loop, reframed as "you just helped identify what lives at Bideford Bay", converts a one-off player into a returning contributor. Without it, every other engagement mechanic is fighting gravity.
- **Recommendation:** Thread a contribution narrative through the four key beats. (1) Landing: add one line under the hero, e.g. "Every ID you make helps PEBL monitor what's living on real UK reefs." (2) Reveal: after a correct/close ID, add a micro line "Your ID was added to the Bideford Bay record" (tie to the snippet's site, which is already shown). (3) Profile: replace or augment "IDENTIFICATIONS / SCORE" with a contribution framing, e.g. "12 IDs added to the marine record" and a count of distinct sites/clips you've helped. (4) A lightweight aggregate "the community has identified N species across M clips this month" somewhere visible (leaderboard header is a natural home). Copy only at first; an actual impact view is a later phase.
- **Effort:** M

---

### G-02 — Every first-run retention surface shows the newcomer their own failure (zeros + locked wall)
- **Screens:** m-profile-pokedex.png, m-leaderboard.png
- **Severity:** P0
- **Lens:** Engagement & motivation
- **Observation:** The retention layer greets a new user with discouragement by construction. The profile reads "IDENTIFICATIONS 1 / SCORE 0 / ACCURACY 0% / STREAK 1". The collection header is "0 of 57 species" above a full screen of grey "Locked" tiles (counted ~60+ locked cells, every shape group at "0 / N"). The leaderboard states "Minimum 10 answers to enter the ranking" and shows a single ranked spotter ("#1 Anjali · 11"). So the very first thing a curious newcomer sees on their own profile is a 0% accuracy score and an all-grey wall, and on the community page, a locked door and a near-empty board.
- **Why it matters:** This is the activation→retention leak. The moment of peak motivation (just signed up / just played) is met with "you have nothing and you're 0% accurate." 0% accuracy in particular is actively de-motivating and arguably wrong to surface at n=1 (one pending/close answer reads as total failure). The locked grid communicates distance-to-go, not progress-made — the opposite of what drives return visits. Citizen-science onboarding best practice is to make the first contribution feel like immediate progress, not to display an empty trophy cabinet.
- **Recommendation:** (1) Suppress accuracy until a meaningful sample (e.g. hide or show "—" below ~5 scored answers; never show 0%). (2) Reframe the collection header from deficit to momentum: "1 species discovered — 56 to find" with a filled progress bar, and show the *unlocked* species first/large rather than leading with the locked wall. (3) Soften the leaderboard gate for newcomers: show "You're 9 IDs from the leaderboard" as a progress nudge rather than a bare "Minimum 10 answers" rule, and consider a "this week's risers" or "newest spotters" strip so the community looks alive at n=6. (4) Seed a first guaranteed unlock in onboarding so no one ever lands on a literal 0.
- **Effort:** M

---

### G-03 — "Reason to come back tomorrow" is never made explicit; the streak isn't given stakes
- **Screens:** feed-05-reveal.png, authed-03-reveal-authed.png, m-profile-pokedex.png
- **Severity:** P1
- **Lens:** Engagement & motivation
- **Observation:** The app has a streak (profile shows "STREAK 1") but the journey never creates a concrete reason or appointment to return. The reveal's sign-up pitch is "build a streak, and join the leaderboard" — a generic mention, not a hook. There is no "come back tomorrow", no daily goal, no "X clips left today", no indication a streak is at risk or that new clips appear. The signed-in reveal (`authed-03`) shows only "IDENTIFY / WHERE IS THIS? / SKIP" with no forward retention pull at all. The only re-engagement mechanism visible anywhere is the passive "weekly digest" email referenced in the verify-inbox banner.
- **Why it matters:** Retention requires a trigger and a reason. A streak only motivates if the user knows it exists, knows it's at 1 (fragile), and feels something is lost by not returning. Right now "STREAK 1" is a static number on a profile most users won't revisit. Without a daily loop or loss-aversion hook, the funnel has no engine pulling day-2 returns — the leak is at the retention stage itself.
- **Recommendation:** Introduce a light daily structure. (1) A daily goal ("3 IDs today" with a ring that fills) surfaced on the feed and completed-state. (2) Make the streak legible and stakeful at the reward moment: after an ID, "Day 1 streak — come back tomorrow to keep it going." (3) On return, a small "your streak is safe / your streak is at risk" cue. (4) Long-term, an opt-in daily reminder (push/email) tied to the streak. Start with the on-screen daily goal + streak callout (cheap) before notifications.
- **Effort:** M

---

### G-04 — Landing broadcasts "6 spotters" as social proof, which undercuts credibility
- **Screens:** m-landing.png
- **Severity:** P1
- **Lens:** Trust & polish
- **Observation:** The landing stats band prominently shows three equal-weight numbers: "30 underwater clips / 57 identifiable species / **6 spotters**". The leaderboard corroborates the tiny community — one ranked spotter. Presenting "6 spotters" as a headline metric tells every visitor the community is essentially empty.
- **Why it matters:** Social proof is supposed to lower the barrier ("others are doing this, it's worth my time"). A visible "6" does the reverse — it signals an abandoned/pre-launch product and gives a hesitant visitor a reason to bounce. On the acquisition screen, the first impression, this actively works against conversion. The clips/species counts are fine; the people count is the liability at current scale.
- **Recommendation:** Until the spotter count is genuinely impressive, replace "6 spotters" with a metric that grows fast and reads positively — e.g. "N species identified" (cumulative community IDs), "N clips from UK reefs", or a site/location count ("footage from N UK sites"). Reintroduce a live spotter/contributor count once it's in the hundreds. Same band, swap the third stat for something that signals momentum rather than emptiness.
- **Effort:** S

---

### G-05 — Two competing top-of-funnel CTAs split intent; the "play first" path isn't the clear default
- **Screens:** m-landing.png
- **Severity:** P1
- **Lens:** Friction & cognitive load
- **Observation:** The hero offers two stacked buttons of near-equal visual weight: a filled teal "Start spotting" and an outlined "Create your spotter profile", with "Free, no card required" beneath. The app's own (correct) strategy is play-before-signup, yet the landing presents "create a profile" as a co-equal first action — asking for commitment before the user has felt any value.
- **Why it matters:** The whole point of the playable-guest flow (proven out in `feed-05-reveal`) is to let value precede commitment. Putting a sign-up CTA at the same altitude as "Start spotting" on the very first screen reintroduces the friction the guest flow was built to remove, and forces a decision the user isn't ready to make. A meaningful share of visitors will hesitate at the fork instead of just trying it.
- **Recommendation:** Make "Start spotting" the unambiguous primary path and demote profile creation. Either remove the second button entirely (sign-up is already offered post-reveal where it converts best) or shrink it to a quiet text link ("or create a profile"). Keep "Free, no card required" tied to the single primary action. One obvious door reduces bounce at the funnel mouth.
- **Effort:** S

---

### G-06 — The reward moment doesn't celebrate or visualise progress toward the collection
- **Screens:** feed-05-reveal.png, authed-03-reveal-authed.png
- **Severity:** P1
- **Lens:** Engagement & motivation
- **Observation:** The reveal pays out points and shows the answer, but it never connects the win to the user's longer-term progress. There's no "species added to your collection", no "1 of 57 — 56 to go", no streak increment shown, no unlock celebration. The signed-in reveal (`authed-03`) is even thinner — it collapses to "IDENTIFY / WHERE IS THIS? / SKIP" with no progress feedback whatsoever. The pokédex and the reveal are disconnected: you unlock species in one place but never see it happen at the moment you earn it.
- **Why it matters:** The unlock-a-collectible mechanic only motivates if the user *feels the unlock at the moment of the win*. Right now the collection silently fills in a screen the user has to go and find. Tying the reward to visible, accumulating progress ("you just added the Pollack to your collection — 4 of 57") is the loop that makes pokédex-style systems addictive, and it's currently absent from the highest-attention screen in the app.
- **Recommendation:** On a correct/close ID at the reveal, surface a compact progress beat: a "Added to your collection — N of 57" line (or a brief unlock animation for a *new* species), plus the streak tick. Reuse the existing `fishspotter-animations` species-unlock pattern noted in the project skill so it's on-brand and reduced-motion-safe. For coarse-only credit, show the partial ("shape unlocked — name it to add the species"). Make the win visibly *accumulate*.
- **Effort:** M

---

### G-07 — Signed-in reveal is a dead-end: it strips the reward and the forward pull
- **Screens:** authed-03-reveal-authed.png
- **Severity:** P1
- **Lens:** Visual hierarchy & clarity
- **Observation:** The authenticated reveal card is nearly empty — a thin dark bar reading "IDENTIFY / WHERE IS THIS?" with "SKIP" top-right, and a persistent "Check your inbox / Verify … Resend email" banner pinned at the bottom. Compared with the rich guest reveal (`feed-05-reveal`: verdict, PEBL ID, community split, how-to-spot, next), the signed-in user — the person who has *already converted* — gets a markedly poorer reward surface. The most prominent persistent message to a logged-in user is a nag to verify their email.
- **Why it matters:** This inverts the funnel reward gradient: the guest (less invested) sees a great payoff, the registered contributor (most valuable, most likely to return) sees less and is greeted by an unresolved verification chore. It risks teaching converted users that signing in *removed* the good part, and the sticky verify banner adds anxiety/clutter at the reward moment. This is where retention is won or lost, and it's underbuilt.
- **Recommendation:** Ensure the signed-in reveal is at least as rich as the guest reveal (verdict + points + PEBL ID + community + how-to-spot + the G-06 progress/streak beat), minus the redundant sign-up ask. Make the verify-email banner dismissible and non-blocking, and move it out of the reward card's space (a one-time toast or a quiet profile flag, not a permanent bottom bar over the play surface).
- **Effort:** M

---

### G-08 — Leaderboard is the only community surface and it's competitive-only; no sense of collective effort
- **Screens:** m-leaderboard.png
- **Severity:** P2
- **Lens:** Engagement & motivation
- **Observation:** The community page is framed entirely as competition — "Spotter leaderboard", a points-maths explainer, a ranked table (one entry), and "Most common species answers". There is no collective/collaborative framing: no "the community has identified N species together", no shared goal, no recently-active feed, no sense that contributions add up to something communal. With six users, a pure ranking also looks barren.
- **Why it matters:** Competition motivates the top few; collective progress and visible community motivate the long tail, which is where citizen-science retention actually lives (most contributors never top a leaderboard but will return to push a *shared* total). A competition-only frame at n=6 reads as empty and excludes the majority. The "most-named species" data is interesting but is presented as trivia, not as "look what we've found together."
- **Recommendation:** Reframe the page from leaderboard-first to community-first. Lead with a collective banner (clips identified, species found, sites covered by the community) and keep the ranked table as one section below. Add a "recent finds" or "newest spotters" strip so the community looks alive. Tie the "most-named species" into the impact narrative (G-01) — "the community has confirmed Flounder N times" — rather than leaving it as a stats list.
- **Effort:** M

---

### G-09 — Pokédex explainer leads with limitation; the collection sells what you *can't* do
- **Screens:** m-profile-pokedex.png
- **Severity:** P2
- **Lens:** Copy & microcopy
- **Observation:** The collection's only descriptive copy is a caveat: "Correctly name a species to add it to your collection. Some clips can only be identified to a group (e.g. 'a crab') even by the PEBL team: those still earn points, but don't unlock a species." So the first thing explaining the collection is an exception about what *won't* unlock — set above a wall of "Locked" tiles. There's no aspirational hook ("collect all 57 UK species") and no momentum framing.
- **Why it matters:** First-run copy on an empty collection should pull the user forward ("here's the goal, here's how close you are"), not pre-emptively manage disappointment. Leading with the group-ID caveat, plus the "0 of 57" header and grey wall (G-02), makes the collection feel like a list of things denied rather than a quest. The caveat is honest and worth keeping — just not as the headline.
- **Recommendation:** Lead with the goal and progress ("Collect all 57 species found on UK reefs — 1 discovered, 56 to find"), show unlocked species prominently, and demote the group-ID caveat to a secondary line or an info tooltip. Frame locked tiles as "to discover" rather than "Locked" where possible. Pair with the deficit→momentum header change in G-02.
- **Effort:** S

---

### G-10 — Onboarding promises the loop but not the meaning, and is skippable into the same empty state
- **Screens:** authed-01-onboarding-or-feed.png
- **Severity:** P2
- **Lens:** First-time comprehension
- **Observation:** The onboarding card ("1 · SPOT … Pick the species in 5 seconds … No typing required", with Skip/Next and a 3-dot progress) explains the *mechanic* well but says nothing about *why it matters* — no "you're helping monitor real reefs." It's also dismissible straight into the cold profile/empty states (G-02), and a "Check your inbox … Verify your account" banner already sits underneath, competing with the onboarding's first impression.
- **Why it matters:** Onboarding is the one guaranteed-attention moment to plant the contribution narrative (G-01) and to route the user toward a guaranteed early win so they never hit a literal "0". Currently it teaches the game but not the purpose, and hands the user off to discouraging empty screens — a wasted activation opportunity.
- **Recommendation:** Add a short purpose beat to the onboarding sequence ("Your IDs help PEBL track what lives on UK reefs") and end onboarding on a *guaranteed first action* that produces a visible first unlock/score, so the user's first profile view shows progress, not zeros. Suppress or defer the verify-email banner during onboarding so it doesn't compete with the first impression.
- **Effort:** M

---

### G-11 — No re-engagement trigger owned by the product; retention rests on a passive "weekly digest" email
- **Screens:** feed-05-reveal.png, authed-03-reveal-authed.png
- **Severity:** P2
- **Lens:** Engagement & motivation
- **Observation:** The only return-trigger surfaced anywhere is the "weekly digest" referenced in the verify-email banner. There's no visible mechanism that *brings the user back* on their own schedule — no streak reminder, no "new clips this week" hook, no notification of community milestones, no "you're 1 species from completing the crabs" nudge. The product is entirely pull (user must remember to return), with one weekly push that's gated behind email verification.
- **Why it matters:** Acquisition and activation are healthy, but a funnel with no owned re-engagement trigger leaks all of its retained users to forgetting. The richest moments to re-trigger on (a fragile day-1 streak, a near-complete shape group, a new batch of clips) are exactly the personalised hooks the product isn't using. Weekly-digest-only is too blunt and too infrequent to hold day-2/day-7 retention.
- **Recommendation:** Layer targeted re-engagement on top of the digest: (1) streak-at-risk reminder (opt-in), (2) "new clips added" when fresh footage lands, (3) "1 to go" near-completion nudges for shape groups/collection. Reduce the friction on the digest itself by not gating the *value* of an account behind email verification (G-07). Prioritise the cheap on-app cues (G-03 daily goal, near-completion prompts) before investing in push infrastructure.
- **Effort:** M

---

### G-12 — Activation prompt is generic; the first tap doesn't promise the science or the ease strongly enough
- **Screens:** feed-01-idle.png
- **Severity:** P3
- **Lens:** First-time comprehension
- **Observation:** The first play surface shows the clip with a floating "Tap the clip to identify" pill, "USE ↑/↓ OR SCROLL FOR NEXT", and a bottom "Tap to name species" bar. It's functional and the call-to-action is clear, but it's purely mechanical — there's no light reassurance ("no expertise needed — just pick what looks closest") and no hint that this ID feeds real monitoring, at the precise moment the user decides whether to engage.
- **Why it matters:** This is the activation tap — the single most important micro-conversion in the funnel. A one-line confidence/meaning cue here (you can't get it "wrong" in a punishing way; your guess counts toward real data) can lift first-tap rate, especially for the non-expert audience who may fear they don't know enough.
- **Recommendation:** Add a brief, dismissible confidence/meaning line near the first-clip prompt for first-time users only, e.g. "Not sure? Just pick what looks closest — every guess helps." Keep it to the first session so it doesn't clutter the loop for returning users. Cheap copy change, directly on the activation chokepoint.
- **Effort:** S

---

## Findings count by severity

- **P0:** 2 (G-01, G-02)
- **P1:** 5 (G-03, G-04, G-05, G-06, G-07)
- **P2:** 4 (G-08, G-09, G-10, G-11)
- **P3:** 1 (G-12)

**Total:** 12 findings (2 P0, 5 P1, 4 P2, 1 P3)

### Highest-leverage opportunities (top 3)
1. **G-01** — Make real-science contribution visible across the journey (the missing reason-for-being; the defining citizen-science retention lever).
2. **G-02** — Stop greeting newcomers with their own failure; convert the 0%/0-of-57/locked-wall first-run state from deficit to momentum.
3. **G-03 / G-06 (paired)** — Give the streak stakes and a daily reason to return, and make the reward moment visibly accumulate progress toward the collection — closing the day-2 retention leak the funnel currently has no engine for.
