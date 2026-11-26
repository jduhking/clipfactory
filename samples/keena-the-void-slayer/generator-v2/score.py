#!/usr/bin/env python3
"""Orchestral score for the Keena intro v2, rendered from VSCO 2 Community Edition samples (CC0).

Every pitched or percussive sound is a recorded instrument; only the wind bed and the reverb are shaped
noise. It follows the v1 harmony (D major, D minor, B flat, C) into an A minor hero hit on her face, stops
dead for the goofy face and lands a pizzicato, bassoon and tuba sting on A, the trailer's opening key.
Cue times in seconds from the start of the intro come from out/cues.json:
reveal, cut_b, cut_c, goofy, moku, end.

    python fetch_vsco.py && python score.py      # samples in out/vsco (or VSCO_DIR); writes out/intro_score.wav
"""

import glob
import json
import os
import re
import sys
from functools import cache
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, resample_poly, sosfilt

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
VSCO = Path(os.environ.get("VSCO_DIR", HERE / "out" / "vsco"))
SR = 48000
RNG = np.random.default_rng(7)
SEMI = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def midi(name):
    m = re.fullmatch(r"([A-G])([#b]?)(-?\d)", name)
    return 12 * (int(m.group(3)) + 1) + SEMI[m.group(1)] + {"#": 1, "b": -1, "": 0}[m.group(2)]


@cache
def load(path):
    x, sr = sf.read(path, dtype="float32", always_2d=True)
    x = np.repeat(x, 2, 1) if x.shape[1] == 1 else x[:, :2]
    return resample_poly(x, SR, sr, axis=0).astype(np.float32) if sr != SR else x


def peak_hz(x, lo, hi, hps=True):
    seg = x[int(0.3 * SR): int(0.3 * SR) + 16384, 0]
    seg = seg if len(seg) == 16384 else x[:16384, 0]
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), 1 << 17))
    prod = spec.copy()
    for h in (2, 3) if hps else ():
        dec = spec[::h]
        prod[: len(dec)] *= dec
    freqs = np.fft.rfftfreq(1 << 17, 1 / SR)
    band = (freqs > lo) & (freqs < hi)
    return freqs[band][np.argmax(prod[band])]


class Inst:
    """A sampled instrument: notes parsed from VSCO file names, octave naming checked against pitch."""

    def __init__(self, folder, shift=None):
        self.notes = {}
        for path in sorted(glob.glob(str(VSCO / folder / "*.wav"))):
            parts = re.split(r"[_\-. ]", os.path.basename(path))
            name = next((p for p in parts if re.fullmatch(r"[A-G]#?-?\d", p)), None)
            vel = next((int(p[1:]) for p in parts if re.fullmatch(r"v\d+", p)), 1)
            if name:
                self.notes.setdefault(midi(name), []).append((vel, path))
        if not self.notes:
            sys.exit(f"no samples found in {VSCO / folder}")
        keys = sorted(self.notes)
        probe = keys[len(keys) // 4: 3 * len(keys) // 4 + 1: max(1, len(keys) // 8)][:5]
        offs = [round((69 + 12 * np.log2(peak_hz(load(self.notes[k][0][1]), 25, 2500) / 440) - k) / 12)
                for k in probe]
        self.shift = 12 * int(np.median(offs)) if shift is None else shift
        self.notes = {k + self.shift: v for k, v in self.notes.items()}
        print(f"{folder}: {len(keys)} pitches, octave shift {self.shift:+d} (probes {offs}), "
              f"midi {min(self.notes)}-{max(self.notes)}")

    def pick(self, target, vel):
        key = min(self.notes, key=lambda k: (abs(k - target), k < target))
        layers = sorted({v for v, _ in self.notes[key]})
        layer = layers[min(len(layers) - 1, int(vel * len(layers)))]
        opts = [p for v, p in self.notes[key] if v == layer]
        return key, opts[RNG.integers(len(opts))]


def shifted(path, semis):
    x = load(path)
    if abs(semis) < 1e-6:
        return x
    ratio = 2 ** (semis / 12)
    idx = np.arange(int(len(x) / ratio)) * ratio
    base = np.arange(len(x))
    return np.stack([np.interp(idx, base, x[:, c]) for c in (0, 1)], -1).astype(np.float32)


def stretch(x, need):
    """Lengthen a sustain by crossfading its steady middle onto itself."""
    if len(x) >= need or len(x) < int(1.8 * SR):
        return x
    body = x[int(0.6 * SR): len(x) - int(0.4 * SR)]
    x = x[: len(x) - int(0.4 * SR)]
    xf = int(0.45 * SR)
    fade = np.sin(np.linspace(0, np.pi / 2, xf))[:, None]
    while len(x) < need:
        x = np.concatenate([x[:-xf], x[-xf:] * fade[::-1] + body[:xf] * fade, body[xf:]])
    return x


def filt(x, kind, fc, order=2):
    return sosfilt(butter(order, fc, btype=kind, fs=SR, output="sos"), x, axis=0).astype(np.float32)


def smooth(a, b, t):
    x = np.clip((t - a) / max(b - a, 1e-6), 0, 1)
    return x * x * (3 - 2 * x)


def reverb(x, seconds, wet, seed):
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    ir = rng.standard_normal((n, 2)) * np.exp(-6.9 * np.arange(n) / SR / seconds)[:, None]
    ir = filt(ir, "lowpass", 5500)
    ir[: int(0.015 * SR)] = 0
    ir /= np.sqrt((ir ** 2).sum(0))
    tail = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in (0, 1)], -1)
    return (x * (1 - 0.5 * wet) + tail * wet).astype(np.float32)


class Bus:
    def __init__(self, seconds):
        self.x = np.zeros((int(seconds * SR), 2), np.float32)

    def add(self, sig, t0, gain=1.0, pan=0.0):
        i0 = round(t0 * SR)
        if i0 < 0:
            sig, i0 = sig[-i0:], 0
        sig = sig[: max(0, len(self.x) - i0)]
        th = (pan + 1) * np.pi / 4
        self.x[i0: i0 + len(sig), 0] += sig[:, 0] * gain * np.cos(th) * np.sqrt(2)
        self.x[i0: i0 + len(sig), 1] += sig[:, 1] * gain * np.sin(th) * np.sqrt(2)

    def note(self, inst, name, t0, dur, vel=0.6, gain=1.0, pan=0.0, attack=0.02, release=0.6, cresc=None):
        target = midi(name)
        key, path = inst.pick(target, vel)
        need = int((dur + release) * SR)
        x = stretch(shifted(path, target - key), need)[:need]
        n = len(x)
        env = np.ones(n, np.float32)
        a = min(n, max(1, int(attack * SR)))
        env[:a] = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
        r0 = min(n, int(dur * SR))
        env[r0:] *= np.cos(np.linspace(0, np.pi / 2, n - r0)) ** 2
        if cresc:
            env *= np.interp(np.arange(n), [0, max(r0, 1)], cresc).astype(np.float32)
        self.add(x * env[:, None], t0, gain * (0.3 + 0.7 * vel), pan)

    def chord(self, inst, names, t0, dur, **kw):
        for name in names:
            self.note(inst, name, t0, dur, **kw)

    def hit(self, path, t0, gain=1.0, pan=0.0, semis=0.0):
        self.add(shifted(str(VSCO / path), semis), t0, gain, pan)

    def swell(self, path, t_end, length, gain=1.0, pan=0.0, semis=0.0):
        x = shifted(str(VSCO / path), semis)
        n = min(len(x), int(length * SR))
        self.add(x[:n] * (np.linspace(0, 1, n) ** 2.2)[:, None], t_end - n / SR, gain, pan)

    def to_peak(self, path, t, gain=1.0, pan=0.0, after=0.2):
        x = load(str(VSCO / path))
        env = np.convolve(np.abs(x[:, 0]), np.ones(2048) / 2048, "same")
        k = int(np.argmax(env))
        n = min(len(x), k + int(after * SR))
        tail = np.ones(n, np.float32)
        tail[k:] = np.cos(np.linspace(0, np.pi / 2, n - k)) ** 2
        self.add(x[:n] * tail[:, None], t - k / SR, gain, pan)


def tuned(path, target):
    """Semitones that move a timpani sample to the nearest octave of the target pitch class."""
    est = 69 + 12 * np.log2(peak_hz(load(str(VSCO / path)), 45, 220, hps=False) / 440)
    return (midi(target) - est + 6) % 12 - 6


def main():
    cue = {"reveal": 4.0, "cut_b": 7.0, "cut_c": 10.5, "goofy": 12.6, "moku": 13.6, "end": 16.0}
    if (OUT / "cues.json").exists():
        cue.update(json.loads((OUT / "cues.json").read_text()))
    rv, cb_, cc, g, mk, end = (cue[k] for k in ("reveal", "cut_b", "cut_c", "goofy", "moku", "end"))
    total = end + 3.0
    vln, vla, vc, cb = (Inst(f"Strings/{f}") for f in ("Violin Section/susVib", "Viola Section/susvib",
                                                      "Cello Section/susvib", "Solo Contrabass/SusVib"))
    vln_tr, vc_tr = Inst("Strings/Violin Section/Trem"), Inst("Strings/Cello Section/trem")
    vln_pz, vc_pz = Inst("Strings/Violin Section/Pizz"), Inst("Strings/Cello Section/pizzT")
    hn = Inst("Brass/F Horn/sus", shift=12)  # the pitch check reads the horn an octave high
    tbn, tba, tba_st = (Inst(f"Brass/{f}") for f in ("Tenor Trombone/sus", "Tuba/sus", "Tuba/stac"))
    bsn, cl = Inst("Woodwinds/Bassoon/stac"), Inst("Woodwinds/Clarinet/stac")
    bass_dir = VSCO / "VSCO 1 Percussion/drums/bass"
    kick = max(glob.glob(str(bass_dir / "*.wav")), key=lambda p: np.abs(load(p)).max())
    kick = os.path.relpath(kick, VSCO)
    timp = "Percussion/Timpani/Timpani3_Hit_v4_rr1_Sum.wav"
    roll = "Percussion/Timpani/Rolls/Timpani2_Roll_v5_rr1_Sum.wav"
    wood = "VSCO 1 Percussion/varWood/wood_click_f.wav"
    pre, post = Bus(total), Bus(total)

    def boom(t, low, mid, horns, size=1.0):
        pre.hit(timp, t, 0.95 * size, 0.05, tuned(timp, low[0]))
        pre.hit(kick, t, 0.8 * size, 0.0)
        pre.hit("Percussion/cymbal-crash1_ff_rr1.wav", t, 0.3 * size, -0.35)
        pre.chord(tba, low, t, 1.2 * size, vel=0.95, gain=0.55, pan=0.2, attack=0.01, release=0.9)
        pre.chord(tbn, mid, t, 1.2 * size, vel=0.95, gain=0.45, pan=0.3, attack=0.01, release=0.9)
        pre.chord(hn, horns, t, 1.1 * size, vel=0.95, gain=0.4, pan=-0.25, attack=0.01, release=0.9)

    # 1. hopeful D major under the boots and the climb
    pre.chord(vc, ["D3", "A3"], 0.0, rv + 0.4, vel=0.45, gain=1.6, pan=0.35, attack=1.6)
    pre.chord(vla, ["D4", "F#4"], 0.6, rv - 0.2, vel=0.4, gain=1.3, pan=0.15, attack=1.8)
    pre.chord(vln, ["A4", "E5"], 1.4, rv - 1.0, vel=0.35, gain=1.0, pan=-0.35, attack=2.0)
    # 2. the valley comes into view: D minor, horns and basses swell into the cut
    span = cb_ - rv
    pre.chord(vc, ["D3", "A3"], rv - 0.3, span + 0.3, vel=0.55, gain=0.7, pan=0.35, attack=0.6, cresc=[0.6, 1])
    pre.note(cb, "D2", rv - 0.3, span + 0.3, vel=0.5, gain=0.75, pan=0.45, attack=0.8, cresc=[0.5, 1])
    pre.chord(vla, ["D4", "F4"], rv - 0.4, span + 0.4, vel=0.5, gain=0.55, pan=0.15, attack=0.6, cresc=[0.6, 1])
    pre.chord(vln, ["A4", "D5"], rv - 0.4, span + 0.4, vel=0.5, gain=0.5, pan=-0.35, attack=0.8, cresc=[0.5, 1])
    pre.chord(hn, ["D4", "F4", "A4"], rv, span, vel=0.6, gain=0.52, pan=-0.2, attack=0.9, cresc=[0.35, 1])
    pre.swell(roll, cb_, 1.8, 0.55, 0.05, tuned(roll, "D2"))
    # 3. cut to the tree: hit, thunder rumble, B flat dread, then a C major lift toward her face
    boom(cb_, ["D2"], ["D3", "A3"], ["D4", "A4"])
    pre.hit("Percussion/bassdrum_rub1_v1.wav", cb_ + 0.15, 0.7, 0.1)
    lift = cc - 1.3
    dread = lift - cb_
    pre.note(cb, "Bb1", cb_, dread + 0.2, vel=0.6, gain=0.6, pan=0.45, attack=0.3)
    pre.chord(vc_tr, ["Bb2", "F3"], cb_, dread + 0.2, vel=0.6, gain=0.5, pan=0.35, attack=0.2)
    pre.chord(vln_tr, ["D4", "F4", "Bb4"], cb_ + 0.2, dread, vel=0.5, gain=0.35, pan=-0.35, attack=0.3)
    pre.chord(tbn, ["F3", "Bb3"], cb_ + 0.4, dread - 0.2, vel=0.5, gain=0.35, pan=0.3, attack=0.6, cresc=[0.5, 1])
    pre.note(tba, "Bb1", cb_ + 0.4, dread - 0.2, vel=0.5, gain=0.4, pan=0.2, attack=0.6)
    pre.chord(vc, ["C3", "G3"], lift, cc - lift + 0.1, vel=0.7, gain=0.55, pan=0.35, attack=0.25, cresc=[0.6, 1])
    pre.note(cb, "C2", lift, cc - lift + 0.1, vel=0.7, gain=0.6, pan=0.45, attack=0.25)
    pre.chord(vln, ["E4", "G4", "C5"], lift, cc - lift + 0.1, vel=0.7, gain=0.4, pan=-0.35, attack=0.3, cresc=[0.5, 1])
    pre.chord(hn, ["C4", "E4", "G4"], lift, cc - lift + 0.1, vel=0.8, gain=0.42, pan=-0.2, attack=0.3, cresc=[0.4, 1])
    pre.to_peak("Percussion/susCymb1-cresc-Short_v1.wav", cc, 0.4, 0.1)
    pre.swell(roll, cc, 1.6, 0.6, 0.05, tuned(roll, "A1"))
    # 4. her face: A minor hero hit and a held, serious chord
    boom(cc, ["A1"], ["A2", "E3"], ["A3", "E4", "A4"], size=1.3)
    pre.hit("Percussion/gongHit_f.wav", cc, 0.45, -0.1)
    hold = g - cc + 0.3
    pre.note(cb, "A1", cc, hold, vel=0.8, gain=0.6, pan=0.45, cresc=[1, 0.75])
    pre.chord(vc, ["A2", "E3"], cc, hold, vel=0.8, gain=0.55, pan=0.35, cresc=[1, 0.75])
    pre.chord(vla, ["A3", "C4"], cc, hold, vel=0.75, gain=0.45, pan=0.15, cresc=[1, 0.75])
    pre.chord(vln, ["E4", "A4", "C5"], cc, hold, vel=0.75, gain=0.4, pan=-0.35, cresc=[1, 0.75])
    pre.chord(hn, ["A3", "E4"], cc + 0.3, hold - 0.3, vel=0.7, gain=0.4, pan=-0.2, attack=0.2)
    # 5. dead stop on the goofy face, then the sting: bassoon and pizzicato, a tuba plop for Moku, A major
    post.hit("VSCO 1 Percussion/varWood/vibraslap1.wav", g + 0.02, 0.5, 0.2)
    for dt, name in [(0.32, "A2"), (0.56, "C#3"), (0.80, "E3")]:
        post.note(bsn, name, g + dt, 0.18, vel=0.7, gain=0.7, pan=-0.05, release=0.15)
        post.note(vc_pz, name, g + dt, 0.25, vel=0.7, gain=0.5, pan=0.3, release=0.2)
        post.hit(wood, g + dt, 0.25, 0.15)
    post.note(tba_st, "E2", mk, 0.25, vel=0.8, gain=0.8, pan=0.1, release=0.2)
    post.note(vln_pz, "A5", mk + 0.12, 0.2, vel=0.6, gain=0.35, pan=-0.3)
    post.note(tba_st, "A1", mk + 0.34, 0.3, vel=0.8, gain=0.8, pan=0.1, release=0.25)
    post.note(bsn, "E3", end - 0.42, 0.12, vel=0.7, gain=0.6)
    post.hit(wood, end - 0.42, 0.25, 0.15)
    post.note(vc_pz, "A2", end - 0.12, 0.4, vel=0.8, gain=0.55, pan=0.3)
    post.chord(vln_pz, ["A4", "C#5", "E5"], end - 0.12, 0.4, vel=0.8, gain=0.4, pan=-0.3)
    post.note(bsn, "A2", end - 0.12, 0.2, vel=0.8, gain=0.65)
    post.chord(cl, ["C#5", "E5"], end - 0.12, 0.15, vel=0.7, gain=0.35, pan=-0.15)
    post.hit(wood, end - 0.12, 0.3, 0.15)

    t = np.arange(len(pre.x)) / SR
    gate = 1 - smooth(g, g + 0.05, t)
    mix = reverb(pre.x, 2.8, 0.32, 1) * gate[:, None] + reverb(post.x, 1.1, 0.16, 2) * 1.6
    noise = filt(filt(RNG.standard_normal(pre.x.shape).astype(np.float32), "highpass", 180), "lowpass", 1400)
    gust = 0.55 + 0.45 * np.sin(2 * np.pi * 0.17 * t + 1.0) * np.sin(2 * np.pi * 0.071 * t)
    level = (0.010 + 0.016 * smooth(rv - 1, cb_, t) - 0.008 * smooth(cc, g, t)) * (1 - 0.5 * smooth(g, g + 0.1, t))
    mix += noise * (gust * level)[:, None]
    mix = filt(mix, "highpass", 28) * smooth(0.0, 0.8, t)[:, None]
    mix = np.tanh(mix / np.abs(mix).max() * 1.25) / np.tanh(1.25) * 0.89
    OUT.mkdir(exist_ok=True)
    sf.write(OUT / "intro_score.wav", mix.astype(np.float32), SR, subtype="FLOAT")
    for name, a, b in [("open", 0, rv), ("valley", rv, cb_), ("tree", cb_, cc), ("face", cc, g), ("goofy", g, end)]:
        seg = mix[int(a * SR): int(b * SR)]
        print(f"{name:6s} {a:5.2f}-{b:5.2f}s rms {20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-9):6.1f} dBFS")
    print("wrote", OUT / "intro_score.wav", f"{len(mix) / SR:.2f} s")


if __name__ == "__main__":
    main()
