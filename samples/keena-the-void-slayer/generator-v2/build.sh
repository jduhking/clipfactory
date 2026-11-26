#!/usr/bin/env bash
# Rebuild the v2 sample from the original trailer and the three Veo takes in out/takes (see README): cut and
# grade the photoreal intro, render its score from VSCO 2 CE samples, replace the original's old 3D shot and
# encode out/keena-trailer-live-intro.mp4, plus out/intro-live.mp4 (the intro on its own).
#
# usage: bash build.sh [path/to/keenathevoidslayertrailer.mp4]
# env:   PYTHON    a Python with numpy, scipy and soundfile (default python3)
#        VSCO_DIR  the VSCO 2 Community Edition samples (default out/vsco, downloaded on the first run, about 800 MB)
set -euo pipefail
cd "$(dirname "$0")"

SRC="${1:-keenathevoidslayertrailer.mp4}"
PY="${PYTHON:-python3}"
OUT=out
CUT_START=270 CUT_END=392        # the original's old 3D shot, frames 270-391 (9.0-13.07 s); keep in step with assemble_audio.py

[ -f "$SRC" ] || { echo "Original trailer not found: $SRC (pass its path as the first argument)" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg is required" >&2; exit 1; }
for take in clipA-1 clipB-1 clipCD2-1; do
  [ -f "$OUT/takes/$take.mp4" ] || { echo "Missing $OUT/takes/$take.mp4: generate it with muapi.py (see README)" >&2; exit 1; }
done
export VSCO_DIR="${VSCO_DIR:-$OUT/vsco}"
[ -d "$VSCO_DIR/Strings" ] || "$PY" fetch_vsco.py

# Shots in 24 fps source frames [start, end). Each is a multiple of 4 frames (1/6 s), so every cut lands on a whole
# frame at 30 fps. A: boots to the valley reveal. B: the corrupted tree, ending on the lightning flash. CD: the
# serious stare into the goofy face as Moku floats up, ending before the light swells at 4.17 s.
A0=0 A1=152 B0=100 B1=188 C0=0 C1=100
REVEAL=3.75 GOOFY=1.71 MOKU=2.75   # seconds into clip A (reveal) and clip CD2 (goofy face, Moku's sting)

"$PY" - "$A0" "$A1" "$B0" "$B1" "$C0" "$C1" "$REVEAL" "$GOOFY" "$MOKU" > "$OUT/cues.json" <<'PY'
import json, sys
a0, a1, b0, b1, c0, c1 = map(int, sys.argv[1:7])
reveal, goofy, moku = map(float, sys.argv[7:10])
cut_b = (a1 - a0) / 24
cut_c = cut_b + (b1 - b0) / 24
cues = {"reveal": reveal, "cut_b": cut_b, "cut_c": cut_c, "goofy": cut_c + goofy - c0 / 24,
        "moku": cut_c + moku - c0 / 24, "end": cut_c + (c1 - c0) / 24}
print(json.dumps({k: round(v, 4) for k, v in cues.items()}, indent=1))
PY

echo "Cutting and grading the intro..."
# Veo tags its takes with the BT.601 matrix and the trailer is BT.709, so convert while scaling to 1080p.
GRADE="fps=30,scale=1920:1080:flags=lanczos:in_color_matrix=bt601:out_color_matrix=bt709,\
setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709,eq=contrast=1.06:saturation=1.03:brightness=0.02,\
colorbalance=rs=-0.02:bs=0.03:rh=0.03:bh=-0.02,noise=c0s=5:c0f=t+u,vignette=PI/10,fade=t=in:st=0:d=0.4,\
format=yuv420p,setsar=1"
ffmpeg -hide_banner -loglevel error -y -i "$OUT/takes/clipA-1.mp4" -i "$OUT/takes/clipB-1.mp4" -i "$OUT/takes/clipCD2-1.mp4" \
  -filter_complex "[0:v]trim=start_frame=$A0:end_frame=$A1,setpts=PTS-STARTPTS[a];\
[1:v]trim=start_frame=$B0:end_frame=$B1,setpts=PTS-STARTPTS[b];\
[2:v]trim=start_frame=$C0:end_frame=$C1,setpts=PTS-STARTPTS[c];\
[a][b][c]concat=n=3:v=1:a=0,$GRADE[v]" -map "[v]" -an -c:v libx264 -preset slow -crf 12 -colorspace bt709 -color_primaries bt709 -color_trc bt709 "$OUT/intro_live.mkv"

echo "Scoring the intro and editing the trailer's sound..."
"$PY" score.py
ffmpeg -hide_banner -loglevel error -y -i "$SRC" -vn -ac 2 -ar 48000 -c:a pcm_f32le "$OUT/trailer_audio.wav"
"$PY" assemble_audio.py

echo "Encoding..."
GRAPH="[0:v]format=yuv420p,setsar=1[iv];\
[1:v]trim=start_frame=0:end_frame=$CUT_START,setpts=PTS-STARTPTS,format=yuv420p,setsar=1[a];\
[1:v]trim=start_frame=$CUT_END,setpts=PTS-STARTPTS,format=yuv420p,setsar=1[b];\
[iv][a][b]concat=n=3:v=1:a=0[v]"
X264=(-c:v libx264 -preset slow -b:v 4600k -pix_fmt yuv420p -r 30 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -passlogfile "$OUT/x264")
ffmpeg -hide_banner -loglevel error -y -i "$OUT/intro_live.mkv" -i "$SRC" \
  -filter_complex "$GRAPH" -map "[v]" "${X264[@]}" -pass 1 -an -f null /dev/null
ffmpeg -hide_banner -loglevel error -y -i "$OUT/intro_live.mkv" -i "$SRC" -i "$OUT/final_audio.wav" \
  -filter_complex "$GRAPH" -map "[v]" -map 2:a "${X264[@]}" -pass 2 -c:a aac -b:a 192k -movflags +faststart \
  "$OUT/keena-trailer-live-intro.mp4"
ffmpeg -hide_banner -loglevel error -y -i "$OUT/intro_live.mkv" -i "$OUT/intro_solo_audio.wav" \
  -vf "tpad=stop_mode=clone:stop_duration=1,format=yuv420p" -c:v libx264 -preset slow -crf 18 -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT/intro-live.mp4"
echo "Done: $OUT/keena-trailer-live-intro.mp4 and $OUT/intro-live.mp4"
