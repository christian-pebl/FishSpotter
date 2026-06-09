#!/usr/bin/env python3
"""Generate a printable bedtime-routine circle chart (segmented wheel, icon per step)."""
import math

# ---- Canvas: A4 portrait at 96dpi ----
W, H = 794, 1123
CX, CY = 397, 610
R = 358

# Segments in clockwise order, starting at the top.
# Each entry: (icon-name, pastel fill)
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
START = -90.0  # top

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

# ---------------- ICONS ----------------
# Each icon is drawn in a local box roughly -45..45 around (0,0).
def icon(name):
    s = []
    P = f'fill="none" stroke="{INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"'
    if name == "stairs":
        # staircase steps + up arrow
        s.append(f'<path d="M -42 38 L -42 18 L -14 18 L -14 -6 L 14 -6 L 14 -30 L 42 -30" '
                 f'fill="none" stroke="{INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>')
        s.append(f'<polyline points="-42,38 42,38" {P}/>')
        # up arrow
        s.append(f'<line x1="34" y1="-12" x2="34" y2="-42" {P}/>')
        s.append(f'<polyline points="24,-32 34,-44 44,-32" {P}/>')
    elif name == "bum":
        # potty / bum wash: two cheeks + soap bubbles + droplets
        s.append(f'<circle cx="-13" cy="6" r="17" fill="#FFE2C2" stroke="{INK}" stroke-width="5"/>')
        s.append(f'<circle cx="13" cy="6" r="17" fill="#FFE2C2" stroke="{INK}" stroke-width="5"/>')
        # bubbles / sparkles above
        s.append(f'<circle cx="-30" cy="-26" r="7" fill="#fff" stroke="{INK}" stroke-width="4"/>')
        s.append(f'<circle cx="-8" cy="-36" r="9" fill="#fff" stroke="{INK}" stroke-width="4"/>')
        s.append(f'<circle cx="18" cy="-28" r="6" fill="#fff" stroke="{INK}" stroke-width="4"/>')
        s.append(f'<circle cx="33" cy="-38" r="5" fill="#fff" stroke="{INK}" stroke-width="4"/>')
        # droplets
        s.append(f'<path d="M 30 18 q 6 8 0 14 q -6 -6 0 -14 Z" fill="#9BD8FF" stroke="{INK}" stroke-width="3"/>')
        s.append(f'<path d="M -34 22 q 5 7 0 12 q -5 -5 0 -12 Z" fill="#9BD8FF" stroke="{INK}" stroke-width="3"/>')
    elif name == "face":
        # smiley face being washed: face + bubbles + droplets
        s.append(f'<circle cx="0" cy="2" r="30" fill="#FFE2C2" stroke="{INK}" stroke-width="5"/>')
        s.append(f'<circle cx="-11" cy="-4" r="3.5" fill="{INK}"/>')
        s.append(f'<circle cx="11" cy="-4" r="3.5" fill="{INK}"/>')
        s.append(f'<path d="M -11 12 q 11 10 22 0" {P}/>')
        # foam/bubbles on forehead
        s.append(f'<circle cx="-18" cy="-30" r="9" fill="#fff" stroke="{INK}" stroke-width="4"/>')
        s.append(f'<circle cx="2" cy="-38" r="11" fill="#fff" stroke="{INK}" stroke-width="4"/>')
        s.append(f'<circle cx="20" cy="-30" r="8" fill="#fff" stroke="{INK}" stroke-width="4"/>')
        # droplet
        s.append(f'<path d="M 34 6 q 6 8 0 14 q -6 -6 0 -14 Z" fill="#9BD8FF" stroke="{INK}" stroke-width="3"/>')
    elif name == "teeth":
        # tooth + toothbrush
        s.append(f'<path d="M -30 -22 q 0 -16 16 -16 q 14 0 14 8 q 0 -8 14 -8 q 16 0 16 16 '
                 f'q 0 22 -10 38 q -5 8 -8 -6 q -3 -14 -12 -14 q -9 0 -12 14 q -3 14 -8 6 '
                 f'q -10 -16 -10 -38 Z" fill="#fff" stroke="{INK}" stroke-width="5"/>')
        # toothbrush (diagonal)
        s.append(f'<line x1="-40" y1="44" x2="6" y2="-2" stroke="{INK}" stroke-width="7" stroke-linecap="round"/>')
        s.append(f'<rect x="2" y="-16" width="18" height="14" rx="3" transform="rotate(-45 11 -9)" '
                 f'fill="#A0C4FF" stroke="{INK}" stroke-width="4"/>')
        # sparkle
        s.append(f'<path d="M 30 -36 l 3 8 l 8 3 l -8 3 l -3 8 l -3 -8 l -8 -3 l 8 -3 Z" fill="#FFE08A" stroke="{INK}" stroke-width="2"/>')
    elif name == "pjs":
        # footed onesie
        s.append(f'<path d="M -22 -32 q 22 14 44 0 l 14 14 l -12 12 l -8 -6 l 0 44 l -32 0 l 0 -44 '
                 f'l -8 6 l -12 -12 Z" fill="#A0C4FF" stroke="{INK}" stroke-width="5"/>')
        # collar
        s.append(f'<path d="M -10 -30 q 10 9 20 0" {P}/>')
        # buttons
        s.append(f'<circle cx="0" cy="0" r="3" fill="{INK}"/>')
        s.append(f'<circle cx="0" cy="16" r="3" fill="{INK}"/>')
        # star pattern
        s.append(f'<path d="M -10 26 l 2 5 l 5 2 l -5 2 l -2 5 l -2 -5 l -5 -2 l 5 -2 Z" fill="#FDFFB6" stroke="{INK}" stroke-width="1.5"/>')
    elif name == "books":
        # two books
        s.append(f'<rect x="-40" y="-6" width="34" height="44" rx="4" fill="#FF9AA2" stroke="{INK}" stroke-width="5"/>')
        s.append(f'<line x1="-33" y1="2" x2="-13" y2="2" {P}/>')
        s.append(f'<line x1="-33" y1="14" x2="-13" y2="14" {P}/>')
        s.append(f'<rect x="8" y="-14" width="34" height="44" rx="4" fill="#9BF6FF" stroke="{INK}" stroke-width="5"/>')
        s.append(f'<line x1="15" y1="-6" x2="35" y2="-6" {P}/>')
        s.append(f'<line x1="15" y1="6" x2="35" y2="6" {P}/>')
    elif name == "bed":
        # bed with open book
        s.append(f'<path d="M -44 28 l 0 -16 q 0 -8 8 -8 l 60 0 q 10 0 10 12 l 0 12" fill="#FFDCEB" stroke="{INK}" stroke-width="5"/>')
        s.append(f'<line x1="-44" y1="28" x2="-44" y2="40" {P}/>')
        s.append(f'<line x1="42" y1="28" x2="42" y2="40" {P}/>')
        s.append(f'<line x1="-44" y1="28" x2="42" y2="28" {P}/>')
        # pillow
        s.append(f'<rect x="-38" y="-2" width="22" height="14" rx="4" fill="#fff" stroke="{INK}" stroke-width="4"/>')
        # open book
        s.append(f'<path d="M 0 22 q 12 -8 24 -2 l 0 -18 q -12 -6 -24 2 q -12 -8 -24 -2 l 0 18 q 12 -6 24 2 Z" '
                 f'fill="#fff" stroke="{INK}" stroke-width="4"/>')
        s.append(f'<line x1="0" y1="4" x2="0" y2="22" stroke="{INK}" stroke-width="3"/>')
    elif name == "sleep":
        # sleeping face + Zzz
        s.append(f'<circle cx="-4" cy="6" r="30" fill="#FFE2C2" stroke="{INK}" stroke-width="5"/>')
        s.append(f'<path d="M -18 2 q 6 7 12 0" {P}/>')
        s.append(f'<path d="M 2 2 q 6 7 12 0" {P}/>')
        s.append(f'<path d="M -10 20 q 6 5 12 0" {P}/>')
        # Zzz
        s.append(f'<text x="20" y="-18" font-family="DejaVu Sans" font-weight="bold" font-size="20" fill="{INK}">z</text>')
        s.append(f'<text x="30" y="-30" font-family="DejaVu Sans" font-weight="bold" font-size="26" fill="{INK}">z</text>')
        s.append(f'<text x="42" y="-44" font-family="DejaVu Sans" font-weight="bold" font-size="32" fill="{INK}">Z</text>')
    return "\n".join(s)

# ---------------- BUILD SVG ----------------
out = []
out.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
           f'viewBox="0 0 {W} {H}" font-family="DejaVu Sans">')
out.append(f'<rect x="0" y="0" width="{W}" height="{H}" fill="#FFFFFF"/>')

# Title
out.append(f'<text x="{W/2}" y="78" text-anchor="middle" font-size="42" font-weight="bold" fill="{INK}">My Bedtime Routine</text>')
out.append(f'<text x="{W/2}" y="116" text-anchor="middle" font-size="21" fill="#7a7a88">Follow the steps 1 to 8 around the wheel</text>')
# crescent moon + star by title
out.append(f'<path d="M 108 52 a 20 20 0 1 0 14 30 a 16 16 0 1 1 -14 -30 Z" fill="#FFE08A" stroke="{INK}" stroke-width="3"/>')
out.append(f'<path d="M 690 46 l 4 10 l 10 4 l -10 4 l -4 10 l -4 -10 l -10 -4 l 10 -4 Z" fill="#FFE08A" stroke="{INK}" stroke-width="2"/>')

# Outer ring
out.append(f'<circle cx="{CX}" cy="{CY}" r="{R+6}" fill="#fff" stroke="{INK}" stroke-width="4"/>')

# Wedges + icons + numbers
for i, (name, fill) in enumerate(SEGMENTS):
    a0 = START + i * STEP
    a1 = a0 + STEP
    mid = a0 + STEP / 2
    out.append(f'<path d="{wedge(CX, CY, R, a0, a1)}" fill="{fill}" stroke="{INK}" stroke-width="3"/>')
    # icon
    ix, iy = pol(CX, CY, R * 0.60, mid)
    out.append(f'<g transform="translate({ix:.2f},{iy:.2f}) scale(1.05)">{icon(name)}</g>')
    # number badge near outer edge
    nx, ny = pol(CX, CY, R * 0.88, mid)
    out.append(f'<circle cx="{nx:.2f}" cy="{ny:.2f}" r="17" fill="#fff" stroke="{INK}" stroke-width="3"/>')
    out.append(f'<text x="{nx:.2f}" y="{ny+7:.2f}" text-anchor="middle" font-size="22" font-weight="bold" fill="{INK}">{i+1}</text>')

# Center hub
out.append(f'<circle cx="{CX}" cy="{CY}" r="62" fill="#3A3A4A" stroke="{INK}" stroke-width="3"/>')
# moon in hub
out.append(f'<path d="M {CX-6} {CY-26} a 26 26 0 1 0 18 40 a 21 21 0 1 1 -18 -40 Z" fill="#FFE08A"/>')
out.append(f'<circle cx="{CX+22}" cy="{CY-10}" r="3" fill="#fff"/>')
out.append(f'<circle cx="{CX+14}" cy="{CY+22}" r="2.5" fill="#fff"/>')
out.append(f'<circle cx="{CX-26}" cy="{CY+18}" r="2.5" fill="#fff"/>')

# Footer
out.append(f'<text x="{W/2}" y="{H-46}" text-anchor="middle" font-size="20" fill="#7a7a88">Follow the wheel around — one step at a time. Sweet dreams!</text>')

out.append('</svg>')

with open("chart.svg", "w") as f:
    f.write("\n".join(out))
print("wrote chart.svg")
