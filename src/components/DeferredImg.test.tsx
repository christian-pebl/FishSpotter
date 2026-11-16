import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeferredImg } from "./DeferredImg";
import type { SizedImage } from "@/lib/sized-image";

let painted = false;
vi.mock("@/lib/useAfterFirstPaint", () => ({
  useAfterFirstPaint: () => painted,
}));

const OPTIMIZED: SizedImage = {
  src: "/_next/image?url=%2Ffarm-media%2Fkaly%2Fhero.webp&w=256&q=75",
  srcSet:
    "/_next/image?url=%2Ffarm-media%2Fkaly%2Fhero.webp&w=256&q=75 256w, /_next/image?url=%2Ffarm-media%2Fkaly%2Fhero.webp&w=384&q=75 384w",
  fallbackSrc: "/farm-media/kaly/hero.webp",
};

const WIKIMEDIA: SizedImage = {
  src: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/X.jpg/500px-X.jpg",
  fallbackSrc: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/X.jpg/960px-X.jpg",
  crossOrigin: "anonymous",
};

beforeEach(() => {
  painted = false;
});

describe("DeferredImg", () => {
  it("requests nothing before the first paint, but keeps its alt text and box", () => {
    render(<DeferredImg image={OPTIMIZED} alt="Kaly farm" className="h-full w-full" />);
    const img = screen.getByAltText("Kaly farm");
    expect(img.getAttribute("src")).toMatch(/^data:image\/gif/);
    expect(img.hasAttribute("srcset")).toBe(false);
    expect(img).toHaveClass("h-full", "w-full");
  });

  it("loads the sized source, lazily, once the page has painted", () => {
    painted = true;
    render(<DeferredImg image={OPTIMIZED} alt="Kaly farm" sizes="34vw" />);
    const img = screen.getByAltText("Kaly farm");
    expect(img.getAttribute("src")).toBe(OPTIMIZED.src);
    expect(img.getAttribute("srcset")).toBe(OPTIMIZED.srcSet);
    expect(img.getAttribute("sizes")).toBe("34vw");
    expect(img.getAttribute("loading")).toBe("lazy");
  });

  it("falls back to the original URL if the sized one fails", () => {
    painted = true;
    render(<DeferredImg image={OPTIMIZED} alt="Kaly farm" sizes="34vw" />);
    fireEvent.error(screen.getByAltText("Kaly farm"));
    const img = screen.getByAltText("Kaly farm");
    expect(img.getAttribute("src")).toBe("/farm-media/kaly/hero.webp");
    expect(img.hasAttribute("srcset")).toBe(false);
  });

  it("loads a Wikimedia photo without credentials, and drops that on fallback", () => {
    painted = true;
    render(<DeferredImg image={WIKIMEDIA} alt="Thick-lipped mullet" sizes="128px" />);
    let img = screen.getByAltText("Thick-lipped mullet");
    expect(img.getAttribute("crossorigin")).toBe("anonymous");
    // No srcSet, so no `sizes` either (it is meaningless without one).
    expect(img.hasAttribute("sizes")).toBe(false);

    fireEvent.error(img);
    img = screen.getByAltText("Thick-lipped mullet");
    expect(img.getAttribute("src")).toBe(WIKIMEDIA.fallbackSrc);
    expect(img.hasAttribute("crossorigin")).toBe(false);
  });
});
