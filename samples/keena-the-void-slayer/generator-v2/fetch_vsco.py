#!/usr/bin/env python3
"""Download the VSCO 2 Community Edition samples the score uses (CC0, about 800 MB) into out/vsco.

    python fetch_vsco.py      # set VSCO_DIR to download somewhere else
"""

import json
import os
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

REPO = "sgossner/VSCO-2-CE"
DEST = Path(os.environ.get("VSCO_DIR", Path(__file__).resolve().parent / "out" / "vsco"))
FOLDERS = (
    "Strings/Violin Section/susVib/", "Strings/Violin Section/Trem/", "Strings/Violin Section/Pizz/",
    "Strings/Viola Section/susvib/", "Strings/Cello Section/susvib/", "Strings/Cello Section/trem/",
    "Strings/Cello Section/pizzT/", "Strings/Solo Contrabass/SusVib/", "Brass/F Horn/sus/", "Brass/Tenor Trombone/sus/",
    "Brass/Tuba/sus/", "Brass/Tuba/stac/", "Woodwinds/Bassoon/stac/", "Woodwinds/Clarinet/stac/", "Percussion/Timpani/",
    "Percussion/cymbal-crash1_", "Percussion/susCymb1-cresc", "Percussion/gongHit_", "Percussion/bassdrum_rub",
    "VSCO 1 Percussion/drums/bass/", "VSCO 1 Percussion/varWood/wood_click", "VSCO 1 Percussion/varWood/vibraslap",
)


def fetch(path):
    dst = DEST / path
    if dst.exists() and dst.stat().st_size > 1000:
        return dst.stat().st_size
    dst.parent.mkdir(parents=True, exist_ok=True)
    url = f"https://raw.githubusercontent.com/{REPO}/master/{urllib.parse.quote(path)}"
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=180) as resp, open(f"{dst}.part", "wb") as fh:
                fh.write(resp.read())
            os.replace(f"{dst}.part", dst)
            return dst.stat().st_size
        except OSError as err:
            if attempt == 2:
                raise SystemExit(f"could not download {path}: {err}") from err
    return 0


def main():
    url = f"https://api.github.com/repos/{REPO}/git/trees/master?recursive=1"
    with urllib.request.urlopen(url, timeout=60) as resp:
        tree = json.load(resp)["tree"]
    paths = [t["path"] for t in tree if t["path"].lower().endswith(".wav") and t["path"].startswith(FOLDERS)]
    with ThreadPoolExecutor(16) as pool:
        total = sum(pool.map(fetch, paths))
    print(f"{len(paths)} samples, {total / 1e6:.0f} MB in {DEST}")


if __name__ == "__main__":
    main()
