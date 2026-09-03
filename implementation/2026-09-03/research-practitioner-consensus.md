# Fixing blue and green casts in underwater H.264 clips after the fact: what practitioners actually use

Research brief, 3 September 2026 (agent pass). Sources: a last30days engine run (Reddit partial,
no X/TikTok), yt-dlp captions of nine YouTube tutorials, forum threads (Blackmagic, Adobe,
Raspberry Pi, VideoHelp, r/davinciresolve, r/scuba), app store listings, the Raspberry Pi tuning
guide, and the benchmark papers. ScubaBoard refused direct reads, so its threads are represented
by search-engine summaries only.

## The short answer

1. Cheapest faithful route is DaVinci Resolve (free), one node tree built on scopes, applied per
   group of clips, rendered as individual clips. Every practitioner source converges on the same
   three moves for green water: white-balance picker on something neutral, then RGB mixer feeding
   green (and a little blue) into the red output, then gentle curves. Nobody who grades for a
   living recommends a one-tap app for anything meant to be faithful.
2. The AWB flicker is a separate problem from the cast and needs a separate step. Resolve's Color
   Stabilizer is Studio-only ($295 one-off). In the free version the honest options are: split at
   the flips and grade the two states as two groups, keyframe temperature/tint across the ramps,
   or pre-normalise per frame with ffmpeg or a 30-line OpenCV script before grading. No
   off-the-shelf script for dive footage was found; the pieces exist.
3. Green water is not blue water. Red-filter LUTs and "underwater" presets assume blue survives; in
   UK water the surviving channel is green and blue is also depleted, so the correction is a
   magenta (tint) shift plus red lift, not a temperature shift. The published benchmark that split
   test images by cast found the simple model-free methods (fusion, CLAHE, MSRCR) handled green
   casts and a physics prior (BP) failed on them.

## Tool table

| Tool | Cost | Batch | What practitioners report | Green water and flicker notes |
|---|---|---|---|---|
| DaVinci Resolve (free) | £0 | Yes: groups, apply grade to group, copy/paste attributes, Shot Match, render as individual clips | The default answer in every forum and tutorial. Free version has Color Warper, HSL keyers, curves, RGB mixer, spatial NR. Free lacks Color Stabilizer, Deflicker, temporal NR, Magic Mask | 8-bit H.264 bands under heavy moves; two colourists say stay with curves and mixer, avoid qualifiers, keep moves gentle. No temporal tool for the flicker |
| DaVinci Resolve Studio | $295 one-off | Same as free | Adds Color Stabilizer (Resolve FX Color), Deflicker, temporal and AI NR, Magic Mask | Color Stabilizer is the only NLE-native fix for in-clip WB flips. One user found its White Balance stabilisation made colour jumps worse and used Light-only plus manual work |
| Adobe Premiere Pro | Subscription (roughly £20 to 25/month) | Copy/paste Lumetri across clips; no true batch | Lumetri RGB curves, tint wheels, parade; 32-bit float processing avoids banding, put 8-bit effects last. No native colour stabiliser; users Dynamic Link to After Effects | A poster with 70+ drifting clips found no batch fix in Premiere |
| After Effects Color Stabilizer | Included with AE | Per clip | Samples black/mid/white points on a pivot frame and holds them constant across the layer | Designed for exactly this failure. Needs static sample regions, which moving seabed footage rarely has |
| Final Cut Pro | £299.99 one-off | Copy attributes; no true batch | Color Board, Color Curves, Balance Color; tutorials are old and blue-water | Thin evidence; no colour-stabiliser equivalent found |
| Dive+ (iOS/Android) | Free with watermark and daily caps; VIP $2.99/month or $17.99/year | Photo batch on VIP only; video one at a time | "Impressive with one click" (a poster in grey/green water). Colourists in the same thread: output is over-red, "muddy", "underwater isn't yellow like that". ScubaBoard: 4K downscaled, banding in open-water gradients, hangs on clips over 30 to 40 s | Mobile only. Applies its own recipe per clip, so it will not hold colour constant across a flip |
| AquaColorFix (iOS/Android) | Free with watermark; Pro £3.99/month, £14.99/year, £34.99 lifetime | No | AquaExposure's July 2026 test: good first pass, but applies a uniform recipe and overcompensates in murky water | No flicker handling |
| DiverOut (iOS) | Free daily quota with watermark; Mobile Plus subscription | 30 photos per batch; video on Plus | Marketed as "depth-aware AI"; no method, no benchmark, no independent test found | Treat as marketing until tested |
| DeepColors (iOS/Mac) | Free with watermark; $5.99/month, $14.99/year | Not stated | New. Offers keyframed grades and .cube LUT export | Keyframing could in principle track the flip |
| dive-color-corrector (open source, GPL-3.0) | Free; CLI and GUI | CLI is scriptable | Hue-shifts red until mean red is at least 60, histogram thresholds, one colour matrix. Video: samples the matrix every 2 s and linearly interpolates, so the correction itself does not flicker. 12 open issues, no maintainer replies | Blue-water assumption (red-only compensation). Its 2 s sampling cannot cancel an AWB flip faster than 2 s |
| ffmpeg | Free | Yes (shell loop) | colorchannelmixer, colorbalance, curves, colortemperature; lut3d/haldclut to apply a .cube made in Resolve; normalize has temporal smoothing | `normalize=independence=1:smoothing=N` is the only stock filter that re-balances channels per frame with a temporal window |
| Python/OpenCV | Free | Yes | Ancuti 2018 colour balance and fusion, grey-world (cv2.xphoto), Sea-thru (needs depth maps, impractical here). WB_sRGB's authors warn frame-by-frame WB flickers | Building blocks; no turnkey dive-video script found |
| Matthias Lebo GoPro Green Water LUT pack | 29 euros (7 LUTs, "Deep" variants for below 15 m) | Yes, once loaded | Built on GoPro Hero 10 footage by a working underwater cinematographer; the 2023 Circle H Scuba comparison rated it between Dive+ and manual grading | A LUT is static and camera-specific; it will not map cleanly onto IMX708/libcamera colour and cannot fix a flip |
| GoPro Quik / Insta360 AquaVision | Free basic / in-app | No | Generic filters; not applicable to Pi footage | |
| Flicker Free 3 (Digital Anarchy), DE:Flicker (RE:Vision) | $159 to $199 / not verified; OFX incl. Resolve | Per clip | Brightness flicker (timelapse, LED, slow-mo); temporal frame blending; ghosting on motion | No evidence they address colour flips |

## Green water: what UK and cold-water people do, and why

The physics, briefly: coastal water transmits best around 550 nm because CDOM and phytoplankton
absorb blue; red is absorbed first regardless of water type. So at 15 m the ambient light is
green-dominant and blue-depleted. Ancuti et al. 2018 state that in turbid or plankton-rich water
green is the least attenuated channel, so both red and blue are compensated from green before
white balancing. A red filter or blue-water LUT assumes blue survives and will push green water
towards magenta/purple.

Physical filters, for the reasoning only: magenta for green water, red for blue water is universal
advice (ScubaBoard, Ikelite, uwphotographyguide, Divevolk). Keldan sells a measured-spectrum
green-water filter. The UK company Alphamarine advises against buying filters at all and relying
on custom white balance or raw. The Wetpixel Keldan test found the filter "less exciting and
darker" in blue-green water and the reviewer removed it in favour of manual WB.

The post recipe practitioners converge on (Resolve free, one node each):

1. Scopes first. On green-water footage the RGB parade shows green highest, blue mid, red near zero.
2. WB node: white-balance picker on something known-neutral (rock, sand, mooring, any grey
   hardware in frame). AquaExposure calls this "60% of the problem". Then push tint towards
   magenta, not just temperature.
3. RGB mixer node, the key move for green water: feed green (and a little blue) into the red
   output rather than gaining a flat red channel. Ikelite: bump green in the red output "a few
   clicks, not a lot". r/davinciresolve: "Balancing using standard tools isn't very effective,
   because you're adding a lot of gain to a channel (red) that has no discernible detail"; the
   mixer is cleaner. Same poster: "we unconsciously expect an underwater image to be blue, so when
   you go too far, it looks unnatural"; the Dive+ output in that thread had "too much red, making
   it look muddy".
4. Primaries node: lift down until blacks touch the zero line, gain up, gamma to taste, contrast
   around 1.15.
5. Curves node: a 10 to 15% lift in the middle of the red curve plus a 5 to 10% cut in the
   dominant cast channel's shadows, checked against the parade.
6. Saturation: modest; check on a still.
7. Optional Hue vs Hue or Color Warper: pick the water colour, feather, rotate the cyan-green a
   little towards blue-green. Rule for 8-bit underwater footage: too many granular moves "break
   up" the image; one gentle offset plus one hue move.
8. Noise: spatial NR 40 to 60% in the free version, then slight sharpen.
9. Accept distance dependence. The red cut varies with subject distance, so one grade cannot be
   faithful for a close fish and a far background at once. Leave the water green-blue; neutralise
   the subject.

Is there a measured ratio? No. Every practitioner number is a relative move on their own footage.
The nearest published quantification is the RUIE/UCCS benchmark: green-cast inputs average about
a* = -31, b* = +12 in CIELab, and the simple model-free methods bring both near zero (Fusion
-1.21/1.42, CLAHE -1.68/1.46, MSRCR 2.58/0.31). A defensible technical target: pick a neutral
reference visible in a subset of clips (mooring line, housing part), set R=G=B on it in the
parade, then back off deliberately so the water keeps some colour.

## The flicker: recipes

What the camera did: libcamera's AWB re-evaluates every `frame_period` (10) frames and moves the
applied gains with an IIR of `speed` 0.05 per frame, so a flip between two solutions is a ramp of
roughly 20 frames, then a hold, then another ramp.

- Recipe A, Resolve Studio ($295): Effects, Resolve FX Color, Color Stabilizer. Pick a target frame
  in the state you prefer, enable White Balance stabilisation; fall back to Light-only plus recipe
  B on the colour if colour jumps get worse.
- Recipe B, Resolve free: split at the flips and group ("green state" and "blue state"), one grade
  per group; or keyframe temperature/tint across the ramps with as few keyframes as possible.
  Kdenlive has the same keyframeable white balance effect.
- Recipe C, After Effects Color Stabilizer, Levels or Curves mode, sample points on the most
  static regions available. Per clip; no batch.
- Recipe D, open-source pre-normalisation before grading: ffmpeg
  `-vf "normalize=independence=1:smoothing=5:strength=0.7"` (a per-channel histogram stretch with
  a rolling window; keep the window shorter than the ramp, strength below 1); or an OpenCV script
  computing per-frame channel means, deriving red and blue gains against a reference frame,
  smoothing the gain series (Savitzky-Golay over about 9 frames or an EMA), and applying per
  frame. Use it only for stabilisation; grey-world on a green scene without neutrals biases
  towards magenta, so the actual cast correction should still be done once, globally.
- Recipe E, deflicker plugins: luminance tools. Skip.

## Source side, for future recordings

Lock the gains: let AWB converge on a grey reference at depth, read `ColourGains` from
`capture_metadata()`, then `set_controls({"ColourGains": (r, b)})` after `configure()` (setting
them disables AWB per the picamera2 manual). If AWB must stay on, copy `imx708.json` and in
`rpi.awb` lower `speed` so it drifts instead of flipping, or set `bayes: 0` for plain grey-world
(what `imx708_noir.json` ships with), which is stable but biased on green scenes. The shipped
`ct_curve` runs 2498 K to 7433 K with the `auto` mode searching 2500 to 8000 K and only about 0.03
transverse allowance off the Planckian curve; a green-water illuminant sits well off that curve,
which is a plausible (inferred) reason the Bayesian search finds two competing solutions. The
proper fix is a custom tuning: Macbeth chart captures at depth through the Camera Tuning Tool to
extend the curve, or at least widen `transverse_neg` and bias the `priors`; `sensitivity_r/b` and
`whitepoint_r/b` are the coarse knobs.

## Published comparisons of faithfulness (not prettiness)

- RUIE/UCCS (Liu et al., IEEE TCSVT 2020): on the green set MSRCR, CLAHE, Fusion (Ancuti 2012),
  DPATN and DCP with colour balance corrected the cast; the BP physics prior "tends to failure on
  greenish pictures". Model-free methods suit green-dominant images.
- Sensors 2021 systematic review (Raveendran et al.): chart-based angular error is the
  faithfulness metric (Sea-thru 6.33 degrees vs raw 20.57); fusion methods acceptable only in
  shallow water, grey-world variants turn scenes grey when red is absent, natural-light methods
  "become obsolete" below about 20 m.
- SQUID (Berman et al., TPAMI 2020): 57 stereo pairs with colour charts at 3 to 30 m; the standard
  quantitative testbed since.
- Hu et al. 2025 (University of Reading, JMSE): frame-by-frame enhancement flickers; their
  optical-flow network improves temporal consistency about 30%. Research code, not turnkey.
- Practitioner same-footage tests: Circle H Scuba (2023) ran Dive+, the Lebo LUT and manual scopes
  on one clip: Dive+ fastest, manual best. AquaExposure (July 2026) tested AquaColorFix v2,
  DiverOut and Topaz: manual "keeps the edge" on consistency and faithfulness. r/davinciresolve
  (Jan 2025, TG7, 18 m, grey/green water): two colourists judged the Dive+ result unnatural.
  Wetpixel's Keldan test: filter beaten by manual WB in green-blue water.
- UK-specific: nothing. The NMBAQC epibiota imagery guidelines and the NatureScot community
  monitoring handbook contain no white-balance or colour-correction guidance.

## The last 30 days

Recent community evidence is thin. The one live discussion is an r/scuba thread from mid-August
2026 (39 comments): consensus is lights, get closer, edit in Resolve, and lock white balance (one
GoPro Labs user in green Atlantic water locks WB one second after record start and shoots flat
plus wide gamut into a LUT). Two new Resolve tutorials appeared (Runhaar, 12 Aug 2026; a short on
green footage, May 2026). Nothing new on flicker.

## Sources

Practitioner workflows and forums: aquaexposure.com (Resolve for underwater video; AI dive-app
comparison); old.reddit.com/r/davinciresolve/comments/1hwkkdv (underwater grading thread);
old.reddit.com/r/scuba/comments/1vnplb6; forum.blackmagicdesign.com threads 89310, 68723, 185447;
creativecow.net underwater colour grade thread; scubaboard.com threads 607344, 554064, 638671,
549906 (search summaries); community.adobe.com threads on fluctuating white balance and 8-bit vs
32-bit Lumetri; housingcamera.com Premiere colour correction; ikelite.com colour grading posts;
discuss.bluerobotics.com threads 15375 and 19210; mavicpilots.com thread 156514; gamut.io on
temperature and tint in Resolve.

YouTube tutorials (captions): Coolhand99au 2018 (green fish-cam footage); Maxime Cheminade 2020;
Ryu 2022; Circle H Scuba 2023 (Dive+ vs LUT vs manual); Prana Dive 2024; Waqas Qazi 2024; Runhaar
Aug 2026; Diving Inspiration 2020; Albeart May 2026.

Stabilisers, deflicker, Studio gating: Packt Resolve manual (Color Stabilizer, Studio only);
jasonyadlovski.com Resolve 19 tip; mixinglight.com Resolve 14 colour stabilizer; vizedits.com and
artgrid.io free-vs-Studio; helpx.adobe.com After Effects colour correction effects;
provideocoalition.com Color Stabilizer; digitalanarchy.com Flicker Free; revisionfx.com DE:Flicker;
discuss.pixls.us timelapse WB flicker script.

Open-source code and ffmpeg: github.com/bornfree/dive-color-corrector; github.com/nikolajbech/underwater-image-color-correction;
github.com/mahmoudnafifi/WB_sRGB; github.com/CXH-Research/Underwater-Image-Enhancement;
opencv.org/underwater-image-enhancement-using-opencv/; ayosec.github.io ffmpeg normalize filter docs;
gabor.heja.hu ffmpeg LUT post; geekybob.com fixing underwater videos with ffmpeg.

Apps and LUTs: Dive+ and AquaColorFix App Store listings; aquacolorfix.com; diverout.com; deepcolors.app;
insta360.com underwater tips; courses.matthiaslebo.com green water LUT pack.

Filters and water optics: alphamarinephoto.com on filters; uwphotographyguide.com; reefphoto.com and
wetpixel.com Keldan filter reviews; keldanlights.com; facetsjournal.com/doi/10.1139/facets-2017-0074;
aslopubs.onlinelibrary.wiley.com/doi/10.1002/lno.12606; divevolkdiving.com colour correction guide.

Science and benchmarks: ar5iv.labs.arxiv.org/html/1901.05320 (RUIE/UCCS); pmc.ncbi.nlm.nih.gov/articles/PMC8433714/
(Sensors 2021 review); journals.plos.org/plosone/article?id=10.1371/journal.pone.0317306;
arxiv.org/abs/1811.01343 and zenodo.org/records/5744037 (SQUID); Ancuti 2018 (doi 10.1109/TIP.2017.2759252);
Bryson 2016 (doi 10.1002/rob.21638); mdpi.com/2077-1312/13/1/127 (Hu et al. 2025); arxiv.org/abs/2512.05492 (WaterWave);
sciencedirect.com S0893608025010500 (UVENet); arxiv.org/html/2603.16363; arxiv.org/abs/1904.06437.

Raspberry Pi and libcamera: Camera Algorithm and Tuning Guide (pip-assets.raspberrypi.com);
picamera2 manual (datasheets.raspberrypi.com); libcamera imx708.json and imx708_noir.json;
forums.raspberrypi.com threads 365052, 346542, 338313; github.com/raspberrypi/picamera2/discussions/592.

UK guidance checked (no colour-correction content): NMBAQC epibiota operational guidelines;
NatureScot community-led marine biodiversity monitoring handbook chapter 4.
