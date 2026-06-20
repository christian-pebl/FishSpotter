/**
 * Map a hand-marked centre path (the TRDesk4 manual 16-point track) onto the
 * zero-size box shape the feed's trail renderer already consumes.
 *
 * The renderer reads the box CENTRE (x_norm + w_norm/2). With w_norm = h_norm = 0
 * the centre is exactly the marked point, so FeedCard reuses the existing
 * smooth-trail code verbatim and only swaps its input source to the manual
 * track when one is present (it is the cleaner signal than the auto boxes).
 */

export interface CentrePoint {
  frame_clip: number;
  x_norm: number;
  y_norm: number;
}

export interface CentreBox extends CentrePoint {
  w_norm: number;
  h_norm: number;
}

export function manualTrackToBoxes(points: CentrePoint[]): CentreBox[] {
  return points.map((p) => ({
    frame_clip: p.frame_clip,
    x_norm: p.x_norm,
    y_norm: p.y_norm,
    w_norm: 0,
    h_norm: 0,
  }));
}
