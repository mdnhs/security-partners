import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test"

import { BASE_URL } from "../e2e/env"
import { clientIpFor } from "../e2e/fixtures"

import { VISUAL_ADMIN } from "./admin-user"
import { freezeMotion } from "./freeze-motion"

// Baselines are macOS renders (ledger ruling): CI runs E2E only.
test.skip(process.platform !== "darwin", "visual baselines are macOS-only")

// Phase 8 Task 10: the consent banner's own baselines (new, separate from
// the 40 frozen public baselines). The public baselines never show it:
// tracking is seeded off (tests/visual/seed.ts → seedContent), and the
// banner renders only while tracking is enabled. These tests switch tracking
// on (no tag IDs, so nothing loads) for a fresh visitor and switch it off
// again in afterAll, so public-pages.spec.ts still sees the seeded state.

const SAME_ORIGIN = { origin: BASE_URL }

async function signIn(page: Page) {
  await page.goto("/admin/sign-in")
  await page.getByLabel("Email").fill(VISUAL_ADMIN.email)
  await page.getByLabel("Password", { exact: true }).fill(VISUAL_ADMIN.password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL((url) => url.pathname === "/admin")
}

async function publishTracking(request: APIRequestContext, enabled: boolean) {
  const dto = (await (
    await request.get("/api/v1/admin/marketing/tracking")
  ).json()) as { draft: Record<string, unknown>; version: number }
  const saved = await request.put("/api/v1/admin/marketing/tracking/draft", {
    headers: SAME_ORIGIN,
    data: {
      draft: { enabled, gtmId: null, ga4Id: null, metaPixelId: null },
      version: dto.version,
    },
  })
  expect(saved.status()).toBe(200)
  const { version } = (await saved.json()) as { version: number }
  const published = await request.post(
    "/api/v1/admin/marketing/tracking/publish",
    { headers: SAME_ORIGIN, data: { version } }
  )
  expect(published.status()).toBe(200)
}

test.describe.serial("consent banner (tracking on)", () => {
  let admin: Page

  test.beforeAll(async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      extraHTTPHeaders: {
        "x-forwarded-for": clientIpFor(
          `visual consent banner ${testInfo.project.name}`
        ),
      },
    })
    admin = await context.newPage()
    await signIn(admin)
    await publishTracking(admin.request, true)
  })

  test.afterAll(async () => {
    await publishTracking(admin.request, false)
    await admin.context().close()
  })

  test("first visit, customise, and the reopen button", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" })
    await freezeMotion(page)
    const banner = page.locator("[data-consent-banner]")
    await expect(banner).toBeVisible()
    await expect(banner).toHaveScreenshot("consent-banner.png")

    await banner.getByRole("button", { name: "Customise" }).click()
    await expect(
      banner.getByRole("checkbox", { name: /Necessary/ })
    ).toBeDisabled()
    await expect(banner).toHaveScreenshot("consent-banner-customise.png")

    await banner.getByRole("button", { name: "Save choices" }).click()
    await expect(banner).toBeHidden()
    const manage = page.getByRole("button", { name: "Cookie settings" })
    await expect(manage).toBeVisible()
    await expect(manage).toHaveScreenshot("consent-manage-button.png")
  })
})
