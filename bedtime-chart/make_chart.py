#!/usr/bin/env python3
"""Printable bedtime-routine wheel — icons only, no text."""
import math

# ---- Canvas: A4 portrait at 96dpi ----
W, H = 794, 1123
CX, CY = 397, 561
R = 372

# Clockwise from the top.  (icon-name, pastel fill)
SEGMENTS = [
    ("stairs",  "#FFD6A5"),  # 1 go upstairs
    ("bum",     "#FDFFB6"),  # 2 bum wash
    ("face",    "#CAFFBF"),  # 3 face wash
    ("teeth",   "#9BF6FF"),  # 4 brush teeth
    ("pjs",     "#A0C4FF"),  # 5 pyjamas
    ("books",   "#BDB2FF"),  # 6 choose two books
    ("bed",     "#FFC6FF"),  # 7 into bed & read
    ("sleep",   "#FFADAD"),  # 8 close eyes
]
N = len(SEGMENTS)
STEP = 360.0 / N
START = -90.0

INK = "#3A3A4A"

def pol(cx, cy, r, deg):
    a = math.radians(deg)
    return (cx + r * math.cos(a), cy + r * math.sin(a))

def wedge(cx, cy, r, a0, a1):
    x0, y0 = pol(cx, cy, r, a0)
    x1, y1 = pol(cx, cy, r, a1)
    large = 1 if (a1 - a0) > 180 else 0
    return (f'M {cx:.2f} {cy:.2f} L {x0:.2f} {y0:.2f} '
            f'A {r:.2f} {r:.2f} 0 {large} 1 {x1:.2f} {y1:.2f} Z')

# ---------------- ICONS (local box ~ -52..52 around 0,0) ----------------
def icon(name):
    SW = 6            # default stroke
    s = []
    L = f'fill="none" stroke="{INK}" stroke-width="{SW}" stroke-linecap="round" stroke-linejoin="round"'

    if name == "stairs":
        # solid stepped staircase + up arrow
        s.append(f'<path d="M -46 40 L -46 16 L -20 16 L -20 -8 L 6 -8 L 6 -32 L 34 -32 L 34 40 Z" '
                 f'fill="#FFEBD2" stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round"/>')
        # tread highlight lines
        s.append(f'<polyline points="-20,16 -20,-8 6,-8 6,-32 34,-32" {L}/>')
        # up arrow
        s.append(f'<line x1="22" y1="-44" x2="22" y2="-66" {L}/>')
        s.append(f'<polyline points="12,-56 22,-68 32,-56" {L}/>')

    elif name == "bum":
        # a bottom (two cheeks + crease) being washed: sponge + bubbles + drips
        s.append(f'<circle cx="-15" cy="12" r="20" fill="#FFE2C2" stroke="{INK}" stroke-width="{SW}"/>')
        s.append(f'<circle cx="15" cy="12" r="20" fill="#FFE2C2" stroke="{INK}" stroke-width="{SW}"/>')
        s.append(f'<path d="M 0 -6 q 4 14 0 28" {L}/>')               # crease
        # sponge
        s.append(f'<rect x="-26" y="-40" width="40" height="20" rx="8" fill="#FFE08A" stroke="{INK}" stroke-width="{SW}"/>')
        s.append(f'<circle cx="-15" cy="-30" r="2.5" fill="{INK}"/>')
        s.append(f'<circle cx="-3" cy="-27" r="2.5" fill="{INK}"/>')
        s.append(f'<circle cx="5" cy="-33" r="2.5" fill="{INK}"/>')
        # bubbles
        s.append(f'<circle cx="24" cy="-34" r="8" fill="#fff" stroke="{INK}" stroke-width="4"/>')
        s.append(f'<circle cx="34" cy="-46" r="5" fill="#fff" stroke="{INK}" stroke-width="4"/>')
        # drips
        s.append(f'<path d="M -30 26 q 6 9 0 16 q -6 -7 0 -16 Z" fill="#9BD8FF" stroke="{INK}" stroke-width="3"/>')
        s.append(f'<path d="M 30 26 q 6 9 0 16 q -6 -7 0 -16 Z" fill="#9BD8FF" stroke="{INK}" stroke-width="3"/>')

    elif name == "face":
        # face + foamy lather on top + washcloth + drips
        s.append(f'<circle cx="0" cy="4" r="32" fill="#FFE2C2" stroke="{INK}" stroke-width="{SW}"/>')
        s.append(f'<circle cx="-12" cy="-2" r="4" fill="{INK}"/>')
        s.append(f'<circle cx="12" cy="-2" r="4" fill="{INK}"/>')
        s.append(f'<path d="M -12 14 q 12 11 24 0" {L}/>')
        # rosy cheeks (being scrubbed)
        s.append(f'<circle cx="-20" cy="10" r="5" fill="#FFB3A7"/>')
        s.append(f'<circle cx="20" cy="10" r="5" fill="#FFB3A7"/>')
        # foam suds across forehead/hair
        for cx, cy, r in [(-22,-26,11),(-4,-34,13),(16,-28,11),(28,-18,8),(-32,-14,8)]:
            s.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#fff" stroke="{INK}" stroke-width="4"/>')
        # drips
        s.append(f'<path d="M -36 18 q 6 9 0 16 q -6 -7 0 -16 Z" fill="#9BD8FF" stroke="{INK}" stroke-width="3"/>')
        s.append(f'<path d="M 36 14 q 6 9 0 16 q -6 -7 0 -16 Z" fill="#9BD8FF" stroke="{INK}" stroke-width="3"/>')

    elif name == "teeth":
        # big tooth + clear toothbrush with bristles + paste + sparkle
        s.append(f'<path d="M -30 -18 C -30 -42 -8 -44 0 -30 C 8 -44 30 -42 30 -18 '
                 f'C 30 6 20 40 11 26 C 5 17 -5 17 -11 26 C -20 40 -30 6 -30 -18 Z" '
                 f'fill="#fff" stroke="{INK}" stroke-width="{SW}"/>')
        s.append(f'<path d="M 0 -28 C 6 -20 6 -8 2 2" fill="none" stroke="#D7E6F5" stroke-width="4" stroke-linecap="round"/>')
        # toothbrush, diagonal lower-left -> upper-right
        s.append(f'<line x1="-46" y1="46" x2="-10" y2="10" stroke="{INK}" stroke-width="9" stroke-linecap="round"/>')
        s.append(f'<rect x="-12" y="-8" width="30" height="16" rx="4" transform="rotate(-45 3 0)" '
                 f'fill="#A0C4FF" stroke="{INK}" stroke-width="5"/>')
        # bristles
        for d in (-9, -3, 3, 9):
            x0, y0 = pol(0, 0, 0, 0)
        s.append(f'<g transform="rotate(-45 3 0)">' +
                 ''.join(f'<line x1="{x}" y1="-8" x2="{x}" y2="-16" stroke="{INK}" stroke-width="3" stroke-linecap="round"/>'
                         for x in (-6, 0, 6, 12)) + '</g>')
        # toothpaste foam
        # sparkle
        s.append(f'<path d="M 26 -34 l 3 8 l 8 3 l -8 3 l -3 8 l -3 -8 l -8 -3 l 8 -3 Z" fill="#FFE08A" stroke="{INK}" stroke-width="2"/>')

    elif name == "pjs":
        # cosy onesie with collar, button placket, feet + moon motif
        s.append(f'<path d="M -20 -34 q 20 14 40 0 l 16 12 l -12 14 l -10 -7 l 0 50 '
                 f'q 0 6 -6 6 l -10 0 0 -22 -4 0 0 22 -10 0 q -6 0 -6 -6 l 0 -50 '
                 f'l -10 7 l -12 -14 Z" fill="#9DBBF5" stroke="{INK}" stroke-width="{SW}"/>')
        s.append(f'<path d="M -10 -32 q 10 9 20 0" {L}/>')             # collar
        s.append(f'<line x1="0" y1="-22" x2="0" y2="22" stroke="{INK}" stroke-width="3"/>')  # placket
        for cy in (-12, 0, 12):
            s.append(f'<circle cx="0" cy="{cy}" r="3" fill="{INK}"/>')
        # little moon on chest
        s.append(f'<path d="M -18 6 a 8 8 0 1 0 6 12 a 6.5 6.5 0 1 1 -6 -12 Z" fill="#FDFFB6" stroke="{INK}" stroke-width="2.5"/>')

    elif name == "books":
        # two upright books, one slightly tilted
        s.append(f'<rect x="-42" y="-22" width="34" height="50" rx="5" fill="#FF9AA2" stroke="{INK}" stroke-width="{SW}"/>')
        s.append(f'<line x1="-34" y1="-22" x2="-34" y2="28" stroke="{INK}" stroke-width="3"/>')   # spine
        s.append(f'<line x1="-28" y1="-10" x2="-14" y2="-10" {L}/>')
        s.append(f'<line x1="-28" y1="2" x2="-14" y2="2" {L}/>')
        s.append(f'<g transform="rotate(8 22 4)">'
                 f'<rect x="6" y="-26" width="34" height="50" rx="5" fill="#9BF6FF" stroke="{INK}" stroke-width="{SW}"/>'
                 f'<line x1="14" y1="-26" x2="14" y2="24" stroke="{INK}" stroke-width="3"/>'
                 f'<line x1="20" y1="-14" x2="34" y2="-14" {L}/>'
                 f'<line x1="20" y1="-2" x2="34" y2="-2" {L}/></g>')

    elif name == "bed":
        # bed (headboard, mattress, pillow, blanket) + open book
        s.append(f'<path d="M -48 34 l 0 -28 q 0 -8 8 -8 l 8 0 q 6 0 6 6 l 0 10 '
                 f'l 60 0 q 8 0 8 8 l 0 12" fill="#FFDCEB" stroke="{INK}" stroke-width="{SW}"/>')
        s.append(f'<line x1="-48" y1="34" x2="-48" y2="48" {L}/>')      # left leg
        s.append(f'<line x1="42" y1="34" x2="42" y2="48" {L}/>')        # right leg
        s.append(f'<line x1="-48" y1="34" x2="42" y2="34" {L}/>')       # base
        s.append(f'<path d="M -22 14 l 64 0" stroke="{INK}" stroke-width="4" stroke-linecap="round"/>')  # blanket edge
        # pillow
        s.append(f'<rect x="-40" y="-6" width="22" height="16" rx="5" fill="#fff" stroke="{INK}" stroke-width="4"/>')
        # open book resting on blanket
        s.append(f'<path d="M 10 30 q 12 -7 24 -1 l 0 -16 q -12 -6 -24 1 q -12 -7 -24 -1 l 0 16 q 12 -6 24 1 Z" '
                 f'transform="translate(-2 -6)" fill="#fff" stroke="{INK}" stroke-width="4"/>')
        s.append(f'<line x1="8" y1="9" x2="8" y2="25" stroke="{INK}" stroke-width="3"/>')

    elif name == "sleep":
        # peaceful sleeping face + drawn Z Z Z (no text)
        s.append(f'<circle cx="-6" cy="8" r="32" fill="#FFE2C2" stroke="{INK}" stroke-width="{SW}"/>')
        s.append(f'<path d="M -22 2 q 7 9 14 0" {L}/>')                 # closed eye
        s.append(f'<path d="M 2 2 q 7 9 14 0" {L}/>')                   # closed eye
        s.append(f'<circle cx="-24" cy="14" r="5" fill="#FFB3A7"/>')
        s.append(f'<circle cx="14" cy="14" r="5" fill="#FFB3A7"/>')
        s.append(f'<path d="M -8 22 q 8 6 16 0" {L}/>')                 # soft smile
        # Z Z Z drawn as strokes, rising to the right
        def zee(x, y, sz):
            return (f'<polyline points="{x},{y} {x+sz},{y} {x},{y+sz} {x+sz},{y+sz}" '
                    f'fill="none" stroke="{INK}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>')
        s.append(zee(20, 0, 10))
        s.append(zee(30, -16, 13))
        s.append(zee(42, -36, 16))
    return "\n".join(s)

# ---------------- BUILD SVG ----------------
out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
       f'viewBox="0 0 {W} {H}" font-family="DejaVu Sans">',
       f'<rect width="{W}" height="{H}" fill="#FFFFFF"/>',
       f'<circle cx="{CX}" cy="{CY}" r="{R+7}" fill="#fff" stroke="{INK}" stroke-width="5"/>']

for i, (name, fill) in enumerate(SEGMENTS):
    a0 = START + i * STEP
    a1 = a0 + STEP
    mid = a0 + STEP / 2
    out.append(f'<path d="{wedge(CX, CY, R, a0, a1)}" fill="{fill}" stroke="{INK}" stroke-width="3"/>')
    ix, iy = pol(CX, CY, R * 0.60, mid)
    out.append(f'<g transform="translate({ix:.2f},{iy:.2f}) scale(1.55)">{icon(name)}</g>')

# Center hub with crescent moon + stars
out.append(f'<circle cx="{CX}" cy="{CY}" r="68" fill="#3A3A4A" stroke="{INK}" stroke-width="3"/>')
out.append(f'<path d="M {CX-8} {CY-30} a 30 30 0 1 0 20 46 a 24 24 0 1 1 -20 -46 Z" fill="#FFE08A"/>')
out.append(f'<circle cx="{CX+26}" cy="{CY-14}" r="3.5" fill="#fff"/>')
out.append(f'<circle cx="{CX+16}" cy="{CY+26}" r="3" fill="#fff"/>')
out.append(f'<circle cx="{CX-30}" cy="{CY+22}" r="3" fill="#fff"/>')

out.append('</svg>')

with open("chart.svg", "w") as f:
    f.write("\n".join(out))
print("wrote chart.svg")
