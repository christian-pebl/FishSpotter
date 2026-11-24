import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

// Component and route tests need a DOM, so those two trees run under jsdom.
// Everything else (notably src/lib/**) runs under node. A file can still pick
// its own with a `// @vitest-environment` comment. Two projects since vitest 4
// removed `environmentMatchGlobs`, which used to express this mapping.
const DOM_TREES = ["src/components/**", "src/app/**"];
const TEST_FILES = "*.{test,spec}.{ts,tsx}";
// Playwright e2e specs live under tests/ and are not vitest's.
const NEVER = ["tests/**", "node_modules/**", ".next/**"];

export default defineConfig(({ mode }) => ({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: [`src/**/${TEST_FILES}`, "scripts/**/__tests__/*.{test,spec}.ts"],
          exclude: [...NEVER, ...DOM_TREES],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: DOM_TREES.map((tree) => `${tree}/${TEST_FILES}`),
          exclude: NEVER,
        },
      },
    ],
    // Runs for every test file (node and jsdom): adds jest-dom matchers and a
    // DOM-guarded afterEach cleanup() (see vitest.setup.ts).
    setupFiles: ["./vitest.setup.ts"],
    // loadEnv (unlike Vite's default) is not prefix-filtered, so this pulls
    // in .env/.env.local as-is. Needed because src/lib/auth.ts throws at
    // import time without NEXTAUTH_SECRET, and any test touching admin.ts
    // (or auth.ts itself) transitively imports it, a bare `vitest run`
    // otherwise fails module collection in a fresh checkout / CI.
    env: loadEnv(mode, process.cwd(), ""),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  // Use the React 17+ automatic JSX runtime (matches Next's compiler) so
  // component tests do not need an explicit React import. Vite 8 transforms
  // with oxc, not esbuild.
  oxc: { jsx: { runtime: "automatic" } },
}));
