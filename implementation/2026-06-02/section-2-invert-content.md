# Section 2 — Invert content activation (photo cache + footage)

Date: 2 June 2026. Closes the "data gaps that make the invert gate tiles
hollow in real use" from the outstanding list. The Spot It gate, engine,
scoring and 54-species catalogue are already built and grounded; this section
makes the inverts actually *function* for a user (thumbnails, gallery, teaching
marks, and eventually real invert clips).

---

## 2a. Reference-photo cache  (ACTIONABLE NOW — this session)

**Problem.** The 26 Workstream-C inverts (6 crab, 6 squid/cephalopod, 4 starfish,
4 gastropod, 6 jellyfish) have **zero `SpeciesImage` rows**. They were added to
`species-traits.json` *after* the 18-May image activation, and the
`species-images.json` manifest only lists the original fish. Consequence:
- invert MCQ candidate thumbnails fall back to the fish silhouette,
- the reveal `SpeciesGallery` renders nothing for inverts,
- `DiagnosticMark` authoring is **blocked** (a mark requires a `curated` photo).

**Key fact (verified in `src/lib/biodiversity/refresh-images.ts:117`).**
`refreshSpeciesImages` iterates the **`species-traits.json` catalogue** (all 54
species), *not* the manifest. Any species without a manifest entry uses
`_defaultBuckets` = `[{ lifeStage: null, sex: null, count: 4 }]`. So the inverts
are already in the iteration set and default 4-photo buckets are exactly right
for them (no male/female/juvenile split needed). **No manifest edit required.**

**Steps.**
1. Spot-check one species end to end:
   `npm run db:refresh-images -- --species "Carcinus maenas"` — confirm rows land
   and the photos are sensible.
2. Bulk-populate the inverts:
   `npm run db:refresh-images -- --stale-only` — `--stale-only` processes any
   species with zero rows (all 26 inverts) and skips fish whose rows are still
   fresh (<7 days), so it touches the inverts without redundant fish refetches.
   Inverts get default 4-photo buckets; the Wikimedia top-up fires automatically
   for any species iNat returns <3 photos for.
3. Verify: row count per invert species; spot-check the
   `/api/species-images/<scientificName>` route returns photos.

**Done when:** every one of the 26 inverts has >=1 `SpeciesImage` row (ideally
>=3). 0 hard errors in the run report.

**Notes.**
- Writes to the production Supabase DB (idempotent `upsert` on
  `(scientificName, sourceUrl)`; no deletes). Photo rows live in the DB, **not
  git** — the committed artefacts for this step are this plan + any doc updates.
- iNat "research grade" sorts by ID-agreement, not photo composition, so these
  rows are *coverage*, not yet *teaching* photos. Curation (2c) is separate.

---

## 2b. Invert footage in the feed  (FOOTAGE-DEPENDENT — not solo-actionable)

**Problem.** The feed is mostly fish footage, so a user rarely reaches the
jellyfish/starfish/squid tiles on a *real* snippet. The gate is correct, but the
invert tiles stay aspirational until invert clips exist.

**Needs (Christian / footage owner).** Real invert snippet videos (must be
H.264 per the codec invariant) plus `Snippet` rows whose `staffAnswer` is an
invert species (e.g. "Edible Crab") or a coarse shape-class term (e.g.
"Jellyfish", which scored-by-rung now treats as a valid coarse reference).

**When footage exists.** Seed via the `scripts/seed.ts` pattern; ensure H.264
(`scripts/transcode-to-h264.ts`); set `staffAnswer`. No code change needed —
the gate, scoring and catalogue already support every invert class.

---

## 2c. Annotated invert `DiagnosticMark`s  (FOLLOW-ON — after 2a + curation)

Once 2a caches photos: curate one clean, single-specimen teaching photo per
invert (add to the `overrides` block in `species-images.json` with
`curated: true`, re-run `db:refresh-images`), then author marks in
`/admin/species/<name>`. Editorial; depends on 2a. Out of scope this session.

---

## Verification gates
- `db:refresh-images` spot-check + bulk run report 0 hard errors.
- Invert species return photos from `/api/species-images/<sci>`.
- No code/test regression (this section is data + optional manifest only).

## Scope this session
**2a only.** 2b waits on footage; 2c waits on 2a + editorial curation.
