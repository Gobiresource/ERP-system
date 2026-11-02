# Sound for «Кемпэд гал гарвал»: the ElevenLabs voice over music (Mixkit «Break Away» by Ahjay Stelino, Mixkit Stock
# Music Free License), the music ducked while the voice speaks, and three alarm beeps when the button is pressed.
# Times come from out/events.json, written by render.mjs from the scene.  numpy and ffmpeg.
#   python3 audio.py   -> ../out/hse-fire-audio.wav (48 kHz, stereo, 16-bit) and ../out/hse-fire-music.mp3 (the music alone)
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
t = np.arange(N) / SR
db = lambda x: 10 ** (x / 20)


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(float)


def write(path, x):
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype('<i2').tobytes())


voice = np.zeros((N, 2))
v = load(HERE / 'voice.mp3')
v *= db(-3) / max(1e-9, np.abs(v).max())
i = int(E['lead'] * SR)
voice[i:i + len(v)] = v[:N - i]

# Music: from its start, faded out over the last 3 s, at -22 dBFS RMS
music = np.zeros((N, 2))
m = load(HERE / 'music.mp3')[:N]
music[:len(m)] = m
music *= (np.clip(t / .05, 0, 1) * np.clip((ev['DURATION'] - t) / 3, 0, 1))[:, None]
music *= db(-22) / np.sqrt((music[:int(40 * SR)] ** 2).mean())
write(OUT / 'hse-fire-music.wav', music * db(-1) / np.abs(music).max())

# Duck the music 8 dB while the voice speaks: the voice level every 10 ms, a gate, quick attack and slow release
hop = SR // 100
lvl = np.sqrt((voice[:N // hop * hop, 0].reshape(-1, hop) ** 2).mean(1))
gate = (20 * np.log10(lvl + 1e-9) > -42).astype(float)
g, y = np.empty_like(gate), 0.
for k, x in enumerate(gate):
    y += (x - y) * (.35 if x > y else .016)
    g[k] = y
duck = np.repeat(db(-8 * g), hop)
music *= np.concatenate([duck, np.full(N - len(duck), duck[-1])])[:, None]

mix = voice + music
# Alarm: three short two-tone beeps
for k in range(3):
    a = int((E['press'] + .05 + k * .32) * SR)
    n = int(.18 * SR)
    tt = np.arange(n) / SR
    beep = np.sign(np.sin(2 * np.pi * 960 * tt)) * .5 + np.sin(2 * np.pi * 1920 * tt) * .2
    beep *= np.minimum(1, np.minimum(tt / .005, (tt[-1] - tt) / .02)) * .09
    mix[a:a + n] += beep[:, None]

mix *= min(1, .97 / np.abs(mix).max())
write(OUT / 'hse-fire-audio.wav', mix)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(OUT / 'hse-fire-music.wav'), '-b:a', '192k', str(OUT / 'hse-fire-music.mp3')], check=True)
print('hse-fire-audio.wav', round(N / SR, 1), 's')
