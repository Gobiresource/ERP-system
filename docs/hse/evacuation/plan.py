# Camp fire evacuation plan, redrawn from the user's photo of the old plan (2026-11-02).
# Coordinates are pixels of that photo (1028×642): walls, rooms, signs were measured from it.
#   python3 plan.py            writes plan.svg next to this file
#   node render.mjs            writes plan.png (A3, 2x) and plan.pdf (A3)
import base64
import math
import pathlib

HERE = pathlib.Path(__file__).parent
FONTS = HERE.parents[2] / 'video/node_modules/@fontsource-variable/golos-text/files'

# Page: A3 landscape at 96 dpi
PW, PH = 1587, 1123
K = 1.38                       # photo px -> page px
OX, OY = (PW - 843 * K) / 2 - 22 * K, 188 - 23 * K

def P(x, y): return OX + x * K, OY + y * K
def R(x0, y0, x1, y1):
    (a, b), (c, d) = P(x0, y0), P(x1, y1)
    return a, b, c - a, d - b

GREEN, RED, INK, MUTED = '#00843D', '#D52B1E', '#1F2429', '#5B6670'

# Rooms: number, x0, y0, x1, y1 (number '' = small unnumbered room)
ROOMS = [
    ('57', 22, 23, 87, 82), ('58', 22, 82, 87, 127), ('59', 22, 127, 87, 179),
    ('56', 107, 23, 172, 82), ('55', 107, 82, 172, 127), ('54', 107, 127, 172, 179),
    ('53', 22, 179, 100, 255), ('52', 22, 255, 100, 348), ('51', 100, 179, 172, 348),
    ('50', 100, 348, 172, 406), ('49', 100, 406, 172, 530),
    *[(str(n), x0, 23, x1, 95) for n, x0, x1 in [
        (17, 191, 237), (18, 237, 282), (19, 282, 328), (20, 328, 373), (21, 373, 418), (22, 418, 464),
        (23, 464, 510), (24, 510, 554), (25, 554, 600), (26, 600, 645), (27, 645, 690), (28, 690, 736),
        (29, 736, 781), (30, 781, 865)]],
    *[(str(n), x0, 113, x1, 173) for n, x0, x1 in [
        (16, 191, 237), (15, 237, 282), (14, 282, 328), (13, 328, 373), (12, 373, 418), (11, 418, 464),
        (10, 464, 510), (9, 510, 554), (8, 554, 605), (7, 605, 658)]],
    ('6', 676, 113, 777, 218), ('5', 676, 218, 777, 361), ('4', 676, 361, 777, 437),
    ('31', 797, 95, 843, 132), ('', 843, 95, 865, 132),
    *[(str(n), 797, y0, 865, y1) for n, y0, y1 in [
        (32, 132, 179), (33, 179, 225), (34, 225, 270), (35, 270, 315), (36, 315, 361),
        (37, 361, 406), (38, 406, 452), (39, 452, 501)]],
    ('', 797, 501, 833, 530), ('', 833, 501, 865, 530),
    *[(str(n), x0, 437, x1, 510) for n, x0, x1 in [
        (48, 172, 256), (47, 256, 314), (46, 314, 373), (45, 373, 430), (44, 430, 489),
        (1, 541, 600), (2, 600, 658), (3, 695, 777)]],
    ('', 658, 437, 695, 458), ('', 658, 458, 695, 510), ('', 172, 510, 198, 530),
]
# Corridors and other walkable indoor space
HALLS = [
    (172, 23, 191, 437), (191, 95, 797, 113), (777, 113, 797, 530), (658, 113, 676, 437),
    (198, 510, 489, 530), (541, 510, 777, 530), (489, 437, 541, 530), (87, 23, 107, 179),
    (554, 173, 658, 192),
]
YARD = [(191, 173), (554, 173), (554, 192), (658, 192), (658, 437), (191, 437)]
OUTLINE = [(541, 530), (865, 530), (865, 23), (191, 23), (172, 23), (22, 23), (22, 348), (100, 348), (100, 530), (489, 530)]
WALLS = [OUTLINE[:4], OUTLINE[4:]]   # the outline split at the top left exit; the main exit is the gap between its ends

EXTINGUISHERS = [(190, 37), (711, 84), (756, 85), (527, 103), (697, 131), (215, 188), (793, 211), (307, 274),
                 (307, 300), (210, 323), (699, 335), (160, 338), (700, 381), (793, 430), (119, 517)]
ALARMS = [(183, 104), (787, 104), (667, 302), (476, 519), (552, 520)]
# Exit signs from the old plan: centre and the way their arrow points
SIGNS = [(583, 104, 'left'), (787, 275, 'up'), (181, 340, 'up'), (668, 366, 'up'), (274, 519, 'right'), (672, 520, 'left')]
# Escape routes as centre lines, drawn as chains of small arrows (ISO 23601 style). They follow the old plan's
# exit signs: corridors lead to the two yard doors or along the bottom corridors, the yard routes and the passage
# lead out through the main exit. The lower right corridor going down is inferred (old plan has no sign there).
ROUTES = [
    [(640, 104), (181.5, 104), (181.5, 16)],                       # top corridor west, up to the top left exit
    [(181.5, 179), (181.5, 112)],                                  # upper left corridor, up to the same exit
    [(181.5, 196), (181.5, 292), (204, 292)],                      # left corridor down to the left yard door
    [(181.5, 430), (181.5, 300)],                                  # lower left corridor up to the door
    [(787, 300), (787, 104), (667, 104), (667, 322), (650, 322)],  # right corridor, top corridor east, right yard door
    [(667, 430), (667, 332)],                                      # lower right inner corridor up to the door
    [(787, 330), (787, 519.5), (540, 519.5), (533, 536)],          # lower right corridor, bottom right corridor, main exit
    [(205, 519.5), (490, 519.5), (497, 536)],                      # bottom left corridor, main exit
    [(214, 292), (300, 328), (420, 382), (504, 432)],              # yard, from the left door
    [(644, 322), (600, 368), (545, 412), (522, 432)],              # yard, from the right door
    [(514, 442), (514, 534)],                                      # passage and main exit
]
DOORS = [(191, 284, 191, 299), (658, 312, 658, 333), (489, 530, 541, 530), (172, 23, 191, 23)]   # yard doors, main exit, top left exit

def font_faces():
    css = []
    for sub, rng in [('latin', 'U+0000-00FF,U+2013-2014,U+2116'), ('cyrillic', 'U+0400-045F,U+0490-0491,U+04B0-04B1'),
                     ('cyrillic-ext', 'U+0460-052F')]:
        data = base64.b64encode((FONTS / f'golos-text-{sub}-wght-normal.woff2').read_bytes()).decode()
        css.append(f"@font-face{{font-family:'Golos';font-weight:400 900;unicode-range:{rng};"
                   f"src:url(data:font/woff2;base64,{data}) format('woff2')}}")
    return '\n'.join(css)

# Icons: Lucide (ISC, already used by the app) and a running figure drawn in the same 24px line style
RUNNER = ('<circle cx="15" cy="3.6" r="2.3" fill="#fff" stroke="none"/>'
          '<path d="M13.6 7.4 11 13.6M13.6 8.4l3.4 2.2 2.6-1.4M13 8.6 9.4 9.4 7.2 12.4'
          'M11 13.6l3.6 2.6-1.2 5.2M11 13.6 8.8 17.8 4.4 18.8"/>')
EXTINGUISHER = ('<path d="M15 6.5V3a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3.5"/><path d="M9 18h8"/><path d="M18 3h-3"/>'
                '<path d="M11 3a6 6 0 0 0-6 6v11"/><path d="M5 13h4"/>'
                '<path d="M17 10a4 4 0 0 0-8 0v10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2Z"/>')
DOOR = '<path d="M5 21V3h11v18M3 21h16"/><path d="M12.5 12h.01" stroke-width="3"/>'
LINE = 'fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"'

def icon(sym, x, y, size, bg, rx=4, mirror=False):
    """A white line icon on a coloured rounded square, centred on page point (x, y)."""
    s = size / 24
    flip = f' transform="translate(24 0) scale(-1 1)"' if mirror else ''
    return (f'<g transform="translate({x - size / 2:.1f} {y - size / 2:.1f})">'
            f'<rect width="{size}" height="{size}" rx="{rx}" fill="{bg}"/>'
            f'<g transform="translate({size * .14:.1f} {size * .14:.1f}) scale({s * .72:.3f})"><g {LINE}{flip}>{sym}</g></g></g>')

def alarm(x, y, size):
    return (f'<g transform="translate({x - size / 2:.1f} {y - size / 2:.1f})"><rect width="{size}" height="{size}" rx="4" fill="{RED}"/>'
            f'<circle cx="{size / 2}" cy="{size / 2}" r="{size * .3:.1f}" fill="none" stroke="#fff" stroke-width="2.4"/>'
            f'<circle cx="{size / 2}" cy="{size / 2}" r="{size * .12:.1f}" fill="#fff"/></g>')

def exit_sign(x, y, way, scale=1.0):
    """Green exit sign: running figure, arrow, door, laid out the way the arrow points."""
    if way in ('left', 'right'):
        w, h = 66 * scale, 24 * scale
        g = [f'<rect x="{-w / 2}" y="{-h / 2}" width="{w}" height="{h}" rx="{4 * scale}" fill="{GREEN}"/>']
        d = 1 if way == 'right' else -1
        g.append(f'<g transform="translate({-d * 21 * scale - 10 * scale} {-10 * scale}) scale({20 * scale / 24:.3f})">'
                 f'<g {LINE}{" transform=&quot;translate(24 0) scale(-1 1)&quot;" if d < 0 else ""}>{RUNNER}</g></g>')
        ax0, ax1 = -d * 6 * scale, d * 13 * scale
        g.append(f'<path d="M{ax0} 0H{ax1}M{ax1 - d * 5 * scale} {-5 * scale}L{ax1} 0L{ax1 - d * 5 * scale} {5 * scale}" {LINE}/>')
        g.append(f'<rect x="{d * 24 * scale - 4.5 * scale}" y="{-7 * scale}" width="{9 * scale}" height="{14 * scale}" rx="1" fill="#fff"/>')
    else:
        w, h = 24 * scale, 66 * scale
        g = [f'<rect x="{-w / 2}" y="{-h / 2}" width="{w}" height="{h}" rx="{4 * scale}" fill="{GREEN}"/>',
             f'<rect x="{-4.5 * scale}" y="{-30 * scale}" width="{9 * scale}" height="{12 * scale}" rx="1" fill="#fff"/>',
             f'<path d="M0 {6 * scale}V{-13 * scale}M{-5 * scale} {-8 * scale}L0 {-13 * scale}L{5 * scale} {-8 * scale}" {LINE}/>',
             f'<g transform="translate({-10 * scale} {9 * scale}) scale({20 * scale / 24:.3f})"><g {LINE}>{RUNNER}</g></g>']
    return f'<g transform="translate({x:.1f} {y:.1f})">{"".join(g)}</g>'

def text(x, y, s, size, weight=400, fill=INK, anchor='start', extra=''):
    return f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}" {extra}>{s}</text>'

ARROW = 'M-7 -2.6H.5V-6.5L8 0 .5 6.5V2.6H-7Z'

def arrow_chain(pts, keep_clear, step=30, start=12):
    """Arrows along a page-space polyline, pointing the way it runs. Skips spots under signs and icons."""
    out, carry = [], start
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        seg = math.hypot(x1 - x0, y1 - y0)
        ang = math.degrees(math.atan2(y1 - y0, x1 - x0))
        d = carry
        while d <= seg:
            x, y = x0 + (x1 - x0) * d / seg, y0 + (y1 - y0) * d / seg
            if not any(_covers(c, x, y) for c in keep_clear):
                out.append(f'<path d="{ARROW}" transform="translate({x:.1f} {y:.1f}) rotate({ang:.0f})" fill="{GREEN}"/>')
            d += step
        carry = d - seg
    return out

def _covers(c, x, y):
    if len(c) == 3:                                   # round icon: centre and radius
        return math.hypot(x - c[0], y - c[1]) < c[2]
    cx, cy, _, way = c                                # exit sign: its rectangle plus a little room
    w, h = (40, 22) if way in ('left', 'right') else (22, 40)
    return abs(x - cx) < w and abs(y - cy) < h

def exit_symbol(size):
    """Green exit sign: a figure running to a door, centred on (0, size/2) so a label can go under it."""
    s = size / 24
    return (f'<rect x="{-size / 2}" y="0" width="{size}" height="{size}" rx="{size * .14:.1f}" fill="{GREEN}"/>'
            f'<rect x="{-size / 2 + size * .14:.1f}" y="{size * .16:.1f}" width="{size * .26:.1f}" height="{size * .68:.1f}" '
            f'fill="none" stroke="#fff" stroke-width="{2.2 * s:.1f}" rx="1"/>'
            f'<g transform="translate({-size * .12:.1f} {size * .14:.1f}) scale({s * .78:.3f})">'
            f'<g {LINE} transform="translate(24 0) scale(-1 1)">{RUNNER}</g></g>')

def build(labels):
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{PW}" height="{PH}" viewBox="0 0 {PW} {PH}" font-family="Golos, sans-serif">',
         f'<style>{font_faces()} text{{font-feature-settings:"tnum"}}</style>',
         f'<defs><marker id="head" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">'
         f'<path d="M0 0L10 5L0 10z" fill="{GREEN}"/></marker>'
         f'<pattern id="yard" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#F4F6F2"/>'
         f'<circle cx="7" cy="7" r="1" fill="#DCE3DA"/></pattern></defs>',
         f'<rect width="{PW}" height="{PH}" fill="#fff"/>',
         f'<rect x="18" y="18" width="{PW - 36}" height="{PH - 36}" rx="14" fill="none" stroke="#D9DEE2" stroke-width="2"/>']
    # Header
    o.append(text(48, 86, labels['T1'], 38, 700))
    o.append(text(48, 122, labels['T2'], 21, 500, MUTED))
    o.append(f'<g transform="translate({PW - 48} 58)"><rect x="-262" y="0" width="262" height="58" rx="12" fill="{RED}"/>'
             f'{text(-237, 38, labels["P1"], 22, 600, "#fff")}{text(-22, 41, "101", 34, 800, "#fff", "end")}</g>')
    # Building: fills, then walls
    pts = ' '.join('%.1f,%.1f' % P(x, y) for x, y in OUTLINE)
    o.append(f'<polygon points="{pts}" fill="#fff"/>')
    yard = ' '.join('%.1f,%.1f' % P(x, y) for x, y in YARD)
    o.append(f'<polygon points="{yard}" fill="url(#yard)"/>')
    for x0, y0, x1, y1 in HALLS:
        o.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="#EEF1F3"/>' % R(x0, y0, x1, y1))
    for n, x0, y0, x1, y1 in ROOMS:
        o.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="#fff" stroke="#8A949D" stroke-width="1.4"/>' % R(x0, y0, x1, y1))
        if n:
            cx, cy = P((x0 + x1) / 2, (y0 + y1) / 2)
            o.append(text(cx, cy + 6, n, 17, 600, '#3A4148', 'middle'))
    for wall in WALLS:
        wpts = ' '.join('%.1f,%.1f' % P(x, y) for x, y in wall)
        o.append(f'<polyline points="{wpts}" fill="none" stroke="{INK}" stroke-width="4.5" stroke-linejoin="round"/>')
    o.append(f'<polyline points="{yard}" fill="none" stroke="#8A949D" stroke-width="1.4"/>')
    # Yard: the shed and the ger-like round building, and the label
    o.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="3" fill="#E4E8EB" stroke="#A3ADB5" stroke-width="1.4"/>' % R(345, 261, 397, 314))
    cx, cy = P(473, 290)
    o.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{47 * K:.1f}" fill="#E4E8EB" stroke="#A3ADB5" stroke-width="1.4"/>')
    lx, ly = P(424, 205)
    o.append(text(lx, ly, labels['L5'], 18, 500, '#7B8780', 'middle', 'letter-spacing="0.5"'))
    # Doors to the yard and the main exit: openings in the wall, marked green
    for x0, y0, x1, y1 in DOORS:
        (a, b), (c, d) = P(x0, y0), P(x1, y1)
        o.append(f'<line x1="{a:.1f}" y1="{b:.1f}" x2="{c:.1f}" y2="{d:.1f}" stroke="#fff" stroke-width="7"/>')
        o.append(f'<line x1="{a:.1f}" y1="{b:.1f}" x2="{c:.1f}" y2="{d:.1f}" stroke="{GREEN}" stroke-width="5" stroke-linecap="round"/>')
    # Routes: small arrows every 30 px along each centre line, left out where a sign or icon sits
    keep_clear = ([(*P(x, y), 21) for x, y in EXTINGUISHERS + ALARMS] +
                  [(*P(x, y), 0, way) for x, y, way in SIGNS])
    for line in ROUTES:
        o.extend(arrow_chain([P(*pt) for pt in line], keep_clear))
    # Main exit: a standard exit symbol outside the door
    ex, ey = P(515, 539)
    o.append(f'<g transform="translate({ex:.1f} {ey:.1f})">{exit_symbol(52)}'
             f'{text(38, 34, labels["L6"], 19, 700, GREEN, "start", "letter-spacing=&quot;0.6&quot;")}</g>')
    tx, ty = P(181.5, 23)
    o.append(f'<g transform="translate({tx:.1f} {ty - 50:.1f})">{exit_symbol(40)}'
             f'{text(30, 27, labels["L7"], 17, 700, GREEN, "start", "letter-spacing=&quot;0.6&quot;")}</g>')
    # Equipment and signs
    for x, y in EXTINGUISHERS:
        o.append(icon(EXTINGUISHER, *P(x, y), 25, RED))
    for x, y in ALARMS:
        o.append(alarm(*P(x, y), 22))
    for x, y, way in SIGNS:
        o.append(exit_sign(*P(x, y), way, .95))
    # Footer: legend, then phone numbers. Labels sit in a left column, items in fixed columns so nothing overlaps.
    fy = 972
    o.append(f'<line x1="48" y1="{fy}" x2="{PW - 48}" y2="{fy}" stroke="#E3E7EA" stroke-width="2"/>')
    ly = fy + 44
    o.append(text(48, ly + 6, labels['L0'], 14, 700, MUTED, extra='letter-spacing="1.2"'))
    for x, kind, w, label in [(300, 'route', 76, labels['L1']), (560, 'exit', 80, labels['L2']),
                              (840, 'ext', 40, labels['L3']), (1150, 'alarm', 38, labels['L4'])]:
        if kind == 'route':
            o.extend(arrow_chain([(x, ly), (x + 62, ly)], [], step=26, start=8))
        elif kind == 'exit':
            o.append(exit_sign(x + 33, ly, 'right', .95))
        elif kind == 'ext':
            o.append(icon(EXTINGUISHER, x + 13, ly, 27, RED))
        else:
            o.append(alarm(x + 12, ly, 24))
        o.append(text(x + w, ly + 7, label, 19, 500))
    py = ly + 58
    o.append(text(48, py, labels['P0'], 14, 700, MUTED, extra='letter-spacing="1.2"'))
    phones = [(labels['P2'], '103'), (labels['P3'], '8870 7708'), (labels['P4'], '7019 4612'), (labels['P5'], '7053 5505')]
    spans = ''.join(f'<tspan dx="{0 if i == 0 else 44}" fill="{MUTED}" font-weight="500" font-size="18">{n}</tspan>'
                    f'<tspan dx="10" fill="{INK}" font-weight="700" font-size="24">{num}</tspan>' for i, (n, num) in enumerate(phones))
    o.append(f'<text x="300" y="{py + 2}">{spans}</text>')
    return '\n'.join(o + ['</svg>'])

if __name__ == '__main__':
    import json
    labels = json.loads((HERE / 'labels.json').read_text(encoding='utf-8'))
    svg = build(labels)
    (HERE / 'plan.svg').write_text(svg, encoding='utf-8')
    print('plan.svg', len(svg) // 1024, 'KB')
