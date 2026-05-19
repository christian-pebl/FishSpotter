# FishSpotter — Implementation Plan (2026-05-18)

**Source:** [`audit/ux-2026-05/`](../../audit/ux-2026-05/) — ~175 file-cited findings across 7 specialist audits, 2026-05-18.
**Executor:** Claude Code in-session. Tickets are written compact, but each carries enough file:line context to be picked up cold from a future session.
**Total:** 6 sprints, **114 tickets**, ~4,100 lines of plan across 7 files.

| Sprint | File | Tickets | Headline |
|---|---|---|---|
| 1 | [sprint-1-foundations.md](sprint-1-foundations.md) | 17 | Tokens-in-code, error/not-found shells, two API spoiler-gates, open-redirect lock, full testing infra |
| 2 | [sprint-2-quiz-pipeline.md](sprint-2-quiz-pipeline.md) | 20 | MCQ migration, inline `SpeciesGallery`, scoring fix, confetti dedupe, watch-first gate |
| 3 | [sprint-3-onboarding-compliance.md](sprint-3-onboarding-compliance.md) | 18 | Password reset, email verify, T&Cs/privacy, account deletion, Resend, landing, onboarding tour |
| 4 | [sprint-4-performance.md](sprint-4-performance.md) | 18 | SQL `groupBy` + ISR everywhere, archive filters, leaderboard timeframe, feed virtualisation, web-vitals sampler |
| 5 | [sprint-5-navigation-polish.md](sprint-5-navigation-polish.md) | 22 | Persistent nav, deep links, externalId routing, full a11y sweep (aria-live, labels, focus trap, contrast) |
| 6 | [sprint-6-advanced.md](sprint-6-advanced.md) | 19 | Captions decision, digests, profile, share, anti-cheat, OAuth, GDPR export, i18n scaffold |

---

## How to use this plan

**In a future Claude Code session, start a sprint like this:**

> Read `implementation/2026-05-18/sprint-{N}-*.md`. Pick up at ticket S{N}-T{XX}. Acceptance criteria are in the file; mark tickets done as you land them.

Each ticket has a fixed shape:
- **Priority** (Critical / High / Medium / Low)
- **Effort** (S < 1hr, M 1-4hr, L 4-12hr, XL multi-session)
- **Audit refs** (§01 F2, §07 PERF-13, etc.)
- **Files to touch** with line numbers
- **Current state → Target state**
- **Implementation approach** (specific enough to execute)
- **Acceptance criteria** (numbered, testable)
- **Testing notes**
- **Risk / rollback**
- **Dependencies** (other ticket IDs)

---

## Cross-sprint dependency graph

```
Sprint 1 ─┬─→ Sprint 2 (S1-T11 spoiler-gate ↔ S2-T05/T07 MCQ endpoint)
          ├─→ Sprint 3 (S1-T08 error shells, design tokens)
          ├─→ Sprint 4 (S1-T13/15 Lighthouse + Playwright = verification gate)
          ├─→ Sprint 5 (S1-T01/05 tokens, S1-T08 not-found shell to be polished)
          └─→ Sprint 6 (everything; S6 assumes the rest has landed)

Sprint 2 ─┬─→ Sprint 3 (S2-T11 pendingAnswer carry ↔ S3-T15 sign-in redirect contract)
          └─→ Sprint 5 (S2-T08 inlined SpeciesGallery → S5 a11y sweep on it)

Sprint 3 ─┬─→ Sprint 4 (mostly independent; light session-model touchpoint)
          ├─→ Sprint 5 (header avatar, account state visibility)
          └─→ Sprint 6 (S3-T02 Account scaffold → S6-T12 OAuth; S3-T03 Resend → S6 digests; S3-T13 account delete → S6 GDPR export)

Sprint 4 ─┬─→ Sprint 5 (Sprint 4's archive filters → Sprint 5's unified search)
          └─→ Sprint 6 (S6-T16 perf follow-ups)

Sprint 5 ───→ Sprint 6 (S5 a11y baseline → S6 captions decision sits on it)
```

**The critical path is short**: only Sprint 1 → Sprint 2 has a tight coupling (the spoiler-gate API change touches both). Sprints 3 and 4 can run mostly in parallel after Sprint 1 lands. Sprint 5 can start once Sprint 1 + 4 are done; it doesn't need Sprint 2/3 to be fully complete.

---

## Effort summary

Per the sprint plans (using S/M/L/XL effort tags):

| Sprint | Tickets | Rough dev-days (single executor) |
|---|---|---|
| 1 — Foundations | 17 | ~12-15 |
| 2 — Quiz pipeline | 20 | ~14-18 |
| 3 — Onboarding & compliance | 18 | ~15-20 (+ legal copy time, not engineering) |
| 4 — Performance | 18 | ~12-16 |
| 5 — Navigation & polish | 22 | ~12-15 |
| 6 — Advanced | 19 | ~26-29 |
| **Total** | **114** | **~90-110 dev-days** |

This roughly fits the 90-day horizon assuming a full-time executor. If running in parallel with other work, treat as ~6 months calendar.

---

## Product decisions that gate execution

These need a steer from Christian / PEBL product before the relevant tickets can be planned firmly. Listed in the order they're first needed:

| # | Decision | Blocks | Default assumed in plan |
|---|---|---|---|
| 1 | **MCQ vs free-text quiz** (the brief says MCQ, the implementation is free-text) | All of Sprint 2 | MCQ — the OBIS pipeline already computes candidates |
| 2 | **Email service provider** (Resend / SendGrid / AWS SES / Nodemailer) | S3-T03 onwards (password reset, verify, digests) | Resend — referenced in user CLAUDE.md |
| 3 | **Anonymous-first answer flow** — can guests answer before signing in? | S3-T15 redirect contract, S2-T11 pendingAnswer carry | Yes, with sessionStorage carry through sign-in |
| 4 | **Privacy / T&Cs copy** (engineering scaffolds the pages, but content needs PEBL legal) | S3-T08, S3-T09 | Engineering ships shells with placeholder ICO-checklist sections |
| 5 | **Captions posture** for silent underwater clips — formal WCAG 1.2.2 exemption or behavioural captions? | S6-T19, partial S5-T22 axe gate | (a) silent-media exemption marker; plan also covers (b) VTT captions |
| 6 | **Follow / social graph** — is FishSpotter a social product or a leaderboard product? | S6-T11 (currently a decision record, no code) | No follow graph; share-by-URL only |
| 7 | **Notification surface** — web push, in-app only, or none? | S6 notifications tickets | In-app only at launch |
| 8 | **i18n scope** — English-only, or also Welsh / French given PEBL Ocean focus? | S6 i18n scaffold | English-only at launch, but scaffolded for future |

---

## Recommended execution sequence

**The 90-day default**, optimised for de-risking compliance early:

1. **Weeks 1-2 (Sprint 1)** — Tokens, error shells, security fixes, testing infra. **Required before any other sprint.**
2. **Weeks 3-4 (Sprint 2)** — Quiz pipeline. Highest user-visible impact; aligns app with brief.
3. **Weeks 5-7 (Sprint 3)** — Onboarding + compliance. Cannot launch publicly without this for a UK CIC.
4. **Weeks 7-9 (Sprint 4, partially parallel with Sprint 3)** — Perf. Independent enough to parallel with most of Sprint 3.
5. **Weeks 10-11 (Sprint 5)** — Nav + a11y polish. Requires Sprint 1 (tokens) + Sprint 4 (perf) baseline.
6. **Weeks 12+ (Sprint 6)** — Advanced features. By here the product decisions should all be made.

**Alternative — "thin v1 fast" sequence** if PEBL wants a friends-and-family launch sooner: Sprint 1 → S2-T01..T07 (quiz data layer only) → critical S3 only (T01-T07 password/verify) → quick S4-T02 (leaderboard SQL) → S5-T1/T2 (nav fix). ~5 weeks. Defer everything else.

---

## What this plan deliberately doesn't include

Surfaced in the audit but **not in any sprint** — flag as separate work-streams:

- **Backend / Supabase RLS hardening** beyond the two specific UX-surfaced API leaks (S1-T11, S1-T12)
- **DB query plan review** for any path not already on the perf list
- **Vercel cron failure-mode review** — well documented in CLAUDE.md, not in scope
- **ML / bbox tracking pipeline review** — out of UX scope
- **OBIS / GBIF / iNat data correctness audit** — already probed in CLAUDE.md, not in scope
- **Seed scripts hardening** — referenced in CLAUDE.md but not user-facing
- **Snippet upload tooling** — partially in S6-T13 (admin route), full scope larger
- **Mobile native apps** — out of scope; this plan is PWA-first

---

## How to track progress

Two recommended patterns:

**Pattern A — Per-sprint markdown checkboxes.** Append a status line to each ticket as you complete it: `**Status:** ✅ Done 2026-05-22 (commit abc1234)`. Re-grep `Status:` at end of sprint to retrospect.

**Pattern B — Git-flow per ticket.** One branch per ticket (`claude/s1-t01-tokens`), one PR per branch, link the audit refs in the PR description. Sprint exits when all PRs merged + sprint-level DoD criteria green.

Either pattern works. Pattern B gives the cleanest review history; Pattern A is faster if reviewing internally.

---

## Risks & assumptions

**Assumed:**
- Single executor working roughly full-time (any branch of Claude Code) on the codebase.
- Christian remains available for product decisions per the table above; decisions land within ~1 week of being needed.
- The corpus stays small (~30 snippets) through Sprint 4. If a large data import lands in Sprint 1/2, Sprint 4's perf work moves earlier.
- No major Next.js / Prisma / NextAuth major-version bumps mid-plan. (Next.js 14 → 15 would invalidate parts of Sprint 1.)

**Top risks:**
1. **Sprint 3 legal-copy bottleneck** — engineering can scaffold privacy/T&Cs in days, but legal review can take weeks. Start that conversation in Sprint 1.
2. **Sprint 2 product-decision drift** — if MCQ vs free-text flips mid-sprint, 5-6 tickets need redesign. Lock the decision before starting.
3. **Email deliverability** — Resend setup looks easy but DKIM/SPF on `pebl-cic.co.uk` may require DNS access not under engineering's control. Surface this in Sprint 1 prep.
4. **iOS Safari autoplay quirks** — Sprint 1-2 changes to the feed video pipeline need re-verification on real iOS, not just simulator.
5. **`?v=3` cache-busting** for video URLs (Sprint 4 S4-T18) — switching to new-path-on-re-encode may strand stale CDN caches for hours. Stage carefully.

---

## Companion documents

- **The audit itself**: [`audit/ux-2026-05/`](../../audit/ux-2026-05/) — start with `00-README.md` there for cross-cutting themes
- **Prior audit (different breakdown, 2026-05-18)**: [`audit/`](../../audit/) — retained for reference
- **Codebase-level operational notes**: `CLAUDE.md` (root of worktree) — H.264 invariant, env vars, DB scripts

---

*Plan produced by 6 parallel planning agents on top of the 7-section UX audit. Treat as v1; expect the second half of the plan to shift after Sprints 1-3 land and reveal what's actually hard.*
