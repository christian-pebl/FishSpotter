"use client";

import { useEffect, useRef } from "react";

type ProbabilityResponse =
  | {
      status: "OK";
      source: string;
      totalRecords: number;
      species: Array<{ scientificName: string; count: number; probability: number }>;
      // Omitted server-side until the user has submitted an Answer for this
      // snippet (S1-T11 answer-gate). Consumers must treat as optional.
      staffAnswerScientific?: string | null;
      fetchedAt: string;
    }
  | { status: "INSUFFICIENT_DATA" }
  | { status: "ERROR"; errorMessage?: string };

/**
 * Headless resolver: fetches the per-snippet probability payload purely to
 * surface the reference answer's canonical scientific name, then fires
 * `onResolve` and renders nothing.
 *
 * It exists because the reveal card's reference photo gallery + annotated
 * diagnostic-mark photo, the `RevealResult` scientific-name line, and the
 * IdGuide trigger all key off `staffScientific`, which is only known after
 * `/probability` resolves it server-side (via SpeciesNameMap). The visible
 * "Ecological likelihood" panel that used to do this fetch was removed, so
 * this carries the side-effect on its own.
 *
 * Mount only inside the post-answer reveal for a referenced clip (the route
 * returns `staffAnswerScientific` only once the user has answered).
 */
export function StaffScientificResolver({
  snippetId,
  onResolve,
}: {
  snippetId: string;
  onResolve: (scientificName: string | null) => void;
}) {
  // Keep the latest callback in a ref so the fetch effect depends only on the
  // snippet id and never re-runs just because the parent re-rendered.
  const resolveRef = useRef(onResolve);
  useEffect(() => {
    resolveRef.current = onResolve;
  }, [onResolve]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/snippets/${snippetId}/probability`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ProbabilityResponse;
        if (cancelled) return;
        resolveRef.current(json.status === "OK" ? json.staffAnswerScientific ?? null : null);
      } catch {
        if (!cancelled) resolveRef.current(null);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [snippetId]);

  return null;
}
