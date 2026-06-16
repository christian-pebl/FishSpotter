# C — The reveal & reward moment

## Summary verdict

The reveal is the app's dopamine payoff, and structurally it has the right ingredients: a personal verdict ("You said Pollack"), a points reward, the PEBL reference, a community split, a teaching link, and a guest sign-up nudge — all in one panel. The guest reveal (`feed-05-reveal.png`) is the most polished screen in this set: calm dark surface, on-brand teal, a genuinely well-judged sign-up card ("keep your finds (1 so far)") that sells value rather than nags. But the moment has three real problems that blunt the reward. First, the **verdict is under-celebrated and visually quiet** — "≈ Close · +1" is a small amber pill with no animation cue or hierarchy, and on the "correct" path (`snippet-02`) there is **no visible verdict or points at all**, so the single biggest reward signal is missing on a win. Second, **"PEBL ID: Fish" reads as anticlimactic and confusing** — the headline answer is a coarse class with no framing for why a non-species reference is the "right" answer, and it's typeset bigger than the user's own (closer) guess. Third, the **community split is not yet meaningful**: "2 SPOTTERS" at 50/50 between two species the user didn't pick, with the user's own guess (Pollack) absent from the bars, makes the social-proof feature feel thin and slightly undermining. The two "reveal" comparison shots are also inconsistent with each other (different layout, different copy, one missing its verdict), and the labelled signed-in reveal shot is actually the feed idle state, so the guest-vs-authed comparison can't be fully made from these captures.

## What's genuinely good (keep)

- **The guest sign-up card is well-judged.** "Nice spot!" + "keep your finds (1 so far), build a streak, and join the leaderboard" + "Save my finds — sign up free" sells a concrete benefit, personalises with the live find count, and isn't a wall or a modal block. This is best-practice citizen-science conversion. Keep the pattern.
- **Personal framing of the answer.** Leading with "You said **Pollack**" (the user's own guess, bolded) before revealing the reference is the right emotional order — it acknowledges the player first.
- **The "How to spot a Fish next time" teaching hook exists and is placed in the reveal**, turning a result into a learning loop. Good instinct.
- **The reveal is a non-blocking sheet, not a full takeover** — the clip context and the location chip stay visible, and there's a minimise affordance. Keeps the player in the loop.
- **On-brand surface and palette** on the guest reveal: dark navy panel, teal primary button, restrained. Reads like a product, not a hackathon.
- **"Where is this?" is offered right at the reveal**, tying the find to a real place — strong for a marine-monitoring product's credibility.

---

### C-01 — Correct reveal shows no verdict and no points
- **Screens:** snippet-02-reveal-correct.png
- **Severity:** P0
- **Lens:** Engagement & motivation
- **Observation:** This is the "correct" reveal, yet there is no "Correct", no "+2", no verdict pill, and no points anywhere on screen. The only feedback that the guess was right is implicit: "You said: Crab", "Community response Crab 100%", "Reference: Crab" — three lines the user must read and mentally cross-match to infer they won. The guest reveal (`feed-05`) at least surfaces "≈ Close · +1"; the *correct* path, which should be the most rewarding outcome in the whole app, surfaces the reward the least.
- **Why it matters:** The reward moment is the entire retention mechanism. A correct answer with no celebratory verdict and no visible points is the dopamine hit failing exactly when it should fire hardest. A casual user who got it right may not even register that they scored, killing the reason to play the next clip.
- **Recommendation:** Add an explicit verdict + points to this layout, matching the guest reveal: a "Correct" pill in the `correct` token colour and a clear "+2" near the top, ideally with a brief draw-on/scale-in animation. Make verdict + points the first thing the eye lands on, above "You said". Treat "verdict + points are always visible on every reveal outcome" as an invariant across both reveal layouts.
- **Effort:** M

### C-02 — The two reveal layouts are inconsistent (feed sheet vs single-snippet page)
- **Screens:** feed-05-reveal.png, snippet-02-reveal-correct.png
- **Severity:** P1
- **Lens:** Consistency
- **Observation:** The same conceptual moment renders two different ways. Feed reveal: dark navy sheet, "PEBL ID" eyebrow, "COMMUNITY · 2 SPOTTERS", "≈ Close · +1" amber pill, sign-up card, "How to spot… / Where is this?", "Edit answer / Archive / Next →". Single-snippet reveal: light card, "PEBL OBSERVATION DETAILS", "SPOTTER CHALLENGE / What species is this?", "Community response", "Reference: Crab", "← Back to live feed" — no verdict pill, no points, no teaching link, no sign-up card, different label wording ("Reference" vs "PEBL ID", "Community response" vs "COMMUNITY"). A user arriving via a shared single-snippet link gets a materially weaker, differently-worded reward than a feed user.
- **Why it matters:** Inconsistency erodes the sense of a designed product and means the shareable entry point (single snippet) — the one most likely to be a new visitor's first impression — is the worst version of the reward. It also doubles maintenance and guarantees drift.
- **Recommendation:** Converge on one reveal component used in both contexts. Standardise the label set ("PEBL ID", "Community", verdict pill, points), the teaching link, and the guest sign-up card so a single-snippet visitor gets the full reward and CTA. If the single-snippet page must stay leaner, at minimum port the verdict pill, the points, and the sign-up nudge into it.
- **Effort:** L

### C-03 — "PEBL ID: Fish" is the headline but reads as anticlimactic / unexplained
- **Screens:** feed-05-reveal.png
- **Severity:** P1
- **Lens:** First-time comprehension
- **Observation:** The largest text in the reward panel after the verdict is "Fish" under a small "PEBL ID" eyebrow. To a member of the public who just guessed "Pollack" (a specific fish), being told the authoritative answer is the broad word "Fish" reads as a let-down or even an error — "I was more specific than the official answer?" Nothing on screen explains that "Fish" is a deliberate coarse reference (the clip isn't resolved to species) rather than a failure to identify. The community then names two *species* (Saithe, Poor cod), which makes "Fish" look even more like a placeholder.
- **Why it matters:** The headline reward answer feeling like an anticlimax or a bug, with no framing, undercuts the satisfaction of the whole loop and can read as the app "not knowing." For a science product, an unexplained vague answer also dents trust.
- **Recommendation:** Frame the coarse reference explicitly and positively. e.g. eyebrow "Closest confirmed ID" with "Fish" plus a one-line subtext: "This clip isn't confirmed to species yet — your 'Pollack' guess is logged and counts toward the community ID." Consider a small "why?" affordance. Where the reference is coarse, lean into the citizen-science framing ("help confirm what species this is") so a class-level answer feels like an invitation, not a dead end.
- **Effort:** M

### C-04 — "≈ Close · +1" verdict is too quiet and the symbol is ambiguous
- **Screens:** feed-05-reveal.png
- **Severity:** P1
- **Lens:** Visual hierarchy & clarity
- **Observation:** The verdict is a single small amber pill, "≈ Close · +1", sitting on the same line as "You said Pollack" with no greater visual weight than the surrounding text. The "≈" (approximately-equal) glyph is a maths symbol most non-experts won't parse as "close / partial credit". There's no scale-in, glow, or size hierarchy to make the verdict the focal point. The reward (+1) is buried inside the pill at the same size as the word "Close".
- **Why it matters:** The verdict and the points are the payoff. If the payoff doesn't visually arrive — no focal hierarchy, an obscure symbol — the moment doesn't land as a reward, and partial-credit (the most common nuanced outcome) is exactly where players most need to understand *why* they got 1 not 2.
- **Recommendation:** Promote the verdict to a clear focal element: larger pill, the `pending`/partial token colour, plain-language label ("Close match", "Partial — shape right"), and the points called out distinctly (e.g. "+1 pt"). Drop the "≈" glyph or pair it with words. Add a short, reduced-motion-safe scale-in on the verdict and a count-up on the points (the repo already has a motion-token system and an animation skill for exactly this).
- **Effort:** M

### C-05 — Community split is thin and excludes the user's own guess
- **Screens:** feed-05-reveal.png
- **Severity:** P1
- **Lens:** Engagement & motivation
- **Observation:** "COMMUNITY · 2 SPOTTERS" shows Saithe 50% / Poor cod 50% — two near-identical full-width teal bars on a sample of two people, neither of which is the user's guess (Pollack). The result is that the "social proof" reads as (a) statistically meaningless (n=2, a coin-flip split), and (b) subtly undermining: the community board lists species the player *didn't* choose, and the player's own answer is nowhere on it. There's no indication of where Pollack sits or that it's even in contention.
- **Why it matters:** The community split is meant to make contribution feel collective and meaningful and to soften a near-miss ("you and 3 others said Saithe"). As shown, it does the opposite — it isolates the user from the crowd and shows a tie that conveys nothing. With genuine disagreement (50/50 Saithe vs Poor cod) the screen should be teaching "experts find this one hard too", not just drawing two equal bars.
- **Recommendation:** (1) Always include the user's own guess in the bars, highlighted (e.g. "Pollack — you"), so they see themselves in the community. (2) For low n, label honestly and frame as opportunity ("Only 2 spotters so far — your ID helps build consensus") rather than a hard percentage. (3) When the top two are tied/close, add a one-line "Spotters disagree on this one — these two look alike" to turn the split into a teaching beat. (4) Consider hiding the bar chart below a small threshold and showing a "be the first to help ID this" state instead.
- **Effort:** M

### C-06 — Labelled "signed-in reveal" capture is actually the feed idle state (comparison blocked)
- **Screens:** authed-03-reveal-authed.png
- **Severity:** P2
- **Lens:** Engagement & motivation
- **Observation:** The shot intended to show the signed-in reveal (points/streak, no guest nudge) does not show a reveal at all. It shows the feed with a minimised "Identify" / "Where is this?" bar and an account banner: "Check your inbox — We have emailed you a link to verify your account. Verify to enable the weekly digest. Resend email." There is no verdict, no points, no streak, no community split visible. The guest-vs-signed-in reveal comparison the review asked for cannot be made from these captures.
- **Why it matters:** Beyond the capture gap, it flags a real product question: the signed-in reveal must visibly *reward differently* from the guest one (show streak progress and cumulative points where the guest sees a sign-up card), and we have no evidence it does. If the signed-in reveal is just the guest reveal minus the CTA, the incentive to be logged in is under-sold at the exact moment it should pay off.
- **Why it matters (engagement):** Logged-in users need their own reward (streak tick, running total, pokédex unlock) to feel the benefit of the account they created.
- **Recommendation:** Re-capture the genuine signed-in reveal. Separately, ensure the signed-in reveal replaces the sign-up card with positive logged-in reward state: "Streak: 4 days", running points total, and a "+1 to your collection / species unlocked" beat where applicable. Also reconsider the verification banner stacking on top of the reward area — it competes with the dopamine moment (see C-07).
- **Effort:** S (re-capture) / M (signed-in reward state)

### C-07 — Account-verification banner intrudes on the reward area
- **Screens:** authed-03-reveal-authed.png
- **Severity:** P2
- **Lens:** Friction & cognitive load
- **Observation:** A persistent "Check your inbox / Verify to enable the weekly digest / Resend email" banner sits pinned at the bottom of the play/reveal area for a freshly signed-up user. It's the most prominent text on the screen and competes directly with the gameplay/reward zone right after sign-up — the moment the new user should be having fun, not handling an admin chore.
- **Why it matters:** The post-sign-up window is the highest-intent, most fragile moment for a new contributor. Front-loading an unresolved-account nag here adds cognitive load and can sour the first session before the reward loop has hooked them.
- **Recommendation:** Demote verification to a slim, dismissible bar that doesn't overlap the reward sheet, or surface it only on the account/menu screen and after the first successful reveal — not during the play→reveal flow. Soften the copy ("Optional: verify to get the weekly digest") so it reads as a perk, not a blocker.
- **Effort:** S

### C-08 — Single-snippet reveal: bbox overlay dots render over the observation-details text
- **Screens:** snippet-02-reveal-correct.png
- **Severity:** P1
- **Lens:** Trust & polish
- **Observation:** In the "PEBL OBSERVATION DETAILS" panel, the video's tracking-overlay dots/marks are painted across the metadata text. "PEBL OBSERVATION DETAILS" and "Site: Bideford Bay, North Devon, UK" are visibly occluded by scattered teal blobs, and the heading reads as broken/garbled. This is a clear rendering bug — overlay graphics bleeding outside the video frame onto the text card beneath.
- **Why it matters:** This is exactly the kind of glitch that makes a science product look like a rough prototype and undermines trust precisely on the shareable single-snippet page (a likely first-impression entry point). Garbled headings also hurt legibility/accessibility.
- **Recommendation:** Clip the bbox/tracking overlay strictly to the video element bounds (overflow hidden on the player container) so it can never paint onto the details card. Verify on the single-snippet layout specifically, since the panels sit closer together there than in the feed sheet.
- **Effort:** S

### C-09 — Teaching link is underweighted relative to its value
- **Screens:** feed-05-reveal.png
- **Severity:** P2
- **Lens:** Engagement & motivation
- **Observation:** "HOW TO SPOT A FISH NEXT TIME" is rendered as small, low-contrast uppercase grey text with a thin eye icon, tucked on a utility row beside "WHERE IS THIS?" and below the sign-up card. It carries the same visual weight as a secondary utility action, yet it's the core *learning* payoff that turns a miss into a skill — the thing that makes the next guess better and the loop sticky.
- **Why it matters:** Citizen-science engagement depends on players feeling they're getting better. A near-miss ("Close +1") is the ideal teachable moment, but the path to learning why is the quietest element on the screen, so most users will skip it. The teaching hook is also slightly odd as "how to spot a *Fish*" (the coarse class) rather than how to tell Pollack/Saithe/Poor cod apart — the actual confusion the user just had.
- **Recommendation:** Raise the teaching link's prominence after a near-miss (give it teal text, a clearer label like "See how to tell these apart", and more separation from "Where is this?"). Where the user's guess and the top community species are confusable look-alikes (Pollack vs Saithe vs Poor cod), target the teaching link at *that* comparison rather than the generic class.
- **Effort:** M

### C-10 — "Edit answer" after scoring is confusing and risks undermining the reward
- **Screens:** feed-05-reveal.png
- **Severity:** P2
- **Lens:** First-time comprehension
- **Observation:** The footer offers "EDIT ANSWER" (pencil) and "ARCHIVE" alongside "Next →". After a verdict and points have been awarded, "Edit answer" is ambiguous: does it let the user change their guess and re-score (which would make the +1 meaningless)? Re-open the funnel? Both "Edit answer" and "Archive" are low-contrast grey utility text competing with the bright "Next →" CTA, and their meaning at this stage isn't obvious to a casual user.
- **Why it matters:** Letting a scored answer be edited muddies whether the reward is "real", and a casual user won't know what tapping it does. Ambiguous post-score controls add doubt to the exact moment that should feel resolved and rewarding.
- **Recommendation:** Clarify intent. If re-scoring isn't allowed, relabel to "Change my guess (won't rescore)" or remove "Edit answer" from the post-reveal state entirely and keep the funnel re-entry only before submit. Make "Next →" the unambiguous primary action and demote/relocate "Archive" (it reads as an admin/dataset action a public player won't understand here).
- **Effort:** S

### C-11 — Map modal header truncates the site name and offers nothing to act on
- **Screens:** feed-07-map-modal.png
- **Severity:** P2
- **Lens:** Visual hierarchy & clarity
- **Observation:** The "Where is this?" modal header reads "BIDEFORD BAY, NORTH DEVON, UK · ALGAP…" — the deployment name is cut off mid-word ("ALGAP…"), and the subtitle is raw coordinates "51.0605, -4.3611". The map shows a single teal dot, zoom +/−, and the OpenStreetMap attribution. There's no scale bar, no "what am I looking at" framing, and no onward action (e.g. "see all clips from this site"), so the modal is a dead-end lookup that closes back to the reveal.
- **Why it matters:** Place is a credibility and wonder lever for a marine-monitoring product ("this is real footage from a real reef off Devon"). A truncated label, bare lat/long, and no next step waste that moment and read as unfinished.
- **Recommendation:** Don't truncate the site/deployment name (wrap to two lines or drop the deployment code into the subtitle). Replace or supplement raw coordinates with human context ("North Devon, ~20 m depth"). Add a scale indicator and, ideally, one onward action ("More clips from Bideford Bay") to turn the lookup into engagement rather than a dead-end.
- **Effort:** M

### C-12 — "20 m" location chip uses a download-style icon for depth
- **Screens:** feed-05-reveal.png
- **Severity:** P3
- **Lens:** Consistency
- **Observation:** The bottom context chip "20 m · Bideford Bay, North Devon, UK · Jul 2024" prefixes the depth with a downward-arrow-into-tray glyph that reads as a "download" icon rather than depth. The location uses a map-pin and the date uses a calendar (both apt); the depth icon is the odd one out and is easy to misread.
- **Why it matters:** Minor, but for a marine product depth is a meaningful field; a download-looking glyph muddies a small but frequently-seen chip and chips at polish/consistency.
- **Recommendation:** Swap the depth glyph for a depth-appropriate thin stroked icon (down-caret to a seabed line, or a small "depth" waterline mark) consistent with the teal line-art icon set.
- **Effort:** S

### C-13 — Reveal panel lacks a clear title / "result" framing
- **Screens:** feed-05-reveal.png
- **Severity:** P3
- **Lens:** First-time comprehension
- **Observation:** The guest reveal sheet opens straight into "You said Pollack" with a bare "−" minimise control top-right and no panel title or "Result" eyebrow. A first-timer who just submitted may take a beat to realise this sheet *is* the answer/result (versus another step in the funnel), especially as the funnel steps preceding it are also sheets.
- **Why it matters:** A tiny orientation cost at the most important screen; clarity that "this is your result" reinforces that the loop has a satisfying endpoint.
- **Recommendation:** Add a small eyebrow/title to the reveal sheet ("Your result" / "Reveal") so its role is unambiguous, and ensure the minimise affordance is clearly a control (label or larger hit area).
- **Effort:** S
