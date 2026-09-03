import { defineConfig, devices } from "@playwright/test";

// A worktree's dev server runs on its own port; point the suite at it with
// PLAYWRIGHT_BASE_URL=http://localhost:<port>. Unset, it is the usual :3000.
// The dev server Playwright starts (when nothing is already listening there)
// is told the same port, so the two can never disagree.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const port = new URL(baseURL).port || "3000";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  webServer: {
    command: `npm run dev -- -p ${port}`,
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    // Both projects run Chromium. Mobile uses the Pixel 7 device descriptor
    // (Chromium-backed) instead of iPhone 14 Pro (which is WebKit and
    // requires `playwright install webkit`, CI only installs Chromium for
    // speed). The H.264 codec invariant is Chrome-specific anyway, so
    // standardising on Chromium also matches the production-browser of
    // concern.
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.005 } },
});
