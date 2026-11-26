#!/usr/bin/env bash
# Rebuild the sample from the original trailer: render the 3D intro, make its music, remove the original's old
# 3D shot and encode the result to $KTVS_OUT/keena-trailer-3d-intro.mp4 (plus intro-3d.mp4, the intro on its own).
#
# usage: bash build.sh [path/to/keenathevoidslayertrailer.mp4]
# env:   WORKERS   parallel renderers (default 3)
#        PORT      local static server port (default 8391)
#        KTVS_OUT  work and output folder (default out)
#        PYTHON    a Python with numpy, scipy and soundfile (default: uv if installed, otherwise python3)
set -euo pipefail
cd "$(dirname "$0")"

SRC="${1:-keenathevoidslayertrailer.mp4}"
OUT="${KTVS_OUT:-out}"
PORT="${PORT:-8391}"
WORKERS="${WORKERS:-3}"
FRAMES=465                       # the intro: 15.5 s at 30 fps
CUT_START=270 CUT_END=392        # the original's old 3D shot, frames 270-391 (9.0-13.07 s); keep in step with assemble_audio.py

[ -f "$SRC" ] || { echo "Original trailer not found: $SRC (pass its path as the first argument)" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg is required" >&2; exit 1; }
if [ -n "${PYTHON:-}" ]; then PY=("$PYTHON")
elif command -v uv >/dev/null; then PY=(uv run --quiet --no-project --with numpy --with scipy --with soundfile python)
else PY=(python3); fi
export KTVS_OUT="$OUT"

[ -d node_modules ] || npm ci
npx playwright install chromium

mkdir -p "$OUT/frames"
python3 -m http.server "$PORT" --bind 127.0.0.1 >"$OUT/server.log" 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT
sleep 1

echo "Rendering $FRAMES frames with $WORKERS workers (about 13 minutes on 8 CPU cores)..."
per=$(( (FRAMES + WORKERS - 1) / WORKERS ))
pids=()
for (( i = 0; i < WORKERS; i++ )); do
  f0=$(( i * per )); f1=$(( f0 + per - 1 ))
  (( f1 > FRAMES - 1 )) && f1=$(( FRAMES - 1 ))
  PORT="$PORT" node render-frames.mjs "$f0" "$f1" "$OUT/frames" >"$OUT/render_$i.log" 2>&1 &
  pids+=("$!")
done
failed=0
for p in "${pids[@]}"; do wait "$p" || failed=1; done
n=$(find "$OUT/frames/" -name '*.png' | wc -l)
if [ "$failed" -ne 0 ] || [ "$n" -lt "$FRAMES" ]; then
  echo "Only $n of $FRAMES frames rendered. See $OUT/render_*.log, then run this again to resume." >&2
  exit 1
fi

echo "Making the music and editing the trailer's sound..."
"${PY[@]}" audio_intro.py
ffmpeg -hide_banner -loglevel error -y -i "$SRC" -vn -ac 2 -ar 48000 -c:a pcm_f32le "$OUT/trailer_audio.wav"
"${PY[@]}" assemble_audio.py

echo "Encoding..."
GRAPH="[0:v]format=yuv420p,setsar=1[iv];\
[1:v]trim=start_frame=0:end_frame=$CUT_START,setpts=PTS-STARTPTS,format=yuv420p,setsar=1[a];\
[1:v]trim=start_frame=$CUT_END,setpts=PTS-STARTPTS,format=yuv420p,setsar=1[b];\
[iv][a][b]concat=n=3:v=1:a=0[v]"
X264=(-c:v libx264 -preset slow -b:v 4600k -pix_fmt yuv420p -r 30 -passlogfile "$OUT/x264")
ffmpeg -hide_banner -loglevel error -y -framerate 30 -i "$OUT/frames/%04d.png" -i "$SRC" \
  -filter_complex "$GRAPH" -map "[v]" "${X264[@]}" -pass 1 -an -f null /dev/null
ffmpeg -hide_banner -loglevel error -y -framerate 30 -i "$OUT/frames/%04d.png" -i "$SRC" -i "$OUT/final_audio.wav" \
  -filter_complex "$GRAPH" -map "[v]" -map 2:a "${X264[@]}" -pass 2 -c:a aac -b:a 192k -movflags +faststart \
  "$OUT/keena-trailer-3d-intro.mp4"
ffmpeg -hide_banner -loglevel error -y -framerate 30 -i "$OUT/frames/%04d.png" -i "$OUT/intro_solo_audio.wav" \
  -vf "tpad=stop_mode=clone:stop_duration=1,format=yuv420p" -c:v libx264 -preset slow -crf 18 \
  -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT/intro-3d.mp4"
echo "Done: $OUT/keena-trailer-3d-intro.mp4 and $OUT/intro-3d.mp4"
