# Mascot animations and export. Needs Pillow.
#   python3 web/scripts/mascot/anim.py <folder>
# writes mascot-sheet.gif (all animations side by side), one transparent sticker GIF per
# animation and mascot-poses.png (first frame of each, on a light and a dark background).
import os
import sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import avatar as a

HAPPY = dict(eyes='happy', mouth='open')
THINK = dict(larm='chin', brows='think', mouth='flat')
JUMP = dict(leg='tuck', larm='up', rarm='up', **HAPPY)
# Each animation is a list of (pose, milliseconds); see avatar.build for the pose keys.
# Every loop length divides 6 s so the sheet GIF loops without a jump.
ANIMS = {
    'idle': [({}, 450), (dict(d=1), 450), ({}, 450), (dict(d=1), 300), (dict(d=1, eyes='closed'), 110), (dict(d=1), 240)],
    'talk': [(dict(mouth='talk'), 110), (dict(mouth='open'), 130), (dict(mouth='talk'), 110), (dict(mouth='smile'), 120),
             (dict(mouth='o'), 130), (dict(mouth='talk'), 110), (dict(mouth='open'), 130), (dict(mouth='smile'), 180),
             (dict(eyes='closed'), 100), (dict(mouth='talk'), 110), (dict(mouth='smile'), 270)],
    'wave': [(dict(rarm='up', **HAPPY), 200), (dict(rarm='up2', **HAPPY), 200)] * 3,
    'point': [(dict(rarm='point', eyes='side'), 500), (dict(rarm='point', eyes='side', mouth='talk'), 120),
              (dict(rarm='point', eyes='side', mouth='open'), 140), (dict(rarm='point', eyes='side', mouth='talk'), 120),
              (dict(rarm='point', eyes='side'), 600), (dict(rarm='point', eyes='closed'), 100), (dict(rarm='point', eyes='side'), 420)],
    'think': [(dict(eyes='up', **THINK), 900), (dict(eyes='side', **THINK), 700), (dict(eyes='closed', **THINK), 110),
              (dict(eyes='up', **THINK), 800), (dict(eyes='open', **THINK), 490)],
    'walk': [(dict(leg='stepL', d=-1, lift=(0, 1)), 150), (dict(leg='stand'), 150),
             (dict(leg='stepR', d=-1, lift=(1, 0)), 150), (dict(leg='stand'), 150)],
    'jump': [({}, 350), (dict(d=2, mouth='flat'), 120), (dict(jump=6, **JUMP), 120), (dict(jump=9, **JUMP), 180),
             (dict(jump=5, **JUMP), 110), (dict(d=2), 110), ({}, 1010)],
    'cheer': [(dict(larm='up', rarm='up2', **HAPPY), 200), (dict(larm='up2', rarm='up', **HAPPY), 200)] * 3,
}
TICK = 50          # GIF frame step, ms
LOOP = 6000        # sheet length, ms


def image(pose, scale, sticker=True):
    grid = a.to_grid(a.build(stick=sticker, **pose))
    img = Image.new('RGBA', (a.W * scale, a.H * scale), (0, 0, 0, 0))
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            if ch in a.PAL:
                img.paste(a.rgb(ch) + (255,), (x * scale, y * scale, (x + 1) * scale, (y + 1) * scale))
    return img


def ticks(frames):
    """Index of the pose shown at each TICK of the loop."""
    out = []
    for i, (_, ms) in enumerate(frames):
        out += [i] * max(1, round(ms / TICK))
    return out


def sheet_gif(names, path, cols=4, scale=3, gap=10, bg=(30, 30, 34)):
    poses = {n: [image(p, scale) for p, _ in ANIMS[n]] for n in names}
    steps = {n: ticks(ANIMS[n]) for n in names}
    cw, ch = a.W * scale, a.H * scale
    rows = -(-len(names) // cols)
    size = (cols * cw + (cols + 1) * gap, rows * ch + (rows + 1) * gap)
    frames = []
    for t in range(LOOP // TICK):
        img = Image.new('RGBA', size, bg + (255,))
        for k, n in enumerate(names):
            img.alpha_composite(poses[n][steps[n][t % len(steps[n])]], (gap + k % cols * (cw + gap), gap + k // cols * (ch + gap)))
        frames.append(img.convert('RGB').convert('P', palette=Image.ADAPTIVE, colors=64))
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=TICK, loop=0, optimize=True)


def sticker_gif(name, path, scale=4):
    """Transparent GIF of one animation (magenta is the see-through colour)."""
    poses = [image(p, scale) for p, _ in ANIMS[name]]
    frames = []
    for i in ticks(ANIMS[name]):
        img = Image.new('RGBA', poses[0].size, (255, 0, 255, 255))
        img.alpha_composite(poses[i])
        frames.append(img.convert('RGB').convert('P', palette=Image.ADAPTIVE, colors=63))
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=TICK, loop=0, disposal=2,
                   transparency=frames[0].getpixel((0, 0)))


def poses_png(names, path, scale=3, gap=8, bgs=((246, 245, 243), (30, 30, 34))):
    cells = [image(ANIMS[n][0][0], scale) for n in names]
    cw, ch = cells[0].size
    img = Image.new('RGB', (len(cells) * cw + (len(cells) + 1) * gap, len(bgs) * (ch + gap) + gap))
    for b, bg in enumerate(bgs):
        img.paste(bg, (0, b * (ch + gap), img.width, (b + 1) * (ch + gap) + gap))
        for k, cell in enumerate(cells):
            img.paste(cell, (gap + k * (cw + gap), gap + b * (ch + gap)), cell)
    img.save(path)


if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    names = list(ANIMS)
    for n in names:
        total = sum(ms for _, ms in ANIMS[n])
        assert LOOP % total == 0, f'{n}: {total} ms does not divide {LOOP} ms'
        sticker_gif(n, os.path.join(out, f'mascot-{n}.gif'))
    sheet_gif(names, os.path.join(out, 'mascot-sheet.gif'))
    poses_png(names, os.path.join(out, 'mascot-poses.png'))
    print('wrote', len(names) + 2, 'files to', out)
