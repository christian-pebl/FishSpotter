import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { PebbleBagView } from "./PebbleBag";

/**
 * Live playground for the Pebble bag's collect-into-pouch animation, so the
 * smoothness/subtlety can be watched and tuned without signing in.
 *
 * Press "Earn 5" (a normal sighting) or "First Sighting +30" (a bigger, brighter
 * burst): pebble SVGs fly into the pouch, the pouch plumps, and the total ticks
 * up. "Toggle feed style" flips to the over-video (white, drop-shadowed) treatment
 * used on /feed. Animation is transform/opacity only and collapses to a plain
 * count-up under prefers-reduced-motion (toggle it in your OS to verify).
 */

const meta: Meta<typeof PebbleBagView> = {
  title: "Header/PebbleBag",
  component: PebbleBagView,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof PebbleBagView>;

function BagPlayground() {
  const [total, setTotal] = useState(40);
  const [onFeed, setOnFeed] = useState(false);
  const [earn, setEarn] = useState<{ earned: number; firstSighting: boolean; nonce: number } | null>(
    null,
  );
  const [nonce, setNonce] = useState(0);

  const collect = (earned: number, firstSighting: boolean) => {
    const n = nonce + 1;
    setNonce(n);
    setTotal((t) => t + earned);
    setEarn({ earned, firstSighting, nonce: n });
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className={`flex items-center justify-end gap-1 rounded-card px-4 py-3 ${
          onFeed ? "bg-navy-900" : "bg-surface border border-[color:var(--border)]"
        }`}
        style={{ width: 240 }}
      >
        <PebbleBagView total={total} onFeed={onFeed} earn={earn} />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => collect(5, false)}
          className="pebl-button-secondary rounded-full px-3 py-1.5 text-xs font-semibold"
        >
          Earn 5
        </button>
        <button
          type="button"
          onClick={() => collect(30, true)}
          className="pebl-button-secondary rounded-full px-3 py-1.5 text-xs font-semibold"
        >
          First Sighting +30
        </button>
        <button
          type="button"
          onClick={() => setOnFeed((f) => !f)}
          className="pebl-button-secondary rounded-full px-3 py-1.5 text-xs font-semibold"
        >
          Toggle feed style
        </button>
      </div>
    </div>
  );
}

export const Playground: Story = {
  render: () => <BagPlayground />,
};
