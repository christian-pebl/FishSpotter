"""Full-HD review: for every processed clip build a 3840x1080 side-by-side (original left at
1920x1080, optimised right at 1920x1080, first 10 s, same frames) and a single-viewer page that
plays them from the OneDrive folder with three modes: side by side, wipe slider, flip at the same
frame. Ratings and notes save in the browser; Copy results produces text to paste back.
Usage: python fullhd_page.py [--only NAME ...] [--skip-encode]
"""
import os, re, csv, json, html, subprocess, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
AB = os.path.join(ROOT, "ab_out")
DEST = r"C:\Users\Christian Abulhawa\OneDrive\Desktop\Fishspotter media\colour-ab"
FULL = os.path.join(DEST, "fullhd"); os.makedirs(FULL, exist_ok=True)
SRC_DIRS = [os.path.join(ROOT, d) for d in ("clips", "clips2", "clips3")]
thumb = {r["name"][:48]: r for r in csv.DictReader(open(os.path.join(ROOT, "thumb_rank.csv")))}
ANIMALS = ["octopus", "bigjelly", "jelly", "scorpionfish", "brittlestargoby", "cuttlefish", "stickleback", "twospotgobyandstar", "twospotgoby", "goldsinnys", "goldsinny", "wrassepollack", "wrasses", "wrasse", "pollackcrab", "pollack", "spidercrab", "seal", "seagooseberry"]
NICE = {"bigjelly": "large jellyfish", "brittlestargoby": "brittlestar and goby", "twospotgobyandstar": "two-spot goby and starfish", "twospotgoby": "two-spot goby", "goldsinnys": "goldsinny wrasse", "goldsinny": "goldsinny wrasse", "wrassepollack": "wrasse and pollack", "wrasses": "wrasses", "pollackcrab": "pollack and crab", "spidercrab": "spider crab", "scorpionfish": "sea scorpion", "seagooseberry": "sea gooseberry"}

def describe(clip):
    t = thumb.get(clip[:48], {}); site = t.get("site") or ""
    if not site:
        site = {"ATLMAR": "Atlantic Mariculture", "KEL": "Kelp Crofters", "META": "East Pickard Bay", "NORF": "Blakeney Overfalls", "OYS": "Veerse Meer", "PROJSG": "Dale Bay", "EXO": "Freshwater West", "ALG": "Algapelago", "CYM": "Ramsey Sound"}.get(re.match(r"[A-Z]+", clip).group(0), "unlabelled")
    m = re.search(r"(20\d\d)[-_](\d\d)[-_](\d\d)", clip); date = f"{m.group(3)}/{m.group(2)}/{m.group(1)}" if m else ""
    low = clip.lower(); animal = next((NICE.get(a, a) for a in ANIMALS if a in low), "")
    params = json.load(open(os.path.join(AB, clip, "params.json"))) if os.path.isfile(os.path.join(AB, clip, "params.json")) else {}
    return site, date, animal, params.get("red_class", "")

def find_src(clip):
    for d in SRC_DIRS:
        p = os.path.join(d, clip, "snippet.mp4")
        if os.path.isfile(p): return p
    return None

def find_opt(clip):
    for fn in ("snippet.mp4", "optimised.mp4"):
        p = os.path.join(AB, clip, fn)
        if os.path.isfile(p): return p
    return None

only = [a for a in sys.argv[1:] if not a.startswith("--")]; skip = "--skip-encode" in sys.argv
clips = sorted(d for d in os.listdir(AB) if os.path.isfile(os.path.join(AB, d, "params.json")))
clips.sort(key=lambda c: (describe(c)[0], c))
items = []
for i, c in enumerate(clips, 1):
    if only and not any(o in c for o in only): continue
    src, opt = find_src(c), find_opt(c)
    if not src or not opt: print("missing source for", c); continue
    out = os.path.join(FULL, f"{i:02d}__{c[:44]}.mp4")
    if not skip and (not os.path.isfile(out) or os.path.getmtime(out) < os.path.getmtime(opt)):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-i", opt, "-filter_complex",
                        "[0:v]trim=duration=10,setpts=PTS-STARTPTS,scale=1920:1080[a];[1:v]trim=duration=10,setpts=PTS-STARTPTS,scale=1920:1080[b];[a][b]hstack=inputs=2",
                        "-c:v", "libx264", "-crf", "21", "-preset", "medium", "-profile:v", "high", "-level", "5.1", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", out], check=True)
        print("encoded", os.path.basename(out), os.path.getsize(out) // 1024, "KB", flush=True)
    site, date, animal, red = describe(c)
    items.append(dict(n=i, clip=c, file="fullhd/" + os.path.basename(out), site=site, date=date, animal=animal, red=red))
print(len(items), "clips")

RED_TXT = {"dead": "no red recorded", "weak": "a little red recorded", "usable": "real colour recorded"}
for it in items:
    it["label"] = f"{it['n']:02d}  {it['site']}" + (f", {it['date']}" if it['date'] else "") + (f": {it['animal']}" if it['animal'] else "")
    it["sub"] = RED_TXT.get(it["red"], "")

PAGE = r'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SubCam A/B Review (full HD)</title>
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
.stage{position:relative;width:100%;background:#000;display:flex;justify-content:center}
.stage canvas,.stage video{display:block;max-width:100%;height:auto}
.stage video.side{width:100%}
.stage canvas{width:min(100%,1920px);aspect-ratio:16/9}
.hint{position:absolute;left:12px;bottom:10px;font-family:"Roboto Mono",monospace;font-size:12px;color:#fff;background:rgba(0,0,0,.55);padding:3px 8px;border-radius:6px;pointer-events:none}
.bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 16px}
.bar .grow{flex:1 1 320px}
h2{font-family:Jost,sans-serif;font-weight:600;font-size:16px;margin:0}.sub{font-size:13px;color:var(--muted)}
.rate{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:0 16px 10px}
.note{flex:1 1 280px;font:inherit;font-size:14px;padding:8px 12px;border-radius:8px;border:1.5px solid var(--rule);background:var(--surface);color:var(--ink);min-height:38px}
.results{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 16px 16px}
textarea{flex:1 1 420px;font-family:"Roboto Mono",monospace;font-size:12px;min-height:52px;max-height:160px;padding:8px 10px;border-radius:8px;border:1.5px solid var(--rule);background:var(--surface);color:var(--ink);resize:vertical}
.count{font-family:"Roboto Mono",monospace;font-size:13px;color:var(--muted)}
kbd{font-family:"Roboto Mono",monospace;font-size:12px;background:var(--surface);border:1px solid var(--rule);padding:1px 6px;border-radius:4px}
input[type=range]{width:220px;accent-color:var(--accent)}
</style></head><body>
<div class="top">
  <h1>SubCam A/B Review</h1>
  <button id="prev" title="previous (left arrow)">&#8592; Prev</button>
  <select id="pick" aria-label="clip"></select>
  <button id="next" title="next (right arrow)">Next &#8594;</button>
  <span class="count" id="pos"></span>
  <span style="flex:1"></span>
  <button id="m-side">Side by side</button><button id="m-wipe" class="on">Wipe</button><button id="m-flip">Flip</button>
  <button id="play">Pause</button>
  <label class="count">Zoom <input type="range" id="zoom" min="1" max="3" step="0.25" value="1" aria-label="zoom"></label>
</div>
<div class="stage" id="stage">
  <video id="v" muted loop playsinline preload="auto" class="side" hidden></video>
  <canvas id="c" width="1920" height="1080"></canvas>
  <div class="hint" id="hint"></div>
</div>
<div class="bar"><div class="grow"><h2 id="title"></h2><span class="sub" id="sub"></span></div>
  <span class="count">Keys: <kbd>&#8592;</kbd> <kbd>&#8594;</kbd> clips &middot; <kbd>space</kbd> flip / pause &middot; <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd> rate &middot; drag on the picture to wipe or pan</span></div>
<div class="rate" role="group" aria-label="rating">
  <button data-v="optimised">1 Optimised better</button><button data-v="same">2 About the same</button><button data-v="original">3 Original better</button><button data-v="unsure">4 Unsure</button>
  <input class="note" id="note" placeholder="optional note (too grey, noisy, fish clearer...)" aria-label="note">
</div>
<div class="results"><textarea id="out" readonly aria-label="results"></textarea><button id="copy" class="on">Copy results</button><button id="reset">Clear ratings</button><span class="count" id="count"></span></div>
<script>
const CLIPS=__CLIPS__;
const KEY='subcam-ab-v1';let state={};try{state=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
let idx=0,mode='wipe',wipe=0.5,flipRight=false,zoom=1,panX=0,panY=0,dragging=null;
const v=document.getElementById('v'),c=document.getElementById('c'),ctx=c.getContext('2d'),hint=document.getElementById('hint');
const pick=document.getElementById('pick');CLIPS.forEach((cl,i)=>{const o=document.createElement('option');o.value=i;o.textContent=cl.label;pick.appendChild(o)});
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}renderState()}
function cur(){return CLIPS[idx]}
function load(i){idx=(i+CLIPS.length)%CLIPS.length;const cl=cur();pick.value=idx;document.getElementById('title').textContent=cl.label;document.getElementById('sub').textContent=cl.sub;document.getElementById('pos').textContent=(idx+1)+' / '+CLIPS.length;v.src=cl.file;v.play().catch(()=>{});panX=0;panY=0;renderState();location.hash='c'+(idx+1)}
function setMode(m){mode=m;['side','wipe','flip'].forEach(k=>document.getElementById('m-'+k).classList.toggle('on',k===m));if(m==='side'){v.hidden=false;c.hidden=true}else{v.hidden=true;c.hidden=false}updateHint()}
function updateHint(){hint.textContent=mode==='wipe'?'left of the line: original  |  right: optimised'+(zoom>1?'  (zoom '+zoom+'x, drag to pan)':''):mode==='flip'?(flipRight?'OPTIMISED':'ORIGINAL')+'  (space or click to flip)'+(zoom>1?'  zoom '+zoom+'x':''):'original left, optimised right'}
function draw(){if(mode==='side'||v.readyState<2){return}
  const W=1920,H=1080,z=zoom;const sw=W/z,sh=H/z;let sx=(W-sw)/2+panX,sy=(H-sh)/2+panY;sx=Math.max(0,Math.min(W-sw,sx));sy=Math.max(0,Math.min(H-sh,sy));
  ctx.clearRect(0,0,W,H);
  if(mode==='flip'){ctx.drawImage(v,(flipRight?W:0)+sx,sy,sw,sh,0,0,W,H);return}
  const x=Math.round(wipe*W);
  if(x>0)ctx.drawImage(v,sx,sy,sw*(x/W),sh,0,0,x,H);
  if(x<W)ctx.drawImage(v,W+sx+sw*(x/W),sy,sw*((W-x)/W),sh,x,0,W-x,H);
  ctx.fillStyle='rgba(255,255,255,.9)';ctx.fillRect(x-1,0,2,H);
  ctx.font='600 26px Jost,Arial,sans-serif';ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(12,12,150,40);ctx.fillRect(W-178,12,166,40);ctx.fillStyle='#fff';ctx.fillText('original',24,41);ctx.fillText('optimised',W-166,41)}
function loop(){draw();document.getElementById('play').textContent=v.paused?'Play':'Pause';requestAnimationFrame(loop)}
requestAnimationFrame(loop);
v.addEventListener('loadeddata',()=>{draw();v.play().catch(()=>{})});
function canvasPoint(e){const r=c.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height}}
c.addEventListener('pointerdown',e=>{c.setPointerCapture(e.pointerId);const p=canvasPoint(e);dragging={x:e.clientX,y:e.clientY,px:panX,py:panY,moved:false};if(mode==='wipe'&&zoom===1){wipe=p.x;draw()}});
c.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-dragging.x,dy=e.clientY-dragging.y;if(Math.abs(dx)+Math.abs(dy)>3)dragging.moved=true;if(zoom>1){const r=c.getBoundingClientRect();panX=dragging.px-dx*(1920/r.width)/zoom;panY=dragging.py-dy*(1920/r.width)/zoom}else if(mode==='wipe'){wipe=canvasPoint(e).x}draw()});
c.addEventListener('pointerup',e=>{if(dragging&&!dragging.moved&&mode==='flip'){flipRight=!flipRight;updateHint();draw()}dragging=null});
document.getElementById('zoom').addEventListener('input',e=>{zoom=parseFloat(e.target.value);if(zoom===1){panX=0;panY=0}updateHint();draw()});
document.getElementById('prev').onclick=()=>load(idx-1);document.getElementById('next').onclick=()=>load(idx+1);pick.onchange=()=>load(parseInt(pick.value));
document.getElementById('m-side').onclick=()=>setMode('side');document.getElementById('m-wipe').onclick=()=>setMode('wipe');document.getElementById('m-flip').onclick=()=>setMode('flip');
document.getElementById('play').onclick=()=>{v.paused?v.play():v.pause()};
document.querySelectorAll('.rate button').forEach(b=>b.onclick=()=>rate(b.dataset.v));
function rate(val){const k=cur().clip;state[k]=Object.assign({},state[k]||{},{v:val});save()}
document.getElementById('note').addEventListener('input',e=>{const k=cur().clip;state[k]=Object.assign({},state[k]||{},{note:e.target.value});save()});
function renderState(){const s=state[cur().clip]||{};document.querySelectorAll('.rate button').forEach(b=>b.classList.toggle('on',b.dataset.v===s.v));const n=document.getElementById('note');if(document.activeElement!==n)n.value=s.note||'';
  const tally={optimised:0,same:0,original:0,unsure:0};let done=0;CLIPS.forEach(cl=>{const t=state[cl.clip];if(t&&t.v){done++;if(t.v in tally)tally[t.v]++}});
  document.getElementById('count').textContent=done+' of '+CLIPS.length+' rated';
  const lines=['SubCam A/B results ('+done+'/'+CLIPS.length+' rated): optimised better '+tally.optimised+', same '+tally.same+', original better '+tally.original+', unsure '+tally.unsure];
  CLIPS.forEach(cl=>{const t=state[cl.clip];if(t&&t.v)lines.push(cl.label+' -> '+t.v+(t.note?' ("'+t.note+'")':''))});document.getElementById('out').value=lines.join('\n')}
document.getElementById('copy').onclick=async()=>{const t=document.getElementById('out');t.select();try{await navigator.clipboard.writeText(t.value)}catch(e){document.execCommand('copy')}const b=document.getElementById('copy');b.textContent='Copied';setTimeout(()=>b.textContent='Copy results',1500)};
document.getElementById('reset').onclick=()=>{if(confirm('Clear all ratings?')){state={};save()}};
document.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT')return;
  if(e.key==='ArrowLeft'){load(idx-1)}else if(e.key==='ArrowRight'){load(idx+1)}else if(e.key===' '){e.preventDefault();if(mode==='flip'){flipRight=!flipRight;updateHint();draw()}else{v.paused?v.play():v.pause()}}
  else if(e.key==='1')rate('optimised');else if(e.key==='2')rate('same');else if(e.key==='3')rate('original');else if(e.key==='4')rate('unsure');else if(e.key==='w')setMode('wipe');else if(e.key==='f')setMode('flip');else if(e.key==='s')setMode('side')});
const h=parseInt((location.hash||'').replace('#c',''));load(isNaN(h)?0:h-1);setMode('wipe');
</script></body></html>
'''
page = PAGE.replace("__CLIPS__", json.dumps([{k: it[k] for k in ("clip", "file", "label", "sub")} for it in items]))
open(os.path.join(DEST, "review-fullhd.html"), "w", encoding="utf-8").write(page)
print("wrote", os.path.join(DEST, "review-fullhd.html"))
