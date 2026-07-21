# Seasearch guide gallery images

Drop the guide screenshots here with these exact names and the prize card's
flick-through gallery picks them up automatically (no code change):

- `cover.jpg`   — the front cover (shown first)
- `page-1.jpg` … `page-6.jpg` — inside pages, in reading order (any subset;
  missing numbers are skipped automatically)

JPG/screenshot straight from a phone or macOS screenshot is fine — the card
renders them `object-contain`, so no cropping is needed. The manifest lives in
`src/lib/prize.ts` (`PRIZE_GALLERY`); add entries there if you need more than
six pages. Until any file exists, the card shows the committed PEBL
illustration at `public/shop/seasearch-guide.svg`.
