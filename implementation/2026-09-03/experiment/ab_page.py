"""Build the A/B test page: every ab_out/<clip>/ab.mp4 (original left, optimised right) re-encoded
small and embedded as a data URI, with a rating control per pair and a results box to paste back.
Also writes an index.html into the OneDrive review folder that plays the full-resolution files.
Usage: python ab_page.py  -> ab_test.html (artifact) and <DEST>/index.html
"""
import os, re, csv, json, base64, subprocess, shutil, html
ROOT = os.path.dirname(os.path.abspath(__file__))
AB = os.path.join(ROOT, "ab_out"); SMALL = os.path.join(ROOT, "ab_small2"); os.makedirs(SMALL, exist_ok=True)
DEST = r"C:\Users\Christian Abulhawa\OneDrive\Desktop\Fishspotter media\colour-ab"
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
    red = params.get("red_class", "")
    return site, date, animal, red

def small_mp4(clip):
    src = os.path.join(AB, clip, "ab.mp4"); dst = os.path.join(SMALL, clip + ".mp4")
    if not os.path.isfile(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-t", "10", "-vf", "scale=1280:360:flags=lanczos", "-c:v", "libx264", "-crf", "27", "-preset", "slow",
                        "-profile:v", "high", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", dst], check=True)
    return dst

clips = sorted(d for d in os.listdir(AB) if os.path.isfile(os.path.join(AB, d, "ab.mp4")))
# order: by site so similar water sits together, then name
clips.sort(key=lambda c: (describe(c)[0], c))
items = []; total = 0
for i, c in enumerate(clips, 1):
    site, date, animal, red = describe(c); p = small_mp4(c); b = open(p, "rb").read(); total += len(b)
    items.append(dict(n=i, clip=c, site=site, date=date, animal=animal, red=red, b64=base64.b64encode(b).decode(), kb=len(b) // 1024))
print(f"{len(items)} pairs, {total / 1e6:.1f} MB of video")

RED_TXT = {"dead": "no red recorded", "weak": "a little red recorded", "usable": "real colour recorded"}
def card(it, src):
    label = f"{it['n']:02d}  {it['site']}" + (f", {it['date']}" if it['date'] else "") + (f": {it['animal']}" if it['animal'] else "")
    sub = RED_TXT.get(it["red"], "")
    return f'''<section class="pair" id="p{it['n']}" data-clip="{html.escape(it['clip'])}">
  <div class="head"><h2>{html.escape(label)}</h2><span class="sub">{sub}</span></div>
  <video muted loop playsinline preload="metadata" controls src="{src}"></video>
  <div class="rate" role="group" aria-label="Rating for pair {it['n']}">
    <button data-v="optimised">Optimised better</button><button data-v="same">About the same</button><button data-v="original">Original better</button><button data-v="unsure">Unsure</button>
    <input class="note" placeholder="optional note (e.g. too grey, noisy, fish clearer)" aria-label="note for pair {it['n']}">
  </div>
</section>'''

CSS = '''
:root{--bg:#F2F7F7;--surface:#fff;--ink:#17252A;--muted:#2B7A78;--accent:#3AAFA9;--tint:#DEF2F1;--rule:rgba(23,37,42,.14)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#17252A;--surface:#1F3238;--ink:#E6F1F0;--muted:#8FCFCA;--tint:#22383E;--rule:rgba(222,242,241,.16)}}
:root[data-theme="dark"]{--bg:#17252A;--surface:#1F3238;--ink:#E6F1F0;--muted:#8FCFCA;--tint:#22383E;--rule:rgba(222,242,241,.16)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Roboto,"Helvetica Neue",Arial,sans-serif;font-weight:300;font-size:16px;line-height:1.5}
.wrap{max-width:1180px;margin:0 auto;padding:28px 20px 80px}
h1{font-family:Jost,Futura,"Trebuchet MS",sans-serif;font-weight:700;font-size:clamp(28px,4vw,40px);margin:0 0 6px;letter-spacing:-.01em}
h2{font-family:Jost,Futura,sans-serif;font-weight:600;font-size:17px;margin:0}
.eyebrow{font-family:Jost,sans-serif;font-weight:600;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.intro{max-width:70ch;margin:0 0 18px}.intro p{margin:0 0 8px}
.tools{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0 26px}
button{font:inherit;font-weight:500;font-size:14px;padding:8px 14px;border-radius:999px;border:1.5px solid var(--rule);background:var(--surface);color:var(--ink);cursor:pointer;min-height:40px}
button:hover{border-color:var(--accent)}button.on{background:var(--accent);border-color:var(--accent);color:#fff}
button:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.pair{background:var(--surface);border-radius:12px;padding:14px 16px 16px;margin:0 0 22px;box-shadow:0 1px 2px rgba(23,37,42,.06),0 8px 24px rgba(23,37,42,.06);scroll-margin-top:12px}
.head{display:flex;justify-content:space-between;gap:12px;align-items:baseline;flex-wrap:wrap;margin-bottom:10px}
.sub{font-size:13px;color:var(--muted)}
video{width:100%;height:auto;display:block;border-radius:8px;background:#000}
.rate{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center}
.note{flex:1 1 260px;font:inherit;font-size:14px;padding:8px 12px;border-radius:8px;border:1.5px solid var(--rule);background:var(--bg);color:var(--ink);min-height:40px}
.results{position:sticky;bottom:0;background:var(--surface);border-top:2px solid var(--accent);padding:12px 16px;margin:28px -20px -80px;box-shadow:0 -8px 24px rgba(23,37,42,.08)}
.results .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;max-width:1180px;margin:0 auto}
.results textarea{flex:1 1 420px;font-family:"Roboto Mono",ui-monospace,monospace;font-size:12px;min-height:64px;max-height:180px;padding:8px 10px;border-radius:8px;border:1.5px solid var(--rule);background:var(--bg);color:var(--ink);resize:vertical}
.count{font-family:"Roboto Mono",monospace;font-size:13px;color:var(--muted);white-space:nowrap}
kbd{font-family:"Roboto Mono",monospace;font-size:12px;background:var(--tint);padding:1px 6px;border-radius:4px}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
'''

JS = '''
const KEY='subcam-ab-v1';let state={};try{state=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){state={}}
const pairs=[...document.querySelectorAll('.pair')];
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}render()}
function render(){let done=0;pairs.forEach(p=>{const c=p.dataset.clip;const s=state[c]||{};p.querySelectorAll('button[data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===s.v));const n=p.querySelector('.note');if(document.activeElement!==n)n.value=s.note||'';if(s.v)done++});
 const tally={optimised:0,same:0,original:0,unsure:0};Object.values(state).forEach(s=>{if(s.v in tally)tally[s.v]++});
 document.getElementById('count').textContent=done+' of '+pairs.length+' rated';
 const lines=['SubCam A/B results ('+done+'/'+pairs.length+' rated): optimised better '+tally.optimised+', same '+tally.same+', original better '+tally.original+', unsure '+tally.unsure];
 pairs.forEach(p=>{const c=p.dataset.clip;const s=state[c];if(!s||!s.v)return;lines.push(p.querySelector('h2').textContent.trim()+' -> '+s.v+(s.note?' ("'+s.note+'")':''))});
 document.getElementById('out').value=lines.join('\\n');}
pairs.forEach(p=>{const c=p.dataset.clip;p.querySelectorAll('button[data-v]').forEach(b=>b.addEventListener('click',()=>{state[c]=Object.assign({},state[c]||{},{v:b.dataset.v});save()}));
 p.querySelector('.note').addEventListener('input',e=>{state[c]=Object.assign({},state[c]||{},{note:e.target.value});save()});});
document.getElementById('copy').addEventListener('click',async()=>{const t=document.getElementById('out');t.select();try{await navigator.clipboard.writeText(t.value);document.getElementById('copy').textContent='Copied'}catch(e){document.execCommand('copy');document.getElementById('copy').textContent='Copied'}setTimeout(()=>document.getElementById('copy').textContent='Copy results',1500)});
document.getElementById('reset').addEventListener('click',()=>{if(confirm('Clear all ratings?')){state={};save()}});
document.getElementById('playall').addEventListener('click',()=>{document.querySelectorAll('video').forEach(v=>v.play().catch(()=>{}))});
const io=new IntersectionObserver(es=>es.forEach(e=>{const v=e.target;if(e.isIntersecting){v.play().catch(()=>{})}else{v.pause()}}),{threshold:.35});
document.querySelectorAll('video').forEach(v=>io.observe(v));
render();
'''

def page(items, srcs, title, note):
    cards = "\n".join(card(it, s) for it, s in zip(items, srcs))
    return f'''<title>{html.escape(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@600;700&family=Roboto:wght@300;400;500&family=Roboto+Mono&display=swap">
<style>{CSS}</style>
<div class="wrap">
  <div class="eyebrow">PEBL CIC &middot; FishSpotter &middot; SubCam colour rescue</div>
  <h1>{html.escape(title)}</h1>
  <div class="intro">
    <p>{len(items)} clips, first ten seconds of each. <strong>Original on the left, optimised on the right</strong>, same frames, same moment. Clips play as you scroll (muted, looping); use the controls to scrub.</p>
    <p>Rate each pair with the buttons, add a note if something specific stands out, then press <strong>Copy results</strong> at the bottom and paste it back to Claude. Ratings are saved in this browser as you go. {note}</p>
  </div>
  <div class="tools"><button id="playall">Play all</button><button id="reset">Clear ratings</button><span class="count" id="count"></span></div>
  {cards}
  <div class="results"><div class="row"><textarea id="out" readonly aria-label="results"></textarea><button id="copy" class="on">Copy results</button></div></div>
</div>
<script>{JS}</script>
'''

# 1. artifact page with embedded video
srcs = ["data:video/mp4;base64," + it["b64"] for it in items]
out = os.path.join(ROOT, "ab_test.html")
open(out, "w", encoding="utf-8").write(page(items, srcs, "SubCam A/B Test", "The videos here are compressed for the page; the full-resolution versions of every pair are in the colour-ab folder on the desktop."))
print("wrote", out, f"{os.path.getsize(out) / 1e6:.1f} MB")

# 2. local index.html next to the full-res files in the OneDrive folder
os.makedirs(DEST, exist_ok=True)
local_srcs = []
for it in items:
    src = os.path.join(AB, it["clip"], "ab.mp4"); name = f"AB__{it['n']:02d}__{it['clip'][:44]}.mp4"
    shutil.copy2(src, os.path.join(DEST, name)); local_srcs.append(name)
open(os.path.join(DEST, "index.html"), "w", encoding="utf-8").write(page(items, local_srcs, "SubCam A/B Test (full resolution)", "This copy plays the full-resolution files in this folder; open it in a browser from here."))
print("wrote", os.path.join(DEST, "index.html"), "with", len(local_srcs), "full-res pairs")

# 3. tidy the folder: drop the earlier site-named copies (same clips, different names) and rebuild the reel
for fn in os.listdir(DEST):
    if fn.startswith("AB__") and fn.endswith(".mp4") and fn not in local_srcs and fn != "AB__all_clips_reel.mp4":
        os.remove(os.path.join(DEST, fn))
lst = os.path.join(ROOT, "reel2.txt")
with open(lst, "w", encoding="utf-8") as f:
    for n in local_srcs: f.write("file '" + os.path.join(DEST, n).replace("\\", "/") + "'\n")
r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c:v", "libx264", "-crf", "22", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", os.path.join(DEST, "AB__all_clips_reel.mp4")], capture_output=True, text=True)
print("reel", "ok" if r.returncode == 0 else r.stderr[:200])
