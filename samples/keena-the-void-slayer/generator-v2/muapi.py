#!/usr/bin/env python3
"""Minimal MuAPI client for the Keena intro v2.

Uploads reference images, prices every job with MuAPI's estimate endpoint, refuses any job that would
push the ledger past BUDGET_USD (default 10), then submits, polls, downloads the video and writes a
contact sheet plus the first and last frames next to it.

    python muapi.py price <job_id>   # estimate only, no charge
    python muapi.py run <job_id>     # a job from jobs.json
    python muapi.py spent            # ledger total (actual charges once reconciled)
    python muapi.py reconcile        # record what MuAPI charged, refunds included
"""

import hashlib
import json
import mimetypes
import os
import subprocess
import sys
import time
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
OUT = Path(os.environ.get("KTVS_V2_OUT", HERE / "out"))
BASE = "https://api.muapi.ai/api/v1"
BUDGET = float(os.environ.get("BUDGET_USD", "10"))
DONE = {"completed", "succeeded", "success"}
FAILED = {"failed", "error", "canceled", "cancelled", "timeout"}
UA = {"User-Agent": "ktvs-v2/1"}


def api_key():
    key = os.environ.get("MUAPI_API_KEY", "").strip()
    for path in (Path("/workspace/.secrets/muapi_key"), Path.home() / ".muapi_key"):
        if not key and path.exists():
            key = path.read_text().strip()
    if not key:
        sys.exit("MUAPI_API_KEY is not set")
    return key


def call(url, payload=None, body=None, ctype="application/json", tries=3):
    data = body if body is not None else (json.dumps(payload).encode() if payload is not None else None)
    headers = {"x-api-key": api_key(), "Content-Type": ctype, **UA}
    for attempt in range(tries):
        try:
            with urlopen(Request(url, data=data, headers=headers), timeout=180) as resp:
                raw = resp.read() or b"{}"
            try:
                return json.loads(raw)
            except ValueError:
                sys.exit(f"non-JSON reply from {url}: {raw[:200]!r}")
        except HTTPError as err:
            detail = err.read().decode(errors="replace")[:400]
            if err.code < 500 or attempt == tries - 1:
                sys.exit(f"HTTP {err.code} from {url}: {detail}")
        except (URLError, TimeoutError) as err:
            if attempt == tries - 1:
                sys.exit(f"network error calling {url}: {err}")
        time.sleep(5 * (attempt + 1))


def pick(resp, keys):
    objs = [resp] if isinstance(resp, dict) else []
    for key in ("data", "output", "result"):
        if objs and isinstance(resp.get(key), dict):
            objs.append(resp[key])
    for obj in objs:
        for key in keys:
            if obj.get(key) not in (None, "", []):
                return obj[key]
    return None


def first_https(value):
    if isinstance(value, str):
        return value if value.startswith("https://") else None
    items = list(value.values()) if isinstance(value, dict) else value if isinstance(value, list) else []
    if isinstance(value, dict):
        items = [value.get(k) for k in ("url", "file_url", "video", "video_url", "download_url")] + items
    for item in items:
        hit = first_https(item)
        if hit:
            return hit
    return None


def ledger():
    path = OUT / "ledger.json"
    return json.loads(path.read_text()) if path.exists() else []


def paid(entry):
    """What a take actually cost: MuAPI refunds some jobs after the fact."""
    return entry.get("charged", entry["cost"])


def save(entries):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "ledger.json").write_text(json.dumps(entries, indent=1))


def resolve(path):
    path = Path(path)
    return path if path.is_absolute() else HERE / path


def upload(path):
    data = path.read_bytes()
    digest = hashlib.sha1(data).hexdigest()
    cache_file = OUT / "uploads.json"
    cache = json.loads(cache_file.read_text()) if cache_file.exists() else {}
    if digest in cache:
        return cache[digest]
    boundary = uuid.uuid4().hex
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    head = (
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{path.name}"\r\n'
        f"Content-Type: {mime}\r\n\r\n"
    )
    body = head.encode() + data + f"\r\n--{boundary}--\r\n".encode()
    url = first_https(call(f"{BASE}/upload_file", body=body, ctype=f"multipart/form-data; boundary={boundary}"))
    if not url:
        sys.exit(f"upload of {path.name} returned no URL")
    cache[digest] = url
    OUT.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(json.dumps(cache, indent=1))
    return url


def build(job_id, with_uploads=True):
    spec = json.loads((HERE / "jobs.json").read_text())
    job = next((j for j in spec["jobs"] if j["id"] == job_id), None)
    if job is None:
        sys.exit(f"no job {job_id} in jobs.json")
    params = dict(job.get("params", {}))
    if with_uploads:
        if job.get("refs"):
            params["images_list"] = [upload(resolve(p)) for p in job["refs"]]
        if job.get("first"):
            params["image_url"] = upload(resolve(job["first"]))
        if job.get("last"):
            params["last_image"] = upload(resolve(job["last"]))
    params["prompt"] = " ".join(x for x in (job["prompt"], job.get("style", spec.get("style", ""))) if x)
    price = call(f"{BASE}/models/{job['endpoint']}/estimate-cost", payload={k: v for k, v in params.items() if k != "prompt"})
    return job, params, float(price["cost"])


def review_assets(video):
    stem = str(video.with_suffix(""))
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=width,height,r_frame_rate:format=duration", "-of", "json", str(video)],
        check=False, capture_output=True, text=True,
    ).stdout
    info = json.loads(probe or "{}")
    dur = float(info.get("format", {}).get("duration", 0) or 0)
    ff = ["ffmpeg", "-v", "error", "-y"]
    subprocess.run(ff + ["-i", str(video), "-vf", f"fps=8/{max(dur, 0.1):.3f},scale=480:-2,tile=4x2",
                         "-frames:v", "1", f"{stem}-sheet.jpg"], check=False)
    subprocess.run(ff + ["-i", str(video), "-frames:v", "1", f"{stem}-first.png"], check=False)
    subprocess.run(ff + ["-sseof", "-0.1", "-i", str(video), "-update", "1", f"{stem}-last.png"], check=False)
    stream = (info.get("streams") or [{}])[0]
    return f"{stream.get('width')}x{stream.get('height')} @ {stream.get('r_frame_rate')} fps, {dur:.2f} s"


def run(job_id):
    job, params, cost = build(job_id)
    entries = ledger()
    spent = sum(paid(e) for e in entries)
    if spent + cost > BUDGET + 1e-9:
        sys.exit(f"refused {job_id}: ${cost:.2f} would take spend from ${spent:.2f} past ${BUDGET:.2f}")
    take = 1 + sum(e["job"] == job_id for e in entries)
    resp = call(f"{BASE}/{job['endpoint']}", payload=params)
    rid = pick(resp, ("request_id", "id"))
    if not rid:
        sys.exit(f"no request id in reply: {json.dumps(resp)[:300]}")
    urls = pick(resp, ("urls",))
    result = urls["get"] if isinstance(urls, dict) and urls.get("get") else f"{BASE}/predictions/{rid}/result"
    stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    entry = {"job": job_id, "take": take, "endpoint": job["endpoint"], "cost": cost, "request_id": rid,
             "status": "submitted", "submitted": stamp}
    entries.append(entry)
    save(entries)
    start = time.time()
    while True:
        time.sleep(10)
        data = call(result)
        status = str(pick(data, ("status",)) or "").lower()
        if status in DONE:
            break
        if status in FAILED or time.time() - start > 2400:
            entry.update(status=status or "timeout", error=str(pick(data, ("error", "message")) or "")[:300])
            save(entries)
            sys.exit(f"{job_id} take {take} {entry['status']}: {entry['error']}")
    url = first_https(pick(data, ("outputs", "output", "video")))
    if not url:
        sys.exit(f"{job_id} finished without a video URL: {json.dumps(data)[:300]}")
    dst = OUT / "takes" / f"{job_id}-{take}.mp4"
    dst.parent.mkdir(parents=True, exist_ok=True)
    with urlopen(Request(url, headers=UA), timeout=600) as resp, open(dst, "wb") as fh:
        fh.write(resp.read())
    secs = round(time.time() - start)
    entry.update(status="done", output=url, file=str(dst.relative_to(OUT)), seconds=secs)
    save(entries)
    print(f"{job_id} take {take}: ${cost:.2f}, total ${spent + cost:.2f} of ${BUDGET:.2f}, "
          f"{review_assets(dst)}, {secs} s -> {dst}")


def reconcile():
    entries = ledger()
    for e in entries:
        if e.get("request_id"):
            cost = call(f"{BASE}/predictions/{e['request_id']}/result").get("cost") or {}
            e["charged"] = 0.0 if cost.get("refunded") else float(cost.get("amount_usd", e["cost"]))
            print(f"{e['job']} take {e['take']}: estimate ${e['cost']:.2f}, charged ${e['charged']:.2f}")
    save(entries)
    print(f"charged ${sum(paid(e) for e in entries):.2f} of ${BUDGET:.2f}")


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "run":
        run(sys.argv[2])
    elif len(sys.argv) == 3 and sys.argv[1] == "price":
        _, _, est = build(sys.argv[2], with_uploads=False)
        print(f"{sys.argv[2]}: ${est:.2f} (spent so far ${sum(paid(e) for e in ledger()):.2f} of ${BUDGET:.2f})")
    elif len(sys.argv) == 2 and sys.argv[1] == "reconcile":
        reconcile()
    elif len(sys.argv) == 2 and sys.argv[1] == "spent":
        print(f"${sum(paid(e) for e in ledger()):.2f} of ${BUDGET:.2f}")
    else:
        sys.exit(__doc__)
