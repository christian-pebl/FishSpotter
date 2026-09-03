# Sharpening and super-resolution for PEBL's underwater clips: feasibility and cost brief

Research brief, 3 September 2026 (agent pass). Prices and facts were read on 3 September 2026
unless a date is given. Workload assumed throughout is 170 clips x 10 s x 30 fps = 51,000 frames
at 1920x1080.

## Bottom line

1. For 1080p footage that is soft because of water, not because of pixel count, super-resolution
   is the wrong tool. Every learned SR model measured in the literature invents detail to some
   degree, and the app serves clips at 1080p or below, so a 2x or 4x output has no delivery use.
   What the footage lacks is contrast at high spatial frequencies, and that is recoverable with
   denoise plus adaptive sharpening plus local contrast, all of which run free on the existing
   CPU box and cannot invent structure.
2. If a learned model is trialled at all, use a regression-trained multi-frame model (BasicVSR++
   deblur/denoise variants, Apache 2.0) at native resolution. It scored least hallucination among
   learned methods in the only hallucination-specific study found, and the whole run fits inside
   Modal's $30 monthly free credit.
3. Diffusion VSR (SeedVR2, FlashVSR, DOVE, STAR, Upscale-A-Video, Starlight) is fast and cheap
   enough now (roughly $10 to $65 for all clips on SeedVR2-3B or FlashVSR) but the authors
   themselves warn of over-generated detail, community tests report plastic textures, and there
   is no independent benchmark of these models on real camera footage. For a species-ID product
   they are disqualified unless a human vets every clip against the original.
4. Cheapest commercial route with a track record on live action is Topaz Proteus in manual mode,
   about $17 to $43 in cloud credits for all clips plus a plan, or a watermarked free trial for
   evaluation. Topaz's own staff say the software cannot fix out-of-focus footage, only sharpen
   it, which is the honest framing for this footage too.
5. Adobe is buying Topaz (announced 25 June 2026, pending), so Topaz pricing should be treated as
   unstable for 2027.

## Ranked shortlist (faithfulness first, cost second)

| # | Tool | Type | Cost for all 170 clips | Hallucination risk | Verdict |
|---|---|---|---|---|---|
| 1 | ffmpeg baseline (hqdn3d or nlmeans, cas or unsharp, optional CLAHE via OpenCV) | Linear/adaptive filters | 0, CPU box | None by construction (halo/ringing risk only) | Do this first, it is probably all that is needed |
| 2 | BasicVSR++ deblur or denoise variants (mmagic, Apache 2.0) | Regression CNN, multi-frame, native resolution | $0 to $15 on Modal (inside free credit) | Low: L1-trained, no GAN; degradation mismatch risk | Worth a 5-clip pilot |
| 3 | Topaz Video, Proteus manual mode | Commercial CNN family | $299/yr Personal plan; cloud render about 170 credits, $17 to $43 | Moderate; Iris and Starlight higher | Cheapest tested commercial option; check licence tier for a CIC |
| 4 | DaVinci Resolve Studio (Super Scale, Dehaze, NR) | Commercial NLE, non-generative upscaler | £239.99 to £245 one-off (UK) / $295 | Low to moderate | Only if a GPU machine is available; colour tools are a bonus |
| 5 | TensorPix / Pixop (per-minute online) | Cloud, undisclosed models | about $15 to $40 | Unknown until tested | Cheap enough to test on 3 clips, do not adopt blind |
| 6 | Real-ESRGAN x2plus (BSD-3) | Per-frame GAN image SR | $1 to $5 | Moderate to high (HS 2.78 to 3.27), flickers on video | Not recommended |
| 7 | FlashVSR v1.1 (Apache 2.0) | One-step diffusion VSR, 4x | $10 to $30 on A100 | High | Not for the app |
| 8 | SeedVR2-3B (Apache 2.0) | One-step diffusion restoration, any resolution | $30 to $65 (A100/H100), $5 to $10 on a rented 4090 with tiling | High | Not for the app; the strongest generative option if a stylised marketing cut is ever wanted |

Not shortlisted and why: STAR, Upscale-A-Video and MGLD-VSR are 100x slower than FlashVSR
(roughly 200+ GPU-hours here) and Upscale-A-Video is under NTU S-Lab License 1.0
(non-commercial). VEnhancer needs an A100 80G, is aimed at AI-generated video and its authors
describe v1 as "very creative". VRT and RVRT are CC-BY-NC. DiffVSR needs 50 steps and a caption
CSV per video.

## Open-source models in detail

Runtime figures are as published by the authors or by a competing paper, not independent.

| Model (year, venue) | What it does | VRAM | Speed as measured | Licence | Hallucination risk and notes |
|---|---|---|---|---|---|
| Real-ESRGAN (2021) | Image SR x4/x2; video script runs per frame | Small, tiles | 60 to 80 fps 480p to 1080p on RTX 4090 (vendor blog, May 2026) | BSD-3-Clause | GAN. Hallucination Score 2.78 (synthetic), 2.96 (RealSR), 3.27 (DRealSR) vs bicubic 4.56 to 4.76, higher is better. No temporal model, so edges shimmer and textures crawl frame to frame |
| BasicVSR++ (CVPR 2022) | VSR x4; deblur and denoise variants at native resolution | Whole-clip bidirectional; chunk with max-seq-len | 77 ms per 720p output frame (V100); deblur variants 131 ms (x4 down) and 433 ms (x2 down) per 720p frame on 2080 Ti | Apache 2.0 (mmagic) | Low. Charbonnier loss only, no adversarial term. Trained on bicubic/Gaussian-blur pairs (SR) and GoPro/DVD motion blur (deblur), not scatter blur, so gains on this footage are uncertain rather than dangerous |
| RealBasicVSR (CVPR 2022) | Real-world VSR x4 with a pre-cleaning module | Similar, has --max-seq-len | 63 ms per 720p output frame (V100) | Apache 2.0 | Moderate to high. Perceptual plus adversarial fine-tuning; the FastRealVSR paper reports recurrent real-world models "accumulate and propagate artifacts through hidden states" |
| VRT (2022) / RVRT (NeurIPS 2022) | SR, deblur, denoise | 1 to 2 GB at 320x180 input | 0.3 to 2.2 s per 1280x720 input frame | CC-BY-NC | Low (L1-trained) but licence excludes commercial use; heavy |
| Upscale-A-Video (CVPR 2024) | Diffusion VSR x4, 30 steps | 18 to 39 GB | 279 s per 33-frame 720p clip (A100, DOVE paper) | NTU S-Lab 1.0, non-commercial | High |
| MGLD-VSR (ECCV 2024) | SD 2.1-based diffusion VSR, 50 steps | Not stated | 425 s per 33-frame 720p clip (A100) | LICENSE.txt present, not read | High |
| VEnhancer (2024) | Space-time diffusion enhancer | "at least A100 80G" | 121 s per 33-frame 720p clip (A100) | MIT per repo listing | High; built for AI-generated video, authors say v1 "sometimes over-smooths edges" and is "very creative" |
| STAR (ICCV 2025) | T2V-prior diffusion VSR x4, 15 steps | about 39 GB for 72 frames at 426x240 | 173 s per 33-frame 720p clip (A100) | MIT (I2VGen-XL) / CogVideoX licence (5B) | High |
| DOVE (2025) | One-step diffusion VSR on CogVideoX1.5-5B | 25 to 32 GB | 14.9 s per 33-frame 720p clip (A100); 1.39 fps at 768x1408 | Apache 2.0 | High |
| SeedVR2 3B/7B (ICLR 2026) | One-step diffusion restoration, arbitrary resolution | Official: 1 H100-80G handles 100x720x1280; 1080p needs 4 H100. ComfyUI wrapper: 8 GB with GGUF Q4, 12 to 16 GB FP8, 24 GB+ FP16 | 3B: 1.43 fps at 768x1408, 52.9 GB peak; community: 1.5 to 2.5 s per 1080p frame on a 12 GB card with tiling | Apache 2.0 | High. Authors: "not robust to heavy degradations and very large motions" and "tends to overly generate details on inputs with very light degradations ... oversharpened". Community reports plastic skin |
| FlashVSR v1.1 (CVPR 2026) | One-step streaming diffusion VSR x4 with sparse attention | 11.1 GB (Tiny), 18.3 GB (Full) | Tiny 16.9 fps, Full 6.5 fps at 768x1408 on A100-80G | Apache 2.0 | High. Trained on the RealBasicVSR synthetic degradation pipeline. Officially Ampere A100/A800 only |
| InstaVSR (Mar 2026), OSDEnhancer (Jan 2026) | One-step diffusion VSR / space-time SR | InstaVSR 7.1 GB | InstaVSR 0.77 min per 30-frame 2K clip on a 4090 | Not checked | High; InstaVSR's own paper says the base model's "over-hallucination causes it to synthesize pseudo-textures" |

Independent real-footage tests: none exist for the 2025-26 diffusion models. MSU's Video
Super-Resolution Benchmark and Video Upscalers Benchmark were last updated in 2023 and cover
Real-ESRGAN-era methods only. The SeedVR2-vs-FlashVSR and SeedVR2-vs-Topaz articles that rank
highly in search are vendor or SEO pieces without methodology.

## Commercial tools and prices (read 3 September 2026)

| Tool | Price | What it offers | Notes |
|---|---|---|---|
| Topaz Video | Personal $299/yr ($59 month-to-month), 25 cloud credits/month, "non-commercial or limited commercial"; Pro $699/yr, 100 credits/month. Extra credits $0.10 each; Astra top-ups 20 for $5.00, 120 for $23.40 | Local: Proteus, Iris, Nyx, Rhea, Artemis, Gaia, Theia, Starlight Precise; cloud-only: Starlight Mini/Sharp/HQ/Fast. Starlight Mini local needs an NVIDIA card with 10 GB VRAM | Cloud credit table: 1080p 24 fps 6 credits/min (non-diffusion models), 1080p 90 credits/min (Starlight). Starlight capped at 5 min per clip. Free 30-day trial exports with a watermark. Perpetual licences ended Oct 2025. Adobe acquisition announced 25 June 2026, pending |
| Topaz Astra (cloud app for Starlight) | Standard $19/mo (400 credits), Plus $99/mo (1,400), Pro $299/mo (5,400) | Cloud Starlight variants | 400 credits is about 4.4 min of 1080p Starlight |
| DaVinci Resolve | Free; Studio $295 US, £239.99 to £245 inc VAT, perpetual | Super Scale 2x/3x/4x with sharpness and noise-reduction controls, Studio only. Dehaze is Studio only. Free version keeps the Color Warper, curves and the Fairlight/Fusion pages | No dedicated underwater tool; underwater grading is done with the Color Warper, curves and third-party plugins. No generative upscaler in either build |
| Adobe Premiere Pro / After Effects | Creative Cloud subscription | Generative Extend, caption translation. No AI upscaler; scaling is conventional. Topaz sells a Premiere panel | Adobe "Enhance" is Enhance Speech (audio) in Premiere and Super Resolution in Lightroom and Camera Raw (raw stills only) |
| Adobe Firefly video upscaler (web) | Firefly Standard $9.99/mo (2,000 credits), Pro $19.99 (4,000), Pro Plus $49.99 (10,000), Premium $199.99 (50,000) | "Powered by Topaz Astra"; Precise or Creative mode; output 1080p or 4K; input MP4 under 200 MB, 5 to 20 s long | Credit cost per upscale not verified |
| Pixop | Historically $0.05 to $0.25 per megapixel-minute, about $6 to $30 per hour of 1080p (secondary sources) | Deep Restoration, super-resolution, denoise | Public self-serve pricing page returned 404; now "Get in touch" |
| TensorPix | Standard $5.50/mo (10 credits), Premium $12.42 (35), Elite $30.25 (110), annual; PAYG $2.50/credit; 1 credit is roughly 2 min | Online enhancer | Model undisclosed |
| neural.love | PAYG $0.17/credit, about $0.08/credit on annual Pro | Video upscale to 720p/1080p/4K | Credits per minute not published |

## The cheap, faithful baseline (ffmpeg on the CPU box)

`unsharp` takes odd matrix sizes 3 to 23 and amount -1.5 to 1.5 (chroma 0). `smartblur` has
radius 0.1 to 5.0, strength -1.0 to 1.0 where negative sharpens. `cas` is AMD's Contrast Adaptive
Sharpening (strength 0 to 1), which sharpens low-contrast neighbourhoods more and high-contrast
ones less, so it avoids the halo look of a uniform unsharp mask. `hqdn3d` is the fast
spatio-temporal denoiser (defaults 4:3:6:4.5). `nlmeans` is higher quality and slow. `bm3d`
better and slower still. `deband` hides banding after a contrast stretch.

Order of operations: denoise, then sharpen, then any contrast work, then encode. Sharpen luma only
(chroma amount 0) to avoid colour noise and flicker. Test on one clip at 100% zoom before
batch-running.

- Recipe A, sharpen only: `-vf "cas=strength=0.4"`
- Recipe B, light denoise then sharpen: `-vf "hqdn3d=2:1.5:3:3,unsharp=5:5:0.6:5:5:0.0"`
- Recipe C, best-quality denoise then adaptive sharpen (slow): `-vf "nlmeans=s=3:p=7:r=15,cas=strength=0.5"`
- Recipe D, smartblur detail enhancement: `-vf "smartblur=lr=1.5:ls=-0.35:lt=-3.5:cr=0.65:cs=0.25:ct=2.0"`
- Recipe E, local contrast for veiling haze (ffmpeg caps the unsharp matrix at 23, and lx+ly
  must not exceed 25, so use 13:13): `-vf "unsharp=13:13:0.3:13:13:0.0,cas=strength=0.3"`.
  For a proper CLAHE apply `cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))` to the L channel
  of Lab in OpenCV per frame. Marine snow: `atadenoise` will ghost moving fish, avoid it.

Evaluation without ground truth: a blind side-by-side for three spotters, a difference image
inspected for new edges rather than amplified existing ones, and a flicker check (mean absolute
frame-to-frame difference). Do not use NIQE, MUSIQ or CLIP-IQA to pick a winner; the Hallucination
Score paper shows such no-reference metrics "will not detect details as hallucinatory as long as
the quality of the details is high".

## Cost table for 170 clips x 10 s x 30 fps at 1080p

GPU prices seen 3 September 2026: Modal T4 $0.59/h, L4 $0.80, A10 $1.10, L40S $1.95, A100-40
$2.10, A100-80 $2.50, H100 $3.95, plus $30/month free credit. RunPod Community/Secure per hour:
RTX 4090 $0.34/$0.74, L40S $0.79/$0.99, A100 PCIe 80 GB $1.19/$1.39, H100 PCIe $1.99/$2.89.
Lambda on-demand: A10 $1.29, A100-40 $1.99, H100 SXM $3.99. Vast.ai RTX 4090 $0.25 on-demand,
$0.11 spot. Kaggle gives 30 GPU-hours per week (T4 x2 or P100). Colab free gives a T4 with
unpublished, dynamic limits.

| Route | GPU-hours (estimate) | Cost |
|---|---|---|
| ffmpeg recipes A/B/E | 0 (minutes to an hour on CPU) | 0 |
| ffmpeg recipe C (nlmeans) | 0 (roughly 5 to 15 h CPU) | 0 |
| BasicVSR++ deblur/denoise at native 1080p | 4 to 14 | Modal A10 $5 to $15 (free within credit); RunPod 4090 $1 to $5 |
| BasicVSR++ / RealBasicVSR x4 then downscale | 8 to 20 | Modal $10 to $25; RunPod 4090 $3 to $7 |
| FlashVSR-Tiny, 1080p to 4K then downscale | 6 to 8 (A100) | Modal A100 $15 to $30; RunPod community A100 $8 to $12 |
| SeedVR2-3B at 1080p | about 25 (A100-80/H100) | Modal $50 to $65; RunPod community A100 about $30; rented 4090 with tiling $5 to $10 |
| SeedVR2-7B at 1080p | 50 to 75 | $125 to $190 Modal; $60 to $90 RunPod |
| DOVE | about 25 (A100) | $50 to $65 Modal |
| STAR / Upscale-A-Video / MGLD-VSR | 200 to 250+ | $400 to $600 |
| Topaz cloud, Proteus-class (6 credits/min at 1080p) | n/a | about 170 credits, $17 (at $0.10) to $43 (at $0.25), plus a plan or the watermarked trial |
| Topaz cloud Starlight (90 credits/min at 1080p) | n/a | 2,550 credits, $255 at $0.10 to $497 to $637 at top-up rates |
| Adobe Firefly upscaler | n/a | $9.99/mo plan; per-clip credit cost unverified |
| Pixop (if self-serve still exists) | n/a | roughly $3 to $15 |
| TensorPix | n/a | about 15 credits, $37.50 PAYG or one $12.42 month |
| DaVinci Resolve Studio | local | £240 one-off; needs a GPU machine |

## Hallucination-risk assessment

The only study found that measures hallucination as its own quantity (Hallucination Score, arXiv
2507.14367, 2025) scores outputs 1 to 5 with 5 meaning no invented content. Bicubic scores 4.56
to 4.76, the regression transformer Swin2SR 3.38 to 3.68, the GAN model Real-ESRGAN 2.78 to 3.27,
and the diffusion image-SR models StableSR 3.22 to 3.51, PiSA 3.11 to 3.62, SeeSR 2.92 to 3.11
and PASD 2.54 to 2.89. Every learned method invents something; adversarial and diffusion training
invent most. The paper's central warning is that perceptual quality metrics are blind to this.

Ordered from safest to most dangerous for species identification: ffmpeg linear and adaptive
filters; regression-trained multi-frame models (BasicVSR++ family, VRT, RVRT); Topaz
Proteus/Artemis/Rhea (Topaz staff, June 2023: "there is little that can be done for out-of-focus
files, however, you may be able to sharpen the file to a point where it may look more in focus
using the Proteus model"); GAN-trained real-world models (Real-ESRGAN, RealBasicVSR); diffusion
VSR (InstaVSR's authors, March 2026: "the model's tendency toward over-hallucination causes it to
synthesize pseudo-textures that do not correspond to the original content"). For this app the
disqualifying failures are the specific ones: invented scale rows, spot patterns, fin-ray edges
and lateral lines, which are exactly the "plausible texture" a generative prior supplies.

## Sober assessment: will super-resolution help this footage?

Almost certainly not beyond what a sharpening and local-contrast pass gives. The degradation is
optical, not a pixel shortage: the Camera Module 3 records 1080p from its 2x2-binned 2304x1296
sensor mode, so there is no unrecorded resolution to recover. Underwater, forward scattering
deflects light "at small angles, leading to blurring" and backscattering creates "a haze-like
effect that reduces image contrast" (arXiv 2505.01869). Scatter mainly lowers the contrast of fine
detail rather than deleting it, which is why contrast restoration works. Super-resolution's
synthetic training assumption fails on real turbid water (RUIESR, IEEE TCSVT 2023: existing
networks "achieve limited performance on real-world turbid low-resolution underwater images
because they assume simple bicubic down-sampling"). Nobody has measured the new models on real
footage. One genuine caveat in SR's favour: multi-frame methods can fuse sub-pixel information
across frames, which is real recovery rather than invention, but it needs aliased, not
scatter-blurred, detail to work on.

## Sources

Open-source models: github.com/ByteDance-Seed/SeedVR; github.com/IceClear/SeedVR2; arxiv.org/html/2506.05301;
github.com/numz/ComfyUI-SeedVR2_VideoUpscaler; github.com/OpenImagingLab/FlashVSR and arxiv.org/abs/2510.12747;
github.com/zhengchen1999/DOVE and arxiv.org/html/2505.16239; github.com/NJU-PCALab/STAR; github.com/sczhou/Upscale-A-Video;
github.com/Vchitect/VEnhancer; github.com/IanYeung/MGLD-VSR; github.com/xh9998/DiffVSR; arxiv.org/html/2603.26134 (InstaVSR);
github.com/W-Shuoyan/OSDEnhancer; github.com/ckkelvinchan/RealBasicVSR and arxiv.org/pdf/2111.12704;
github.com/ckkelvinchan/BasicVSR_PlusPlus and arxiv.org/pdf/2104.13371; arxiv.org/pdf/2204.05308;
github.com/JingyunLiang/RVRT and arxiv.org/pdf/2206.02146; github.com/JingyunLiang/VRT; github.com/xinntao/Real-ESRGAN;
arxiv.org/abs/2212.07339 (FastRealVSR).

Hallucination, evaluation, underwater physics: arxiv.org/html/2507.14367 (Hallucination Score); arxiv.org/abs/2110.09992 (ERQA);
videoprocessing.ai/benchmarks/video-super-resolution.html; videoprocessing.ai/benchmarks/video-upscalers.html;
arxiv.org/html/2505.01869; pmc.ncbi.nlm.nih.gov/articles/PMC12473551/ (turbid-water inspection, CLAHE);
dl.acm.org/doi/abs/10.1109/TCSVT.2023.3328785 (RUIESR); arxiv.org/abs/2002.01155 (Deep SESR);
forums.raspberrypi.com/viewtopic.php?t=347335 (Camera Module 3 sensor modes);
community.topazlabs.com/t/can-you-fix-focus-with-video-ai/46424;
community.topazlabs.com/t/trying-to-sharpen-blurry-shot-medium-out-of-focus-with-video-ai-and-it-seems-to-be-doing-nothing/71358.

Commercial pricing: topazlabs.com/topaz-video, /pricing, /cloud-render, /astra; docs.topazlabs.com (Starlight);
adobe.com/products/firefly/features/video-upscaler.html and /plans; helpx.adobe.com (Firefly upscale, Lightroom enhance);
steakunderwater.com VFXPedia Resolve manual (Super Scale, Dehaze, Studio only); pricespy.co.uk and cvp.com (Resolve Studio);
pixop.com; aiarty.com and kjetilfuras.com (TensorPix); toolsforhumans.ai and unifab.ai (neural.love);
pcai.nero.com/blog/topaz-labs-alternative (Adobe acquisition).

ffmpeg: ffmpeg.org/ffmpeg-filters.html; ayosec.github.io/ffmpeg-filters-docs/7.1 (cas, unsharp, smartblur);
forum.videohelp.com/threads/389480; ffmpeglab.com/articles/ffmpeg-video-denoising.html; gpuopen.com/fidelityfx-cas/.

Cloud GPU prices and free tiers: modal.com/pricing; runpod.io/pricing; lambda.ai/service/gpu-cloud;
getdeploying.com/gpus/nvidia-rtx-4090; research.google.com/colaboratory/faq.html; kaggle.com/general/135810.
