import type { Meta, StoryObj } from "@storybook/react";
import { useCallback, useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Isolation story for the RUNG-3 PHOTO FADE-IN added to
 * `CandidateGate.tsx` (the `TilePhoto` media node).
 *
 * The real tile photo starts at opacity 0 and fades to 1 over ~180ms
 * (≈ DURATION.micro) on the lazy <img>'s onLoad; reduced motion shows the
 * photo at opacity 1 immediately. `TilePhoto` is private to CandidateGate, so
 * this story re-creates the exact same markup + fade classes (a faithful
 * stand-in) and mocks the photo arrival so the fade is observable on demand —
 * no /api fetch, no DB, no network. The fetch / ordering logic in
 * CandidateGate is intentionally NOT exercised here; this story is only the
 * micro-animation.
 *
 * Replay re-mounts the grid (bumps a key) and re-staggers the "photos arrive"
 * so you can watch the fade fire again. The Reduced-motion story renders the
 * static end state (every tile already at full opacity).
 */

const meta: Meta = {
  title: "ID flow/CandidateGate · Rung-3 photo fade-in",
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj;

// A few on-brand teal "photo" stand-ins (inline SVG data-URIs) so the grid
// reads as marine content with zero network. Each is a different teal so the
// pop-in is easy to see tile-by-tile.
const TEALS = ["#3AAFA9", "#2B7A78", "#5eead4", "#1F5F5D", "#17252A", "#DEF2F1"];
const FISH_PATH =
  "M6 16c3-7 9-11 16-11 9 0 16 5 19 11-3 6-10 11-19 11-7 0-13-4-16-11z";
const photoDataUri = (bg: string, stroke: string) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 32'>` +
      `<rect width='48' height='32' fill='${bg}'/>` +
      `<path d='${FISH_PATH}' fill='none' stroke='${stroke}' stroke-width='2' stroke-linejoin='round'/>` +
      `<path d='M41 16l6-5v10l-6-5z' fill='none' stroke='${stroke}' stroke-width='2' stroke-linejoin='round'/>` +
      `</svg>`,
  );

const SPECIES = [
  "Ballan wrasse",
  "Pollack",
  "Corkwing wrasse",
  "Goldsinny wrasse",
  "Two-spotted goby",
  "Shanny",
];

/** Faithful copy of CandidateGate's `TilePhoto` fade markup + behaviour, so the
 * story plays the genuine animation. `delayMs` mocks network arrival: the real
 * src is withheld until then, so onLoad (and the fade) fire visibly on replay. */
function StoryTilePhoto({ src, delayMs }: { src: string; delayMs: number }) {
  const reduce = useReducedMotion();
  const [loaded, setLoaded] = useState(false);
  const [liveSrc, setLiveSrc] = useState<string | null>(null);

  // Withhold the src to simulate the photo arriving from the network; a real
  // data-URI would paint instantly and the fade would never be seen.
  useEffect(() => {
    const t = window.setTimeout(() => setLiveSrc(src), delayMs);
    return () => window.clearTimeout(t);
  }, [src, delayMs]);

  const onRef = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.currentSrc) setLoaded(true);
  }, []);

  return (
    <span className="block aspect-square w-full overflow-hidden rounded-modal bg-white/5">
      {liveSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={onRef}
          src={liveSrc}
          alt=""
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={[
            "h-full w-full object-cover",
            reduce
              ? "opacity-100"
              : "opacity-0 transition-opacity duration-[180ms] ease-out",
            loaded ? "opacity-100" : "",
          ].join(" ")}
        />
      ) : (
        // Empty frame while the "photo" is still arriving (mirrors the tile's
        // bg-white/5 placeholder before the first paint).
        <span className="block h-full w-full" />
      )}
    </span>
  );
}

/** The Rung-3 tile chrome (a trimmed copy of TileGate's photo tile) so the fade
 * is shown in its real context: dark card, teal border, label beneath. */
function TileGrid({ runKey }: { runKey: number }) {
  return (
    <div
      key={runKey}
      className="grid gap-1.5"
      style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
    >
      {SPECIES.map((label, i) => (
        <div
          key={label}
          className="relative flex flex-col items-center justify-center gap-1 rounded-modal border border-white/15 bg-white/5 p-1 text-teal-500"
        >
          <StoryTilePhoto
            src={photoDataUri(TEALS[i % TEALS.length], i % TEALS.length === 4 ? "#5eead4" : "#17252A")}
            // Stagger arrival 80ms apart so the pop-in cascades, like real
            // photos landing one after another.
            delayMs={120 + i * 80}
          />
          <span className="text-center text-[11px] font-semibold uppercase leading-tight tracking-wider text-white/70">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  // The navy gate surface the real tiles sit on, so contrast reads true.
  return (
    <div className="rounded-card border border-white/12 bg-navy-900/95 p-4 shadow-menu backdrop-blur w-[min(28rem,90vw)]">
      <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-widest text-white/55">
        Which one is it? Tap to compare
      </p>
      {children}
    </div>
  );
}

export const PhotoFadeIn: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [runKey, setRunKey] = useState(0);
    return (
      <div className="flex flex-col items-center gap-3">
        <Frame>
          <TileGrid runKey={runKey} />
        </Frame>
        <button
          type="button"
          onClick={() => setRunKey((k) => k + 1)}
          className="rounded-full bg-teal-600 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white hover:bg-teal-500"
        >
          Replay fade
        </button>
        <p className="max-w-xs text-center text-[11px] text-navy-900/60">
          Tiles start transparent and fade to full opacity over ~180ms as each
          mock photo &ldquo;arrives&rdquo;. Press Replay to watch the cascade again.
        </p>
      </div>
    );
  },
};

export const ReducedMotion: Story = {
  parameters: {
    // Storybook can't force the OS media query per-story, so this variant
    // documents the intended static end state: every tile at full opacity,
    // no transition. (Toggle your OS "Reduce motion" to see PhotoFadeIn behave
    // identically — the component reads useReducedMotion().)
    docs: {
      description: {
        story:
          "Reduced-motion path: the photo renders at opacity 1 immediately, no fade. The component branches on useReducedMotion(); this story shows the resulting static state.",
      },
    },
  },
  render: () => (
    <div className="flex flex-col items-center gap-3">
      <Frame>
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
        >
          {SPECIES.map((label, i) => (
            <div
              key={label}
              className="relative flex flex-col items-center justify-center gap-1 rounded-modal border border-white/15 bg-white/5 p-1 text-teal-500"
            >
              <span className="block aspect-square w-full overflow-hidden rounded-modal bg-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoDataUri(
                    TEALS[i % TEALS.length],
                    i % TEALS.length === 4 ? "#5eead4" : "#17252A",
                  )}
                  alt=""
                  className="h-full w-full object-cover opacity-100"
                />
              </span>
              <span className="text-center text-[11px] font-semibold uppercase leading-tight tracking-wider text-white/70">
                {label}
              </span>
            </div>
          ))}
        </div>
      </Frame>
      <p className="max-w-xs text-center text-[11px] text-navy-900/60">
        Static end state (opacity 1, no transition) — what a reduced-motion user
        sees.
      </p>
    </div>
  ),
};
