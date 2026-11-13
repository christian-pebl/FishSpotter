"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";

/**
 * Load a component's code on demand, without a Suspense boundary.
 *
 * Used for the two pieces of the site header that need framer-motion (the side
 * menu and the Pebble bag), so the animation library is not in the JavaScript a
 * first visit downloads before the first paint. `next/dynamic` was the first
 * choice, but it is built on `React.lazy`: a lazy component whose code has
 * already arrived still renders its fallback for a beat, which is a flash of an
 * empty Pebble pill. This keeps the component in state instead, so it is either
 * not there or fully there.
 *
 * `load` must be a module-level constant (it is the cache key):
 *
 *     const loadMenu = () => import("@/components/SideMenu").then((m) => m.SideMenu);
 *     const [Menu, requestMenu] = useLazyComponent(loadMenu);
 *
 * `request` starts the load (idempotent) and is safe to call from an effect or an
 * event handler. A failed load (offline, a stale deploy) is not cached, so the
 * next `request` tries again.
 */

let resolved = new WeakMap<object, ComponentType<never>>();
let pending = new WeakMap<object, Promise<void>>();

export function useLazyComponent<P extends object>(
  load: () => Promise<ComponentType<P>>,
): [ComponentType<P> | null, () => void] {
  const [Component, setComponent] = useState<ComponentType<P> | null>(
    () => (resolved.get(load) as ComponentType<P> | undefined) ?? null,
  );
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const request = useCallback(() => {
    const ready = resolved.get(load) as ComponentType<P> | undefined;
    if (ready) {
      // `() => ready`: a bare component would be called as a state updater.
      setComponent(() => ready);
      return;
    }
    let inFlight = pending.get(load);
    if (!inFlight) {
      inFlight = load()
        .then((component) => {
          resolved.set(load, component as ComponentType<never>);
        })
        .catch(() => {
          // Leave it uncached so a later request retries.
        })
        .finally(() => {
          pending.delete(load);
        });
      pending.set(load, inFlight);
    }
    void inFlight.then(() => {
      const loaded = resolved.get(load) as ComponentType<P> | undefined;
      if (loaded && alive.current) setComponent(() => loaded);
    });
  }, [load]);

  return [Component, request];
}

/** Test seam: forget everything that has loaded, so each case starts cold. */
export function resetLazyComponentsForTests() {
  resolved = new WeakMap();
  pending = new WeakMap();
}
