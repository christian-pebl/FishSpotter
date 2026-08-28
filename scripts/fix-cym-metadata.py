"""
One-off repair of the Cwr-y-Mor (CYM) snip metadata at source, Aug 2026.

Two defects, both in TRDesk4's exported metadata.json:

1. Farm and control are indistinguishable. Every CYM snip declares
   deployment "Ramsey Sound", whether it came from the farm array or the
   control site. Snippet.deployment is the join key to the farm catalogue and
   the only thing separating the two sites in the app, so as exported the
   farm-versus-control comparison cannot be made at all. Split into
   "Ramsey Sound Farm" and "Ramsey Sound Control" off the folder prefix.

2. Eleven snips have recording_datetime: null. They are exactly the ones whose
   name uses an underscore after the year (CYM_Control_S_2026_05-11) rather
   than a hyphen (CYM_Farm_S_2026-05-10); the exporter's date parser only
   handles the hyphen form. The timestamp is recoverable from the name, and
   the raw .mov files on Drive use the same two spellings, so this is a
   parser bug rather than lost data.

Recording time is written as full ISO (date plus hour from the filename)
across the whole batch, so one deployment does not carry two date formats.

Backs up every file it touches before writing. Dry run is the default.

    python scripts/fix-cym-metadata.py            # preview
    python scripts/fix-cym-metadata.py --apply
"""

import json
import os
import re
import shutil
import sys
from datetime import datetime

SNIPS_DIR = os.environ.get(
    "SNIPS_DIR",
    r"G:\.shortcut-targets-by-id\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl"
    r"\Ocean\08 - Data\01 - SubCam data\Fish Spotter Snips",
)
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

APPLY = "--apply" in sys.argv

SITE = "Ramsey Sound, Pembrokeshire, Wales, UK"
DEPLOYMENT = {"Farm": "Ramsey Sound Farm", "Control": "Ramsey Sound Control"}

# CYM_Farm_S_2026-05-10_17-00_...  and  CYM_Control_S_2026_05-11_17-00_...
NAME_RE = re.compile(r"^CYM_(Farm|Control)_S_(\d{4})[-_](\d{2})-(\d{2})_(\d{2})-(\d{2})_")

# NORF-1_2026-06-18_08-01_...
# The same class of defect, one deployment along: these twelve exported with no
# deployment record at all, so site / deployment / depth / lat / lon / datetime
# were every one of them empty. The DB rows were backfilled by hand on 28 Aug,
# but the source is still wrong, so a re-export would silently blank them
# again. Repairing the source is what makes that patch stick. Geographic values
# are copied from the one correctly-exported Blakeney snip,
# NORF_2025-10-02_09-00-47.
NORF_RE = re.compile(r"^NORF-1_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})_")
NORF_FIELDS = {
    "site": "Blakeney Overfalls, Norfolk, UK",
    "deployment": "Blakeney Overfalls",
    "depth_m": 20,
    "latitude": 53.02916666666667,
    "longitude": 0.9758333333333333,
}


def parse(folder):
    """-> (fields, iso_datetime) or None if the folder name is not a known shape."""
    m = NAME_RE.match(folder)
    if m:
        side, year, month, day, hour, minute = m.groups()
        fields = {"site": SITE, "deployment": DEPLOYMENT[side]}
    else:
        m = NORF_RE.match(folder)
        if not m:
            return None
        year, month, day, hour, minute = m.groups()
        fields = dict(NORF_FIELDS)
    try:
        dt = datetime(int(year), int(month), int(day), int(hour), int(minute))
    except ValueError:
        return None  # a nonsense date is a hold, not something to guess at
    return fields, dt.strftime("%Y-%m-%dT%H:%M:%S")


def main():
    if not os.path.isdir(SNIPS_DIR):
        print(f"SNIPS_DIR not found: {SNIPS_DIR}")
        return 2

    stamp = datetime.now().strftime("%Y-%m-%d_%H%M")
    backup_dir = os.path.join(REPO, "backups", f"cym-metadata-{stamp}")

    folders = sorted(
        d for d in os.listdir(SNIPS_DIR)
        if (d.startswith("CYM_") or d.startswith("NORF-1_"))
        and os.path.isdir(os.path.join(SNIPS_DIR, d))
    )
    print(f"{len(folders)} CYM / NORF-1 folder(s) in {SNIPS_DIR}\n")

    changed = skipped = 0
    counts = {}
    for folder in folders:
        meta_path = os.path.join(SNIPS_DIR, folder, "metadata.json")
        if not os.path.exists(meta_path):
            print(f"SKIP  {folder[:70]}  (no metadata.json)")
            skipped += 1
            continue

        parsed = parse(folder)
        if not parsed:
            print(f"SKIP  {folder[:70]}  (name does not parse)")
            skipped += 1
            continue
        fields, iso = parsed

        with open(meta_path, encoding="utf-8") as fh:
            meta = json.load(fh)

        edits = []
        for key, value in fields.items():
            if meta.get(key) != value:
                edits.append(f"{key} {meta.get(key)!r} -> {value!r}")
                meta[key] = value
        if meta.get("recording_datetime") != iso:
            edits.append(f"recording_datetime {meta.get('recording_datetime')!r} -> {iso!r}")
            meta["recording_datetime"] = iso

        if not edits:
            skipped += 1
            continue

        if APPLY:
            os.makedirs(backup_dir, exist_ok=True)
            shutil.copy2(meta_path, os.path.join(backup_dir, f"{folder}.metadata.json"))
            with open(meta_path, "w", encoding="utf-8") as fh:
                json.dump(meta, fh, indent=2)
                fh.write("\n")

        print(f"{'PATCH' if APPLY else 'DRY  '} {folder[:66]}")
        for e in edits:
            print(f"        {e}")
        dep = fields["deployment"]
        counts[dep] = counts.get(dep, 0) + 1
        changed += 1

    print(f"\n{'Patched' if APPLY else 'Would patch'} {changed}, unchanged {skipped}.")
    for k, v in sorted(counts.items()):
        print(f"   {v:3d}  {k}")
    if APPLY and changed:
        print(f"\nBackups: {backup_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
