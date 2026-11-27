"""Synthesizes the layout's two alert sounds as MP3s (needs `pip install lameenc`).

    job-done.mp3  a cash register: a drawer's rattle, then a two-tone bell
    wanted.mp3    a short police yelp, rising and falling twice

    python tools/sounds.py <out dir>   (default: ~/.config/herdr-app/mods/vice-crew/sounds)
"""

import math
import os
import random
import struct
import sys

import lameenc

RATE = 44100


def env(i, n, attack=0.005, release=0.05):
    t, d = i / RATE, n / RATE
    a = min(1.0, t / attack) if attack else 1.0
    r = min(1.0, (d - t) / release) if release else 1.0
    return max(0.0, min(a, r))


def bell(freq, dur, amp=0.5):
    n = int(dur * RATE)
    out = []
    for i in range(n):
        t = i / RATE
        decay = math.exp(-t * 6)
        s = math.sin(2 * math.pi * freq * t) + 0.45 * math.sin(2 * math.pi * freq * 2.76 * t) + 0.2 * math.sin(2 * math.pi * freq * 5.4 * t)
        out.append(amp * decay * s / 1.65 * env(i, n, 0.002, 0.02))
    return out


def rattle(dur, amp=0.35):
    rnd = random.Random(7)
    n = int(dur * RATE)
    out, last = [], 0.0
    for i in range(n):
        t = i / RATE
        clicks = 1.0 if (int(t * 70) % 2 == 0) else 0.25
        last = 0.6 * last + 0.4 * (rnd.random() * 2 - 1)
        out.append(amp * clicks * last * math.exp(-t * 9) * env(i, n, 0.002, 0.02))
    return out


def mix(*tracks):
    n = max(off + len(tr) for off, tr in tracks)
    buf = [0.0] * n
    for off, tr in tracks:
        for i, v in enumerate(tr):
            buf[off + i] += v
    return buf


def yelp(dur=1.1, lo=650, hi=1350, sweeps=2, amp=0.42):
    n = int(dur * RATE)
    out, phase = [], 0.0
    for i in range(n):
        t = i / RATE
        x = (t * sweeps / dur) % 1.0
        f = lo + (hi - lo) * (math.sin(math.pi * x) ** 0.8)
        phase += 2 * math.pi * f / RATE
        s = math.sin(phase) + 0.3 * math.sin(3 * phase) + 0.15 * math.sin(5 * phase)
        out.append(amp * s / 1.45 * env(i, n, 0.02, 0.12))
    return out


def mp3(samples, path):
    peak = max(1e-9, max(abs(v) for v in samples))
    gain = min(1.0, 0.9 / peak)
    pcm = b"".join(struct.pack("<h", int(max(-1, min(1, v * gain)) * 32767)) for v in samples)
    enc = lameenc.Encoder()
    enc.set_bit_rate(128); enc.set_in_sample_rate(RATE); enc.set_channels(1); enc.set_quality(2)
    with open(path, "wb") as fh:
        fh.write(enc.encode(pcm) + enc.flush())


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/.config/herdr-app/mods/vice-crew/sounds")
    os.makedirs(out, exist_ok=True)
    s = int(0.16 * RATE)
    mp3(mix((0, rattle(0.18)), (s, bell(2093, 0.9)), (s + int(0.07 * RATE), bell(2637, 1.1, 0.45))), os.path.join(out, "job-done.mp3"))
    mp3(yelp(), os.path.join(out, "wanted.mp3"))
    print(f"sounds -> {out}")


if __name__ == "__main__":
    main()
