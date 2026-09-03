"""The candidate 'optimised' pipeline, applied to a folder of clips, with a labelled side-by-side
(original left, optimised right) written for each so a human can confirm it.

Pipeline per clip (all CPU, training-free, temporally smoothed so it cannot flicker):
  1. per-frame channel means, smoothed over time (median 9, mean 5)
  2. Ancuti-2018 channel compensation: red from green (always), blue from green when blue is weak
  3. grey-world gains from the smoothed post-compensation means (capped at 3.5x)
  4. CLAHE on L* (clip 2.0, 8x8) for local contrast
  5. chroma cap by red survival: a clip whose sensor recorded no red keeps half its residual hue,
     a weak-red clip 70 percent, a clip with real red keeps all of it
  6. mild unsharp (amount 0.4, sigma 1.2)
Outputs: <out>/<clip>/optimised.mp4 (full res), <out>/<clip>/ab.mp4 (1920x540 side by side), <out>/<clip>/params.json
Usage: python optimise.py <clips_dir> <out_dir> [name filters...]
"""
import os, sys, json, time, subprocess, cv2, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from classical import read_frames, smooth, channel_means, compensate, gw_gains, apply_gains, clahe_L, desat, frame_stats

def red_survival(frames):
    med = float(np.median([np.median(f[::4, ::4, 2]) for f in frames[::10]]))
    return med, ("dead" if med <= 2 else "weak" if med <= 20 else "usable")

CHROMA = {"dead": 0.5, "weak": 0.7, "usable": 1.0}

def optimise_frame(f, means, k):
    img = f.astype(np.float32)/255.0
    comp = compensate(img, means)
    Bm, Gm, Rm = means; Rm2 = Rm + max(Gm-Rm,0)*(1-Rm)*Gm; Bm2 = Bm + max(Gm-Bm,0)*(1-Bm)*Gm if Bm < Gm else Bm
    out8 = (apply_gains(comp, gw_gains(np.array([Bm2, Gm, Rm2])))*255).astype(np.uint8)
    out8 = clahe_L(out8)
    if k < 1.0: out8 = desat(out8, k)
    bl = cv2.GaussianBlur(out8, (0,0), 1.2); out8 = cv2.addWeighted(out8, 1.4, bl, -0.4, 0)
    return out8

def burn(img, text):
    img = img.copy(); cv2.rectangle(img, (0,0), (len(text)*13+18, 32), (0,0,0), -1)
    cv2.putText(img, text, (8, 23), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,255), 2, cv2.LINE_AA); return img

def encoder(path, w, h, fps, crf=20):
    return subprocess.Popen(["ffmpeg","-v","error","-y","-f","rawvideo","-pix_fmt","bgr24","-s",f"{w}x{h}","-r",str(fps),"-i","-",
                             "-c:v","libx264","-crf",str(crf),"-preset","veryfast","-pix_fmt","yuv420p","-movflags","+faststart",path], stdin=subprocess.PIPE)

if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]; only = sys.argv[3:]
    os.makedirs(dst, exist_ok=True)
    for clip in sorted(os.listdir(src)):
        if only and not any(o in clip for o in only): continue
        mp4 = os.path.join(src, clip, "snippet.mp4")
        if not os.path.isfile(mp4): continue
        od = os.path.join(dst, clip); os.makedirs(od, exist_ok=True)
        if os.path.isfile(os.path.join(od, "params.json")): print(f"[{clip}] cached", flush=True); continue
        # stage 0: light spatio-temporal denoise BEFORE anything amplifies grain; stronger on dark clips
        cap = cv2.VideoCapture(mp4); probe = []
        for _ in range(8):
            ok, f = cap.read()
            if not ok: break
            probe.append(cv2.cvtColor(cv2.resize(f, (160, 90)), cv2.COLOR_BGR2LAB)[..., 0].mean() / 2.55)
        cap.release(); meanL = float(np.mean(probe)) if probe else 50.0
        dn = "hqdn3d=4:3:6:4.5" if meanL < 45 else "hqdn3d=2:1.5:3:3"
        tmp = os.path.join(od, "denoised_src.mp4")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-t", "10.2", "-vf", dn, "-c:v", "libx264", "-crf", "14", "-preset", "veryfast", "-pix_fmt", "yuv420p", tmp], check=True)
        frames, fps = read_frames(tmp); frames = frames[:int(round(fps*10))]; n = len(frames); h, w = frames[0].shape[:2]  # first 10 s is enough to judge
        orig_cap = cv2.VideoCapture(mp4); originals = []
        for _ in range(n):
            ok, f = orig_cap.read()
            if not ok: break
            originals.append(cv2.resize(f, (960, 540), interpolation=cv2.INTER_AREA))
        orig_cap.release()
        means = smooth(channel_means(frames)); med, cls = red_survival(frames); k = CHROMA[cls]
        t0 = time.time()
        full = encoder(os.path.join(od, "optimised.mp4"), w, h, fps, crf=18)
        ab = encoder(os.path.join(od, "ab.mp4"), 1920, 540, fps, crf=20)
        stats = []
        for i, f in enumerate(frames):
            o = optimise_frame(f, means[i], k)
            full.stdin.write(o.tobytes())
            ab.stdin.write(np.hstack([burn(originals[i] if i < len(originals) else cv2.resize(f, (960,540), interpolation=cv2.INTER_AREA), "original"),
                                      burn(cv2.resize(o, (960,540), interpolation=cv2.INTER_AREA), "optimised")]).tobytes())
            if i % 3 == 0: stats.append(frame_stats(o))
        full.stdin.close(); ab.stdin.close(); full.wait(); ab.wait()
        st = np.array(stats); dt = (time.time()-t0)/n
        try: os.remove(tmp)
        except OSError: pass
        params = dict(clip=clip, frames=n, fps=fps, red_median=med, red_class=cls, chroma_k=k, denoise=dn, mean_L=meanL, secs_per_frame=dt,
                      a=float(st[:,0].mean()), b=float(st[:,1].mean()), a_std=float(st[:,0].std()), b_std=float(st[:,1].std()), chroma=float(st[:,2].mean()), sharp=float(st[:,3].mean()))
        json.dump(params, open(os.path.join(od, "params.json"), "w"), indent=1)
        print(f"[{clip}] red={cls} ({med:.0f}) k={k} L={meanL:.0f} {dn} {dt*1000:.0f} ms/frame a={params['a']:.1f} b={params['b']:.1f} flick=({params['a_std']:.1f},{params['b_std']:.1f})", flush=True)
        del frames
    print("done")
