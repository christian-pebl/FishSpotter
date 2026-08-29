"""
Fetch the PDF-mode sources as BYTES and extract their text.

Split out from prefetch-sources.ts because a PDF cannot travel through
`fetch().text()`: that decodes the body as UTF-8 and every byte above 0x7f
comes back mangled, so the file opens (the header survives) and then reports
zero pages. The failure is quiet in exactly the way that matters, which is why
extraction is proved here by asserting a page count and real characters rather
than by the download returning 200.

  python scripts/refs/fetch_pdf_sources.py [--force] [--only <sourceId>]
"""

from __future__ import annotations

import json
import os
import re
import sys
import time

import fitz  # PyMuPDF
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REFS = os.path.join(ROOT, "src", "data", "species-references.json")
RAW = os.path.join(ROOT, ".refs-cache", "raw")
TEXT = os.path.join(ROOT, ".refs-cache", "text")
INDEX = os.path.join(ROOT, ".refs-cache", "index.json")

UA = (
    "Mozilla/5.0 (compatible; FishSpotter-reference-checker/1.0; "
    "+https://fish-spotter.vercel.app; contact hello@pebl-cic.co.uk)"
)


def safe_name(source_id: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "_", source_id)


def fetch_bytes(url: str, timeout: int = 90) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/pdf,*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def main() -> int:
    force = "--force" in sys.argv
    only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None

    with open(REFS, encoding="utf-8") as fh:
        refs = json.load(fh)
    index = {}
    if os.path.exists(INDEX):
        with open(INDEX, encoding="utf-8") as fh:
            index = json.load(fh)

    os.makedirs(RAW, exist_ok=True)
    os.makedirs(TEXT, exist_ok=True)

    targets = [
        (sid, s)
        for sid, s in refs["sources"].items()
        if s.get("url") and (s.get("verifyMode") == "pdf" or index.get(sid, {}).get("status") == "pdf")
        and (only is None or sid == only)
    ]
    print(f"{len(targets)} PDF sources")

    ok = failed = 0
    for i, (sid, s) in enumerate(targets, 1):
        name = safe_name(sid)
        pdf_path = os.path.join(RAW, f"{name}.pdf")
        txt_path = os.path.join(TEXT, f"{name}.txt")
        if not force and os.path.exists(txt_path) and os.path.getsize(txt_path) > 2000:
            print(f"  [{i}/{len(targets)}] cached  {sid}")
            ok += 1
            continue
        try:
            blob = fetch_bytes(s["url"])
        except Exception as exc:  # noqa: BLE001 - report and carry on
            print(f"  [{i}/{len(targets)}] FETCH-FAIL {sid}: {str(exc)[:70]}")
            index[sid] = {"id": sid, "kind": s["kind"], "url": s["url"], "title": s["title"],
                          "status": "failed", "error": str(exc)[:200]}
            failed += 1
            continue
        with open(pdf_path, "wb") as fh:
            fh.write(blob)
        try:
            doc = fitz.open(pdf_path)
            pages = doc.page_count
            # Page markers stay in the text: every PDF citation in this project
            # is located by page, so a locator like "p. 62" has to be findable.
            body = "\n".join(f"\n--- page {n + 1} ---\n{doc[n].get_text()}" for n in range(pages))
            doc.close()
        except Exception as exc:  # noqa: BLE001
            print(f"  [{i}/{len(targets)}] PARSE-FAIL {sid}: {str(exc)[:70]}")
            index[sid] = {"id": sid, "kind": s["kind"], "url": s["url"], "title": s["title"],
                          "status": "failed", "error": f"parse: {str(exc)[:180]}"}
            failed += 1
            continue
        if len(body.strip()) < 200:
            print(f"  [{i}/{len(targets)}] NO-TEXT {sid} ({pages}pp, scanned?)")
            index[sid] = {"id": sid, "kind": s["kind"], "url": s["url"], "title": s["title"],
                          "status": "failed", "error": f"no extractable text ({pages}pp)"}
            failed += 1
            continue
        header = f"SOURCE: {sid}\nTITLE: {s['title']}\nURL: {s['url']}\nPAGES: {pages}\n\n"
        with open(txt_path, "w", encoding="utf-8") as fh:
            fh.write(header + body)
        index[sid] = {"id": sid, "kind": s["kind"], "url": s["url"], "title": s["title"],
                      "status": "ok", "bytes": len(body), "file": f"{name}.txt", "pages": pages}
        print(f"  [{i}/{len(targets)}] ok {len(body):>8} ({pages}pp)  {sid}")
        ok += 1
        time.sleep(0.6)

    with open(INDEX, "w", encoding="utf-8") as fh:
        json.dump(index, fh, indent=2)
    print(f"\nextracted {ok}, failed {failed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
