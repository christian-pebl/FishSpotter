"""Three-way full-HD review: A (original) | B (gentle) | C (full) side by side, one composited
video per clip so playback is guaranteed frame-synced (no separate <video> elements to drift).
Each panel 1280x720 (16:9, no letterboxing), canvas 3840x720. Labels are burned in but neutral
("A", "B", "C") plus a small legend under the picture, not "original/optimised", so the pick
isn't primed.
Usage: python threeway_page.py [--only NAME ...] [--skip-encode]
"""
import os, re, csv, json, html, subprocess, sys
import cv2, numpy as np
ROOT = os.path.dirname(os.path.abspath(__file__))
AB_FULL = os.path.join(ROOT, "ab_out")       # profile "full": <clip>/snippet.mp4 (processed only)
AB_GENTLE = os.path.join(ROOT, "ab_gentle")  # profile "gentle": <clip>/snippet.mp4
DEST = r"C:\Users\Christian Abulhawa\OneDrive\Desktop\Fishspotter media\colour-ab"
THREE = os.path.join(DEST, "threeway"); os.makedirs(THREE, exist_ok=True)
SRC_DIRS = [os.path.join(ROOT, d) for d in ("clips", "clips2", "clips3")]
thumb = {r["name"][:48]: r for r in csv.DictReader(open(os.path.join(ROOT, "thumb_rank.csv")))}

ANIMALS = ["octopus", "bigjelly", "jelly", "scorpionfish", "brittlestargoby", "cuttlefish", "stickleback", "twospotgobyandstar", "twospotgoby", "goldsinnys", "goldsinny", "wrassepollack", "wrasses", "wrasse", "pollackcrab", "pollack", "spidercrab", "seal", "seagooseberry"]
NICE = {"bigjelly": "large jellyfish", "brittlestargoby": "brittlestar and goby", "twospotgobyandstar": "two-spot goby and starfish", "twospotgoby": "two-spot goby", "goldsinnys": "goldsinny wrasse", "goldsinny": "goldsinny wrasse", "wrassepollack": "wrasse and pollack", "wrasses": "wrasses", "pollackcrab": "pollack and crab", "spidercrab": "spider crab", "scorpionfish": "sea scorpion", "seagooseberry": "sea gooseberry"}
RED_TXT = {"dead": "no red recorded", "weak": "a little red recorded", "usable": "real colour recorded"}

def describe(clip):
    t = thumb.get(clip[:48], {}); site = t.get("site") or ""
    if not site:
        site = {"ATLMAR": "Atlantic Mariculture", "KEL": "Kelp Crofters", "META": "East Pickard Bay", "NORF": "Blakeney Overfalls", "OYS": "Veerse Meer", "PROJSG": "Dale Bay", "EXO": "Freshwater West", "ALG": "Algapelago", "CYM": "Ramsey Sound"}.get(re.match(r"[A-Z]+", clip).group(0), "unlabelled")
    m = re.search(r"(20\d\d)[-_](\d\d)[-_](\d\d)", clip); date = f"{m.group(3)}/{m.group(2)}/{m.group(1)}" if m else ""
    low = clip.lower(); animal = next((NICE.get(a, a) for a in ANIMALS if a in low), "")
    p = os.path.join(AB_FULL, clip, "params.json")
    red = json.load(open(p)).get("red_class", "") if os.path.isfile(p) else ""
    return site, date, animal, red

def find_src(clip):
    for d in SRC_DIRS:
        p = os.path.join(d, clip, "snippet.mp4")
        if os.path.isfile(p): return p
    return None

def find_full(clip):
    """ab_out was written by two different scripts across this session: colour_rescue_snips.py
    (od/snippet.mp4) and the earlier optimise.py prototype (od/optimised.mp4). Accept either."""
    for fn in ("snippet.mp4", "optimised.mp4"):
        p = os.path.join(AB_FULL, clip, fn)
        if os.path.isfile(p): return p
    return None

def read_frames(path, n_want):
    cap = cv2.VideoCapture(path); fps = cap.get(cv2.CAP_PROP_FPS) or 30.0; frames = []
    while len(frames) < n_want:
        ok, f = cap.read()
        if not ok: break
        frames.append(f)
    cap.release(); return frames, fps

def panel(frame, letter):
    p = cv2.resize(frame, (1280, 720), interpolation=cv2.INTER_AREA)
    cv2.rectangle(p, (0, 0), (56, 46), (0, 0, 0), -1)
    cv2.putText(p, letter, (14, 34), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2, cv2.LINE_AA)
    return p

def encode_triptych(orig_path, gentle_path, full_path, out_path, seconds=10.0):
    fps_probe = cv2.VideoCapture(orig_path); fps = fps_probe.get(cv2.CAP_PROP_FPS) or 30.0; fps_probe.release()
    n_want = int(round(fps * seconds))
    fo, _ = read_frames(orig_path, n_want); fg, _ = read_frames(gentle_path, n_want); ff, _ = read_frames(full_path, n_want)
    n = min(len(fo), len(fg), len(ff))
    if n == 0: raise RuntimeError("no frames: " + orig_path)
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", "3840x720", "-r", str(fps), "-i", "-",
                          "-c:v", "libx264", "-crf", "21", "-preset", "medium", "-profile:v", "high", "-level", "5.1", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", out_path], stdin=subprocess.PIPE)
    for i in range(n):
        row = np.hstack([panel(fo[i], "A"), panel(fg[i], "B"), panel(ff[i], "C")])
        p.stdin.write(row.tobytes())
    p.stdin.close(); p.wait()
    return n / fps

only = [a for a in sys.argv[1:] if not a.startswith("--")]; skip = "--skip-encode" in sys.argv
clips = sorted(d for d in os.listdir(AB_FULL) if os.path.isfile(os.path.join(AB_FULL, d, "params.json")))
clips.sort(key=lambda c: (describe(c)[0], c))
items = []
for i, c in enumerate(clips, 1):
    if only and not any(o in c for o in only): continue
    orig = find_src(c); gentle = os.path.join(AB_GENTLE, c, "snippet.mp4"); full = find_full(c)
    missing = [n for n, p in (("original", orig), ("gentle", gentle), ("full", full)) if not p or not os.path.isfile(p)]
    if missing: print(f"[{c}] missing {missing}, skipped"); continue
    out = os.path.join(THREE, f"{i:02d}__{c[:44]}.mp4")
    if not skip and (not os.path.isfile(out) or os.path.getmtime(out) < os.path.getmtime(gentle)):
        dur = encode_triptych(orig, gentle, full, out)
        print(f"[{c}] encoded {os.path.basename(out)} {dur:.1f}s {os.path.getsize(out)//1024} KB", flush=True)
    site, date, animal, red = describe(c)
    items.append(dict(n=i, clip=c, file="threeway/" + os.path.basename(out), site=site, date=date, animal=animal, red=red))
print(len(items), "clips")

for it in items:
    it["label"] = f"{it['n']:02d}  {it['site']}" + (f", {it['date']}" if it['date'] else "") + (f": {it['animal']}" if it['animal'] else "")
    it["sub"] = RED_TXT.get(it["red"], "")

PAGE = r'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SubCam A/B/C Review</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@600;700&family=Roboto:wght@300;400;500&family=Roboto+Mono&display=swap">
<style>
:root{--bg:#17252A;--surface:#1F3238;--ink:#E6F1F0;--muted:#8FCFCA;--accent:#3AAFA9;--rule:rgba(222,242,241,.16)}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink);font-family:Roboto,"Helvetica Neue",Arial,sans-serif;font-weight:300;font-size:15px}
[hidden]{display:none!important}
.top{display:flex;gap:14px;align-items:center;flex-wrap:wrap;padding:10px 16px;border-bottom:1px solid var(--rule)}
h1{font-family:Jost,Futura,"Trebuchet MS",sans-serif;font-weight:700;font-size:20px;margin:0 8px 0 0}
button,select{font:inherit;font-weight:500;font-size:14px;padding:7px 12px;border-radius:999px;border:1.5px solid var(--rule);background:var(--surface);color:var(--ink);cursor:pointer;min-height:38px}
button.on{background:var(--accent);border-color:var(--accent);color:#fff}button:hover{border-color:var(--accent)}
button:focus-visible,select:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
select{max-width:520px}
.stage{width:100%;background:#000;display:flex;justify-content:center}
.stage video{display:block;width:100%;max-width:1920px;height:auto}
.legend{display:flex;gap:18px;padding:8px 16px;font-family:"Roboto Mono",monospace;font-size:13px;color:var(--muted);border-bottom:1px solid var(--rule)}
.legend b{color:var(--ink)}
.bar{display:flex;gap:14px;align-items:center;flex-wrap:wrap;padding:10px 16px}
.bar .grow{flex:1 1 320px}
h2{font-family:Jost,sans-serif;font-weight:600;font-size:16px;margin:0}.sub{font-size:13px;color:var(--muted)}
.rate{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:0 16px 10px}
.rate button[data-v]{font-family:"Roboto Mono",monospace;font-weight:600;min-width:44px}
.note{flex:1 1 280px;font:inherit;font-size:14px;padding:8px 12px;border-radius:8px;border:1.5px solid var(--rule);background:var(--surface);color:var(--ink);min-height:38px}
.results{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 16px 16px}
textarea{flex:1 1 420px;font-family:"Roboto Mono",monospace;font-size:12px;min-height:52px;max-height:160px;padding:8px 10px;border-radius:8px;border:1.5px solid var(--rule);background:var(--surface);color:var(--ink);resize:vertical}
.count{font-family:"Roboto Mono",monospace;font-size:13px;color:var(--muted)}
kbd{font-family:"Roboto Mono",monospace;font-size:12px;background:var(--surface);border:1px solid var(--rule);padding:1px 6px;border-radius:4px}
</style></head><body>
<div class="top">
  <h1>SubCam A/B/C Review</h1>
  <button id="prev" title="previous (left arrow)">&#8592; Prev</button>
  <select id="pick" aria-label="clip"></select>
  <button id="next" title="next (right arrow)">Next &#8594;</button>
  <span class="count" id="pos"></span>
  <span style="flex:1"></span>
  <button id="play">Pause</button>
</div>
<div class="legend"><span><b>A</b> = original, as shot</span><span><b>B</b> = gentle correction, keeps a hint of the water colour</span><span><b>C</b> = full correction (the one rated 3 Sep)</span></div>
<div class="stage"><video id="v" autoplay muted loop playsinline preload="auto"></video></div>
<div class="bar"><div class="grow"><h2 id="title"></h2><span class="sub" id="sub"></span></div>
  <span class="count">Keys: <kbd>&#8592;</kbd> <kbd>&#8594;</kbd> clips &middot; <kbd>space</kbd> pause &middot; <kbd>a</kbd> <kbd>b</kbd> <kbd>c</kbd> pick</span></div>
<div class="rate" role="group" aria-label="pick the best panel">
  <button data-v="A">A best</button><button data-v="B">B best</button><button data-v="C">C best</button><button data-v="tie">Tie / can't tell</button>
  <input class="note" id="note" placeholder="optional note" aria-label="note">
</div>
<div class="results"><textarea id="out" readonly aria-label="results"></textarea><button id="copy" class="on">Copy results</button><button id="reset">Clear picks</button><span class="count" id="count"></span></div>
<script>
const CLIPS=__CLIPS__;
const KEY='subcam-abc-v1';let state={};try{state=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
let idx=0;const v=document.getElementById('v'),pick=document.getElementById('pick');
CLIPS.forEach((cl,i)=>{const o=document.createElement('option');o.value=i;o.textContent=cl.label;pick.appendChild(o)});
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}renderState()}
function cur(){return CLIPS[idx]}
function load(i){idx=(i+CLIPS.length)%CLIPS.length;const cl=cur();pick.value=idx;document.getElementById('title').textContent=cl.label;document.getElementById('sub').textContent=cl.sub;document.getElementById('pos').textContent=(idx+1)+' / '+CLIPS.length;v.src=cl.file;v.play().catch(()=>{});renderState();location.hash='c'+(idx+1)}
document.getElementById('prev').onclick=()=>load(idx-1);document.getElementById('next').onclick=()=>load(idx+1);pick.onchange=()=>load(parseInt(pick.value));
document.getElementById('play').onclick=()=>{v.paused?v.play():v.pause()};
v.addEventListener('play',()=>{document.getElementById('play').textContent='Pause'});v.addEventListener('pause',()=>{document.getElementById('play').textContent='Play'});
document.querySelectorAll('.rate button[data-v]').forEach(b=>b.onclick=()=>rate(b.dataset.v));
function rate(val){const k=cur().clip;state[k]=Object.assign({},state[k]||{},{v:val});save()}
document.getElementById('note').addEventListener('input',e=>{const k=cur().clip;state[k]=Object.assign({},state[k]||{},{note:e.target.value});save()});
function renderState(){const s=state[cur().clip]||{};document.querySelectorAll('.rate button[data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===s.v));const n=document.getElementById('note');if(document.activeElement!==n)n.value=s.note||'';
  const tally={A:0,B:0,C:0,tie:0};let done=0;CLIPS.forEach(cl=>{const t=state[cl.clip];if(t&&t.v){done++;if(t.v in tally)tally[t.v]++}});
  document.getElementById('count').textContent=done+' of '+CLIPS.length+' picked';
  const lines=['SubCam A/B/C results ('+done+'/'+CLIPS.length+' picked): A (original) '+tally.A+', B (gentle) '+tally.B+', C (full) '+tally.C+', tie/unsure '+tally.tie];
  CLIPS.forEach(cl=>{const t=state[cl.clip];if(t&&t.v)lines.push(cl.label+' -> '+t.v+(t.note?' ("'+t.note+'")':''))});document.getElementById('out').value=lines.join('\n')}
document.getElementById('copy').onclick=async()=>{const t=document.getElementById('out');t.select();try{await navigator.clipboard.writeText(t.value)}catch(e){document.execCommand('copy')}const b=document.getElementById('copy');b.textContent='Copied';setTimeout(()=>b.textContent='Copy results',1500)};
document.getElementById('reset').onclick=()=>{if(confirm('Clear all picks?')){state={};save()}};
document.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT')return;
  if(e.key==='ArrowLeft'){load(idx-1)}else if(e.key==='ArrowRight'){load(idx+1)}else if(e.key===' '){e.preventDefault();v.paused?v.play():v.pause()}
  else if(e.key==='a'||e.key==='A')rate('A');else if(e.key==='b'||e.key==='B')rate('B');else if(e.key==='c'||e.key==='C')rate('C');else if(e.key==='t'||e.key==='T')rate('tie')});
const h=parseInt((location.hash||'').replace('#c',''));load(isNaN(h)?0:h-1);
</script></body></html>
'''
page = PAGE.replace("__CLIPS__", json.dumps([{k: it[k] for k in ("clip", "file", "label", "sub")} for it in items]))
open(os.path.join(DEST, "review-abc.html"), "w", encoding="utf-8").write(page)
print("wrote", os.path.join(DEST, "review-abc.html"))
