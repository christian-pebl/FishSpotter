# Operational runbook

> Day-to-day operations of the FishSpotter pipeline. Bookmark this; it's short by design.

## The daily flow

PEBL processes a new clip → folder appears in the Drive *Fish Spotter Snips* directory → you run **one command**:

```bash
cd "C:/Users/Christian Abulhawa/FishSpotter"
node scripts/ingest-from-drive.mjs --storage
```

That's it. Within seconds the new clip is live on:
- `localhost:3000` (enhanced version)
- `localhost:3001` (mgtaco baseline)
- **https://fish-spotter.vercel.app** (public Vercel deploy)

No git commits, no redeploys, no media file shuffling.

---

## What the command does

1. Reads every subfolder of `G:\.shortcut-targets-by-id\…\Fish Spotter Snips\`
2. For each folder:
   - Reads `metadata.json` + `bbox_data.json`
   - Uploads `snippet.mp4` + `thumbnail.jpg` to **Supabase Storage** bucket `snippets`
   - Upserts the corresponding `Snippet` row in Postgres with Storage URLs + all metadata
3. Idempotent — re-runs are cheap (only re-uploads changed files)

## Architecture (post-migration)

```
Drive folder ─────► ingest-from-drive.mjs ─────► Supabase Postgres (Snippet table)
                            │                              │
                            │                              │  read via Prisma
                            ▼                              ▼
                    Supabase Storage          Localhost + Vercel deployments
                    (snippets bucket)         (force-dynamic: never stale)
                            │
                            │  served via public URLs
                            └─────────► HTML <video src="…/storage/v1/object/public/snippets/…">
```

---

## Why this works without redeploys

| What we did | Effect |
|---|---|
| Added `export const dynamic = "force-dynamic"` to 9 mgtaco files | Next.js re-queries the DB on every request instead of statically rendering at build time |
| Migrated media from `/public/media/` to Supabase Storage | New clips don't need a git push to be served — they're just rows pointing at Storage URLs |

Both changes together = single-command updates.

---

## Re-running the ingest

Safe to run anytime. Examples:

```bash
# Picks up any new folders in Drive, refreshes metadata for existing ones
node scripts/ingest-from-drive.mjs --storage

# Dry-run first to see what would change
node scripts/ingest-from-drive.mjs --storage --dry-run

# Use a different source folder
node scripts/ingest-from-drive.mjs --storage --source="D:/path/to/clips"

# Legacy mode: copy to /public/media instead of Storage (no longer recommended)
node scripts/ingest-from-drive.mjs
```

## When you also need to update taxa or the OBIS prior

These don't run automatically. If new species appear in the data:

```bash
# Re-extract species from PEBL CSVs on Drive
python scripts/extract-species-data.py

# Refresh taxon records + aliases
node scripts/seed-taxa.mjs
node scripts/seed-taxon-attributes.mjs

# Re-link clips to their staff taxa (if PEBL has identified them)
node scripts/link-clips-to-taxa.mjs

# Refresh OBIS biogeographic prior (weekly is plenty)
node scripts/refresh-biogeographic-cache.mjs
```

## Sanity checks

### Quick "is everything healthy" sweep
```bash
# DB row count
node -e "(async()=>{const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();console.log('Snippets:', await p.snippet.count());await p.\$disconnect()})()"

# Localhost serving Storage URLs?
curl -s http://localhost:3000/api/snippets | grep -oc "storage/v1/object/public" | head -1

# Vercel serving fresh data?
curl -s -i "https://fish-spotter.vercel.app/api/snippets" | grep -E "X-Vercel-Cache|Age"
# Expect: X-Vercel-Cache: MISS, Age: 0
```

### Live "fresh data check" (no redeploy needed)
Insert a test row in Prisma Studio → refresh `https://fish-spotter.vercel.app/feed` → see it instantly.

---

## Capacity / cost

- **Supabase Storage** — free tier: 1 GB storage, 5 GB/month egress. We use ~50 MB; bandwidth depends on traffic (~3,300 clip plays/month free).
- **Vercel** — Hobby tier suffices for now.
- **No git commits** for new clips means the repo stays lean.

If volume grows (≫ 100 clips, or > 5GB egress), the upgrades:
- Supabase Pro: $25/mo (250 GB egress)
- Vercel Pro: $20/user/mo (mostly for team features; bandwidth is generous on Hobby)

---

## Rollback (if Storage fails or you change your mind)

1. Re-run ingest without `--storage` — repoints DB rows back to `/media/snippets/…` (files are still in `/public/media/snippets/` locally; not in the baseline worktree by default)
2. For Vercel: also need to push the `/public/media` folders to `christian-pebl/FishSpotter` (see commit `0b86fbf` for the pattern)
3. Optional: revert the force-dynamic commit (`git revert 0358f7e`) to return to fully-static mgtaco behaviour

All steps are reversible. Storage bucket can be deleted via the Supabase dashboard.

---

## What I deliberately didn't automate

- **Drive folder watcher** — manual trigger is fine until volume forces a daemon
- **Taxon attribute tagging** — needs human review when new species appear
- **OBIS refresh scheduling** — weekly manual run is plenty

Add these when the manual flow stops being acceptable.

---

## Troubleshooting

### "Vercel still shows old data"
- Check `X-Vercel-Cache` header — should be `MISS` not `HIT`
- If HIT with high `Age`: confirm `force-dynamic` is in the file (`grep -r "force-dynamic" src/app`)
- Last resort: trigger redeploy via Vercel dashboard

### "Storage upload fails"
- Check `.env.local` has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Verify token isn't revoked
- Check Supabase project isn't paused (free tier auto-pauses after 7 days of inactivity)

### "Video doesn't play"
- Check the video URL directly in browser
- Verify the bucket is public (`curl https://aazxphcrexkggbmmceli.supabase.co/storage/v1/bucket/snippets`)
- Confirm the file exists (`curl -I "<storage-url>"`)
- Check the codec — Chrome won't play MPEG-4 Part 2; needs H.264 (use the `_h264.mp4` variant if present, or re-encode with `ffmpeg -c:v libx264 -profile:v baseline -pix_fmt yuv420p`)

### "Localhost shows different data from Vercel"
- They share the same DB — they should always agree
- Check Prisma client is up to date: `npx prisma generate`
- Check `.env.local` URLs aren't pointing at different projects
