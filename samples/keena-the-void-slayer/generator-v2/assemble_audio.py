#!/usr/bin/env python3
"""Final soundtrack: the v2 intro score, then the trailer with its old 3D shot (9.0-13.0667 s) removed.

Reads out/intro_score.wav, out/trailer_audio.wav and out/cues.json. Writes out/final_audio.wav and
out/intro_solo_audio.wav (the intro on its own with a one-second tail).
"""

import json
from pathlib import Path

import numpy as np
import soundfile as sf

OUT = Path(__file__).resolve().parent / "out"
SR = 48000
CUT_A, CUT_B = 9.0, 392 / 30  # trailer frames 270-391; keep in step with build.sh
XF = 0.04  # equal-power crossfade at the cut

intro, sr1 = sf.read(OUT / "intro_score.wav", always_2d=True)
trailer, sr2 = sf.read(OUT / "trailer_audio.wav", always_2d=True)
assert sr1 == SR and sr2 == SR
pic = round(json.loads((OUT / "cues.json").read_text())["end"] * SR)

# the trailer, with a crossfade centred on the cut so its length matches the picture edit
a, b, h = int(CUT_A * SR), int(CUT_B * SR), int(XF / 2 * SR)
ramp = np.linspace(0, 1, 2 * h)[:, None]
joint = trailer[a - h: a + h] * np.cos(ramp * np.pi / 2) + trailer[b - h: b + h] * np.sin(ramp * np.pi / 2)
edited = np.concatenate([trailer[: a - h], joint, trailer[b + h:]])
edited[: int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))[:, None]  # no click at the trailer start

# the intro under its picture, then its last chord ducked under the trailer opening
out = np.zeros((pic + len(edited), 2))
out[:pic] = intro[:pic]
tail = intro[pic:].copy()
tail *= (0.7 * np.clip(1 - np.arange(len(tail)) / SR / 1.2, 0, 1) ** 2)[:, None]
out[pic:] += edited
out[pic: pic + len(tail)] += tail
seg = out[pic: pic + len(tail)]
if np.abs(seg).max() > 0.97:
    out[pic: pic + len(tail)] = np.tanh(seg / 0.97) * 0.97
sf.write(OUT / "final_audio.wav", out.astype(np.float32), SR, subtype="FLOAT")

solo = intro[: pic + SR].copy()
solo[pic:] *= np.linspace(1, 0, len(solo) - pic)[:, None] ** 2
sf.write(OUT / "intro_solo_audio.wav", solo.astype(np.float32), SR, subtype="FLOAT")
print(f"final {len(out) / SR:.3f} s, trailer edited {len(edited) / SR:.3f} s, peak {np.abs(out).max():.3f}")
