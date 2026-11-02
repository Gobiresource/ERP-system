# Pixel-art mascot, drawn from parts so a pose can swap the eyes, mouth, arms and legs.
# Coordinates are in a 56x72 design space; the canvas adds room around it (OX, OY) for raised
# arms, jumps and the sticker edge. Letters in sprites are palette keys, '.' is empty.
OX, OY = 6, 14
W, H = 56 + 2 * OX, 72 + OY + 6
PAL = {
    'K': '#2a1a1f', 'C': '#f4ecd8',                   # outline / sticker edge
    'H': '#8a3a2a', 'h': '#b0563c', 'J': '#5a2219',   # hair, its light and dark
    'S': '#f0bf98', 's': '#d79a76', 'Q': '#ee9c86',   # skin, shadow, blush
    'G': '#1d1a1f', 'L': '#d8ecff',                   # glasses frame, lens glint
    'E': '#2b1a14', 'W': '#ffffff', 'w': '#dcd8d4',   # eyes / white / white shade
    'M': '#5a1e22', 'N': '#e0646a',                   # mouth, tongue
    'R': '#bc1f29', 'r': '#8e1620', 'P': '#d8434c',   # hoodie (logo red), shadow, light
    'B': '#2f3550', 'b': '#20253a', 'z': '#a4a3ab',   # jeans, shade, shoe sole
}


class Canvas:
    def __init__(self, lift=0):
        self.px = {}
        self.lift = lift          # whole character raised by this many pixels (jumps)

    def set(self, x, y, c):
        x += OX
        y += OY - self.lift
        if 0 <= x < W and 0 <= y < H:
            self.px[(x, y)] = c

    def get(self, x, y):
        return self.px.get((x + OX, y + OY - self.lift))

    def span(self, y, x0, x1, c):
        for x in range(x0, x1 + 1):
            self.set(x, y, c)

    def pix(self, pts, c, dy=0):
        for (x, y) in pts:
            self.set(x, y + dy, c)


# Eyes are 4 pixels wide, drawn at x0 = 19 (left lens) and 33 (right lens), rows 20-22.
# 'closed' starts one pixel further left. '.' leaves the lens as it is.
EYES = {
    'open':   ['EEEE', 'WWEW', 'WEEW'],
    'side':   ['EEEE', 'W.WE', 'W.EE'],
    'up':     ['EEEE', 'W.EW', 'W.EE'],
    'happy':  ['....', '.EE.', 'E..E'],
    'closed': ['.....', 'E....', '.EEEE'],
}
# Mouths: rows from y = 29, columns from x = 23.
MOUTHS = {
    'smile': ['M........M', '.MMMMMMMM.'],
    'open':  ['MMMMMMMMMM', 'MWWWWWWWWM', '.MNNNNNNM.', '..MMMMMM..'],
    'talk':  ['.MMMMMMMM.', '.MNNNNNNM.', '..MMMMMM..'],
    'o':     ['...MMMM...', '..MNNNNM..', '..MNNNNM..', '...MMMM...'],
    'flat':  ['..........', '..MMMMMM..'],
}


def head(c, eyes='open', mouth='smile', brows='flat', d=0):
    # hair: top edge with three soft tufts, filled down to the face
    top = [10, 8, 7, 6, 5, 4, 4, 3, 3, 2, 3, 3, 2, 1, 2, 3, 2, 2, 1, 2, 3, 3, 3, 4, 4, 5, 5, 6, 7, 8, 9, 10]
    for i, y0 in enumerate(top):
        for y in range(y0, 20):
            c.set(12 + i, y + d, 'H')
    for y in range(10, 30):
        c.span(y + d, 15, 40, 'S')
    for y, (x0, x1) in {30: (16, 39), 31: (17, 38), 32: (18, 37), 33: (20, 35), 34: (22, 33)}.items():
        c.span(y + d, x0, x1, 'S')
    # fringe over the forehead, swept to the right, with a dark lower edge
    fringe = [15, 15, 15, 14, 14, 14, 13, 13, 14, 13, 13, 12, 12, 13, 12, 12, 11, 11, 12, 11, 11, 12, 12, 13, 13, 14]
    for i, yb in enumerate(fringe):
        for y in range(9, yb + 1):
            c.set(15 + i, y + d, 'H')
        c.set(15 + i, yb + d, 'J')
    c.pix([(19, 4), (20, 4), (21, 3), (22, 4), (23, 5), (24, 5), (25, 2), (26, 3), (27, 4), (28, 5), (30, 2), (31, 3),
           (32, 4), (33, 5), (34, 6), (17, 6), (18, 6), (36, 6), (37, 7), (15, 8), (38, 8)], 'h', d)
    c.pix([(22, 6), (23, 7), (27, 7), (28, 8), (32, 7), (33, 8), (19, 9), (36, 10), (24, 10), (29, 9)], 'J', d)
    for y in range(14, 22):
        c.set(15, y + d, 'J'); c.set(40, y + d, 'J')      # sideburns
    for y in range(9, 20):
        c.set(12, y + d, 'J'); c.set(43, y + d, 'J')      # side hair
    # ears and jaw shadow
    for y in range(20, 27):
        c.span(y + d, 12, 14, 'S'); c.span(y + d, 41, 43, 'S')
    for y in range(21, 26):
        c.set(13, y + d, 's'); c.set(42, y + d, 's')
    c.pix([(38, 30), (37, 31), (36, 32), (35, 33), (34, 33), (33, 34), (39, 29), (39, 28)], 's', d)
    # brows: 'up' raises both, 'think' raises and arches the right one
    y = 16 if brows == 'up' else 17
    c.span(y + d, 18, 23, 'J'); c.set(17, y + 1 + d, 'J')
    if brows == 'think':
        c.span(15 + d, 33, 37, 'J'); c.set(32, 16 + d, 'J'); c.set(38, 16 + d, 'J')
    else:
        c.span(y + d, 32, 37, 'J'); c.set(38, y + 1 + d, 'J')
    # glasses
    for (a, b) in ((16, 25), (30, 39)):
        c.span(19 + d, a, b, 'G'); c.span(24 + d, a, b, 'G')
        for y in range(19, 25):
            c.set(a, y + d, 'G'); c.set(b, y + d, 'G')
    c.span(20 + d, 26, 29, 'G'); c.span(20 + d, 13, 15, 'G'); c.span(20 + d, 40, 42, 'G')
    c.set(24, 20 + d, 'L'); c.set(38, 20 + d, 'L')
    rows = EYES[eyes]
    for x0 in (19, 33):
        x0 -= 1 if eyes == 'closed' else 0
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != '.':
                    c.set(x0 + i, 20 + j + d, ch)
    # nose, blush, mouth
    c.set(27, 26 + d, 's'); c.span(27 + d, 27, 28, 's')
    c.span(27 + d, 17, 19, 'Q'); c.span(27 + d, 36, 38, 'Q')
    for j, row in enumerate(MOUTHS[mouth]):
        for i, ch in enumerate(row):
            if ch != '.':
                c.set(23 + i, 29 + j + d, ch)


def torso(c, d=0):
    # hood bunched around the neck, then the open hoodie over a white t-shirt
    for y, (x0, x1) in {32: (15, 17), 33: (15, 19), 34: (14, 21)}.items():
        c.span(y + d, x0, x1, 'R'); c.span(y + d, 55 - x1, 55 - x0, 'R')
    c.span(35 + d, 14, 41, 'R'); c.span(36 + d, 14, 41, 'R'); c.span(37 + d, 13, 42, 'R'); c.span(38 + d, 13, 42, 'R')
    for y in range(39, 55):
        c.span(y + d, 15, 40, 'R')
    c.span(35 + d, 23, 32, 's'); c.span(36 + d, 24, 31, 's')            # neck
    for y in range(37, 54):
        c.span(y + d, 24, 31, 'W'); c.set(24, y + d, 'w')
    for y in range(36, 54):
        c.set(23, y + d, 'r'); c.set(32, y + d, 'r')                     # zip edges
    c.pix([(16, 33), (17, 34), (18, 34), (19, 35), (20, 35), (21, 36), (22, 36)], 'r', d)   # hood rim
    c.pix([(39, 33), (38, 34), (37, 34), (36, 35), (35, 35), (34, 36), (33, 36)], 'r', d)
    c.span(37 + d, 16, 20, 'P'); c.span(37 + d, 35, 39, 'P')
    for y in range(40, 53):
        c.set(39, y + d, 'r'); c.set(40, y + d, 'r')
    c.span(53 + d, 15, 40, 'r'); c.span(54 + d, 15, 40, 'r')            # hem
    # the logo's white triangle on the left chest
    c.set(36, 41 + d, 'W'); c.span(42 + d, 35, 37, 'W'); c.span(43 + d, 34, 38, 'W'); c.span(44 + d, 33, 39, 'W')


# Raised arms, drawn for the right side of the picture (the left arm uses them mirrored),
# and the thinking arm, drawn for the left side. (x, y) is the sprite's top-left pixel.
ARMS = {
    'up': (41, 17, [
        ".......S.S.S...",
        ".......S.S.S.S.",
        "......SSSSSSSS.",
        ".....SSSSSSSSs.",
        ".....SSSSSSSs..",
        "......SSSSSs...",
        ".......SSSs....",
        ".......rrrrr...",
        ".......rrrrr...",
        ".......RRRRr...",
        ".......PRRRr...",
        "......PRRRRr...",
        "......PRRRRr...",
        "......PRRRRr...",
        ".....PRRRRr....",
        "....PRRRRRr....",
        "...PRRRRRr.....",
        "..PRRRRRr......",
        ".PRRRRRr.......",
        "RRRRRRr........",
        "RRRRRr.........",
        "RRRRr..........",
        "RRRRr..........",
        "RRRRr..........",
    ]),
    'up2': (41, 17, [         # same arm with the hand tipped out, for waving
        ".........S.S.S...",
        ".........S.S.S.S.",
        "........SSSSSSSS.",
        ".......SSSSSSSSs.",
        ".......SSSSSSSs..",
        "........SSSSSs...",
        ".........SSSs....",
        "........rrrrr..",
        "........rrrrr..",
        "........RRRRr..",
        ".......PRRRr...",
        ".......PRRRRr..",
        "......PRRRRr...",
        "......PRRRRr...",
        ".....PRRRRr....",
        "....PRRRRRr....",
        "...PRRRRRr.....",
        "..PRRRRRr......",
        ".PRRRRRr.......",
        "RRRRRRr........",
        "RRRRRr.........",
        "RRRRr..........",
        "RRRRr..........",
        "RRRRr..........",
    ]),
    'point': (41, 19, [
        "...............SS",
        "..............SSs",
        ".............SSs.",
        "..........SSSSs..",
        ".........SSSSSS..",
        ".........SSSSSs..",
        ".........SSSSSs..",
        "..........ssss...",
        ".........rrrr....",
        "........rrrrr....",
        ".......PRRRr.....",
        "......PRRRr......",
        ".....PRRRRr......",
        "....PRRRRr.......",
        "...PRRRRr........",
        "..PRRRRr.........",
        ".PRRRRr..........",
        "RRRRRr...........",
        "RRRRr............",
        "RRRRr............",
        "RRRRr............",
        "RRRRr............",
    ]),
    'chin': (10, 31, [        # hand under the chin, forearm across the chest
        ".............S......",
        "............SS......",
        "............SSSSS...",
        "...........SSSSSSs..",
        "...........SSSSSSs..",
        "...........SSSSSs...",
        "RRRRr.......ssss....",
        "RRRRr.....rrrrr.....",
        "RRRRr....rrrrr......",
        "RRRRr...PRRRr.......",
        "RRRRr..PRRRr........",
        "RRRRr.PRRRr.........",
        "RRRRrPRRRr..........",
        "RRRRPRRRr...........",
        "RRRPRRRr............",
        "RRRRRRr.............",
        "RRRRRr..............",
    ]),
}


def hand_fist(c, x, y, mirror=False):
    for j, row in enumerate(['SSSS.', 'SSSSs', 'SSSSs', '.sss.']):
        for i, ch in enumerate(row[::-1] if mirror else row):
            if ch != '.':
                c.set(x + i, y + j, ch)


def arm(c, side, pose='rest', d=0, lift=0):
    """side 'L' or 'R' as seen in the picture; lift raises a resting hand (walk swing)."""
    right = side == 'R'
    if pose == 'rest':
        X = (lambda x: 55 - x) if right else (lambda x: x)
        for y in range(38, 50):
            for x in range(10, 15):
                c.set(X(x), y + d, 'R')
        for y in range(40, 49):
            c.set(X(14), y + d, 'r')
        for x in range(10, 15):
            c.set(X(x), 49 + d, 'r'); c.set(X(x), 50 + d - lift, 'r')
        hand_fist(c, X(14) if right else 10, 51 + d - lift, right)
        return
    flip = (right and pose == 'chin') or (not right and pose != 'chin')
    X = (lambda x: 55 - x) if flip else (lambda x: x)
    x0, y0, rows = ARMS[pose]
    pts = {(i, j): ch for j, row in enumerate(rows) for i, ch in enumerate(row) if ch != '.'}
    if pose == 'chin':
        # edge where the arm crosses the body: dark red on the hoodie, outline colour on skin and shirt;
        # over empty space the normal outline is added later
        for (i, j) in pts:
            for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if (i + di, j + dj) not in pts:
                    gx, gy = X(x0 + i + di), y0 + j + dj + d
                    under = c.get(gx, gy)
                    if under:
                        c.set(gx, gy, 'r' if under in 'RrP' else 'K')
    for (i, j), ch in pts.items():
        c.set(X(x0 + i), y0 + j + d, ch)


def legs(c, pose='stand'):
    """'stepL' / 'stepR' lift one foot for walking, 'tuck' lifts both in a jump."""
    def leg(x0, x1, up, sx0, sx1):
        for y in range(57, 63 - up):
            c.span(y, x0, x1, 'B'); c.set(x1, y, 'b')
        shoe = 63 - up
        for y in range(shoe, shoe + 3):
            c.span(y, sx0, sx1, 'W')
        c.span(shoe + 2, sx0, sx1, 'z'); c.set(sx0 + 3, shoe, 'w'); c.set(sx0 + 5, shoe, 'w')
    c.span(55, 17, 38, 'B'); c.span(56, 17, 38, 'B')
    up_l, up_r = {'stand': (0, 0), 'stepL': (2, 0), 'stepR': (0, 2), 'tuck': (3, 3)}[pose]
    leg(17, 26, up_l, 15, 26)
    leg(29, 38, up_r, 29, 40)


def outline(c, color='K'):
    edge = {(x + dx, y + dy) for (x, y) in c.px for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            if (x + dx, y + dy) not in c.px}
    for p in edge:
        c.px[p] = color


def sticker(c, width=2):
    """Light edge around the outline, like a die-cut sticker."""
    for _ in range(width):
        edge = {(x + dx, y + dy) for (x, y) in c.px for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                if (x + dx, y + dy) not in c.px and 0 <= x + dx < W and 0 <= y + dy < H}
        for p in edge:
            c.px[p] = 'C'


def build(eyes='open', mouth='smile', brows='flat', larm='rest', rarm='rest', leg='stand', d=0, lift=(0, 0),
          jump=0, stick=False):
    """One frame. d moves the upper body down (breathing, crouch); jump raises everything."""
    c = Canvas(jump)
    legs(c, leg)
    torso(c, d)
    if larm != 'chin':
        arm(c, 'L', larm, d, lift[0])
    arm(c, 'R', rarm, d, lift[1])
    head(c, eyes, mouth, brows, d)
    if larm == 'chin':
        arm(c, 'L', larm, d)          # the thinking hand sits in front of the face
    outline(c)
    if stick:
        sticker(c)
    return c


def to_grid(c):
    return [''.join(c.px.get((x, y), '.') for x in range(W)) for y in range(H)]


def rgb(key):
    h = PAL[key]
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
