# FishSpotter — Whole-App UX & Visual Review: PLAN

**Date:** 2026-06-04
**Depth:** Exhaustive (per-persona walkthroughs, 2-3 independent verifiers per finding, screenshot evidence for capturable surfaces, completeness-critic pass).
**Author:** Claude (multi-agent orchestration).
**Output report:** `implementation/2026-06-04/ux-visual-review.md`.

---

## 1. Purpose & framing

This is a **current-state, whole-app, end-to-end, all-abilities** review. It does three jobs at once:

1. **Re-verify** that the fixes from prior reviews have **not regressed** (a real risk: this branch has had concurrent sessions overwrite committed work).
2. **Audit the new surfaces** shipped since 2 Jun that **no UX review has covered**: the Spot-It rung flow, the Gemini-built reference galleries + `SpeciesGuidePopup`/`SpeciesGallery`, `MarineBackdrop`, the **ICO age-gate** at sign-up, profile/account changes.
3. **Judge the holistic flow** — not just per-component correctness, but whether the *journeys* are simple, intuitive, well-spaced, readable, non-overlapping, and sensible **for all abilities**.

## 2. What we logged in the past (this review reconciles against all of it)

| Date | Doc | Method | Result |
|---|---|---|---|
| 27 May | `implementation/2026-05-27/design-review.md` | 14 agents (9 static + 5 journeys) | 14 blockers, 31 polish, 18 nits; anti-patterns added to CLAUDE.md |
| 1 Jun | `implementation/2026-06-01/spot-it-ux-review.md` | 6-dimension review of the Spot-It prototype | P1 murky-safe dead-ends, touch targets, static "dopamine" strip |
| 2 Jun | `implementation/2026-06-02/design-audit.md` | 12 lenses, per-finding adversarial verify | 61 findings -> 21 themes; **all shipped + closed** |
| 2 Jun | `implementation/2026-06-02/landing-redesign.md` | Landing rebuild | underwater hero shipped |

**Every finding in this review is tagged against that history:** `fixed` (confirmed resolved), `still-open`, `regressed` (was fixed, came back), or `new`.

## 3. Scope

**Surfaces (all 16 routes + states):** `/` landing · `/feed` · `/feed/[id]` · `/feed/browse` · `/leaderboard` · `/u/[id]` profile · `/account` · `/auth/signin` (incl. sign-up + age-gate) · `/auth/forgot` · `/auth/reset/[token]` · `/auth/verify` · `/admin` · `/admin/species` · `/admin/species/[name]` · `/privacy` · `/terms` · `/accessibility`. Plus the global chrome (`Header`, `SideMenu`, `AvatarMenu`, `SettingsMenu`), modals/sheets (`IdGuideSheet`, `MapModal`, `SpeciesGallery`, `ShapeGate`, `SpeciesGuidePopup`), and the onboarding tour + cookie banner.

**States:** first-time vs returning · empty · loading (skeletons) · error · success/reveal · signed-out vs signed-in · age-gated.

**Breakpoints:** 390 (mobile, primary), 768 (tablet), 1440 (desktop).

**Journeys (end-to-end, not just screens):**
- J1 First-run: land -> sign-up (age-gate) -> onboarding -> first Spot-It -> reveal -> streak.
- J2 Daily-driver: return -> feed -> identify several -> leaderboard -> profile.
- J3 Anonymous: land -> try feed/browse/leaderboard -> hit gates -> understand why.
- J4 Admin authoring: `/admin/species` -> author marks -> curation gates -> save feedback.

## 4. Evaluation lenses (the user's questions -> a rubric)

| # | Lens | Question it answers | Heuristic basis |
|---|---|---|---|
| L1 | Simplicity & intuitiveness | Is it simple? Intuitive? | Nielsen #2 (match real world), #6 (recognition not recall), #8 (minimalist) |
| L2 | Layout integrity | Are things overlapping / clipping / misaligned? | reflow at each breakpoint, z-index, safe-areas |
| L3 | Spacing & rhythm | Nicely spaced? | density, grouping, whitespace, vertical rhythm |
| L4 | Readability | Clear to read? | type scale, contrast, line-length (45-75ch), reading age |
| L5 | Flow & navigation | Sensible flow? | dead-ends, back-affordances, wayfinding, session persistence, Nielsen #3 (user control) |
| L6 | Accessibility (all abilities) | Suitable for all abilities? | **WCAG 2.2 AA** — keyboard, SR semantics, colourblind, 200% zoom, **44px touch**, reduced-motion, cognitive load, **ICO age-appropriate (children/teens)** |
| L7 | Brand & token consistency | (regression guard) | the documented design system in CLAUDE.md |
| L8 | Motion & feedback | (regression + new surfaces) | `src/lib/motion.ts`, reduced-motion, immediate feedback |
| L9 | Microcopy & content design | (clarity, jargon, tone) | plain English, no jargon, consistent voice |

## 5. Personas ("all abilities")

P1 first-time novice (cognitive load, jargon) · P2 daily-driver (efficiency) · P3 anonymous (gating clarity) · P4 keyboard-only · P5 screen-reader (NVDA/VoiceOver) · P6 low-vision / 200% zoom / **colourblind** (the product owner) · P7 motor-impaired (touch, drag alternatives) · P8 motion-sensitive (reduced-motion) · P9 **13-17 teen** (ICO age-appropriate design code) · P10 one-handed mobile.

## 6. Methodology (Exhaustive)

1. **Walk** — capture a screenshot evidence set for every *capturable* (anon-accessible) surface at 390/768/1440 + key states; index by path. Auth-gated surfaces (signed-in feed, profile, account, admin) are reviewed via code + component analysis (the preview can't authenticate), and that coverage gap is stated explicitly.
2. **Find** — parallel finders across three axes: **per-surface** (each route/flow), **per-dimension** (L1-L9), **per-persona** (P1-P10 journey walkthroughs). Each emits structured findings: `surface, lens, persona, severity, evidence (file:line and/or screenshot), recommendation, effort, past-log status`.
3. **Verify** — **2-3 independent adversarial verifiers per finding**: re-open the cited evidence, refute by default, and reconcile against the past logs (fixed/open/regressed/new). Majority-confirm to keep.
4. **Completeness critic** — a pass that asks "what surface/state/persona/lens was under-covered?" and spawns top-ups.
5. **Synthesize** — dedup -> themes -> severity + effort -> prioritised fix order -> "what's already good" -> dimension-coverage note -> reconciliation matrix vs past logs -> proposed CLAUDE.md anti-patterns.

## 7. Severity & effort

**Severity:** Blocker (broken/ships-stopping or WCAG-A/AA fail on a primary surface) · P1 (notable UX/brand/flow issue) · P2 (visible polish) · P3 (nit). **Effort:** S (<2h) · M (2-4h) · L (4-8h).

## 8. Deliverables

- This plan (committed).
- `implementation/2026-06-04/ux-visual-review.md` — the report: executive summary, findings by surface **and** by lens, severity + effort, prioritised order, "what's already good", **reconciliation matrix** (every past finding's current status), dimension/persona coverage note, screenshot references.
- Proposed CLAUDE.md design-rule additions if new anti-patterns emerge.
- A prioritised, actionable backlog.

## 9. Caveats

- **Moving target:** the app has concurrent active development. The review snapshots a specific commit (recorded in the report) and reviews the **committed** state; uncommitted parallel WIP is out of scope.
- **Auth-gated visual coverage:** the preview tool cannot sign in, so signed-in surfaces are reviewed from code + component structure, not live screenshots. This is the one known coverage limitation.
- **Screenshot tooling** has been intermittently flaky this branch; visual evidence is captured best-effort and supplemented by code analysis.
