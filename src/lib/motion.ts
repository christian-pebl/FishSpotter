/**
 * Q4-D1 — canonical Framer Motion timing tokens for PEBL FishSpotter.
 *
 * Before this, every component hand-tuned its own transition durations
 * (0.15, 0.16, 0.18, 0.2, 0.22, 0.3, 0.35 ...). The values clustered
 * into three perceptual tiers, so this collapses them to a named scale.
 * Use these for generic enter / exit / layout transitions.
 *
 * NOT for genuinely bespoke motion: shake keyframes, infinite-repeat
 * pulses, and the cheer scale-pop stay inline at their call-sites
 * because their timing is tuned to the specific animation, not a
 * generic tier.
 *
 * Note: the old export was named `motion`, which shadowed Framer's own
 * `motion` import. Renamed to DURATION/EASE to remove that footgun.
 *
 * Tiers:
 *   micro    — quick fades / hint reveals (was 0.15–0.18)
 *   standard — panel + menu enter/exit (was 0.2–0.22)
 *   layout   — reorder / position interpolation (was 0.3–0.35)
 */
export const DURATION = {
  micro: 0.18,
  standard: 0.22,
  layout: 0.3,
} as const;

export const EASE = {
  enter: "easeOut",
  exit: "easeIn",
  layout: "easeInOut",
} as const;

/**
 * Convenience transition presets for the most common shapes so
 * call-sites can spread one object instead of repeating the literal.
 */
export const TRANSITION = {
  /** Generic enter/exit fade+slide. */
  standard: { duration: DURATION.standard, ease: EASE.enter },
  /** Layout / reorder position interpolation. */
  layout: { duration: DURATION.layout, ease: EASE.layout },
  /** Quick hint / micro fade. */
  micro: { duration: DURATION.micro },
} as const;

/** Spring presets for emphasis motion (verdict pop, gentle settle). */
export const spring = {
  cheer: { type: "spring", stiffness: 320, damping: 22 },
  gentle: { type: "spring", stiffness: 200, damping: 26 },
} as const;
