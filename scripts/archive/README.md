# scripts/archive

Spent one-off scripts — migrations that have already run, superseded seeders, and
dev-only throwaways. **Kept for git-blame / reference only. Do not run them** (most
target a DB state that no longer exists, or are superseded by a live script).

Moved here on 2026-06-04 during the codebase-organisation pass so the active
operational scripts in `scripts/` (the `db:*` / `images:*` npm targets) are easy
to find.

| Script | What it did | Superseded by |
|--------|-------------|---------------|
| `migrate-curated-flag.ts` | One-shot: flipped photos that already hosted authored marks to `curated=true` when the photo-quality gate shipped (27 May). Ran once. | — (done) |
| `seed-gadoid-marks.ts` | Starter `DiagnosticMark`s for the gadoid pilot (pollack/bib/cod). | `seed-fish-marks.ts` (`db:seed-fish-marks`) |
| `adjust-gadoid-marks.ts` | 27 May marine-biologist review fixups to the gadoid pilot marks. | — (done) |
| `fix-mark-coords.ts` | Hardcoded coordinate fixes for 11 species' marks. | — (done) |
| `reauthor-quality-flagged-marks.ts` | Moved 7 species' marks onto a better curated photo (3 Jun). | — (done) |
| `reauthor-upgraded-fish-marks.ts` | Re-authored 4 fish whose curated photo was upgraded (3 Jun). | — (done) |
| `reauthor-upgraded-invert-marks.ts` | Re-authored 8 inverts whose curated photo was upgraded (3 Jun). | — (done) |
| `research-dragonet-goby-gate.ts` | One-off Gemini probe that settled the dragonet→fish fold decision (3 Jun). | — (done) |
| `reset-users.ts` | One-off cleanup of null-`passwordHash` users. | — (done) |
| `silhouette-contact-sheet.cjs` | Dev-only PhyloPic curation contact sheet. | dev tool |
| `preview-pattern.cjs` | Dev-only in-context marine-pattern mock render. | dev tool |

If you need to author or fix diagnostic marks today, use the live path: author in
`/admin/species/[name]`, or the data-driven seeders (`db:seed-fish-marks` /
`db:seed-invert-marks`). See `docs/runbooks/add-a-species.md`.
