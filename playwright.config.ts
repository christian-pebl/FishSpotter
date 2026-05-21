import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    // Both projects run Chromium. Mobile uses the Pixel 7 device descriptor
    // (Chromium-backed) instead of iPhone 14 Pro (which is WebKit and
    // requires `playwright install webkit` — CI only installs Chromium for
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
