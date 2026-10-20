import { expect, test } from "@playwright/test"

import { VISUAL_BUILDER_SLUG } from "./builder-slug"
import { freezeMotion } from "./freeze-motion"

// Builder pages (D5.3): new baselines only. The 40 public baselines
// (public-pages.spec.ts) must not move. /p/visual-fixture is seeded by
// tests/visual/seed.ts with every block type.
test.skip(process.platform !== "darwin", "visual baselines are macOS-only")

test("builder page /p/visual-fixture", async ({ page }) => {
  const res = await page.goto(`/p/${VISUAL_BUILDER_SLUG}`, {
    waitUntil: "networkidle",
  })
  expect(res?.status()).toBe(200)
  await freezeMotion(page)
  await expect(page.locator("[data-consent-banner]")).toHaveCount(0)
  await expect(page).toHaveScreenshot("p-visual-fixture.png", {
    fullPage: true,
  })
})
