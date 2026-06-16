# FishSpotter: Vision-Based UX Review (14 Jun 2026)

A comprehensive, evidence-based visual UX review of the **entire** FishSpotter app
against its goal: being engaging and easy to use for the general public as a
citizen-science marine-monitoring tool. Conducted with an agent team and grounded
in 40 real screenshots of the live production site.

> **STATUS: Waves 0, 1, 2 of the plan are SHIPPED, deployed, and verified live**
> (commits `10adaa0`, `6738572`, `82748a0` on `main`). The stray test accounts
> were deleted and the live `feed-05` em-dash is fixed (both DONE; the
> Housekeeping section below is retained for the record). **Next: Wave 3.** See
> `02-implementation-plan.md` for the full status and the remaining waves.

## What's in this folder (read in this order)

1. **`02-implementation-plan.md`** ← the deliverable to act on. A sequenced,
   file-level, 7-wave build plan with acceptance criteria + verification. Start
   with its **Errata & scope limits** section, then Wave 0.
2. **`01-consolidated-findings.md`** — 38 prioritised findings (4 P0 / 15 P1 /
   15 P2 / 4 P3), the 6 cross-cutting themes, the "what's genuinely good (keep)"
   list, and the Top 10 highest-leverage fixes.
3. **`03-completeness-critique.md`** — the adversarial critic pass that corrected
   the findings (incl. the verdict-token error) and named the review's blind spots.
4. **`00-screenshot-manifest.md`** — index of the 40 screenshots in `shots/`.
5. **`_BRIEF.md`** — the shared reviewer brief (criteria + design system + format).
6. **`findings/A..G-*.md`** — the seven raw specialist findings files (source detail).
7. **`shots/`** — the 40 PNGs (gitignored; regenerate via the capture scripts).
8. **`capture-*.ts`, `verify-recapture.ts`** — the Playwright capture harness;
   keep these — they are the visual-regression harness the plan refers to.

## Method (agent team)

- **Phase 1 — Capture:** Playwright drove the live site and screenshotted every
  surface and interaction state — landing, the full guest "Spot It" core loop
  (idle → shape gate → sub-split → candidate tiles → species flash-card → reveal →
  minimized → map), the single-snippet page, browse, leaderboard, species pages,
  auth (sign-in/up/forgot), the signed-in journey (onboarding tour → authed reveal
  → menu → account → profile/pokédex), and the legal/error pages, at mobile (390px)
  and desktop (1280px). 40 shots.
- **Phase 2 — Analyse:** seven specialist vision agents (first-impression/funnel,
  core loop, reveal/reward, auth/account, discovery/collection, design-system+a11y,
  engagement strategy) each read their screenshots and produced structured findings
  against the PEBL design system + UX heuristics + citizen-science best practice.
  Key screens were covered by multiple lenses for triangulation. 88 raw findings.
- **Phase 3 — Synthesise:** a synthesis agent deduped 88 → 38 themed findings and
  recalibrated severity; the orchestrator re-verified three reviewer "P0"s against
  the live app and re-graded them.
- **Phase 4 — Critique + plan:** an adversarial completeness critic caught a
  factual token error and the review's blind spots; the orchestrator wrote the
  implementation plan and applied the errata.

## Headline

The bones are right — every reviewer independently judged it a credible science
product, not a prototype, and the **guest reveal sequence** is best-practice
activation that must be protected. The product leaks at **activation → retention**:
the first surfaces a newcomer explores are empty by construction (the pokédex
opens on a 57-tile "Locked" wall; profile reads "0% accuracy"; the leaderboard has
one human), the **reward never visibly accumulates progress**, and the **entire
journey never tells the public their effort feeds real science**. Fixing first-run
framing, the reward's progress beat, and the contribution narrative — largely copy
and state-logic, not rebuilds — is where the public-engagement goal moves most.

**Four P0s:** no real-science narrative (T-01); the all-failure first-run states
(T-02); the unscannable browse grid (T-03) with missing/murky thumbnails (T-04).
**Top of the list to ship:** Wave 0 (1 day of quick wins + token housekeeping),
then Waves 1-2 as the core engagement sprint.

## Housekeeping / cleanup

- **Test account on PROD** (delete when convenient): `UX Review`,
  `fishspotter-uxreview-1781461877634@example.com`, user id
  `cmqe4eo6s0000i904vhfjpg3l`, created for the signed-in captures. It has ~2
  answers (visible as "Saithe (was Scooter)" etc.) which slightly skew the
  community/leaderboard stats. Say the word and I'll delete the user + its rows.
- **Live em-dash to fix:** `feed-05` shows "Save my finds — sign up free"
  (`FeedCard.tsx`, in production) — violates the brand zero-tolerance dash rule.
  Scheduled in Wave 0; flagged here because it is live now.
- **Screenshots** under `shots/` are gitignored (`implementation/**/shots/`);
  the `.md` docs + capture scripts are not — commit them with the review if wanted.
