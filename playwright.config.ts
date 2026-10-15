import { defineConfig, devices } from "@playwright/test"

import { E2E_ENV, PORT } from "./tests/e2e/env"

export default defineConfig({
  testDir: "tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  snapshotPathTemplate: "{testDir}/visual/__screenshots__/{arg}-{projectName}{ext}",
  expect: {
    toHaveScreenshot: { maxDiffPixels: 0, animations: "disabled", caret: "hide", scale: "css" },
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [
    { name: "desktop", testMatch: "visual/**/*.spec.ts", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", testMatch: "visual/**/*.spec.ts", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: false, hasTouch: true } },
    // Admin E2E: migrate + seed sp_e2e first (tests/e2e/global.setup.ts).
    { name: "e2e-setup", testMatch: "e2e/global.setup.ts" },
    { name: "e2e", testMatch: "e2e/**/*.spec.ts", dependencies: ["e2e-setup"], use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    // Build (no DB), then reset + migrate + seed sp_e2e so pages render the
    // seeded content (tests/visual/seed.ts), then serve it.
    command: `pnpm build && pnpm tsx:server tests/visual/seed.ts && pnpm start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    // Always start our own server: a stale one on the port would serve old
    // code or lack the E2E env (port must be free).
    reuseExistingServer: false,
    timeout: 300_000,
    // `next start` never reads .env.development; the server gets the E2E
    // database and auth env here (the build itself needs none).
    env: E2E_ENV,
  },
})
