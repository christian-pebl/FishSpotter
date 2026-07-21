# Seasearch guide gallery images

Drop the guide screenshots here with these exact names — `.jpg` **or** `.png`
both work — and the prize card's flick-through gallery picks them up
automatically (no code change):

- `cover.jpg` / `cover.png`   — the front cover (shown first)
- `page-1.jpg` / `page-1.png` … `page-6.*` — inside pages, in reading order
  (any subset; missing numbers are skipped automatically)

## Mapping for the 21 Jul 2026 Downloads screenshots

| Downloads file (…`Screenshot 2026-07-21 …`) | Rename to |
| --- | --- |
| `1marien life front cover.png` | `cover.png` |
| `2marien life page content.png` | `page-1.png` |
| `3marien life fish.png` | `page-2.png` |
| `4marine life p1.png` | `page-3.png` |
| `5marine life book content.png` | `page-4.png` |

Screenshots straight from a phone or Windows/macOS are fine — the card
renders them `object-contain`, so no cropping is needed. The manifest lives
in `src/lib/prize.ts` (`PRIZE_GALLERY`); add entries there if you need more
than six pages. Until any file exists, the card shows the committed PEBL
illustration at `public/shop/seasearch-guide.svg`.
