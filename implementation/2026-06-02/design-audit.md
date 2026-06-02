# FishSpotter — Visual / UX Design Audit (multi-agent deep sweep)

**Date:** 2 June 2026
**Scope:** Visual & UX polish, audited against the PEBL brand guidelines and the design-system rules documented in `CLAUDE.md`.
**Method:** Multi-agent sweep. 12 finder lenses (6 page-scoped, 6 dimension-scoped: tokens, colour/contrast, typography, touch targets, motion, copy/states) read the source; **every finding was then re-checked by an independent adversarial verifier** that re-opened the cited `file:line` and was instructed to refute by default; a synthesis pass deduped across lenses and re-graded severity.
**Coverage:** 108 agents, 64 findings raised, **61 confirmed, 3 refuted**, deduped to 21 themes. No code was changed.
**Supersedes:** the initial single-reviewer heuristic pass (same file, earlier today).

> **Headline:** FishSpotter is a mature, well-built product. The deep sweep found **no broken primary flow** and **one genuine P1** (a keyboard-accessibility gap on `MapModal`). Everything else is consistency drift on secondary surfaces, concentrated in four systemic patterns: glyph-as-icon, radius-token drift, stock-palette colours, and sub-44px touch targets. A few targeted icon/token sweeps plus one shared focus hook would close most of the gap between "strong" and "fully consistent."

---

## Implementation status (2026-06-02)

**Quick wins 1-8 shipped** (4 parallel Opus 4.8 agents on disjoint file sets + main-thread `teal-800` rename; `npm run build` green). Done:
- F-COOKIE-COPY: "Dismiss" → "Got it".
- F-REDUCED-MOTION-SKELETON: `motion-reduce:animate-none` on all 8 `animate-pulse` surfaces (skeletons + IdGuideChat dots + MCQ/Gallery loaders), not just the 2 originally cited.
- F-GLYPH-ICONS (status cases): profile verdict pills, RarityPanel badges, SnippetPlayer pills, browse "Answered" badge, admin reorder/delete → stroked SVGs with preserved `aria-label`s.
- F-STOCK-PALETTE: profile pending pill + admin status pills + admin Delete → `pending`/`correct`/`danger` tokens.
- F-LOWCONTRAST-META: the five `white/35` informational labels → `white/60` (the interactive "All traits" → `white/70`).
- F-BROWSE-BADGE-CONTRAST: "Open" badge → full `text-white` on `bg-black/60`.
- F-CSSVAR-COLORS: leaderboard (14) + signin var()→alias migrations, hex-identical.
- teal-800 ramp footgun: renamed to `teal-hover` (non-numeric), call-sites updated.

**P1 + core-loop shipped** (main-thread, solo for coherence since the items are coupled; `tsc` clean + `npm run build` green; feed/landing smoke-tested in preview, console error-free). Done:
- **F-MODAL-FOCUS (the P1):** extracted a shared [`useModalFocus`](src/lib/useModalFocus.ts) hook (focus restore + initial focus + Tab trap + Escape + scroll lock, lifted from `IdGuideSheet`'s proven WCAG 2.1.2 logic) and applied it to `MapModal`, which previously had none. Keyboard users can no longer tab onto the live feed behind the open map. Close button also bumped to 44px and `sm:rounded-2xl` → `sm:rounded-card` while in the file.
- **F-PRESUBMIT-CTAS:** demoted the "Help me identify" pill (`IdGuideTrigger`) from its byte-identical teal-outline style to a quieter ghost style (44px target preserved), so "Spot It" is the single prominent guided entry; pushed the "Where is this?" utility action to the row end (`ml-auto`, 44px) to separate it from the ID actions.
- **F-RADIUS-DRIFT (feed):** `FeedCard` floating panel `rounded-2xl` → `rounded-card`; MCQ candidate + skeleton tiles `rounded-2xl` → `rounded-modal`.
- Confirmed the `src/components/landing/*` components (`HeroPreview`, `StatsBand`, `SpeciesMarquee`) are **live, not orphaned** (they render on `/`).

**Follow-on P2 sweeps shipped (later 2 Jun, separate commits):**
- **F-TOUCH-TARGETS** (non-admin): AvatarMenu trigger + menu rows, SideMenu close + nav links + sound toggle, browse pagination, IdGuideChat candidate row / use-answer button / composer textarea all bumped to >=44px.
- **F-TYPE-TOKENS**: leaderboard + signin page H1 -> `text-h1`, leaderboard section H2 -> `text-h2`.
- **F-EMPTY-AUTH-STATES** (terminal pages): new shared `src/components/MarineFrame.tsx` wraps the 404 / error / sighting-not-found pages with the animated marine pattern, matching the `/auth` treatment.
- **F-PROFILE-METRICS**: profile now shows a **Score** tile (sum of `Answer.points`, reconciling with the leaderboard) and computes **Accuracy over resolved answers only** (excludes pending no-reference clips that were silently dragging it down).
- **F-FEEDPLAYER-EMPTY**: empty-feed state re-skinned from off-palette `slate`/`cyan` + operator copy to a brand `pebl-surface` card with a user-facing headline + styled CTA.
- **Opportunistic radius**: as each of the above files was touched, its `rounded-hero`/`2xl`/`lg`/`xl` was migrated to `rounded-card`/`rounded-modal` (the documented opportunistic path, not a banned big-bang sweep).
- **`rounded-hero` fully retired**: all 13 remaining non-admin call-sites migrated to `rounded-card` and the token deleted from `tailwind.config.ts`.
- **F-GLYPH-ICONS (icon-button cases)**: SpeciesGallery lightbox `‹ ›` and the admin breadcrumb / row arrows swapped to stroked SVGs. (Remaining decorative arrows are render-safe typographic ones in body text.)
- **F-ADMIN-SAVE-FEEDBACK**: the SpeciesAnnotator now surfaces a dismissible `danger` banner when any mark save (create/update/delete/reorder) fails, instead of silently console-erroring while the optimistic UI desynced. Admin radius (`rounded-xl/lg` -> `rounded-card/modal`) done in the same pass.

**Still open:**
- **NEW finding (admin colour bug):** the `/admin/*` pages reference Tailwind shades that are **not defined** in the config (`navy-50/100/200/300/400/600/700`), so admin text and borders render with default/inherited colour rather than the intended navy tints. Needs either extending the `navy` scale in `tailwind.config.ts` or mapping these to the existing `navy-900/<alpha>` utilities. A self-contained admin colour pass.
- Render-safe typographic arrows in body text (`← Back`, pagination) — deprioritised; standard Unicode, no emoji-font problem.
- P3 polish (sheet-title hierarchy, body-leading consistency).

---

## Severity key

| Tag | Meaning |
|---|---|
| **P1** | Breaks a documented contract on a primary surface. Fix first. |
| **P2** | Visible polish / consistency issue, or a documented-rule violation on a secondary surface. |
| **P3** | Minor / trivia. |

*Note: severities below are the **final grades after adversarial verification**, which down-graded several finder claims (e.g. radius drift on chrome P1→P2, cookie copy P2→P3). That re-grading is the point of the verify pass.*

---

## P1 — fix first

### F-MODAL-FOCUS · `MapModal` has no focus trap or focus restore **[P1, accessibility]**
`MapModal` only handles Escape + a body-scroll lock. It has **no Tab focus trap, no restore of the previously-focused element on close, and no `inert`/`aria-hidden` on the page behind it**. Its structural sibling `IdGuideSheet` already implements all of this (and even comments the WCAG 2.1.2 concern). Because the map opens over the **active FeedCard**, keyboard and screen-reader users can tab straight out of the dialog onto the live feed and MCQ controls underneath.

- Evidence: [`MapModal.tsx:24`](src/components/MapModal.tsx:24)–`:36` (no trap) vs [`IdGuideSheet.tsx:65`](src/components/IdGuideSheet.tsx:65)–`:71` + `:105`–`:124` (the pattern to copy).
- This is the only finding that breaks a documented accessibility contract on a primary surface rather than being cosmetic.
- **Fix:** extract `IdGuideSheet`'s focus block into a shared `useModalFocus` hook (remember `activeElement` on open → move focus in → trap Tab → restore on close) and apply it to `MapModal`, so every future dialog inherits the contract.

---

## P2 — systemic patterns (the bulk of the polish budget)

### F-GLYPH-ICONS · Unicode glyphs used as UI icons instead of stroked SVG **[P2, systemic]**
The rule bans emoji/dingbats as UI icons. The core `FeedCard` reveal already does it correctly with inline SVG, but ~a dozen other surfaces still draw check/cross/star/caret/arrow glyphs, so it's also a same-app inconsistency. Status-icon cases are highest value; decorative nav arrows are lower.

- Evidence: [`u/[id]/page.tsx:132`](src/app/u/[id]/page.tsx:132) (✓/✗/★ verdict pills), [`RarityPanel.tsx:107`](src/components/RarityPanel.tsx:107), [`SnippetPlayer.tsx:167`](src/components/SnippetPlayer.tsx:167), [`IdGuideChat.tsx:300`](src/components/IdGuideChat.tsx:300) (typing dots), [`feed/browse/page.tsx:235`](src/app/feed/browse/page.tsx:235) (✓ Answered), [`SpeciesAnnotator.tsx:399`](src/app/admin/species/[name]/SpeciesAnnotator.tsx:399).
- **Fix:** port the existing `FeedCard` verdict SVGs ([`:1200`](src/components/FeedCard.tsx:1200)–`:1252`) + a small stroked chevron/arrow set into a shared icon module; swap status-icon call-sites first, decorative arrows second. Leave genuine textual key-references ("press ↵") alone.

### F-RADIUS-DRIFT · `rounded-2xl` / `rounded-lg` / retiring `rounded-hero` instead of `rounded-card` / `rounded-modal` **[P2, systemic]**
The single most-repeated token issue: spans global chrome, the primary feed panel + MCQ tiles, auth inputs, the guidance modals + chat bubbles, the leaderboard/browse/account/profile hero cards, the error/404/legal cards, and the admin tool. `CLAUDE.md` itself files this as a deferred opportunistic migration, hence P2, but it's visible wherever a `rounded-hero` (28px) card stacks directly above `rounded-card` (24px) sections.

- Evidence: [`FeedCard.tsx:924`](src/components/FeedCard.tsx:924) (panel `rounded-2xl`), [`MCQCandidatePicker.tsx:148`](src/components/MCQCandidatePicker.tsx:148), [`auth/signin/page.tsx:99`](src/app/auth/signin/page.tsx:99), [`AvatarMenu.tsx:80`](src/components/AvatarMenu.tsx:80), [`SideMenu.tsx:232`](src/components/SideMenu.tsx:232) (`rounded-lg`), [`leaderboard/page.tsx:166`](src/app/leaderboard/page.tsx:166) (`rounded-hero`), [`SettingsMenu.tsx:93`](src/components/SettingsMenu.tsx:93).
- **Fix:** guided sweep: `rounded-2xl`/`rounded-hero` on surfaces → `rounded-card`; `rounded-2xl`/`rounded-lg` on inputs + small notices → `rounded-modal`; toggle pills → `rounded-full`. Then delete `rounded-hero` from `tailwind.config.ts`. Prioritise the feed panel + MCQ tiles, then auth inputs (which currently mismatch their own Suspense skeleton).

### F-STOCK-PALETTE · Stock `amber`/`emerald`/`rose`/`zinc` instead of the verdict/`danger` tokens **[P2, systemic]**
Semantic states should use the `correct`/`incorrect`/`pending` tokens (each has a `DEFAULT` bg + `ink` shade) and `danger`, not stock utilities. The colourblind risk is **mitigated in most cases** by a text label, glyph, or rank numeral, so the load-bearing issue is token discipline, **except the leaderboard medals**, where three pale near-white tints carry the gold/silver/bronze intent on colour alone.

- Evidence: [`u/[id]/page.tsx:124`](src/app/u/[id]/page.tsx:124) (amber pending pill), [`RarityPanel.tsx:153`](src/components/RarityPanel.tsx:153), [`admin/species/page.tsx:120`](src/app/admin/species/page.tsx:120), [`leaderboard/page.tsx:211`](src/app/leaderboard/page.tsx:211)–`:227` (`amber-50`/`zinc-100`/`orange-50` medal rows), [`SpeciesAnnotator.tsx:456`](src/app/admin/species/[name]/SpeciesAnnotator.tsx:456) (rose Delete), [`IdGuideChat.tsx:237`](src/components/IdGuideChat.tsx:237).
- **Fix:** swap verdict/semantic cases to the named tokens at call-sites. For the medals, replace the three pale tints with one `surface-muted` highlight + a visible non-colour cue (a rendered "Gold/Silver/Bronze" label or a stroked medal/numeral SVG). Pair the Delete action with a stroked trash SVG so destructive intent isn't red-only.

### F-TOUCH-TARGETS · Sub-44px interactive elements on chrome + overlay controls **[P2, systemic]**
The 44px rule is already enforced on primary CTAs (the signed-out "Sign in" link, the SettingsMenu trigger, `IdGuideTrigger`), so these are inconsistencies, not a blanket miss.

- Evidence: [`AvatarMenu.tsx:69`](src/components/AvatarMenu.tsx:69) (`h-9 w-9` trigger + ~32px menu rows), [`SideMenu.tsx:174`](src/components/SideMenu.tsx:174) (close button), [`IdGuideChat.tsx:201`](src/components/IdGuideChat.tsx:201) (candidate/footer/chip controls), [`feed/browse/page.tsx:275`](src/app/feed/browse/page.tsx:275) (pagination + Reset), [`SpeciesAnnotator.tsx:396`](src/app/admin/species/[name]/SpeciesAnnotator.tsx:396) (reorder).
- **Fix:** add `min-h-[44px]` (and `min-w-[44px]` for icon buttons) to those controls, mirroring [`IdGuideTrigger.tsx:228`](src/components/IdGuideTrigger.tsx:228). Verify at 390px.

### F-LOWCONTRAST-META · Informational meta text at `text-white/35` fails AA on dark panels **[P2, systemic, contrast]**
Several **load-bearing** labels (not decoration) render at `white/35` over the `navy-900/72` blur panel — roughly 2.5–3:1, below the 4.5:1 small-text floor. The 10px size is documented-legitimate; the `/35` opacity is the violation. (The team already fixed this exact class of bug on the landing page, comment `P-11`.)

- Evidence: [`FeedCard.tsx:1303`](src/components/FeedCard.tsx:1303) (CC photo credit), [`RarityPanel.tsx:122`](src/components/RarityPanel.tsx:122) (OBIS provenance) + `:164` ("Reference not matched"), [`CandidateStrip.tsx:265`](src/components/idflow/CandidateStrip.tsx:265) (scoring hint), [`IdGuideWizard.tsx:408`](src/components/IdGuideWizard.tsx:408) (the **interactive** "All traits" button).
- **Fix:** floor informational meta text at `white/55`–`/65`; reserve `≤white/40` for true ornament. Treat the "All traits" label as a control, not muted prose.

### F-EMPTY-AUTH-STATES · Auth / error / 404 pages are bare cards on a blank viewport **[P2, systemic, states]**
The rule: auth/empty pages need editorial content in the unused viewport, never a lone `max-w-md` card centred on blank. All four auth screens + the three terminal states violate it. Low-traffic with working recovery CTAs, so presentational, but reads as a framework default rather than the product.

- Evidence: [`auth/signin/page.tsx:71`](src/app/auth/signin/page.tsx:71), [`auth/forgot/page.tsx:42`](src/app/auth/forgot/page.tsx:42), [`error.tsx:21`](src/app/error.tsx:21), [`not-found.tsx:8`](src/app/not-found.tsx:8), [`feed/[id]/not-found.tsx:8`](src/app/feed/[id]/not-found.tsx:8).
- **Fix:** on ≥md add a second column / background panel with a species silhouette (`public/silhouettes`), a field-note quote, or a "what you get" list (especially on the sign-up variant). On sighting-not-found, a recent-thumbnail strip doubles as a recovery path.

### F-TYPE-TOKENS · Heading sizes drift from the `display`/`h1`/`h2` tokens **[P2, systemic, typography]**
The page-H1 role uses four different sizes across five primary pages: account + profile use `text-h1`, but leaderboard + signin use raw `text-3xl` (a full step smaller), and landing uses `text-4xl/md:text-5xl`. Section H2s on landing + leaderboard use raw `text-2xl font-bold` instead of `text-h2`.

- Evidence: [`leaderboard/page.tsx:170`](src/app/leaderboard/page.tsx:170), [`auth/signin/page.tsx:74`](src/app/auth/signin/page.tsx:74), [`account/page.tsx:39`](src/app/account/page.tsx:39), [`page.tsx:157`](src/app/page.tsx:157), [`leaderboard/page.tsx:325`](src/app/leaderboard/page.tsx:325).
- **Fix:** standardise page H1 on `text-h1` (convert leaderboard + signin); replace `text-2xl font-bold` section headings with `text-h2`.

### F-CSSVAR-COLORS · Leaderboard + signin route colours through `:root` vars instead of Tailwind aliases **[P2, tokens]**
Colour source of truth is the Tailwind aliases in `className`; `:root` vars are for the few `[color:var(--x)]` theming hooks + `pebl-*` classes. Leaderboard + signin use `text-[color:var(--foreground)]` etc. pervasively, while landing/account/profile already use aliases. Same hexes, so no contrast impact — pure drift-narrowing.

- Evidence: [`leaderboard/page.tsx:167`](src/app/leaderboard/page.tsx:167) + `:261`, [`auth/signin/page.tsx:73`](src/app/auth/signin/page.tsx:73) + `:99`.
- **Fix:** migrate both pages to `text-navy-900` / `text-teal-700` / `text-navy-900/72` / `border-navy-900/12`.

---

## P2 — surface-specific

### F-PRESUBMIT-CTAS · Feed pre-submit panel stacks 4+ competing ID affordances with no clear primary **[P2, hierarchy, core loop]**
Before any answer the panel renders the MCQ grid, a Skip pill, a "Spot It" button, the "Help me identify" trigger, and "Where is this?" at once. "Spot It" and "Help me identify" use **byte-identical** pill styling and both open an identification flow (shape gate vs wizard), side by side as near-equal CTAs → choice paralysis on the most important surface.

- Evidence: [`FeedCard.tsx:978`](src/components/FeedCard.tsx:978) (MCQ), `:1104` (Spot It), `:1115` (Help me identify), `:1122` (Where is this).
- **Fix:** make the MCQ grid the clear default; merge/demote one of the two guided entries into a single secondary "Help me identify"; visually group utility actions (Skip, Where) apart from ID actions.

### F-PROFILE-METRICS · Profile ignores the points model the rest of the app ranks by **[P2, hierarchy]**
Profile shows Identifications / Accuracy / Streak with **no Score**, while the leaderboard ranks by `sum(Answer.points)`. Worse, profile Accuracy = `correct / total` over **all** answers including pending (`isCorrect=null`) ones, which are bonus-awarded not wrong — so the denominator silently drags accuracy down, unlabelled. A user can't reconcile their profile with their rank.

- Evidence: [`u/[id]/page.tsx:44`](src/app/u/[id]/page.tsx:44) + `:65`–`:66` vs [`leaderboard/page.tsx:61`](src/app/leaderboard/page.tsx:61)–`:73` + `:261`.
- **Fix:** add a Score tile; compute Accuracy over resolved (non-null) answers only, or relabel the tile to say it excludes pending clips.

### F-BROWSE-BADGE-CONTRAST · "Open" badge contrast not guaranteed over arbitrary thumbnails **[P2, contrast]**
`text-white/80` on `bg-black/45` at 10px, over an unpredictable `object-cover` thumbnail — over a bright sand frame it can drop below AA. Text label, so no colourblind issue, but the floor isn't deterministic.

- Evidence: [`feed/browse/page.tsx:229`](src/app/feed/browse/page.tsx:229) + `:232`.
- **Fix:** full `text-white` + denser scrim (`bg-black/60`), or a solid teal/navy chip.

### F-FEEDPLAYER-EMPTY · Empty-feed state uses off-palette stock colours + operator copy **[P2, color/states]**
`text-slate-500` + a `text-cyan-400` link, bare centred line, operator-facing copy ("Run the seed script"). Rarely renders in seeded prod, hence polish-tier, but violates both colour-source-of-truth and editorial-empty-state rules.

- Evidence: [`FeedPlayer.tsx:150`](src/components/FeedPlayer.tsx:150) + `:153`.
- **Fix:** re-skin with brand tokens, user-facing headline, styled "Browse archive" pebl button.

### F-ADMIN-SAVE-FEEDBACK · Admin annotator save failures only `console.error` → silent desync **[P2, states]**
Every server-action catch in `SpeciesAnnotator` logs to console with no UI surface; optimistic local updates persist on screen even when the DB write throws, so a failed save **looks successful** and the marks silently desync. Correctness trap on a teaching-content authoring tool (admin-only, hence P2 not P1).

- Evidence: [`SpeciesAnnotator.tsx:105`](src/app/admin/species/[name]/SpeciesAnnotator.tsx:105), `:208`, `:354`.
- **Fix:** surface an inline error (`danger` token) on reject and roll back the optimistic state.

---

## P3 — polish / trivia

- **F-HERO-CTA-DILUTION** [hierarchy] — landing hero pairs a filled + outline CTA at identical shape then two sub-line links; mild dilution. The primary does carry a glow. Consider demoting "Create your spotter profile" to a ghost/text link. [`page.tsx:103`](src/app/page.tsx:103)–`:126`.
- **F-COOKIE-COPY** [copy] — cookie banner primary button says "Dismiss" but writes the consent cookie. **Not a dark pattern** (no toggles, always privacy-protective, copy explains it), so verified down to P3. Relabel "Got it". [`CookieBanner.tsx:62`](src/components/legal/CookieBanner.tsx:62)–`:68`.
- **F-REDUCED-MOTION-SKELETON** [motion] — browse + leaderboard loading skeletons `animate-pulse` with no `motion-reduce` guard. Add `motion-reduce:animate-none`. [`feed/browse/loading.tsx:10`](src/app/feed/browse/loading.tsx:10), [`leaderboard/loading.tsx:10`](src/app/leaderboard/loading.tsx:10).
- **F-SHEET-TITLE-HIERARCHY** [typography] — in `IdGuideSheet` the static chrome out-ranks the taught species/step in size. Promote the wizard question to the `h3` token. [`IdGuideSheet.tsx:221`](src/components/IdGuideSheet.tsx:221), [`IdGuideWizard.tsx:232`](src/components/IdGuideWizard.tsx:232).
- **F-BODY-LEADING** [typography] — same-role `text-sm` body uses `leading-7` on landing but `leading-6` on leaderboard/signin. Pick one. [`page.tsx:99`](src/app/page.tsx:99), [`leaderboard/page.tsx:173`](src/app/leaderboard/page.tsx:173), [`auth/signin/page.tsx:78`](src/app/auth/signin/page.tsx:78).
- **Extra (initial pass, verifiable):** `teal-800` (#2b9d97) is **lighter** than `teal-600`/`700` in [`tailwind.config.ts:20`](tailwind.config.ts:20) — an out-of-order ramp. Rename it (e.g. `teal-accentHover`) rather than leaving it mis-numbered.

---

## What was refuted / down-graded (the verify pass earning its keep)
- **3 findings refuted outright** by their verifiers (cited line didn't hold or the issue was already mitigated nearby).
- Multiple radius/chrome findings raised as **P1 were re-graded to P2** (cosmetic radius delta, documented as deferred work).
- The cookie-banner copy was **re-graded P2→P3** after the verifier confirmed it isn't a consent dark pattern.
- The colourblind-medal alarm was **re-framed from "information loss" to "token hygiene"** because rank numerals + sr-only labels already carry the tier non-visually — except the pale tints themselves.

*(Infra note: 3 of the per-finding verifier agents failed to emit structured output and were dropped; this affected individual findings, not the synthesis, which ran on the 61 that verified cleanly.)*

---

## Prioritised action list

**Quick wins (low risk, high consistency payoff):**
1. F-COOKIE-COPY — "Dismiss" → "Got it".
2. F-REDUCED-MOTION-SKELETON — `motion-reduce:animate-none` on the two skeletons.
3. F-GLYPH-ICONS (status cases) — swap profile/RarityPanel/SnippetPlayer/browse glyphs to the existing FeedCard SVGs.
4. F-STOCK-PALETTE — swap profile pending pill + admin status pills + admin Delete to the named tokens.
5. F-LOWCONTRAST-META — raise the `white/35` informational labels to `white/55`–`65`.
6. F-BROWSE-BADGE-CONTRAST — drop the `/80`, densen the scrim.
7. F-CSSVAR-COLORS — alias-migrate leaderboard + signin.
8. teal-800 rename so the ramp is monotonic.

**Core loop (the feed):**
9. F-MODAL-FOCUS — the shared focus-trap hook on MapModal (also the one P1).
10. F-PRESUBMIT-CTAS — one clear primary; merge/demote the duplicate guided entry; group utility vs ID actions.
11. F-LOWCONTRAST-META + F-GLYPH-ICONS — bring SnippetPlayer/RarityPanel reveals in line with FeedCard.
12. F-RADIUS-DRIFT (feed) — panel → `rounded-card`, MCQ tiles → `rounded-modal`.

**Bigger bets (editorial / structural):**
13. F-MODAL-FOCUS — extract `useModalFocus` (trap + restore + inert) and apply app-wide.
14. F-GLYPH-ICONS — shared stroked-SVG icon module; retire Unicode icons everywhere.
15. F-RADIUS-DRIFT — run the full deferred radius consolidation, then delete `rounded-hero`.
16. F-EMPTY-AUTH-STATES — one reusable editorial auth/empty/error layout across all 7 screens.
17. F-PROFILE-METRICS — add Score, fix the accuracy denominator, so profile and leaderboard tell one story.
18. F-TYPE-TOKENS — lock page H1/H2 to the tokens across all five primary pages.

---

*Generated by a 12-lens multi-agent sweep with per-finding adversarial verification. Every theme cites `file:line` for direct navigation. No source files were modified.*
