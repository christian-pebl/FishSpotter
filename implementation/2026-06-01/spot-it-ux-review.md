# FishSpotter "Spot It" Visual ID Flow — UX/UI Review Report

## 1. Executive summary

The "Spot It" shape-class gate prototype (commit UX-0, branch `spot-it-visual-id`) is a structurally sound implementation of the planned four-rung flow, and it correctly adopts the project's design tokens, verdict colours, and Framer-motion conventions on the surfaces it touches. However, the verified findings cluster into three actionable themes: **(a) a broken murky-safe contract** — the gate's "Not sure" and "Skip to ID guide" controls dead-end the flow instead of routing to a best-guess fallback; **(b) systemic mobile touch-target misses** — the gate close button, four text-link controls, and five trait/sub-split buttons all sit below the documented 44px minimum; and **(c) the plan's named "dopamine engine" ships static** — the shrinking candidate strip has no layout/exit animation, so the single most engagement-critical moment has no motion treatment. A modal-accessibility gap (no focus trap / Escape / inert) and jargon tile labels ("Gastropod", "Scooter") round out the P1 set. None of these block use, but the murky-safe dead-ends and a11y gaps must be closed before the flow ships beyond prototype.

## 2. Top fixes (prioritized)

| Rank | Title | Severity | Surface | One-line fix |
|---|---|---|---|---|
| 1 | Gate "Not sure" silently dead-ends the whole flow | P1 | FeedCard.tsx:1408-1413 + ShapeGate.tsx:222-227 | Route `onSelectShape(null)` to a no-shape candidate state or MCQ best-guess; never close with no successor surface |
| 2 | "Skip to ID guide" closes gate but opens nothing | P1 | ShapeGate.tsx:228-234 + FeedCard.tsx:1412 | Wire `onSkip` to open IdGuideWizard/MCQ, or relabel to "Close" |
| 3 | "Change shape" → "Not sure" silently destroys all trait progress | P1 | CandidateStrip.tsx:195-201 + FeedCard.tsx:1148,1408 | Preserve prior `selectedShape` on dismiss-without-pick, or route null to best-guess |
| 4 | ShapeGate has no focus trap, Escape handler, or focus restore | P1 | ShapeGate.tsx:159-162 | Add focus-in + Escape→onClose + Tab trap + restore; mark FeedCard `inert` while open |
| 5 | Gate close button is 32×32px (< 44px) | P1 | ShapeGate.tsx:164-173 | Bump to `min-h-[44px] min-w-[44px]`, keep 14px glyph centred |
| 6 | Four text-link controls far below 44px tall | P1 | ShapeGate.tsx:220-235; CandidateStrip.tsx:186-202 | Add `min-h-[44px]` + `px-2 -mx-2` to Not sure / Skip / Start over / Change shape |
| 7 | Sub-split + trait yes/no/skip buttons are 40px (< 44px) | P1 | CandidateStrip.tsx:218,226,245,252,259 | Change five `min-h-[40px]` → `min-h-[44px]` |
| 8 | Tile labels use jargon ("Scooter", "Gastropod") | P1 | ShapeGate.tsx:113-122; CandidateStrip.tsx:69-78 | Plain-English labels ("Snail / sea slug", etc.); update SHAPE_NOUN to match |
| 9 | De-kebab fallback exposes raw trait values (`Does it look "none"?`) | P1 | trait-questions.ts:104-106 | Add a `features: none` entry (+ others); gate picker to curated-copy traits |
| 10 | Candidate strip has no shrink animation ("dopamine engine" ships static) | P1/P2 | CandidateStrip.tsx:274-293 | `AnimatePresence mode="popLayout"` + `layout` + `exit` using `TRANSITION.layout` |
| 11 | Verdict pills / actions use glyph icons (✓ ✗ ★ ✎ ≈) | P2 | FeedCard.tsx:1196,1207,1216,1236,1326 | Replace ★ and ✎ (and ideally ✓/✗) with stroked SVGs in `text-teal-500` |
| 12 | Entry button shows raw enum key ("Shape: fish") | P2 | FeedCard.tsx:1109 | Title-case label or keep fixed "Spot It"; show class in strip header only |
| 13 | Reveal card uses stray `rounded-2xl` | P2 | FeedCard.tsx:1361 | Change to `rounded-card` |
| 14 | Gate overlay full-bleeds the card on desktop (not mid-panel) | P2 | ShapeGate.tsx:157-158 | Constrain gate to panel container at `md`; full-bleed only on mobile |
| 15 | Tile count badge sub-legible (8px) + long chip strip | P2 | ShapeGate.tsx:206-213; CandidateStrip.tsx:274-293 | Bump badge/label to `text-[10px]`; add edge-fade / "+N more" scent on long strips |

## 3. Findings by surface

### ShapeGate (`src/components/ShapeGate.tsx`)

**Close button is 32×32px — below 44px [P1]**
- *Rule:* CLAUDE.md "All interactive elements ≥ 44×44px on mobile… icon buttons, not just primary CTAs."
- *Evidence:* L168 `h-8 w-8` (=32px) with the 14px glyph centred; it is the modal's only dismiss-without-choosing affordance, top-right at 390px. Note the shape tiles correctly use `min-h-[72px]` — the chrome control was just missed.
- *Fix:* `min-h-[44px] min-w-[44px]`, keep glyph centred.

**No focus trap, no Escape, no focus restore despite `role="dialog" aria-modal="true"` [P1]**
- *Rule:* WCAG 2.1.2 / 2.4.3; CLAUDE.md "off-screen overlay content must be `inert`"; the project's own accessibility statement promises "Escape closes every dialog… focus returns to the trigger."
- *Evidence:* L159-161 set the modal ARIA, but the file has no `useEffect` focus-in, no `onKeyDown` Escape, no Tab containment, and FeedCard does not `inert` the card behind it. This is an **outlier** — IdGuideSheet, MapModal, SpeciesGallery, SideMenu all implement the full contract.
- *Fix:* Reuse the existing IdGuideSheet/SideMenu pattern — focus container on mount + store `activeElement`, `Escape`→`onClose`, trap Tab, restore on unmount, `inert` the FeedCard.

**Tile labels use jargon ("Scooter", "Gastropod") [P1]**
- *Rule:* ux-id-flow-plan principle 1 — "knowledge-free entry… no jargon."
- *Evidence:* L113-122 label tiles Fish/Flatfish/Crab/**Scooter**/Jellyfish/Starfish/**Gastropod**/Squid; the label is both shown (L207) and the sole SR `aria-label` (L193), and the strip echoes them ("3 gastropods left"). "Gastropod" is taxonomic Latin; "Scooter" is a coined term with no lay referent.
- *Fix:* Plain-English ("Snail / sea slug"; a concrete term for the Scooter class once its contents are decided); update `SHAPE_NOUN`.

**"Not sure" / "Skip to ID guide" text controls far below 44px tall [P1]** — see cross-flow touch-target finding.

**Empty-shape tiles disabled with no visible reason [nice]**
- *Evidence:* L183-216 render 4 unseeded classes (jellyfish/starfish/gastropod/squid) at `opacity-35`, disabled, no badge; only the aria-label explains it. Reads as a bug to sighted users.
- *Fix:* Hide unseeded classes until ≥1 species, or add a muted "soon" caption.

**`→` glyph used as a directional icon [nice]**
- *Evidence:* L233 `Skip to ID guide →` is the only glyph-as-icon in an otherwise all-SVG gate. (Not strictly emoji; spirit-of-rule only.)
- *Fix:* Swap for a small stroked chevron in `text-teal-400`, or drop it.

**Sub-floor caption sizes (8–9px) [nice]**
- *Evidence:* L206 tile label `text-[9px]`, L210 count badge `text-[8px]`; accepted small-text floor is `text-[10px]`. Both already carry accessible labels.
- *Fix:* Lift both to `text-[10px]`.

### CandidateStrip (`src/components/idflow/CandidateStrip.tsx`)

**No layout/exit animation — the "dopamine engine" ships static [P1→P2]**
- *Rule:* ux-id-flow-plan principle 2 ("Watching 28→6→2 is the dopamine"; the strip is "the dopamine engine"); CLAUDE.md "motion timing comes from `src/lib/motion.ts`."
- *Evidence:* L274-293 chip row is a plain flex div; chips are `motion.button` with only `whileTap`. No `layout`, no `AnimatePresence`, no `exit`. Removed candidates vanish on the next render; the count `<p>` (L180-184) hard-swaps. The single most engagement-critical moment has zero motion. (Severity split across verified findings P1/P2 — treat as P1 for engagement intent, P2 for "nothing is broken.")
- *Fix:* Wrap in `<AnimatePresence mode="popLayout">`, give each chip `layout` + `exit={{ opacity:0, scale:0.8 }}` + `transition={TRANSITION.layout}`; optionally pop the count with `spring.gentle`. Gate behind `reduceMotion`.

**Sub-split + trait yes/no/skip buttons are 40px [P1]**
- *Rule:* CLAUDE.md 44px minimum, check at 390px.
- *Evidence:* L218, 226, 245, 252, 259 all `min-h-[40px]` with only `px-3`; the candidate chips one block down (L288) correctly use `min-h-[44px]`, so the flow is internally inconsistent.
- *Fix:* Bump the five occurrences to `min-h-[44px]`.

**"Start over" / "Change shape" text controls below 44px [P1]** — see cross-flow finding.

**Sub-split flex-wrap can stack to 3-4 ragged rows at 390px [nice]**
- *Evidence:* L212-230 — 5 long labels + "Not sure" as `rounded-full px-3` pills in `flex flex-wrap`; "Torpedo / streamlined" alone ~150px wraps untidily in ~340px usable width. (Targets are not "tiny" — they're `min-h-[40px]`; the issue is layout tidiness, and the 40px→44px bump above is the more defensible change.)
- *Fix:* `grid grid-cols-2 gap-1.5` at mobile, or shorten labels; future-proofs the UX-5 silhouettes.

**Long chip strip has no scroll affordance / scent [P2]**
- *Evidence:* L274-293 renders up to 26 fish chips in a single-row `overflow-x-auto` with the scrollbar hidden; no fade-edge or "+N more". Most chips are off-screen with no hint they exist. (Code comment "12-species branch" is stale — catalogue is now 26.)
- *Fix:* Edge-fade gradient + count hint, or rely on the sub-split/adaptive questions to get under a scannable count before showing chips.

**No rung/step signpost [nice]**
- *Evidence:* Header (L177-203) shows only "N left" + Start over / Change shape; the sibling IdGuideWizard surfaces "Step X of Y" (L218-226). Questions auto-stop at `NARROW_ENOUGH=3` with no warning. (Note: the shrinking count *is* the plan's deliberate progress metaphor, so this is consistency polish, not a principle breach.)
- *Fix:* Optional "Almost there — {n} left, then choose" caption near the auto-stop threshold.

**"Not sure" answer gives no feedback [nice]**
- *Evidence:* L155-161 `answer('skip')` only appends to `askedKeys` — no constraint, no "nothing learned" message; the skip button (L256-262) is styled quieter than Yes/No. (The loop *is* bounded — only 11 trait keys, chips are always pickable below — so it does not dead-end.)
- *Fix:* One-line "no change — pick one below" hint after a skip.

**No scoring reassurance during the flow [nice]**
- *Evidence:* No copy tells the user a correct shape already scores +1; the payoff only shows post-submit (FeedCard L1201-1209). (Scoring system itself is correct and fair — this is pre-announcement only.)
- *Fix:* One low-key line: "Right shape already scores — pick the closest match."

### trait-questions (`src/lib/idflow/trait-questions.ts`)

**De-kebab fallback exposes raw trait values [P1]**
- *Rule:* ux-id-flow-plan principle 1 (jargon hidden); the file's own docstring promise.
- *Evidence:* L104-106 `?? \`Does it look "${deKebab(value)}"?\`` wraps an enum token in literal quotes. **This fires in production:** `features=none` is absent from `QUESTIONS.features`, and 5/26 fish carry `features:["none"]`, so the info-gain picker can surface `Does it look "none"?` — unanswerable nonsense. (The finding's cited examples `snake-like`/`laterally-compressed` are actually *covered*; the real trigger is `none`.)
- *Fix:* Add a `none` entry to `QUESTIONS.features` (and `crabFeatures`); gate the next-trait picker to traits with curated copy; soften the fallback to be quote-free and log any value that hits it.

**Inconsistent question tense (present vs past) [nice]**
- *Evidence:* size/bodyShape/markings/features are present ("Is it small…") while habitat/behavior/movement are past ("Was it in a school?"); within one loop the user can be asked "Is the body torpedo-shaped?" then "Was it swimming fast?". (Defensible as atemporal-fact vs observed-behaviour, so low priority.)
- *Fix:* Editorial pass to present tense throughout for the live-clip framing.

### FeedCard reveal (`src/components/FeedCard.tsx`)

**Verdict pills / actions use glyph icons [P2]**
- *Rule:* CLAUDE.md "Never use emoji as UI icons… stroked SVGs in `text-teal-500`."
- *Evidence:* L1196 `✓`, L1207 `≈`, L1216 `✗`, L1236 `★`, L1326 `✎`. Backgrounds correctly use `correct`/`incorrect`/`pending` tokens — only the leading glyph is wrong. Strongest cases are ★ and ✎ (clear decorative icons); ✓/✗ are defensible as aria-labelled text cues; ≈ is the weakest case.
- *Fix:* Replace ★ and ✎ (ideally ✓/✗ too) with stroked SVGs inheriting `currentColor`, matching the map-pin/chevron SVGs already on the card (L1311-1314).

**Entry button renders raw lowercase enum key ("Shape: fish") [P2]**
- *Evidence:* L1109 interpolates `selectedShape` (a lowercase `ShapeClass`) directly → "SHAPE: FISH" (via `uppercase`). Reusing `SHAPE_NOUN` won't fix case (it's also lowercase).
- *Fix:* Title-case, or keep the label fixed at "Spot It" and surface the class only in the strip header.

**Variable-width entry label costs a wrap line at 390px [P2]**
- *Evidence:* L1096-1110 — the growing "SHAPE: GASTROPOD" pill in a `flex-wrap` row with IdGuideTrigger + "Where is this?" pushes to 2-3 lines, and duplicates the "N left" state already shown in the strip. (Row wraps gracefully — no clipping — so cosmetic + redundancy.)
- *Fix:* Same as above — fixed "Spot It" label; class lives in the strip header.

**Stray `rounded-2xl` on end-of-feed card [P2]**
- *Evidence:* L1361 uses `rounded-2xl` where the convention is `rounded-card`/`rounded-modal`. (Soft opportunistic-migration rule.)
- *Fix:* `rounded-card`.

### Cross-flow

**Murky-safe contract is broken at the gate [P1, top priority]**
- *Rule:* ux-id-flow-plan principle 4 — "'Not sure' is offered at every step and routes to the weighted scorer's best guess instead of dead-ending."
- *Evidence:* Gate "Not sure" → `onSelectShape(null)`; FeedCard handler (L1408-1410) does `setSelectedShape(null); setShapeGateOpen(false)`; CandidateStrip is gated on `selectedShape &&` (L1139) so it never renders → user dumped to a bare card. The sibling "Skip to ID guide" → `onSkip` (L1412) *also* just closes the overlay without opening the wizard/MCQ. The "Change shape → Not sure" path additionally destroys all accumulated `mustHave`/`mustNotHave` state with no confirmation.
- *Fix (one coherent change):* (1) Make CandidateStrip accept a null `shapeClass` and render the unfiltered weighted-scorer-ordered set, OR route null to the MCQ fast path. (2) Wire `onSkip` to actually open IdGuideWizard/MCQ. (3) On a dismiss-without-pick of a *re-opened* gate, preserve the prior `selectedShape` rather than nuking the in-progress narrow. The shared rule: never leave the flow with no successor surface.

**Touch targets across the flow [P1]**
- *Rule:* CLAUDE.md 44px minimum, check at 390px.
- *Evidence:* Consolidates the gate close (32px), four text-links (Not sure / Skip to ID guide / Start over / Change shape, `text-[10px]`, no min-h, ~12-14px tall), and five sub-split/trait buttons (`min-h-[40px]`). The project already enforces this exactly — FeedCard "Skip" at L1077 uses `inline-flex min-h-[44px] items-center px-3 py-2`.
- *Fix:* Apply `min-h-[44px]` + horizontal padding to all text-links (mirroring L1077); bump the five `min-h-[40px]` to `min-h-[44px]`; bump the close button to `min-h/min-w-[44px]`.

**`reduceMotion` ignored in both Spot It sub-components [nice]**
- *Evidence:* CandidateStrip `whileTap` (L285) and ShapeGate overlay fade (L151-156) have no reduced-motion guard, unlike FeedCard which threads `useReducedMotion()` throughout. (Both are mild — a 0.96 tap scale and an opacity fade; and the shipped MCQCandidatePicker has the same gap, so Spot It is not uniquely negligent.)
- *Fix:* Call `useReducedMotion()` (or accept a prop) in both; drop the tap-scale and fade when true.

**Gate overlay full-bleeds the card on desktop [P2]**
- *Rule:* ux-id-flow-plan screen-anatomy — "desktop keeps the mid-screen panel."
- *Evidence:* ShapeGate is `absolute inset-0 … justify-end` full-bleed (L157-158); the following CandidateStrip renders *inside* the mid-screen height-capped panel (FeedCard L1140, L920). On desktop the gate→strip handoff is visually disjoint, and the full-card gate hides the clip the plan says must stay visible. Mobile (bottom-anchored) is correct.
- *Fix:* Constrain the gate to the panel container at `md`; keep full-bleed only at the mobile breakpoint.

## 4. What's already good

The prototype is not a hackathon job — it respects most of the codebase's hard rules where it touches them:

- **Verdict colours use the design tokens.** The reveal pills correctly use `correct` / `pending` / `incorrect` (with `*-ink` text), not stock Tailwind `emerald/rose/amber`.
- **Shape tiles meet the touch-target floor** (`min-h-[72px]`) and carry `aria-label`s — proof the 44px rule was understood; the chrome controls were just missed.
- **Tiles and the entry button avoid emoji** and use stroked SVG silhouettes/icons.
- **The entry button itself is 44px** (`min-h-[44px]`).
- **Empty tiles are disabled with an accessible explanation** (`aria-label="…none in catalogue yet"`) — the gap is only the *visible* (sighted) signal.
- **Border radius / colour tokens are mostly correct** (`rounded-full` pills, `rounded-card`/`rounded-modal` surfaces, teal aliases) — the only drift is one stray `rounded-2xl`.
- **The scoring system is correct and fair** at every rung (right shape = +1 partial credit); the only gaps are *communicating* it, not the logic.
- **Framer-motion is used** (the file imports `motion`), so wiring `layout`/`AnimatePresence` and `useReducedMotion()` is additive, not a rewrite.

## 5. Dimension coverage note

All six review dimensions returned at least one verified finding:

- **Visual design & brand-token compliance** — close-button target, static strip, enum-key label, sub-floor fonts, `→` glyph.
- **Interaction design & flow** — murky-safe dead-ends ("Not sure", "Skip to ID guide", "Change shape→Not sure"), reveal glyphs/`rounded-2xl`, tense, missing reward affirmation.
- **Accessibility** — focus trap / Escape / inert, all touch-target misses, jargon labels feeding `aria-label`.
- **Copy & microcopy** — jargon tiles, de-kebab fallback, scoring reassurance, partial-credit copy, empty-result wording.
- **Responsive / mobile-first at 390px** — text-link + 40px targets, sub-split flex-wrap, entry-label wrap, gate desktop full-bleed.
- **Motion & feedback** — static strip/count, `reduceMotion` ignored, glyph icons.
- **Cognitive load & information scent** — murky-safe dead-end, no signpost, sub-legible badge + long strip, no-feedback skip, empty disabled tiles.

No dimension came back empty, so there is no blind spot to flag — though note the **single highest-priority issue (murky-safe dead-ends) surfaced redundantly across three dimensions**, which is a strong signal it is the first fix to land.