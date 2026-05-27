# Post-push smoke checklist (fish-spotter.vercel.app)

Run after any push that touches `src/components/FeedCard.tsx`, `src/components/MCQCandidatePicker.tsx`, `src/components/IdGuide*.tsx`, or `src/app/feed/**`. Takes ~60 seconds.

## Build verification

1. Vercel deployment for the pushed commit shows "Ready" (no build failures).
2. No new warnings in the build log (Next.js, Prisma, ESLint).

## Feed page

3. Visit `/feed` signed in. A card loads with the candidate picker thumbnails painted, no empty tiles.
4. Press `H`. The candidate panel collapses to the "Name this species" pill.
5. Press `H` again. The panel re-expands to the candidate grid.
6. Mobile viewport (Chrome devtools 375px width): the bottom-gradient renders behind the panel.
7. Desktop viewport (>=768px): the bottom-gradient does NOT render (panel is centred, gradient was just obscuring the seabed).

## IdGuide wizard

8. Click "Help me identify" on any card. The sheet opens at 96vw x 94vh.
9. Step through the wizard: body shape -> size -> **fins/tail (new step, added 27 May)** -> habitat -> markings -> behaviour. The step counter should show 6 total steps.
10. Reach FinalReveal. For pollack (if it appears in candidates) 3 numbered rings render on the reference photo with a legend below. For bib or cod, NO rings render and the thumb-strip + field-note path shows instead (their photos are awaiting curation per E1).

## Quiz submission

11. Submit an answer. The reveal panel shows points: 2 for a correct match against the reference, 1 for a no-reference snippet (pending bonus), 0 for an unmatched guess.

## Console / network

12. No 401/500/CORS errors in DevTools console.
13. `/api/snippets/[id]/quiz` returns 200 with `candidates` and `fallback` keys.

## When something fails

- Build failure on Vercel: revert the offending commit (`git revert <sha> && git push`), open an investigation ticket, do not patch forward against a broken main.
- Behavioural regression (steps 3-13): note which step failed in a follow-up issue, do NOT immediately revert unless production is unusable. Most UX regressions are tunable without rollback.
- 500s from `/api/snippets/.../quiz`: check the Vercel function logs for the snippet ID; most often a missing `SpeciesProbability` or `SpeciesNameMap` row. The route falls back gracefully, so a 500 indicates a real bug.
