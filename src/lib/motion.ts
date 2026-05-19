/**
 * Canonical Framer Motion timing + spring presets for PEBL FishSpotter.
 *
 * Sprint 1 establishes these constants; Sprint 5 mechanically migrates existing
 * call-sites onto them. Until then, prefer importing from here for new code.
 */

export const motion = {
  fast: 0.16,
  base: 0.22,
  slow: 0.32,
} as const;

export const spring = {
  cheer: { stiffness: 320, damping: 22 },
  gentle: { stiffness: 200, damping: 26 },
} as const;
