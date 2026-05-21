# Accessibility Statement

**Last updated:** 2026-05-21 · **Version:** v0.1 (engineering draft — pending legal review)

PEBL FishSpotter is committed to making this experience usable by as many people as possible. This page documents our current accessibility posture and the known gaps we're working on.

## Conformance target

We target **WCAG 2.1 Level AA** for all user-facing surfaces.

## Audio descriptions and captions (WCAG 1.2.2 / 1.2.5)

FishSpotter underwater snippets are **silent video** — they contain no spoken audio, no music, and no sound effects. Under WCAG 1.2.2, silent video is exempt from the captions success criterion: there is no audio content to caption.

We still surface relevant scene context (site, deployment, recording date, depth, and the post-answer staff identification) in text alongside each clip so screen-reader users get the same information visual viewers do.

## Keyboard navigation

- Every interactive control is reachable via Tab in DOM order.
- A skip-link at the top of every page jumps directly to the main content (try pressing Tab as the first action).
- Escape closes every dialog and drawer; focus returns to the trigger.
- The species-identification quiz fully supports keyboard submission.

## Screen-reader support

- Quiz outcomes are announced via an aria-live region.
- The species input has a programmatic label.
- Heading hierarchy is consistent (one `<h1>` per page).
- Image alt-text is set for content images; decorative images are marked `aria-hidden`.

## Visual

- Designed colour palette has been audited for WCAG 2.1 AA contrast where the colour conveys meaning.
- Animations honour `prefers-reduced-motion` on a best-effort basis.

## Known gaps

- A small number of decorative animations don't yet check `prefers-reduced-motion`. We're sweeping these in a forthcoming release.
- Touch targets on a few legacy controls are below the 44×44 CSS-pixel recommendation. Migration in progress.

## Contact

If you encounter an accessibility issue, please email [hello@pebl-cic.co.uk](mailto:hello@pebl-cic.co.uk) and we'll respond within 2 working days.
