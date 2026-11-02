# Sound for «Кемпэд гал гарвал»: the ElevenLabs voice, a quiet pad and fire crackle under it, three alarm beeps when the button is
# pressed. Times come from out/events.json, written by render.mjs from the scene.  numpy and ffmpeg.
#   python3 audio.py            -> ../out/hse-fire-audio.wav (48 kHz, stereo, 16-bit)
import json
import subprocess
import wave
from pathlib import Path
import numpy as np

HERE = Path(__file__).parent
OUT = HERE.parent / 'out'
SR = 48000
ev = json.loads((OUT / 'events.json').read_text())
E = ev['EVENTS']
N = int((ev['DURATION'] + .3) * SR)
mix = np.zeros((N, 2))

raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(HERE / 'voice.mp3'), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                     capture_output=True, check=True).stdout
voice = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(float)
voice *= 10 ** (-3 / 20) / max(1e-9, np.abs(voice).max())
i = int(E['lead'] * SR)
mix[i:i + len(voice)] += voice[:N - i]

t = np.arange(N) / SR
# Pad: a soft minor chord, slow swell, ducked a little while the voice speaks
env = np.clip(t / 3, 0, 1) * np.clip((ev['DURATION'] - t) / 2.5, 0, 1)
pad = sum(np.sin(2 * np.pi * f * t + p) for f, p in [(110, 0), (130.81, 1), (164.81, 2), (220, 3)]) / 4
pad *= .05 * env * (1 + .15 * np.sin(2 * np.pi * .07 * t))
mix += np.stack([pad, np.roll(pad, 240)], 1)
# Fire: a low roar and crackles while it burns, quiet under the voice, gone once everyone is outside
rng = np.random.default_rng(7)
burn = np.clip((t - E['fire']) / 1.5, 0, 1) * np.clip((E['out'] - t) / 3, 0, 1)
roar = np.convolve(rng.standard_normal(N), np.ones(64) / 64, 'same')
crack = np.convolve((rng.random(N) < 25 / SR) * rng.standard_normal(N), np.exp(-np.arange(240) / 40), 'same')
fire = (2 * roar + .25 * crack) * burn * .05
mix += np.stack([fire, np.roll(fire, 90)], 1)
# Alarm: three short two-tone beeps
for k in range(3):
    a = int((E['press'] + .05 + k * .32) * SR)
    n = int(.18 * SR)
    tt = np.arange(n) / SR
    beep = np.sign(np.sin(2 * np.pi * 960 * tt)) * .5 + np.sin(2 * np.pi * 1920 * tt) * .2
    beep *= np.minimum(1, np.minimum(tt / .005, (tt[-1] - tt) / .02)) * .09
    mix[a:a + n] += beep[:, None]

peak = np.abs(mix).max()
mix *= min(1, .97 / peak)
with wave.open(str(OUT / 'hse-fire-audio.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('hse-fire-audio.wav', round(N / SR, 1), 's')
