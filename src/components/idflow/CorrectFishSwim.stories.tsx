import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { CorrectFishSwim } from "./CorrectFishSwim";
import { RevealResult, type RevealStatsItem } from "./RevealResult";

/**
 * Isolated playground for the correct-answer line-fish swim-by.
 *
 * Two views:
 *  - "InIsolation":  the fish darting across a bare reveal-sized panel, with a
 *                     Replay button (remounts the component via a key bump so
 *                     the one-shot dart plays again).
 *  - "InRevealCorrect": the fish in its real home, mounted inside a fully
 *                     mocked correct RevealResult (mock community stats so no
 *                     data is fetched), to confirm it sits behind the text and
 *                     does not disturb the staggered reveal.
 *  - "ReducedMotion": proves the reduced-motion path renders nothing (the
 *                     reveal text remains, the flourish is simply absent).
 *
 * The component fires no network calls; RevealResult takes all data via props,
 * so the only mock needed is the community histogram below.
 */

const meta: Meta<typeof CorrectFishSwim> = {
  title: "IdFlow/CorrectFishSwim",
  component: CorrectFishSwim,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof CorrectFishSwim>;

// A dark feed-style frame: RevealResult renders white-on-dark text, so the
// stories sit it on the navy surface the live feed uses.
function FeedFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[420px] max-w-full rounded-card bg-navy-900 p-4">{children}</div>
  );
}

function ReplayButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pebl-button-secondary inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
        <path
          d="M13 8a5 5 0 1 1-1.5-3.6M13 2v3h-3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Replay
    </button>
  );
}

const MOCK_STATS: RevealStatsItem[] = [
  { option: "Pollack", count: 12, percent: 60 },
  { option: "Saithe", count: 5, percent: 25 },
  { option: "Cod", count: 3, percent: 15 },
];

/** The fish alone, on a bare reveal-sized panel, with Replay. */
function InIsolationStory() {
  const [run, setRun] = useState(0);
  return (
    <div className="flex flex-col items-center gap-3">
      <FeedFrame>
        {/* Mimic RevealResult's relative root so the absolute fish anchors the
            same way it does in production. */}
        <div className="relative h-24 overflow-hidden rounded-modal border border-white/10 bg-white/[0.04]">
          <CorrectFishSwim key={run} />
          <p className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white">
            Result text stays legible
          </p>
        </div>
      </FeedFrame>
      <ReplayButton onClick={() => setRun((n) => n + 1)} />
    </div>
  );
}

export const InIsolation: Story = {
  render: () => <InIsolationStory />,
};

/** The fish in its real host: a correct RevealResult with mocked stats. */
function InRevealCorrectStory() {
  const [run, setRun] = useState(0);
  return (
    <div className="flex flex-col items-center gap-3">
      <FeedFrame>
        <RevealResult
          key={run}
          chosenOption="Pollack"
          isCorrect={true}
          revealPartial={false}
          staffAnswer="Pollack"
          staffScientific="Pollachius pollachius"
          stats={MOCK_STATS}
          total={20}
          reduceMotion={false}
        />
      </FeedFrame>
      <ReplayButton onClick={() => setRun((n) => n + 1)} />
    </div>
  );
}

export const InRevealCorrect: Story = {
  render: () => <InRevealCorrectStory />,
};

/** Reduced motion: the swim-by renders nothing; the reveal text remains. */
export const ReducedMotion: Story = {
  render: () => (
    <FeedFrame>
      <RevealResult
        chosenOption="Pollack"
        isCorrect={true}
        revealPartial={false}
        staffAnswer="Pollack"
        staffScientific="Pollachius pollachius"
        stats={MOCK_STATS}
        total={20}
        reduceMotion={true}
      />
    </FeedFrame>
  ),
};
