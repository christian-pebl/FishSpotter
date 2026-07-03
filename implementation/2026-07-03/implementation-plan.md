# FishSpotter growth — detailed implementation plan (2026-07-03)

Companion to [`engagement-strategy.md`](./engagement-strategy.md). That doc is
the *why*; this is the *how* — file-by-file, sequenced into shippable PRs, with
data models, copy, config, tests, and effort. Sales stays **light-touch**: we
never sell hardware in the game; we link people to the seaweed farm the footage
came from, to PEBL's website, and to PEBL's Linktree (the same one in the
[@pebl_cic](https://www.instagram.com/pebl_cic/) Instagram bio).

Effort key: **S** ≈ a day · **M** ≈ 2–4 days · **L** ≈ a week+.

---

## 0. Sequencing — five PRs

Each PR is independently shippable and independently valuable. Build order is
chosen so the foundation lands first and every later PR reuses it.

| PR | Theme | Contains | Effort |
|----|-------|----------|--------|
| **PR-A** | Shared foundation | `pebl-links.ts`, `farms.ts`, `useShare` hook, `?ref=` attribution, `Event` types | M |
| **PR-B** | Viral loop | Share buttons (reveal / profile / leaderboard / milestone) + challenge-a-friend deep link | M |
| **PR-C** | Rendered share cards | Dynamic OG images for spotter / species / clip; fill profile OG gap | M |
| **PR-D** | Mission in the loop | Reveal provenance line, `/about` (`/why-seaweed`) page, onboarding "why" beat, farm links | M–L |
| **PR-E** | Retention & light CTAs | Web-push, weekly "species of the week", referral Pebbles, PEBL/Linktree CTAs in digest + about | M |

Ship A→B→C→D→E. If only one PR ships this month, it's **PR-D's reveal
provenance line folded into PR-B's share button** (the §7 recommendation from
the strategy): the smallest slice that makes sharing possible *and* carries the
seaweed-farm message with every share.

---

## PR-A — Shared foundation

Everything else depends on these. No user-visible change on its own (except the
farm data becoming available).

### A1. Central external-links config — `src/data/pebl-links.ts` (new)

One source of truth for every off-app destination, so links are never
hard-coded at call-sites and the Linktree/urls can be updated in one place.
Mirrors the existing `src/data/pebl-ids.ts` "fill-in-once" convention.

```ts
// src/data/pebl-links.ts
export const PEBL_LINKS = {
  website: "https://pebl-cic.co.uk",
  // ⚠️ FILL IN: the exact Linktree from the @pebl_cic Instagram bio.
  // Left as the site until confirmed so we never ship a wrong/guessed URL.
  linktree: "https://pebl-cic.co.uk",
  instagram: "https://www.instagram.com/pebl_cic/",
  youtube: "https://www.youtube.com/@pebl-cic",
  linkedin: "https://uk.linkedin.com/company/pebl-cic",
  x: "https://x.com/PEBL_CIC",
  products: "https://www.pebl-cic.co.uk/products",
  contact: "mailto:hello@pebl-cic.co.uk",
  // The public evidence the /about page cites.
  research: "https://www.biorxiv.org/content/10.1101/2024.02.15.580450v1",
} as const;
```

> **Open question for Christian:** paste the exact Linktree URL and I'll drop
> it into `linktree`. Until then it falls back to the website, so nothing ships
> broken.

Refactor the existing landing/footer/email links (`src/app/page.tsx` 252/277,
`src/lib/email/templates/_Layout.tsx` 65–75) to import from here. (S)

### A2. Farm/site provenance data — `src/data/farms.ts` (new)

The load-bearing new model for "where this footage comes from". Every `Snippet`
already has a `site` string plus `externalId` (e.g. `ALG_SC_11_…`),
`deployment`, `lat`, `lon`, `depthM`. **Two real farms today** (confirmed by
Christian): **Algapelago** (the `ALG_` footage — kelp farm in North Devon) and
**Kelp Crofters** (the kelp footage — Isle of Skye). Resolve a clip → farm from
its `externalId`/`site` prefix.

```ts
// src/data/farms.ts
export type Farm = {
  key: string;             // internal key
  name: string;            // "Algapelago"
  blurb: string;           // one line: what it is
  location: string;        // "Bideford Bay, North Devon"
  url: string;             // https://www.algapelago.com/
  kind: "kelp" | "seaweed-shellfish" | "reef-control";
};

export const FARMS: Record<string, Farm> = {
  algapelago: {
    key: "algapelago",
    name: "Algapelago",
    blurb: "Europe's most-offshore kelp farm — a de-facto marine sanctuary off Lundy.",
    location: "Bideford Bay, North Devon",
    url: "https://www.algapelago.com/",
    kind: "kelp",
  },
  kelpcrofters: {
    key: "kelpcrofters",
    name: "Kelp Crofters",
    blurb: "Community-scale kelp farm off Pabay, cultivated by crofters and marine scientists.",
    location: "Isle of Skye, Scotland",
    url: "https://kelpcrofters.com/",
    kind: "kelp",
  },
};

// externalId / site prefix -> farm key. ⚠️ confirm the Kelp Crofters prefix.
export const SITE_TO_FARM: Record<string, string> = {
  ALG: "algapelago",
  // KLP / KC / ...: "kelpcrofters",   // ⚠️ what prefix do the Skye clips use?
};

/** Resolve from the externalId (or site) prefix, e.g. "ALG_SC_11_…" -> Algapelago. */
export function farmForSnippet(s: { externalId: string; site: string }): Farm | null {
  const prefix = (s.externalId.split("_")[0] || s.site).toUpperCase();
  const key = SITE_TO_FARM[prefix];
  return key ? FARMS[key] : null;   // null -> render no farm attribution rather than a wrong one
}
```

Pure, unit-tested (`farms.test.ts`: every `SITE_TO_FARM` value resolves to a
real `FARMS` entry; `ALG_…` externalIds resolve to Algapelago; an unknown
prefix returns `null`). Returning `null` (not a default farm) means we never
mis-attribute a clip to the wrong farm. (S)

> **Open question for Christian:** the `ALG` prefix is confirmed for Algapelago.
> What prefix do the **Kelp Crofters** (Skye) clips carry in their
> `externalId`/`site`? Give me that string and the map is complete. (Any clips
> that aren't from either farm — e.g. reef control sites — just render without a
> farm link.)

### A3. Share attribution — `src/lib/share.ts` (new)

- `withRef(url, source)` → appends `?ref=<source>` (e.g. `reveal`, `profile`,
  `leaderboard`, `challenge`, `card`) for attribution.
- `shareTargets` copy templates per context (see B). Pure + tested.

### A4. `Event` types for share funnel — extend `src/lib/engagement.ts`

Add two consent-gated event types to the existing data-minimal pipeline:
`share_click` (with a `source` tag) and `ref_land` (a visit carrying `?ref=`).
No new PII; reuses the existing `POST /api/events` zod route, rate-limit, and
`/admin/metrics` reporting. This is how we measure virality (§ Metrics). (S)

---

## PR-B — The viral loop

Depends on PR-A. The single highest-leverage user-visible change.

### B1. `useShare` hook + `ShareButton` — `src/lib/useShare.ts`, `src/components/ShareButton.tsx` (new)

- `useShare()` wraps `navigator.share` with a `navigator.clipboard.writeText`
  fallback and a "Link copied" toast; fires the `share_click` event (A4).
- `<ShareButton source="reveal" url=… text=… />` — a 44×44 icon+label control
  using design tokens (no emoji-as-icon; stroked SVG in `text-teal-500` per the
  UI rules). Respects reduced-motion.

### B2. Mount points

| Surface | File | Shared URL | Copy (template) |
|---|---|---|---|
| Reveal card | `src/components/idflow/RevealResult.tsx` | `/feed/[id]?ref=reveal` | *"I just spotted a {species} on a UK kelp farm 🌊 Can you? {url}"* |
| Milestone (streak/First Sighting) | `RevealResult.tsx` (reward block) | `/u/[id]?ref=milestone` | *"{n}-day Tide on FishSpotter 🔥 spotting marine life on real seaweed farms {url}"* |
| Own profile | `src/app/u/[id]/page.tsx` | `/u/[id]?ref=profile` | *"My FishSpotter collection: {k} species IDed on UK kelp farms {url}"* |
| Leaderboard (self row) | `src/app/leaderboard/page.tsx` | `/leaderboard?ref=leaderboard` | *"I'm #{rank} on FishSpotter this week {url}"* |

`RevealResult` already receives `firstSighting`, `streakCurrent`, `unlock` — the
share copy can be milestone-aware with no new props beyond the snippet
`id`/species already available in the parent (`FeedCard`).

### B3. Challenge-a-friend deep link (S, after B1)

The reveal/profile share for a specific clip already links to
`/feed/[id]?ref=challenge`. Add a logged-out landing nudge on `/feed/[id]`:
*"A friend challenged you to ID this one — guess, then see how you did against
the crowd."* Uses the existing public per-clip route; copy + a small banner
only.

**Tests:** `useShare` fallback path (no `navigator.share`); `withRef` param
building; ShareButton renders a token-compliant control (lint:tokens).

---

## PR-C — Rendered share cards

Depends on PR-A. Makes shared links *look* worth clicking. Uses Next's
`ImageResponse` (already proven by `src/app/opengraph-image.tsx`).

### C1. Three dynamic OG routes

| Card | New file | Content |
|---|---|---|
| Spotter | `src/app/u/[id]/opengraph-image.tsx` | Name, species-collected count, Tide length, top species photo, PEBL mark. Fills the current profile-OG gap. |
| Species | `src/app/species/[slug]/opengraph-image.tsx` | Annotated reference photo + one diagnostic-mark ring + "Spotted on a UK kelp farm". Replaces today's raw iNat photo. |
| Clip | `src/app/feed/[id]/opengraph-image.tsx` | Snippet still + consensus ID + farm name (from `farmForSnippet`). Replaces today's bare thumbnail. |

Each reads the same data its `generateMetadata` already fetches, so no new
queries beyond an image compose. Keep them under the Edge `ImageResponse` size
budget; reuse brand tokens/fonts from the existing OG card. (M)

### C2. Wire `openGraph.images` on the three pages to the new routes; verify
unfurls with the Vercel preview + a couple of real posts. (S)

---

## PR-D — Put the mission in the product

Depends on PR-A. The belief-moving PR, and where the farm links live.

### D1. Reveal provenance line — `src/components/idflow/RevealResult.tsx` (M)

Add a compact, dismissible line under the community histogram. Needs the
snippet `externalId`/`site` (already on the snippet in the parent) →
`farmForSnippet(snippet)`; render nothing if it returns `null`:

> *Filmed on a kelp farm · **Algapelago**, North Devon. Farms like this shelter
> more fish than the open seabed. [Why seaweed farms →]  [Visit the farm ↗]*

(Skye clips render "**Kelp Crofters**, Isle of Skye" from the same helper.)

- **[Why seaweed farms →]** → internal `/why-seaweed` (D2).
- **[Visit the farm ↗]** → `farm.url` (the actual source farm) with
  `rel="noopener"`, tagged `?ref=fishspotter` where the destination supports it.
- Dismiss persists per-session (localStorage) so it doesn't nag every reveal but
  reappears for new sessions. Fires a lightweight `share_click`-adjacent
  `provenance_click` event for the belief metric.

### D2. `/why-seaweed` page — `src/app/why-seaweed/page.tsx` (+ nav + sitemap) (M)

A proper public, indexable, shareable page (the destination journalists and
funders link to; the reveal's [Why →] target). Sections:

1. **What you're looking at** — these clips are real footage from cameras on
   working UK kelp farms.
2. **Why farms help** — nurseries, shelter, feeding grounds; more abundance and
   diversity than bare seabed. Cite PEBL's own
   [research](https://www.biorxiv.org/content/10.1101/2024.02.15.580450v1) and
   the [MBA](https://www.mba.ac.uk/british-shellfish-and-seaweed-farms-could-provide-valuable-habitats-for-coastal-fish-species-according-to-new-research/)
   findings.
3. **The farms** — a card per source farm from `FARMS`:
   **[Algapelago](https://www.algapelago.com/)** (Bideford Bay, North Devon) and
   **[Kelp Crofters](https://kelpcrofters.com/)** (Isle of Skye). Each with its
   one-line blurb + link.
4. **Who made this** — PEBL CIC, one soft line about PEBL's monitoring work with
   a link to the Linktree/website. **No hardware pitch.**
5. A **one-tap micro-poll**: *"Did you know seaweed farms boost biodiversity?
   [I do now]"* → feeds the belief metric for funder reporting.

Add to `src/app/sitemap.ts`, header/footer nav, and a "Why these clips matter"
entry point from `/feed`. Reuse `landing/UnderwaterBackdrop` + `MarinePattern`
for on-brand visuals.

### D3. Onboarding "why" beat — `src/components/onboarding/OnboardingTour.tsx` (S)

Add a 4th `STEPS` entry after Spot/Compare/Streak:

> **4 · Why** — *"Every clip is real footage from a UK kelp farm. Spotting the
> life on them helps show these farms are alive — [see why]."*

One slide; `[see why]` deep-links to `/why-seaweed`. Update the "Step n of N"
counter automatically (it's derived from `STEPS.length`).

### D4. Farm chip on clip/browse surfaces — `src/app/feed/[id]/page.tsx`,
`src/app/feed/browse/page.tsx` (S)

A small farm chip (e.g. "Algapelago" / "Kelp Crofters", token-styled with the
wave silhouette — not emoji-as-icon) from `farmForSnippet`, linking to the farm,
so provenance is visible even outside the reveal.

---

## PR-E — Retention & light-touch CTAs

Depends on A–D. Deepens the loop; keeps sales soft.

### E1. Web-push for milestones (M)
The PWA is installable (`src/app/manifest.ts`, `PwaRegister`) but has no push.
Add a VAPID web-push subscription (opt-in, same consent gate as email), a
`PushSubscription` store, and wire the existing streak-nudge + a new
"consensus reached on your ID" trigger to push as well as email. Reuses the
cron logic in `src/app/api/cron/streak-nudge`.

### E2. "Species of the week" (S–M)
Pick the week's rarest consensus sighting (existing consensus + OBIS
`SpeciesProbability` rarity). Surface in the `WeeklyDigestEmail` and as a
shareable species card (C1). Gives regulars a fresh reason to return + post.

### E3. Referral Pebbles (S, after PR-B)
When a `?ref=` visitor signs up and makes a first ID, award both users Pebbles
via `src/lib/pebbles.ts`. Turns sharing into a rewarded loop without paid
acquisition. Idempotent per referred user.

### E4. Light-touch CTAs (S)
- `WeeklyDigestEmail` + `/why-seaweed` footer: *"Follow PEBL's seaweed work"* →
  `PEBL_LINKS.linktree`; *"The cameras behind these clips"* →
  `PEBL_LINKS.products` (informational, one line, no pitch).
- Landing "About PEBL" section: add the Instagram/Linktree links from
  `PEBL_LINKS`. That's the whole sales surface — a link, never a sell.

---

## Data & schema changes summary

| Change | Where | Migration |
|---|---|---|
| `farms.ts` + `SITE_TO_FARM` (config, not DB) | `src/data/` | none |
| `pebl-links.ts` (config) | `src/data/` | none |
| `share_click` / `ref_land` / `provenance_click` events | `Event` table (existing) | none (types only; `Event` already flexible) |
| `PushSubscription` (E1 only) | `prisma/schema.prisma` | `prisma db push` **+ `npm run db:enable-rls`** (RLS invariant) |
| Referral credit fields (E3) | reuse `Answer`/Pebbles ledger; a `referredBy` on `User` if needed | `db push` + `enable-rls` if a column is added |

Every schema touch follows the load-bearing rule: `prisma db push` then
`npm run db:enable-rls` (new tables land with RLS off).

## Metrics — proving it worked (ties to `/admin/metrics`)

All consent-gated, data-minimal, via the existing `Event` pipeline + CSV export:

- **Reach:** new sessions; `ref_land` count by `source`.
- **Virality:** `share_click` per active user; K-factor = referred signups ÷
  sharers (E3 gives the signup attribution).
- **Belief:** `/why-seaweed` views, `provenance_click`, and the micro-poll
  "[I do now]" rate — the attitude-change number for the Climate Action Fund.
- **Pipeline (soft):** outbound clicks to `PEBL_LINKS.*` and `farm.url`,
  tagged `?ref=fishspotter`.

## Before each PR merges
`npx tsc --noEmit && npm test && npm run lint && npm run lint:tokens`, plus
the `verify` skill on any PR with a runtime surface (B, C, D, E). New pure libs
(`farms`, `share`, referral) ship with co-located `*.test.ts`.

## Open questions for Christian (blockers marked ⚠️)
1. ⚠️ **Exact Linktree URL** (from the @pebl_cic bio) → drops into `pebl-links.ts`.
2. ⚠️ **Kelp Crofters site prefix**: `ALG` = Algapelago is confirmed. What
   `externalId`/`site` prefix do the Skye (Kelp Crofters) clips carry? That
   completes `SITE_TO_FARM`. (Any non-farm/reef-control clips just render
   without a farm link.)
3. A courtesy heads-up to **Algapelago** and **Kelp Crofters** before we drive
   traffic to them — both are education-forward, so almost certainly welcome,
   but worth a note (and a chance to agree the exact link/wording they'd like).
4. Web-push (E1): worth the VAPID setup now, or defer until share loop proves
   the audience is returning? (Recommend defer — ship A–D first, measure, then E.)

---

### Sources
- PEBL — [pebl-cic.co.uk](https://www.pebl-cic.co.uk/) · [@pebl_cic](https://www.instagram.com/pebl_cic/) · [Products](https://www.pebl-cic.co.uk/products)
- Source farms — [Algapelago](https://www.algapelago.com/) (Bideford Bay, North Devon) · [Kelp Crofters](https://kelpcrofters.com/) (Isle of Skye)
- PEBL — [bioRxiv: monitoring + seaweed farming](https://www.biorxiv.org/content/10.1101/2024.02.15.580450v1)
- [Marine Biological Association](https://www.mba.ac.uk/british-shellfish-and-seaweed-farms-could-provide-valuable-habitats-for-coastal-fish-species-according-to-new-research/) — farms as fish habitat
