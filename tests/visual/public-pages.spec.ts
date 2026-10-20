import { expect, test } from "@playwright/test"

import { freezeMotion } from "./freeze-motion"
import { PUBLIC_URLS } from "./urls"

// Baselines are macOS renders (ledger ruling): CI runs E2E only.
test.skip(process.platform !== "darwin", "visual baselines are macOS-only")

const name = (url: string) =>
  url === "/" ? "home" : url.slice(1).replaceAll("/", "-")

for (const url of PUBLIC_URLS) {
  test(`public page ${url} is pixel-identical`, async ({ page }) => {
    await page.goto(url, { waitUntil: "networkidle" })
    await freezeMotion(page)
    // Tracking is seeded off, so no consent banner/button (Phase 8).
    await expect(page.locator("[data-consent-banner]")).toHaveCount(0)
    await expect(page).toHaveScreenshot(`${name(url)}.png`, { fullPage: true })
  })
}
