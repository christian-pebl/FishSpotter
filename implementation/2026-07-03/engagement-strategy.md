# FishSpotter — engagement, distribution & brand-bridge strategy (2026-07-03)

A strategy note for turning FishSpotter from a well-built game into a growth
engine for PEBL CIC: more players, more sharing, a visible bridge from the app
to PEBL's brand and hardware/monitoring sales, and — underneath all of it —
more people who understand that seaweed and shellfish farms are *good* for
marine biodiversity.

This is a thinking document, not a build ticket. It ends with a prioritised
backlog so it can become tickets.

---

## 1. The core insight

FishSpotter is not really a fish-ID game. It is **the most engaging asset PEBL
has for telling its story**. Every other PEBL surface (the website, the
bioRxiv paper, the WWF Cymru partnership, the SubCam hardware) is aimed at
funders, scientists, and sea-farm operators. FishSpotter is the only thing PEBL
owns that a member of the public will *choose* to spend five minutes with.

That reframes the growth question. We are not optimising a game's DAU. We are
using a game to move three needles that PEBL actually cares about:

1. **Reach** — how many people PEBL can show the Climate Action Fund it engaged.
2. **Belief** — how many of them come away understanding that seaweed farming
   *increases* biodiversity (the counter-intuitive, brand-defining message).
3. **Pipeline** — how many funders, operators, students, and partners end up
   one click from PEBL's products, papers, and mailing list.

Everything below is judged against those three, not against vanity metrics.

## 2. What we already have (and it's a lot)

The app is in a genuinely strong position to grow — the foundations that are
expensive to build later are already here:

- **Public, indexable, unfurl-ready URLs** for every clip (`/feed/[id]`), every
  species (`/species/[slug]`), and every spotter (`/u/[id]`), all in the
  sitemap, all with per-page OpenGraph metadata. This is the hard part of
  shareability and it's done.
- **A real retention stack**: the Pebbles economy, the day-streak ("Tide"),
  UnlockedSpecies collection, a public leaderboard, and — notably — *working
  email re-engagement* (SendGrid weekly digest + streak-nudge crons with
  opt-in/unsubscribe). Most apps at this stage have none of this.
- **A consensus/crowd-authority scoring model** — the community is the
  authority, not a staff answer key. This is philosophically perfect for a
  citizen-science brand and is a story in itself.
- **An installable PWA** and a data-minimal, consent-gated engagement-metrics
  pipeline already wired for funder reporting (`/admin/metrics`, CSV export).

## 3. What's missing (the growth gaps)

Four gaps, in priority order. The first is the single highest-leverage thing
the app is missing.

### Gap 1 — there is no viral loop at all

There is **no share button, no Web Share, no copy-link, no invite/referral
anywhere in the app.** We have built share-ready URLs and OG metadata and then
given users no way to share. A player who just identified a cuttlefish, hit a
14-day Tide, or topped the weekly leaderboard has literally no affordance to
tell anyone. Every session is a dead end.

This is the difference between linear growth (we acquire every user by hand)
and compounding growth (players bring players). It is also cheap: the URLs and
metadata already exist.

### Gap 2 — the shareable moments aren't *worth* sharing yet

Even with a share button, a raw `/u/[id]` profile or a thumbnail-only clip card
doesn't make a compelling post. The species OG image is a raw iNaturalist
photo; the profile OG has no image at all. We have no **rendered share card**
that turns a win ("I spotted 12 species this week", "17-day Tide", "First
Sighting of a John Dory") into an image someone is proud to post.

### Gap 3 — the mission is nearly invisible in the product

This is the one that matters most for PEBL specifically. A player currently
learns *zero* about **why the footage exists**. The clips come from cameras on
real seaweed and shellfish farms in Pembrokeshire (Câr y Môr), and the whole
scientific point — the thing PEBL's [bioRxiv paper](https://www.biorxiv.org/content/10.1101/2024.02.15.580450v1)
and the [Marine Biological Association](https://www.mba.ac.uk/british-shellfish-and-seaweed-farms-could-provide-valuable-habitats-for-coastal-fish-species-according-to-new-research/)
work show — is that **these farms create habitat: nurseries, shelter, and
feeding grounds that increase the abundance and diversity of marine life.** The
app is a live demonstration of that thesis and never says so. "Kelp" appears
only as flavour text in a loading spinner.

If a player never connects "this fish I'm looking at is living *on a seaweed
farm*, and that's the point", we've spent all our engagement and taught them
nothing PEBL needs them to believe.

### Gap 4 — re-engagement is email-only

The digest and streak-nudge emails are good, but they're opt-in email. There's
no web-push (despite the installable PWA), so most re-engagement leans on a
channel users increasingly ignore.

## 4. The flywheel we're building

```
        ┌─────────────────────────────────────────────┐
        │                                             │
   discover a clip ──► learn WHY it matters ──► get hooked (streak/pebbles)
        ▲            (seaweed farm = habitat)          │
        │                                              ▼
   friend plays  ◄──── share a proud moment ◄──── hit a milestone
        │            (rendered card + link)           │
        │                                              ▼
        └──────────── one click from PEBL ────────────┘
                 (brand, mailing list, products)
```

The bridge to sales is deliberately *soft*. FishSpotter's audience is the
public, not sea-farm operators — but it contains the students, volunteers,
journalists, funders, and future-employees who make PEBL's brand real, and the
occasional operator/investor who *is* a customer. The job of the app is not to
sell a SubCam on the reveal screen; it's to make thousands of people
associate PEBL with "the seaweed-farm biodiversity people" and put PEBL's real
CTAs (newsletter, products page, contact) always one tap away.

## 5. Initiatives, prioritised

Effort is rough (S = a day, M = a few days, L = a week+). Impact is judged
against Reach / Belief / Pipeline from §1.

### P0 — Ship the viral loop (the un-ship-able gap)

**5.1 Share affordance on every win. (M, mostly reuses existing URLs.)**
Add a share control using the Web Share API (`navigator.share`) with a
clipboard-copy fallback, on: the reveal card after a correct/consensus ID, the
profile page, the leaderboard row (self), and the streak milestone. Share text
is templated per context ("I just spotted a *Labrus mixtus* on a Welsh seaweed
farm 🌊 — can you? {url}"). Every shared URL carries a `?ref=` param for
attribution and a soft invite. *This is the one item that, if we ship nothing
else, changes the growth curve.*

**5.2 Rendered share cards. (M.)** Add dynamic OG images
(`ImageResponse`/`opengraph-image.tsx` per route) for the three post-worthy
moments: a **spotter card** (name, species-collected count, Tide length, top
species photo), a **species card** (the annotated reference photo + one
diagnostic mark + "Spotted on a Welsh seaweed farm"), and a **clip card** (the
actual snippet still + the consensus ID). Fill the profile OG gap while we're
there. Now a shared link *looks* like something worth clicking.

**5.3 Challenge-a-friend. (S once 5.1 exists.)** A "Can you beat my ID?" deep
link to a specific clip (`/feed/[id]?ref=...`) that drops the recipient
straight onto that clip. Uses the existing per-clip route; it's mostly copy +
a landing nudge for logged-out visitors ("Guess this one, then see how you did
against the crowd").

### P1 — Make the mission the product, not a footnote

**5.4 "Where this comes from" in the core loop. (M.)** On the reveal card, add
a small, dismissible provenance line: *"Filmed on a seaweed farm in
Pembrokeshire. Farms like this shelter more fish than the open seabed —
[why →]"*. The `[why →]` opens a short, beautiful explainer (see 5.5). This is
the single most important belief-moving change: it attaches the message to the
moment of delight, every clip.

**5.5 A real `/about` (or `/why-seaweed`) page. (M.)** Today "About PEBL" is a
paragraph on the landing page. Build a proper, public, indexable, shareable
page that tells the story: what a seaweed farm is, the cameras (SubCam2 / BRUV)
that shot this footage, and the evidence that farms boost biodiversity — cite
PEBL's own [research](https://www.biorxiv.org/content/10.1101/2024.02.15.580450v1)
and partners ([Câr y Môr](https://www.pebl-cic.co.uk/), WWF Cymru). This is
the page journalists and funders link to, and the destination for the reveal-card
`[why →]`. It doubles as SEO surface for "does seaweed farming help
biodiversity".

**5.6 Onboarding gains a "why" beat. (S.)** The 3-step tour (Spot / Compare /
Streak) is pure mechanics. Add a fourth: *"Every clip is real footage from a
Welsh seaweed farm — you're helping show these farms are alive."* One screen,
big impact on framing.

**5.7 PEBL CTAs that convert belief into pipeline. (S.)** Once someone cares,
give them somewhere to go: a newsletter sign-up on the `/about` page and in the
weekly digest footer ("Follow PEBL's seaweed work"), the [products
page](https://www.pebl-cic.co.uk/products) linked as "The cameras behind these
clips", and a light "Work with PEBL / bring cameras to your farm" contact link.
Soft, honest, always present.

### P2 — Deepen retention & reach

**5.8 Web-push for streaks & milestones. (M.)** The PWA is installable; add
web-push so the streak-nudge and "the crowd reached consensus on your ID" moments
can reach opted-in users without email. Pairs with the existing cron logic.

**5.9 Weekly community moments. (S–M.)** A "Species of the week" or "Rarest
sighting this week" surfaced in the digest and as a shareable card — gives
regulars a reason to return and a fresh thing to post. Rides the existing
consensus + rarity (OBIS `SpeciesProbability`) data.

**5.10 Seed distribution channels. (ongoing, non-code.)** The app is ready to
be *posted*; PEBL needs to post it. Priorities: (a) short vertical clips of the
best snippets for Instagram/TikTok Reels with the "guess the fish → it's on a
seaweed farm" hook; (b) a partner drop via [WWF
Cymru](https://www.wwf.org.uk/what-we-do/projects/pembrokeshire-wholescape) and
Câr y Môr's channels; (c) UK marine/rockpooling communities, school
citizen-science programmes, and the Seaweed School network; (d) the Climate
Action Fund's own comms as a proof-of-engagement showcase.

**5.11 Referral credit in Pebbles. (S, after 5.1.)** When a `?ref=` visitor
signs up and makes their first ID, award both users Pebbles. Turns the sharing
loop into a rewarded loop without paying for acquisition.

## 6. How we'll know it worked

Tie growth metrics to the funder story PEBL already reports on (`/admin/metrics`
already captures reach/engagement/learning, consent-gated):

- **Reach:** new sessions, share-link clicks (via `?ref=`), assisted signups.
- **Virality:** share actions per active user; K-factor (invited signups ÷
  sharers). Even K≈0.3 turns a marketing pound much further.
- **Belief:** `[why →]` / `/about` engagement; a one-tap "Did you know seaweed
  farms boost biodiversity? [I do now]" micro-poll after the explainer, reported
  to the funder as attitude change.
- **Pipeline:** clicks from app → pebl-cic.co.uk (products, contact), newsletter
  signups attributed to the app.

## 7. Recommended first move

If PEBL does one thing this month: **ship 5.1 + 5.2 + 5.4 together** — the share
button, a proud rendered card to share, and the "filmed on a seaweed farm"
provenance line on the reveal. That single slice closes the virality gap *and*
staples the mission to the shared moment, so every share carries PEBL's message
outward. It's a few days of work against foundations that already exist, and
it's the smallest change that turns the app from a dead-end game into a
self-propelling story about seaweed farming.

---

### Sources

- PEBL CIC — [Ocean data, made accessible](https://www.pebl-cic.co.uk/) ·
  [Products](https://www.pebl-cic.co.uk/products)
- Rippin et al., *Integrating environmental and ecological monitoring with
  seaweed farming* — [bioRxiv 2024](https://www.biorxiv.org/content/10.1101/2024.02.15.580450v1)
- Marine Biological Association — [Shellfish and seaweed farms as fish
  habitat](https://www.mba.ac.uk/british-shellfish-and-seaweed-farms-could-provide-valuable-habitats-for-coastal-fish-species-according-to-new-research/)
- WWF Cymru — [Pembrokeshire Wholescape](https://www.wwf.org.uk/what-we-do/projects/pembrokeshire-wholescape)
