"""Run MLLE (Zhang et al. TIP 2022, 'Minimal color Loss and Locally adaptive contrast Enhancement')
on each local clip, per frame, as the published video mode does (only the channel-exchange
decision is frozen across frames). Uses the MIT Python port's LACC; LACE re-implemented here
with a numpy guided filter so we do not need opencv-contrib.
Writes out_mlle/<clip>.mp4, out_mlle/<clip>_ab.mp4 and appends to out_mlle/metrics.csv.
"""
import os, sys, cv2, numpy as np, subprocess, csv, time
ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, "ext", "mlle_py"))
from utils.LACC import LACC
sys.path.insert(0, ROOT)
from classical import read_frames, write_mp4, frame_stats, uciqe, uiqm, label

def guided_filter(I, p, r=10, eps=0.01):
    I = I.astype(np.float32)/255.0; p = p.astype(np.float32)/255.0
    k = (2*r+1, 2*r+1)
    mI = cv2.blur(I, k); mp = cv2.blur(p, k); mIp = cv2.blur(I*p, k); mII = cv2.blur(I*I, k)
    a = (mIp - mI*mp) / (mII - mI*mI + eps); b = mp - a*mI
    q = cv2.blur(a, k)*I + cv2.blur(b, k)
    return np.clip(q*255, 0, 255).astype(np.uint8)

def LACE(img8, beta=1.5, block=25, step=20):
    lab = cv2.cvtColor(img8, cv2.COLOR_BGR2LAB); L, A, B = cv2.split(lab)
    Lf = L.astype(np.float64); gvar = Lf.var()
    S, SS = cv2.integral2(L); h, w = L.shape
    out = np.zeros_like(Lf); wsum = np.zeros_like(Lf)
    for i in range(0, h, step):
        for j in range(0, w, step):
            ei, ej = min(i+block, h), min(j+block, w); n = (ei-i)*(ej-j)
            bs = S[ei,ej]-S[i,ej]-S[ei,j]+S[i,j]; bm = bs/n
            bss = SS[ei,ej]-SS[i,ej]-SS[ei,j]+SS[i,j]; bv = bss/n - bm*bm
            alpha = gvar/bv if bv > 1e-6 else beta
            g = min(alpha, beta)
            out[i:ei, j:ej] += bm + g*(Lf[i:ei, j:ej]-bm); wsum[i:ei, j:ej] += 1
    out = np.clip(out/wsum, 0, 255).astype(np.uint8)
    out = guided_filter(L, out)
    am, bm_ = A.mean(), B.mean()
    if am > bm_: B = np.clip(B + B*((am-bm_)/(am+bm_)), 0, 255).astype(np.uint8)
    else: A = np.clip(A + A*((bm_-am)/(am+bm_)), 0, 255).astype(np.uint8)
    return cv2.cvtColor(cv2.merge([out, A, B]), cv2.COLOR_LAB2BGR)

if __name__ == "__main__":
    CLIPS = os.path.join(ROOT, "clips"); OUT = os.path.join(ROOT, "out_mlle"); os.makedirs(OUT, exist_ok=True)
    only = sys.argv[1:]; rows = []
    import json
    for clip in sorted(os.listdir(CLIPS)):
        if only and not any(o in clip for o in only): continue
        marker = os.path.join(OUT, f"{clip}.json")
        if os.path.isfile(marker):
            rows.append(json.load(open(marker))); print(f"[{clip}] mlle (cached)", flush=True); continue
        frames, fps = read_frames(os.path.join(CLIPS, clip, "snippet.mp4")); n = len(frames)
        t0 = time.time(); outs = []; is_run = False
        for f in frames:
            lacc, is_run = LACC(f.astype(np.float64)/255.0, is_vid=True, is_run=is_run)
            outs.append(LACE(np.clip(lacc*255, 0, 255).astype(np.uint8), beta=1.5))
        dt = (time.time()-t0)/n
        write_mp4(os.path.join(OUT, f"{clip}.mp4"), outs, fps)
        ab = [np.hstack([cv2.resize(frames[i], (960,540), interpolation=cv2.INTER_AREA), cv2.resize(outs[i], (960,540), interpolation=cv2.INTER_AREA)]) for i in range(n)]
        write_mp4(os.path.join(OUT, f"{clip}_ab.mp4"), ab, fps)
        mid = n//2; cv2.imwrite(os.path.join(OUT, f"{clip}_mid.jpg"), outs[mid], [cv2.IMWRITE_JPEG_QUALITY, 90])
        st = np.array([frame_stats(outs[i]) for i in range(0, n, 3)])
        r = dict(clip=clip, method="mlle", a=st[:,0].mean(), b=st[:,1].mean(), a_std=st[:,0].std(), b_std=st[:,1].std(),
                 chroma=st[:,2].mean(), sharp=st[:,3].mean(), uciqe=uciqe(outs[mid]), uiqm=uiqm(outs[mid]), secs_per_frame=dt)
        rows.append(r)
        json.dump({k: (float(v) if isinstance(v, (np.floating, float, int)) else v) for k, v in r.items()}, open(marker, "w"))
        del outs, ab
        print(f"[{clip}] mlle {dt*1000:.0f} ms/frame a={r['a']:.1f} b={r['b']:.1f} flick=({r['a_std']:.1f},{r['b_std']:.1f}) chroma={r['chroma']:.1f} sharp={r['sharp']:.0f} UCIQE={r['uciqe']:.3f} UIQM={r['uiqm']:.2f}", flush=True)
    with open(os.path.join(OUT, "metrics.csv"), "a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        if f.tell() == 0: w.writeheader()
        w.writerows(rows)
    print("done")
