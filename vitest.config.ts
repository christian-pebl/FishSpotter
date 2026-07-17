import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

export default defineConfig(({ mode }) => ({
  test: {
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "scripts/**/__tests__/*.{test,spec}.ts",
    ],
    // Exclude Playwright e2e specs (they live under tests/).
    exclude: ["tests/**", "node_modules/**", ".next/**"],
    // Default environment for pure-logic and scripts tests (the ~36 existing files).
    environment: "node",
    // Component and route tests need a DOM, so map those two trees to jsdom.
    // Everything else (notably src/lib/**) stays on the node default above.
    environmentMatchGlobs: [
      ["src/components/**", "jsdom"],
      ["src/app/**", "jsdom"],
    ],
    // Runs for every test file (node and jsdom): adds jest-dom matchers and a
    // DOM-guarded afterEach cleanup() (see vitest.setup.ts).
    setupFiles: ["./vitest.setup.ts"],
    // loadEnv (unlike Vite's default) is not prefix-filtered, so this pulls
    // in .env/.env.local as-is. Needed because src/lib/auth.ts throws at
    // import time without NEXTAUTH_SECRET, and any test touching admin.ts
    // (or auth.ts itself) transitively imports it — a bare `vitest run`
    // otherwise fails module collection in a fresh checkout / CI.
    env: loadEnv(mode, process.cwd(), ""),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  // Use the React 17+ automatic JSX runtime (matches Next's compiler) so
  // component tests do not need an explicit React import.
  esbuild: { jsx: "automatic" },
}));
