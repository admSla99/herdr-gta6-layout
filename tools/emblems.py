"""Draws the district emblems for vice-spaces: 16x16 pixel-art SVGs, declared 32px.

    python tools/emblems.py <out dir>   (default: ~/.config/herdr-app/mods/vice-spaces/emblems)
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import sprites  # noqa: E402
from sprites import Canvas  # noqa: E402

N = 16


def palm():
    c = Canvas(N)
    trunk = "#b9784a"
    for i, (x, y) in enumerate([(8, 6), (8, 7), (8, 8), (9, 9), (9, 10), (9, 11), (10, 12), (10, 13), (10, 14)]):
        c.set(x, y, trunk if i % 2 else "#8f5a34")
    g, d = "#3fbf6a", "#2a8f4c"
    c.rect(4, 3, 4, 1, g); c.rect(2, 4, 3, 1, g); c.set(1, 5, g)
    c.rect(9, 3, 4, 1, g); c.rect(12, 4, 3, 1, g); c.set(14, 5, g)
    c.rect(6, 2, 4, 1, d); c.rect(7, 1, 2, 1, g)
    c.rect(5, 5, 2, 1, d); c.set(4, 6, d); c.rect(10, 5, 2, 1, d); c.set(12, 6, d)
    c.dots([(7, 5), (9, 5)], "#7a4a2a")
    return c


def flamingo():
    c = Canvas(N)
    p, dp = "#ff7eb6", "#e04f94"
    c.rect(5, 7, 6, 3, p); c.rect(6, 6, 4, 1, p); c.rect(9, 8, 2, 1, dp)
    c.rect(4, 2, 1, 5, p); c.rect(4, 1, 3, 1, p); c.set(7, 2, "#1a0f2e"); c.set(7, 1, "#f2d48a")
    c.set(5, 6, p)
    c.rect(7, 10, 1, 5, "#e04f94"); c.rect(6, 14, 2, 1, "#e04f94")
    c.set(5, 1, "#1a0f2e")
    return c


def gator():
    c = Canvas(N)
    g, d = "#3f8f4a", "#2d6a38"
    c.rect(1, 9, 4, 2, g); c.rect(4, 8, 7, 4, g); c.rect(10, 7, 5, 3, g); c.rect(10, 10, 5, 1, "#b9d98a")
    c.dots([(5, 8), (7, 8), (9, 8)], d)
    c.set(11, 6, g); c.set(11, 7, "#ffd166")
    c.dots([(5, 12), (9, 12)], g)
    c.dots([(12, 10), (14, 10)], "#ffffff")
    return c


def boat():
    c = Canvas(N)
    c.rect(2, 9, 12, 2, "#f4f0ea"); c.rect(3, 11, 10, 1, "#f4f0ea"); c.rect(2, 10, 12, 1, "#ff4f9a")
    c.rect(6, 6, 5, 3, "#f4f0ea"); c.rect(7, 7, 3, 1, "#3b7bff")
    c.set(8, 5, "#c9cbe0")
    c.rect(0, 13, 16, 1, "#3fb6e0", fx=True); c.dots([(2, 12), (13, 12)], "#ffffffaa", fx=True)
    return c


def lighthouse():
    c = Canvas(N)
    c.rect(6, 4, 4, 1, "#2a2836"); c.rect(6, 2, 4, 2, "#ffd166"); c.rect(7, 1, 2, 1, "#e2384f")
    for y in range(5, 14):
        c.rect(6 if y > 8 else 7, y, 4 if y > 8 else 2, 1, "#e2384f" if (y // 2) % 2 else "#f4f0ea")
    c.rect(4, 14, 8, 1, "#8a8fa8")
    c.dots([(2, 2), (3, 3), (13, 2), (12, 3)], "#fff3b0", fx=True)
    return c


def motel():
    c = Canvas(N)
    c.rect(2, 2, 12, 8, "#2a1e4f")
    c.dots([(4, 4), (4, 5), (4, 6), (5, 7), (6, 6), (6, 5), (6, 4)], "#ff4f9a")  # V
    c.dots([(8, 4), (8, 5), (8, 6), (8, 7)], "#ff4f9a")  # I
    c.dots([(10, 4), (11, 4), (10, 5), (10, 6), (10, 7), (11, 7)], "#1fd1c1")  # C
    c.rect(7, 10, 2, 5, "#8a8fa8")
    c.dots([(3, 8), (6, 8), (9, 8), (12, 8)], "#ffd166")
    return c


def orange():
    c = Canvas(N)
    c.rect(4, 5, 8, 8, "#ff9447"); c.rect(5, 4, 6, 1, "#ff9447"); c.rect(5, 13, 6, 1, "#ff9447")
    c.rect(3, 6, 1, 6, "#ff9447"); c.rect(12, 6, 1, 6, "#ff9447")
    c.dots([(5, 6), (6, 6), (5, 7)], "#ffc28a")
    c.set(8, 3, "#7a4a2a"); c.rect(9, 2, 3, 2, "#3fbf6a")
    return c


def shell():
    c = Canvas(N)
    s, d = "#ffc9b0", "#f08f78"
    c.rect(4, 4, 8, 7, s); c.rect(5, 3, 6, 1, s); c.rect(3, 6, 1, 4, s); c.rect(12, 6, 1, 4, s)
    c.rect(6, 11, 4, 2, s); c.rect(7, 13, 2, 1, s)
    for x in (5, 7, 8, 10):
        c.rect(x, 4, 1, 7, d)
    return c


EMBLEMS = {"palm": palm, "flamingo": flamingo, "gator": gator, "boat": boat,
           "lighthouse": lighthouse, "motel": motel, "orange": orange, "shell": shell}


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/.config/herdr-app/mods/vice-spaces/emblems")
    os.makedirs(out, exist_ok=True)
    for name, draw in EMBLEMS.items():
        with open(os.path.join(out, f"{name}.svg"), "w", newline="\n") as fh:
            fh.write(draw().svg())
    print(f"{len(EMBLEMS)} emblems -> {out}")


if __name__ == "__main__":
    main()
