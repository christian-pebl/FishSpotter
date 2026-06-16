# Cross-cutting Design System, Accessibility & Consistency — Findings (prefix `F`)

Reviewer area: systemic issues seen **across** the screen set (brand-palette
adherence, emoji-as-icons, touch targets, text contrast/legibility, component /
spacing / radius / type consistency between screens, reliance on colour alone,
and the quality of the legal / content / error pages). Findings here are
deliberately *cross-screen* — single-screen nits belong to the per-screen
reviewers.

## Summary verdict

The product reads as a **credible, on-brand science app, not a hackathon
prototype** — and that is the headline. There is one coherent visual language:
the teal/navy palette, the uppercase tracked eyebrow + bold serif-ish heading
pattern, the soft "pebl-surface" cards, the consistent header with the
right-aligned PEBL wordmark, and genuinely good content on the legal pages. The
weaknesses are systemic rather than catastrophic: (1) **two-world contrast** —
the app oscillates between very-dark feed sheets and very-light pastel pages,
and on the light pages a lot of secondary text is muted-teal-grey on pale-teal,
which is low-contrast and recurs on landing, leaderboard, species, browse and
account; (2) **one genuinely off-palette colour** — the amber/gold "Close"
verdict chip on the reveal (and amber-tinted account verification banner) sit
outside the documented PEBL palette and the named verdict tokens; (3) **colour +
faint glyph carry meaning in several places** (the reveal verdict, the
leaderboard mini-bars, the species OBIS heat-map) without a redundant text/shape
cue that survives for colour-blind users — and the product owner is colour-blind;
(4) **touch-target and tap-affordance drift** on the dense list/strip surfaces
(species "Photos" thumbnails, leaderboard rows, browse footer links); (5) a few
**type-scale / radius / spacing inconsistencies** between the dark feed modals and
the light content pages. None of these block the funnel, but together they are
the gap between "good" and "polished, accessible, trustworthy".

## What's genuinely good (keep)

- **One consistent brand system across very different screens.** The PEBL
  wordmark top-right, the uppercase tracked teal eyebrow (`THE CATALOGUE`,
  `PEBL COMMUNITY ACCESS`, `OBSERVATION ARCHIVE`, `ACCESSIBILITY`), and the bold
  dark-navy H1 underneath it are applied uniformly on landing, sign-in, sign-up,
  leaderboard, browse, species, account, privacy, terms, accessibility and 404.
  That repetition is the single biggest "this is a real product" signal.
- **The legal + accessibility pages are a real asset.** Privacy and Terms have
  proper structure (eyebrow, H1, "Last updated" date, full company identity with
  number 12076622 and registered address, plain-English section headings). The
  **Accessibility Statement** is unusually honest and well-built — it names a
  WCAG 2.1 AA target, lists conformance, keyboard nav, screen-reader support,
  AND a candid "Known gaps" section. Most citizen-science apps ship none of this.
- **No emoji icons in the core chrome.** The shape-gate, headers, buttons and
  nav use line/silhouette art, not emoji — the no-emoji rule is largely held.
- **The 404 page is on-brand and useful** — it keeps the decorative marine
  silhouette background, gives a clear "Page not found." headline, and offers two
  real recovery actions ("Back to live feed" / "Browse the archive") instead of a
  dead end.
- **The dark feed sheets (shape-gate, reveal) are visually strong** — good focal
  hierarchy, generous touch targets on the shape tiles, the count badges, and a
  confident depth/teal treatment.

---

### F-01 — Off-palette amber/gold used for verdict + verification states
- **Screens:** feed-05-reveal.png, authed-06-account.png
- **Severity:** P1
- **Lens:** Consistency
- **Observation:** The reveal verdict chip "≈ Close · +1" is a saturated
  **amber/gold** pill (`#F4CE5x`-ish) with dark text — confirmed at 1.4x crop.
  The account page's "Verify your email…" banner is a **warm amber/tan** card.
  Neither colour exists in the documented PEBL palette (Navy `#17252A`, Teal
  `#3AAFA9`, Dark Teal `#2B7A78`, Light Teal `#DEF2F1`, White) and the brief
  explicitly bans stock `amber` for semantic states in favour of named
  `correct` / `incorrect` / `pending` tokens. So the one place a user looks for
  their score, and the one place the app warns about account safety, are both
  rendered in a colour the rest of the app never uses.
- **Why it matters:** The verdict is the emotional payoff of the entire core
  loop; rendering it in an un-branded colour makes the highest-value moment look
  bolted-on, and undermines the "credible science product" goal. Two different
  amber tints across two screens also reads as ad-hoc rather than systematic.
- **Recommendation:** Define and use the named `pending` (partial / "close")
  token for the verdict chip and a single muted-teal/navy **info** token for the
  verification banner. Pick one teal-family or navy-family treatment for "partial
  credit / notice" and apply it to both. If amber must stay for "near-miss"
  warmth, promote ONE amber hue into `tailwind.config.ts` as a named token
  (`pending`/`notice`) and use only that hex everywhere, never a raw Tailwind
  `amber-*`.
- **Effort:** S

---

### F-02 — Meaning carried by colour + a faint glyph, with no redundant cue (colour-blind risk)
- **Screens:** feed-05-reveal.png, m-leaderboard.png, m-species-dragonet.png
- **Severity:** P1
- **Lens:** Accessibility (visual)
- **Observation:** Several states lean on colour (sometimes plus a low-contrast
  symbol) to convey meaning:
  - **Reveal:** "≈ Close · +1" — correctness is signalled by an amber chip + a
    faint `≈` math glyph. A correct (green) vs close (amber) vs wrong (red) chip
    would be near-indistinguishable to a red/green colour-blind user, and the
    `≈` is small and not a widely-understood "close" symbol.
  - **Leaderboard "Most-named species":** each row has a tiny faint-teal
    mini-bar (1.3x crop) that encodes the same "3 · 15%" already in text — but the
    bars are the only *visual* ranking and they are very low-contrast pale teal on
    near-white.
  - **Species OBIS map:** the occurrence heat-map is a teal monochrome ramp with
    a "fewer ← → more records" legend — density is colour-only with no
    pattern/value labelling.
  This matters acutely because the **product owner is colour-blind** (per project
  guidance) and the app's audience is the general public, which includes the ~8%
  of men with colour-vision deficiency.
- **Why it matters:** Reliance on colour alone is a WCAG 1.4.1 failure and
  directly contradicts the accessibility statement the app itself publishes. A
  colour-blind spotter cannot reliably tell "correct" from "close", which is the
  whole reward signal.
- **Recommendation:** Add a redundant non-colour cue to each: verdict chip gets a
  shape/icon + word that differs per state (e.g. a check for correct, a dotted
  ring + "Close" for partial, a cross for wrong) so it survives greyscale;
  leaderboard rows already have the "n · %" text, so either strengthen the bar
  contrast to a brand teal or drop the bar and keep the text; for the OBIS map,
  add value labels or a coarse texture/contour and ensure the lightest step is
  distinguishable from the card background.
- **Effort:** M

---

### F-03 — Systemic low-contrast secondary text on the light pages
- **Screens:** m-landing.png, m-leaderboard.png, m-browse.png, m-species-dragonet.png, authed-06-account.png
- **Severity:** P1
- **Lens:** Accessibility (visual)
- **Observation:** Across every light-themed page, secondary/meta text is a
  **muted teal-grey on a pale-teal or white card**, at small sizes, and is hard
  to read:
  - Landing footer "© 2026 Plant Ecology Beyond Land (PEBL) CIC · Company no.
    12076622" and the catalogue photo-credit line "Reference photos via
    iNaturalist & Wikimedia…" are very light grey (confirmed in landing-bottom
    crop).
  - Browse archive: every card's "ALGAPELAGO / Bideford Bay, North Devon, UK /
    <date>" caption is small muted grey on a pale card; the search controls
    ("All sites", "Newest first") are also low-contrast.
  - Leaderboard: the scoring-explainer paragraph and the faint rank dots/bars.
  - Species page: the photo attribution "© Xavier Rufray, some rights reserved
    (CC BY-NC)" and the "USUALLY SEEN AT / SIZE / HABITAT / BEHAVIOUR" label
    eyebrows are pale.
  This is the same root issue D-06 flags inside the dark menu, but it is a
  **whole-app light-mode pattern**, not one component.
- **Why it matters:** The body-text rule is "dark navy `#17252A`, not pure
  black" — but a lot of *secondary* text is far lighter than navy and fails
  AA contrast on these pale backgrounds. Captions, credits and legal/footer text
  are exactly where a science product earns trust; if they're unreadable the
  product looks careless.
- **Recommendation:** Establish two named muted-text tokens with verified
  contrast (e.g. a "muted" that is `#2B7A78` Dark Teal for ≥4.5:1 on white, and a
  darker "muted-strong" navy for captions on pale-teal cards) and replace ad-hoc
  light greys. Audit every `text-*-400/500` grey on a light surface against
  WCAG AA at its actual size; bump footer/credit/caption text up one step.
- **Effort:** M

---

### F-04 — Dense thumbnail/list rows fall below the 44px touch-target rule
- **Screens:** m-species-dragonet.png, m-leaderboard.png, m-browse.png
- **Severity:** P1
- **Lens:** Mobile-first quality
- **Observation:** Several interactive elements look smaller than the required
  44×44px on mobile:
  - **Species "Photos" strip** (dragonet, 1.6x crop): the reference thumbnails
    are a tight horizontal row of small squares with even smaller "ADULT" badges
    and an "i" info dot in the corner — both the thumbnail tap and especially the
    corner "i" button read as well under 44px and sit close together.
  - **Leaderboard "Most-named species" rows**: 12 rows packed at a small row
    height; if rows are tappable they're borderline, and the "#1…#12" + dot +
    bar leave little finger target.
  - **Browse pagination** ("‹ Previous  Page 1 / 2  Next ›") and the per-card
    captions are small, closely-spaced text links at the page foot.
- **Why it matters:** The app is primarily mobile and aimed at casual users.
  Sub-44px targets in scrolling strips cause mis-taps (opening the wrong photo,
  the info popover instead of the image), which is exactly the kind of friction
  that makes a casual visitor give up.
- **Recommendation:** Enforce a 44px min hit area on every thumbnail, badge,
  info-dot, list row and pagination control (pad the tap target even if the
  visual glyph stays small). For the photo strip, give each thumbnail more height
  and move the "i" affordance to a clearly-separated, larger control. Re-check all
  three at 390px width.
- **Effort:** M

---

### F-05 — Two visual "worlds" (dark feed vs light pastel pages) with no shared bridge
- **Screens:** feed-02-rung1-shapegate.png, feed-05-reveal.png vs m-landing.png, m-signin.png, m-leaderboard.png, m-browse.png, m-species-dragonet.png, authed-06-account.png
- **Severity:** P2
- **Lens:** Consistency
- **Observation:** The feed surfaces (shape-gate, reveal) are **near-black dark
  glass** with neon-teal accents and white text; almost every other page is a
  **pale-teal-on-white** light theme. The card radius, shadow depth, control
  styling and even the verdict colour language differ between the two worlds. A
  user going feed → leaderboard → species → account experiences a hard theme
  switch each time with no transitional element (e.g. the headers themselves
  flip from dark/over-video to light). It isn't broken, but the two halves don't
  obviously belong to the same component library.
- **Why it matters:** Consistency is a trust signal. When the highest-traffic
  surface (the feed) and the supporting pages look like two different apps, the
  product feels less considered and the brand impression is diluted.
- **Recommendation:** Treat dark and light as one documented system: shared
  radius scale (`rounded-card` / `rounded-modal`), shared shadow tokens, shared
  control shapes, and one verdict-colour set that works on both backgrounds.
  Carry one bridging element across (e.g. the same eyebrow + heading treatment,
  same primary-button shape) so the transition reads as "same app, different
  surface" rather than a theme swap.
- **Effort:** M

---

### F-06 — Primary-button styling is inconsistent across screens
- **Screens:** m-landing.png, m-signin.png, m-signup.png, feed-05-reveal.png, m-notfound.png, authed-06-account.png
- **Severity:** P2
- **Lens:** Consistency
- **Observation:** The "primary action" is rendered several different ways:
  - Landing: "Start spotting" is a **dark-teal filled** pill; "Create a spotter
    profile" right under it is a **white outlined** pill.
  - Sign-in / sign-up: "Sign in" / "Create account" are **bright-teal (`#3AAFA9`)
    filled rounded bars** with dark text.
  - 404: "Back to live feed" is a **dark/teal filled** button, "Browse the
    archive" is an **outlined** button.
  - Reveal: "Save my finds — sign up free" is a **teal filled** pill; "Next →" is
    a **teal filled** pill of a different size/shape; "Edit answer" / "Archive"
    are bare text.
  So the same role ("primary CTA") appears as dark-teal-fill, bright-teal-fill
  and outlined depending on the page, and button text colour (dark vs implied
  white) also varies.
- **Why it matters:** A consistent primary-button shape/colour is how users learn
  "this is the thing to tap". Three primary styles makes the affordance less
  learnable and the app look less systematised.
- **Recommendation:** Pick ONE primary button (recommend bright-teal `#3AAFA9`
  fill with navy text, the sign-in style) and ONE secondary (outlined teal), name
  them as component classes, and apply uniformly. Reserve the dark-teal fill for
  a single documented case (e.g. on-light hero) rather than mixing it with the
  bright-teal fill for the same role.
- **Effort:** M

---

### F-07 — Type scale and heading weight differ between feed modals and content pages
- **Screens:** feed-02-rung1-shapegate.png, feed-05-reveal.png vs m-signin.png, m-leaderboard.png, m-terms.png
- **Severity:** P2
- **Lens:** Consistency
- **Observation:** The light content pages use a **large, heavy display H1**
  (e.g. "Sign in to continue spotting", "Spotter leaderboard", "Terms of
  Service") — a strong, consistent editorial scale. The dark feed sheets use a
  **much smaller, lighter heading register** ("WHAT SHAPE IS IT, ROUGHLY?" is a
  small uppercase tracked label; the reveal's effective title is "PEBL ID / Fish"
  at modest size). There is no single visible step where a feed modal's primary
  heading matches the content pages' H1/H2 weight, so the two contexts feel like
  different type systems.
- **Why it matters:** A shared type scale (`display`/`h1`/`h2`/`h3`/`eyebrow`)
  is what makes screens feel like one product. The mismatch is part of why the
  feed and the pages read as two worlds (see F-05).
- **Recommendation:** Map the feed modal headings onto the same named type tokens
  as the content pages (the modal "title" should be an `h2`/`h3`, not an
  ad-hoc small label), so heading sizes/weights are drawn from one scale across
  dark and light. Keep the uppercase eyebrow as the *secondary* label, not the
  only heading.
- **Effort:** S

---

### F-08 — Legal/content copy surfaces a `.vercel.app` URL and a plain-text contact
- **Screens:** m-terms.png, m-privacy.png, m-accessibility.png
- **Severity:** P2
- **Lens:** Trust & polish
- **Observation:** The Terms text states "The service is available at
  **fish-spotter.vercel.app**." A `.vercel.app` hosting URL in published legal
  copy reads as staging/temporary, not a finished product (and per project notes
  the intended canonical domain is a real domain, not the vercel subdomain).
  Across the legal set the support contact is the bare address
  "hello@pebl-cic.co.uk" (fine, but inconsistent with how the accessibility page
  frames a 2-working-day response SLA — the others don't). These are small but
  they're on exactly the pages a cautious user reads before trusting the app with
  an email + age.
- **Why it matters:** Legal/trust pages are graded hardest for credibility. A
  hosting-platform URL in the Terms quietly signals "side project".
- **Recommendation:** Replace the `vercel.app` reference with the canonical
  product domain (and keep it in sync across privacy/terms/accessibility). Make
  the support-contact treatment identical on all three legal pages (same label,
  same mailto, optionally the same response-time note).
- **Effort:** S

---

### F-09 — Long legal pages have no on-page navigation or readable max-width rhythm
- **Screens:** m-privacy.png, m-terms.png
- **Severity:** P2
- **Lens:** Copy & microcopy
- **Observation:** Privacy renders at ~18,850px tall and Terms at ~10,390px —
  these are very long single-column documents. The top sections are clean and
  readable (good eyebrow + H1 + "Last updated"), but there is **no table of
  contents, no jump-links, no "back to top"**, and the privacy page in particular
  is a wall of stacked tables/sections that is hard to scan on mobile. There's no
  visible last-section anchor or "return to app" affordance at the foot in the
  captured frames.
- **Why it matters:** GDPR/UK-GDPR pages are genuinely consulted (e.g. "what do
  you do with my data", "how do I delete my account"). Without navigation, a user
  with a specific question has to scroll thousands of pixels, which both annoys
  and erodes the trust the well-written content otherwise earns.
- **Recommendation:** Add a short sticky/inline table of contents (anchor links
  to the section headings) at the top of privacy and terms, and a persistent
  "back to top" / "Back to FishSpotter" control. Keep the existing section
  structure — it's good — just make it navigable.
- **Effort:** M

---

### F-10 — Header chrome is inconsistent (hamburger + wordmark vs back-link + wordmark)
- **Screens:** all (m-landing / feed / m-signin / m-leaderboard / m-browse / m-species-dragonet / authed-06-account / legal / m-notfound)
- **Severity:** P2
- **Lens:** Consistency
- **Observation:** The top bar shifts identity by context: the feed and landing
  show a **hamburger (☰) left + PEBL wordmark right**; the content/legal/species
  pages show a **"‹ Back to feed" / "‹ Back to FishSpotter" text link left +
  wordmark right**; some pages show both patterns' spacing differently. The
  back-link label itself varies ("Back to feed", "Back to FishSpotter", "Back to
  the feed", "Back to live feed" on 404). The PEBL wordmark is consistently
  top-right (good), but the left affordance and its wording are not standardised.
- **Why it matters:** Inconsistent global navigation makes the app feel less
  finished and makes "how do I get back / open the menu" a re-learned decision on
  each screen. The varied back-link wording is small but reads as unpolished.
- **Recommendation:** Standardise one header system: persistent wordmark right;
  a single left affordance rule (menu on top-level surfaces, one consistently
  worded back-link — e.g. always "Back to feed" — on detail pages). Unify the
  back-link copy app-wide.
- **Effort:** S

---

### F-11 — Browse archive grid is mostly featureless coloured blocks (looks like broken/placeholder thumbnails)
- **Screens:** m-browse.png
- **Severity:** P2
- **Lens:** Trust & polish
- **Observation:** The "Browse the wider PEBL clip library" grid is a long column
  of cards whose thumbnails are **flat green/teal/blue gradient rectangles** with
  no recognisable still frame, each with the same "ALGAPELAGO / Bideford Bay,
  North Devon, UK / <date>" caption. At a glance it reads like thumbnails failed
  to load or are placeholders, and every card looks near-identical, so there's no
  reason to pick one. (Whether these are real low-detail underwater frames or
  missing posters, the *effect* is "empty/placeholder".)
- **Why it matters:** The archive is meant to invite deeper exploration; a screen
  of identical coloured blocks gives no visual hook, looks unfinished, and
  undercuts the "credible science library" framing. It's also a consistency
  problem against the species page, which does show real photos.
- **Recommendation:** Use a representative video poster frame (or the detected
  subject crop) as each card thumbnail, with a subtle play affordance and, where
  known, a species/shape tag. If genuine frames are this low-contrast, add a
  duration badge + site/species chip so cards are visually distinguishable. Never
  ship identical flat-gradient tiles as the primary browse affordance.
- **Effort:** M

---

### F-12 — Pokédex empty/locked state is a very long grid of near-identical grey silhouettes
- **Screens:** m-profile-pokedex.png
- **Severity:** P2
- **Lens:** Consistency
- **Observation:** The collection grid (0 of 57) renders as ~57 faint grey
  silhouette tiles each labelled "Locked", stacked into a very tall column. The
  per-tile silhouettes are low-contrast grey-on-pale and many look alike, the
  "Locked" label repeats 57 times, and the whole section dwarfs the actually
  useful summary chips ("Crab 0/6, Fish 0/28…") at the top. As a first-run state
  it's a long scroll of sameness rather than an inviting "things to collect".
  Contrast and tile styling also differ from the crisp dark feed silhouettes,
  adding to the two-worlds feel.
- **Why it matters:** The pokédex is a core retention surface; the empty state is
  what a brand-new spotter sees, and right now it's a grey wall. Low-contrast
  silhouettes also raise the same legibility concern as F-03.
- **Recommendation:** Cap/collapse the locked grid (e.g. show locked counts per
  group + a few "next to unlock" teasers, expandable), raise silhouette contrast,
  and drop the repeated "Locked" label in favour of a single lock glyph per tile.
  Make the unlock mechanic visually inviting (silhouette → photo reveal) rather
  than a uniform grey field.
- **Effort:** M

---

### F-13 — Decorative photo/credit microcopy is too small and inconsistently formatted
- **Screens:** m-landing.png, m-species-dragonet.png, m-browse.png
- **Severity:** P3
- **Lens:** Copy & microcopy
- **Observation:** CC attribution appears in several formats and all very small:
  landing catalogue "Reference photos via iNaturalist & Wikimedia contributors,
  under Creative Commons licences."; species photo "© Xavier Rufray, some rights
  reserved (CC BY-NC)"; gallery thumbnails carry their own corner badges. The
  intent (proper attribution) is correct and good, but the formatting/wording is
  not standardised and the type is at the bottom of the legibility range.
- **Why it matters:** Consistent, legible attribution is both a licence
  obligation and a credibility cue for a science product. Inconsistent formats
  look ad-hoc.
- **Recommendation:** Define one attribution microcopy pattern ("© {author} ·
  {licence}") and one minimum legible size/contrast, and apply it to landing,
  species and gallery uniformly.
- **Effort:** S

---

### F-14 — Verdict/notice colour language not unified across reward + system states
- **Screens:** feed-05-reveal.png, authed-06-account.png, m-leaderboard.png
- **Severity:** P3
- **Lens:** Consistency
- **Observation:** Beyond F-01's specific amber instances, there is no single
  visible "semantic colour" system tying together correct/close/wrong (reveal),
  notice/warning (account verify banner), and emphasis (leaderboard
  "#1 Anjali" highlighted row uses a soft yellow-tinted row). Each semantic moment
  picks its own treatment. (The leaderboard top-row highlight is mild but is yet
  another yellow-family accent appearing without a named token.)
- **Why it matters:** A documented `correct/incorrect/pending/notice` token set
  used everywhere is what stops these one-off colours accumulating. This is the
  systemic root behind F-01 and F-02.
- **Recommendation:** Stand up the named semantic-token set in
  `tailwind.config.ts` (each with a `DEFAULT` bg + `ink` text), then refactor the
  reveal chip, the account banner, and the leaderboard highlight row to draw from
  it. Document which token = which meaning so future screens don't reinvent.
- **Effort:** S
