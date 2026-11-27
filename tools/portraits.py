"""Crops the crew portraits (128px PNGs) from the images in backgrounds/vice/ into
~/.config/herdr-app/mods/vice-crew/cast/. Local use only: the sources are GTA VI art.

    python tools/portraits.py [contact-sheet.png]
"""
import sys, os
from PIL import Image
# The person's own images, next to this layout (git-ignored).
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backgrounds", "vice")
OUT = os.path.expanduser(r"~/.config/herdr-app/mods/vice-crew/cast")
SHEET = sys.argv[1] if len(sys.argv) > 1 else "cast.png"
JL = "Jason_and_Lucia_Robbery.jpg"; SIDE = "favorite-gta-vi-side-character-so-far-v0-2w1mfg2psm0f1.webp"; MANDY = "mandy.jpg"
# key: (file, (left, top, size)) in source pixels
CAST = {
    "lucia": (JL, (2580, 230, 520)),
    "jason": (JL, (3230, 40, 560)),
    "cal": (SIDE, (90, 10, 190)),
    "boobie": (SIDE, (420, 10, 190)),
    "drequan": (SIDE, (790, 0, 180)),
    "dimez": (SIDE, (0, 745, 190)),
    "raul": (SIDE, (430, 690, 170)),
    "brian": (SIDE, (810, 710, 180)),
    "mandy": (MANDY, (60, 30, 110)),
}
tiles = []
for k, (f, (x, y, s)) in CAST.items():
    im = Image.open(os.path.join(SRC, f)).convert("RGB").crop((x, y, x + s, y + s)).resize((128, 128), Image.LANCZOS)
    im.save(os.path.join(OUT, f"{k}.png"))
    tiles.append(im)
sheet = Image.new("RGB", (len(tiles) * 136 + 8, 144), (42, 30, 79))
for i, t in enumerate(tiles):
    sheet.paste(t, (8 + i * 136, 8))
sheet.save(SHEET)
print(list(CAST))
