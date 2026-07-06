# Dismiss / reopen / minimize audit (2026-07-06)

Christian reported: on the Rung-3 "Which one is it? Tap to compare" grid, tapping
a species opens the guide card, but after dismissing the card the species tiles
can't be opened again — and closing the whole selector sometimes lands on a
sparse floating panel with **HIDE and SKIP stacked on top of each other**
(screenshot in the session). This audit traced both, then swept every
open/close/minimize/back-and-forth surface in the app.

## Fixed in this commit

### F1 — Rung-3 grid dead after first preview (the reported bug) ✅
**Root cause:** `TileGate`'s tile lock-in guard. `commitSelect` set
`committing = <tile key>` for the 170ms press-and-settle animation and **never
cleared it**. Invisible on Rungs 1–2 (picking advances the rung, the component
unmounts, state dies), but on Rung 3 `onSelect` opens `SpeciesGuidePopup` *over
the still-mounted grid* — so after closing the card, `if (committing) return`
silently swallowed **every tap on every tile** until the whole selector was
closed and re-entered. The tapped tile even stayed teal-highlighted, reading as
"selected" while dead. Reduced-motion users never hit it (that path skips the
lock), which is likely why it survived testing.
**Fix:** release the lock when the select fires (`setCommitting(null)` inside
the timeout) + clear the timer on unmount. Double-tap protection during the
170ms confirm window is preserved. (`TileGate.tsx`)
The popup itself was verified clean — Back button, backdrop tap, and Escape
(correctly guarded against the photo-lightbox owning the keypress) all return
to the grid.

### F2 — sparse panel with HIDE/SKIP stacked in the corner ✅
**Root cause:** the floating panel's Hide pill is absolutely positioned
(`right-1.5 top-1`) with no vertical space reserved for it; the content starts
at `pt-1`. In the sparse pre-answer state (after closing the Spot It gate) the
first content row was the right-aligned standalone **Skip** row — landing
exactly under the Hide pill. Guess-mode's submit arrow had the same latent
collision one row earlier.
**Fix:** (a) reserved header clearance (`h-8` spacer) at the top of the
pre-answer branch, so no first row can slide under the header controls;
(b) removed the standalone Skip row and folded Skip into the actions row's
right cluster (after "Where is this?", `ml-auto` when there's no location) —
the panel now reads as one compact action bar `[Identify] … [Where is this?]
[Skip]` instead of a hollow box with orphaned corner buttons. Reveal state
untouched. (`FeedCard.tsx`)

Verified: `tsc` clean · 371/371 vitest · `lint` + `lint:tokens` clean.

---

## Remaining findings (swept, verified in code)

> **Update 2026-07-06:** D1 and D2 are now **fixed** (same commit series as the
> P0 rescore fix): the tap-to-identify catcher returns whenever the panel is
> hidden pre-answer (restoring the input in guess mode rather than stacking the
> shape gate), and BodyShapeGate is gated on `!myAnswer` + the comparison
> closes on pick, so a compare-submit lands on the reveal. D3+ remain open.

### P1 — close destroys the way back in

**D1. Guess-mode + Hide = a card with no way to answer (mobile). ✅ FIXED**
`flowReducer` has no action that clears `guessMode` (`lib/idflow/flow.ts:96–104`).
After Identify → "Pick from a list" → Hide (`FeedCard.tsx:1428–1439`), every
re-entry affordance is gone: the tap-to-identify catcher requires `!guessMode`
(`:1067–1073`), the docked bar requires `!hasTappedIdentify` (latched true at
flow entry, `:1079,1323`), and the only remaining toggle is the desktop-only
`H` key. On a phone the card is a looping video with no visible way to answer
until reload. **Fix:** clear `guessMode` when the panel hides, or drop
`!guessMode` from the catcher's guard (tapping the clip pre-answer should
always reopen the flow).

**D2. Submitting from Rung-2 "Compare side by side" buries the reveal. ✅ FIXED**
`BodyShapeGate` renders with no `!myAnswer` guard (`FeedCard.tsx:1897`, unlike
CandidateGate at `:1919`) and `SpeciesComparison`'s `comparing` flag isn't
cleared by `onPick` (`BodyShapeGate.tsx:86,131–138`). Submitting from the
comparison (live for e.g. the starfish group) leaves both overlays mounted
while the reveal panel is suppressed by `!bodyGateOpen` (`:1372`) — the user
must close two layers to find their score, violating the "reveal must be
immediate" rule. **Fix:** add `!myAnswer` to the BodyShapeGate condition +
`setComparing(false)` in `onPick`.

### P2 — leaky but recoverable

**D3. Gates outlive the active card.** No `isActive` guard on the gate renders
(`FeedCard.tsx:1876,1897,1919`): scroll to the next clip and the old card's
minimized dock bubble — `position: fixed` z-40 (`TileGate.tsx:602–628`) — stays
on screen over the new clip, visible but dead (the section is `inert`); two
cards' bubbles can stack. TileGate's window keydown + body scroll-lock also
stay live: Escape on clip 2 closes clip 1's gate, and interleaved
save/restore can strand `body{overflow:hidden}`. **Fix:** suspend listeners/
lock and hide the bubble when the card is inactive (reducer state survives, so
scroll-back still resumes).

**D4. Escape in the photo lightbox also tears down the IdGuideSheet.**
The sheet's Escape handler has no is-a-modal-on-top guard
(`IdGuideSheet.tsx:105–107`) and the Lightbox neither stops propagation nor
registers in capture (`SpeciesGallery.tsx:501–533`). One Escape closes sheet +
gallery + lightbox. Both correct patterns already exist in-code (InfoPopover's
capture+stopPropagation `:371–381`; TileGate's aria-modal guard `:183`) — copy
either.

**D5. IdGuideSheet close is always a full restart, triggerable by a backdrop
mis-tap.** Backdrop click / `H` / Escape all fully unmount wizard + chat
(`IdGuideSheet.tsx:211–213,96–107`), losing `stepIdx`/`selections`
(`IdGuideWizard.tsx:164–165`) and the whole chat (`IdGuideChat.tsx:30–39`) —
while `chipSelection` is deliberately lifted to survive (`:38`), showing the
intended pattern. **Fix:** lift wizard step + chat messages the same way;
consider ignoring backdrop-click while a chat is in flight.

**D6. "Edit answer" resurrects the tile grid instead of the edit input.**
Nothing clears `spotItActive` on submit; `editAnswer` nulls `myAnswer`
(`useCreatureQuiz.ts:365–372`), so a tile-flow answer's "Edit answer" re-mounts
the CandidateGate rather than the prefilled text input the button implies.
**Fix:** clear `spotItActive` (or dispatch into guess mode) on the edit path.

**D7. SpeciesComparison's focus/lock effect keyed on an unstable `onClose`.**
`[onClose]` dependency + inline arrow from BodyShapeGate (`SpeciesComparison.tsx:104–142`,
`BodyShapeGate.tsx:137`): every parent re-render re-runs focus-grab — keyboard
users comparing card 3 get snapped back to card 1. **Fix:** `useCallback` +
hold the handler in a ref.

### P3 — polish

- **D8.** FeedPlayer's swipe-hint "seen" flag is written on mount before the
  hint ever shows (`FeedPlayer.tsx:158–163`) — on a 1-clip feed it's suppressed
  forever without appearing. Persist only after actually showing.
- **D9.** OnboardingTour: a reflexive Escape on step 1 = permanent, server-side,
  cross-device dismissal (`OnboardingTour.tsx:47–60`), and no replay affordance
  exists anywhere. Make Escape a session-snooze, or add "Replay tour" under
  Account.
- **D10.** After the first Identify tap, the docked bar (with the info-pin and
  the fish-locate ping, its only home) is gone for that card
  (`FeedCard.tsx:1215,1229–1364`) — re-show the bar when the panel is collapsed
  pre-answer.
- **D11.** No overlay integrates with browser history (zero pushState/popstate
  in components): Android back with the sheet/map/lightbox open navigates away
  and loses all flow state. Scoped fix: history entries for the three true
  full-screen dialogs only.
- **D12.** AvatarMenu closes only via click-away (no Escape, unlike
  SettingsMenu); the map-from-popover open chain restores focus to an unmounted
  button; `MCQCandidatePicker` + `CandidateStrip` are dead code that keep
  re-entering audits — delete.

### Verified clean (no action)
MapModal open/close cycles; SideMenu trap/restore; SpeciesGallery
lightbox↔popover interplay and index resets; the one-shot coach-mark
persistence scopes (`tapHintSeen`, `inputHintSeen`); per-card reducer state
correctly resuming a gate when scrolling away and back (the good half of D3).

## Suggested order
D1 and D2 are the same class of bug as F1 (a close path that strands state) and
each is a few lines — do them next. D3/D4 are the multi-overlay hygiene pass.
D5–D7 improve the wizard/edit loops. P3s are opportunistic.
