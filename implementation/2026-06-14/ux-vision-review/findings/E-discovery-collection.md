# E — Discovery, community & collection (retention surfaces)

Reviewer area: the surfaces that make people come back — archive/browse grid,
community leaderboard, species education pages, and the pokédex/collection on the
spotter profile. Finding-ID prefix `E`.

## Summary verdict

The **retention layer is the weakest part of the product I reviewed, and it is
weak precisely where it must be strong: the moment a curious newcomer goes
looking for a reason to come back.** The species education pages are excellent
and should be considered a finished, on-brand asset — clear "How to spot it"
cards with annotated diagnostic rings, plain-language descriptors, OBIS maps and
attributed photo strips. They teach genuinely well. Everything else on the
retention surfaces actively works against the engagement goal. The **browse
grid** is a single-column wall of near-identical cards (every one reads
"ALGAPELAGO / Bideford Bay, North Devon, UK") where roughly half the thumbnails
are blank teal panels and the rest are murky green frames with no visible
subject, so there is nothing to scan, recognise or be drawn into. The
**leaderboard** shows a single human and is gated at 10 answers with no
progress-to-entry indicator, so for a 1-answer newcomer it is an empty room
behind a locked door. The **pokédex** is the most damaging surface: a brand-new
user is shown "0 of 57 species", four stats reading "1 / 0 / 0% / 1", and a very
long grid of ~57 identical greyed "Locked" tiles — a wall of failure that frames
the product as something you have already lost at, not something you are starting.
Given that zero unlocks exist across the entire database, this all-locked state
is what **every** current user sees, so it is the de-facto design, not an edge
case. Fix the empty/zero states, give the browse grid identity, and make the
leaderboard and pokédex show forward momentum from answer one.

## What's genuinely good (keep)

- **The species pages are a standout.** The dark "How to spot it" card with
  numbered teal rings over a real annotated photo, followed by 2–3 plain-English
  diagnostic bullets ("Flat body on the sand", "Eyes high on the head"), is
  exactly the right register for the public and is consistent across fish, crab
  and starfish. Keep this template wholesale.
- **The "Usually seen at / Size / Habitat / Behaviour" chip row** is scannable,
  on-brand (light-teal muted panels), and gives field-useful facts fast.
- **The OBIS "Where it's seen" occurrence map** with a "PEBL site" marker and a
  "fewer / more records" legend is a credible, science-product touch that earns
  trust without being intimidating.
- **Photo attribution is handled properly** ("© Xavier Rufray, some rights
  reserved (CC-BY-NC)" etc.) — correct, visible, and consistent with a CIC's
  open-data ethos.
- **The leaderboard scoring explainer** ("2 points per correct ID … 1 point …
  0 for an unmatched guess") is clear and honest about how points work.
- **Brand discipline is strong throughout** — navy headings, teal eyebrows,
  rounded-card surfaces, the PEBL wordmark — these surfaces look like one product.

---

### E-01 — Pokédex greets every newcomer with a wall of ~57 identical "Locked" tiles
- **Screens:** m-profile-pokedex.png, d-profile-pokedex.png
- **Severity:** P0
- **Lens:** Engagement & motivation
- **Observation:** The collection header reads "0 of 57 species" and is followed
  by an extremely long grid (the mobile profile is 3357px tall, the vast majority
  of it this grid) of near-identical greyed silhouette tiles, each captioned
  "Locked". Because zero unlocks exist in the database, this is what 100% of
  current users see. There is no first-tile call-to-action, no "your next catch"
  hint, no sample of what an unlocked tile looks like — just an unbroken column
  of failure states. The per-group counters above it ("Crab 0/6, Fish 0/28,
  Flatfish 0/3, Gastropod 0/4, Jellyfish 0/6, Squid 0/6, Starfish 0/4") are all
  zero, reinforcing "you have nothing."
- **Why it matters:** A pokédex/collection is supposed to be the dopamine engine
  of retention. Presented all-locked and 57-long on day one, it reads as a chore
  with a long way to go rather than a thrilling thing to start filling. For a
  casual member of the public this is demotivating at exactly the moment we want
  the spark — it implies the game is mostly already over and they are losing.
- **Recommendation:** (1) Collapse the locked grid by default to a small preview
  (e.g. the 6–8 species most likely at this user's site, drawn from the OBIS
  probability cache) with a "Show all 57" expander, so the page does not open
  onto a giant grey wall. (2) Add a prominent empty-state hero above the grid:
  "Your collection is empty — name your first species to unlock it" with a
  primary "Spot a clip" button back to the feed. (3) Give the **next achievable**
  tile a highlighted "Up next" treatment (teal outline, not grey) so there is a
  visible, reachable target. (4) Show an aggregate progress bar ("0 of 57") as a
  filling bar rather than only as a number, so even one unlock visibly moves it.
- **Effort:** M

### E-02 — Profile stats read as a scoreboard of failure for a new user (0 / 0% / 1)
- **Screens:** m-profile-pokedex.png, d-profile-pokedex.png
- **Severity:** P0
- **Lens:** Engagement & motivation
- **Observation:** The four headline stats are "IDENTIFICATIONS 1", "SCORE 0",
  "ACCURACY 0%", "STREAK 1". After a user's very first attempt, three of the four
  numbers are the worst possible value (0 points, 0% accuracy). There is no
  encouragement, no "keep going", no context that a 0 is normal at the start.
  "ACCURACY 0%" in particular is a blunt judgement on someone who has tried once.
- **Why it matters:** First impressions of a personal dashboard set whether a
  newcomer feels capable or incompetent. Surfacing "0%" and "SCORE 0" front-and-
  centre tells a casual user "you are bad at this", which is the opposite of the
  citizen-science aim of making contribution feel achievable and worthwhile. Many
  will not return to a profile that grades them as a failure.
- **Recommendation:** (1) Suppress or reframe accuracy until there is a
  meaningful sample (e.g. hide ACCURACY until >= 5 scored answers, or show "—"
  with a tooltip "needs a few more IDs"). (2) Replace "SCORE 0" emptiness with a
  forward framing — show points-to-next-milestone instead, or a friendly empty
  copy line ("Your first points are one clip away"). (3) Consider an encouraging
  contributor framing for new users ("1 clip reviewed — thank you, every ID helps
  the dataset") that rewards participation, not just correctness, in line with the
  app's own pending-points model.
- **Effort:** M

### E-03 — Browse grid is an unscannable wall of identical cards (no species, no differentiation)
- **Screens:** m-browse.png, d-browse.png
- **Severity:** P0
- **Lens:** Visual hierarchy & clarity
- **Observation:** Every single card in the archive shows the identical eyebrow
  "ALGAPELAGO" and title "Bideford Bay, North Devon, UK"; the only thing that
  differs between cards is a small grey date (1/23/2020, 7/11/2024, 7/9/2024 …).
  There is no species name, no ID status, no depth, no "what's in this clip" —
  nothing to tell one of the 30 clips apart from another. On mobile this is a
  single-column list ~16,500px tall; on desktop a 3-column grid of the same
  repeated label.
- **Why it matters:** The browse/archive is a primary discovery surface and a
  reason to keep exploring. As built, a user cannot scan for anything they care
  about (a species they want to try, an un-identified clip, a particular site),
  so there is no hook to click a specific card. It reads as a database dump, not a
  library you want to explore — undermining the "browse the wider clip library"
  promise in the header.
- **Recommendation:** Make each card carry identity: lead with the **species /
  reference ID** if known (or "Unidentified — be the first" if not), keep
  location/date as secondary metadata, and add a small status chip
  (Identified / Needs ID / You got this one). Add lightweight filters that
  matter for discovery (by species, by "needs an ID", by site) rather than the
  current Site/Sort-only controls, since every clip is currently the same site.
- **Effort:** M

### E-04 — Roughly half of browse thumbnails are blank panels; the rest show no subject
- **Screens:** m-browse.png, d-browse.png
- **Severity:** P1
- **Lens:** Trust & polish
- **Observation:** A large proportion of the grid tiles render as flat light-teal
  panels with **no image at all** (clearly visible in the lower half of both the
  mobile list and the desktop grid, including the final full-width card above the
  pager). The thumbnails that do load are murky green/blue underwater frames in
  which no fish or subject is discernible. So the visual content of the grid is
  either missing or unreadable.
- **Why it matters:** A grid of blank and murky tiles looks broken/unfinished and
  erodes trust in a science product — it reads "prototype", not "credible
  dataset." It also removes the single biggest reason to click a video tile (a
  glimpse of something interesting inside).
- **Recommendation:** (1) Investigate why thumbnails are missing (generation gap
  / broken URLs) and ensure every clip has a poster frame. (2) Pick poster frames
  with the **most visible subject** (e.g. the frame at peak bbox activity from
  `bboxJson`) rather than an arbitrary/empty frame, so tiles show the animal. (3)
  As a fallback, render a branded placeholder (silhouette + "clip" label) instead
  of a bare panel so a missing thumbnail never looks like a layout bug.
- **Effort:** M

### E-05 — Leaderboard is an empty room behind a locked door for newcomers
- **Screens:** m-leaderboard.png, d-leaderboard.png
- **Severity:** P1
- **Lens:** Engagement & motivation
- **Observation:** The "Spotter leaderboard" ranking table contains exactly one
  human: "#1 Anjali, score 11" (desktop also shows "CORRECT 2/11"). The page
  states "Minimum 10 answers to enter the ranking." A new user with 1 answer is
  therefore not on the board, sees only one stranger, and is given **no indicator
  of their own progress toward the 10-answer entry threshold**. The bulk of the
  page is then a "Most common species answers" frequency list, which is data, not
  competition.
- **Why it matters:** A leaderboard's pull comes from seeing yourself climbing and
  rivals to chase. With a single entry and a hidden 10-answer gate, the newcomer
  gets neither — it feels dead and exclusionary rather than motivating. The "pull"
  the brief asks about is essentially absent.
- **Recommendation:** (1) Always show a "**You**" row even when below threshold,
  with a progress chip ("3 / 10 answers to join the ranking") so entry feels
  reachable and close. (2) Until the board has more players, lead with something
  alive for one user — a personal-best / streak banner, or "Be the first to
  challenge Anjali." (3) Reframe or de-emphasise the species-frequency list (or
  label it clearly as "Community trends", not part of the ranking) so the page's
  primary purpose (competition) isn't buried under a stats table.
- **Effort:** M

### E-06 — "1/11" public accuracy and a red ✗ surface low performance prominently
- **Screens:** d-leaderboard.png, m-profile-pokedex.png
- **Severity:** P2
- **Lens:** Engagement & motivation
- **Observation:** The desktop leaderboard shows the sole leader as "CORRECT
  2/11" (≈18% correct). The profile's "Recent identifications" shows the user's
  one ID as "Saithe (was Scooter)" with a **red ✗** verdict chip. Both surfaces
  prominently advertise getting it wrong — the leaderboard makes the top spotter
  look unsuccessful, and the profile's only activity row is a failure.
- **Why it matters:** Public-facing "mostly wrong" signals discourage rather than
  motivate. A newcomer reading "the best player is right 2 times in 11" may
  conclude the task is too hard to bother with; a user whose sole recent row is a
  red ✗ gets no sense of progress. Citizen-science engagement depends on framing
  contribution as valuable even when an ID is imperfect.
- **Recommendation:** (1) On the leaderboard, lead with **score** (the headline)
  and treat correct-count as secondary/optional, or express it as a positive
  ("11 clips reviewed") rather than a hit-rate that reads as failure. (2) In
  Recent identifications, balance the red ✗ with the points actually earned
  (participation/pending points) so the row shows a contribution, not only a miss.
- **Effort:** S

### E-07 — "Saithe (was Scooter)" in Recent identifications is cryptic
- **Screens:** m-profile-pokedex.png
- **Severity:** P2
- **Lens:** Copy & microcopy
- **Observation:** The single recent-ID row reads "Saithe (was Scooter)" beside a
  red ✗. There is no label explaining that "Scooter" was the user's guess and
  "Saithe" the reference answer (or vice-versa). For a non-expert the parenthetical
  reads as an unexplained alias or a bug.
- **Why it matters:** This is a small but real comprehension miss on a personal
  surface. The user can't tell what they guessed vs what was correct, so the row
  fails to teach (no "here's where you went wrong") and just registers as a
  confusing failure.
- **Recommendation:** Make the relationship explicit, e.g. "You guessed
  **Scooter** · correct answer **Saithe**" or a two-line "Your ID: Scooter /
  Reference: Saithe", with the reference linked to its species page so the row
  becomes a learning loop rather than a dead end.
- **Effort:** S

### E-08 — Pokédex group counters use raw species names that don't match the shape gate
- **Screens:** m-profile-pokedex.png
- **Severity:** P2
- **Lens:** Consistency
- **Observation:** The collection group chips read "Crab 0/6, Fish 0/28, Flatfish
  0/3, Gastropod 0/4, Jellyfish 0/6, Squid 0/6, Starfish 0/4." "Gastropod" is a
  technical term unlikely to be understood by the general public, and these labels
  don't obviously line up with the shape-class gate the user just used to play
  ("Crab / Fish / Flatfish / Jellyfish / Starfish / Gastropod / Squid"). The
  counters are also presented as plain text rather than tappable filters.
- **Why it matters:** Consistency between the play surface (shape gate) and the
  collection builds a coherent mental model ("the groups I sort into are the
  groups I collect"). "Gastropod" specifically is jargon that the brief flags as
  off-tone for non-experts. Non-interactive counters also waste an obvious
  affordance — users will expect tapping "Fish 0/28" to filter the grid.
- **Recommendation:** (1) Use the same friendly group names as the gate, and
  replace/gloss "Gastropod" (e.g. "Sea snails"). (2) Make each group chip a
  filter that scrolls/filters the collection grid to that group. (3) Show each
  group's progress as a tiny bar, not just "0/6", so progress reads at a glance.
- **Effort:** S

### E-09 — No path from a species page back into playing/collecting that species
- **Screens:** m-species-dragonet.png, m-species-crab.png, m-species-starfish.png, d-species-dragonet.png
- **Severity:** P2
- **Lens:** Friction & cognitive load
- **Observation:** The species pages are rich (how-to-spot, stats, map, photos)
  but terminate there — the only navigation is "← Back to the feed" at the top.
  There is no "find a clip with this species", no "this is locked in your
  collection — go unlock it", and no indication of whether the viewer has already
  collected it. The page teaches, then dead-ends.
- **Why it matters:** The species page is the ideal moment to convert learning
  into action ("now go spot one"). Without a forward CTA, the most educational
  surface in the app doesn't feed the core loop or the collection, so curiosity
  doesn't convert to a return visit or another ID.
- **Recommendation:** Add a footer CTA band: a primary "Spot this in the feed"
  (deep-link/filter to clips where this species is plausible per the probability
  cache) and a collection-status line ("Locked — name it in a clip to unlock" or
  "✓ In your collection"). This ties the education layer to retention.
- **Effort:** M

### E-10 — Desktop browse and profile waste horizontal space; layouts don't scale up
- **Screens:** d-browse.png, d-profile-pokedex.png
- **Severity:** P2
- **Lens:** Mobile-first quality (desktop layout)
- **Observation:** On desktop the browse grid is a centred 3-column layout with
  wide empty margins on a tall page; the profile/pokédex is a narrow centred
  column with large blank gutters either side and a very tall scroll. The desktop
  viewport is largely unused whitespace around mobile-width content.
- **Why it matters:** On desktop the surfaces feel empty and unfinished, weakening
  the "credible product" impression and making the long all-locked pokédex scroll
  even more pronounced. Better column counts would also reduce the punishing scroll
  length of the locked grid.
- **Recommendation:** Increase grid density at desktop breakpoints (browse to
  4–5 columns; pokédex to a wider multi-column grid that fills the container) and
  cap the content width sensibly so the page reads as a designed layout rather
  than a phone screen stretched onto a monitor.
- **Effort:** M

### E-11 — Verify-email toast obscures the feed and shows no clip behind it
- **Screens:** authed-02-feed-authed.png
- **Severity:** P2
- **Lens:** First-time comprehension
- **Observation:** Immediately after signup the feed shows a murky green frame with
  a persistent bottom card: "Check your inbox — We have emailed you a link to
  verify your account. Verify to enable the weekly digest. / Resend email." The
  underlying clip is a featureless green frame (no subject), and the card sits over
  the primary play area. There's no obvious "play now" affordance visible above it.
- **Why it matters:** A newly signed-up user's first authenticated view should
  pull them straight into spotting. Instead the dominant element is an admin task
  (verify email), over a clip with nothing visible in it — a flat first impression
  that doesn't reward signing up or make the next action ("start spotting") clear.
- **Recommendation:** (1) Make the verify notice a slim, dismissable banner that
  doesn't compete with the play CTA, and ensure the first authed clip is one with
  a clearly visible subject (use bbox activity to pick the landing clip). (2) Lead
  the first authed view with an explicit "Start spotting" prompt so verification is
  a secondary nudge, not the headline.
- **Effort:** S

### E-12 — Browse header copy and labels are slightly off-tone / generic
- **Screens:** m-browse.png, d-browse.png
- **Severity:** P3
- **Lens:** Copy & microcopy
- **Observation:** The archive intro reads "Browse the wider PEBL clip library /
  Review archived sightings from marine monitoring deployments, open any clip, and
  add your identification to the community record." "Deployments" and "the wider
  PEBL clip library" lean institutional, and the eyebrow "OBSERVATION ARCHIVE" is
  abstract. Combined with the "ALGAPELAGO" eyebrow repeated on every card (an
  internal project codename with no gloss), the page assumes insider vocabulary.
- **Why it matters:** Minor, but the cumulative effect is a slightly clinical,
  insider register on a surface meant to invite casual exploration by the public.
- **Recommendation:** Warm the intro ("Explore every clip we've collected — open
  one and tell us what you see"), and either gloss or replace the "ALGAPELAGO"
  eyebrow with something a member of the public understands (the site/region), or
  add a one-line tooltip explaining what Algapelago is.
- **Effort:** S

### E-13 — No empty/zero-state guidance anywhere on the retention surfaces
- **Screens:** m-profile-pokedex.png, m-leaderboard.png, d-leaderboard.png
- **Severity:** P3
- **Lens:** Engagement & motivation
- **Observation:** Across the leaderboard (1 entry), the collection (0/57, all
  locked) and the profile stats (0 / 0%), none of the surfaces carries a tailored
  empty-state message that turns "there's nothing here yet" into "here's what to
  do next." The screens present zeros as facts rather than as the start of a
  journey.
- **Why it matters:** Empty states are the highest-leverage onboarding moments for
  a new product with little data. Leaving them bare is a missed chance to direct,
  reassure and motivate, and makes the whole product feel emptier than it needs to.
- **Recommendation:** Add purpose-built empty states with a single clear next
  action and an encouraging line on each surface (collection, leaderboard,
  recent-IDs), reusing the brand's plain-grounded voice — e.g. collection: "Nothing
  collected yet — your first correct ID unlocks a species. [Spot a clip]".
- **Effort:** S
