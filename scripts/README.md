# Scripts runbook

> Every script in this folder is **idempotent** — safe to re-run. The order below is the *first-time* setup chain. After initial setup, scripts can be run individually as needed.

## First-time setup order

```bash
# 1. Push schema to DB (creates tables)
npx prisma db push

# 2. Seed Snippet rows from local /public/media/snippets/
node scripts/seed-local.mjs

# 3. Enrich snippets with site/depth/lat/lon/bbox from the Drive metadata
node scripts/enrich-snippets-from-drive.mjs

# 4. Seed Taxon + TaxonAlias from data/species-master.json
node scripts/seed-taxa.mjs

# 5. Tag taxa with attributes used by the ID guide (functional group, body shape, etc.)
node scripts/seed-taxon-attributes.mjs

# 6. Link clips to their staff-labelled taxon (where evidence exists in clip-matches.json)
node scripts/link-clips-to-taxa.mjs

# 7. Fetch OBIS biogeographic data for the prior
node scripts/refresh-biogeographic-cache.mjs
```

## One-shot scripts (already run)

- **`cleanup-taxa.mjs`** — corrected typos (Cyanea *capitata*→*capillata*, Trisopterus *iuscus*→*luscus*, Psetta maxima→Scophthalmus maximus), renamed Scyliorhinus canicula to "Small-spotted Catshark", deleted Paralichthys dentatus (wrong species) and 5 placeholder duplicates. Safe to re-run.
- **`extract-species-data.py`** — pulled raw observations from PEBL's processed CSVs on the Drive into `data/species-master.json` + `data/clip-matches.json`. Run only when there's new PEBL CSV data to ingest.

## What each script does

| Script | Reads | Writes | When to run |
|---|---|---|---|
| `seed-local.mjs` | `public/media/snippets/*` folders | `Snippet` (minimal fields) | After adding new clip folders |
| `enrich-snippets-from-drive.mjs` | Drive: `metadata.json`, `bbox_data.json` | `Snippet` (site/depth/lat/lon/bboxJson) | After Drive metadata updates |
| `seed-taxa.mjs` | `data/species-master.json` | `Taxon`, `TaxonAlias` | After re-extracting species master data |
| `seed-taxon-attributes.mjs` | hard-coded mapping in script | `TaxonAttribute` | After editing the mapping in the script |
| `link-clips-to-taxa.mjs` | `data/clip-matches.json` | `Snippet.staffTaxonId`, `Snippet.labelStatus` | After re-running `extract-species-data.py` |
| `cleanup-taxa.mjs` | (no input) | renames/deletes taxa | Once, after `seed-taxa.mjs` |
| `refresh-biogeographic-cache.mjs` | OBIS API | `BiogeographicChecklist` | Weekly or after a new deployment |
| `extract-species-data.py` | Drive CSVs | `data/*.json` | When PEBL has new CSVs |

## OBIS refresh flags

```bash
# Just the all-year prior (default; ~30s)
node scripts/refresh-biogeographic-cache.mjs

# Plus 4 seasonal buckets per deployment (~2 min)
node scripts/refresh-biogeographic-cache.mjs --seasonal
```

## Notes

- The Drive path is hard-coded in `enrich-snippets-from-drive.mjs` and `extract-species-data.py`: `G:\.shortcut-targets-by-id\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\Ocean\08 - Data\01 - SubCam data\`. Change there if the shortcut moves.
- All `.mjs` scripts use ESM + Node's native `fetch`; no extra deps needed beyond what's in `package.json`.
- `seed.ts` (the original `npm run db:seed`) was mgtaco's original seeder; we now use `seed-local.mjs` instead. Keep `seed.ts` until any deployment workflow that calls `db:seed` is updated.
