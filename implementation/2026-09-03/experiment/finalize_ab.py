"""After optimise.py has run on every test clip:
  1. copy every labelled side-by-side (original | optimised) into a folder Christian can flick through,
     named by site and date, plus a single concatenated reel
  2. make small (960x270, crf 30) versions of four of them for embedding in the findings page
  3. write report_vars.json (measured speed, archive-scale minutes)
"""
import os, json, glob, shutil, subprocess, csv
ROOT = os.path.dirname(os.path.abspath(__file__))
AB = os.path.join(ROOT, "ab_out")
DEST = r"C:\Users\Christian Abulhawa\OneDrive\Desktop\Fishspotter media\colour-ab"
os.makedirs(DEST, exist_ok=True)
thumb = {r["name"][:48]: r for r in csv.DictReader(open(os.path.join(ROOT, "thumb_rank.csv")))}

def nice_name(clip):
    site = (thumb.get(clip, {}).get("site") or "unlabelled").replace(" ", "_")
    return f"{site}__{clip[:40]}"

params = []; copied = []
for d in sorted(os.listdir(AB)):
    p = os.path.join(AB, d, "params.json"); ab = os.path.join(AB, d, "ab.mp4")
    if not (os.path.isfile(p) and os.path.isfile(ab)): continue
    pr = json.load(open(p)); params.append(pr)
    dst = os.path.join(DEST, f"AB__{nice_name(d)}.mp4"); shutil.copy2(ab, dst); copied.append(dst)
print(f"copied {len(copied)} side-by-sides to {DEST}")

# one reel of all of them, in order
lst = os.path.join(ROOT, "reel.txt")
with open(lst, "w", encoding="utf-8") as f:
    for c in copied: f.write("file '" + c.replace("\\", "/").replace("'", "'\\''") + "'\n")
reel = os.path.join(DEST, "AB__all_clips_reel.mp4")
r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c:v", "libx264", "-crf", "22", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", reel], capture_output=True, text=True)
print("reel", "ok" if r.returncode == 0 else r.stderr[:300])

# small embeds for the page
for d in ["CYM_Farm_S_2026-05-27_08-00_wrassepollack0000488", "NORF-1_2026-06-13_11-01_track_manual_9473-9601_2",
          "CYM_Farm_S_2026-04-29_17-00_pollack00003975_trac", "OYS_2025-09-25_10-00-52_trackmanual_21_0-1388_20"]:
    ab = os.path.join(AB, d, "ab.mp4"); small = os.path.join(AB, d, "ab_small.mp4")
    if os.path.isfile(ab):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", ab, "-t", "8", "-vf", "scale=960:270:flags=lanczos", "-c:v", "libx264", "-crf", "30", "-preset", "slow", "-profile:v", "high", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", small], check=True)
        print("small", d[:30], os.path.getsize(small)//1024, "KB")

# measured speed and archive-scale cost
spf = [p["secs_per_frame"] for p in params]
mean_spf = sum(spf)/len(spf)
archive_frames = 46118
mins = archive_frames * mean_spf / 60
vars_ = {"MS_PER_FRAME": f"{mean_spf*1000:.0f}", "ARCHIVE_MINUTES": f"{mins:.0f}", "N_AB": len(params),
         "AB_FOLDER": DEST}
json.dump(vars_, open(os.path.join(ROOT, "report_vars.json"), "w"), indent=1)
print(vars_)
print("red classes:", {c: sum(1 for p in params if p["red_class"] == c) for c in ("dead", "weak", "usable")})
