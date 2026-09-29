# Load benchmark: before and after PR #176 (7 Sep 2026)

The record for the split-orientation fix and the feed efficiency work in
[PR #176](https://github.com/christian-pebl/FishSpotter/pull/176), and the baseline every
later change should be measured against. Re-run the same three commands and append a
dated section here; never compare a number from one machine or network with a number
from another.

## How to re-run

All three run headless Chromium through Playwright (already a devDependency) against any
running server: a local `next start`, a worktree dev server, or production.

```bash
npm run bench:load -- https://www.fishspotter.app PROD 3
```

```bash
npm run bench:phone -- https://www.fishspotter.app PROD 3
```

```bash
npm run bench:split -- https://www.fishspotter.app PROD
```

- `bench:load` (`scripts/bench/measure-load.cjs`): medians of three cold loads per route at
  1280x800: TTFB, DOMContentLoaded, load, compressed HTML and JS, requests, DOM nodes,
  `<video>` elements, long tasks and blocking time, heap.
- `bench:phone` (`scripts/bench/measure-phone.cjs`): `/feed` at 390x844 with 4x CPU
  throttling: the same timings plus time-to-tappable (the identify catcher visible) and
  tap-to-panel latency. This is where hydration cost shows; on a desktop CPU the feed has no
  long tasks at all, before or after.
- `bench:split` (`scripts/bench/trace-split-open.cjs`): a frame-by-frame record of what the
  feed paints when the identify panel opens, at laptop, landscape-tablet and phone
  viewports. This is the only measurement that can see a first-paint flash; a settled-state
  check passes throughout such a bug's life.

For a local before/after, build both revisions with `next build` and serve each with
`next start -p 3513` (stop the server by PID before rebuilding; `next build` and a running
server share `.next`). The dev server is not comparable to a production build.

## The bug that started this

On a laptop or a landscape tablet, tapping a clip opened the identify panel as a phone
bottom sheet, with the clip squashed into the top half, and re-laid itself out as the docked
side panel a beat later. `bench:split` on the production build before the fix:

```
laptop 1280x800, open #1
  t=  77ms  grip(sheet)   gate-bottom=56%  dialog=0,364,1280,448  video=0,0,1280,352
  t=  94ms  grip(sheet)   gate-bottom=56%  dialog=0,362,1280,448  video=0,0,1280,352
  t= 138ms  seam(docked)  gate-bottom=56%  dialog=0,62,461,744    video=0,0,1280,352
  t= 211ms  seam(docked)  gate-left=36%    dialog=0,58,461,744    video=461,0,819,744
```

Two to three painted frames of the wrong layout, then the video re-cut, on every open
(open #2 was identical), and the same at 1024x768. After the fix, the same run:

```
laptop 1280x800, open #1
  t=  68ms  seam(docked)  gate-left=461px  dialog=-16,56,461,744  video=461,0,819,744
  t=  73ms  seam(docked)  gate-left=461px  dialog=-13,56,461,744  video=461,0,819,744
```

Docked from the first frame, the clip already at 461px in that same frame, and the panel
sliding in on its own x-axis. Production after the deploy reads the same (`gate-left=461px`
at 1280, `369px` at 1024, the phone's sheet at `gate-bottom=473px` from frame one).

## Local production build, before (69771d9) and after (b471cb3)

Same machine, same `next build` + `next start`, medians of three.

| `/feed`, 1280x800 | before | after |
|---|---|---|
| TTFB | 62 ms | 50 ms |
| DOMContentLoaded | 449 ms | 339 ms |
| load event | 705 ms | 529 ms |
| HTML, raw / compressed | 469 KB / 23 KB | 183 KB / 21 KB |
| requests / JS files / JS compressed | 74 / 22 / 364 KB | 74 / 22 / 365 KB |
| DOM nodes | 2,363 | 338 |
| `<video>` elements | 139 | 4 |
| long tasks / blocking time | 0 / 0 ms | 0 / 0 ms |
| JS heap | 18 MB | 10 MB |

| `/feed`, phone 390x844, CPU 4x | before | after |
|---|---|---|
| DOMContentLoaded | 1,632 ms | 1,192 ms |
| load event | 1,746 ms | 1,641 ms |
| time to tappable | 2,598 ms | 1,747 ms |
| tap to panel | 167 ms | 197 ms |
| long tasks (total) | 9 (1,412 ms) | 6 (661 ms) |
| blocking time | 932 ms | 378 ms |
| DOM nodes | 2,363 | 338 |
| JS heap | 18 MB | 10 MB |

Other routes, unchanged within noise: `/feed/browse` load 327 to 329 ms, `/species` 105
to 105 ms, `/` 689 to 684 ms. Bundle unchanged: `/feed` First Load JS 346 to 347 kB.
`/pebbles` TTFB from this machine (database in Ireland) 272 to 495 ms before; the aggregates
behind it are now cached for a minute.

## Production, before (69771d9) and after (54587b1, the merge of #176)

Same machine, same network, an hour apart, medians of three. TTFB here is the streamed
shell, so it says nothing about the page.

| `/feed`, 1280x800 | before | after |
|---|---|---|
| DOMContentLoaded | 396 ms | 250 ms |
| load event | 630 ms | 451 ms |
| HTML compressed | 20 KB | 20 KB |
| requests / JS | 73 / 370 KB | 73 / 371 KB |
| DOM nodes | 2,366 | 336 |
| `<video>` elements | 139 | 4 |
| JS heap | 23 MB | 12 MB |

| other routes, load event | before | after |
|---|---|---|
| `/feed/browse` | 508 ms | 402 ms |
| `/species` | 218 ms | 182 ms |
| `/` | 784 ms | 786 ms |

`/feed` on the throttled phone profile, production after: DOMContentLoaded 1,017 ms, time
to tappable 1,370 ms, blocking time 320 ms (5 long tasks, 570 ms), tap to panel 186 ms. No
production "before" exists for this profile; the local pair above is the like-for-like.

## What is still on the table, ranked by what it buys

1. ~~Media cache headers.~~ **Done, later the same day** (`scripts/fix-media-cache-control.ts`,
   see the CHANGELOG entry): every live clip and still now serves `max-age=2592000`, put there
   as identical bytes with the same URLs and no database writes. The 3 Sep colour-rescue
   re-upload had run from a checkout without the 29 Aug `storage.ts` fix, so all 326 objects
   carried `max-age=3600`. Not visible in a first-load benchmark; it is the repeat visit that
   changes, from a re-download of every still and clip each hour to a 304 or a cache hit.
2. ~~720p renditions of the feed clips.~~ **Done, 7 Sep 2026** (`scripts/lib/video-rendition.ts`
   + `scripts/generate-renditions.ts`, see the CHANGELOG entry and CLAUDE.md's "720p feed
   rendition" section). Every live clip now has a 720p sibling, served to phone viewports
   only (`src/lib/video-rendition-select.ts`); desktop keeps the 1080p master unconditionally.
3. Code-splitting the identify flow and the species catalogue (chunk `4568`, 249 KB raw) off
   the feed's first load with an idle prefetch. Judged not worth the tap-latency risk once
   windowing had cut the blocking time; revisit if `bench:phone` blocking time creeps up.

## 7 Sep 2026, later the same day: the 720p rendition, and a bug the same script caught

`bench:clips` (`npm run bench:clips -- <url> <label>`, new, joined the family alongside
`bench:load`/`bench:phone`/`bench:split`): opens `/feed` at a real Pixel 7 and a real
desktop Chrome context and reports every `snippet.mp4` / `snippet_720.mp4` request the
active card actually made. It exists because none of the other three scripts look at the
video FILE itself, which is what this feature changes and the others don't.

Every live clip and still on Supabase now has a 720p sibling (`scripts/generate-renditions.ts`,
run against production): 163 of 163, 0 failures. Measured directly against the live objects:

| | master (1080p) | rendition (720p) |
|---|---|---|
| Total across 163 clips | 1817.4 MB | 458.2 MB |
| Average | 11.2 MB | 2.9 MB |
| Median | 7.6 MB | 2.1 MB |

A **3.97x reduction** in what a phone downloads per clip. A phone is served the rendition,
desktop keeps the master unconditionally (`src/lib/video-rendition-select.ts`); see
CLAUDE.md's "720p feed rendition" section for the SSIM measurement behind the encode
setting and the reasoning for the device split.

**The first implementation was wrong, and `bench:clips` is what caught it.** It picked the
rendition from `useDocked()`, the split screen's own hook, whose server default (assume
not-desktop) is free to be briefly wrong for LAYOUT: CSS costs nothing to correct before
the next paint. A `<video src>` is not free: the browser fetches it the instant the SSR
HTML is parsed, before React runs. `bench:clips` against a real desktop context showed the
active card requesting BOTH `snippet_720.mp4` (the wrong server default) AND `snippet.mp4`
(the client correction), exactly double the bytes the feature exists to save. Fixed by a
server-side User-Agent guess (`src/lib/device-guess.ts`) seeding a media-query call kept
SEPARATE from `useDocked()`, so the SSR HTML already asks for the right file. Re-run after
the fix: a real desktop context requests only `snippet.mp4`; a real Pixel 7 context
requests only `snippet_720.mp4`. Confirmed directly in the raw HTML too, via `curl -A`
with a desktop and an iPhone User-Agent against the same URL.

**The general lesson, worth carrying to the next hook that picks a server default:** a
hook safe for layout because being briefly wrong costs nothing is not automatically safe
for a resource URL, where being briefly wrong costs a real download. Check what the
default is USED FOR, not just whether the hook itself is hydration-safe.

## 28 Sep 2026: the active card follows the scroll position (first-clip freeze fix)

The fix for the frozen first clip after the guest gate, and the empty screen after Next
(`docs/CHANGELOG.md`, 2026-09-28), changes how `FeedPlayer` picks the active card: a
scroll listener reading the scroll position replaces the IntersectionObserver, and the feed
keeps its order through a refresh. Measured because it is a feed change.

Local production builds of `main` (`3f2f942`) and the fix, `next start` against a throwaway
local Postgres holding **12 clips**, so these absolute numbers are not comparable with the
139-clip rows above; only this before/after pair is. Medians of three, same machine.

| `/feed`, 1280x800 | before | after |
|---|---|---|
| TTFB | 37 ms | 47 ms |
| DOMContentLoaded | 119 ms | 132 ms |
| load event | 315 ms | 328 ms |
| requests / JS files / JS compressed | 75 / 24 / 373 KB | 75 / 24 / 374 KB |
| DOM nodes / `<video>` elements | 203 / 4 | 203 / 4 |
| long tasks / blocking time | 0 / 0 ms | 0 / 0 ms |

| `/feed`, phone 390x844, CPU 4x | before | after |
|---|---|---|
| DOMContentLoaded | 961 ms | 908 ms |
| load event | 1,466 ms | 1,069 ms |
| time to tappable | 1,558 ms | 1,165 ms |
| tap to panel | 175 ms | 154 ms |
| long tasks (total) | 4 (524 ms) | 5 (526 ms) |
| blocking time | 309 ms | 300 ms |
| DOM nodes | 202 | 206 |

Unchanged within noise. The phone load and tappable times move with the clip download, not
with this code (blocking time, the CPU cost, is 309 against 300 ms). Other routes: `/feed/browse`
load 202 to 190 ms, `/species` 105 to 103 ms, `/` 236 to 252 ms (one 58 ms long task in
one after run; `/` imports none of the changed code). `bench:split`: the first painted frame
of an open is the final layout at laptop, landscape tablet and phone, before and after, so
the #176 flash stays fixed.

### Production, before (3f2f942) and after (a4a674a), 29 Sep 2026

The same three scripts against https://www.fishspotter.app (139 clips), same machine and
network, medians of three, read-only anonymous loads. "Before" was taken minutes before the
merge, "after" as soon as the deployment reported success, then again once caches were warm.

| `/feed`, 1280x800 | before | after, first run | after, warm |
|---|---|---|---|
| TTFB | 11 ms | 10 ms | 11 ms |
| DOMContentLoaded | 279 ms | 246 ms | 215 ms |
| load event | 503 ms | 617 ms | 439 ms |
| JS files / JS compressed | 24 / 381 KB | 24 / 381 KB | 24 / 381 KB |
| DOM nodes / `<video>` elements | 344 / 4 | 340 / 4 | 338 / 4 |
| long tasks / blocking time | 0 / 0 ms | 0 / 0 ms | 0 / 0 ms |
| JS heap | 12 MB | 11 MB | 10 MB |

| `/feed`, phone 390x844, CPU 4x | before | after, first run | after, warm run 1 | after, warm run 2 |
|---|---|---|---|---|
| DOMContentLoaded | 1,073 ms | 1,254 ms | 1,051 ms | 1,006 ms |
| load event | 1,193 ms | 1,495 ms | 1,211 ms | 1,084 ms |
| time to tappable | 1,301 ms | 1,821 ms | 1,493 ms | 1,214 ms |
| tap to panel | 189 ms | 227 ms | 192 ms | 179 ms |
| long tasks (total) | 4 (583 ms) | 4 (627 ms) | 4 (522 ms) | 4 (516 ms) |
| blocking time | 383 ms | 401 ms | 322 ms | 316 ms |
| DOM nodes / heap | 336 / 12 MB | 336 / 13 MB | 335 / 13 MB | 337 / 13 MB |

The first run after a deploy reads slow on the load-time rows, including routes this change
does not touch (`/species` load 321 to 403 ms and `/` 790 to 838 ms in the desktop run),
which is what cold edge caches look like. The warm runs sit at or under the before numbers on
every route. Blocking time and the long-task total, the CPU cost and the numbers this change
could move, did not rise (383 ms before, 316 to 401 ms after). `bench:split`: the first painted
frame of an open is the final layout at laptop, tablet and phone, before and after.

One thing the live scroll check turned up that this change did not cause. Desktop is served
the 1080p master, and on this connection a 25.4 MB clip (the MP4 index is at the front of the
file, so it is not a packaging fault) took about 15 s to reach its first frame during a fast
scroll through five clips. A second run hit the same on a different large clip. Phone, on the
720p renditions, started every clip at once, and the first clip started in about 170 ms on
both. Serving the master to desktop unconditionally is a standing choice
(`src/lib/video-rendition-select.ts`), so this is a note, not a change.
