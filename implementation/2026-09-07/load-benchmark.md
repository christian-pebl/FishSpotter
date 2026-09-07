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
2. 720p renditions of the feed clips (8.8 MB average for seven seconds at 1080p); the site
   is media-bound and this is most of what a spotter downloads.
3. Code-splitting the identify flow and the species catalogue (chunk `4568`, 249 KB raw) off
   the feed's first load with an idle prefetch. Judged not worth the tap-latency risk once
   windowing had cut the blocking time; revisit if `bench:phone` blocking time creeps up.
