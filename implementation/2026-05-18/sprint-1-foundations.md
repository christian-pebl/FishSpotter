# Sprint 1 — Foundations

> Worktree: `C:\Users\Christian Abulhawa\FishSpotter\.claude\worktrees\angry-allen-76508d`
> Audit source: `audit/ux-2026-05/` (2026-05-18)
> Executor: Claude Code, in-session ticket-by-ticket.

## Goal

Stop the bleeding before adding features. Land the design-system foundations the rest of the audit assumes (Tailwind tokens, `next/font`, type scale), kill the answer-leak APIs and the open-redirect signin bug, restore the missing Next.js error/loading/404 surfaces, and stand up the testing-and-lint scaffolding (Playwright + axe-core + Lighthouse CI + Storybook + custom ESLint rule + ffprobe CI guard) so Sprints 2-6 ship against regression gates rather than vibes.

This sprint is intentionally a mix of (a) non-visual plumbing that the whole rest of the roadmap depends on, and (b) two pre-launch security fixes that block any public share of the app.

## Definition of done (sprint exit criteria)

1. `tailwind.config.ts` exposes the full PEBL palette, three-step radius scale, motion presets, brand-heading font family, and an `@layer components` rewrite of `pebl-button-primary` / `pebl-button-secondary` / `pebl-eyebrow` so every existing class still works.
2. `globals.css` `--font-heading` is bound to a `next/font` CSS variable (Jost picked as the Futura open-source substitute, pending Q1 — see "Open questions").
3. A token-bypass ESLint rule fails CI on any new `bg-[#...]` / `text-[#...]` / `border-[#...]` / `rounded-[Npx]` / `tracking-[0.NNem]` outside `globals.css` and `tailwind.config.ts`. A one-off codemod pass has converted the worst offenders (FeedCard, IdGuide*, SideMenu, RarityPanel, SpeciesGallery) so the baseline rule passes on `main`.
4. `src/app/{error,not-found,loading,global-error}.tsx` exist with PEBL-branded shells; per-route `loading.tsx` files exist for `/feed`, `/feed/browse`, `/leaderboard`. Throwing inside a route segment renders the branded boundary instead of a blank page.
5. `/api/snippets/[id]/stats` and `/api/snippets/[id]/probability` no longer return `staffAnswer` / `staffAnswerScientific` to a caller who has not yet submitted an `Answer` for that snippet (the count breakdown remains public so the UI can show community percentages on the input panel without spoiling).
6. `/auth/signin` rejects any `callbackUrl` that is not a same-origin relative path, falling back to `/feed`. After a successful submit it client-pushes via the App Router rather than `window.location.href`.
7. Playwright runs against `localhost:3000` in CI: smoke nav spec covering `/`, `/feed`, `/feed/browse`, `/leaderboard`, `/auth/signin`; deep-link test asserting open-redirect rejection; `@axe-core/playwright` smoke at 375 + 1280 fails CI on serious/critical violations.
8. Lighthouse CI is wired with budget assertions (LCP <2.5s, CLS <0.1, INP <200ms) on the four public surfaces.
9. Storybook scaffold runs locally with one stub story per design primitive (`Button`, `Card`, `Eyebrow`, `Chip`) — extraction of those primitives from existing code happens in Sprint 5; Sprint 1 only stands up the harness.
10. CI step `ffprobe-guard` reads every `Snippet.videoUrl` from the live DB at PR-merge time and fails if any returns `codec_name != h264`.

## Audit findings addressed (cross-reference)

| Ticket | Audit refs |
|---|---|
| S1-T01 (Tailwind tokens) | §01 F1, F3, F4, F5, F6, F12, F14, F22, F31 |
| S1-T02 (`next/font` heading) | §01 F2, F8, F27 |
| S1-T03 (Type scale + eyebrow) | §01 F7, F29 |
| S1-T04 (Motion preset + confetti palette) | §01 F13, F19; §07 A11Y-14 |
| S1-T05 (`@layer components` button class rewrite) | §01 F23, F26 |
| S1-T06 (Custom ESLint token-bypass rule) | §01 F1; testing plan |
| S1-T07 (Codemod pass for worst offenders) | §01 F1, F3, F4, F5 (root-cause cleanup) |
| S1-T08 (`error.tsx` + `global-error.tsx`) | §04 F6; §07 PERF-13 |
| S1-T09 (`not-found.tsx` app + per-route) | §04 F5 |
| S1-T10 (`loading.tsx` per route) | §04 F7; §07 PERF-12 |
| S1-T11 (Answer-gate stats + probability APIs) | §03 F6, F7; README Theme E |
| S1-T12 (`callbackUrl` validation + router push) | §04 F10, F11; README Theme E |
| S1-T13 (Playwright + axe-core scaffolding) | §01 testing plan; §07 testing plan |
| S1-T14 (Lighthouse CI budgets) | §07 testing plan; PERF-15 |
| S1-T15 (Storybook scaffold) | §01 testing plan |
| S1-T16 (ffprobe codec CI guard) | CLAUDE.md H.264 invariant; §02 testing plan |
| S1-T17 (Skip-link target focus fix) | §07 A11Y-04 (cheap fix piggybacked on routing-shell work) |

## Dependency graph

```
                    S1-T01  (tailwind tokens)
                       │
       ┌───────────────┼────────────────┐
       ▼               ▼                ▼
    S1-T02         S1-T03           S1-T04
    (font)         (type scale)     (motion / confetti)
       │               │
       └──────┬────────┘
              ▼
           S1-T05  (button class rewrite, depends on tokens)
              │
              ▼
           S1-T06  (ESLint rule — must wait until tokens exist so rule has somewhere to point to)
              │
              ▼
           S1-T07  (codemod pass — passes lint after tokens exist)

  S1-T08 ─┐
  S1-T09 ─┼──── parallel with token track (independent surfaces)
  S1-T10 ─┤
  S1-T17 ─┘

  S1-T11  (API gate) ──┐
  S1-T12  (callbackUrl)─┴── parallel; both server-side, both feed Playwright tests

  S1-T13  (Playwright + axe) ◄── consumes S1-T11, S1-T12 for its contract tests
  S1-T14  (Lighthouse CI)    ◄── piggybacks on Playwright infra
  S1-T15  (Storybook)        ◄── independent
  S1-T16  (ffprobe)          ◄── independent
```

Parallelisable lanes:
- **Lane A (token track, sequential):** T01 → T02/T03/T04 → T05 → T06 → T07
- **Lane B (Next.js shells, parallel):** T08, T09, T10, T17 — any order, no inter-dependencies
- **Lane C (security, parallel):** T11, T12 — independent; both ship before Playwright spec writing
- **Lane D (test infra, mostly parallel after Lane C):** T13 → T14, plus T15 and T16 fully independent

Recommended ordering within a single execution session: T01 → T02 → T03 → T05 → T08 → T09 → T10 → T11 → T12 → T17 → T13 → T14 → T06 → T07 → T04 → T15 → T16. (Tokens early so subsequent visual work can use them; security mid-sprint so test infra can assert against the fixes; lint rule + codemod late so the lint pass doesn't fight the in-flight token edits; T04 late because confetti is low-risk and T15/T16 last because they have no downstream dependencies in this sprint.)

---

## Tickets

### S1-T01 — Land PEBL design tokens in `tailwind.config.ts`

- **Priority:** Critical
- **Effort:** M (1-4hr)
- **Audit refs:** §01 F1, F3, F4, F5, F6, F12, F14, F22, F31
- **Files to touch:** `tailwind.config.ts:1-13`; `src/app/globals.css:5-17` (only to align CSS var names with new Tailwind tokens, not to remove vars)
- **Current state:** `theme: { extend: {} }` is empty. Every component reaches for `bg-[#3AAFA9]`, `rounded-[28px]`, `shadow-[0_8px_22px_rgba(...)]`. CSS vars in `globals.css:5-17` are the only source of truth and are bypassed by the dark immersive surface.
- **Target state:** Tailwind config exposes:
  - **`colors`**: `teal: { 50: '#DEF2F1', 100: '#DEF2F1' /* light-teal brand */, 500: '#3AAFA9' /* accent */, 600: '#2B7A78' /* dark teal / "primary" semantic */, 700: '#1F5F5D' /* primary-strong, eyebrow */, 800: '#2b9d97' /* hover-on-light */, 400: '#59c8c3' /* hover-on-dark */ }`, `navy: { 800: '#0F1D22' /* modal */, 900: '#17252A' /* foreground / dark surface */ }`, `surface: { DEFAULT: '#FFFFFF', muted: '#eef9f8' }`, `danger: { DEFAULT: '#c83a3a', onDark: '#fda4a4' }`, `warn: { DEFAULT: '#d97706', onDark: '#fbd38d' }`.
  - **`borderRadius`**: `card: '24px'`, `hero: '28px'`, `modal: '16px'`. Keep Tailwind's default scale for everything else. Explicitly **do not** add `22px` — F6 says drop it.
  - **`boxShadow`**: `panel: '0 8px 22px rgba(0,0,0,0.45), 0 0 0 3px rgba(58,175,169,0.18)'`, `card: '0 18px 40px rgba(23,37,42,0.08)'`, `chip: '0 1px 2px rgba(23,37,42,0.06)'`.
  - **`fontFamily`**: `brand: ['var(--font-heading)', 'sans-serif']`, `body: ['var(--font-body)', 'sans-serif']` (the second var lands in T02).
  - **`letterSpacing`**: `eyebrow: '0.18em'` (single canonical eyebrow tracking; F29 said pick one).
- **Implementation approach:**
  1. Replace the empty `extend` with the block above.
  2. In `globals.css`, ensure `--surface-muted` keeps `#eef9f8` (do not consolidate with `#DEF2F1` — leave the audit's open question 3 for design; we ship a `teal.50` and a `surface.muted` as two distinct tokens and let the team decide later which to use where).
  3. Do **not** remove any CSS vars — components currently use `var(--accent)`, `var(--foreground)` etc., and rewriting that is T07's job. The Tailwind tokens are additive.
  4. Add a one-line JSDoc on each colour key noting brand semantics (`teal.500 → "accent / on-dark button bg"`, `teal.600 → "primary / on-light text"`).
- **Acceptance criteria:**
  1. `npm run build` passes with no Tailwind warnings.
  2. A new component using `className="bg-teal-500 rounded-card shadow-panel font-brand"` compiles and renders the correct values.
  3. The existing app renders byte-identically to before (verified by Playwright screenshot baseline, captured before this ticket lands so it locks in current visual state for the duration of the sprint).
- **Testing notes:** Capture a one-off baseline Playwright screenshot of `/`, `/feed/browse`, `/leaderboard`, `/auth/signin` **before** merging T01 (Playwright is stood up in T13; if T01 lands first, capture the baseline manually with Chrome DevTools Device Mode at 375/1280 and store under `audit/baseline-2026-05-18-pre-tokens/`).
- **Risk / rollback:** Additive only. Rollback = revert `tailwind.config.ts`. No component behaviour changes.
- **Dependencies:** None (first ticket).

---

### S1-T02 — Load Jost via `next/font` and bind `--font-heading`

- **Priority:** Critical
- **Effort:** S (<1hr)
- **Audit refs:** §01 F2, F8, F27
- **Files to touch:** `src/app/layout.tsx:1-12`, `src/app/globals.css:16`
- **Current state:** `src/app/layout.tsx:8-11` loads `Roboto` weights 300/400/500/700 via `next/font/google` and applies it as the body font. `--font-heading: Futura, "Trebuchet MS", Arial, sans-serif` — Futura is not loaded, so ~70% of users see Trebuchet MS for every `<h1>`-`<h4>`. There is no `@font-face` for Futura.
- **Target state:** Headings render in **Jost** (open-source Futura substitute available on Google Fonts) on every OS, with Roboto fallback. Both fonts are loaded via `next/font/google` with `display: 'swap'` and exposed as CSS variables.
- **Implementation approach:**
  1. Import `Jost` alongside `Roboto`:
     ```ts
     import { Jost, Roboto } from "next/font/google";
     const jost = Jost({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-heading", display: "swap" });
     const roboto = Roboto({ subsets: ["latin"], weight: ["300","400","500","700"], variable: "--font-body", display: "swap" });
     ```
  2. Apply both variables on `<html>` (not body) so the CSS var cascades to every element including portaled content (SpeciesGallery lightbox, etc.):
     ```tsx
     <html lang="en" className={`${jost.variable} ${roboto.variable}`}>
     ```
  3. Change body class from `roboto.className` to `font-body` (which now reads `var(--font-body)` via the Tailwind `fontFamily` token added in T01).
  4. In `globals.css:16`, change `--font-heading: Futura, "Trebuchet MS", Arial, sans-serif;` to `--font-heading: Jost, "Helvetica Neue", Arial, sans-serif;` — `next/font` will override this when it's defined, but the CSS-var fallback keeps a sane stack if next/font fails to load.
- **Acceptance criteria:**
  1. On Edge / Windows, `getComputedStyle(document.querySelector('h1')).fontFamily` returns a string starting with a `__className_…` (next/font hashed token) followed by `Jost`.
  2. No CLS spike on first paint (Jost loaded with `display: 'swap'`; first paint shows Helvetica Neue/Arial fallback for ~50ms, then swaps).
  3. `.font-brand-heading` (still defined in globals.css:34) inherits Jost on every surface including `/feed/browse` h1.
- **Testing notes:** Manual: open in Edge on Windows (highest-impact browser for F2), confirm h1 has Jost-like geometric letterforms (look at the "g" — Jost has a double-storey lower case "g"). Automated: add a Playwright assertion in T13's smoke spec that `getComputedStyle(h1).fontFamily` contains `Jost`.
- **Risk / rollback:** Low. Rollback = revert layout.tsx.
- **Dependencies:** T01 (the `fontFamily` Tailwind tokens point at `var(--font-heading)` / `var(--font-body)`).
- **Open question parked:** Q1 from §01 — Christian to confirm Jost (vs Futura PT paid licence). Default to Jost unless told otherwise; switching later is a one-line edit.

---

### S1-T03 — Type scale + canonical eyebrow class

- **Priority:** High
- **Effort:** S
- **Audit refs:** §01 F7, F29
- **Files to touch:** `tailwind.config.ts` (extend `fontSize`), `src/app/globals.css:66-71`
- **Current state:** Headings are sized ad-hoc per page (`text-3xl` here, `text-6xl` there). Eyebrow microcopy is reproduced in seven slightly-different `tracking-[0.NNem]` recipes across files.
- **Target state:** A documented major-third type scale registered as Tailwind `fontSize` tokens, plus one canonical `.pebl-eyebrow` recipe.
- **Implementation approach:**
  1. In `tailwind.config.ts theme.extend.fontSize`, add: `display: ['3rem', { lineHeight: '1.1', fontWeight: '700', letterSpacing: '-0.02em' }]`, `h1: ['2.25rem', { lineHeight: '1.15', fontWeight: '700' }]`, `h2: ['1.75rem', { lineHeight: '1.2', fontWeight: '700' }]`, `h3: ['1.375rem', { lineHeight: '1.3', fontWeight: '600' }]`, `eyebrow: ['0.75rem', { lineHeight: '1', letterSpacing: '0.18em', fontWeight: '700' }]`.
  2. Update `globals.css:66-71` `.pebl-eyebrow` to set `letter-spacing: 0.18em` (was 0.2em) so it matches the canonical token.
  3. Do **not** edit individual page heading classes in this ticket — that's a Sprint 5 polish job. We just register the tokens so Sprint 5 has somewhere to point.
- **Acceptance criteria:**
  1. `text-eyebrow` and `text-h1` Tailwind utilities compile.
  2. `.pebl-eyebrow` renders at `letter-spacing: 0.18em` (verifiable in DevTools on `/leaderboard` hero where the class is used directly).
  3. No visual regression on any existing page (the 0.2em → 0.18em change is sub-pixel-perceptible at the eyebrow font size).
- **Testing notes:** Playwright visual diff at the 0.1% threshold should pass after T13 lands.
- **Risk / rollback:** Trivial.
- **Dependencies:** T01.

---

### S1-T04 — Motion preset object + brand-safe confetti palette

- **Priority:** Medium
- **Effort:** S
- **Audit refs:** §01 F13, F19; §07 A11Y-14 (also fixed by this)
- **Files to touch:** `src/lib/motion.ts` (new), `src/lib/confetti.ts:8`
- **Current state:** Framer Motion durations cluster around 180-220ms but are duplicated per file. Two slightly-different springs (`stiffness: 320, damping: 22` and `300/20`). Confetti palette `["#06b6d4", "#0ea5e9", "#f97316", "#fbbf24", "#34d399", "#a78bfa"]` — orange `#f97316` violates the colorblind constraint.
- **Target state:**
  - New `src/lib/motion.ts` exporting `motion.fast = 0.16`, `motion.base = 0.22`, `motion.slow = 0.32`, `spring.cheer = { stiffness: 320, damping: 22 }`, `spring.gentle = { stiffness: 200, damping: 26 }`.
  - `confetti.ts:8` palette replaced with `["#3AAFA9", "#2B7A78", "#DEF2F1", "#FFFFFF", "#1F5F5D"]`.
- **Implementation approach:** Create the constants file; do **not** refactor existing call-sites — that's a Sprint 5 mechanical pass. Just confetti gets the palette swap because it's a one-line drop-in fix to a high-visibility colorblind-hazard.
- **Acceptance criteria:**
  1. Triggering a correct answer renders confetti in teal/white only — no orange.
  2. `import { motion as M } from '@/lib/motion'` works from a test file.
- **Testing notes:** Manual: answer one snippet correctly, screenshot the confetti burst.
- **Risk / rollback:** Confetti swap is one line.
- **Dependencies:** None (independent of token work).

---

### S1-T05 — Rewrite `pebl-button-*` in `@layer components` against tokens

- **Priority:** High
- **Effort:** S
- **Audit refs:** §01 F23, F26
- **Files to touch:** `src/app/globals.css:95-113`
- **Current state:** `.pebl-button-primary` uses `var(--accent)` for bg and `#2b9d97` (off-token) for hover. Disabled state implementations vary across components (3 different opacity values).
- **Target state:** Single recipe per button variant, expressed in Tailwind tokens via `@apply`, with one canonical disabled state.
- **Implementation approach:**
  1. Wrap the existing rules in `@layer components { ... }` so Tailwind can purge correctly.
  2. Convert to `@apply`:
     ```css
     @layer components {
       .pebl-button-primary { @apply bg-teal-500 text-navy-900 min-h-[44px] rounded-full font-semibold transition-colors; }
       .pebl-button-primary:hover { @apply bg-teal-800; }
       .pebl-button-primary:disabled { @apply opacity-50 cursor-not-allowed; }
       .pebl-button-secondary { @apply border border-navy-900/20 bg-white/72 text-navy-900 rounded-full; }
       .pebl-button-secondary:hover { @apply border-navy-900/50 bg-white/92; }
     }
     ```
  3. Same treatment for `.pebl-eyebrow` and `.pebl-surface`.
- **Acceptance criteria:**
  1. Existing usage of `pebl-button-primary` on `/` and `/auth/signin` renders identical pixels (visual diff ≤ 0.1%).
  2. Disabled signin submit button shows the canonical 50% opacity, not the current `bg-[color:var(--accent)]/70` recipe.
- **Testing notes:** Visual regression after T13 lands. Manual: hit `/auth/signin`, submit empty form, confirm disabled style.
- **Risk / rollback:** Revert globals.css.
- **Dependencies:** T01 (tokens must exist for `@apply` to resolve).

---

### S1-T06 — Custom ESLint rule for arbitrary-value Tailwind

- **Priority:** High
- **Effort:** M
- **Audit refs:** §01 F1 (root cause), §01 testing plan
- **Files to touch:** `.eslintrc.json` (or upgrade to `eslint.config.mjs`), new `eslint-rules/no-arbitrary-tailwind.js`, `package.json` (add `eslint-plugin-local-rules` ^3.0.2 or hand-roll via `--rulesdir`).
- **Current state:** `eslint-config-next` is configured. No custom rules. CI does not catch arbitrary-value Tailwind regressions.
- **Target state:** A no-restricted-syntax-style rule that flags string literals inside `className=` containing any of:
  - `bg-\[#[0-9a-fA-F]{3,8}\]`
  - `text-\[#[0-9a-fA-F]{3,8}\]`
  - `border-\[#[0-9a-fA-F]{3,8}\]`
  - `ring-\[#[0-9a-fA-F]{3,8}\]`
  - `rounded-\[\d+px\]`
  - `tracking-\[0\.\d+em\]`
  - `shadow-\[[^\]]+\]`
- **Implementation approach:** Cheapest path is **not** a full custom rule plugin — use `eslint`'s built-in `no-restricted-syntax` with a regex selector against `JSXAttribute[name.name="className"] Literal[value=/.../]`. Add as the new rule in `.eslintrc.json`:
  ```json
  {
    "extends": "next/core-web-vitals",
    "rules": {
      "no-restricted-syntax": ["error", {
        "selector": "JSXAttribute[name.name='className'] Literal[value=/bg-\\[#[0-9a-fA-F]{3,8}\\]|text-\\[#[0-9a-fA-F]{3,8}\\]|border-\\[#[0-9a-fA-F]{3,8}\\]|ring-\\[#[0-9a-fA-F]{3,8}\\]|rounded-\\[\\d+px\\]|tracking-\\[0\\.\\d+em\\]|shadow-\\[/]",
        "message": "Use a design token (Tailwind theme key) instead of an arbitrary-value Tailwind class. See tailwind.config.ts. If you genuinely need a new token, add it there first."
      }]
    }
  }
  ```
  Add to `package.json` scripts: `"lint:tokens": "eslint --max-warnings 0 src/"`. (The regular `next lint` will also catch it.)
- **Acceptance criteria:**
  1. `npm run lint` reports >0 errors today (it will — the codebase is full of them). Add `eslint-disable-next-line` comments to existing offenders **only** as a transition strategy; the codemod in T07 removes them properly.
  2. A PR adding a new `<div className="bg-[#3AAFA9]">` fails `npm run lint`.
  3. A PR adding `<div className="bg-teal-500">` passes.
- **Testing notes:** Author a deliberate offending PR locally; confirm CI fails. Then revert.
- **Risk / rollback:** Single config file revert.
- **Dependencies:** T01 (the tokens must exist before lint forces people to use them).

---

### S1-T07 — Codemod / manual pass: replace arbitrary-value classes in worst offenders

- **Priority:** High
- **Effort:** L (4-12hr; iterative, file-by-file)
- **Audit refs:** §01 F1, F3 (three teals), F4 (`#59c8c3`), F5 (`#0f1d22`), F31
- **Files to touch (priority order — most offending first):** `src/components/FeedCard.tsx`, `src/components/IdGuideChat.tsx`, `src/components/IdGuideWizard.tsx`, `src/components/IdGuideChipFallback.tsx`, `src/components/IdGuideTrigger.tsx`, `src/components/IdGuideSheet.tsx`, `src/components/SideMenu.tsx`, `src/components/SettingsMenu.tsx`, `src/components/Header.tsx`, `src/components/MapModal.tsx`, `src/components/RarityPanel.tsx`, `src/components/SpeciesGallery.tsx`, `src/components/SnippetPlayer.tsx`, `src/components/FeedPlayer.tsx`.
- **Current state:** ~150+ raw hex literals in `className=` strings across the immersive surface. `#3AAFA9`, `#17252A`, `#0f1d22`, `#59c8c3`, `#DEF2F1`, `#2b9d97` are the main offenders. Five `rounded-[Npx]` values, four red tones.
- **Target state:** Every offender from the lint rule in T06 is gone or covered by an `eslint-disable` with a tracked-debt comment.
- **Implementation approach:**
  1. **Mechanical replacement map** (apply via Grep+Edit, file at a time):
     - `bg-[#3AAFA9]` → `bg-teal-500`
     - `text-[#3AAFA9]` → `text-teal-500` (Sprint 5 will downgrade many of these to `text-teal-50` on dark per A11Y-01 — for now just retoken)
     - `bg-[#17252A]` → `bg-navy-900`
     - `bg-[#17252A]/72` → `bg-navy-900/72`
     - `bg-[#0f1d22]` → `bg-navy-800`
     - `text-[#DEF2F1]` → `text-teal-50`
     - `bg-[#DEF2F1]` → `bg-teal-50`
     - `hover:bg-[#59c8c3]` → `hover:bg-teal-400`
     - `hover:text-[#59c8c3]` → `hover:text-teal-400`
     - `rounded-[28px]` → `rounded-hero`
     - `rounded-[24px]` → `rounded-card`
     - `rounded-[22px]` → `rounded-card` (per F6: drop 22, collapse onto 24)
     - `rounded-[16px]` and existing `rounded-2xl` on modal containers → `rounded-modal`
     - `tracking-[0.16em]` / `tracking-[0.18em]` / `tracking-[0.2em]` / `tracking-[0.22em]` → `tracking-eyebrow`
     - `text-red-300`, `text-red-600`, `text-red-700`, `text-red-200` → `text-danger-onDark` (on dark) / `text-danger` (on light). Editor judgement per call-site.
     - `text-amber-200 bg-amber-300/20` (rare-find badge in RarityPanel.tsx:147-149 and IdGuideSheet.tsx:312) → leave for Sprint 5 — F9 wants a redesign, not just a recolour.
  2. **Do not refactor structure or behaviour** — this is a token-bypass cleanup pass only.
  3. After each file, run `npm run lint` to confirm no fresh violations. Drop the `eslint-disable` lines you added for that file.
- **Acceptance criteria:**
  1. `npm run lint` passes on `main` with zero token-bypass errors and zero `eslint-disable-next-line no-restricted-syntax` directives.
  2. Playwright visual diff against the pre-token baseline (captured in T01) is ≤ 0.5% per surface — the small drift is from the `22px → 24px` and `0.2em → 0.18em` collapses, and from any teal tone-mapping. Anything over 0.5% needs investigation before merge.
- **Testing notes:** This ticket is the highest visual-regression risk in the sprint. Run T13's Playwright visual diff after every 2-3 component files. If a diff is unexpectedly large, the offender will be in the latest batch.
- **Risk / rollback:** Per-file commits so individual rollbacks are cheap.
- **Dependencies:** T01 (tokens exist), T06 (lint rule exists so progress is enforceable), T13 (visual regression for verification — if T13 lands after T07 just batch the screenshots manually).

---

### S1-T08 — Add `error.tsx` and `global-error.tsx`

- **Priority:** High
- **Effort:** S
- **Audit refs:** §04 F6; §07 PERF-13
- **Files to touch:** `src/app/error.tsx` (new), `src/app/global-error.tsx` (new)
- **Current state:** Neither file exists. A thrown error in a server component (Prisma timeout, OBIS failure) shows the default Next.js error overlay in dev and an unstyled error page in production.
- **Target state:** Branded error fallback with a "Try again" button calling the provided `reset()` and a "Back to feed" link. `global-error.tsx` for the root-level catch-all that re-renders `<html>`.
- **Implementation approach:**
  ```tsx
  // src/app/error.tsx
  "use client";
  import Link from "next/link";
  import { useEffect } from "react";
  export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => { console.error(error); /* optional: ship to error tracker */ }, [error]);
    return (
      <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <div className="pebl-surface rounded-hero p-6 md:p-8 text-center">
          <p className="pebl-eyebrow">Something went wrong</p>
          <h1 className="mt-3 font-brand text-h1 text-navy-900">We hit a snag loading this page.</h1>
          <p className="mt-3 text-sm text-navy-900/72">{error.digest ? `Error ref: ${error.digest}` : "If this keeps happening, try refreshing or coming back later."}</p>
          <div className="mt-6 flex flex-col gap-2">
            <button onClick={reset} className="pebl-button-primary">Try again</button>
            <Link href="/feed" className="pebl-button-secondary text-center py-3">Back to live feed</Link>
          </div>
        </div>
      </main>
    );
  }
  ```
  `global-error.tsx` is identical but wraps in `<html><body>` because it replaces the root layout.
- **Acceptance criteria:**
  1. Throwing `throw new Error('test')` inside `src/app/page.tsx` at the top of the component renders the branded error card, not a blank screen.
  2. Clicking "Try again" calls `reset()` and re-renders.
  3. Both files are client components (`"use client"` at top).
- **Testing notes:** Manual: add a `throw new Error()` to a route, refresh, confirm. Playwright (T13): visit a route with a query string flag like `?__throw=1` that the page reads in dev — too much scaffolding for Sprint 1, defer.
- **Risk / rollback:** Additive; delete files to revert.
- **Dependencies:** T01 (uses tokens). Could ship before T07 finishes.

---

### S1-T09 — Add `not-found.tsx` at root + `feed/[id]/not-found.tsx`

- **Priority:** Medium
- **Effort:** S
- **Audit refs:** §04 F5
- **Files to touch:** `src/app/not-found.tsx` (new), `src/app/feed/[id]/not-found.tsx` (new)
- **Current state:** No `not-found.tsx` exists. `src/app/feed/[id]/page.tsx:23` calls `notFound()` for missing snippets — currently falls through to Next's default unstyled 404.
- **Target state:** Branded 404 at root for any unmatched route; snippet-specific copy for retired snippets.
- **Implementation approach:** Mirror T08 structure but for 404 semantics. Root one says "Page not found" with links to `/feed` and `/feed/browse`. Snippet one says "This sighting may have been retired" with a "Back to live feed" link.
- **Acceptance criteria:**
  1. Visiting `/no-such-route` shows the branded 404, not Next's default.
  2. Visiting `/feed/clx_nonexistent` shows the snippet-specific 404 copy.
- **Testing notes:** Manual + Playwright spec in T13.
- **Risk / rollback:** Trivial.
- **Dependencies:** T01.

---

### S1-T10 — Add `loading.tsx` per route segment

- **Priority:** Medium
- **Effort:** S
- **Audit refs:** §04 F7; §07 PERF-12
- **Files to touch:** `src/app/feed/loading.tsx`, `src/app/feed/browse/loading.tsx`, `src/app/leaderboard/loading.tsx`, `src/app/auth/signin/loading.tsx` (new files)
- **Current state:** `/feed`, `/feed/browse`, `/leaderboard` are `force-dynamic`. Cold renders block on Prisma. User sees previous page with no skeleton until new HTML arrives.
- **Target state:** Each route shows a PEBL-skinned skeleton during server work — animated `pebl-surface` pulsing tiles matching the route's first-paint layout.
- **Implementation approach:**
  - `/feed/loading.tsx`: a single dark `bg-navy-900` full-bleed div with a centred pulsing pebl-surface card matching the floating panel position.
  - `/feed/browse/loading.tsx`: header card placeholder + 6 `aspect-video rounded-card bg-white/40 animate-pulse` tiles in the same grid as the real page.
  - `/leaderboard/loading.tsx`: hero card placeholder + 5 table-row placeholders.
  - `/auth/signin/loading.tsx`: form-shaped pebl-surface placeholder (replaces the `text-slate-400` "Loading…" Suspense fallback at signin/page.tsx:133).
- **Acceptance criteria:**
  1. Throttling the network to "Slow 3G" and navigating to `/feed/browse` shows the skeleton before the real grid.
  2. No layout shift between skeleton and real content (skeleton matches grid template).
- **Testing notes:** Lighthouse CI (T14) will see this as better perceived perf — verify after T14 lands.
- **Risk / rollback:** Additive; delete files to revert.
- **Dependencies:** T01.

---

### S1-T11 — Answer-gate `/api/snippets/[id]/stats` and `/api/snippets/[id]/probability`

- **Priority:** Critical
- **Effort:** M
- **Audit refs:** §03 F6, F7; README Theme E
- **Files to touch:** `src/app/api/snippets/[id]/stats/route.ts:33-37`, `src/app/api/snippets/[id]/probability/route.ts:95-102`, `src/components/FeedCard.tsx` (caller adjustments), `src/lib/useCreatureQuiz.ts`
- **Current state:**
  - `stats/route.ts` returns `{ total, stats, staffAnswer: snippet.staffAnswer }` to any caller, unauthenticated. A scraper can `GET /api/snippets/:id/stats` for every snippet and harvest staff answers.
  - `probability/route.ts` returns `staffAnswerScientific` to any caller. Same spoiler risk.
- **Target state:** Both endpoints check whether the current session user has an `Answer` row for this snippet. If yes (or if user has staff role — Sprint 6 work, ignored here), return the full payload. If no, return the non-sensitive subset:
  - `stats`: return `{ total, stats }` but **not** `staffAnswer`. The community percent breakdown is still useful as a pre-answer "X% of community said Y" tease, but withholding `staffAnswer` means a scraper can't read the answer out.
  - `probability`: return `{ status, source, totalRecords, species, fetchedAt }` but **not** `staffAnswerScientific`. The species list is ecological context (which species are seen in this bucket per OBIS) — that's not the same as revealing the staff answer.
- **Implementation approach:**
  1. Import `getServerSession` + `authOptions` (already used elsewhere; check `src/app/api/answers/route.ts` for the canonical import path).
  2. In each route, after fetching the snippet:
     ```ts
     const session = await getServerSession(authOptions);
     const userHasAnswered = !!(session?.user?.id && await prisma.answer.findFirst({
       where: { userId: session.user.id, snippetId: id },
       select: { id: true },
     }));
     ```
  3. Build the response conditionally:
     ```ts
     return NextResponse.json({
       total, stats,
       ...(userHasAnswered ? { staffAnswer: snippet.staffAnswer } : {}),
     });
     ```
  4. Update `useCreatureQuiz.ts` / `FeedCard.tsx` to expect `staffAnswer` to be `undefined` until the user has answered, and to refetch after `POST /api/answers` succeeds (the post-submit path already fetches stats; just need to ensure it does so after the answer is committed).
  5. **Important:** the OBIS species list itself is not a spoiler unless one assumes the user is going to look at it pre-answer in the UI. The current UI only shows it post-answer in RarityPanel, which is fine. Do not block the species list pre-answer — that would break Sprint 2's planned MCQ feature which needs it.
- **Acceptance criteria:**
  1. `curl https://fish-spotter.vercel.app/api/snippets/<id>/stats` (no cookies) returns `{ total, stats }` only — no `staffAnswer` key.
  2. Signed-in user who has NOT answered snippet X: same response.
  3. Signed-in user who HAS answered snippet X: `staffAnswer` is present.
  4. Same matrix for `/probability` re `staffAnswerScientific`.
  5. The post-answer reveal UI on `/feed` still shows "was {staffAnswer}" correctly because the second fetch (post-submit) sees the new Answer row.
- **Testing notes:** Three Playwright contract tests in T13:
  - Anonymous → no `staffAnswer` key.
  - Signed-in pre-answer → no `staffAnswer` key.
  - Signed-in post-answer → `staffAnswer` key present.
- **Risk / rollback:** Medium — must ensure the UI doesn't break for unanswered snippets. Mitigation: extensive Playwright coverage on the feed quiz flow before merge.
- **Dependencies:** None server-side; tests rely on T13.

---

### S1-T12 — Validate `callbackUrl` + client-side router push on signin

- **Priority:** Critical
- **Effort:** S
- **Audit refs:** §04 F10, F11; README Theme E
- **Files to touch:** `src/app/auth/signin/page.tsx:10, 38`
- **Current state:**
  - Line 10: `const callbackUrl = searchParams.get("callbackUrl") ?? "/feed";` — no validation. `/auth/signin?callbackUrl=https://evil.example.com` redirects to attacker domain after credentials submit.
  - Line 38: `window.location.href = callbackUrl;` — full document load, defeats App Router client transitions.
- **Target state:** `callbackUrl` is only accepted if it is a relative path starting with `/` and not starting with `//` (which would be a protocol-relative URL). After successful signin, `router.push(safeCallback); router.refresh();`.
- **Implementation approach:**
  ```ts
  import { useRouter } from "next/navigation";
  // inside SignInForm:
  const router = useRouter();
  const rawCallback = searchParams.get("callbackUrl") ?? "/feed";
  const safeCallback = /^\/(?!\/)/.test(rawCallback) ? rawCallback : "/feed";
  // …in handleSubmit, replace window.location.href line with:
  router.push(safeCallback);
  router.refresh();
  ```
  The regex `^\/(?!\/)` requires the URL to start with `/` and not be followed by another `/` (which would be the `//evil.com` protocol-relative trick). Reject anything else (full URLs with scheme, fragment-only, query-only, empty) back to `/feed`.
- **Acceptance criteria:**
  1. `GET /auth/signin?callbackUrl=https://evil.example.com` and submitting valid credentials lands on `/feed`, not `evil.example.com`.
  2. `GET /auth/signin?callbackUrl=//evil.example.com` → redirects to `/feed`.
  3. `GET /auth/signin?callbackUrl=/feed/clx_abc` → after successful signin, user is on `/feed/clx_abc` via App Router client transition (verify by watching Network tab — no full document load).
  4. `GET /auth/signin` (no callbackUrl) → after submit, user is on `/feed`.
- **Testing notes:** Playwright spec in T13 explicitly hits the `https://evil.example.com` case and asserts URL on success.
- **Risk / rollback:** Very low. Five-line patch.
- **Dependencies:** None.

---

### S1-T13 — Playwright + `@axe-core/playwright` scaffold

- **Priority:** High
- **Effort:** L
- **Audit refs:** §01 testing plan, §07 testing plan
- **Files to touch:** `playwright.config.ts` (new), `tests/e2e/nav-smoke.spec.ts`, `tests/e2e/security.spec.ts`, `tests/a11y/axe-smoke.spec.ts`, `tests/visual/baseline.spec.ts`, `package.json` (devDeps + scripts), `.github/workflows/playwright.yml` (new).
- **Current state:** No e2e or a11y test infrastructure.
- **Target state:** Playwright runs `npm run dev` (or `npm run build && npm run start`) on localhost:3000, executes specs in Chromium against 375 + 1280 viewports, and:
  - Smoke spec: visit each of `/`, `/feed`, `/feed/browse`, `/leaderboard`, `/auth/signin`, assert HTTP 200, assert `<h1>` exists (or `aria-label` on main), assert no console errors.
  - Security spec: `/auth/signin?callbackUrl=https://evil.example.com` rejection (T12); anonymous `/api/snippets/<seeded-id>/stats` returns no `staffAnswer` (T11).
  - axe-core spec: scan each of the five surfaces, fail on `serious` or `critical` violations, log `moderate` as a counter.
  - Visual baseline: one screenshot per surface at 375 + 1280, stored under `tests/visual/__screenshots__/`.
- **Implementation approach:**
  1. `npm install -D @playwright/test@^1.46.0 @axe-core/playwright@^4.10.0` + `npx playwright install --with-deps chromium`.
  2. `playwright.config.ts`:
     ```ts
     import { defineConfig, devices } from '@playwright/test';
     export default defineConfig({
       testDir: './tests',
       webServer: { command: 'npm run dev', url: 'http://localhost:3000', timeout: 120_000, reuseExistingServer: !process.env.CI },
       use: { baseURL: 'http://localhost:3000' },
       projects: [
         { name: 'mobile', use: { ...devices['iPhone 14 Pro'] } },
         { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
       ],
       expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.005 } },
     });
     ```
  3. Seed a known-state DB before Playwright runs: extend `package.json` with `"test:e2e": "playwright test"` and a `"pretest:e2e": "npx tsx --env-file=.env.local scripts/seed.ts"` step. (Sprint 2 should split this into a dedicated test fixture; Sprint 1 reuses prod seed.)
  4. GitHub Action workflow runs on every PR; uploads HTML report on failure.
- **Acceptance criteria:**
  1. `npm run test:e2e` passes locally on a clean checkout.
  2. CI runs Playwright on PR; failure visible in GitHub checks.
  3. Test for T12 explicitly asserts URL after signin with hostile callbackUrl.
  4. Test for T11 explicitly asserts the response body shape with and without an answer row.
- **Testing notes:** Self-validating — the tests ARE the testing notes for T11 / T12.
- **Risk / rollback:** Test infra; doesn't affect production.
- **Dependencies:** T11 + T12 done first (so their specs can be written against real behaviour). T01-T05 ideally done before visual baseline is captured (or capture two baselines: one pre-token-work, one post, and discard the pre after T07 lands).

---

### S1-T14 — Lighthouse CI with budgets

- **Priority:** Medium
- **Effort:** M
- **Audit refs:** §07 testing plan, PERF-15
- **Files to touch:** `.lighthouserc.json` (new), `.github/workflows/lighthouse.yml` (new), `package.json` (devDep + script).
- **Current state:** No automated perf budget. CLAUDE.md notes web-vitals are not currently monitored.
- **Target state:** `@lhci/cli` runs against `/`, `/feed`, `/feed/browse`, `/leaderboard` on every PR, asserting:
  - `largest-contentful-paint` < 2500
  - `cumulative-layout-shift` < 0.1
  - `interaction-to-next-paint` < 200 (or `total-blocking-time` < 200 if INP isn't reliable from Lighthouse yet)
  - `resource-summary:script:size` < 350_000 bytes on `/feed`, < 200_000 on the others.
- **Implementation approach:**
  ```json
  // .lighthouserc.json
  {
    "ci": {
      "collect": {
        "url": ["http://localhost:3000/", "http://localhost:3000/feed", "http://localhost:3000/feed/browse", "http://localhost:3000/leaderboard"],
        "startServerCommand": "npm run build && npm run start",
        "startServerReadyPattern": "Ready",
        "numberOfRuns": 2,
        "settings": { "preset": "desktop" }
      },
      "assert": {
        "assertions": {
          "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
          "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
          "total-blocking-time": ["warn", { "maxNumericValue": 200 }],
          "resource-summary:script:size": ["warn", { "maxNumericValue": 350000 }]
        }
      },
      "upload": { "target": "temporary-public-storage" }
    }
  }
  ```
  Add `"lh:ci": "lhci autorun"` to package.json scripts.
- **Acceptance criteria:**
  1. `npm run lh:ci` runs locally and emits a Lighthouse report URL.
  2. PRs that regress LCP past 2500ms on `/feed` fail the lighthouse-ci GitHub check.
  3. Initial baseline run captures current numbers — document them in `audit/baseline-2026-05-18-perf.md` for future Sprint 4 perf-work comparison.
- **Testing notes:** Run on `main` first to establish baseline. Tune budgets if current state already violates (start with `warn` rather than `error` for any budget the app already misses).
- **Risk / rollback:** No production effect.
- **Dependencies:** T13 (shares the dev-server start pattern). Can be done in parallel.

---

### S1-T15 — Storybook scaffold

- **Priority:** Medium
- **Effort:** M
- **Audit refs:** §01 testing plan
- **Files to touch:** `.storybook/main.ts`, `.storybook/preview.ts`, `src/stories/Button.stories.tsx`, `src/stories/Card.stories.tsx`, `src/stories/Eyebrow.stories.tsx`, `package.json`.
- **Current state:** No Storybook. Component-level visual review happens only by running the dev server.
- **Target state:** Storybook 8 boots locally (`npm run storybook`) with one stub story per design primitive. Tailwind + globals.css loaded in preview. Stories use the tokens from T01.
- **Implementation approach:**
  1. `npx storybook@latest init --type nextjs` (auto-configures Next-aware Storybook 8).
  2. Add `@storybook/addon-a11y` for in-Storybook axe checks.
  3. In `.storybook/preview.ts`, import `'../src/app/globals.css'` and set `parameters.layout = 'centered'`.
  4. Stub stories for `<Button>`, `<Card>`, `<Eyebrow>`, `<Chip>` — Sprint 5 extracts these into real components from inline JSX. For Sprint 1, the stories live in `src/stories/` and render raw JSX using token classes:
     ```tsx
     // src/stories/Button.stories.tsx
     export default { title: 'Primitives/Button' };
     export const Primary = () => <button className="pebl-button-primary px-6">Primary</button>;
     export const Disabled = () => <button className="pebl-button-primary px-6" disabled>Disabled</button>;
     ```
- **Acceptance criteria:**
  1. `npm run storybook` opens Storybook at localhost:6006.
  2. Four stub stories visible.
  3. Tailwind classes resolve (button shows teal background).
- **Testing notes:** Not gated in CI in Sprint 1; gating moves in when Sprint 5 ships real components.
- **Risk / rollback:** Dev-only.
- **Dependencies:** T01 (for tokens to render in stories).

---

### S1-T16 — `ffprobe` codec CI guard

- **Priority:** Medium
- **Effort:** S
- **Audit refs:** CLAUDE.md "Video / Codec Notes (IMPORTANT)"; §02 testing plan
- **Files to touch:** `scripts/check-codecs.ts` (new), `.github/workflows/codec-guard.yml` (new), `package.json`.
- **Current state:** All 30 clips are H.264. There is no automated guard preventing a future seed from re-introducing an mp4v (MPEG-4 Part 2 Visual) clip — which would cause silent playback failure in Chrome on the live site.
- **Target state:** A nightly + on-merge GitHub Action that:
  1. Connects to Supabase Storage (using `SUPABASE_SERVICE_ROLE_KEY`).
  2. Reads `Snippet.videoUrl` from the live DB via Prisma.
  3. For each URL, runs `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0` and asserts the output is `h264`.
  4. Fails the workflow with a list of offending URLs if any clip is not H.264.
- **Implementation approach:**
  ```ts
  // scripts/check-codecs.ts
  import { exec } from "node:child_process";
  import { promisify } from "node:util";
  import { prisma } from "../src/lib/prisma";
  const run = promisify(exec);
  async function codec(url: string) {
    const { stdout } = await run(`ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of csv=p=0 "${url}"`);
    return stdout.trim();
  }
  async function main() {
    const snippets = await prisma.snippet.findMany({ select: { id: true, externalId: true, videoUrl: true } });
    const bad: string[] = [];
    for (const s of snippets) {
      const c = await codec(s.videoUrl);
      if (c !== "h264") bad.push(`${s.externalId} (${s.id}): ${c}`);
    }
    if (bad.length) { console.error("Non-H.264 clips found:\n" + bad.join("\n")); process.exit(1); }
    console.log(`All ${snippets.length} clips are H.264.`);
  }
  main();
  ```
  GitHub Action installs ffmpeg via apt, runs `npx tsx scripts/check-codecs.ts`.
- **Acceptance criteria:**
  1. Workflow passes today (all clips are H.264 per CLAUDE.md).
  2. If a test mp4v clip were uploaded, workflow would fail and identify the externalId.
- **Testing notes:** Manually upload an mp4v clip to a staging URL, run script locally, confirm it fails.
- **Risk / rollback:** No production effect.
- **Dependencies:** None.

---

### S1-T17 — Fix skip-link `<main>` focus target

- **Priority:** Low
- **Effort:** S
- **Audit refs:** §07 A11Y-04
- **Files to touch:** `src/app/feed/page.tsx:58`, `src/app/feed/browse/page.tsx:28`, `src/app/leaderboard/page.tsx:56`, `src/app/page.tsx`, `src/app/auth/signin/page.tsx:48`
- **Current state:** Skip link exists in `layout.tsx:39`. Targets `<main id="main">` on each route, but `<main>` does not have `tabIndex={-1}`. In Firefox/Safari the anchor scrolls but does not move focus, so pressing Tab after activating Skip lands on the header menu button, defeating the link.
- **Target state:** Every `<main id="main">` in the codebase has `tabIndex={-1}`. The `:focus-visible` outline already defined in `globals.css:56` will make the focus move visible.
- **Implementation approach:** Mechanical — Grep `id="main"` across `src/app/`, add `tabIndex={-1}` to each.
- **Acceptance criteria:**
  1. On Firefox or Safari, load `/`, press Tab, activate Skip link with Enter, press Tab — focus is inside `<main>` content, not on the header.
  2. axe-core (T13) reports no regressions.
- **Testing notes:** Manual cross-browser + Playwright keyboard nav assertion (extend the T13 smoke spec).
- **Risk / rollback:** Trivial.
- **Dependencies:** None. Piggybacks on the routing-shell ticket group (T08-T10).

---

## Open questions parked for product / design

These come up while planning Sprint 1 but are out-of-scope for this sprint's tickets. Capturing here so Sprint 2-3 picks them up:

1. **Q1 (audit §01 open question 1):** Confirm **Jost** as the Futura substitute. Default in T02 unless told otherwise.
2. **Q2 (audit §01 open question 3):** Should `--surface-muted` (`#eef9f8`) and `teal.50` (`#DEF2F1`) coexist long-term, or consolidate? Sprint 1 keeps both; Sprint 5 polish decides.
3. **Q3 (audit §03):** The audit's Theme D notes the implementation/brief mismatch (free-text vs MCQ). Sprint 1's API gating (T11) is designed to NOT block the OBIS species list, so Sprint 2's MCQ work is unblocked either way.
4. **Q4:** Does Christian want the Lighthouse budgets in T14 to be `error` (PR-blocking) or `warn` (advisory) on day one? Plan defaults to `warn` until a baseline week is captured.

---

*Sprint 1 plan generated 2026-05-18 against worktree `claude/angry-allen-76508d`. 17 tickets. Cross-references every relevant finding from audit/ux-2026-05/{00,01,03,04,07}.md.*
