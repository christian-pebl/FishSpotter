# A — First impression & acquisition funnel (landing + onboarding)

## Summary verdict

The landing has a strong skeleton: the headline ("Spot the species in real underwater footage.") states the value in one line, the "Free, no card required" reassurance is well placed, and the lower trust stack (CC-attributed species catalogue + a clear, honest "About PEBL" CIC block with company number, Privacy/Terms/Accessibility/email) reads like a credible science product, not a hackathon. The fatal weakness is the one element doing the most persuasive work: the live demo card is a near-empty flat green murk with no visible fish, so the single proof-of-concept a curious visitor scans in 2 seconds shows nothing to spot and looks broken. Around that, the page wastes a full screen of dead light-teal space between the stats and the catalogue (on both breakpoints), leads with thin social proof ("6 spotters"), and splits attention across two near-equal hero CTAs. The 3-step onboarding tour is well-structured and correctly skippable, but it's text-dense, fires on top of a second "verify your email" overlay at the same moment, and its body copy breaks the house no-em-dash rule. None of these are unfixable; the demo frame and the dead space are the two that materially cost conversions.

## What's genuinely good (keep)

- **Headline value proposition.** "Spot the species in real underwater footage." is legible in well under 2 seconds and needs no jargon. Keep it.
- **"Free, no card required. Browse the archive or view the leaderboard."** Excellent friction-remover + two low-commitment escape hatches right under the CTA.
- **The species catalogue (desktop).** Seven real, in-habitat species cards with names and per-photo CC attribution, plus a "Browse the archive →" link and a global "Reference photos via iNaturalist & Wikimedia... under Creative Commons licences." line. This is exactly the right credibility move for a citizen-science product.
- **About PEBL + footer.** Honest, specific ("a citizen-science layer over real survey footage from PEBL deployments"), company number shown, legal + contact links present. Trustworthy.
- **Onboarding structure.** Numbered eyebrows (1 · SPOT / 2 · COMPARE / 3 · STREAK), progress dots, and a persistent "Skip" on every step is the correct, low-pressure pattern.
- **Icon discipline.** The "Check your inbox" banner uses a thin stroked mail glyph, not an emoji. On-brand.

---

### A-01 — Hero demo card shows an empty green void with nothing to spot
- **Screens:** d-landing.png, m-landing.png
- **Severity:** P0
- **Lens:** First-time comprehension
- **Observation:** The "SPOT THE SPECIES / DEMO" card — the largest, most eye-catching element and the literal demonstration of the product — renders as an almost entirely flat dark-to-mid green gradient with no fish, no animal, no movement cue, nothing identifiable in frame. The only legible content on it is the corner label and the location strip "Bideford Bay, North Devon, UK". A first-time visitor whose whole question is "spot *what*?" looks at the proof element and sees an empty rectangle that reads as a broken video or a loading error.
- **Why it matters:** This is the conversion linchpin. The page asks the public to believe identifying marine life from these clips is fun and doable; the demo is the evidence. An empty murk frame actively undercuts that — it makes the core activity look impossible or the player look broken, which is the worst possible first impression for the acquisition funnel.
- **Recommendation:** Seed the demo with a hand-picked clip (or a fixed poster frame) where a fish is clearly visible in the first second, and start it on that frame, not on a between-fish lull. If autoplay can land on an empty moment, set a curated `poster` image showing the subject. As a safety net, overlay a faint subtle ring/arrow on the animal the demo is about to ask for, so even a static capture communicates "here's the thing you identify." Never let the demo open on an empty frame.
- **Effort:** S

### A-02 — A full screen of dead light-teal space between the stats band and the catalogue
- **Screens:** m-landing.png, d-landing.png
- **Severity:** P1
- **Lens:** Visual hierarchy & clarity
- **Observation:** After the three stat cards there is roughly a full viewport height of empty `#DEF2F1` with no content before "THE CATALOGUE" appears. On mobile an entire ~950px band is blank. On desktop the same gap holds only a short, centred dashed divider that doesn't span the content width and floats in the middle of the void. A user scrolling down hits a long stretch of nothing and may assume the page has ended.
- **Why it matters:** Dead space mid-funnel kills momentum and scrolling intent. The catalogue and the trust block (the credibility payload) sit below this void, so anyone who stops scrolling at the apparent "end" never reaches the proof that would convert them. It also reads as unfinished, denting the polish/trust impression.
- **Recommendation:** Remove the excess vertical padding so the catalogue follows the stats with one normal section gap. If the space is intentional breathing room, fill it with a purposeful section instead (e.g. a 3-step "How it works: Spot → Compare → Streak" strip reusing the onboarding content, or a single strong testimonial/impact line). The floating dashed divider should either span the content column or be deleted.
- **Effort:** S

### A-03 — Onboarding tour copy uses em dashes (breaks the house rule and the brand voice)
- **Screens:** authed-01-onboarding-or-feed.png, authed-01b-tour-step2.png
- **Severity:** P1
- **Lens:** Copy & microcopy
- **Observation:** Step 1 body: "We surface a few likely species — pick the one that matches what you see." Step 2 body: "...Clips without a reference are worth more — your ID helps build the dataset." Both contain an em dash (—), which is explicitly banned in PEBL copy, and the construction reads slightly AI-generated rather than plain and grounded.
- **Why it matters:** This is the first prose a brand-new signed-in user reads, so it sets the voice for the whole product. The em dash is a zero-tolerance brand violation, and the longer the onboarding sentences run, the more they feel like a wall of text rather than a friendly nudge.
- **Recommendation:** Replace every em dash with a full stop, comma, or colon and tighten the sentences. E.g. step 1: "We surface a few likely species. Pick the one that matches what you see." Step 2: "Clips without a reference are worth more. Your ID helps build the dataset." Audit step 3 and all onboarding/landing copy for the same character.
- **Effort:** S

### A-04 — The verify-email banner and the onboarding tour fire at the same moment (two stacked overlays)
- **Screens:** authed-01-onboarding-or-feed.png
- **Severity:** P1
- **Lens:** Friction & cognitive load
- **Observation:** On first sign-in the screen shows the onboarding tour modal ("1 · SPOT...") centred over the feed AND a separate "Check your inbox / We have emailed you a link to verify your account / Resend email" banner pinned at the bottom, simultaneously. The new user is hit with two competing dialogs and two different calls to action (advance the tour vs go verify your email) before they have done anything.
- **Why it matters:** Two overlays at once is classic onboarding overload — it doubles the decisions on the very first screen and muddies which thing matters now. It also visually crowds the bottom of the tour card, and the banner's "Verify to enable the weekly digest" is a low-priority ask competing with the high-priority "learn the game" moment.
- **Recommendation:** Sequence them. Show the 3-step tour first; surface the verify-email banner only after the tour is dismissed (or on the first feed interaction). At minimum, don't render both as active overlays in the same frame — collapse the verify prompt to a single quiet, non-blocking strip that waits its turn.
- **Effort:** M

### A-05 — Two near-equal primary CTAs in the hero split the user's decision
- **Screens:** d-landing.png, m-landing.png
- **Severity:** P2
- **Lens:** Visual hierarchy & clarity
- **Observation:** The hero presents "Start spotting" (filled teal pill) and "Create your spotter profile" (outlined pill) at almost the same size and visual weight, side by side (desktop) / stacked (mobile). The brief says the funnel goal is one unmistakable "Start spotting" tap; here a second, heavier-commitment action ("Create your spotter profile" = sign up) competes for the same glance.
- **Why it matters:** The whole acquisition thesis is "let them play before asking them to sign up." Putting a sign-up CTA at equal weight next to "Start spotting" reintroduces the commitment barrier the page otherwise removes, and forces a choice at the exact moment you want a frictionless single tap.
- **Recommendation:** Make "Start spotting" the single dominant CTA (larger, full teal, clearly the focal point) and demote "Create your spotter profile" to a lighter text link or a smaller secondary action below it. One obvious primary action; everything else clearly subordinate.
- **Effort:** S

### A-06 — Lead social-proof stat is "6 spotters", which reads as no one is here
- **Screens:** m-landing.png, d-landing.png
- **Severity:** P2
- **Lens:** Engagement & motivation
- **Observation:** The stats band shows "30 underwater clips / 57 identifiable species / 6 spotters". The "6 spotters" figure, given equal prominence to the other two, is anti-social-proof: it signals an empty product to a first-time visitor deciding whether to join.
- **Why it matters:** Social proof should lower the barrier and make contribution feel worthwhile. A literal "6 spotters" does the opposite — it tells a newcomer the community is tiny. The clip/species counts are genuinely impressive context; the spotter count currently drags the band down.
- **Recommendation:** Until the spotter number is healthy, replace it with a metric that grows fast and frames participation positively, e.g. "X IDs made" or "X species spotted this week", or drop the third stat to a two-up. If the spotter count must stay, reframe it as momentum ("Join 6 spotters") rather than a bare total. Revisit once the number is large enough to be reassuring.
- **Effort:** S

### A-07 — Onboarding tour steps are text-dense with no visual to anchor each concept
- **Screens:** authed-01-onboarding-or-feed.png, authed-01b-tour-step2.png, authed-01b-tour-step3.png
- **Severity:** P2
- **Lens:** First-time comprehension
- **Observation:** Each tour card is a heading plus a 2-3 line paragraph of body copy and nothing else — no illustration, mini-diagram, or example of what "Spot / Compare / Streak" looks like. Step 2 in particular is a dense block ("...how the wider community guessed, and which species OBIS expects at this site and season. Clips without a reference are worth more...") that introduces OBIS, references, and the scoring rationale all at once, in prose, before the user has seen any of it.
- **Why it matters:** Onboarding that is all words asks the user to read and hold abstract rules in their head before playing, which is exactly the kind of upfront cognitive load that makes casual visitors skip or bounce. A picture of the mechanic would teach it faster than the paragraph.
- **Recommendation:** Cut each step to one short heading + one plain sentence, and add a small supporting visual per step (a stylised species-pick tile for Spot, a tiny "you vs community" bar for Compare, a 3-day streak flame-free line graphic for Streak). Defer the OBIS/scoring nuance to the in-product reveal where the user can see it in context, rather than front-loading it in the tour.
- **Effort:** M

### A-08 — Mobile catalogue is a dead-end teaser with no browse-through and a non-representative card
- **Screens:** m-landing.png, _m_catalogue (crop)
- **Severity:** P2
- **Lens:** Friction & cognitive load
- **Observation:** On mobile the "THE CATALOGUE / What you'll find down there" section shows only three species cards and, unlike desktop, has no visible "Browse the archive" affordance beside the heading — the only tap-through is back up in the hero. So a user who scrolls to the catalogue, gets interested, and wants to see more has no obvious next step from there. Separately, the "Sprat" card (both breakpoints) is a photo of a dead fish held against a ruler, which is off-tone for a section titled "what you'll find down there" (implying live, in-habitat).
- **Why it matters:** The catalogue is a curiosity hook; a hook with no line attached wastes the interest it generates. And a held-specimen photo next to in-habitat shots undercuts the "see real marine life" promise the page is selling.
- **Recommendation:** Add a clear "Browse the full catalogue →" link/button directly under the mobile card row (don't rely on the hero link). Swap the Sprat reference to an in-water shot if one is available in the curated gallery; if not, prefer a different representative species for the landing strip so all teaser cards show live animals in habitat.
- **Effort:** S

### A-09 — Desktop top bar is hamburger-only with a faint watermark logo, so it looks unfinished
- **Screens:** d-landing.png, _d_nav (crop)
- **Severity:** P3
- **Lens:** Trust & polish
- **Observation:** On a 1280px-wide desktop the header is just a hamburger icon (far left) and a low-contrast grey "PEBL" wordmark (far right) on a near-white band, with no nav links and no visible CTA. The wide empty header reads as a mobile layout stretched to desktop, and the logo's low contrast makes it look like a faint watermark rather than a confident brand mark.
- **Why it matters:** The header is the first thing a desktop visitor's eye lands on; a bare hamburger + ghost logo signals "prototype" and misses the chance to anchor the brand and offer a persistent "Start spotting" / sign-in entry point.
- **Recommendation:** On desktop, render a proper top bar: a solid-contrast PEBL/FishSpotter logo on the left and a small set of links or a persistent "Start spotting" button on the right (reserve the hamburger for mobile). At minimum, lift the logo to full brand colour so it doesn't read as a watermark.
- **Effort:** M

### A-10 — "Create your spotter profile" and minor copy/spacing polish
- **Screens:** d-landing.png, m-landing.png, _m_band5 (crop)
- **Severity:** P3
- **Lens:** Copy & microcopy
- **Observation:** The secondary CTA label "Create your spotter profile" is slightly more abstract/product-speak than needed for a cold visitor (a profile isn't a benefit they want yet; spotting is). Separately, the mobile "About PEBL" paragraph uses a noticeably loose line-height that spreads four sentences over a lot of vertical space, adding to the long-scroll feel.
- **Why it matters:** Small voice and rhythm choices accumulate into the "is this polished?" judgement. "Create your spotter profile" frames the ask around the company's need (a profile) rather than the user's want (to play), and over-loose body leading wastes screen and dilutes readability on mobile.
- **Recommendation:** Reword the secondary action to a benefit/lower-commitment frame (e.g. "Sign up to save your streak" or simply "Sign up") and keep it visually subordinate per A-05. Tighten the About paragraph's line-height to the standard body leading so it reads as a compact block.
- **Effort:** S
