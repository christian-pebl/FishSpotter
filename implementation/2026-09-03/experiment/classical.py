"""Classical (CPU, training-free) underwater colour/contrast fixes, applied to whole clips
with temporally smoothed statistics so the output does not flicker.

Methods
  orig      : untouched
  gw        : grey-world white balance, per-frame gains smoothed over time (gain cap)
  rc_gw     : Ancuti-2018 channel compensation (red always; blue when weak) + grey-world
  rc_gw_cl  : rc_gw + CLAHE on L*
  fusion    : Ancuti-2018 multi-scale fusion (gamma input + sharpened input, Laplacian/saliency/saturation weights)
  fusion_us : fusion + mild unsharp mask
Outputs per clip: <method>.mp4 (H.264), ab_<method>.mp4 (side-by-side vs orig), sheet.jpg; metrics.csv overall.
"""
import cv2, numpy as np, os, sys, csv, subprocess, json, time

ROOT = os.path.dirname(os.path.abspath(__file__))
CLIPS = os.path.join(ROOT, "clips"); OUT = os.path.join(ROOT, "out"); os.makedirs(OUT, exist_ok=True)
GAIN_CAP = 3.5

def read_frames(path):
    cap = cv2.VideoCapture(path); fps = cap.get(cv2.CAP_PROP_FPS) or 30.0; frames = []
    while True:
        ok, f = cap.read()
        if not ok: break
        frames.append(f)
    cap.release(); return frames, fps

def smooth(x, med=9, mean=5):
    """centered moving median then moving mean along axis 0"""
    x = np.asarray(x, np.float64); n = len(x)
    if n < 3: return x
    h = med//2; pad = np.pad(x, ((h,h),(0,0)), mode="edge")
    m = np.stack([np.median(pad[i:i+med], axis=0) for i in range(n)])
    h2 = mean//2; pad2 = np.pad(m, ((h2,h2),(0,0)), mode="edge")
    return np.stack([pad2[i:i+mean].mean(axis=0) for i in range(n)])

def channel_means(frames):
    return np.array([f.reshape(-1,3).mean(0) for f in frames]) / 255.0  # BGR

def compensate(img, means, alpha=1.0):
    """Ancuti 2018: I_rc = I_r + alpha*(Gm - Rm)*(1 - I_r)*I_g ; blue likewise when weak. img float BGR 0..1"""
    b, g, r = img[...,0], img[...,1], img[...,2]; Bm, Gm, Rm = means
    r2 = r + alpha*max(Gm - Rm, 0)*(1 - r)*g
    b2 = b + alpha*max(Gm - Bm, 0)*(1 - b)*g if Bm < Gm else b
    return np.stack([b2, g, r2], -1)

def gw_gains(mean_bgr):
    grey = mean_bgr.mean(); g = grey / np.maximum(mean_bgr, 1e-4)
    return np.clip(g, 1/GAIN_CAP, GAIN_CAP)

def apply_gains(img, gains):
    return np.clip(img * gains.reshape(1,1,3), 0, 1)

def clahe_L(img8):
    lab = cv2.cvtColor(img8, cv2.COLOR_BGR2LAB); cl = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    lab[...,0] = cl.apply(lab[...,0]); return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

def desat(img8, k=0.5):
    """scale Lab chroma toward neutral: a clip with no recorded red has no hue worth asserting"""
    lab = cv2.cvtColor(img8, cv2.COLOR_BGR2LAB).astype(np.float32)
    lab[...,1] = 128 + (lab[...,1]-128)*k; lab[...,2] = 128 + (lab[...,2]-128)*k
    return cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)

def unsharp(img8, amount=0.6, sigma=1.5):
    bl = cv2.GaussianBlur(img8, (0,0), sigma); return cv2.addWeighted(img8, 1+amount, bl, -amount, 0)

# ---- Ancuti 2018 fusion ----
def gaussian_pyr(img, levels):
    p = [img]
    for _ in range(levels-1): p.append(cv2.pyrDown(p[-1]))
    return p
def laplacian_pyr(img, levels):
    g = gaussian_pyr(img, levels); l = []
    for i in range(levels-1):
        up = cv2.pyrUp(g[i+1], dstsize=(g[i].shape[1], g[i].shape[0])); l.append(g[i]-up)
    l.append(g[-1]); return l
def weights_for(img):  # img float BGR 0..1
    lab = cv2.cvtColor((img*255).astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
    L = lab[...,0]/255.0
    w_lap = np.abs(cv2.Laplacian(L, cv2.CV_32F, ksize=3))
    blur = cv2.GaussianBlur(lab, (0,0), 3); w_sal = np.linalg.norm(lab - blur, axis=2)/255.0
    w_sat = np.sqrt(((img - img.mean(2, keepdims=True))**2).mean(2))
    return w_lap + w_sal + w_sat + 1e-3
def fusion(img, levels=5, gamma=1.2):
    """img: white-balanced float BGR 0..1"""
    in1 = np.power(img, gamma)
    bl = cv2.GaussianBlur(img, (0,0), 2); hp = img - bl
    hp = (hp - hp.min())/(hp.max()-hp.min()+1e-6)  # normalised unsharp (Ancuti)
    in2 = np.clip((img + hp)/2, 0, 1); in2 = np.clip(in2*(img.mean()/max(in2.mean(),1e-4)), 0, 1)
    w1, w2 = weights_for(in1), weights_for(in2); s = w1 + w2; w1, w2 = w1/s, w2/s
    W1, W2 = gaussian_pyr(w1.astype(np.float32), levels), gaussian_pyr(w2.astype(np.float32), levels)
    L1, L2 = laplacian_pyr(in1.astype(np.float32), levels), laplacian_pyr(in2.astype(np.float32), levels)
    fused = [L1[i]*W1[i][...,None] + L2[i]*W2[i][...,None] for i in range(levels)]
    out = fused[-1]
    for i in range(levels-2, -1, -1):
        out = cv2.pyrUp(out, dstsize=(fused[i].shape[1], fused[i].shape[0])) + fused[i]
    return np.clip(out, 0, 1)

# ---- metrics ----
def uciqe(img8):
    lab = cv2.cvtColor(img8, cv2.COLOR_BGR2LAB).astype(np.float32); L = lab[...,0]/255.0
    chroma = np.hypot(lab[...,1]-128, lab[...,2]-128)/128.0
    sc = chroma.std(); lo, hi = np.percentile(L, [1, 99]); conl = hi - lo
    hsv = cv2.cvtColor(img8, cv2.COLOR_BGR2HSV); mus = hsv[...,1].mean()/255.0
    return 0.4680*sc + 0.2745*conl + 0.2576*mus
def uiqm(img8):
    im = img8.astype(np.float64); B, G, R = im[...,0], im[...,1], im[...,2]
    def mu_alpha(x, aL=0.1, aR=0.1):
        x = np.sort(x.ravel()); K = len(x); TL, TR = int(aL*K), int(aR*K); return x[TL:K-TR].mean()
    RG, YB = R-G, (R+G)/2-B
    uicm = -0.0268*np.hypot(mu_alpha(RG), mu_alpha(YB)) + 0.1586*np.hypot(RG.std(), YB.std())
    def eme(x, k=8):
        h, w = x.shape; bh, bw = h//k, w//k; vals = []
        for i in range(k):
            for j in range(k):
                blk = x[i*bh:(i+1)*bh, j*bw:(j+1)*bw]; mx, mn = blk.max(), blk.min()
                if mn > 0 and mx > 0: vals.append(np.log(mx/mn))
        return 2/(k*k)*np.sum(vals) if vals else 0.0
    def sobel(x):
        return np.hypot(cv2.Sobel(x, cv2.CV_64F, 1, 0), cv2.Sobel(x, cv2.CV_64F, 0, 1))
    uism = 0.299*eme(sobel(R)*R) + 0.587*eme(sobel(G)*G) + 0.114*eme(sobel(B)*B)
    def logamee(x, k=8):
        h, w = x.shape; bh, bw = h//k, w//k; s = 0.0
        for i in range(k):
            for j in range(k):
                blk = x[i*bh:(i+1)*bh, j*bw:(j+1)*bw]; mx, mn = blk.max(), blk.min()
                top = mx - mn; bot = mx + mn
                if bot > 0 and top > 0: s += (top/bot)*np.log(top/bot)
        return s/(k*k)
    uiconm = logamee(cv2.cvtColor(img8, cv2.COLOR_BGR2GRAY).astype(np.float64))
    return 0.0282*uicm + 0.2953*uism + 3.5753*uiconm
def frame_stats(img8):
    lab = cv2.cvtColor(img8, cv2.COLOR_BGR2LAB).astype(np.float32)
    a, b = lab[...,1].mean()-128, lab[...,2].mean()-128
    sharp = cv2.Laplacian(cv2.cvtColor(img8, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var()
    return a, b, float(np.hypot(lab[...,1]-128, lab[...,2]-128).mean()), sharp

# ---- pipeline ----
def process(frames, method):
    n = len(frames); means = smooth(channel_means(frames))
    outs = []
    for i, f in enumerate(frames):
        if method == "orig": outs.append(f); continue
        img = f.astype(np.float32)/255.0
        if method == "gw":
            img = apply_gains(img, gw_gains(means[i]))
        else:
            comp = compensate(img, means[i])
            Bm, Gm, Rm = means[i]; Rm2 = Rm + max(Gm-Rm,0)*(1-Rm)*Gm; Bm2 = Bm + max(Gm-Bm,0)*(1-Bm)*Gm if Bm < Gm else Bm
            img = apply_gains(comp, gw_gains(np.array([Bm2, Gm, Rm2])))
            if method in ("fusion", "fusion_us"):
                img = fusion(img)
        out8 = (img*255).astype(np.uint8)
        outs.append(out8)
    return outs

def write_mp4(path, frames, fps):
    h, w = frames[0].shape[:2]
    p = subprocess.Popen(["ffmpeg","-v","error","-y","-f","rawvideo","-pix_fmt","bgr24","-s",f"{w}x{h}","-r",str(fps),"-i","-",
                          "-c:v","libx264","-crf","18","-preset","veryfast","-pix_fmt","yuv420p","-movflags","+faststart",path], stdin=subprocess.PIPE)
    for f in frames: p.stdin.write(f.tobytes())
    p.stdin.close(); p.wait()

def label(img, text):
    img = img.copy(); cv2.rectangle(img, (0,0), (len(text)*17+20, 40), (0,0,0), -1)
    cv2.putText(img, text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255,255,255), 2, cv2.LINE_AA); return img

METHODS = ["orig","gw","rc_gw","rc_gw_cl","fusion","fusion_us","neutral"]
if __name__ == "__main__":
    only = sys.argv[1:]  # optional clip name filters
    mrows = []
    for clip in sorted(os.listdir(CLIPS)):
        if only and not any(o in clip for o in only): continue
        src = os.path.join(CLIPS, clip, "snippet.mp4"); od = os.path.join(OUT, clip); os.makedirs(od, exist_ok=True)
        frames, fps = read_frames(src); n = len(frames); mid = n//2
        print(f"[{clip}] {n} frames @ {fps:.0f}fps", flush=True)
        tiles = []
        orig_small = [cv2.resize(f, (960,540), interpolation=cv2.INTER_AREA) for f in frames]
        # base methods are computed once; cheap post-steps derive from them instead of recomputing
        DERIVED = {"rc_gw": {"rc_gw_cl": clahe_L, "neutral": lambda f: desat(clahe_L(f), 0.5)}, "fusion": {"fusion_us": unsharp}}
        plan = []  # (name, base, fn)
        for base in ["orig", "gw", "rc_gw", "fusion"]:
            plan.append((base, base, None))
            for name, fn in DERIVED.get(base, {}).items(): plan.append((name, base, fn))
        base_cache = {}
        def base_outs(base):
            if base not in base_cache:
                t0 = time.time(); base_cache[base] = (process(frames, base), time.time()-t0)
            return base_cache[base]
        for m, base, fn in plan:
            marker = os.path.join(od, f"{m}.json")
            if os.path.isfile(marker):  # resumable: this (clip, method) already finished
                r = json.load(open(marker)); mrows.append(r)
                cap = cv2.VideoCapture(os.path.join(od, f"{m}.mp4")); cap.set(cv2.CAP_PROP_POS_FRAMES, mid); ok, mf = cap.read(); cap.release()
                tiles.append(label(cv2.resize(mf if ok else frames[mid], (960,540), interpolation=cv2.INTER_AREA), m))
                print(f"   {m:10s} (cached)", flush=True); continue
            bouts, bdt = base_outs(base)
            if fn is None: outs, dt = bouts, bdt
            else:
                t0 = time.time(); outs = [fn(f) for f in bouts]; dt = bdt + time.time()-t0
            write_mp4(os.path.join(od, f"{m}.mp4"), outs, fps)
            if m != "orig":
                # stream the side-by-side straight to ffmpeg, never hold a second copy of the clip
                h, w = 540, 1920
                p = subprocess.Popen(["ffmpeg","-v","error","-y","-f","rawvideo","-pix_fmt","bgr24","-s",f"{w}x{h}","-r",str(fps),"-i","-",
                                      "-c:v","libx264","-crf","18","-preset","veryfast","-pix_fmt","yuv420p","-movflags","+faststart",os.path.join(od, f"ab_{m}.mp4")], stdin=subprocess.PIPE)
                for i in range(n):
                    p.stdin.write(np.hstack([orig_small[i], cv2.resize(outs[i], (960,540), interpolation=cv2.INTER_AREA)]).tobytes())
                p.stdin.close(); p.wait()
            st = np.array([frame_stats(outs[i]) for i in range(0, n, 3)])
            mrows.append(dict(clip=clip, method=m, a=st[:,0].mean(), b=st[:,1].mean(), a_std=st[:,0].std(), b_std=st[:,1].std(),
                              chroma=st[:,2].mean(), sharp=st[:,3].mean(), uciqe=uciqe(outs[mid]), uiqm=uiqm(outs[mid]), secs_per_frame=dt/n))
            tiles.append(label(cv2.resize(outs[mid], (960,540), interpolation=cv2.INTER_AREA), m))
            r = mrows[-1]
            json.dump({k: (float(v) if isinstance(v, (np.floating, float, int)) else v) for k, v in r.items()}, open(marker, "w"))
            if fn is not None: del outs
            if m == "gw" or m == "neutral" or m == "fusion_us" or m == "orig": base_cache.pop(base, None)
            print(f"   {m:10s} {dt/n*1000:6.0f} ms/frame  a={r['a']:6.1f} b={r['b']:6.1f} flick=({r['a_std']:.1f},{r['b_std']:.1f}) chroma={r['chroma']:.1f} sharp={r['sharp']:.0f} UCIQE={r['uciqe']:.3f} UIQM={r['uiqm']:.2f}", flush=True)
        while len(tiles) % 3: tiles.append(np.zeros_like(tiles[0]))
        rows = [np.hstack(tiles[i:i+3]) for i in range(0, len(tiles), 3)]
        cv2.imwrite(os.path.join(od, "sheet.jpg"), np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 88])
        cv2.imwrite(os.path.join(od, "orig_mid.jpg"), frames[mid], [cv2.IMWRITE_JPEG_QUALITY, 92])
    with open(os.path.join(OUT, "metrics.csv"), "a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(mrows[0].keys()))
        if f.tell() == 0: w.writeheader()
        w.writerows(mrows)
    print("done")
