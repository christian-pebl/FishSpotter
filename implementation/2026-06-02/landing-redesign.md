# Landing page redesign — "underwater" hero (2 Jun 2026)

Full visual redesign of the marketing landing page (`/`, `src/app/page.tsx`).
The previous page was correct but flat: three text blocks on a pale-teal
gradient, no imagery, no motion, no proof the product is real. For a product
whose entire value is gorgeous underwater footage and species, the landing
page showed none of it.

## What shipped

A server component (`src/app/page.tsx`) that fetches live data via Prisma and
composes six client/presentational pieces under `src/components/landing/`:

| Piece | File | What it does |
|---|---|---|
| Underwater backdrop | `UnderwaterBackdrop.tsx` | Depth gradient + god-ray light shafts + drifting tinted marine silhouettes (the CC0 `/public/silhouettes` gate assets, tinted via `mask-image` + `backgroundColor:currentColor`) + rising bubbles. Pure CSS animation. |
| Hero preview | `HeroPreview.tsx` | A real, muted, looping snippet in a rounded frame with a self-playing faux "pick the species" overlay that scans candidate chips and locks onto the reference answer, then resets. "The app plays itself" in ~5s. |
| Live stats | `StatsBand.tsx` | clips / identifiable-species / spotters, counting up on scroll into view. |
| How-it-works | `StepCards.tsx` | Spot → Compare → Streak, stroked-teal icons, corner silhouette watermark, dotted loop path, Framer scroll-in stagger. |
| Species marquee | `SpeciesMarquee.tsx` | Auto-scrolling strip of real cached `SpeciesImage` photos ("what you'll find"), per-card `© Author · LICENCE` credit, pause on hover. |
| In-view hook | `src/lib/useInView.ts` | Shared IntersectionObserver hook; pauses always-on animations + the hero video when scrolled off-screen. |

## Data flow (all live, server-side)

- **Featured snippet**: `findMany(take:25)` of snippets with a `staffAnswer`,
  ordered `recordingDatetime desc, id desc` (deterministic), then pick the
  first whose label resolves to a catalogue species (skips junk like "Fish").
- **Distractors**: shape-aware — prefer catalogue species of the *same*
  `shapeClass` as the answer (so a Pollack never gets "Scooter" as a chip),
  falling back to the wider catalogue only when a class is too small. Derived
  from `src/data/species-traits.json`; fully deterministic (no `Math.random`),
  so SSR and client agree.
- **Stats**: `snippet.count()`, `user.count()`, and the 54-species catalogue.
- **Marquee**: `SpeciesImage` rows ordered curated-first, deduped one per
  species (cap 14), common-name mapped via traits.

## Design / brand compliance

- PEBL palette only; stroked-teal SVG icons (no emoji); named tokens
  (`rounded-card`, `shadow-glow` / new `shadow-glow-strong`).
- Colorblind-safe: the locked-answer chip uses the `correct` token **plus** a
  redundant checkmark (shape cue, not colour-only).
- `prefers-reduced-motion`: all CSS animation is neutralised by the global
  block in `globals.css`; the JS-driven motion (chip cycle, count-up) guards
  on `matchMedia` and shows a sensible static state.
- 44px touch targets on CTAs, the "Browse the archive" link, and footer nav.
- CC-BY/BY-SA: per-card visible `© Author · LICENCE` credit + a blanket
  credit line with source/licence links.
- Off-screen pause: hero video, backdrop, and marquee stop animating when
  scrolled out of view (`useInView` + `.fs-paused` utility in `globals.css`).

## New shared additions

- `tailwind.config.ts`: `boxShadow["glow-strong"]` for the CTA hover glow.
- `src/app/globals.css`: a "Landing page: underwater motion primitives" block
  (`fs-drift` / `fs-bubble` / `fs-shaft` / `fs-marquee` / `fs-float`) +
  `.fs-paused` off-screen pause utility.
- `src/components/Header.tsx`: fixed a stale `eslint-disable-next-line` that
  sat above a comment instead of the `<img>`, so `lint:tokens` (the
  `--max-warnings 0` gate) now passes clean.

## Verification

- `tsc --noEmit` clean; `npm run lint:tokens` exit 0; `npm run build` clean
  (all 21 routes).
- DOM-verified in the preview: shape-aware chips, live stats, video play/pause
  on visibility (desktop plays, mobile correctly paused below the fold),
  backdrop/marquee off-screen pause, 44px footer links, attribution parser
  across iNat + Wikimedia formats.

## Known follow-up (editorial, not code)

Only 2 of 54 species have a `curated=true` reference photo, so the marquee
(and the MCQ/wizard reveals) mostly show unvetted iNat shots. The marquee
leads with curated photos (best code can do); the real fix is human photo
curation via the `overrides` block in `src/data/species-images.json` +
`db:refresh-images`. Tracked as a separate task.
