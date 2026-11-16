import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RevealOnView } from "./RevealOnView";
import { StepCards } from "./StepCards";

/**
 * The scroll reveal replaced a framer-motion `whileInView`: opacity 0 to 1 and
 * a 24 px rise, 0.3 s ease-out, 0.12 s stagger, once, at 40% visible. These pin
 * those numbers, so the swap to plain CSS cannot drift from what visitors saw.
 */

type Entry = { isIntersecting: boolean };

class FakeObserver {
  static all: FakeObserver[] = [];
  observe = vi.fn();
  disconnect = vi.fn();
  constructor(
    readonly callback: (entries: Entry[]) => void,
    readonly options: IntersectionObserverInit,
  ) {
    FakeObserver.all.push(this);
  }
  fire(isIntersecting: boolean) {
    this.callback([{ isIntersecting }]);
  }
}

beforeEach(() => {
  FakeObserver.all = [];
  vi.stubGlobal("IntersectionObserver", FakeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function card() {
  return screen.getByText("hello").closest("article") as HTMLElement;
}

describe("RevealOnView", () => {
  it("starts hidden, lowered 24 px, so the card never flashes before it reveals", () => {
    render(<RevealOnView>hello</RevealOnView>);

    expect(card().style.opacity).toBe("0");
    expect(card().style.transform).toBe("translateY(24px)");
  });

  it("transitions opacity and transform over 0.3 s ease-out, with no delay for the first card", () => {
    render(<RevealOnView>hello</RevealOnView>);

    const style = card().getAttribute("style") ?? "";
    expect(style).toContain("opacity 300ms ease-out 0ms");
    expect(style).toContain("transform 300ms ease-out 0ms");
  });

  it("staggers each following card by 0.12 s", () => {
    render(<RevealOnView index={2}>hello</RevealOnView>);

    const style = card().getAttribute("style") ?? "";
    expect(style).toContain("opacity 300ms ease-out 240ms");
    expect(style).toContain("transform 300ms ease-out 240ms");
  });

  it("waits for 40% of the card to be on screen", () => {
    render(<RevealOnView>hello</RevealOnView>);

    expect(FakeObserver.all).toHaveLength(1);
    expect(FakeObserver.all[0].options.threshold).toBe(0.4);
    expect(FakeObserver.all[0].observe).toHaveBeenCalledWith(card());
  });

  it("stays hidden while off screen, then rises into place once and stops watching", () => {
    render(<RevealOnView>hello</RevealOnView>);
    const [observer] = FakeObserver.all;

    act(() => observer.fire(false));
    expect(card().style.opacity).toBe("0");
    expect(observer.disconnect).not.toHaveBeenCalled();

    act(() => observer.fire(true));
    expect(card().style.opacity).toBe("1");
    expect(card().style.transform).toBe("none");
    expect(observer.disconnect).toHaveBeenCalled();
  });

  it("does not hide it again when it scrolls back out (once)", () => {
    render(<RevealOnView>hello</RevealOnView>);
    const [observer] = FakeObserver.all;

    act(() => observer.fire(true));
    act(() => observer.fire(false));
    expect(card().style.opacity).toBe("1");
  });

  it("shows the card straight away where there is no IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<RevealOnView>hello</RevealOnView>);

    expect(card().style.opacity).toBe("1");
    expect(card().style.transform).toBe("none");
  });
});

describe("StepCards", () => {
  it("is three cards that reveal 0.12 s apart", () => {
    const { container } = render(<StepCards />);

    const articles = container.querySelectorAll("article");
    expect(articles).toHaveLength(3);
    const delays = [...articles].map((a) => /opacity 300ms ease-out (\d+)ms/.exec(a.getAttribute("style") ?? "")?.[1]);
    expect(delays).toEqual(["0", "120", "240"]);
    expect(screen.getByText("Spot the species")).toBeInTheDocument();
    expect(screen.getByText("Build a streak")).toBeInTheDocument();
  });
});
