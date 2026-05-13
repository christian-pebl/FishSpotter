"""
Extracts species observations from PEBL's processed SubCam CSVs and matches
each Fish Spotter clip to the most likely species ID based on video name +
clip frame range overlap with observation timestamps.

Outputs:
  - data/species-master.json : unique species/taxa across all observations
  - data/clip-matches.json   : per-clip best-match species (or candidates)
"""

import csv, json, os, re, sys
from pathlib import Path
from collections import defaultdict

DRIVE_ROOT = Path(r"G:\.shortcut-targets-by-id\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\Ocean\08 - Data\01 - SubCam data")
SNIPS_DIR = DRIVE_ROOT / "Fish Spotter Snips"
PROCESSED_DIR = DRIVE_ROOT / "Alga" / "Processed_SUBCAM2"
OUT_DIR = Path(__file__).resolve().parent.parent / "data"
OUT_DIR.mkdir(exist_ok=True)

# ---------- 1. Collect observations from all _raw.csv files ----------

def parse_timestamp(ts):
    """Parse 'H:MM:SS' or 'HH:MM:SS' to seconds. Returns None if invalid."""
    if not ts: return None
    parts = ts.strip().split(":")
    try:
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
    except ValueError:
        return None
    return None

observations = []  # {video, t_sec, common_name, sci, genus, family, order, confidence, notes}
species_set = defaultdict(lambda: {
    "common_names": set(), "genera": set(), "families": set(), "orders": set(),
    "scientific_names": set(), "occurrence_count": 0
})

raw_csvs = list(PROCESSED_DIR.rglob("*_raw*.csv"))
print(f"Found {len(raw_csvs)} raw CSV files", file=sys.stderr)

for csv_path in raw_csvs:
    try:
        with open(csv_path, encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                video = (row.get("File Name") or "").strip()
                if not video: continue
                video_stem = re.sub(r"\.mp4$", "", video, flags=re.I)
                t = parse_timestamp(row.get("Timestamps (HH:MM:SS)") or "")
                common = (row.get("Common Name") or "").strip()
                sci = (row.get("Lowest Order Scientific Name") or row.get("Species") or "").strip()
                genus = (row.get("Genus") or "").strip()
                family = (row.get("Family") or "").strip()
                order = (row.get("Order") or "").strip()
                conf = row.get("Confidence Level (1-5)") or ""
                notes = (row.get("Notes") or "").strip()
                qty = row.get("Quantity (Nmax)") or ""

                if not common and not sci:
                    continue

                obs = {
                    "video": video_stem, "t_sec": t,
                    "common_name": common, "scientific_name": sci,
                    "genus": genus, "family": family, "order": order,
                    "confidence": conf, "notes": notes, "quantity": qty,
                    "source_file": csv_path.name,
                }
                observations.append(obs)

                key = sci.lower() if sci else f"_common:{common.lower()}"
                rec = species_set[key]
                if common: rec["common_names"].add(common)
                if sci: rec["scientific_names"].add(sci)
                if genus: rec["genera"].add(genus)
                if family: rec["families"].add(family)
                if order: rec["orders"].add(order)
                rec["occurrence_count"] += 1
    except Exception as e:
        print(f"  Error reading {csv_path.name}: {e}", file=sys.stderr)

print(f"Total observations: {len(observations)}", file=sys.stderr)
print(f"Unique species/taxa: {len(species_set)}", file=sys.stderr)

# ---------- 2. Load clip metadata + match to observations ----------

clip_matches = []

for clip_dir in sorted(SNIPS_DIR.iterdir()):
    meta_path = clip_dir / "metadata.json"
    if not meta_path.exists(): continue

    with open(meta_path, encoding="utf-8") as f:
        meta = json.load(f)

    video_name = meta.get("video_name") or ""
    fps = meta.get("fps") or 0
    mark_start = meta.get("mark_start_frame")
    mark_end = meta.get("mark_end_frame")
    fg = meta.get("functional_group") or ""

    if not fps or mark_start is None or mark_end is None:
        clip_matches.append({"clip": clip_dir.name, "match": None, "reason": "missing fps/frames"})
        continue

    t_start = mark_start / fps
    t_end = mark_end / fps

    # Find observations on this video within the clip's time range (with ±5s slack)
    candidates = []
    for obs in observations:
        if obs["video"] != video_name: continue
        if obs["t_sec"] is None: continue
        if t_start - 5 <= obs["t_sec"] <= t_end + 5:
            candidates.append(obs)

    clip_matches.append({
        "clip": clip_dir.name,
        "video": video_name,
        "functional_group": fg,
        "t_start_sec": round(t_start, 1),
        "t_end_sec": round(t_end, 1),
        "match_count": len(candidates),
        "candidates": [
            {
                "t": c["t_sec"], "common": c["common_name"], "sci": c["scientific_name"],
                "genus": c["genus"], "family": c["family"], "qty": c["quantity"],
                "conf": c["confidence"], "notes": c["notes"][:80]
            } for c in candidates
        ],
    })

# ---------- 3. Build species master ----------

species_master = []
for key, rec in species_set.items():
    species_master.append({
        "key": key,
        "common_names": sorted(rec["common_names"]),
        "scientific_names": sorted(rec["scientific_names"]),
        "genera": sorted(rec["genera"]),
        "families": sorted(rec["families"]),
        "orders": sorted(rec["orders"]),
        "occurrence_count": rec["occurrence_count"],
    })
species_master.sort(key=lambda x: -x["occurrence_count"])

# ---------- 4. Write outputs ----------

with open(OUT_DIR / "species-master.json", "w", encoding="utf-8") as f:
    json.dump(species_master, f, indent=2, ensure_ascii=False)

with open(OUT_DIR / "clip-matches.json", "w", encoding="utf-8") as f:
    json.dump(clip_matches, f, indent=2, ensure_ascii=False)

print(f"\nWrote {OUT_DIR / 'species-master.json'}", file=sys.stderr)
print(f"Wrote {OUT_DIR / 'clip-matches.json'}", file=sys.stderr)

# Summary
matched = sum(1 for c in clip_matches if c.get("match_count", 0) > 0)
print(f"\nClips with at least one candidate match: {matched} / {len(clip_matches)}", file=sys.stderr)
print(f"\nTop 15 species by occurrence:", file=sys.stderr)
for s in species_master[:15]:
    common = s["common_names"][0] if s["common_names"] else "(no common name)"
    sci = s["scientific_names"][0] if s["scientific_names"] else "(no sci)"
    print(f"  {s['occurrence_count']:4d}  {common:30s}  {sci}", file=sys.stderr)
