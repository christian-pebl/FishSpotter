# Clip delivery: caching and opaque clip paths (plan, 11 Nov 2026)

Plan only. Nothing in a dashboard has been changed, and no clip has been moved or renamed.

## What is true today

Measured on production on 11 Nov 2026 with a range request to every live clip.

| | Measured |
|---|---|
| Live clips | 139, all in Supabase Storage (project `aazxphcrexkggbmmceli`, bucket `snippets`) |
| Master (1080p) size | median 7.5 MB, mean 11.6 MB, largest 48.9 MB, 1.6 GB in all |
| Phone (720p) rendition | median 2.1 MB, mean 2.6 MB (30 sampled; every one had a rendition) |
| Thumbnail | mean 338 KB |
| Cache header on clips | `public, max-age=2592000` (30 days) on all 139 |
| Edge cache | Cloudflare in front of Supabase; 128 of 139 were a MISS on a first request, so the edge is cold at FishSpotter's traffic |
| Clip URLs carrying a species label | 52 of 139 (the object key is `<externalId>/snippet.mp4`, and `externalId` holds the label, for example `wrasse00007270`) |

The 11 Nov review recorded `Cache-Control: private, no-cache` and `CF-Cache-Status: DYNAMIC`. That is not what production returns now; every clip already says it may be cached for 30 days. So the problem is not the header. It is where the bytes are billed and how cold the cache is.

## Why it matters

Supabase Free gives 5 GB of uncached and 5 GB of cached egress a month, counted separately. Over quota, a free organisation gets a notice and a grace period, then restrictions until the next cycle. It is not billed. Smart CDN is Pro only.

A rough month at the Atlas target of 40 active spotters, on stated assumptions (5 sessions each, 15 clips a session, 70% on phones at 2.6 MB a clip, 30% on desktop at 11.6 MB): about 16 GB. That is over the 10 GB combined allowance before counting visitors who never become active. Until PR "no video behind the age question", every signed-out desktop visit also cost about 36 MB before the first tap.

## Option A: stay on Supabase, tune it

- Upload with `public, max-age=31536000, immutable` and content-addressed names (below), so a returning browser never asks again.
- Cost: nothing. Effort: about 2 hours (script plus re-upload).
- Limit: egress still counts against the Supabase quota whether the edge hits or not, and the edge stays cold at low traffic. It does not solve the growth problem.

## Option B (recommended): the existing R2 bucket on a custom domain

The R2 bucket `fishspotter-snippets` already exists, and the `fishspotter.app` zone is on the same Cloudflare account (nameservers `khloe` and `bjorn.ns.cloudflare.com`, checked 11 Nov; same account per the 4 Oct account note). Cloudflare's rule is that the custom domain must be a zone in the same account as the bucket, so this qualifies.

- R2 egress is free. The free tier is 10 GB-month of storage, 1 million Class A and 10 million Class B operations a month. All clips, renditions and thumbnails come to about 2 GB.
- A custom domain such as `media.fishspotter.app` puts Cloudflare's cache in front of the bucket. MP4, JPEG and WebP are cached by default by extension, the 512 MB per-file limit is far above the largest clip, and range requests (how browsers fetch video) are served from cache.
- Do not use the `r2.dev` address for clips. Cloudflare says it is rate-limited, for development only, and has no caching. (The species WebP images already point at an `r2.dev` address in `next.config.mjs` and `layout.tsx`; they should move to the same custom domain.)
- Cost: nothing on the free tier. No new account. Effort: about 4 hours of agent time plus 10 minutes of Christian's.

## Opaque clip paths (do it in the same move)

A clip's address should say nothing about what is in it.

1. **New object keys.** `clips/<first 24 hex of sha256(bytes)>.mp4`, `clips/<hash>-sd.mp4`, `thumbs/<hash>.jpg`. A content hash names the bytes and nothing else, and a re-graded clip gets a new name by itself, so the `?v=` cache-buster goes and the files can be marked `immutable`.
2. **One code change in `scripts/lib/storage.ts`.** `objectKey()` takes the bytes instead of `externalId`, for `sync.ts`, `reupload-snippets-hq.ts`, `generate-renditions.ts` and `migrate-to-r2.ts`. `externalId` stays in the database as the internal key the sync matches on.
3. **Public API.** `GET /api/snippets` and `GET /api/snippets/[id]` return `externalId` (and the latter the whole row) to anyone. Nothing in the app calls either. Make them staff-only, or drop `externalId` from the public shape. Small code PR, can go first.
4. **Migration.** Extend `migrate-to-r2.ts` to write the hashed keys: copy each clip, rendition and thumbnail, confirm each new URL answers 200 with the same length, then update the row. Dry run first, then 3 clips, then all. Leave the Supabase objects in place for 14 days.
5. **CSP.** Add the custom domain to `media-src` and `img-src` in `next.config.mjs` before the rows change, or every clip is blocked.
6. **Check.** `npm run check:codecs`, `npm run bench:clips`, and a probe like this file's table: every URL opaque, every response `immutable`, a second request a cache HIT.
7. **After 14 days and Christian's yes.** Delete the old Supabase objects (`<externalId>/...`), or the names stay reachable to anyone who saved them.

Rollback at any point before step 7 is a database update back to the Supabase URLs, which the migration log records row by row.

## What Christian clicks (Option B)

1. Cloudflare dashboard, R2, `fishspotter-snippets`, Settings, Custom Domains, Connect Domain: `media.fishspotter.app`. Cloudflare adds the DNS record.
2. Vercel, FishSpotter project, Settings, Environment Variables: set `R2_PUBLIC_URL` to `https://media.fishspotter.app` (Production and Preview).
3. Say yes to the migration run, and later to deleting the old Supabase objects.

R2 credentials for the migration script live in Christian's `.env.local`, never in the repo.
