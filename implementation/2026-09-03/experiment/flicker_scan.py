"""Per-frame colour-cast scan of every snip via ffmpeg (decoded at 160x90) to find AWB flicker.
Writes flicker_scan.csv incrementally: per clip, per-frame Lab a*/b* stats and flip events."""
import subprocess, numpy as np, cv2, os, csv, sys, time
SN = r"G:\.shortcut-targets-by-id\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\Ocean\08 - Data\01 - SubCam data\Fish Spotter Snips"
W, H = 160, 90
out = open("flicker_scan.csv", "w", newline="")
w = csv.writer(out); w.writerow(["name","frames","a_mean","b_mean","a_std","b_std","a_range","b_range","max_da","max_db","flips","secs"])
t0 = time.time()
for name in sorted(os.listdir(SN)):
    mp4 = os.path.join(SN, name, "snippet.mp4")
    if not os.path.isfile(mp4): continue
    t1 = time.time()
    p = subprocess.run(["ffmpeg","-v","error","-threads","4","-i",mp4,"-vf",f"scale={W}:{H}:flags=area","-f","rawvideo","-pix_fmt","bgr24","-"],
                       capture_output=True)
    buf = np.frombuffer(p.stdout, np.uint8)
    n = len(buf)//(W*H*3)
    if n == 0:
        w.writerow([name,0]+[""]*10); out.flush(); continue
    fr = buf[:n*W*H*3].reshape(n, H, W, 3)
    a = np.empty(n); b = np.empty(n)
    for i in range(n):
        lab = cv2.cvtColor(fr[i], cv2.COLOR_BGR2LAB)
        a[i] = lab[...,1].mean()-128; b[i] = lab[...,2].mean()-128
    da = np.abs(np.diff(a)); db = np.abs(np.diff(b))
    flips = int(((da > 3) | (db > 3)).sum())
    w.writerow([name, n, f"{a.mean():.2f}", f"{b.mean():.2f}", f"{a.std():.2f}", f"{b.std():.2f}", f"{a.max()-a.min():.2f}", f"{b.max()-b.min():.2f}",
                f"{da.max():.2f}", f"{db.max():.2f}", flips, f"{time.time()-t1:.1f}"])
    out.flush()
print("done", time.time()-t0)
