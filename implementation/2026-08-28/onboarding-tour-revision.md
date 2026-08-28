# Onboarding tour: revision plan

**Date:** 28 Aug 2026
**Trigger:** Christian's review. The current tour is a small modal with a hand-drawn
mock of the app inside it. The mock does not match what the app now looks like, and
the tour stops before the parts that actually need explaining (the rung flow, the
side-by-side compare, the species page, the reveal, pebbles).

---

## 1. What exists today

| File | Lines | What it does |
|---|---|---|
| `src/components/onboarding/OnboardingTour.tsx` | 134 | A `max-w-md` centred modal, 3 slides of copy, focus-trapped via `useModalFocus`, dismissal POSTs `/api/account/onboarding`. |
| `src/components/onboarding/TourPreview.tsx` | 330 | A 240px-tall **hand-built replica** of a feed card: real velvet-crab clip, but fake `Identify` pill, fake 4-chip grid, fake reveal histogram, fake streak flame, scripted cursor. |
| `src/app/api/account/onboarding/route.ts` | 28 | Sets `User.onboardedAt`. Correct, keep as is. |
| `src/app/feed/page.tsx` | | Computes `needsTour = onboardedAt === null`, renders `OnboardingTour` alongside `GuestGate` / `GuestSavePrompt` / `VerificationBanner`. |

### Why it drifted

`TourPreview` is a **parallel implementation** of the feed card. Nothing links it to
the real components, so every change to the real flow silently invalidates it. It is
already wrong in five ways:

1. The four-chip grid it shows is the retired MCQ fast path, not the Spot It rung flow.
2. There is no shape gate, no body-form sub-split, no photo candidate grid, no
   side-by-side comparison, no species guide popup. That is the whole product.
3. Its reveal shows a `Reference: Velvet crab` badge. The reference panel was
   **removed** from `RevealResult` (reveal is community-answers only, the crowd is
   the authority). The tour teaches a model the app no longer uses.
4. It shows `+7 pebbles` as static text, not the real `PebbleBag` fly-in.
5. Step 3 sells "build a streak", but the Tide streak was deliberately **not** made a
   scoring multiplier. The scoring story (pebbles, rarity, first sighting, consensus)
   is never explained anywhere in onboarding.

**Conclusion: do not patch `TourPreview`. Delete it.** A second copy of the UI will
drift again. The tour must run over the real components.

---

## 2. The real flow the tour has to teach

Read from `src/lib/idflow/flow.ts` (the tested reducer) and its call sites in
`FeedCard.tsx:2000-2100`:

```
tap the clip            -> dispatch openShapeGate
Rung 1  ShapeGate       -> 9 silhouette tiles + "Compare all N species" + "Skip to guess"
Rung 2  BodyShapeGate   -> only when bodyFormConfigFor(shape) exists
                           crab: Broad oval crabs / Triangular, long legs (spider) / In a shell (hermit)
Rung 3  CandidateGate   -> photo tile grid (max 24), "Compare side by side" -> SpeciesComparison
        SpeciesGuidePopup -> the full species page + "This is my pick"
Rung 4  RevealResult    -> community histogram, pebbles earned, first-sighting flag, unlock
        PebbleBag         -> header total, fly-in burst
```

All of these are shipped, tested components. The tour's job is to point at them, not
to redraw them.

---

## 3. The revision

**Full-screen spotlight coach marks over the live app.** No preview window. The dim
layer covers the viewport, a rounded-rect hole is punched around the current target,
and a ghost cursor demonstrates the tap. The user then makes the real tap, on the
real control, and the tour advances off the real state change.

This is the only design that cannot drift: every highlighted pixel is the shipping UI.

### 3.1 New modules

| File | Purpose |
|---|---|
| `src/components/onboarding/Spotlight.tsx` | Fixed full-screen SVG. One mask: black backdrop rect plus white rounded rect equals the hole. Framer-animates the hole between steps, so it morphs from the video, to the tile grid, to the pebble bag. Dim area takes pointer events (blocks stray taps); the hole is `pointer-events: none` so the real control underneath stays live. |
| `src/components/onboarding/GhostCursor.tsx` | The arrow SVG already in `TourPreview` (lines 300-305), lifted out. Modes: `click` (travel, scale-down press, ripple) and `scroll` (short vertical travel with a wheel wiggle, for the comparison and species-page beats). |
| `src/components/onboarding/TourCaption.tsx` | The step card: eyebrow, title, body, step dots, Back / Skip / Next. Auto-places on the side of the anchor with the most room; clamps to the viewport. |
| `src/components/onboarding/useAnchorRect.ts` | Live `getBoundingClientRect` for a `[data-tour="..."]` selector, re-measured on `ResizeObserver`, scroll, resize and rAF. **Required:** the gates are draggable and pointer-resizable (`TileGate` `startResize`), so a rect measured once goes stale the moment the user drags the panel. |
| `src/lib/tour-bus.ts` | Tiny `CustomEvent` bus, same pattern as `src/lib/pebble-bus.ts` and the existing `fs-gate` event `TileGate` already dispatches. |
| `src/components/onboarding/tour-steps.ts` | The declarative step list (below). |

`OnboardingTour.tsx` is rewritten as the controller (step index, advance signals,
completion POST). `TourPreview.tsx` is deleted.

### 3.2 Anchors to add

One `data-tour` attribute per target. No logic changes to the host components.

| Attribute | Component | Step |
|---|---|---|
| `data-tour="clip"` | `FeedCard` video wrapper | 1 |
| `data-tour="identify"` | `FeedCard` tap catcher / Identify button (`FeedCard.tsx:1118`, `:1382`) | 1 |
| `data-tour="tiles"` plus `data-tour-tile={key}` | `TileGate` grid and each tile | 2, 3, 4 |
| `data-tour="compare"` | `TileGate` `compare` button | 4 |
| `data-tour="comparison"` | `SpeciesComparison` card row | 4 |
| `data-tour="species-guide"` | `SpeciesGuidePopup` body | 5 |
| `data-tour="commit"` | its "This is my pick" button | 5 |
| `data-tour="reveal"` | `RevealResult` community panel | 6 |
| `data-tour="pebbles"` | `PebbleBag` in `Header` | 7 |

`TileGate` gets one prop pass-through so `ShapeGate` / `BodyShapeGate` /
`CandidateGate` all inherit the tile-level attribute for free.

### 3.3 The advance signal

`FeedCard` gets a single `useEffect` that watches `flow` plus `myAnswer` and emits on
change. No reducer changes, no new state, about 15 lines:

```
emitTour("identify-opened")   when shapeGateOpen goes true
emitTour("shape-picked")      when selectedShape changes and the gate closes
emitTour("form-picked")       when formSeed is set
emitTour("candidates-open")   when spotItActive goes true
emitTour("committed")         when myAnswer first becomes non-null
```

`SpeciesComparison` and `SpeciesGuidePopup` each emit one open event on mount.

Each tour step declares `advanceOn`, one of those event names or `"next"`. Steps 6 and
7 are Next-driven because there is no further app transition to wait for.

### 3.4 The six steps

**The tour ends at the consensus.** Pick a species, watch the community histogram
come up, done. Pebbles are a coda, not a step (3.4.1).

| # | Anchor | Copy (draft) | Cursor | Advances on |
|---|---|---|---|---|
| 1 | `clip` | "Every clip is real footage from a PEBL seabed survey. Tap it to start identifying." | click on centre | `identify-opened` |
| 2 | `tiles` (gate open), cursor lands on `tile:crab` | "Start with the shape. You do not need the name yet." | click on the crab tile | `shape-picked` |
| 3 | `tiles` (Rung 2) | "Now narrow it. Broad crab, long-legged spider crab, or one living in a borrowed shell?" | click | `form-picked` |
| 4 | `tiles` (Rung 3) then `compare` | "These are the look-alikes. Scroll them, and put two side by side when you cannot split them." | scroll, then click Compare | `comparison-opened` |
| 5 | `species-guide` | "Everything known about the species: photos, the marks that give it away, where it lives. Happy? Lock it in." | scroll, then click commit | `committed` |
| 6 | `reveal` | "No answer key. The crowd is the authority: here is what every other spotter called it." | none | Done |

Steps 3 to 6 read their nouns from the **actual** selection, not from hard-coded crab
copy, so a user who picks Fish at step 2 still gets a coherent tour.

Step 6 is the last required beat. Its button reads **Done**, not Next, and pressing it
POSTs `/api/account/onboarding` and takes the dim layer down. The a11y announcement is
"Step N of 6".

### 3.4.1 The pebbles coda (optional, non-blocking)

Pebbles get a **hint, not a step**. The tour is already complete when it appears, so a
user who ignores it loses nothing and never sees the tutorial again.

- Fires once, on step 6's Done, and only for a user who just finished the tour.
- Rides the existing `pebble-bus` fly-in: the burst already animates into the
  `PebbleBag` on commit, so the hint lands on a control the user has just watched move.
- Renders as a small teal callout tethered to `data-tour="pebbles"` in the header. One
  line: "You earned N pebbles. Rare finds and first sightings pay more." Plus a
  dismiss, and the whole callout is a link to `/pebbles`.
- **No dim, no spotlight, no focus move, no blocking.** `pointer-events` only on the
  callout itself. The feed stays fully usable behind it, and swiping to the next clip
  dismisses it.
- Self-dismisses after roughly 8 seconds, or on the next scroll. Remembered in
  `localStorage` so it never returns.
- Under reduced motion it appears without the pulse and holds until dismissed rather
  than auto-hiding on a timer.

### 3.5 Pinning the tutorial clip

For the crab-specific ghost-cursor beat to make sense, the first card must be a crab.
In `feed/page.tsx`, when `needsTour`, hoist the known tutorial snippet
(`KEL33_2026-04-23_08-01_velvetcrab...`, the same clip the landing hero uses) to index
0 after `orderFeed`.

Guard: if the clip is missing or blocklisted, fall back to the normal order and drop
the tour to shape-agnostic copy plus a cursor that circles the tile grid rather than
pointing at one tile. The tour must never point at a tile that is wrong for the clip
on screen.

---

## 4. Things that will bite

1. **z-index.** Today: gates `z-40`, `GuestGate` `z-50`, tour `z-[80]`,
   `SpeciesGuidePopup` `z-[90]`, gallery lightbox `z-[100]`. The dim has to sit above
   the tallest thing it dims, so the spotlight goes to `z-[110]` and the caption to
   `z-[111]`. The cutout is what keeps the target usable, not a lower z-index.
2. **Focus is the opposite of today's contract.** The current tour is deliberately
   focus-trapped (`useModalFocus`, a fix from the 2 Jun design audit). A coach-mark
   tour must NOT trap focus, or the user cannot reach the control it is pointing at.
   Replace with: caption is a non-modal `role="region"` with `aria-live="polite"`
   announcing "Step N of 6", Escape skips the tour, focus is never stolen, and the dim
   is `aria-hidden` while the spotlit subtree is not. Flag this explicitly in the PR
   so it does not read as a regression of the audit fix.
3. **Divergence.** The user can tap a tile the tour did not point at, hit "Skip to
   guess", or close the gate. Rule: advance on the *category* of transition, never on
   a specific value, and if the app lands in a state no step covers (the MCQ fast
   path), jump the tour to step 6 rather than stalling with a spotlight on nothing.
4. **The tour submits a real answer.** Step 5 commits a genuine guess and awards
   genuine pebbles. That is a feature (first pebbles inside the first minute), but it
   means the tour cannot be replayed for free. Add `/feed?tour=1` to force it for
   testing, and accept that a replay costs a real clip.
5. **Ordering against `GuestGate`.** Both self-gate on session state. A guest who mints
   an account gets a session, so `needsTour` fires and the tour can stack on the guest
   prompt. Sequence: `GuestGate` first, tour only once no other first-run dialog is
   open.
6. **Reduced motion.** No ghost cursor, no morphing spotlight (instant reposition), no
   ripple. Existing invariant.
7. **The gates are resizable and draggable.** Anchor rects must be live-measured, and
   the spotlight must animate to follow a drag rather than lag it.

---

## 5. Sequencing

| Wave | Work | Ships |
|---|---|---|
| 0 | `tour-bus.ts`, `useAnchorRect`, `Spotlight`, `GhostCursor`, `TourCaption`. `data-tour` anchors added. No behaviour change. | Nothing user-visible |
| 1 | `OnboardingTour` rewritten as controller. Steps 1 to 3 (clip, shape, sub-split). `TourPreview` deleted. | A real tour, short |
| 2 | Steps 4 and 5 (candidates, compare, species page, commit). Tutorial clip pinned. | The full identification |
| 3 | Step 6 (reveal, Done), the pebbles coda, and `/feed?tour=1`. | Complete |
| 4 | QA: `validate-animation` filmstrip on the spotlight morph and the ghost cursor, ui-review screenshots of all 6 steps plus the coda at 390px and desktop, keyboard-only pass, reduced-motion pass. | Sign-off |

Tests: `tour-steps.test.ts` (every step's `advanceOn` is an event some component
actually emits, and every `anchor` matches a `data-tour` attribute that exists in
`src/`) is the gate that stops this drifting the way `TourPreview` did.

---

## 6. Decisions (settled 28 Aug 2026, Christian)

1. **Watch or do: DO.** The ghost cursor demonstrates, the user makes the real tap, and
   the tour advances off real app state. Not auto-driven, and no fake state anywhere.
2. **Length: the tour ends at the consensus.** Six steps, finishing on the reveal with
   the community histogram. Pebbles are demoted to an optional, non-blocking indicator
   on the header bag (3.4.1) that appears after the tour is already complete. The user
   never has to click it to finish.
3. **The tour's commit counts.** Real answer, real pebbles, real leaderboard entry. The
   first identification in the tutorial is a genuine one.

Still a flag rather than a decision: item 2 in section 4, the focus contract inverts
relative to the 2 Jun audit fix. Call it out in the PR.

---

## 7. Build log (28 Aug 2026)

All four waves built in one pass. `TourPreview.tsx` deleted.

**New**
- `src/lib/tour-bus.ts`, `src/lib/onboarding-clip.ts`
- `src/components/onboarding/`: `Spotlight.tsx`, `GhostCursor.tsx`, `TourCaption.tsx`,
  `PebbleHint.tsx`, `useAnchorRect.ts`, `tour-steps.ts`, `tour-steps.test.ts`
- `OnboardingTour.tsx` rewritten as the controller

**Anchored** (`data-tour`): `FeedCard` (clip, reveal, both gated on `isActive`),
`TileGate` (tiles, compare, plus `data-tour-tile` per tile), `SpeciesComparison`,
`SpeciesGuidePopup`, `PebbleBag`.

**Gates green:** `tsc --noEmit` clean, 522 tests pass (58 files, 7 new),
`next lint` clean, `lint:tokens` clean.

**Verified live** against the dev server, driving the real rung flow signed out.
Every anchor and every signal resolved in order on a real clip:

| Rung | Signal | Anchors present |
|---|---|---|
| 1 shape gate | `identify-opened` | clip, tiles (9 shape tiles incl. `crab`) |
| 2 crab sub-split | `form-gate-open` | clip, tiles (`broad-carapace`, `spider`, `hermit`) |
| 3 candidates | `candidates-open` | clip, tiles (4 crabs), compare |
| side by side | `comparison-opened` | + comparison |
| species page | `guide-opened` | + species-guide |

The two remaining anchors (`reveal`, `pebbles`) need a committed guess and a
signed-in session, so they are covered by the test's source scan but not yet by a
live walk.

**Deviation from the plan, deliberate: the dim does not block taps.** Section 3.1
had the dim area taking pointer events. It does not. The whole overlay is
`pointer-events: none`, because blocking would stop the user reaching the gate's
own Back, Close and "Skip to guess" controls, which is exactly what a tour
pointing at live UI must not do. Divergence is handled by the controller instead:
every signal jumps the tour to the step it belongs to, so wandering off the
suggested path is tracked rather than punished. The visual (everything but the
target greyed back) is unchanged.

**Two notes from the live walk.** Signals can fire twice in dev because React
StrictMode double-invokes mount effects; harmless, since a repeated signal maps
to the same step and `setStep` to the same value is a no-op. And `flowReducer`
has no action that clears `guessMode`, so a card that enters the MCQ fast path
cannot reopen the shape gate. Pre-existing, not introduced here, but it is the
one state the tour cannot walk back out of.

**Still outstanding (wave 4).** The overlay itself has not been seen rendered: it
only mounts for a signed-in user with `onboardedAt === null`, and the browser pane
was not displaying, so no screenshots. Needs a throwaway first-run account, then
the `validate-animation` filmstrip on the spotlight morph and the ghost cursor,
screenshots of all six steps plus the coda at 390px and desktop, a keyboard-only
pass and a reduced-motion pass.

---

## 8. Wave 4 QA log (28 Aug 2026)

Ran the tour for real as a throwaway guest (`TourQA2608`, `onboardedAt` null, 0
answers). Two findings, both fixed.

### 8.1 Caption rendered off-screen on step 1 (real bug, fixed)

`TourCaption` guessed the card height at a constant 168px and, when neither side
of the anchor had room, still computed a "place above" offset. On step 1 the
anchor is the clip, which fills nearly the whole viewport, so it resolved to
`bottom: viewportH + GAP` and threw the card clean off the top: measured
`top: -245.5` on a 1402px viewport. The tour was running and completely
invisible.

Fixed by measuring the card (ResizeObserver, since the copy length varies per
step) and adding a third placement branch: when the anchor fills the viewport,
sit over its bottom edge. Verified after the fix at `top: 1094` of 1402.

### 8.2 Anchor measurement moved off requestAnimationFrame

The first implementation polled `getBoundingClientRect` on an rAF loop. Wrong
twice over: it committed React state up to 60 times a second to feed an overlay
whose own travel is eased over 300ms, so every extra sample was invisible; and
rAF stops dead whenever the tab is not compositing, leaving the spotlight frozen
or blank with no route back. Now an 80ms interval plus an immediate first
measure and a `resize` listener. Still far faster than the transition consuming
it, so a live panel drag tracks identically.

### 8.3 What was actually seen

Screenshots captured of **step 1** (clip lit, header and bottom bar dimmed,
caption over the clip's lower edge, six step dots, Skip) and **step 2** (spotlight
travelled to the shape-tile grid, clip and panel footer dimmed, "2 · SHAPE FIRST",
Back + Skip). Ghost cursor confirmed at pixel level on step 1: white arrow with
the expanding teal ripple.

Also confirmed live: the tutorial clip pins correctly (the velvet crab is first
for a first-run user, out of 127 clips) and `data-tour="pebbles"` appears once
signed in.

### 8.4 Still not done, and why

Steps 3 to 6, the pebbles coda, the 390px mobile pass, the reduced-motion pass
and the keyboard pass are NOT verified. Both browser surfaces degraded partway
through: the Browser pane never displayed (so it composites no frames and cannot
screenshot), and the Chrome tab ended up with a zero-size viewport
(`innerWidth`/`innerHeight` both 0, so nothing lays out) with its screenshot API
returning a CDP deserialisation error. Neither is caused by the tour.

To finish: display the Browser pane (or restore a normally sized Chrome window),
sign in as a first-run account, and walk steps 3 to 6. The guest `TourQA2608`
still has `onboardedAt` null and 0 answers, so it is ready to use; delete it
afterwards.

**Note on 8.1 and 8.2:** only 8.1 was a confirmed defect. 8.2 was found while
diagnosing symptoms that turned out to be the broken tab, and is kept on its own
merits (cost and robustness), not because it fixed a proven bug.

---

## 9. Wave 4 complete (28 Aug 2026)

Verified by driving a real browser through the whole tour, three ways, via
`scripts/tour-qa.ts` (Playwright). Screenshots in `implementation/2026-08-28/tour-qa/`.

| Variant | Result |
|---|---|
| Desktop 1280x900 | All 6 steps on screen, ghost cursor on the Crab tile, commit works, reveal correct, coda shown, caption gone after Done |
| Mobile 390x844 | All 6 steps on screen, caption re-places sensibly around the bottom sheets (y = 14, 254, 283, 288, 140, 14), same pass |
| Reduced motion | Caption on screen, ghost cursor NOT rendered, Escape dismisses |
| Keyboard | Tab from the caption reaches the app (skip link, menu, pebble bag, clip, Identify). Focus is NOT trapped, which is the required contract |

### Three more real defects, all found by running it

**9.1 The caption covered "This is my pick".** On step 5 the species page is a
near-full-height dialog, so neither side had room and the caption docked to the
bottom, directly over the commit button. The tour physically blocked the one
action the step was telling the user to take. The fallback branch now docks to
the TOP, because every surface in this app puts its primary action at the bottom
(the commit button, the gate's compare/skip footer, the feed's identify bar), so
the bottom is never a safe place to sit and the top always is.

**9.2 The pebbles coda could never be seen by anyone.** Its mount effect listed
`onDismiss` as a dependency, and that prop is a fresh closure on every parent
render. So the effect wrote the "already seen" flag, the parent re-rendered, the
effect re-ran, read back the flag it had just written and dismissed the hint
before a single frame of it painted. Now held in a ref with a one-shot guard.
This one is worth remembering: **an effect that both writes and reads a
persistent flag must not be able to re-run.**

**9.3 The caption swallowed taps meant for the app.** On a 390px phone the
caption is a 390x232 band floating over bottom sheets, and while it was
pointer-opaque it intercepted taps on the candidate tiles underneath. The card is
now `pointer-events: none` and only its three buttons take taps. Relatedly, in
recovery mode the caption no longer hugs the clip anchor (whose lower edge on a
phone is exactly where the gate sheet sits) and docks to the top instead.

### Cleanup done

The tour commits a REAL identification by design, so each QA run left a guest and
an Answer row that counted toward the community histogram on the tutorial clip.
`scripts/tour-qa-cleanup.ts` removed **13 QA guests and 7 answers**; a re-run
reports nothing left. Keep using it after any future QA run, or the QA quietly
biases the very consensus numbers the tour teaches about.

### Note on the repo's own gates

`tsc` and the full test suite are NOT clean on this checkout, and it is not this
work: `src/lib/biodiversity/depth.ts` has an in-flight signature change from a
concurrent session that breaks `scripts/_depth-coverage.ts` (2 TS errors) and one
case in `src/lib/biodiversity/depth.test.ts`. Nothing under `src/components/onboarding`
or `src/lib/tour-bus.ts` is implicated: the onboarding tests, `next lint` and
`lint:tokens` are all clean, and the suite was green earlier in the same session.

---

## 10. Shipped

Committed as **`c5c3569`** on `fix/snip-metadata-gate`, pushed to origin.
20 files, +2007 / -445, `TourPreview.tsx` deleted.

**Staged surgically, on purpose.** `FeedCard.tsx` and `TileGate.tsx` both carried
a concurrent session's uncommitted work (420 and 54 lines respectively, the
gate-aware video insets among it). Committing those files wholesale would have
swept up someone else's half-finished changes under this message. Instead the
committed blobs are HEAD-plus-only-the-tour-anchors, built and staged via
`git hash-object -w` + `git update-index --cacheinfo`, so the working tree still
holds their work untouched. `git status` still shows both files modified, which
is correct and expected.

**Verified against the pushed commit, not the working tree.** A detached worktree
at `c5c3569` typechecks clean, passes the tour tests, and passes `next lint` and
`lint:tokens`. That also confirmed the `depth.ts` breakage noted in section 9 is
purely the other session's uncommitted work: it does not exist in the commit.
(Four render tests fail in that worktree, but only because jest-dom's matchers do
not register through a junctioned `node_modules`, `Invalid Chai property:
toBeInTheDocument`. The same tests pass in the main checkout.)
