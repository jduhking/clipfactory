"""Synthesise the sound bed for the 3D cold open (15.5 s picture + 2.5 s tail).

Beats follow the picture:
  0-6.6 s   pastoral: wind, warm major pad swelling as the camera rises past Keena
  6.6-9.6   darkening: pad turns minor, sub drone and void whispers creep in
  9.6, 12.9 void flashes: boom + braam hits
  10.4-12.2 Keena's aura flares: bell arpeggio
  12.9-15.1 riser into a final hit on the fade to black; tail rings into the trailer
"""
import os
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, sosfilt

OUT = Path(os.environ.get('KTVS_OUT', Path(__file__).resolve().parent / 'out'))
SR = 48000
PIC = 15.5
TAIL = 2.5
N = int((PIC + TAIL) * SR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)


def smooth(a, b, x):
    y = np.clip((x - a) / (b - a), 0, 1)
    return y * y * (3 - 2 * y)


def lp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'low', fs=SR, output='sos'), x)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'high', fs=SR, output='sos'), x)


def bp(x, f1, f2, order=2):
    return sosfilt(butter(order, [f1, f2], 'band', fs=SR, output='sos'), x)


def pan(x, p):
    """p in [-1, 1] (scalar or array); constant-power pan to stereo."""
    a = (np.asarray(p) + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], -1)


def reverb_ir(seconds, decay, seed):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    tt = np.arange(n) / SR
    env = np.exp(-tt / decay)
    ir = np.stack([r.standard_normal(n) * env, r.standard_normal(n) * env], -1)
    ir[:, 0] = lp(ir[:, 0], 6000)
    ir[:, 1] = lp(ir[:, 1], 6000)
    return ir / np.sqrt((ir ** 2).sum(0, keepdims=True))


def reverb(st, ir, wet):
    out = np.zeros_like(st)
    for c in range(2):
        out[:, c] = fftconvolve(st[:, c], ir[:, c])[: len(st)]
    return st * (1 - wet) + out * wet


def saw_voice(freq, dur_mask, harmonics=14, detune=(0.0, -0.11, 0.12)):
    sig = np.zeros(N)
    for d in detune:
        f = freq * 2 ** (d / 12)
        ph = rng.uniform(0, 2 * np.pi)
        for h in range(1, harmonics + 1):
            if f * h > 9000:
                break
            sig += np.sin(2 * np.pi * f * h * t + ph * h) / h
    return sig * dur_mask / len(detune)


def note(name):
    names = {'C': -9, 'C#': -8, 'D': -7, 'D#': -6, 'E': -5, 'F': -4, 'F#': -3, 'G': -2, 'G#': -1, 'A': 0, 'A#': 1, 'Bb': 1, 'B': 2}
    n, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[n] + (o - 4) * 12) / 12)


mix = np.zeros((N, 2))

# --- wind: band-passed noise, slow gusts, stronger as the void arrives
noise = rng.standard_normal(N)
gust = 0.55 + 0.45 * np.sin(2 * np.pi * 0.17 * t + 1.0) * np.sin(2 * np.pi * 0.071 * t)
wind = bp(noise, 250, 1800) * gust * (0.6 + 0.8 * smooth(6, 12, t))
wind_r = bp(rng.standard_normal(N), 300, 2200) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.13 * t + 2.2))
mix += np.stack([wind, wind_r * (0.6 + 0.8 * smooth(6, 12, t))], -1) * 0.018

# --- pad: chord sections with crossfades
sections = [
    (0.0, 6.9, ['D3', 'A3', 'D4', 'F#4', 'E5']),          # warm, hopeful
    (6.3, 9.9, ['D3', 'A3', 'D4', 'F4', 'E5']),           # turns minor
    (9.4, 13.2, ['Bb2', 'F3', 'Bb3', 'D4', 'F4']),        # dread, heavier
    (12.7, 15.3, ['C3', 'G3', 'C4', 'E4', 'G4']),         # lift toward the hero beat
]
pad = np.zeros(N)
for (a, b, chord) in sections:
    m = smooth(a, a + 0.6, t) * (1 - smooth(b - 0.6, b, t))
    for nm in chord:
        pad += saw_voice(note(nm), m, harmonics=10)
pad_level = 0.05 + 0.10 * smooth(0.3, 6.0, t) + 0.05 * smooth(9.0, 12.0, t)
pad = lp(pad, 1800) * pad_level * (1 - smooth(15.0, 15.4, t))
mix += pan(pad, 0.0) * 0.55
# shimmer layer an octave up in the hopeful opening
shim = np.zeros(N)
m = smooth(1.0, 3.0, t) * (1 - smooth(6.0, 7.5, t))
for nm in ['D5', 'A5', 'F#5']:
    shim += np.sin(2 * np.pi * note(nm) * t) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.3 * t + rng.uniform(0, 6)))
mix += pan(shim * m * 0.025, 0.3) + pan(shim * m * 0.02, -0.3)

# --- sub drone and low void pulse
drone_m = smooth(6.0, 9.6, t) * (1 - smooth(15.0, 17.5, t))
drone = (np.sin(2 * np.pi * note('D1') * t) * 0.8 + np.sin(2 * np.pi * note('A1') * t) * 0.35) * drone_m
drone *= 0.75 + 0.25 * np.sin(2 * np.pi * 0.9 * t)
mix += pan(drone * 0.16, 0.0)

# --- void whispers: formant-filtered noise syllables, panned around
wh = np.zeros((N, 2))
for k in range(26):
    t0 = rng.uniform(6.2, 14.8)
    dur = rng.uniform(0.35, 0.9)
    i0, i1 = int(t0 * SR), min(N, int((t0 + dur) * SR))
    seg = rng.standard_normal(i1 - i0)
    f = rng.uniform(500, 2400)
    seg = bp(seg, f * 0.85, f * 1.15, order=2)
    tt = np.arange(i1 - i0) / SR
    env = np.sin(np.pi * tt / dur) ** 2 * (0.6 + 0.4 * np.sin(2 * np.pi * rng.uniform(5, 9) * tt))
    wh[i0:i1] += pan(seg * env, rng.uniform(-0.9, 0.9))
mix += wh * 0.06 * smooth(6.0, 8.0, t)[:, None]

# --- hits: boom + braam
def hit(t0, size=1.0):
    out = np.zeros((N, 2))
    i0 = int(t0 * SR)
    n = N - i0
    tt = np.arange(n) / SR
    f = 38 + 85 * np.exp(-tt / 0.09)
    ph = 2 * np.pi * np.cumsum(f) / SR
    boom = np.sin(ph) * np.exp(-tt / (0.9 * size)) * 0.9
    click = hp(rng.standard_normal(n), 1500) * np.exp(-tt / 0.012) * 0.35
    braam = np.zeros(n)
    for nm, g in [('D2', 1.0), ('A2', 0.7), ('D3', 0.5)]:
        fr = note(nm)
        for h in range(1, 18):
            braam += np.sin(2 * np.pi * fr * h * tt + h) / h * g
    cutoff_env = np.exp(-tt / 0.5)
    braam = lp(braam * np.exp(-tt / (1.4 * size)), 900) * (0.3 + 0.7 * cutoff_env)
    braam = np.tanh(braam * 1.6) * 0.32
    s = boom + click + braam
    out[i0:] = pan(s, 0.0)
    return out


hits = hit(9.6) + hit(12.9) * 0.9 + hit(15.1, 1.5) * 1.15
# reverse swell into each flash
for t0, ln in [(9.6, 0.9), (12.9, 0.8)]:
    i1 = int(t0 * SR)
    i0 = i1 - int(ln * SR)
    tt = np.arange(i1 - i0) / SR
    sw = hp(rng.standard_normal(i1 - i0), 2500) * (tt / ln) ** 3 * 0.12
    hits[i0:i1] += pan(sw, 0.0)
mix += hits

# --- aura chimes: bell partials on a D major pentatonic arpeggio
bell_notes = ['D5', 'F#5', 'A5', 'B5', 'D6', 'E6', 'F#6', 'A6']
for k, nm in enumerate(bell_notes):
    t0 = 10.45 + k * 0.2
    i0 = int(t0 * SR)
    n = N - i0
    tt = np.arange(n) / SR
    f = note(nm)
    b = np.zeros(n)
    for ratio, g, d in [(1.0, 1.0, 1.6), (2.76, 0.45, 0.7), (5.4, 0.25, 0.35), (8.93, 0.12, 0.2)]:
        b += np.sin(2 * np.pi * f * ratio * tt) * g * np.exp(-tt / d)
    b *= np.minimum(1, tt / 0.004)
    mix[i0:] += pan(b * 0.05, -0.7 + 1.4 * k / (len(bell_notes) - 1))

# --- riser into the final hit
r_m = smooth(12.9, 15.08, t) * (t < 15.1)
riser = hp(rng.standard_normal(N), 600) * r_m ** 2.5 * 0.09
gl = 180 * 2 ** (2.2 * smooth(12.9, 15.1, t))
riser += np.sin(2 * np.pi * np.cumsum(gl) / SR) * r_m ** 2 * 0.05
mix += pan(riser, 0.0)

# --- space, gentle glue, fade-in from silence
mix = reverb(mix, reverb_ir(3.5, 0.9, 3), 0.28)
mix *= smooth(0.0, 1.0, t)[:, None]
mix = hp(mix.T, 25).T
mix = np.tanh(mix * 1.2) / 1.2
mix *= 0.89 / np.abs(mix).max()
OUT.mkdir(parents=True, exist_ok=True)
sf.write(OUT / 'intro_audio.wav', mix.astype(np.float32), SR, subtype='FLOAT')
print('wrote', mix.shape[0] / SR, 's')
