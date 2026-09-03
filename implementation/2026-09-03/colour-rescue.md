# SubCam colour rescue (3 September 2026)

Post-hoc colour and sharpness rescue for the blue and green SubCam clips. Research across
three fronts, a 20-clip A/B against every serious alternative, the cost of doing it to the
whole archive, and a production script. Findings page (sheets, metrics, embedded clips):
https://claude.ai/code/artifact/8282a573-68e1-4e57-87b7-217a37e01ec3

Status: **SHIPPED LIVE, 3 September 2026.** All 163 live clips republished with the `gentle`
profile. Verified: `npm run check:codecs` clean before and after, live-site check (feed page,
archive grid, 24+ thumbnails, no console errors) confirmed the corrected colour is showing.

Round 1 (3 Sep 2026, `full` profile only): 33-clip blind A/B on the hosted page
(https://claude.ai/code/artifact/e3698f56-be5c-4555-b2be-ebe01b9437b0) and the full-HD wipe/flip
viewer (`colour-ab\review-fullhd.html`). Result: 19 preferred optimised, 7 rated it the same,
5 preferred the original. Christian's note: the optimised side is a bit too black-and-white
grey-scale on some clips, wants a splash of colour kept.

Round 2 (3 Sep 2026, same day): added a `gentle` profile to `colour_rescue_snips.py` (white
balance only 75 percent of the way to neutral, chroma cap raised, lighter CLAHE and unsharp),
rendered all 33 clips, built a three-way A/B/C viewer, un-primed letter labels (A=original,
B=gentle, C=full): `colour-ab\review-abc.html` (one composited 3840x720 clip per pick in
`colour-ab\threeway\`, built by `threeway_page.py`).

**Result: `gentle` won 33 of 33, unanimous, no ties, none for the original or for `full`.**
`gentle` is now the script's default profile. Round 1's `full` profile stays available
(`--profile full`) but is superseded; do not use it without a reason.

**Round 3 (same day): published to the whole live archive.** Christian gave explicit go-ahead
("get all video on fishspotter updated to the latest") rather than the staged half-archive A/B
floated earlier, so the full rollout was run directly.

1. Full archive rendered locally (`--profile gentle --workers 3`, no `--ab`, full clip length,
   not just the 10 s review cut) into a scratch mirror, `scratchpad/archive_gentle`.
2. **Bug found and fixed mid-run**: the first attempt crashed after 73 of 163 clips. Root cause
   was a corrupt source file (`ffprobe`: "moov atom not found") in the shared G: snips archive,
   and `colour_rescue_snips.py` had no per-job error handling, so `ProcessPoolExecutor.map`'s
   ordered iterator raised on that job and the `for` loop stopped consuming further results,
   silently dropping every clip queued after it, not just the bad one. Fixed by wrapping
   `process_snip` in a try/except that logs a `FAILED` line and returns instead of raising; no
   marker is written on failure so a re-run retries it. Re-running the exact same command then
   skipped the 73 done, retried and cleanly failed the corrupt ones, and processed everything
   else: **165 of 168 attempted succeeded, 3 failed** (all confirmed corrupt sources, not a
   pipeline bug).
3. **Root-caused the 3 failures before publishing**: direct queries against the production
   `Snippet` table showed none of the 3 failing externalIds are live rows at all. Each is a stale
   duplicate export of the same source footage at a different manual-track frame range; a clean
   sibling export of each (different frame numbers) already exists and is live. Zero production
   impact. Flagged for archive housekeeping via a spawned session (`task_d1516469`), not urgent.
4. **Published**: `npx tsx --env-file=.env.local scripts/reupload-snippets-hq.ts --from
   scratchpad/archive_gentle --all` against all 163 live rows. `--all` is required, the script's
   default idempotent skip logic only skips a row already on the target *host*, and since every
   row was already on Supabase (nothing to "migrate"), a run without `--all` silently no-ops.
   Tested with `--dry-run --limit 5` then a real `--limit 2` push before the full run. Result:
   `processed=163 skipped=0`.
5. **Verified**: `npm run check:codecs` reported "All 163 clips are H.264" both immediately before
   and after the publish. Live-site check via the Browser pane: `/feed` played a freshly
   cache-busted clip (`?v=4`) at `readyState 4`, no console errors; scrolled through several more
   clips, all showing the corrected pale/desaturated look instead of the original blue or green
   cast; `/feed/browse` archive grid showed 24+ thumbnails, all loaded (`naturalWidth > 0`), none
   broken, no console errors.

The rollout is complete. No further action needed on this project unless new snips are added
(re-run `colour_rescue_snips.py --profile gentle`, resumable, then the reupload script again) or
the archive-cleanup task above gets picked up.

The full-resolution two-way twin is `OneDrive\Desktop\Fishspotter media\colour-ab\index.html`
(plus a reel), and the two-way full-HD wipe/flip viewer is `colour-ab\review-fullhd.html` (33
files at 3840x1080 in `colour-ab\fullhd\`, built by `experiment/fullhd_page.py`). Builder for
round 2: `experiment/threeway_page.py` (decodes 3 sources per clip in OpenCV, burns neutral A/B/C
labels, hstacks, single-threaded ffmpeg encode. The one thing to speed up if this repeats: no
parallelism, about 30 to 40 s per clip.

## Why the clips look like that

At 15 m the illuminant is far off the Planckian locus (red and orange gone), so libcamera's
Bayesian AWB has no good fit; its likelihood surface has two shallow minima and small scene
changes flip it between a green and a blue solution. The NoIR test looked better because
`imx708_noir.json` sets `bayes: 0` (plain grey-world), not because of the IR filter.

## What the archive actually contains

- **108 of 167 clips (65 percent) have no red channel at all**: red median 0, 93 to 98 percent
  pure zeros, including every Algapelago and Blakeney clip. 21 more are "weak" (median 3 to 20).
  38 have usable red (Veerse Meer 14, Dale Bay 6, unlabelled 11, Ramsey 4, Kelp Crofters 2).
  Colour cannot be restored on a dead-red clip; only legibility can. Data: `experiment/red_survival.csv`.
- **The flip is between clips, not within them.** Frame-by-frame scan of 165 clips at 160x90:
  4 clips show a jump of more than 3 Lab units between adjacent frames, 10 show a drift of more
  than 10 across the clip, 151 hold one colour state. One gain per clip fixes 94 percent; a gain
  smoothed over nine frames handles the rest. Data: `experiment/flicker_scan.csv`.
- The camera's own raw recording is already H.264 1080p at about 4.6 Mbps (no DNG), from a
  binned 2304x1296 sensor mode. The softness is water scatter, not a pixel shortage.

## The pipeline that won

`DesktopML/colour_rescue_snips.py` (self-contained, CPU, no weights, no licence questions):

1. ffmpeg `hqdn3d` temporal denoise first (`4:3:6:4.5` when mean L* under 45, else `2:1.5:3:3`);
   every later step amplifies grain, and the first cut of the dark pollack clip proved it.
2. Per-frame channel means smoothed through time (median 9, then mean 5). The flicker fix.
3. Ancuti-2018 channel compensation: red from green everywhere, blue from green when weak.
4. Grey-world gains from the smoothed post-compensation means, capped at 3.5x.
5. CLAHE on L* (clip 2.0, 8x8).
6. Chroma cap by red survival: dead-red clips keep half their residual hue, weak 70 percent,
   usable 100 percent. This is what stops the method asserting colour it has no evidence for.
7. Unsharp mask, amount 0.4, sigma 1.2. Output H.264 crf 18 faststart, new thumbnail.jpg,
   every other file in the snip folder copied unchanged.

Measured 138 to 307 ms per 1080p frame under heavy CPU load (mean 218): about 168 minutes for
the whole archive (46,118 frames) on this PC, single worker; `--workers 2` roughly halves it.

```
cd DesktopML
python colour_rescue_snips.py "<Fish Spotter Snips>" "<mirror folder>" --workers 2       # whole archive
python colour_rescue_snips.py "<Fish Spotter Snips>" "<review folder>" --ab --seconds 10  # review set
```

Then, to publish: `npx tsx --env-file=.env.local scripts/reupload-snippets-hq.ts --from "<mirror folder>"`
(re-uploads and bumps the `?v=` cache-buster). Keep the originals; it is reversible.

## What the A/B showed (8 worst clips x 10 methods, plus 12 more clips through the winner)

| Method | Residual cast (mean abs a*, b*) | Flicker | Verdict |
|---|---|---|---|
| Original | 29.3, 37.3 | 0.25 | |
| Grey-world only | 20.6, 6.0 | 0.13 | Cannot lift a zero red channel; turns blue clips teal |
| Compensate + grey-world | 0.3, 0.7 | 0.04 | Neutral, but a warm patch in bright water |
| + CLAHE | 0.3, 0.7 | 0.04 | Legibility up 5x (Laplacian variance 10 to 57) |
| **Neutral (+ chroma cap)** | **0.3, 0.4** | **0.02** | **Winner**: same as above without the false hue |
| Ancuti fusion (2018) | 0.1, 0.4 | 0.03 | Fine, flatter, 5x slower |
| MLLE (TIP 2022) | 0.6, 0.8 | 0.08 | Splits dead-red clips into pink and green, 1 s/frame |
| Dive Color Corrector | 4.0, 27.6 | 0.62 | Invents red: sepia on every green clip, blotchy on dark ones |
| WaterNet (TIP 2020, GPU) | 10.5, 29.8 | 0.45 | Barely corrects; its own preprocessing crashes on dead-red frames |

UCIQE and UIQM reward saturation and rank the originals highest; every 2024 to 2026 survey
warns against choosing by them. Full numbers: `experiment/ab_metrics.csv`.

Sharpening (ffmpeg on three clips): `cas=0.5` lifts edge sharpness 1.3 to 1.7x, `hqdn3d` then
`unsharp` 1.2 to 1.7x while halving frame-to-frame noise, wide-radius unsharp plus cas 1.7 to
2.3x. No halos at those strengths. Real but modest, which is why the pipeline ends with a
light unsharp rather than a model.

## What the research said (full briefs alongside this file)

- `research-underwater-enhancement-sota.md`: 2023 to 2026 UIE/UVE literature. Best value is a
  per-clip gain plus a classical contrast step; WaterNet the only learned model worth a pilot;
  diffusion 20x to 10,000x a CNN and generative; model-free methods handle green casts best.
- `research-video-sr-and-commercial.md`: super-resolution is the wrong tool (scatter, not
  pixels; every learned upscaler invents detail, Hallucination Score bicubic 4.6/5 vs
  Real-ESRGAN 2.8 to 3.3); ffmpeg recipes; Topaz Proteus about 17 to 43 dollars in credits plus
  a 299 dollar plan (Adobe buying Topaz); Resolve Studio about 240 pounds; cloud GPU prices.
- `research-practitioner-consensus.md`: what divers and colourists do (Resolve free, WB picker on
  a neutral, RGB mixer green into red, gentle curves); one-tap apps judged over-red and muddy;
  green water needs a magenta tint shift plus red lift, not a temperature shift; flicker recipes;
  the source-side fix for future recordings.

## Traps hit

- Reading 1080p video off the G: Drive mount is slow; copy clips locally. Thumbnail passes are fine.
- Keeping every method's frames in RAM x 8 processes OOMs a 28 GB box; stream to ffmpeg, 2 to 3
  workers, per-(clip, method) JSON markers so a restart resumes. A Claude Code restart kills
  every background job.
- ffmpeg `unsharp` matrices are capped at 23 and lx+ly must be at most 25.
- Python heredocs writing path lists on Windows produce CRLF; strip `\r` before a shell loop.
- WaterNet: the Dropbox weights still download but torch.hub rejects them on a hash-prefix
  check (pass `--weights`); its `white_balance_transform` divides by the red-channel sum (inf
  quantiles on dead-red frames); its writer asks for avc1, which headless OpenCV lacks; it calls
  `cv2.destroyAllWindows()`. Four Modal submissions (A10G, cents) to get one comparison.
- The in-app Browser pane cannot open claude.ai artifacts (not signed in) nor file:// URLs;
  serve the built page over a local http.server to verify it. Scrolled screenshots come back
  blank in the pane; DOM checks (image naturalWidth, video readyState) are the reliable test.

## Open

- Christian to confirm the look on the 20 side-by-sides (the neutral rendering is deliberately
  monochrome on dead-red clips; a faint fixed sea tint is possible if preferred).
- Proposed in-app test before a full batch: process half the clips (alternate archive order so
  both halves span every site) and compare answer accuracy against consensus, time to first
  answer and watch time via the Event pipeline over two weeks.
- Per-site tuning of the chroma cap (Ramsey Sound weak-red clips could keep a little more).
- Future deployments: lock `ColourGains` after settling on a grey reference at depth, or set
  `bayes: 0` in a copy of `imx708.json`, or tune the CT curve with a Macbeth chart at depth.
