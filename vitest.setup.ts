// Vitest global setup. Runs for EVERY test file (node and jsdom alike),
// so anything DOM-specific must be guarded for the node environment.

// Registers the jest-dom matchers (toBeInTheDocument, toHaveTextContent, ...).
// Safe to import under node: it only extends Vitest's expect, it does not touch the DOM.
import "@testing-library/jest-dom/vitest";

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// cleanup() unmounts React trees rendered by @testing-library/react and needs a
// live DOM. Node-environment tests have no document, so guard the call: in node
// there is nothing to clean up and invoking cleanup() would throw.
afterEach(() => {
  if (typeof document !== "undefined") {
    cleanup();
  }
});
