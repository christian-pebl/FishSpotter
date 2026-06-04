# Diagnostic-mark placement QA — pass 2 (4 Jun 2026)

Follows the pass-1 fix of the 15 "gap" species. This pass clears the remaining
backlog from `species-image-fix-report.md` (the parallel session's "24 still need
a manual admin pass"), minus the 11 already fixed in pass 1, plus the one
remaining duplicate-label content bug.

## Scope (14 species)
Rock goby, Great spider crab, Velvet swimming crab, Pollack, Flat top shell,
common Dragonet, Thick-lipped grey mullet, European sea bass, Shanny, Common
limpet, Butterfish, Sand goby, Fifteen-spined stickleback, and **Cancer pagurus**
(duplicate "Pie-crust shell edge" mark).

NB the parallel session had already trimmed the 6-mark redundancy species (rock
goby, butterfish, horse mackerel, sea bass) down to 3 marks each, so the only
duplicate left in the DB was Cancer pagurus.

## Method (same loop as pass 1)
Render current marks with the exact `AnnotatedSpeciesPhoto` geometry
(`scripts/lib/mark-overlay.ts`) → one vision agent per species returns per-mark
verdict (`good` / `adjust` x,y,r / `drop`) → apply centrally → re-render →
supervisor eyeball.

## Result
- **40 mark coords updated, 2 marks deleted** (`mark-corrections-2.json`).
  - Dropped: Sand goby "Pelvic-fin sucker" (ventral, not visible in a lateral
    photo) and Cancer pagurus duplicate "Pie-crust shell edge". Remaining marks
    re-sequenced 0..N-1.
- Supervisor pass caught two agent errors and hand-fixed them:
  - **Butterfish** — agent traced the ribbon backwards; head is on the RIGHT, so
    the "head" ring had landed on the body. Re-placed all 3.
  - **Sand goby** — rings sat left of the body; nudged onto the mid-body.
- All marks now on-feature. DB live on prod. Census: 57 marked species, **0
  duplicate labels**.
- Review artifact: `mark-renders-2/_CONTACT-SHEET.png`.

## Recurring lesson
Orientation is still the main failure mode (butterfish this pass, saithe in pass
1). Trust the agents for "which feature / is it visible", but a human must eyeball
the final render for head/tail flips before sign-off.

## Open (unchanged)
The catalogue's remaining marked species (~42) were aligned by the parallel
session's relocate sweep and not independently re-QA'd here; spot-check
opportunistically. All marks remain DRAFTS pending Christian's marine-biology
sign-off (contact sheets: `mark-renders/` pass 1, `mark-renders-2/` pass 2).
