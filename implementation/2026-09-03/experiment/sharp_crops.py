import cv2, numpy as np, os
def mid(path):
    try:
        cap=cv2.VideoCapture(path); n=int(cap.get(cv2.CAP_PROP_FRAME_COUNT)); cap.set(cv2.CAP_PROP_POS_FRAMES, n//2); ok,f=cap.read(); cap.release(); return f if ok else None
    except Exception: return None
def sharp(f): return cv2.Laplacian(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var()
def temporal_noise(path, k=12):
    cap=cv2.VideoCapture(path); n=int(cap.get(cv2.CAP_PROP_FRAME_COUNT)); cap.set(cv2.CAP_PROP_POS_FRAMES, n//2); fr=[]
    for _ in range(k):
        ok,f=cap.read()
        if not ok: break
        fr.append(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY).astype(np.float32))
    cap.release(); d=[np.abs(fr[i+1]-fr[i]).mean() for i in range(len(fr)-1)]; return float(np.mean(d)) if d else 0
clips=["CYM_Farm_S_2026-05-27_08-00_wrassepollack0000488","NORF-1_2026-06-13_11-01_track_manual_9473-9601_2","ATLMAR_2025-09-27_11-00-46_track_manual_70-415_2"]
recipes=["cas","dn_us","lc_cas","nlm_cas"]
for c in clips:
    o=mid(f"clips/{c}/snippet.mp4"); H,W=o.shape[:2]; cx,cy=W//2,H//2
    crop=lambda f: cv2.resize(f[cy-135:cy+135, cx-240:cx+240], (960,540), interpolation=cv2.INTER_NEAREST)
    tiles=[crop(o)]; names=["orig"]; print(f"{c[:40]}  orig sharp={sharp(o):.1f} tnoise={temporal_noise(f'clips/{c}/snippet.mp4'):.2f}")
    for r in recipes:
        p=f"out_sharp/{c}_{r}.mp4"; f=mid(p) if os.path.isfile(p) else None
        if f is None: continue
        tiles.append(crop(f)); names.append(r); print(f"    {r:8s} sharp={sharp(f):.1f} ({sharp(f)/sharp(o):.2f}x) tnoise={temporal_noise(p):.2f}")
    for t,nm in zip(tiles,names): cv2.putText(t, nm, (10,32), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255,255,255), 2, cv2.LINE_AA)
    while len(tiles)%2: tiles.append(np.zeros_like(tiles[0]))
    cv2.imwrite(f"out_sharp/{c}_crops.jpg", np.vstack([np.hstack(tiles[i:i+2]) for i in range(0,len(tiles),2)]), [cv2.IMWRITE_JPEG_QUALITY, 90])
