import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { AnnotatedSpeciesPhotoView } from "./AnnotatedSpeciesPhoto";
import type { SpeciesImagePayload, SpeciesMarkPayload } from "@/app/api/species-images/[scientificName]/route";

/**
 * Story for the diagnostic-ring DRAW-ON teaching sequence.
 *
 * The shipped `AnnotatedSpeciesPhoto` fetches `/api/species-images`. To play
 * the rings WITHOUT the network, we render its presentational core
 * (`AnnotatedSpeciesPhotoView`) directly with mock `image` + `marks`, and use a
 * self-contained inline-SVG data-URI as the "photo" so nothing is requested
 * over the wire. A Replay button remounts the view to re-run the sequence.
 */

// A fixed-size mock so the ring/badge geometry (which is normalised 0..1 over
// the image dimensions) maps to a stable layout. 1000x750 = the 4:3 default.
const MOCK_W = 1000;
const MOCK_H = 750;

// Inline line-art "fish" placeholder (teal stroke on navy), encoded as a
// data-URI so the story never touches the network. Stands in for the iNat
// reference photo; the rings are what the story is demonstrating.
const PLACEHOLDER_PHOTO = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MOCK_W} ${MOCK_H}">
    <rect width="${MOCK_W}" height="${MOCK_H}" fill="#17252A"/>
    <g fill="none" stroke="#2B7A78" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">
      <path d="M180 375c120-150 360-220 540-220 70 0 130 18 180 48-40 70-40 274 0 344-50 30-110 48-180 48-180 0-420-70-540-220z"/>
      <path d="M900 203l80-58v460l-80-58z"/>
      <path d="M300 290c70-44 150-44 220 0M300 460c70 44 150 44 220 0"/>
    </g>
    <circle cx="330" cy="300" r="14" fill="#2B7A78"/>
  </svg>`,
)}`;

const MOCK_IMAGE: SpeciesImagePayload = {
  id: "mock-1",
  url: PLACEHOLDER_PHOTO,
  thumbUrl: null,
  attribution: "Mock reference photo · CC BY · story fixture",
  sourceUrl: "https://example.org",
  license: "cc-by",
  lifeStage: null,
  sex: null,
  width: MOCK_W,
  height: MOCK_H,
  observedOn: null,
  placeGuess: null,
  source: "manual",
  marks: [],
};

// Four diagnostic marks spread across the frame so the staggered draw-on and
// the upper-right / fallback-diagonal badge placement are both visible.
const MOCK_MARKS: SpeciesMarkPayload[] = [
  {
    label: "Operculum spot",
    description: "Dark blotch on the rear edge of the gill cover.",
    overlayX: 0.32,
    overlayY: 0.4,
    overlayRadius: 0.12,
    order: 0,
  },
  {
    label: "Lateral line",
    description: "Pale, gently curved line running mid-flank to the tail.",
    overlayX: 0.55,
    overlayY: 0.45,
    overlayRadius: 0.1,
    order: 1,
  },
  {
    label: "Dorsal fin base",
    description: "Long-based dorsal fin; note the soft-ray count.",
    overlayX: 0.6,
    overlayY: 0.22,
    overlayRadius: 0.09,
    order: 2,
  },
  {
    label: "Caudal peduncle",
    description: "Slender, deep tail wrist just before the fin spreads.",
    overlayX: 0.82,
    overlayY: 0.55,
    overlayRadius: 0.08,
    order: 3,
  },
];

const meta: Meta<typeof AnnotatedSpeciesPhotoView> = {
  title: "IdGuide/AnnotatedSpeciesPhoto",
  component: AnnotatedSpeciesPhotoView,
  parameters: {
    layout: "centered",
    // The component is built for the dark reveal surface; frame it that way.
    backgrounds: { default: "navy" },
  },
};
export default meta;

type Story = StoryObj<typeof AnnotatedSpeciesPhotoView>;

/** Small dark frame matching the reveal context + a Replay control that
 *  remounts the view (bumping replayKey) to re-play the draw-on. */
function Stage({ forceReduceMotion }: { forceReduceMotion?: boolean }) {
  const [replayKey, setReplayKey] = useState(0);
  return (
    <div className="w-[420px] max-w-full rounded-card bg-navy-900 p-4">
      <button
        type="button"
        onClick={() => setReplayKey((k) => k + 1)}
        className="mb-3 inline-flex items-center gap-2 rounded-full bg-teal-500 px-3 py-1.5 text-xs font-semibold text-navy-900"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
          <path
            d="M13 8a5 5 0 1 1-1.46-3.54M13 2.5V5h-2.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Replay
      </button>
      <AnnotatedSpeciesPhotoView
        key={replayKey}
        replayKey={replayKey}
        forceReduceMotion={forceReduceMotion}
        image={MOCK_IMAGE}
        marks={MOCK_MARKS}
        commonName="Mock wrasse"
      />
    </div>
  );
}

/**
 * The teaching sequence: rings trace on one at a time (~0.5s each, ~0.4s apart),
 * each numbered badge + legend row fading in in sync with its ring. Press
 * Replay to watch it again.
 */
export const DrawOnSequence: Story = {
  render: () => <Stage />,
};

/**
 * Reduced-motion fallback: every ring, badge and legend row is shown at once as
 * a correct, informative static end state (the original pre-animation
 * behaviour). Replay is a no-op here by design.
 */
export const ReducedMotion: Story = {
  name: "Reduced motion (static end state)",
  render: () => <Stage forceReduceMotion />,
};
