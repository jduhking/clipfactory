#!/usr/bin/env bash
# Rebuild the low-poly sample: render the pixel-art 3D intro (scene/, Three.js in headless Chromium, 320x180 at
# 30 fps), score it with the v2 orchestral score (same cues), blow every pixel up to an exact 6x6 block, replace
# the original's old 3D shot and encode out/keena-trailer-lowpoly-intro.mp4, plus out/intro-lowpoly.mp4 (the intro
# on its own). Free: no paid services.
#
# usage: bash build.sh [path/to/keenathevoidslayertrailer.mp4]
# env:   PYTHON     a Python with numpy, scipy and soundfile (default python3)
#        VSCO_DIR   the VSCO 2 Community Edition samples (default ../generator-v2/out/vsco, downloaded on the first
#                   run, about 800 MB)
#        KTVS_PORT  a free local port to serve the scene on (default 8393)
set -euo pipefail
cd "$(dirname "$0")"

SRC="${1:-keenathevoidslayertrailer.mp4}"
PY="${PYTHON:-python3}"
OUT=out
V2=../generator-v2
export KTVS_PORT="${KTVS_PORT:-8393}"
CUT_START=270 CUT_END=392        # the original's old 3D shot, frames 270-391 (9.0-13.07 s); keep in step with assemble_audio.py

[ -f "$SRC" ] || { echo "Original trailer not found: $SRC (pass its path as the first argument)" >&2; exit 1; }
for tool in ffmpeg node npx; do
  command -v "$tool" >/dev/null || { echo "$tool is required" >&2; exit 1; }
done
mkdir -p "$OUT"
[ -d node_modules/three ] || npm ci
npx playwright install chromium >/dev/null

echo "Rendering the intro..."
"$PY" -m http.server "$KTVS_PORT" --bind 127.0.0.1 >"$OUT/server.log" 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT
sleep 1
kill -0 "$SERVER" 2>/dev/null || { echo "Could not serve the scene on port $KTVS_PORT (set KTVS_PORT to a free port)" >&2; exit 1; }
rm -rf "$OUT/frames"
node render.mjs "$OUT/frames"   # 425 frames, 0000.png-0424.png

# The cue times scene/main.js animates to; the score hits the same moments.
cat > "$OUT/cues.json" <<'JSON'
{
 "reveal": 3.75,
 "cut_b": 6.3333,
 "cut_c": 10.0,
 "goofy": 11.71,
 "moku": 12.75,
 "end": 14.1667
}
JSON

echo "Scoring the intro and editing the trailer's sound..."
export VSCO_DIR="${VSCO_DIR:-$V2/out/vsco}"
[ -d "$VSCO_DIR/Strings" ] || "$PY" "$V2/fetch_vsco.py"
export KTVS_OUT="$PWD/$OUT"
"$PY" "$V2/score.py"
ffmpeg -hide_banner -loglevel error -y -i "$SRC" -vn -ac 2 -ar 48000 -c:a pcm_f32le "$OUT/trailer_audio.wav"
"$PY" "$V2/assemble_audio.py"

echo "Encoding..."
# Nearest-neighbour 6x scale: each rendered pixel becomes one sharp 6x6 block, like the game's own pixel art.
PIX="scale=1920:1080:flags=neighbor:out_color_matrix=bt709:out_range=tv,format=yuv420p,setsar=1"
ffmpeg -hide_banner -loglevel error -y -framerate 30 -i "$OUT/frames/%04d.png" -vf "$PIX" \
  -c:v libx264 -preset slow -crf 6 -colorspace bt709 -color_primaries bt709 -color_trc bt709 "$OUT/intro_lowpoly.mkv"

GRAPH="[0:v]format=yuv420p,setsar=1[iv];\
[1:v]trim=start_frame=0:end_frame=$CUT_START,setpts=PTS-STARTPTS,format=yuv420p,setsar=1[a];\
[1:v]trim=start_frame=$CUT_END,setpts=PTS-STARTPTS,format=yuv420p,setsar=1[b];\
[iv][a][b]concat=n=3:v=1:a=0[v]"
X264=(-c:v libx264 -preset slow -b:v 4200k -pix_fmt yuv420p -r 30 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -passlogfile "$OUT/x264")
ffmpeg -hide_banner -loglevel error -y -i "$OUT/intro_lowpoly.mkv" -i "$SRC" \
  -filter_complex "$GRAPH" -map "[v]" "${X264[@]}" -pass 1 -an -f null /dev/null
ffmpeg -hide_banner -loglevel error -y -i "$OUT/intro_lowpoly.mkv" -i "$SRC" -i "$OUT/final_audio.wav" \
  -filter_complex "$GRAPH" -map "[v]" -map 2:a "${X264[@]}" -pass 2 -c:a aac -b:a 192k -movflags +faststart \
  "$OUT/keena-trailer-lowpoly-intro.mp4"
ffmpeg -hide_banner -loglevel error -y -i "$OUT/intro_lowpoly.mkv" -i "$OUT/intro_solo_audio.wav" \
  -vf "tpad=stop_mode=clone:stop_duration=1,format=yuv420p" -c:v libx264 -preset slow -crf 14 -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT/intro-lowpoly.mp4"
echo "Done: $OUT/keena-trailer-lowpoly-intro.mp4 and $OUT/intro-lowpoly.mp4"
