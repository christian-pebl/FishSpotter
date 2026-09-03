"""Assemble the findings page: inlines the contact sheets as data URIs (resized, size-capped)
and renders the metrics tables from the JSON markers. Usage: python build_report.py template.html report.html
"""
import base64, csv, glob, json, os, sys, io, re
import cv2, numpy as np
ROOT = os.path.dirname(os.path.abspath(__file__))

def img_b64(path, max_w=1500, q=72):
    im = cv2.imread(path)
    if im is None: return ""
    h, w = im.shape[:2]
    if w > max_w: im = cv2.resize(im, (max_w, int(h*max_w/w)), interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", im, [cv2.IMWRITE_JPEG_QUALITY, q])
    return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode()

def load_metrics():
    rows = []
    for p in glob.glob(os.path.join(ROOT, "out", "*", "*.json")) + glob.glob(os.path.join(ROOT, "out_mlle", "*.json")) + glob.glob(os.path.join(ROOT, "out_waternet", "*.json")):
        rows.append(json.load(open(p)))
    p = os.path.join(ROOT, "out_dcc", "metrics.csv")
    if os.path.isfile(p):
        for r in csv.DictReader(open(p)): rows.append({k: (float(v) if k not in ("clip","method") else v) for k, v in r.items()})
    return rows

SHORT = {"orig":"Original","gw":"Grey-world only","rc_gw":"Compensate + grey-world","rc_gw_cl":"Compensate + GW + CLAHE","neutral":"Neutral (compensate + CLAHE + half chroma)","fusion":"Ancuti fusion","fusion_us":"Fusion + unsharp","mlle":"MLLE","dcc":"Dive Color Corrector","waternet":"WaterNet"}
ORDER = ["orig","gw","rc_gw","rc_gw_cl","neutral","fusion","fusion_us","mlle","dcc","waternet"]

def summary_table(rows):
    from collections import defaultdict
    agg = defaultdict(list)
    for r in rows: agg[r["method"]].append(r)
    out = ['<table class="metrics"><thead><tr><th>Method</th><th>Clips</th><th>Residual cast<br><span class="sub">mean |a*|, |b*|</span></th><th>Flicker<br><span class="sub">max std a*/b*</span></th><th>Chroma</th><th>Edge sharpness<br><span class="sub">Laplacian var</span></th><th>UCIQE</th><th>UIQM</th><th>CPU time<br><span class="sub">ms per 1080p frame</span></th></tr></thead><tbody>']
    for m in ORDER:
        rs = agg.get(m)
        if not rs: continue
        f = lambda k: np.mean([float(r[k]) for r in rs]); fa = lambda k: np.mean([abs(float(r[k])) for r in rs])
        flick = np.mean([max(float(r["a_std"]), float(r["b_std"])) for r in rs])
        ms = f("secs_per_frame")*1000
        out.append(f'<tr><td>{SHORT[m]}</td><td>{len(rs)}</td><td>{fa("a"):.1f}, {fa("b"):.1f}</td><td>{flick:.2f}</td><td>{f("chroma"):.1f}</td><td>{f("sharp"):.0f}</td><td>{f("uciqe"):.3f}</td><td>{f("uiqm"):.2f}</td><td>{ms:.0f}</td></tr>' if ms > 0 else
                   f'<tr><td>{SHORT[m]}</td><td>{len(rs)}</td><td>{fa("a"):.1f}, {fa("b"):.1f}</td><td>{flick:.2f}</td><td>{f("chroma"):.1f}</td><td>{f("sharp"):.0f}</td><td>{f("uciqe"):.3f}</td><td>{f("uiqm"):.2f}</td><td>n/a</td></tr>')
    out.append("</tbody></table>")
    return "\n".join(out)

def per_clip_table(rows, clip):
    rs = {r["method"]: r for r in rows if r["clip"] == clip}
    out = ['<table class="metrics small"><thead><tr><th>Method</th><th>a*</th><th>b*</th><th>Flicker</th><th>Chroma</th><th>Sharp</th></tr></thead><tbody>']
    for m in ORDER:
        r = rs.get(m)
        if not r: continue
        out.append(f'<tr><td>{SHORT[m]}</td><td>{float(r["a"]):.1f}</td><td>{float(r["b"]):.1f}</td><td>{max(float(r["a_std"]), float(r["b_std"])):.2f}</td><td>{float(r["chroma"]):.1f}</td><td>{float(r["sharp"]):.0f}</td></tr>')
    out.append("</tbody></table>")
    return "\n".join(out)

if __name__ == "__main__":
    tpl, dst = sys.argv[1], sys.argv[2]
    html = open(tpl, encoding="utf-8").read()
    rows = load_metrics()
    html = html.replace("{{SUMMARY_TABLE}}", summary_table(rows))
    caps_path = os.path.join(ROOT, "captions.json")
    caps = json.load(open(caps_path, encoding="utf-8")) if os.path.isfile(caps_path) else {}
    html = re.sub(r"\{\{CAP:([^}]+)\}\}", lambda m: caps.get(m.group(1), ""), html)
    vars_path = os.path.join(ROOT, "report_vars.json")
    if os.path.isfile(vars_path):
        for k, v in json.load(open(vars_path)).items(): html = html.replace("{{VAR:" + k + "}}", str(v))
    # {{SHEET:<clip prefix>}} and {{IMG:<relative path>}} and {{CLIPTABLE:<clip prefix>}}
    import re
    def sheet(m):
        pre = m.group(1); hits = sorted(glob.glob(os.path.join(ROOT, "sheets", pre + "*.jpg")))
        return img_b64(hits[0]) if hits else ""
    html = re.sub(r"\{\{SHEET:([^}]+)\}\}", sheet, html)
    html = re.sub(r"\{\{IMG:([^}|]+)(?:\|(\d+))?\}\}", lambda m: img_b64(os.path.join(ROOT, m.group(1)), int(m.group(2) or 1500)), html)
    def video(m):
        p = os.path.join(ROOT, m.group(1))
        if not os.path.isfile(p): return ""
        return "data:video/mp4;base64," + base64.b64encode(open(p, "rb").read()).decode()
    html = re.sub(r"\{\{VIDEO:([^}]+)\}\}", video, html)
    def cliptab(m):
        pre = m.group(1); clips = sorted({r["clip"] for r in rows if r["clip"].startswith(pre)})
        return per_clip_table(rows, clips[0]) if clips else ""
    html = re.sub(r"\{\{CLIPTABLE:([^}]+)\}\}", cliptab, html)
    open(dst, "w", encoding="utf-8").write(html)
    print("wrote", dst, f"{os.path.getsize(dst)/1e6:.1f} MB")
