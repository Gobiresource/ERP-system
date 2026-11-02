# Average each frame's sub-frames in linear light (motion blur), then encode the MP4 with the sound.
#   python3 build.py out/erp-intro.mp4 [audio.wav]   (default out/sfx.wav)
import json
import subprocess
import sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).parent
out = sys.argv[1] if len(sys.argv) > 1 else str(ROOT / 'out/erp-intro.mp4')
parts = [json.loads(f.read_text()) for f in sorted((ROOT / 'frames').glob('list-*.json'))]   # render.mjs --part=k/n
frames = ([next(l[i] for l in parts if i < len(l) and l[i]) for i in range(max(map(len, parts)))] if parts
          else json.loads((ROOT / 'frames/list.json').read_text()))
fps = json.loads((ROOT / 'out/events.json').read_text())['FPS']
W, H = Image.open(ROOT / 'frames' / frames[0][0]).size

cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(fps), '-i', '-',
       '-i', sys.argv[2] if len(sys.argv) > 2 else str(ROOT / 'out/sfx.wav'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
       '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]
enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
for subs in frames:
    imgs = [np.asarray(Image.open(ROOT / 'frames' / f).convert('RGB'), np.float32) / 255 for f in subs]
    if len(imgs) == 1:
        img = imgs[0]
    else:
        img = (sum(i ** 2.2 for i in imgs) / len(imgs)) ** (1 / 2.2)
    enc.stdin.write((img * 255 + 0.5).clip(0, 255).astype(np.uint8).tobytes())
enc.stdin.close()
sys.exit(enc.wait())
