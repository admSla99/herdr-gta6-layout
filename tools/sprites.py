"""Draws the Leonida crew: 24x24 pixel-art SVG frames for the vice-crew mod.

Each character has four frames: work, work-2, idle, idle-2. Blocked and done reuse
the idle frame with a badge drawn by the mod on top (badge-*.svg here).

    python tools/sprites.py <out dir>     (default: ~/.config/herdr-app/mods/vice-crew/sprites)
"""

import os
import sys

N = 24
OUTLINE = "#1a0f2e"
SCALE = 2  # declared size = 48px: Herdr rasterizes an SVG at its declared size.


class Canvas:
    def __init__(self, n=N):
        self.n = n
        self.px = {}
        self.fx = {}  # effects: drawn after the outline, never outlined
        self.oy = 0
        self.ox = 0

    def set(self, x, y, c, fx=False):
        x += self.ox
        y += self.oy
        if 0 <= x < self.n and 0 <= y < self.n:
            (self.fx if fx else self.px)[(x, y)] = c

    def rect(self, x, y, w, h, c, fx=False):
        for j in range(h):
            for i in range(w):
                self.set(x + i, y + j, c, fx)

    def dots(self, pts, c, fx=False):
        for x, y in pts:
            self.set(x, y, c, fx)

    def svg(self):
        pix = dict(self.px)
        for (x, y) in list(self.px):
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if q not in self.px and 0 <= q[0] < self.n and 0 <= q[1] < self.n:
                    pix[q] = OUTLINE
        pix.update(self.fx)
        rects = []
        for y in range(self.n):
            x = 0
            while x < self.n:
                c = pix.get((x, y))
                if c is None:
                    x += 1
                    continue
                run = 1
                while pix.get((x + run, y)) == c:
                    run += 1
                rects.append(f'<rect x="{x}" y="{y}" width="{run}" height="1" fill="{c}"/>')
                x += run
        size = self.n * SCALE
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.n} {self.n}" '
                f'width="{size}" height="{size}" shape-rendering="crispEdges">' + "".join(rects) + "</svg>\n")


# --- a front-facing chibi body -------------------------------------------------------------

def body(c, skin, shirt, pants, shoes, sleeve=None, arms=("down", "down"), legs_skin=False, eyes="open", eye=OUTLINE):
    sleeve = sleeve or shirt
    # head 8x8
    c.rect(8, 3, 8, 8, skin)
    # eyes
    if eyes == "open":
        c.dots([(10, 7), (13, 7)], eye)
    elif eyes == "closed":
        c.dots([(9, 7), (10, 7), (13, 7), (14, 7)], "#00000055")
    elif eyes == "side":
        c.dots([(11, 7), (14, 7)], eye)
    # neck + torso
    c.rect(10, 11, 4, 1, skin)
    c.rect(8, 11, 8, 7, shirt)
    # legs
    leg = skin if legs_skin else pants
    c.rect(8, 18, 8, 1, pants)
    c.rect(9, 19, 2, 3, leg)
    c.rect(13, 19, 2, 3, leg)
    c.rect(8, 22, 3, 1, shoes)
    c.rect(13, 22, 3, 1, shoes)
    for side, pose in zip(("l", "r"), arms):
        arm(c, side, pose, skin, sleeve)


def arm(c, side, pose, skin, sleeve):
    x = 6 if side == "l" else 16
    if pose == "down":
        c.rect(x, 11, 2, 3, sleeve)
        c.rect(x, 14, 2, 3, skin)
    elif pose == "up":
        c.rect(x, 8, 2, 4, sleeve)
        c.rect(x, 5, 2, 3, skin)
    elif pose == "front":
        c.rect(x, 11, 2, 3, sleeve)
        hx = 8 if side == "l" else 14
        c.rect(x, 14, 2, 1, skin)
        c.rect(hx, 14, 2, 2, skin)
    elif pose == "mouth":  # hand to the mouth
        c.rect(x, 11, 2, 2, sleeve)
        hx = 13 if side == "r" else 9
        c.rect(x, 13, 2, 1, sleeve)
        c.rect(hx, 9, 2, 3, skin)


# --- the crew ------------------------------------------------------------------------------

def bandit(frame):
    c = Canvas()
    skin, shirt, pants, shoes = "#8d5a3b", "#f1ece4", "#2c3a63", "#f1ece4"
    bag = "#2a2836"
    cash = "#6fcf5a"
    if frame == "work":
        body(c, skin, shirt, pants, shoes, arms=("down", "down"))
        c.rect(16, 16, 6, 4, bag); c.rect(17, 15, 4, 1, bag); c.set(18, 17, "#d4b45a")
        c.dots([(20, 7), (21, 7), (3, 11), (4, 11)], cash, fx=True)
        c.dots([(19, 10), (20, 10)], cash, fx=True)
    elif frame == "work-2":
        body(c, skin, shirt, pants, shoes, arms=("down", "up"))
        c.rect(15, 1, 6, 4, bag); c.rect(16, 5, 4, 1, bag); c.set(17, 2, "#d4b45a")
        c.dots([(21, 9), (22, 9), (2, 6), (3, 6), (20, 13), (21, 13)], cash, fx=True)
    else:
        body(c, skin, shirt, pants, shoes, arms=("front", "front"), eyes="side" if frame == "idle-2" else "open")
    # cap
    c.rect(8, 2, 8, 3, "#1e1b2e"); c.rect(7, 5, 10, 1, "#1e1b2e"); c.set(12, 2, "#c8283c")
    # paisley bandana over the face
    red = "#c8283c"
    c.rect(8, 8, 8, 3, red); c.rect(10, 11, 4, 1, red); c.rect(11, 12, 2, 1, red)
    c.dots([(9, 9), (12, 8), (14, 10), (11, 10)], "#f5d6dc")
    return c


def driver(frame):
    c = Canvas()
    skin, pink, teal, white = "#e0ac82", "#ff7eb6", "#23c4b4", "#efe7da"
    if frame in ("work", "work-2"):
        body(c, skin, pink, white, "#b7895b", arms=("front", "front"))
        c.rect(10, 11, 4, 7, teal)
        ring = "#d8dae8"
        # steering wheel in front of the chest
        c.rect(9, 13, 6, 1, ring); c.rect(9, 19, 6, 1, ring)
        c.rect(7, 15, 1, 3, ring); c.rect(16, 15, 1, 3, ring)
        c.dots([(8, 14), (15, 14), (8, 18), (15, 18)], ring)
        if frame == "work":
            c.rect(8, 16, 8, 1, ring)
        else:
            c.dots([(9, 18), (10, 17), (11, 16), (12, 16), (13, 15), (14, 14)], ring)
        c.rect(11, 16, 2, 1, "#ff4f9a")
        # speed lines
        lines = [(1, 9), (2, 9), (3, 9), (0, 13), (1, 13), (21, 11), (22, 11), (23, 11)] if frame == "work" else \
                [(2, 11), (3, 11), (4, 11), (1, 15), (2, 15), (20, 8), (21, 8), (22, 8)]
        c.dots(lines, "#ffffffaa", fx=True)
    else:
        sip = frame == "idle-2"
        body(c, skin, pink, white, "#b7895b", arms=("down", "mouth" if sip else "down"))
        c.rect(10, 11, 4, 7, teal)
        cup = (13, 9) if sip else (16, 16)
        cx, cy = cup
        c.rect(cx + 1 if sip else cx, cy + 2, 3, 4, "#f4f0ea"); c.rect(cx + 1 if sip else cx, cy + 3, 3, 1, "#e2384f")
        c.rect(cx + 2 if sip else cx + 1, cy, 1, 2, "#ff4f9a")
    # slick pompadour + aviators
    c.rect(8, 1, 8, 3, "#1c1424"); c.rect(9, 0, 6, 1, "#1c1424"); c.rect(8, 4, 1, 2, "#1c1424"); c.rect(15, 4, 1, 2, "#1c1424")
    c.rect(9, 6, 6, 2, "#1c1424"); c.set(10, 6, "#ff9fd0"); c.set(13, 6, "#ff9fd0")
    return c


def hacker(frame):
    c = Canvas()
    skin, hood, pants = "#d7a27c", "#7b4fd6", "#262640"
    work = frame in ("work", "work-2")
    body(c, skin, hood, pants, "#e8e8f0", arms=("front", "front") if work else ("down", "down"),
         eyes="open" if work or frame == "idle" else "closed")
    # hood around the face
    c.rect(7, 2, 10, 2, hood); c.rect(7, 4, 2, 7, hood); c.rect(15, 4, 2, 7, hood); c.rect(9, 4, 6, 1, hood)
    c.rect(10, 13, 4, 1, "#5d3aa8")  # pocket line
    # glasses
    c.dots([(9, 7), (10, 7), (13, 7), (14, 7)], "#1c1424"); c.set(11, 7, "#1c1424"); c.set(12, 7, "#1c1424")
    if work:
        glow = "#1fd1c1" if frame == "work" else "#7ff5e9"
        c.dots([(9, 7), (14, 7)], glow)
        # laptop lid towards us
        c.rect(6, 13, 12, 5, "#c9cbe0"); c.rect(5, 18, 14, 1, "#8f92ab"); c.set(11, 15, "#ff4f9a"); c.set(12, 15, "#ff4f9a")
        bits = [(2, 4), (3, 4), (20, 6), (21, 3), (4, 8)] if frame == "work" else [(3, 6), (19, 3), (20, 4), (21, 8), (2, 2)]
        c.dots(bits, "#4dff9a", fx=True)
    else:
        # headphones
        c.rect(8, 1, 8, 1, "#1fd1c1"); c.rect(6, 6, 2, 3, "#1fd1c1"); c.rect(16, 6, 2, 3, "#1fd1c1")
        if frame == "idle-2":
            c.dots([(20, 3), (20, 4), (20, 5), (19, 5), (21, 3)], "#ffd166", fx=True)
            c.dots([(3, 6), (3, 7), (3, 8), (2, 8), (4, 6)], "#ffd166", fx=True)
    return c


def tourist(frame):
    c = Canvas()
    skin, shirt, shorts = "#f0a07a", "#ff9447", "#d9c49a"
    work = frame in ("work", "work-2")
    sip = frame == "idle-2"
    body(c, skin, shirt, shorts, "#7a4a2a",
         arms=("front", "front") if work else ("down", "mouth" if sip else "down"), legs_skin=True)
    # flowers on the shirt
    c.dots([(9, 12), (14, 13), (11, 15), (15, 16), (8, 16)], "#fff3e0")
    c.dots([(10, 12), (13, 15)], "#ff4f9a")
    c.set(11, 9, "#e0604a")  # red nose
    # sunhat
    c.rect(8, 0, 8, 3, "#f2d48a"); c.rect(8, 2, 8, 1, "#ff4f9a"); c.rect(5, 3, 14, 1, "#f2d48a")
    if work:
        c.rect(9, 12, 6, 4, "#2a2836"); c.rect(11, 13, 2, 2, "#8ad7ff"); c.set(13, 12, "#e2384f")
        if frame == "work-2":
            c.dots([(19, 8), (20, 9), (21, 10), (20, 7), (20, 11), (18, 9), (22, 9), (19, 10), (21, 8)], "#fff6b0", fx=True)
            c.set(20, 9, "#ffffff", fx=True)
    else:
        x, y = (13, 9) if sip else (16, 15)
        c.rect(x, y + 1, 4, 3, "#7a4a2a"); c.rect(x + 1, y + 1, 2, 1, "#f4e6c8")
        c.rect(x + 2, y - 2, 1, 3, "#ff4f9a"); c.rect(x + 3, y - 3, 3, 1, "#1fd1c1")
    return c


def skater(frame):
    c = Canvas()
    skin, tank, shorts = "#c68a5e", "#ff4f9a", "#5a5f7a"
    deck, wheel = "#ff9447", "#f4f0ea"
    if frame in ("work", "work-2"):
        up = frame == "work-2"
        c.oy = -2 if up else -1
        body(c, skin, tank, shorts, "#f4f0ea", arms=("up", "down") if up else ("down", "down"))
        c.rect(6, 11, 2, 1, skin)  # bare shoulders
        c.rect(16, 11, 2, 1, skin)
        c.oy = 0
        if up:
            # tilted board under the feet, mid ollie
            for i, x in enumerate(range(5, 19)):
                c.set(x, 22 - i // 5, deck)
            c.dots([(7, 23), (16, 21)], wheel)
            c.dots([(2, 22), (3, 22), (21, 22), (22, 22), (1, 21), (22, 21)], "#ffffffaa", fx=True)
        else:
            c.rect(5, 22, 14, 1, deck); c.dots([(7, 23), (16, 23)], wheel)
    else:
        body(c, skin, tank, shorts, "#f4f0ea")
        c.rect(6, 11, 2, 1, skin); c.rect(16, 11, 2, 1, skin)
        c.rect(18, 9, 2, 13, deck); c.dots([(20, 10), (20, 20)], wheel)
        if frame == "idle-2":
            c.rect(10, 8, 4, 4, "#ff8fc7"); c.rect(11, 7, 2, 1, "#ff8fc7"); c.rect(11, 12, 2, 1, "#ff8fc7")
            c.set(11, 9, "#ffd3ea")
    # backwards cap
    c.rect(8, 2, 8, 3, "#1fd1c1"); c.rect(7, 4, 2, 2, "#1fd1c1"); c.set(12, 3, "#14a094")
    return c


def gator(frame):
    c = Canvas()
    g, belly, dark = "#3f8f4a", "#b9d98a", "#2d6a38"
    # tail -> body -> head to the right
    c.rect(1, 17, 3, 2, g); c.rect(4, 16, 3, 3, g)
    c.rect(7, 14, 9, 6, g); c.rect(8, 19, 7, 1, belly)
    c.dots([(8, 14), (10, 14), (12, 14), (14, 14), (5, 16)], dark)
    # legs
    c.rect(8, 20, 2, 2, g); c.rect(13, 20, 2, 2, g)
    c.dots([(7, 21), (12, 21)], g)
    # head
    c.rect(15, 11, 5, 6, g)
    open_jaw = frame == "work-2"
    if open_jaw:
        c.rect(19, 9, 5, 3, g)            # upper jaw up
        c.dots([(20, 12), (22, 12)], "#ffffff")
        c.rect(19, 14, 5, 2, g)           # lower jaw
        c.dots([(21, 13), (23, 13)], "#ffffff")
        c.rect(19, 12, 1, 2, "#c8283c")
    else:
        c.rect(19, 12, 5, 3, g)
        c.dots([(20, 14), (22, 14)], "#ffffff")
        c.rect(19, 15, 4, 1, belly)
    # sunglasses + gold chain
    c.rect(15, 11, 5, 2, "#1c1424"); c.set(16, 11, "#ff9fd0"); c.set(18, 11, "#ff9fd0")
    c.dots([(15, 17), (16, 18), (17, 18), (18, 17)], "#ffd166")
    if frame == "work":
        c.dots([(21, 7), (22, 6), (23, 7)], "#ffffffaa", fx=True)
    if frame == "idle-2":
        c.dots([(18, 6), (19, 6), (19, 7), (18, 8), (19, 8)], "#ffd166", fx=True)
        c.dots([(21, 3), (22, 3), (22, 4), (21, 5), (22, 5)], "#ffd166", fx=True)
    if frame == "idle":
        c.dots([(19, 7), (20, 7), (20, 8), (19, 9), (20, 9)], "#ffd16688", fx=True)
    return c


CREW = {"bandit": bandit, "driver": driver, "hacker": hacker, "tourist": tourist, "skater": skater, "gator": gator}
FRAMES = ("work", "work-2", "idle", "idle-2")


# --- badges (12x12) ------------------------------------------------------------------------

def siren(color, glow):
    c = Canvas(12)
    c.rect(3, 3, 6, 5, color); c.rect(4, 2, 4, 1, color); c.set(5, 4, "#ffffff"); c.set(5, 5, "#ffffffaa")
    c.rect(2, 8, 8, 2, "#c9cbe0")
    c.dots([(1, 2), (0, 5), (10, 2), (11, 5)], glow, fx=True)
    return c


def cash():
    c = Canvas(12)
    c.rect(1, 3, 10, 6, "#6fcf5a"); c.rect(2, 4, 8, 4, "#4fae3e")
    c.dots([(6, 4), (5, 5), (6, 6), (5, 7), (7, 5), (7, 7)], "#e9ffd9")
    c.dots([(1, 1), (10, 10)], "#ffd166", fx=True)
    return c


def star(color):
    c = Canvas(12)
    pts = [(5, 1), (6, 1), (5, 2), (6, 2), (1, 4), (2, 4), (3, 4), (4, 4), (5, 4), (6, 4), (7, 4), (8, 4), (9, 4), (10, 4),
           (2, 5), (3, 5), (4, 5), (5, 5), (6, 5), (7, 5), (8, 5), (9, 5), (3, 6), (4, 6), (5, 6), (6, 6), (7, 6), (8, 6),
           (3, 7), (4, 7), (5, 7), (6, 7), (7, 7), (8, 7), (2, 8), (3, 8), (4, 8), (7, 8), (8, 8), (9, 8), (2, 9), (3, 9), (8, 9), (9, 9),
           (4, 3), (5, 3), (6, 3), (7, 3)]
    c.dots(pts, color)
    return c


BADGES = {
    "badge-siren-red": lambda: siren("#ff3b4f", "#ff3b4f"),
    "badge-siren-blue": lambda: siren("#3b7bff", "#3b7bff"),
    "badge-cash": cash,
}


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/.config/herdr-app/mods/vice-crew/sprites")
    os.makedirs(out, exist_ok=True)
    n = 0
    for name, draw in CREW.items():
        for f in FRAMES:
            with open(os.path.join(out, f"{name}-{f}.svg"), "w", newline="\n") as fh:
                fh.write(draw(f).svg())
            n += 1
    for name, draw in BADGES.items():
        with open(os.path.join(out, f"{name}.svg"), "w", newline="\n") as fh:
            fh.write(draw().svg())
        n += 1
    print(f"{n} sprites -> {out}")


if __name__ == "__main__":
    main()
