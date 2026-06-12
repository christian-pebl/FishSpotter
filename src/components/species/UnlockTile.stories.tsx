import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { UnlockTile, ProgressBadge } from "@/components/species/UnlockTile";

/**
 * Storybook proof for the pokedex species-unlock reveal. Each story renders the
 * `UnlockTile` with `justUnlocked` and a Replay button that remounts the
 * animated subtree (via a `key` bump) so the one-shot dissolve + teal shockwave
 * ring + badge tick can be replayed without a full page reload.
 *
 * The "photo" is an inline SVG data URI (a minimal teal line-fish on a navy
 * card) so the story has zero network dependency. The silhouette dissolves FROM
 * `/silhouettes/fish.svg`, which Storybook serves out of `public/`.
 */

// A stand-in "reference photo": navy card + a single teal stroked line-fish, so
// nothing is fetched over the network in the story.
const FAKE_PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
       <rect width="160" height="160" fill="#17252A"/>
       <g fill="none" stroke="#5eead4" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
         <path d="M28 80c14-30 40-44 68-44 30 0 56 18 70 44-14 26-40 44-70 44-26 0-54-14-68-44z"/>
         <path d="M150 80l20-16v32l-20-16z"/>
       </g>
       <circle cx="58" cy="66" r="5" fill="#5eead4"/>
     </svg>`,
  );

function Replayable({
  children,
  label = "Replay",
}: {
  children: (replayKey: number) => React.ReactNode;
  label?: string;
}) {
  const [k, setK] = useState(0);
  return (
    <div className="w-full max-w-[220px]">
      {children(k)}
      <button
        type="button"
        onClick={() => setK((n) => n + 1)}
        className="pebl-button-secondary mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
          <path
            d="M13 8a5 5 0 1 1-1.6-3.7M13 2v3h-3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {label}
      </button>
    </div>
  );
}

const meta: Meta<typeof UnlockTile> = {
  title: "Species/UnlockTile",
  component: UnlockTile,
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj<typeof UnlockTile>;

/**
 * The headline moment: silhouette dissolves into the photo, one teal shockwave
 * ring fires from the centre, the photo settles with a gentle scale. Hit Replay
 * to watch it again.
 */
export const JustUnlocked: Story = {
  render: () => (
    <Replayable>
      {(k) => (
        <ul key={k} className="m-0 list-none p-0">
          <UnlockTile
            photoUrl={FAKE_PHOTO}
            commonName="Cuckoo Wrasse"
            slug="labrus-mixtus"
            shapeClass="fish"
            justUnlocked
          />
        </ul>
      )}
    </Replayable>
  ),
};

/**
 * Reduced-motion path: the unlocked photo + name render statically (no
 * dissolve, no ring). The end state is identical to the resting collected tile,
 * so the user loses only the flourish.
 */
export const JustUnlockedReducedMotion: Story = {
  render: () => (
    <ul className="m-0 list-none p-0 w-full max-w-[220px]">
      <UnlockTile
        photoUrl={FAKE_PHOTO}
        commonName="Cuckoo Wrasse"
        slug="labrus-mixtus"
        shapeClass="fish"
        justUnlocked
        reduceMotion
      />
    </ul>
  ),
};

/** A normal, already-collected tile (no reveal) — the steady-state look. */
export const AtRest: Story = {
  render: () => (
    <ul className="m-0 list-none p-0 w-full max-w-[220px]">
      <UnlockTile
        photoUrl={FAKE_PHOTO}
        commonName="Cuckoo Wrasse"
        slug="labrus-mixtus"
        shapeClass="fish"
        justUnlocked={false}
      />
    </ul>
  ),
};

/**
 * No curated photo yet: falls back to a name chip on the navy card (and the
 * ring still fires, so the unlock still feels rewarded).
 */
export const NoPhotoFallback: Story = {
  render: () => (
    <Replayable>
      {(k) => (
        <ul key={k} className="m-0 list-none p-0">
          <UnlockTile
            commonName="Poor Cod"
            slug="trisopterus-minutus"
            shapeClass="fish"
            justUnlocked
          />
        </ul>
      )}
    </Replayable>
  ),
};

/**
 * The full unlock BEAT as the spotter sees it: the tile reveal and the
 * shape-class badge ticking up by one (3 -> 4) fire together. This is the
 * proof that the badge tick is part of the same moment.
 */
export const FullBeatWithBadgeTick: Story = {
  render: () => (
    <Replayable>
      {(k) => (
        <div key={k} className="flex w-full max-w-[260px] flex-col items-start gap-4">
          <ProgressBadge label="Fish" unlocked={4} total={8} justTicked />
          <ul className="m-0 w-[220px] list-none p-0">
            <UnlockTile
              photoUrl={FAKE_PHOTO}
              commonName="Cuckoo Wrasse"
              slug="labrus-mixtus"
              shapeClass="fish"
              justUnlocked
            />
          </ul>
        </div>
      )}
    </Replayable>
  ),
};

/** Badge tick in isolation: the numerator rolls from 2 -> 3 with a small pop. */
export const BadgeTickOnly: Story = {
  render: () => (
    <Replayable label="Replay tick">
      {(k) => (
        <div key={k}>
          <ProgressBadge label="Crab" unlocked={3} total={6} justTicked />
        </div>
      )}
    </Replayable>
  ),
};
