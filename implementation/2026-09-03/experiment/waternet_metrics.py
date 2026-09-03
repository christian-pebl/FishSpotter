"""Metrics markers for the WaterNet outputs (out_waternet/<clip>.mp4 -> out_waternet/<clip>.json)."""
import os, sys, json, glob, cv2, numpy as np
ROOT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, ROOT)
from classical import frame_stats, uciqe, uiqm
for v in glob.glob(os.path.join(ROOT, "out_waternet", "*.mp4")):
    clip = os.path.basename(v)[:-4]
    cap = cv2.VideoCapture(v); frames = []
    while True:
        ok, f = cap.read()
        if not ok: break
        frames.append(f)
    cap.release(); n = len(frames)
    if not n: print("empty", clip); continue
    st = np.array([frame_stats(frames[i]) for i in range(0, n, 3)]); mid = frames[n//2]
    r = dict(clip=clip, method="waternet", a=float(st[:,0].mean()), b=float(st[:,1].mean()), a_std=float(st[:,0].std()), b_std=float(st[:,1].std()),
             chroma=float(st[:,2].mean()), sharp=float(st[:,3].mean()), uciqe=float(uciqe(mid)), uiqm=float(uiqm(mid)), secs_per_frame=0.0)
    json.dump(r, open(os.path.join(ROOT, "out_waternet", f"{clip}.json"), "w"))
    print(f"{clip[:44]:44s} waternet a={r['a']:.1f} b={r['b']:.1f} flick=({r['a_std']:.2f},{r['b_std']:.2f}) chroma={r['chroma']:.1f} sharp={r['sharp']:.0f} redmed={np.median(mid[...,2]):.0f}")
