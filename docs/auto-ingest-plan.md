# Auto-ingest pipeline — research + plan

> **Goal:** "Drop a new clip folder in the Drive *Fish Spotter Snips* directory → run one command → the new clip appears in **all three** deployments (localhost:3000 enhanced, localhost:3001 baseline, https://fish-spotter.vercel.app)."
>
> No git commits, no media files dragged between folders, no Vercel redeploys.

> **Status:** plan for approval. Nothing executed yet beyond research.

---

## TL;DR

Two surgical changes, ~15 minutes of execution:

1. **🅑 Patch 9 mgtaco files** with `export const dynamic = "force-dynamic";` so Vercel re-queries the DB on every request instead of statically rendering at build time.
2. **🅒 Migrate media to Supabase Storage** by running `node scripts/ingest-from-drive.mjs --storage` once. After that, the DB stores Storage URLs; `/public/media/` files become unused.

After both: the daily workflow becomes **one command** — `node scripts/ingest-from-drive.mjs --storage` — and all three deployments reflect it within seconds.

---

## Current state (what we have right now)

- ✅ `scripts/ingest-from-drive.mjs` — reads Drive folders, copies media to `/public/media`, upserts DB rows. Idempotent.
- ✅ Localhost:3000 picks up new DB rows immediately (Next.js dev mode).
- ❌ Vercel deployment **does not** see new DB rows until a fresh build runs — confirmed: ingested 30th clip, Vercel still showed 29 until I triggered a redeploy.
- ❌ Media files: have to be manually copied to the baseline worktree AND committed to git for Vercel to serve them.

**Root causes:**

| Issue | Cause |
|---|---|
| Vercel API returns stale data | mgtaco's GET route handlers don't use the `request` object → Next.js statically renders them at build time |
| Vercel returns 404 for new clip media | Media is committed to git in `/public/media/snippets/`; new clips aren't in the baseline-mgtaco repo until manually pushed |

---

## Why "🅑 + 🅒" beats the alternatives

| Option | Effort | Mgtaco-divergence | Daily workflow | Verdict |
|---|---|---|---|---|
| 🅐 Redeploy after each ingest | Low (write a wrapper) | None | Git commit + push + wait ~1 min | Works but tedious; requires media in git |
| 🅑 alone (`force-dynamic`) | Tiny patch | 9 lines | Media still in git → still need git pushes | Fixes half the problem |
| 🅒 alone (Storage migration) | Medium | None | Single command, but Vercel still caches the snippet *list* → only sees new clips on next build | Fixes media, not freshness |
| **🅑 + 🅒 combined** | Medium | 9-line patch | **Single command, everywhere instant** | ★ Recommended |

The 9-line patch is justifiable: Vercel's default static-route-handler behaviour means *any* DB-backed app needs `force-dynamic` to work as an "app" rather than a "static export". This is a known footgun, not a deviation from mgtaco's intent.

---

## Detailed scope of the patch (🅑)

All 9 affected files identified by the research script. For each: add **one line** at the top:

```ts
export const dynamic = "force-dynamic";
```

| File | Why it's currently static | Effect after patch |
|---|---|---|
| `src/app/api/snippets/route.ts` | `GET()` with no `request` param | Vercel re-queries DB on every request → new clips show immediately |
| `src/app/api/snippets/[id]/route.ts` | Same | Individual clip data is always fresh |
| `src/app/api/snippets/[id]/stats/route.ts` | Same | Community vote counts always fresh |
| `src/app/api/leaderboard/route.ts` | Same | Leaderboard updates live |
| `src/app/api/streak/route.ts` | Same | Streaks update live |
| `src/app/feed/page.tsx` | Server component reading Prisma directly | Feed page lists newest clips |
| `src/app/feed/browse/page.tsx` | Same | Archive page fresh |
| `src/app/feed/[id]/page.tsx` | Same | Detail page fresh |
| `src/app/leaderboard/page.tsx` | Same | Leaderboard page fresh |

`/api/answers/route.ts` and `/api/answers/my/route.ts` already access `request` → already dynamic → no patch needed.

**Where to apply:**
- **Baseline worktree** (`FishSpotter-mgtaco-baseline/`) — yes, then push to `christian-pebl/FishSpotter:main`. Vercel auto-redeploys (one time).
- **Enhanced worktree** — defer. Our enhanced version has additional routes; we'll handle those when/if we deploy it separately.

---

## Detailed scope of the migration (🅒)

### Pre-flight (no changes)

1. Confirm `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set in `.env.local` (they are).
2. Dry-run: `node scripts/ingest-from-drive.mjs --storage --dry-run` — prints what would happen, changes nothing.

### Live migration

1. Run: `node scripts/ingest-from-drive.mjs --storage`
2. Script does:
   - Creates Supabase Storage bucket `snippets` (public, currently doesn't exist)
   - For each of the 30 clip folders in Drive:
     - Uploads `snippet.mp4` + `thumbnail.jpg` to `snippets/<folder>/`
     - Sets `Snippet.videoUrl = "https://aazxphcrexkggbmmceli.supabase.co/storage/v1/object/public/snippets/<folder>/snippet.mp4"`
     - Sets `Snippet.thumbnailUrl = "...thumbnail.jpg"`
   - Idempotent (upsert)
3. Estimated time: 30 clips × ~2 MB total each = 60 MB upload at ~5 MB/s = ~15 s.

### Post-migration

- Localhost:3000 reads new Storage URLs from DB → media still loads (different URL, same files).
- Vercel reads new Storage URLs from DB → media loads from Storage too.
- `/public/media/snippets/` files become unused — leave in place as fallback or delete to slim the repo.

---

## Cost / risk analysis

### Storage cost
| Resource | Free tier | Our usage after migration | Headroom |
|---|---|---|---|
| Storage capacity | 1 GB | ~50 MB (30 clips × ~1.5 MB) | **20× headroom** |
| Egress bandwidth | 5 GB/month | depends on traffic | See below |
| Operations | 1M/month | thousands at most | Trivially under |

### Bandwidth math
- Average clip download: ~1.5 MB
- 5 GB / 1.5 MB ≈ **3,300 clip plays per month** on free tier
- For a beta with PEBL staff + ~10 testers, this is ≫ enough.
- If we hit the cap: upgrade to Supabase Pro ($25/mo) → 250 GB egress, more than enough.

### Other risks + mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Storage URL pattern changes | Low (Supabase is stable) | URLs are stored in DB, regenerate via re-ingest if needed |
| Public bucket exposes nothing sensitive | N/A | All clips are public already (in git, on Vercel) |
| Mgtaco's code chokes on Storage URLs | None | They're plain HTTPS URLs, same shape as before |
| Old tests break (URL pattern check) | Low | Our tests don't assert URL prefix, just non-empty |
| Browser caches old `/media/` URLs | Transient | One hard-refresh fixes; the OLD URLs still work because /public/media files remain on disk |
| Vercel cache holds stale response after migration | Yes, initially | Trigger one final redeploy after migration |

### Rollback plan
If anything breaks:
1. `node scripts/ingest-from-drive.mjs` (no `--storage`) — re-points DB rows back to `/media/snippets/...` paths in ~10 seconds
2. Revert the force-dynamic commit: `git revert <sha>` + push → Vercel auto-redeploys to mgtaco's original behaviour
3. (Optional) Delete the Storage bucket via Supabase dashboard

All steps are reversible. No data loss possible — Storage is additive; DB rows can be re-pointed.

---

## Execution plan (15 min, in sequence)

### Step 1 — Patch route handlers in baseline (3 min)
```bash
cd FishSpotter-mgtaco-baseline

# Add `export const dynamic = "force-dynamic";` to each of the 9 files
# I'll do this with a single sed-style script that prepends the line

git add -A
git commit -m "Add force-dynamic to DB-backed routes/pages

Without this, Next.js statically renders these at build time and
Vercel serves stale snippet/leaderboard data until a fresh deploy.
Required for the auto-ingest pipeline to work end-to-end.
"
git push origin baseline-mgtaco:main
# Vercel auto-redeploys
```

### Step 2 — Verify patch works (2 min)
```bash
# Wait for Vercel build
# Insert a test row in DB manually via Prisma Studio, refresh fish-spotter.vercel.app/feed
# Confirm new test row appears within ~1 second
# Delete test row
```

### Step 3 — Dry-run Storage migration (1 min)
```bash
cd ../FishSpotter
node scripts/ingest-from-drive.mjs --storage --dry-run
# Verify "would upload 60 files to Storage" + "would update 30 DB rows"
```

### Step 4 — Run Storage migration (1 min)
```bash
node scripts/ingest-from-drive.mjs --storage
# Creates bucket, uploads ~60 MB, updates DB rows
```

### Step 5 — Verify all three deployments serve from Storage (3 min)
```bash
# Localhost:3000
curl -s http://localhost:3000/api/snippets | jq '.[0].videoUrl'
# Should be: "https://aazxphcrexkggbmmceli.supabase.co/storage/..."

# Vercel
curl -s https://fish-spotter.vercel.app/api/snippets | jq '.[0].videoUrl'
# Should be the same Storage URL

# Open fish-spotter.vercel.app/feed in browser, play a clip
```

### Step 6 — One final Vercel cache flush (1 min)
```bash
# Trigger a redeploy via API so the edge cache is fresh
# (force-dynamic kicks in for new requests, but old cached responses still served from edge)
```

### Step 7 — Document the new operational flow (4 min)
Update `CLAUDE.md`, `README.md`, and create `docs/operational-runbook.md`:
> **To add new clips:** `node scripts/ingest-from-drive.mjs --storage`. That's it.

---

## After this lands — what the daily flow looks like

PEBL exports new snip from their pipeline → Drive folder gets new subfolder → you run:

```bash
cd "C:/Users/Christian Abulhawa/FishSpotter"
node scripts/ingest-from-drive.mjs --storage
```

That's it. The new clip is live on all three deployments within ~15 seconds. No git, no redeploys, no Vercel dashboard, no media-file shuffling.

Optionally automate further later:
- A scheduled task (Windows Task Scheduler / cron) running this every N minutes
- A file-watcher on the Drive folder triggering ingest on new subfolder appearance
- A "✓ ingested" marker file written into each Drive subfolder to skip already-processed ones

These are nice-to-haves once the basic flow is solid.

---

## What this plan deliberately does NOT cover

- **Seasonal OBIS refresh** — separate concern (`scripts/refresh-biogeographic-cache.mjs --seasonal`)
- **Hero image / fun fact population for new species** — manual curation, done separately when new species appear
- **Authentication** — unchanged
- **Schema changes** — none needed
- **Test suite updates** — likely none needed; will run after to confirm
- **Enhanced version (localhost:3000) deployment** — handled when we decide to deploy our extended app

---

## Open questions for you

1. **Apply force-dynamic to the baseline only, or also to our enhanced code?**
   - Recommendation: baseline only for now. Apply to enhanced if/when we deploy it.

2. **Delete `/public/media/snippets/` after migration?**
   - Recommendation: keep them. They're a free fallback, cost nothing on disk, and let `localhost:3001` still work even if Storage hiccups.

3. **Bucket privacy: public or signed URLs?**
   - Recommendation: public. Matches what's in git/on Vercel today. No PII, no secrets.

4. **Run the migration now (after approval), or schedule for a quiet moment?**
   - Recommendation: now. The migration is ≤30 seconds of "writes". No user-visible downtime expected.

---

## Approval needed

If the plan above looks right, reply with **"go"** and I'll execute steps 1–7 in order, reporting after each step. Or flip any of the open questions first.
