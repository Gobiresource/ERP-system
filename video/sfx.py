# Sound for the ERP intro: effects on the exact moments listed in out/events.json (written by
# render.mjs from the scene), and a soft chord pad under them. numpy only.
#   python3 sfx.py            -> out/sfx.wav (48 kHz, stereo, 16-bit)
import json
import wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).parent
SR = 48000
rng = np.random.default_rng(7)
ev = json.loads((ROOT / 'out/events.json').read_text())
N = int((ev['DURATION'] + 0.5) * SR)
mix = np.zeros((N, 2))


def add(t, mono, gain, pan=0.0):
    """Place a mono sound at t seconds; pan -1 left .. 1 right."""
    i = int(t * SR)
    if i >= N or i + len(mono) <= 0:
        return
    s = mono[max(0, -i):max(0, min(len(mono), N - i))]
    i = max(i, 0)
    left, right = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    mix[i:i + len(s), 0] += s * gain * left * 1.414
    mix[i:i + len(s), 1] += s * gain * right * 1.414


def sweep(dur, f0, f1, width=0.35, peak=0.5):
    """Noise through a band-pass whose centre glides from f0 to f1 (a whoosh); the loudest point at peak."""
    n = int(dur * SR)
    x = rng.standard_normal(n + 2048)
    size, hop = 2048, 256
    win = np.hanning(size)
    freqs = np.fft.rfftfreq(size, 1 / SR) + 1
    out = np.zeros(len(x))
    for i in range((len(x) - size) // hop):
        u = min(1.0, i * hop / n)
        fc = f0 * (f1 / f0) ** u
        mask = np.exp(-0.5 * ((np.log(freqs) - np.log(fc)) / width) ** 2)
        out[i * hop:i * hop + size] += np.fft.irfft(np.fft.rfft(x[i * hop:i * hop + size] * win) * mask) * win
    out = out[:n]
    u = np.linspace(0, 1, n)
    envl = np.where(u < peak, np.sin(np.pi / 2 * u / peak) ** 2, np.cos(np.pi / 2 * (u - peak) / (1 - peak)) ** 2)
    out *= envl
    return out / (np.abs(out).max() + 1e-9)


def lowpass(x, cutoff):
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(np.fft.rfft(x) / (1 + (f / cutoff) ** 4), len(x))


def thud(height):
    """Landing: a falling low sine with a soft knock on top."""
    n = int(0.4 * SR)
    tt = np.arange(n) / SR
    f = 42 + 50 * np.exp(-tt / 0.05)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.09)
    knock = lowpass(rng.standard_normal(n) * np.exp(-tt / 0.008), 900)
    s = body + 0.4 * knock / (np.abs(knock).max() + 1e-9)
    return s / np.abs(s).max() * min(1.0, 0.55 + 0.35 * height)


def pop(f0, f1, dur, decay):
    """A short, round UI pop: a sine that drops in pitch, with a soft start."""
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-tt / 0.012)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / decay) * np.minimum(1, tt / 0.0015)
    return s / np.abs(s).max()


def bell(f=659.25):
    """A soft FM bell with a warm lower partial (replaces the bright chime)."""
    n = int(1.8 * SR)
    tt = np.arange(n) / SR
    mod = 1.1 * np.exp(-tt / 0.2) * np.sin(2 * np.pi * f * 1.4 * tt)
    s = np.sin(2 * np.pi * f * tt + mod) * np.exp(-tt / 0.5) + 0.5 * np.sin(np.pi * f * tt) * np.exp(-tt / 0.7)
    s = lowpass(s * np.minimum(1, tt / 0.006), 2600)
    return s / np.abs(s).max()


def reverb(x, seconds=2.4, tau=0.42, wet=0.3):
    """Convolution with decaying, smoothed stereo noise: a plain warm room."""
    n = int(seconds * SR)
    tt = np.arange(n) / SR
    out = np.empty_like(x)
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    for ch in range(2):
        ir = lowpass(rng.standard_normal(n), 4000) * np.exp(-tt / tau)
        ir /= np.sqrt((ir ** 2).sum())
        y = np.fft.irfft(np.fft.rfft(x[:, ch], size) * np.fft.rfft(ir, size), size)[:len(x)]
        out[:, ch] = x[:, ch] * (1 - wet) + y * wet * 2.2
    return out


captions = sorted(e['t'] for e in ev['EVENTS'] if e['kind'] == 'caption')
for e in ev['EVENTS']:
    t, k = e['t'], e['kind']
    if k == 'takeoff':
        add(t - 0.05, lowpass(sweep(0.3, 300, 1100, width=0.5, peak=0.4), 1600), 0.07)
    elif k == 'land':
        add(t, thud(e.get('h', 1)), 0.3)
    elif k == 'whip':
        add(t - 0.1, lowpass(sweep(0.55, 350, 1700, width=0.55, peak=0.5), 1800), 0.2)
    elif k == 'tap':
        add(t, pop(950, 560, 0.09, 0.025), 0.09)
    elif k == 'key':
        add(t, pop(2300, 1700, 0.03, 0.006), 0.025)
    elif k == 'slide':
        add(t, lowpass(sweep(0.34, 900, 500, width=0.6, peak=0.35), 1400), 0.045, pan=-0.2)
for t, f in ((captions[0], 659.25), (captions[1], 830.61), (captions[-1], 659.25)):
    add(t, bell(f), 0.07)
mix = reverb(mix, wet=0.18)

# pad: A, E, F#m, D, each 3.6 s, cross-faded; partials 1-3 and a slight detune for warmth
CHORDS = [(110.0, 138.59, 164.81, 220.0), (82.41, 123.47, 164.81, 207.65), (92.5, 138.59, 185.0, 220.0), (73.42, 110.0, 146.83, 185.0)]
seg = 3.6
tt = np.arange(N) / SR
pad = np.zeros((N, 2))
for ci in range(int(np.ceil(ev['DURATION'] / seg)) + 1):
    t0 = ci * seg
    w = np.clip((tt - t0 + 0.6) / 1.2, 0, 1) * np.clip((t0 + seg + 0.6 - tt) / 1.2, 0, 1)
    w = np.sin(w * np.pi / 2) ** 2
    if not w.any():
        continue
    for j, f in enumerate(CHORDS[ci % 4]):
        for ch, det in ((0, 0.9985), (1, 1.0015)):
            v = sum(a * np.sin(2 * np.pi * f * det * p * tt + j) for p, a in ((1, 1), (2, 0.28), (3, 0.1)))
            pad[:, ch] += v * w * (0.9 if j else 1.2)
        pad[:, 0] += 0.6 * np.sin(np.pi * CHORDS[ci % 4][0] * tt) * w
        pad[:, 1] += 0.6 * np.sin(np.pi * CHORDS[ci % 4][0] * tt + 0.3) * w
pad /= np.abs(pad).max()
pad = reverb(pad, seconds=3.0, tau=0.6, wet=0.35)
fade = np.clip(tt / 2.5, 0, 1) * np.clip((ev['DURATION'] - tt) / 2.5, 0, 1)
mix += pad * fade[:, None] * 0.32

# loudness for a phone: RMS about -18 dBFS, peaks rounded off softly above 0.7, ceiling 0.95
mix *= 10 ** (-18 / 20) / np.sqrt((mix ** 2).mean())
a = np.abs(mix)
mix = np.sign(mix) * np.where(a < 0.7, a, 0.7 + 0.3 * np.tanh((a - 0.7) / 0.3))
mix *= 0.95 / max(0.95, np.abs(mix).max())
pcm = (mix * 32767).astype('<i2')
with wave.open(str(ROOT / 'out/sfx.wav'), 'wb') as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR)
    f.writeframes(pcm.tobytes())
print('wrote out/sfx.wav', round(len(pcm) / SR, 2), 's')
