# Docs index

> Read order if you're new: **strategy → phase-1 → id-guide-proposal → id-guide-implementation → test-run**.

## Strategy

- **[engagement-strategy.md](engagement-strategy.md)** — north-star principles, three audiences (N. Devon fishermen / sailors / public), the phased plan, why each phase is shaped the way it is.

## Phase 1 — Taxon + life list (shipped)

- **[phase-1-species-pages.md](phase-1-species-pages.md)** — the lean Phase 1 spec: flat `Taxon` table, two clip states, three reveal-panel states, life list, 10/1/5 scoring. §9 lists what was deliberately deferred.

## Phase 2 — ID Guide (shipped Days 1–3 + Phase B)

- **[id-guide-proposal.md](id-guide-proposal.md)** — strategic case, three concentric filters (local taxa → attribute match → biogeographic), external data source comparison (OBIS / GBIF / WoRMS / FishBase). Use this to *understand why*.
- **[id-guide-implementation.md](id-guide-implementation.md)** — concrete plan: user journey (hermit-crab-in-4-taps), 9 design constraints, full question tree, scoring math, 5+1 component tree, day-by-day breakdown. Use this to *understand how*.

## Manual testing

- **[app-test-run.md](app-test-run.md)** — scripted 15-20 min walk-through covering everything shipped. Sections map to the test suite in `tests/e2e/*.spec.ts`.

## Automated tests + snapshot

- **[test-snapshot.md](test-snapshot.md)** — live results of the test suite (95 passing). Refreshed after each iteration.

## Deployments + pipelines

- **[side-by-side-setup.md](side-by-side-setup.md)** — running the enhanced + baseline versions side-by-side locally
- **[vercel-deployment.md](vercel-deployment.md)** — public Vercel deployment topology + env vars
- **[auto-ingest-plan.md](auto-ingest-plan.md)** — the plan for the Drive → Storage pipeline (executed)
- **[operational-runbook.md](operational-runbook.md)** — **the day-to-day commands** for adding new clips, troubleshooting, capacity, rollback

## Hand-off + comparison

- **[changes-vs-mgtaco.md](changes-vs-mgtaco.md)** — file-level breakdown of everything diverged from mgtaco's baseline
- **[features-prioritised.md](features-prioritised.md)** — same diff but ordered by user-experience leverage (P0 → P3)

## Conventions

- Each doc is self-contained; cross-links go through markdown links rather than implicit references.
- Each "phase" doc has a **§ Deferred / out-of-scope** section listing what was *deliberately* not built. Treat that as the punch list for the next iteration.
- ⚠️ markers flag uncertain calls (e.g. taxonomic name suspicions) that PEBL should review.
