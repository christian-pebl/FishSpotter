"use client";

import { useEffect } from "react";
import { captureLandingAttribution } from "@/lib/landing-attribution";

/**
 * Remembers, in memory only, where this visit came from (UTM tags and referrer
 * hostname) on the first page the visitor opens, so the engagement tracker can
 * still attribute the session after "Start spotting" drops the query string.
 * See src/lib/landing-attribution.ts.
 */
export function LandingAttribution() {
  useEffect(() => {
    captureLandingAttribution();
  }, []);
  return null;
}
