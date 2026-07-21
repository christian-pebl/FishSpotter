import { describe, expect, it } from "vitest";
import {
  PRIZE_TARGET_PEBBLES,
  SEASEARCH_GUIDE_ID,
  hasReachedPrizeTarget,
} from "./prize";

describe("prize", () => {
  it("targets 1000 lifetime earned Pebbles", () => {
    expect(PRIZE_TARGET_PEBBLES).toBe(1000);
    expect(hasReachedPrizeTarget(999)).toBe(false);
    expect(hasReachedPrizeTarget(1000)).toBe(true);
    expect(hasReachedPrizeTarget(1001)).toBe(true);
  });

  it("keeps a stable claim itemId that never collides with retired shop ids", () => {
    // Retired shop ids (gold-nameplate, coral-accent, tide-freeze) may exist
    // as PebblePurchase rows in prod; the prize must use a distinct id.
    expect(SEASEARCH_GUIDE_ID).toBe("seasearch-guide");
    expect(["gold-nameplate", "coral-accent", "tide-freeze"]).not.toContain(
      SEASEARCH_GUIDE_ID,
    );
  });
});
