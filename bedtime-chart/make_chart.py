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
        # clear bottom (cheeks + cleft) wiped with a flannel + suds + water
        s.append(f'<path d="M 0 -20 '
                 f'C -11 -23 -30 -16 -34 2 '
                 f'C -38 20 -25 34 -12 31 '
                 f'C -5 29 -2 25 0 20 '
                 f'C 2 25 5 29 12 31 '
                 f'C 25 34 38 20 34 2 '
                 f'C 30 -16 11 -23 0 -20 Z" fill="#FFE2C2" stroke="{INK}" stroke-width="{SW}"/>')
        s.append(f'<path d="M 0 -20 C 5 -7 5 7 0 19" {L}/>')          # cleft
        # blue check flannel wiping the lower-right cheek
        s.append(f'<g transform="rotate(-22 22 22)">'
                 f'<rect x="9" y="12" width="28" height="22" rx="7" fill="#BFE3FF" stroke="{INK}" stroke-width="5"/>'
                 f'<line x1="9" y1="20" x2="37" y2="20" stroke="#fff" stroke-width="3"/>'
                 f'<line x1="9" y1="27" x2="37" y2="27" stroke="#fff" stroke-width="3"/>'
                 f'<line x1="19" y1="12" x2="19" y2="34" stroke="#fff" stroke-width="3"/>'
                 f'<line x1="27" y1="12" x2="27" y2="34" stroke="#fff" stroke-width="3"/></g>')
        # soap suds
        s.append(f'<circle cx="-27" cy="-22" r="7" fill="#fff" stroke="{INK}" stroke-width="4"/>')
        s.append(f'<circle cx="-34" cy="-32" r="4.5" fill="#fff" stroke="{INK}" stroke-width="4"/>')
        s.append(f'<circle cx="22" cy="-28" r="5" fill="#fff" stroke="{INK}" stroke-width="4"/>')
        # water drip
        s.append(f'<path d="M -20 32 q 6 9 0 16 q -6 -7 0 -16 Z" fill="#9BD8FF" stroke="{INK}" stroke-width="3"/>')

    elif name == "face":
        # happy face (eyes + smile visible) washed with a flannel on the cheek
        s.append(f'<circle cx="0" cy="0" r="33" fill="#FFE2C2" stroke="{INK}" stroke-width="{SW}"/>')
        s.append(f'<path d="M -19 -9 q 6 7 12 0" {L}/>')             # closed happy eye
        s.append(f'<path d="M 7 -9 q 6 7 12 0" {L}/>')               # closed happy eye
        s.append(f'<circle cx="-22" cy="8" r="5" fill="#FFB3A7"/>')
        s.append(f'<circle cx="22" cy="8" r="5" fill="#FFB3A7"/>')
        s.append(f'<path d="M -9 13 q 9 8 18 0" {L}/>')              # smile
        # blue check flannel on the right cheek
        s.append(f'<g transform="rotate(-15 23 4)">'
                 f'<rect x="11" y="-10" width="26" height="24" rx="7" fill="#BFE3FF" stroke="{INK}" stroke-width="5"/>'
                 f'<line x1="11" y1="-2" x2="37" y2="-2" stroke="#fff" stroke-width="3"/>'
                 f'<line x1="11" y1="6" x2="37" y2="6" stroke="#fff" stroke-width="3"/>'
                 f'<line x1="20" y1="-10" x2="20" y2="14" stroke="#fff" stroke-width="3"/>'
                 f'<line x1="28" y1="-10" x2="28" y2="14" stroke="#fff" stroke-width="3"/></g>')
        # soap suds + water
        s.append(f'<circle cx="-26" cy="-23" r="7" fill="#fff" stroke="{INK}" stroke-width="4"/>')
        s.append(f'<circle cx="-34" cy="-33" r="4.5" fill="#fff" stroke="{INK}" stroke-width="4"/>')
        s.append(f'<path d="M -24 30 q 6 9 0 16 q -6 -7 0 -16 Z" fill="#9BD8FF" stroke="{INK}" stroke-width="3"/>')
        s.append(f'<path d="M 4 33 q 6 9 0 16 q -6 -7 0 -16 Z" fill="#9BD8FF" stroke="{INK}" stroke-width="3"/>')

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
        # two upright books side by side (spine + cover + white page edge + titles)
        # left book: spine on the left, pages (white) on the right
        s.append(f'<g transform="rotate(-5 -18 30)">'
                 f'<rect x="-38" y="-26" width="32" height="56" rx="4" fill="#FF9AA2" stroke="{INK}" stroke-width="{SW}"/>'
                 f'<line x1="-31" y1="-22" x2="-31" y2="26" stroke="{INK}" stroke-width="3"/>'   # spine groove
                 f'<rect x="-12" y="-22" width="6" height="48" rx="2" fill="#fff" stroke="{INK}" stroke-width="3"/>'  # page edge
                 f'<line x1="-26" y1="-8" x2="-16" y2="-8" {L}/>'
                 f'<line x1="-26" y1="3" x2="-16" y2="3" {L}/></g>')
        # right book (taller, in front) with a bookmark
        s.append(f'<g transform="rotate(5 14 30)">'
                 f'<rect x="2" y="-32" width="32" height="62" rx="4" fill="#9BF6FF" stroke="{INK}" stroke-width="{SW}"/>'
                 f'<line x1="9" y1="-28" x2="9" y2="26" stroke="{INK}" stroke-width="3"/>'        # spine groove
                 f'<rect x="28" y="-28" width="6" height="54" rx="2" fill="#fff" stroke="{INK}" stroke-width="3"/>'  # page edge
                 f'<line x1="14" y1="-14" x2="24" y2="-14" {L}/>'
                 f'<line x1="14" y1="-3" x2="24" y2="-3" {L}/>'
                 f'<path d="M 20 -32 l 0 18 l -4 -4 l -4 4 l 0 -18 Z" fill="#FFE08A" stroke="{INK}" stroke-width="3"/></g>')

    elif name == "bed":
        # bed (headboard, mattress, pillow, blanket) + a big clear open book
        s.append(f'<path d="M -48 32 l 0 -26 q 0 -8 8 -8 l 6 0 q 6 0 6 6 l 0 8 '
                 f'l 62 0 q 8 0 8 8 l 0 10" fill="#FFDCEB" stroke="{INK}" stroke-width="{SW}"/>')
        s.append(f'<line x1="-48" y1="32" x2="-48" y2="48" {L}/>')      # left leg
        s.append(f'<line x1="42" y1="32" x2="42" y2="48" {L}/>')        # right leg
        s.append(f'<line x1="-48" y1="32" x2="42" y2="32" {L}/>')       # base
        # pillow
        s.append(f'<rect x="-43" y="-12" width="22" height="16" rx="5" fill="#fff" stroke="{INK}" stroke-width="4"/>')
        # big open book propped on the bed
        s.append(f'<g transform="translate(8 -2)">'
                 f'<path d="M 0 4 C -10 -5 -24 -5 -33 1 L -33 24 C -24 18 -10 18 0 28 '
                 f'C 10 18 24 18 33 24 L 33 1 C 24 -5 10 -5 0 4 Z" fill="#fff" stroke="{INK}" stroke-width="{SW}"/>'
                 f'<line x1="0" y1="4" x2="0" y2="28" stroke="{INK}" stroke-width="4"/>'
                 f'<line x1="-25" y1="6" x2="-8" y2="9" stroke="#9BD8FF" stroke-width="2.5"/>'
                 f'<line x1="-25" y1="13" x2="-8" y2="16" stroke="#9BD8FF" stroke-width="2.5"/>'
                 f'<line x1="8" y1="9" x2="25" y2="6" stroke="#9BD8FF" stroke-width="2.5"/>'
                 f'<line x1="8" y1="16" x2="25" y2="13" stroke="#9BD8FF" stroke-width="2.5"/></g>')

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
