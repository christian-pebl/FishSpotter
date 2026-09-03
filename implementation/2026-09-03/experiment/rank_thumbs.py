import cv2, numpy as np, os, csv, json
SN = r"G:\.shortcut-targets-by-id\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\Ocean\08 - Data\01 - SubCam data\Fish Spotter Snips"
rows = []
for name in sorted(os.listdir(SN)):
    d = os.path.join(SN, name); th = os.path.join(d, "thumbnail.jpg")
    if not os.path.isfile(th): continue
    im = cv2.imread(th)
    if im is None: continue
    im = cv2.resize(im, (320, 180), interpolation=cv2.INTER_AREA)
    lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
    bgr = im.reshape(-1,3).mean(0)
    site = ""
    try:
        meta = json.load(open(os.path.join(d, "metadata.json"), encoding="utf-8")); site = meta.get("deployment") or meta.get("site") or ""
    except Exception: pass
    rows.append(dict(name=name, site=site, L=lab[...,0].mean()/2.55, a=lab[...,1].mean()-128, b=lab[...,2].mean()-128,
                     R=bgr[2], G=bgr[1], B=bgr[0], size_mb=os.path.getsize(os.path.join(d,"snippet.mp4"))/1e6 if os.path.isfile(os.path.join(d,"snippet.mp4")) else 0))
with open("thumb_rank.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
def show(title, key, rev=False, n=8):
    print(f"\n== {title} ==")
    for r in sorted(rows, key=lambda r: r[key], reverse=rev)[:n]:
        print(f"{r[key]:7.2f}  L={r['L']:5.1f} a={r['a']:6.1f} b={r['b']:6.1f} RGB=({r['R']:.0f},{r['G']:.0f},{r['B']:.0f}) {r['size_mb']:.1f}MB  {r['name'][:58]}  [{r['site']}]")
print(f"clips: {len(rows)}")
show("BLUEST (most negative b*)", "b")
show("GREENEST (most negative a*)", "a")
show("DARKEST (L)", "L")
from collections import defaultdict
agg = defaultdict(list)
for r in rows: agg[r['site']].append(r)
print("\n== site summary: n, mean a*, mean b*, mean L ==")
for s, rs in sorted(agg.items(), key=lambda kv: -len(kv[1])):
    print(f"{len(rs):3d}  a={np.mean([r['a'] for r in rs]):6.1f}  b={np.mean([r['b'] for r in rs]):6.1f}  L={np.mean([r['L'] for r in rs]):5.1f}  {s}")
