# Vercel deployment — mgtaco baseline

## Live URL

**https://fish-spotter.vercel.app**

Deployed from [christian-pebl/FishSpotter](https://github.com/christian-pebl/FishSpotter), running mgtaco's exact tip (commit `121bdab` "Fixed issues") plus a single follow-up commit (`0b86fbf`) that adds the 6 transcoded Jan-2020 clips so the deployment matches the shared Supabase DB row count.

## Topology

```
GitHub: christian-pebl/FishSpotter (main)
        │
        │  auto-deploy on push
        ▼
Vercel:  Project "fish-spotter"
        team_qv46ZQGeBpUZ8qcxK28PQ1jr / prj_NlgjcEwzqSt0MwLsz7cVzVBu2D4o
        │
        │  reads via Prisma
        ▼
Supabase: aazxphcrexkggbmmceli (FishSpotter project, eu-west-1)
        │
        │  shared with...
        ▼
Localhost:3000 (our enhanced version) + Localhost:3001 (baseline worktree)
```

## Vercel environment variables

| Key | Scope |
|---|---|
| `POSTGRES_PRISMA_URL` | Production, Preview |
| `POSTGRES_URL_NON_POOLING` | Production, Preview |
| `NEXTAUTH_SECRET` | Production, Preview |
| `NEXTAUTH_URL` (= `https://fish-spotter.vercel.app`) | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview |
| `SUPABASE_URL` | Production, Preview |
| `SUPABASE_STORAGE_BUCKET` (= `snippets`) | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview |

## How it was deployed

1. **Worktree** at `121bdab` created in sibling dir: `git worktree add ../FishSpotter-mgtaco-baseline -b baseline-mgtaco 121bdab`
2. **GitHub** target `christian-pebl/FishSpotter` already existed with old Firebase Studio starter; force-pushed `baseline-mgtaco` over `main`
3. **One follow-up commit** adding 6 Jan-2020 clip folders (`public/media/snippets/ALG_2020-*`) so the 23-clip mgtaco baseline matches the 29-row shared DB
4. **Vercel import** through the web UI ("Configure Project" — paste 8 env vars)
5. **`NEXTAUTH_URL` added afterwards** via Vercel REST API once the production domain was known, then a fresh production deploy triggered to pick it up

## Smoke-test results (all green)

```
Home              200
/feed             200
/auth/signin      200
Jan-2020 thumb    200    (was 404 before commit 0b86fbf)
Jan-2020 video    200
/api/snippets     29 rows
/api/auth/csrf    64-char token returned
/api/auth/session anonymous {} returned (correct)
```

## Operational notes

- **Auto-deploy on push to `main`** is enabled by default. Any push to `christian-pebl/FishSpotter:main` triggers a new build.
- **Shared DB caveat**: production, two localhosts, and any Preview deploy all share `aazxphcrexkggbmmceli`. Mind the blast radius of destructive DB scripts.
- **DO NOT run `prisma db push` from this baseline.** Its schema is a subset of our enhanced version; pushing would drop our extra tables (`Taxon`, `TaxonAlias`, `TaxonAttribute`, `BiogeographicChecklist`).
- **DO NOT run `npm run db:seed` from this baseline.** It would re-overwrite `Snippet.staffAnswer` from a non-existent "Fish Spotter Snips" local folder (no-op now, but landmine if you ever symlink the folder).
- **The Vercel access token** used for the API operations is yours; revoke at <https://vercel.com/account/tokens> when no longer needed.

## Re-running the deployment

If `christian-pebl/FishSpotter:main` is updated, the baseline auto-redeploys. To bump the deployment without code changes (e.g. after an env var update):

```bash
# From any machine with the Vercel token
curl -X POST "https://api.vercel.com/v13/deployments?teamId=team_qv46ZQGeBpUZ8qcxK28PQ1jr" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "fish-spotter",
    "project": "prj_NlgjcEwzqSt0MwLsz7cVzVBu2D4o",
    "target": "production",
    "gitSource": {"type":"github","repoId":"<repo-id>","ref":"main"}
  }'
```

## Comparing baseline vs enhanced

| | Baseline (Vercel) | Enhanced (localhost:3000) |
|---|---|---|
| Code | `121bdab + 0b86fbf` | uncommitted main with all session work |
| URL | https://fish-spotter.vercel.app | http://localhost:3000 |
| DB | shared | shared |
| ID Guide | ❌ | ✅ |
| Map | ❌ | ✅ |
| Life list | ❌ | ✅ |
| Tracker toggle | ❌ | ✅ |
| Reveal panel | ❌ | ✅ |
| OBIS prior | ❌ | ✅ |

Both are running and can be A/B compared. See [`docs/side-by-side-setup.md`](side-by-side-setup.md) for the local pairing.
