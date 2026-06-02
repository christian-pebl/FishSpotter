"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Returns a ref + whether the element is currently in the viewport.
 * Used to pause always-on CSS/JS animations when scrolled off-screen
 * (CPU / battery saver). Defaults to `true` so content animates on first
 * paint before the observer fires, and degrades to always-on if
 * IntersectionObserver is unavailable.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
  options: IntersectionObserverInit = { threshold: 0.1 },
): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
    }, options);
    obs.observe(el);
    return () => obs.disconnect();
    // options is a stable literal at the call-site; re-running on identity
    // churn would thrash the observer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [ref, inView];
}
