# Session handoff — 28 May 2026

Pick-up notes for a fresh chat. This session completed the **code-side** of
the Q4 plan (`implementation/2026-05-27/plan.md`). Everything below is
committed and pushed to `main`; Vercel auto-deploys `main`, so it is live or
deploying.

Branch: `main` @ `dcfb658`. Working tree clean.

---

## TL;DR — what's left for you (editorial, no code blocking it)

1. **Approve the reference-ID audit, then run the backfill.**
   - Run `npm run db:audit-references` to see the current proposal.
   - Nullify set is pre-filled (Fish / Crab / Jellyfish = 17 snippets).
   - Supply species binomials for the backfill set (Common Whiting,
     Juvenile Cod, etc.) by editing the `BACKFILL` map in
     `scripts/backfill-references.ts`.
   - Dry-run: `npm run db:backfill-references` (safe, default).
   - Apply: `npm run db:backfill-references -- --apply` (writes + retro-scores
     existing answers in one transaction).
2. **Curate MCQ photos, then flip the gate.**
   - Add one good photo per top MCQ species to `src/data/species-images.json`
     overrides with `curated: true`, run
     `npm run db:refresh-images -- --species "X"`.
   - Once the top ~10 species each have a curated photo, set the Vercel env
     var `MCQ_CURATED_PHOTOS_ONLY=1` (no deploy needed to take effect on next
     request). Until then, leave it unset (only pollack is curated; enabling
     now would silhouette ~25/26 tiles).
3. **Author diagnostic marks for the top confused pairs.**
   - Run `npm run db:confusion-matrix` for the ranked brief.
   - Real species confusions surfaced: **whiting ↔ saithe / cod**,
     **flatfish ↔ dragonet**. Author marks at `/admin/species/[name]` that
     answer "what rules out the thing people mistake it for?"
   - Note: the junk references (Fish/Crab) dominate the matrix until step 1
     nullifies them — do the backfill first and the matrix sharpens.

---

## What shipped this session

All on top of where the session started (`0e1d917`). Commit list, newest last:

| Commit | Sprint | Summary |
|---|---|---|
| `74c56d3` | Q4-C3 | IdGuide restructure: AnnotatedSpeciesPhoto SVG fix (circular rings), WhyHint sub-component, `NARROW_ENOUGH=3`, step counter hidden until ≤3, FinalReveal collapses non-top candidates |
| `2dc1901` | Q4-D1 | Motion timing tokens in `src/lib/motion.ts` (`DURATION` / `EASE` / `TRANSITION` / `spring`); migrated Framer call-sites in FeedCard, FeedPlayer, SettingsMenu, SideMenu, RarityPanel |
| `967ddf6` | Q4-D2 | Verdict-pill colour tokens (`correct` / `incorrect` / `pending`, each `DEFAULT` + `ink`); migrated the 7 reveal pills in FeedCard + SnippetPlayer |
| `b4d8a23` | Q4-D7 | UI / Design rules section added to CLAUDE.md |
| `30bdb66` | Q4-D6 | Safe nits: reduced-motion spinner gate, `shadow-2xl`→`shadow-menu`, browse eyebrow→deployment, cookie + leaderboard copy, IdGuideChat region TODO |
| `28a67f6` | Q4-D3/4/5 | Documented canonical radius / type-scale / colour conventions instead of sweeping (per Christian's call) |
| `2e70a0d` | Q4-B1/B3 | `audit-reference-ids.ts` + `confusion-matrix.ts` diagnostics (read-only) |
| `96e7c42` | Q4-B2 | MCQ curated-photo gate in the quiz route, gated on `MCQ_CURATED_PHOTOS_ONLY` (shipped OFF) |
| `cb5e791` | Q4-B1 | `backfill-references.ts` execution script (dry-run by default) |
| `dcfb658` | Q4 review | Cleared all em dashes flagged by the code-review agent; tidied script output |

---

## New scripts (npm)

| Command | Writes? | Purpose |
|---|---|---|
| `npm run db:audit-references` | No | Group `staffAnswer` by label, propose keep/backfill/nullify. `-- --json` for machine output. |
| `npm run db:confusion-matrix` | No | Rank `(reference, guessed-as)` pairs from wrong answers. `-- --limit N`, `-- --json`. |
| `npm run db:backfill-references` | Only with `--apply` | Apply approved nullifies/backfills + retro-score answers in one transaction. Edit `NULLIFY` / `BACKFILL` maps in the script first. |

(All three documented in CLAUDE.md Key Files.)

## New design-system surface

- **Motion:** import `DURATION` / `EASE` / `TRANSITION` / `spring` from
  `@/lib/motion` for generic transitions. Bespoke motion stays inline.
- **Verdict colours:** `bg-correct text-correct-ink` etc. (tailwind.config.ts).
- **Env var:** `MCQ_CURATED_PHOTOS_ONLY=1` gates MCQ candidate thumbnails to
  curated photos (documented in CLAUDE.md env vars; default off).
- **Conventions (documented, not swept):** radius = card/modal/full;
  type-scale tokens are headings-only; Tailwind aliases are the colour source
  of truth, CSS vars reserved for `[color:var()]`. See CLAUDE.md
  "Design-system conventions (deferred consolidations)".

---

## Verification (this session, all green)

- `npx tsc --noEmit` — clean
- `npm run test` — 167/167 pass (20 files)
- `npm run lint` — clean (one pre-existing `<img>` warning in Header.tsx)
- `npm run build` — production build succeeds, all routes compile
- Independent code-review agent: logic clean (retro-score mirrors
  `matchWithAliases`, transaction + dry-run guard sound, verdict hexes exact,
  curated gate preserves behaviour when env unset). Its only finding (em
  dashes) is fixed and re-verified (0 em/en dashes in the session diff).

---

## Current data snapshot (prod, 28 May 2026)

- 30 snippets, 8 distinct `staffAnswer` labels.
- Audit proposal: nullify 17 (Fish 9 / Crab 5 / Jellyfish 3); backfill 13
  (Scooter 4 / Flatfish 4 / Common Whiting 3 / Gastropod 1 / Juvenile Cod 1).
  Note: Flatfish / Scooter / Gastropod are not species-level — resolve to a
  binomial or move them into NULLIFY before applying.
- SpeciesImage: 79 rows, **1 curated** (Pollachius pollachius). This is why
  the MCQ gate is shipped off.
- Confusion matrix: 12 incorrect answers; junk refs dominate until nullified.

---

## Parked (not in scope, from plan.md "What's NOT in this plan")

- Q3A-T9 progression layer (pre-data).
- P-17 mobile bottom tab bar (needs design scoping).
- P-27 murky-video companion images (content, after mark coverage widens).
- Full mobile-first redesign pass (strategic recommendation #3 in plan.md).
- Bass-in-gadoid trait example in IdGuideWizard line 65 — left for the
  marine biologist (bass legitimately has two dorsal fins).
- The three D-sweeps (radius/type/var) — documented as conventions, not run.
