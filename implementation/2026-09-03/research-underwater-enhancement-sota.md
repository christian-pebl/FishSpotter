# Underwater colour-cast correction for PEBL's 15 m Camera Module 3 clips: state of the art, 2023 to 2026

Research brief, 3 September 2026 (agent pass, web sources listed at the end). Context: footage
shot at about 15 m on a Raspberry Pi Camera Module 3 (Sony IMX708), H.264, no raw; libcamera's
Bayesian AWB flips between a green and a blue solution; about 170 clips of 7 to 15 s; used in a
citizen-science species-ID app, so enhancement must not hallucinate features.

## Bottom line

1. For 7 to 15 s clips from a fixed camera, the highest-value fix is not a neural network. It is a
   single white-balance gain per clip (computed once from the whole clip, so it cannot flicker by
   construction), followed by a conservative training-free contrast step (Ancuti 2018 fusion or
   MLLE). All CPU, all permissively licensed, zero hallucination risk. The AWB flicker is a
   mode-flip in libcamera's Bayesian solver, and the per-clip gain removes it outright.
2. If a learned model is wanted, the evidence points at WaterNet (the only method that improved
   real-video feature matching in a 2025 study; MIT re-implementation with auto-downloading
   weights) or FA+Net (9K parameters, real-time 1080p). Both are per-frame, so run a post-hoc
   deflicker or fix the colour gains upstream. UVE-Net is the only video-native model with weights
   and an MIT licence, but it needs a GPU and its "ground truth" is the output of two other
   enhancers.
3. Diffusion models are the wrong tool here. CLIP-UIE needs 2000 sampling steps at 256x256; CPDM's
   authors say "real-time sampling cannot be achieved at present"; and the whole family is
   generative, which is exactly what a species-ID app must avoid. Cost is 100x to 10,000x a CNN.
4. Green water is the under-served case. The only per-cast evidence (RUIE, UIEB) says model-free
   methods (MSRCR, CLAHE, Fusion) do better on greenish images and dark-channel-type priors do
   better on bluish ones. No deep model publishes a green/blue split.

## Ranked shortlist

Scores are PSNR/SSIM unless stated. Where two numbers exist the independent re-run in the 2024
survey (arXiv 2405.19684, Table II, all methods retrained under one protocol) is preferred over
authors' own figures. "Runtime" is per 1080p frame; entries marked (est.) are extrapolations.

| # | Method (year, venue) | Code and licence | Weights | Hardware | Benchmark scores | Known failure modes | Runtime, 1080p |
|---|---|---|---|---|---|---|---|
| 1 | Per-clip global WB (grey-world / shades-of-grey gains) + Ancuti 2018 fusion (TIP) or MLLE (TIP 2022) | nomi30701 repo: Python, MIT, implements MLLE and fusion, handles video. MMLE_code: MATLAB, MIT. fergaletto / bilityniu: MATLAB, no licence | n/a (training-free) | CPU | RUIE: "DCP, CLAHE and Fusion are the most competitive in terms of color correction"; Fusion and CLAHE handle greenish better than bluish. UIEB: Fusion "introduce[s] reddish color deviation" on some casts | Red over-compensation where red is truly gone (the 15 m case), sharpening halos, per-frame flicker unless gains are fixed per clip | 0.3 to 1 s CPU (est.); gains alone are milliseconds |
| 2 | WaterNet (TIP 2020) | tnwei/waternet: MIT, PyTorch, auto-downloads weights, takes mp4 input | Yes | CPU-capable (small FCN); GPU faster | Survey re-run: UIEB 21.04/0.8601, LSUI 22.74/0.8560. Sensors 2025 real-video study: "the only method that reliably facilitated better frame-matching results, although only marginally" | Conservative; weak cast removal on hard images; per-frame | about 0.5 to 1 s CPU, 0.03 s GPU (est.) |
| 3 | FA+Net / FiveA+ (BMVC 2023) | Owen718/FiveAPlus-Network: no licence file (ask authors) | Yes, in repo | GPU ("real-time 1080P on RTX 3090"); 9K params so CPU is plausible | Authors claim SOTA on UIEB etc.; not independently reproduced in the sources read | Per-frame; very small capacity so limited contrast recovery | about 0.01 s on RTX 3090 (paper) |
| 4 | UVE-Net (CVPR 2024, UVEB) | yzbouc/UVEB: MIT | Yes (`large_net_g.pth`) | GPU, 11 GB VRAM for 4K; UVE-Net-s 5.6 GB | UVEB: 26.27 dB vs 24.21 for PUIE-Net (best per-frame); trained on 1,308 video pairs, 38% 4K | Ground truth is FspiralGAN/PUIE output, so it learns their look; aquarium/diving footage; not tested on green coastal water | 0.675 s per 4K frame; 25 FPS at 2K; UVE-Net-s 0.091 s |
| 5 | UIEAnything (Pattern Analysis and Applications 2025): AWB + Depth Anything V2 + improved Sea-thru, zero-shot | Jinxinshao/UIEAnything: Python, no licence. Depth Anything V2 Small is Apache-2.0; Base/Large/Giant are CC-BY-NC-4.0 | Depth checkpoint downloaded separately | GPU used in paper (A100, 4090); Small depth model runs on CPU slowly | Authors: "average improvements of 15.3% in PSNR and 12.8% in SSIM" over SOTA on 7 benchmarks (self-reported, single source) | Monocular depth is unstable frame to frame; Sea-thru assumes linear input and real range; underlying repo unlicensed | Not published |
| 6 | UnDIVE (WACV 2025) video, diffusion-prior encoder + physics net + optical-flow temporal loss | suhas-srinath/undive: no licence | Yes (Google Drive, 3 checkpoints) | GPU | Trained UIEB + UVE-38k; evaluated on real videos (VDD-C, Brackish, UOT32, MVK) with VQA metrics only | Authors: quality metrics "correlate poorly with human perception, making quantitative results somewhat misleading"; no commercial licence | 0.21 s per 512x512 frame, 6.7M params (paper); about 1.7 s at 1080p (est.) |
| 7 | Semi-UIR (CVPR 2023) | Huang-ShiRui/Semi-UIR: no licence | `pretrained` folder | GPU (PyTorch 1.8, CUDA 11.1) | Survey re-run: UIEB 22.79/0.9088, LSUI 25.44/0.8801; UCCS UIQM/UCIQE 3.079/0.554; 1.65M params | Needs an illumination-map pre-step; per-frame; last commit Jul 2023 | Not published |
| 8 | WaterMamba (2024, arXiv) | Guan-MS/WaterMamba: no licence; README says full framework code released "if this paper is accepted" | Yes (Google Drive) | GPU only (mamba_ssm, causal_conv1d CUDA kernels) | UIEB 24.715/0.931 (authors); UCCS 2.835/0.582; 3.69M params | Incomplete code; CUDA-only build pain; per-frame. PixMamba (ACCV 2024): no weights, no licence. O-Mamba: placeholder repo, no code | Not published |
| 9 | SLURPP single-step latent diffusion (2025) | kongdai123/SLURPP: Apache-2.0 | Yes (Hugging Face) | GPU (Stable Diffusion + Marigold backbone) | "over 200x faster than existing diffusion-based approaches", "about 3 dB" on synthetic; video results on MVK but no temporal mechanism | Generative backbone can invent texture; SD-scale VRAM; per-frame | about 1 to 2 s (est.) |
| 10 | CLIP-UIE (Pattern Recognition 2025), reference diffusion method | OUCVisionGroup/CLIP-UIE: no licence | Yes (Google Drive) | GPU, RTX 3090 in paper | T200 25.412/0.936; UIQM 0.981, UCIQE 0.619 | T = 2000 steps at 256x256; one colour-checker result "even worse than the input"; classifier "ignores the color restoration of local color blocks" | Minutes per frame (est.) |

Not shortlisted, with the reason: HCLR-Net (IJCV 2024; survey re-run UIEB 22.09/0.8976, LSUI
27.94/0.9169; weights on Baidu Pan only, no licence). NU2Net / URanker (AAAI 2023; T90
23.061/0.923; CC-BY-NC-4.0, non-commercial only). U-shape Transformer (MIT, but "all images were
adjusted to a fixed size (256*256) when input to the network", so 1080p must be tiled or
upsampled; survey UIEB 20.39/0.8034). FUnIE-GAN (MIT, 148 FPS on GTX 1080 at 256x256, but
repeatedly reported to over-saturate). Ucolor (MIT, TF 1.6, needs GDCP transmission maps, 157M
params). PUIE-Net (ECCV 2022, no licence, 1.41M params). Shallow-UWnet (MIT, AAAI 2021 student
abstract, no scores in repo). PhISH-Net (WACV 2024, MIT, needs boosted MiDaS/LeReS depth; is the
flickering example in UnDIVE's Fig. 1). WaterWave (Dec 2025, Apache-2.0) and PINE (2025, MIT) are
video methods but both are per-video optimisation with no runtime published; the JMSE 2025
dual-branch flow method (Hu et al.) claims a 30% consistency gain but no code was found.
SeaThru-NeRF (CVPR 2023, JAX) needs multi-view static scenes, so moving fish rule it out.
Sea-thru itself "works on RAW images or videos taken under natural light" plus a range map from
SfM or stereo; H.264 sRGB frames violate the linear-input assumption, and the MIT Python port
(hainh/sea-thru, monodepth2 depth) "fails to produce accurate results" in scenes with minimal
depth variation, which describes a fixed camera looking into open water.

## Supporting tools (temporal stability)

| Tool | What it does | Licence | Notes |
|---|---|---|---|
| bornfree/dive-color-corrector | Samples a frame every `SAMPLE_SECONDS = 2`, computes a colour filter matrix per sample, linearly interpolates matrices between samples, applies per frame | GPL-3.0, Python, mp4 in/out | The exact "estimate sparsely then smooth" trick, ready to run. Caveat: it hue-shifts until `MIN_AVG_RED = 60`, i.e. it invents red |
| All-In-One Deflicker (CVPR 2023) | Blind deflicker for any per-frame-processed video via a neural atlas | Apache-2.0 | about 3 GB GPU; split clips over 200 frames; explicitly lists "image enhancement" flicker as a target |
| Deep Video Prior (NeurIPS 2020) | Per-video training to make an image algorithm's output temporally consistent | No licence | Older, slower; superseded by the above |
| CTANet / CTA dataset (ACM MM 2024) | Temporal AWB model with cross-frame attention; 6 cameras, 12K illuminations | No licence, partial weights | Terrestrial phones, not underwater; useful as the current TAWB baseline |

## Which methods do surveys and practitioners treat as the robust default for real footage?

No 2024 to 2026 survey names a single winner, and two of them warn that benchmark numbers mislead.

- The 2024 deep-learning survey (Zhao et al., arXiv 2405.19684) retrains everything under one
  protocol and finds UIE-DM and HCLR-Net top on full-reference sets, but notes UIEB references
  are "produced by the voting method" of older algorithms, so a model "cannot surpass the voting
  algorithms' collective performance", and calls metric reliability "problematic". It excludes
  video entirely.
- The 2025/26 systematic review of image and video methods (Thanjaivadivel and Thangaraj,
  Discover Imaging) says deep methods "generally outperform traditional methods" on quality
  metrics, recommends "hybrid approaches that combined deep learning and physical models", and
  states deep models "fail to handle the problems that span more than one frame, including
  inter-frame consistency", with "artifacts reduction methods ... necessary to reduce flickering".
- The one 2025 study that tests on real video for a downstream task (Sensors 25(22):6966, feature
  matching and SLAM on a cave dive and an ROV wind-turbine inspection) found WaterNet was "the
  only method that reliably facilitated better frame-matching results, although only marginally",
  the unenhanced video came second, and "all enhanced videos resulted in significant tracking
  loss". That is a warning that enhancement is not free.
- The two real-world benchmark papers with per-method colour verdicts are older but still the ones
  everyone cites. RUIE (Liu et al., 2019): "no one single UIE algorithm can work the best for all
  tasks"; "DCP, CLAHE and Fusion are the most competitive in terms of color correction". UIEB (Li
  et al., TIP 2020): "it is almost impossible for a color correction algorithm or a kind of prior
  effective for all types of underwater images"; Retinex-based "removes the color deviation well"
  while Fusion, histogram-prior and regression methods "introduce reddish color deviation".

So the defensible defaults are: Ancuti fusion or MLLE for training-free work (they are the only
two classical methods carried in the ddz16 UIE benchmark repo, which is a fair proxy for what
practitioners still run), WaterNet for a learned but conservative model, and a
physics-plus-foundation-depth pipeline (UIEAnything) as the promising but single-source newcomer.

## Green-cast versus blue-cast behaviour

Direct evidence exists only for classical methods, from RUIE's UCCS subset (100 bluish, 100
greenish, 100 blue-green images, all real):

- "MSRCR can correct both greenish and bluish tones well" but "tends to push Avga and Avgb to
  positive values so that the results appear to be visually reddish".
- "As for CLAHE and Fusion, the ability to handle greenish tones is superior than that to blue tones."
- "BP ... tends to failure on greenish pictures"; "the model-based BP algorithm performs poor on
  greenish images."
- Dark-channel derivatives "DCPcb, BCCRcb and DPATN show more satisfactory performance on blueish
  images, while the model-free methods are more suitable for processing images with more green
  components."

UIEB adds that UDCP and GDCP "aggravate the effect of color casts" on its greenish/bluish
examples. Modern deep models report one aggregate UCCS score that blends the three casts, so there
is no published green/blue split for any 2023 to 2026 model. UIEAnything's own related-work
section flags the specific hazard: AWB methods fail "in deep-water scenarios where the red channel
information is severely attenuated". Practical consequence for 15 m green UK water: any step that
pushes red back in (Ancuti's red compensation, the dive-corrector's hue shift to a red mean of 60,
or a GAN trained on tropical reefs) is inventing a channel the sensor never recorded. Cap red
gain, or correct only the green/blue ratio and leave red near zero.

## The accepted cheap trick for temporal stability

1. One global gain per clip. Compute grey-world or shades-of-grey gains from the clip mean (or its
   median frame) and apply the same 3x3 matrix to every frame. Flicker is impossible. Note that
   FFmpeg's `grayworld` filter is per-frame with no temporal option, so it re-creates flicker;
   compute gains once and apply them with `colorchannelmixer` instead.
2. Sparse estimate plus interpolation. dive-color-corrector does exactly this (every 2 s, linear
   interpolation of the filter matrix).
3. Recursive smoothing of the per-frame estimate. FFCC (Barron and Tsai, CVPR 2017, Google Pixel)
   formalises it as a Kalman-like update of the illuminant posterior with a single parameter for
   "the expected variance of the illuminant over time". libcamera's own `rpi.awb` already
   IIR-filters gains with `speed` (default 0.05), which is why the flicker is a mode flip in the
   Bayesian solver rather than a damping problem. Buzzelli et al. (CCIW 2024) use per-frame
   estimation, then "video stabilization to ensure temporal consistency, and consensus-based
   illuminant correction". CTANet (ACM MM 2024) is the learned version.
4. Post-hoc deflicker for any per-frame neural enhancer. All-In-One Deflicker (Apache-2.0) or
   Deep Video Prior. UVEB's authors observed that classical per-frame methods "fluctuate sharply,
   such as MSCNN and GDCP" while "most deep learning methods will not encounter this problem".

Capture-side note for future deployments: the IMX708 tuning file ships with `"bayes": 1` plus a
CT curve and priors that have no valid solution at 15 m; `rpicam-vid --awbgains r,b` locks the
gains, and a tuning copy with `bayes` set to 0 falls back to grey-world, which is monotone rather
than bimodal.

## Cost to process 170 clips at 1080p

Frame count: 170 x 10 s x 30 fps = 51,000 frames. Prices read 3 September 2026: Modal T4 $0.59/h,
L4 $0.80/h, A10 $1.10/h, A100 40 GB $2.10/h, H100 $3.95/h, with $30/month free credit on Starter.
RunPod RTX 4090 $0.34/h community, $0.74/h secure; H100 SXM $2.69/$3.29/h. Lambda A10 $1.29/h,
A100 40 GB $1.99/h, H100 SXM $4.29/h.

| Pipeline | s per 1080p frame | GPU-hours | Modal A10G | RunPod 4090 (community) | Lambda A10 |
|---|---|---|---|---|---|
| Per-clip WB + Ancuti fusion or MLLE, CPU | 0.3 to 1.0 (est.) | 4 to 14 CPU-h | $0, runs overnight locally | | |
| Light CNN, per-frame (FA+Net, WaterNet) | 0.02 to 0.05 | 0.3 to 0.7 | under $1 (inside free credit) | under $0.25 | under $1 |
| Video CNN (UVE-Net at 2K-class res) | 0.05 to 0.1 | 0.7 to 1.4 | $1 to $2 | $0.25 to $0.50 | $1 to $2 |
| UnDIVE at 1080p | about 1.7 (est.) | about 24 | about $26 | about $8 | about $31 |
| Single-step latent diffusion (SLURPP) | 1 to 2 (est.) | 14 to 28 | $15 to $31 | $5 to $10 | $18 to $36 |
| DDIM 25-step diffusion on 256x256 tiles | 20 to 25 (est.) | 300 to 350 | $330 to $390 | $100 to $120 | $390 to $450 |
| DDPM 1000 to 2000 steps on 256x256 tiles (CLIP-UIE, CPDM class) | 800 to 1,600 (est.) | 11,000 to 23,000 | $12k to $25k | $4k to $8k | $14k to $30k |

## Recommended pipeline, in order of effort

1. Per-clip global gains (shades-of-grey on the clip mean, red gain capped). Fixes the flicker and
   the uniform casts in one CPU pass. Keep the original bytes; `sync.ts` already cache-busts on
   changed clip bytes.
2. Add MLLE or Ancuti fusion for contrast, with sharpening weight turned down, and check a handful
   of goby/wrasse clips for red halos and invented spots before batch-running.
3. Only if 1 and 2 are judged insufficient: WaterNet or FA+Net on Modal (under $5 total), followed
   by All-In-One Deflicker, and compare against step 2 on the same clips with a blind
   side-by-side rather than UIQM/UCIQE, which every survey above distrusts.

## Sources

Surveys, benchmarks and evidence: arxiv.org/html/2405.19684 (2024 DL-UIE survey);
link.springer.com/article/10.1007/s44352-025-00023-0 (Discover Imaging review);
pmc.ncbi.nlm.nih.gov/articles/PMC12656054/ (Sensors 2025 real-video study);
arxiv.org/pdf/1901.05320 (RUIE); ar5iv.labs.arxiv.org/html/1901.05495 (UIEB);
arxiv.org/html/2404.14542v2 and github.com/yzbouc/UVEB (UVE-Net); arxiv.org/html/2411.05886 and
github.com/suhas-srinath/undive (UnDIVE); arxiv.org/html/2512.05492 (WaterWave);
github.com/Jinxinshao/PINE; arxiv.org/abs/2603.16363; arxiv.org/abs/2601.22878 (DIVER 2026);
github.com/ddz16/UIE_Benckmark.

Classical / physics: github.com/nomi30701 (MLLE + fusion Python port, MIT);
github.com/Li-Chongyi/MMLE_code; github.com/hainh/sea-thru; github.com/Teragion/Sea-Thru-Impl;
github.com/deborahLevy130/seathru_NeRF; deryaakkaynak.com/sea-thru; github.com/Jinxinshao/UIEAnything;
github.com/DepthAnything/Depth-Anything-V2; github.com/chandrasekaraditya/PhISH-Net.

Learned image models: github.com/tnwei/waternet; github.com/xahidbuffon/FUnIE-GAN;
github.com/Owen718/FiveAPlus-Network and arxiv.org/abs/2305.08824; github.com/Huang-ShiRui/Semi-UIR;
github.com/LintaoPeng/U-shape_Transformer_for_Underwater_Image_Enhancement;
github.com/Guan-MS/WaterMamba; github.com/weitunglin/pixmamba; github.com/chenydong/O-Mamba;
github.com/zhoujingchun03/HCLR-Net; github.com/RQ-Wu/UnderwaterRanker; github.com/zhenqifu/PUIE-Net;
github.com/Li-Chongyi/Ucolor; github.com/mkartik/Shallow-UWnet.

Diffusion: github.com/OUCVisionGroup/CLIP-UIE and arxiv.org/html/2405.16214;
github.com/kongdai123/SLURPP; github.com/Guan-MS/DiffWater; pmc.ncbi.nlm.nih.gov/articles/PMC11682325/
(CPDM); arxiv.org/abs/2409.18476 (UW-DiffPhys); arxiv.org/abs/2309.03445.

Temporal stability and AWB: arxiv.org/pdf/1611.07596 (FFCC); doi.org/10.1145/3664647.3681410 and
github.com/ChunxiaoLe/CTA-Dataset; Buzzelli et al., CCIW 2024; github.com/ChenyangLEI/All-In-One-Deflicker;
github.com/ChenyangLEI/deep-video-prior; github.com/bornfree/dive-color-corrector;
github.com/raspberrypi/libcamera (src/ipa/rpi/controller/rpi/awb.cpp, vc4/data/imx708.json);
raspberrypi.com/documentation/computers/camera_software.html.

Pricing: modal.com/pricing; runpod.io/pricing; lambda.ai/pricing.
