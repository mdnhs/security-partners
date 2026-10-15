import { expect, test } from "@playwright/test"

import { freezeMotion } from "./freeze-motion"
import { PUBLIC_URLS } from "./urls"

const name = (url: string) => (url === "/" ? "home" : url.slice(1).replaceAll("/", "-"))

for (const url of PUBLIC_URLS) {
  test(`public page ${url} is pixel-identical`, async ({ page }) => {
    await page.goto(url, { waitUntil: "networkidle" })
    await freezeMotion(page)
    await expect(page).toHaveScreenshot(`${name(url)}.png`, { fullPage: true })
  })
}
