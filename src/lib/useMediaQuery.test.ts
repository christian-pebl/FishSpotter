/**
 * @vitest-environment jsdom
 *
 * `src/lib/**` defaults to the node environment (see vitest.config.ts); this
 * hook talks to `window.matchMedia`, so it needs a DOM.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetMediaQueryRegistry, useMediaQuery } from "./useMediaQuery";

type Listener = (e: { matches: boolean }) => void;

/** A controllable matchMedia: `setMatches` flips a query and fires its listeners. */
function installMatchMedia(initial: Record<string, boolean>) {
  const state = { ...initial };
  const listeners = new Map<string, Set<Listener>>();
  const created: string[] = [];
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => {
      created.push(query);
      const mql = {
        media: query,
        get matches() {
          return !!state[query];
        },
        onchange: null,
        addEventListener: (_: "change", fn: Listener) => {
          if (!listeners.has(query)) listeners.set(query, new Set());
          listeners.get(query)!.add(fn);
        },
        removeEventListener: (_: "change", fn: Listener) => {
          listeners.get(query)?.delete(fn);
        },
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      };
      return mql as unknown as MediaQueryList;
    },
  });
  return {
    created,
    setMatches(query: string, value: boolean) {
      state[query] = value;
      listeners.get(query)?.forEach((fn) => fn({ matches: value }));
    },
  };
}

const WIDE = "(min-width: 768px)";

beforeEach(() => resetMediaQueryRegistry());
afterEach(() => {
  resetMediaQueryRegistry();
  // @ts-expect-error test teardown
  delete window.matchMedia;
});

describe("useMediaQuery", () => {
  it("answers correctly on the FIRST render of a client-mounted component", () => {
    // The whole point. A `useState(false)` + effect pattern renders false first
    // and corrects itself one paint later; a panel opened by a tap on a laptop
    // then paints as a phone sheet before jumping to the docked layout.
    installMatchMedia({ [WIDE]: true });
    const renders: boolean[] = [];
    renderHook(() => {
      const v = useMediaQuery(WIDE);
      renders.push(v);
      return v;
    });
    expect(renders[0]).toBe(true);
    expect(renders).not.toContain(false);
  });

  it("follows the viewport when the query flips", () => {
    const mm = installMatchMedia({ [WIDE]: true });
    const { result } = renderHook(() => useMediaQuery(WIDE));
    expect(result.current).toBe(true);
    act(() => mm.setMatches(WIDE, false));
    expect(result.current).toBe(false);
    act(() => mm.setMatches(WIDE, true));
    expect(result.current).toBe(true);
  });

  it("shares one MediaQueryList per query across every caller", () => {
    // The feed mounts 100+ cards. Each used to construct its own list and
    // change listener for the same query.
    const mm = installMatchMedia({ [WIDE]: false });
    const hooks = Array.from({ length: 25 }, () => renderHook(() => useMediaQuery(WIDE)));
    expect(mm.created).toEqual([WIDE]);
    act(() => mm.setMatches(WIDE, true));
    for (const h of hooks) expect(h.result.current).toBe(true);
  });

  it("falls back to the server value when the browser has no matchMedia", () => {
    // @ts-expect-error simulate an old browser / jsdom without the stub
    delete window.matchMedia;
    const { result } = renderHook(() => useMediaQuery(WIDE));
    expect(result.current).toBe(false);
    const { result: wide } = renderHook(() => useMediaQuery(WIDE, true));
    expect(wide.current).toBe(true);
  });
});
