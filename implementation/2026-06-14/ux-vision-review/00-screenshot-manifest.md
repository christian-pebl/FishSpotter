# Screenshot Manifest — Vision UX Review (14 Jun 2026)

40 screenshots captured via Playwright against the **live** site
(fish-spotter.vercel.app). `m-` = mobile (390x844), `d-` = desktop (1280x800).
All under `shots/`.

## Landing & onboarding
- `m-landing.png` / `d-landing.png` — landing page, full (hero, demo, stats, how-it-works, catalogue, about, footer).
- `authed-01-onboarding-or-feed.png` — first-run onboarding tour, step 1 ("Pick the species in 5 seconds"), with a verify-email banner.
- `authed-01b-tour-step2.png` / `authed-01b-tour-step3.png` — onboarding tour steps 2 (Compare) & 3 (Streak).

## Core identify loop (guest)
- `feed-01-idle.png` / `d-feed-01-idle.png` — feed idle, "Tap to name species" prompt, metadata HUD bottom-left.
- `feed-02-rung1-shapegate.png` / `d-feed-02-shapegate.png` — Rung 1 shape gate ("What shape is it, roughly?", 7 silhouette tiles).
- `feed-03-rung2-bodyshape.png` — Rung 2 fish body-shape sub-split (Torpedo/Long & slender/Eel-like/Bottom scooters).
- `feed-04-rung3-candidates.png` — Rung 3 candidate species tiles ("Pick Pollack", etc.) + "It's just a Fish" / "None look right" / "Pick from a list".
- `feed-04b-species-flashcard.png` — species flash-card popup (photos + "This is my pick: Pollack").
- `feed-06-minimized.png` — minimized state: magnifier bubble bottom-right + metadata HUD bottom-left.
- `snippet-01-challenge.png` — single-snippet detail page (`/feed/[id]`) "Spotter Challenge" with type-in.

## Reveal & reward
- `feed-05-reveal.png` — guest reveal: "You said Pollack ≈ Close +1", "PEBL ID: Fish", community split, the guest "Save my finds" sign-up nudge.
- `snippet-02-reveal-correct.png` — single-snippet correct reveal ("Crab", Correct +2).
- `authed-03-reveal-authed.png` — signed-in reveal (points/streak, no guest nudge).
- `feed-07-map-modal.png` — "Where is this?" map modal.

## Auth & account
- `m-signin.png` / `d-signin.png` — sign-in form.
- `m-signup.png` — sign-up form (email/name/password/age/terms).
- `authed-00-signup-filled.png` — sign-up form filled with password-strength hints + age + terms.
- `m-forgot-password.png` — forgot-password page.
- `authed-04-menu.png` — signed-in nav menu.
- `authed-06-account.png` — account / settings page (data export, legal links).

## Discovery, community & collection
- `m-browse.png` / `d-browse.png` — archive/browse grid.
- `m-leaderboard.png` / `d-leaderboard.png` — community leaderboard.
- `m-species-dragonet.png` / `d-species-dragonet.png` — species page (dragonet).
- `m-species-crab.png` — species page (edible crab).
- `m-species-starfish.png` — species page (common starfish).
- `m-profile-pokedex.png` / `d-profile-pokedex.png` — spotter profile + pokédex collection (0 of 57, all locked — representative; 0 unlocks exist DB-wide).
- `authed-02-feed-authed.png` — feed as a signed-in user.

## Content, legal & errors
- `m-privacy.png` — privacy policy.
- `m-terms.png` — terms.
- `m-accessibility.png` — accessibility statement.
- `m-notfound.png` — 404 / not-found page.
