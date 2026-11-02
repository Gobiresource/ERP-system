# Trace the logo's white triangle bands into polygons and write logo.svg / logo.json.
#   python3 trace.py <logo picture> logo   (the picture the user sent: a red rounded tile, 2000 x 2000)
import sys, json, math
import numpy as np
from PIL import Image
from collections import deque

src, out = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert('L')).astype(np.int16)
H, W = im.shape
white = im > 128

# tile edges (red area): first/last non-white along the middle row and column
row = np.where(im[H // 2] < 200)[0]; col = np.where(im[:, W // 2] < 200)[0]
tx0, tx1, ty0, ty1 = row[0], row[-1], col[0], col[-1]
size = tx1 - tx0
# corner radius: fit a circle to where the red starts on rows near the top-left corner
pairs = [(k + 0.5, np.where(im[ty0 + k] < 200)[0][0] - tx0) for k in (2, 5, 10, 20, 40, 80, 150, 250, 350)]
r = min(np.arange(100, size / 2, 0.5), key=lambda rr: sum((math.hypot(rr - x, rr - y) - rr) ** 2 for y, x in pairs))
print('tile', tx0, ty0, tx1, ty1, 'size', size, 'corner radius', round(float(r), 1), f'({r / size:.3f} of size)')

# white components inside the tile, away from its rounded corners
mask = np.zeros_like(white)
mask[300:1700, 300:1700] = white[300:1700, 300:1700]
lab = np.zeros(mask.shape, np.int32); n = 0
for y0, x0 in zip(*np.nonzero(mask)):
    if lab[y0, x0]: continue
    n += 1; q = deque([(y0, x0)]); lab[y0, x0] = n
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if mask[yy, xx] and not lab[yy, xx]:
                lab[yy, xx] = n; q.append((yy, xx))
sizes = [(int((lab == k).sum()), k) for k in range(1, n + 1)]
sizes.sort(reverse=True)
print('components', len(sizes), [s for s, _ in sizes[:6]])

def trace(k):
    """Moore-neighbour boundary of component k, clockwise, as pixel corners."""
    m = lab == k
    ys, xs = np.nonzero(m)
    i = np.lexsort((xs, ys))[0]
    start = (ys[i], xs[i])
    nb = [(-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1)]
    pts = [start]; cur = start; back = 6     # came from the west
    while True:
        for j in range(8):
            d = (back + 1 + j) % 8
            yy, xx = cur[0] + nb[d][0], cur[1] + nb[d][1]
            if m[yy, xx]:
                back = (d + 4) % 8; cur = (yy, xx); break
        if cur == start and len(pts) > 2: break
        pts.append(cur)
        if len(pts) > 200000: break
    return [(x + 0.5, y + 0.5) for y, x in pts]

def dp(pts, eps):
    """Douglas-Peucker on a closed ring."""
    def rec(a):
        if len(a) < 3: return a
        (x1, y1), (x2, y2) = a[0], a[-1]
        dx, dy = x2 - x1, y2 - y1; L = math.hypot(dx, dy) or 1e-9
        d = [abs(dy * (x - x1) - dx * (y - y1)) / L for x, y in a[1:-1]]
        i = int(np.argmax(d)) + 1
        if d[i - 1] > eps: return rec(a[:i + 1])[:-1] + rec(a[i:])
        return [a[0], a[-1]]
    far = max(range(len(pts)), key=lambda i: (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2)
    return rec(pts[:far + 1])[:-1] + rec(pts[far:] + [pts[0]])[:-1]

bands = []
for s, k in sizes[:3]:
    ring = dp(trace(k), 2.5)
    bands.append([((x - tx0) / size, (y - ty0) / size) for x, y in ring])
    print('band', k, 'pixels', s, 'vertices', len(ring))

data = {'tile': {'radius': float(r / size)}, 'bands': bands, 'red': '#BC1F29'}
json.dump(data, open(out + '.json', 'w'), indent=1)
R = float(r / size)
tile = (f'M{R},0 H1 V{1 - R} A{R},{R} 0 0 1 {1 - R},1 H0 V{R} A{R},{R} 0 0 1 {R},0 Z')
paths = ''.join(f'<path d="M{" L".join(f"{x:.4f},{y:.4f}" for x, y in b)} Z" fill="#fff"/>' for b in bands)
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="512" height="512"><path d="{tile}" fill="#BC1F29"/>{paths}</svg>'
open(out + '.svg', 'w').write(svg)
print('wrote', out + '.svg')
