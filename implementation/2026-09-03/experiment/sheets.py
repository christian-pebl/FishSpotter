"""Combined per-clip contact sheets across every method tried, plus a merged metrics table.
Sheet tiles (mid-clip frame): orig | gw | rc_gw | rc_gw_cl | fusion | fusion_us | mlle | dcc | waternet
Writes sheets/<clip>.jpg (3x3 grid, 640x360 tiles) and sheets/all_metrics.csv
"""
import cv2, numpy as np, os, csv, glob, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "sheets"); os.makedirs(OUT, exist_ok=True)
METHODS = ["orig","rc_gw","neutral","rc_gw_cl","fusion","fusion_us","mlle","dcc","waternet"]

def mid_frame(path):
    if not path or not os.path.isfile(path): return None
    cap = cv2.VideoCapture(path); n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)); cap.set(cv2.CAP_PROP_POS_FRAMES, max(n//2, 0)); ok, f = cap.read(); cap.release()
    return f if ok else None

def source_for(clip, m):
    if m in ("orig","gw","rc_gw","rc_gw_cl","fusion","fusion_us","neutral"): return os.path.join(ROOT, "out", clip, f"{m}.mp4")
    if m == "mlle": return os.path.join(ROOT, "out_mlle", f"{clip}.mp4")
    if m == "dcc": return os.path.join(ROOT, "out_dcc", f"{clip}.mp4")
    if m == "waternet":
        p = os.path.join(ROOT, "out_waternet", f"{clip}.mp4")
        return p if os.path.isfile(p) else None

def tile(img, text, size=(640,360)):
    if img is None:
        t = np.full((size[1], size[0], 3), 40, np.uint8); cv2.putText(t, f"{text}: n/a", (12, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (200,200,200), 2, cv2.LINE_AA); return t
    t = cv2.resize(img, size, interpolation=cv2.INTER_AREA).copy()
    cv2.rectangle(t, (0,0), (len(text)*15+16, 34), (0,0,0), -1)
    cv2.putText(t, text, (8, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255,255,255), 2, cv2.LINE_AA); return t

if __name__ == "__main__":
    clips = sorted(os.listdir(os.path.join(ROOT, "clips")))
    for clip in clips:
        tiles = [tile(mid_frame(source_for(clip, m)), m) for m in METHODS]
        rows = [np.hstack(tiles[i:i+3]) for i in range(0, 9, 3)]
        sheet = np.vstack(rows)
        cv2.putText(sheet, clip, (8, sheet.shape[0]-10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 2, cv2.LINE_AA)
        cv2.imwrite(os.path.join(OUT, f"{clip}.jpg"), sheet, [cv2.IMWRITE_JPEG_QUALITY, 86])
        print("sheet", clip)
    # merged metrics
    import json
    allrows = []
    for p in glob.glob(os.path.join(ROOT, "out", "*", "*.json")) + glob.glob(os.path.join(ROOT, "out_mlle", "*.json")) + glob.glob(os.path.join(ROOT, "out_waternet", "*.json")):
        allrows.append(json.load(open(p)))
    for p in [os.path.join(ROOT, "out_dcc", "metrics.csv")]:
        if os.path.isfile(p):
            for r in csv.DictReader(open(p)):
                if r.get("clip") == "clip": continue
                allrows.append(r)
    seen = set(); dedup = []
    for r in allrows:
        k = (r["clip"], r["method"])
        if k in seen: continue
        seen.add(k); dedup.append(r)
    with open(os.path.join(OUT, "all_metrics.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(dedup[0].keys())); w.writeheader(); w.writerows(dedup)
    # summary table: mean over clips per method
    from collections import defaultdict
    agg = defaultdict(list)
    for r in dedup: agg[r["method"]].append(r)
    print(f"\n{'method':10s} {'n':>2s} {'|a*|':>6s} {'|b*|':>6s} {'flick':>6s} {'chroma':>7s} {'sharp':>6s} {'UCIQE':>6s} {'UIQM':>6s} {'ms/fr':>6s}")
    for m in ["orig","gw","rc_gw","rc_gw_cl","neutral","fusion","fusion_us","mlle","dcc","waternet"]:
        rs = agg.get(m, [])
        if not rs: continue
        f = lambda k: np.mean([float(r[k]) for r in rs])
        fa = lambda k: np.mean([abs(float(r[k])) for r in rs])
        flick = np.mean([max(float(r['a_std']), float(r['b_std'])) for r in rs])
        print(f"{m:10s} {len(rs):2d} {fa('a'):6.1f} {fa('b'):6.1f} {flick:6.2f} {f('chroma'):7.1f} {f('sharp'):6.0f} {f('uciqe'):6.3f} {f('uiqm'):6.2f} {f('secs_per_frame')*1000:6.0f}")
