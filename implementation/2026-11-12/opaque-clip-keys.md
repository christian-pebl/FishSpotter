# Opaque clip names: what changed, the dry run, and the runbook (12 Nov 2026)

Code only. Nothing in production storage or the production database has been
changed. The migration below runs when Christian says so, three clips first.

## The problem

A clip was stored at `<bucket>/<export folder name>/snippet.mp4`. The export
folder name is the row's `externalId`, and it is typed by whoever cut the clip.
Measured on the live database on 12 Nov 2026: 64 of the 163 rows have a run of
letters where a clip number normally sits, just before `_track_manual` (a
pattern, not a species list; the same day's manual check counted 56 that name a
species outright). A player has to be given the clip's URL to play it, so for
those clips the address said what was in the clip before anyone guessed.

The answer leak through the statistics route was closed on 11 Nov. The public
snippet API stopped returning folder names in the PR beside this one. This is
the last part: the storage names themselves.

## What the code does now

- **New key layout** (`scripts/lib/object-keys.ts`): `clips/<hash>.mp4` for the
  1080p master, `clips/<hash>-sd.mp4` for the 720p rendition, `thumbs/<hash>.jpg`
  for the still. `<hash>` is the first 24 hex characters of the SHA-256 of that
  file's own bytes. `objectKey()` takes a kind and the bytes and nothing else,
  so there is no folder name for it to leak.
- **Every upload path uses it**: `sync.ts`, `seed.ts`, `add-anjali-clips.ts`,
  `generate-renditions.ts`, `fix-unplayable-snippets.ts`,
  `reupload-snippets-hq.ts` and the old `transcode-to-h264.ts`. Each writes the
  URL the upload returns into the row. The `?v=N` cache-buster is gone: new
  bytes are a new address.
- **Cached for a year.** A content-addressed object cannot change under its
  name, so it is uploaded with `max-age=31536000` (R2 also sends `immutable`).
- **`externalId` stays in the database.** It is still the key the sync matches
  folders on. It is just no longer part of any address.
- **One known cost.** A re-cut used to overwrite its object. Now it leaves the
  previous cut behind in storage. A few a month; prune by hand occasionally.

## Is doing it in two stages sound?

Yes, with one thing to look at first.

Stage 1 renames inside the existing Supabase bucket. Stage 2, later, copies the
same keys to R2 behind `media.fishspotter.app`. The same command does both,
because it treats a row as done when its URLs are content-addressed keys **on
the active provider**. Why the split works:

- **Same host in stage 1.** The clips stay on the Supabase host, which is
  already in the CSP (`media-src`, `img-src`) and the image optimizer whitelist.
  No dashboard work, no deploy ordering, no risk of a blocked clip.
- **The keys carry over unchanged.** Stage 2 changes the host in front of the
  key and nothing else, so it is a copy and a prefix swap, not a second rename.
- **Rollback is a database update.** The old objects are not touched, and a log
  line with each row's old and new URLs is written before the row changes.
- **It closes the leak now** instead of waiting on the Cloudflare and Vercel
  steps stage 2 needs.

The thing to look at: **stage 1 holds two copies of every clip until the old
ones are deleted.** The dry run below found 2.48 GB of clips, so about 4.96 GB
for the overlap. The Supabase Free plan includes 1 GB of storage, measured as an
average over the billing month, with a notice first and restrictions after if
it stays over. The project is therefore already about 2.5 times over on clips
alone, and has been since the 3 Sep re-upload without being restricted, but
doubling it for a fortnight is not free of risk. Two ways to keep that small:

1. Shorten the overlap. The brief was 14 days. Three or four days is enough to
   see the site working, and the clean-up takes `--min-age-days`.
2. Or skip stage 1 and go straight to R2 (10 GB free, no egress charge). That
   fixes the storage position instead of stretching it, but it needs the R2
   credentials, the custom domain and a CSP change deployed first.

Recommended: look at Supabase, Usage, Storage once (no change, one minute).
Then run stage 1 with a short overlap, and do stage 2 when convenient.

## The dry run (production, read-only, 12 Nov 2026 16:00 UTC)

Run with only the database URL and the public storage address in the
environment: no storage key was present, the rows were read inside a
`READ ONLY` transaction, and no log file was created.

| | |
|---|---|
| Rows in the database | 163 (139 live, 24 hidden) |
| Already on content-addressed keys | 0 |
| Rows that would be migrated | 163 |
| Rows whose current objects did not answer | 0 |
| Objects | 489 (163 masters, 163 renditions, 163 stills) |
| Size | 2,479 MB (masters 1,933; renditions 498; stills 48) |
| Rows with no 720p rendition | 0 |
| Folder names carrying a label (the pattern above) | 64 |
| Largest single object | 48.9 MB (under the 50 MB Free upload limit) |

A second dry run with `--hash --limit 3` read three clips and printed their
exact new names (for example `clips/cb71c675a34b04044b790dcf.mp4`). The three
stills came from the local snips folder, because their checksums equalled the
live objects'; the masters and renditions were downloaded, because the live
masters were re-graded on 3 Sep and no longer match the folder. So the full run
downloads about 2.4 GB once (kept in a local cache, so a re-run does not repeat
it) and uploads the same.

The per-row report names export folders, so it is not in this repository. It is
in the session notes folder and on the PC under `~/.fishspotter/`.

## Rehearsal

The write path was run end to end against a stand-in storage server and the
local sandbox database, with three made-up clips (one with no rendition, one
with spaces and brackets in its folder name): dry run; `--execute` refused
without a scope; three rows migrated, 8 uploads all `max-age=31536000`, the 8
named objects untouched; a second run found nothing to do; rollback restored all
three rows; migrated again; clean-up held all three as under 14 days old, then
with `--min-age-days 0` deleted exactly the 8 named objects and none of the 8
hashed ones; rollback then refused, correctly. 40 unit tests cover the same
ground against fakes, including a truncated upload, a failed upload, a failed
row update, and a second row still using an old URL.

The first run against real Supabase storage will be the three-clip run.

## Runbook

All from an up-to-date checkout of `main`, on the PC that has `.env.local`.

```
npm run db:migrate-clip-keys                           # dry run, every row
npm run db:migrate-clip-keys -- --execute --limit 3    # three clips for real
```

Open the site, play those three clips on a phone and on a laptop, check the
archive thumbnails. Then:

```
npm run db:migrate-clip-keys -- --execute --all        # the rest; safe to re-run
npm run check:codecs
npm run bench:clips
```

If anything looks wrong, at any point before the clean-up:

```
npm run db:migrate-clip-keys -- --rollback             # dry run of the undo
npm run db:migrate-clip-keys -- --rollback --execute   # database only, storage untouched
```

After the overlap (14 days by default), and only on a separate yes:

```
npm run db:migrate-clip-keys -- --delete-old                       # dry run
npm run db:migrate-clip-keys -- --delete-old --execute
npm run db:migrate-clip-keys -- --delete-old --min-age-days 3      # a shorter overlap
```

The clean-up deletes only the named objects the log recorded, only for rows
that still point at their migrated URLs, only after checking those URLs still
answer, and never a content-addressed key. After it, rollback is not possible.

**Keep `~/.fishspotter/clip-keys.jsonl`.** It is what rollback and clean-up
read. It contains export folder names, so the script refuses to write it inside
the repository.

## What Christian must do

1. **Before the next weekly sync after this merges:** the scheduled task
   `PEBL-FishSpotter-SnipSync` runs from the PC's main FishSpotter checkout,
   which is on branch `fix/snip-metadata-gate`, 9 commits ahead of and 102
   behind `main`, with uncommitted edits. A sync from that checkout uploads new
   clips under their folder names again. It needs to be on current `main`
   (its local commits and edits pushed or set aside first), with `npm ci`.
2. **Supabase, Usage, Storage:** read the figure. No change.
3. **Say yes** to the three-clip run, then to the full run, then, days later,
   to the clean-up.

Stage 2 (later): R2 API token in `.env.local`, custom domain
`media.fishspotter.app` on the bucket, the host added to `IMAGE_HOSTS` and
`MEDIA_HOSTS` in `next.config.mjs` and deployed, then the same three commands
with `STORAGE_PROVIDER=r2`.

## A correction, so nobody chases it again

The 11 Nov review said clips are served uncached. They are not. A HEAD request
to a clip returns `Cache-Control: private, no-cache` and
`CF-Cache-Status: DYNAMIC`; a real GET of the same URL, ranged or whole, returns
`public, max-age=2592000` and `HIT`. A ranged GET of every live object on
12 Nov found the 30-day header on all 417. CLAUDE.md already said never to
measure this with a HEAD; it now says so with this example. The delivery
concern that remains is quota (storage and egress on the Free plan as use
grows), which is what stage 2 is for, and it is not urgent.
