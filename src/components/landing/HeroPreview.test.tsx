import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeroPreview } from "./HeroPreview";

let painted = false;
vi.mock("@/lib/useAfterFirstPaint", () => ({
  useAfterFirstPaint: () => painted,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children?: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const PROPS = {
  videoUrl: "/hero/velvet-crab-preview.mp4",
  poster: "/hero/velvet-crab-preview-3x4.webp",
  answer: "Velvet crab",
  distractors: ["Brown crab", "Hermit crab", "Spider crab"],
  site: "Pabay",
};

/** The poster probe: a stand-in for `new Image()` whose load we trigger by hand. */
let probes: { src: string; onload: (() => void) | null; onerror: (() => void) | null; complete: boolean }[] = [];

let play: ReturnType<typeof vi.fn>;
let pause: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  painted = false;
  probes = [];
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      complete = false;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {
        probes.push(this);
      }
    },
  );
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pause);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("HeroPreview", () => {
  it("renders a video that loads nothing by itself: poster only, no autoplay", () => {
    const { container } = render(<HeroPreview {...PROPS} />);
    const video = container.querySelector("video")!;
    expect(video.getAttribute("poster")).toBe(PROPS.poster);
    expect(video.getAttribute("preload")).toBe("none");
    expect(video.hasAttribute("autoplay")).toBe(false);
    // Still muted, looping and inline: what lets a phone play it without a tap.
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.hasAttribute("playsinline")).toBe(true);
  });

  it("does not start the clip before the page has painted", () => {
    render(<HeroPreview {...PROPS} />);
    act(() => vi.advanceTimersByTime(5000));
    expect(play).not.toHaveBeenCalled();
    expect(probes).toHaveLength(0);
  });

  it("starts the clip after the first paint, once the poster has arrived", () => {
    painted = true;
    render(<HeroPreview {...PROPS} />);
    expect(probes).toHaveLength(1);
    expect(probes[0].src).toBe(PROPS.poster);

    // Painted, but the poster is still on its way.
    act(() => vi.advanceTimersByTime(5000));
    expect(play).not.toHaveBeenCalled();

    act(() => probes[0].onload?.());
    expect(play).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(300));
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("still starts the clip when the poster fails to load", () => {
    painted = true;
    render(<HeroPreview {...PROPS} />);
    act(() => probes[0].onerror?.());
    act(() => vi.advanceTimersByTime(300));
    expect(play).toHaveBeenCalledTimes(1);
  });
});
