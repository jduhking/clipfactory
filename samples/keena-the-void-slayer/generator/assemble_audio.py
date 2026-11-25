"""Build the final soundtrack: 3D intro bed, then the trailer with its old 3D shot (9.0-13.0667 s) removed."""
import os
from pathlib import Path

import numpy as np
import soundfile as sf

OUT = Path(os.environ.get('KTVS_OUT', Path(__file__).resolve().parent / 'out'))
SR = 48000
INTRO_PIC = 15.5
CUT_A, CUT_B = 9.0, 392 / 30  # remove trailer frames 270..391 (exactly 8 beats at ~118 BPM)
XF = 0.04  # equal-power crossfade at the cut

intro, sr1 = sf.read(OUT / 'intro_audio.wav')
trailer, sr2 = sf.read(OUT / 'trailer_audio.wav')
assert sr1 == SR and sr2 == SR

# --- trailer edit with a crossfade centred on the cut, keeping the duration equal to the picture edit
a, b, h = int(CUT_A * SR), int(CUT_B * SR), int(XF / 2 * SR)
ramp = np.linspace(0, 1, 2 * h)[:, None]
fade_out, fade_in = np.cos(ramp * np.pi / 2), np.sin(ramp * np.pi / 2)
joint = trailer[a - h:a + h] * fade_out + trailer[b - h:b + h] * fade_in
edited = np.concatenate([trailer[:a - h], joint, trailer[b + h:]])
edited[: int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))[:, None]  # no click at the trailer start

# --- intro: picture part, plus its hit tail ducked under the trailer opening
i_pic = int(INTRO_PIC * SR)
out = np.zeros((i_pic + len(edited), 2))
out[:i_pic] = intro[:i_pic]
tail = intro[i_pic:].copy()
tt = np.arange(len(tail)) / SR
tail *= (0.7 * np.clip(1 - tt / 1.2, 0, 1) ** 2)[:, None]
out[i_pic:] += edited
out[i_pic:i_pic + len(tail)] += tail
# keep the overlap under full scale without touching the rest of the trailer master
seg = out[i_pic:i_pic + len(tail)]
pk = np.abs(seg).max()
if pk > 0.97:
    out[i_pic:i_pic + len(tail)] = np.tanh(seg / 0.97) * 0.97
sf.write(OUT / 'final_audio.wav', out.astype(np.float32), SR, subtype='FLOAT')

# intro on its own (for clipping tests): picture length with a short fade on the tail
solo = intro[: i_pic + int(1.0 * SR)].copy()
solo[i_pic:] *= np.linspace(1, 0, len(solo) - i_pic)[:, None] ** 2
sf.write(OUT / 'intro_solo_audio.wav', solo.astype(np.float32), SR, subtype='FLOAT')
print('final', out.shape[0] / SR, 's  trailer edited', len(edited) / SR, 's  peak', np.abs(out).max().round(3))
