import AxeBuilder from "@axe-core/playwright"
import { expect, type Page, test } from "@playwright/test"

import { E2E_ADMIN, E2E_OWNER } from "./admin-accounts"
import { BASE_URL } from "./env"
import { clientIpFor, E2E_PASSWORD } from "./fixtures"

// Master 8.3: no banner/scripts while tracking is off; with tracking on the
// banner gates GTM, GA4 and the Meta pixel; consent cookie 6 months;
// custom code owner-only. Trackers are stubbed (no network to Google/Meta).

const SAME_ORIGIN = { origin: BASE_URL }
const TRACKER = /googletagmanager\.com|connect\.facebook\.net/

test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(testInfo.title),
  })
})

async function signIn(page: Page, email: string) {
  await page.goto("/admin/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL((url) => url.pathname === "/admin")
}

async function publishSetting(
  page: Page,
  key: string,
  change: (draft: Record<string, unknown>) => Record<string, unknown>
) {
  const dto = (await (
    await page.request.get(`/api/v1/admin/marketing/${key}`)
  ).json()) as { draft: Record<string, unknown>; version: number }
  const saved = await page.request.put(`/api/v1/admin/marketing/${key}/draft`, {
    headers: SAME_ORIGIN,
    data: { draft: change(dto.draft), version: dto.version },
  })
  expect(saved.status()).toBe(200)
  const { version } = (await saved.json()) as { version: number }
  const published = await page.request.post(
    `/api/v1/admin/marketing/${key}/publish`,
    { headers: SAME_ORIGIN, data: { version } }
  )
  expect(published.status()).toBe(200)
}

async function stubTrackers(page: Page): Promise<string[]> {
  const requested: string[] = []
  await page.route(TRACKER, (route) => {
    requested.push(route.request().url())
    return route.fulfill({ contentType: "text/javascript", body: "" })
  })
  return requested
}

test.describe.serial("consent and tracking (master 8.3)", () => {
  test("tracking off: no banner, no reopen button, no tracker requests", async ({
    page,
  }) => {
    const requested = await stubTrackers(page)
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    await expect(page.locator("[data-consent-banner]")).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Cookie settings" })
    ).toHaveCount(0)
    expect(requested).toEqual([])
  })

  test("tracking on: the banner gates GTM, GA4 and the Meta pixel", async ({
    page,
    browser,
  }) => {
    await signIn(page, E2E_OWNER.email)
    await page.goto("/admin/marketing/tracking")
    await expect(
      page.getByRole("heading", { level: 1, name: "Tracking" })
    ).toBeVisible()
    await expect(page.getByLabel(/^Google Tag Manager ID/)).toBeVisible()
    await publishSetting(page, "tracking", (d) => ({
      ...d,
      enabled: true,
      gtmId: "GTM-E2ETEST",
      ga4Id: "G-E2ETEST1",
      metaPixelId: "1234567890",
    }))
    try {
      const visitor = await browser.newContext()
      const site = await visitor.newPage()
      const requested = await stubTrackers(site)
      await site.goto("/")
      const banner = site.locator("[data-consent-banner]")
      await expect(banner).toBeVisible()
      await expect(
        banner.getByRole("heading", { name: "We use cookies" })
      ).toBeVisible()
      await expect(
        banner.getByRole("link", { name: "Privacy Policy" })
      ).toHaveAttribute("href", "/privacy")
      const axe = await new AxeBuilder({ page: site })
        .include("[data-consent-banner]")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
      expect(axe.violations.map((v) => v.id)).toEqual([])
      await site.waitForLoadState("networkidle")
      expect(requested).toEqual([])

      await banner.getByRole("button", { name: "Accept all" }).click()
      await expect(banner).toBeHidden()
      await expect
        .poll(() => requested.map((u) => new URL(u).pathname).sort())
        .toEqual(["/en_US/fbevents.js", "/gtag/js", "/gtm.js"])
      const cookie = (await visitor.cookies()).find(
        (c) => c.name === "sp_consent"
      )!
      expect(cookie.value).toMatch(/^1\.1\.1\.\d+$/)
      const days = (cookie.expires * 1000 - Date.now()) / 86_400_000
      expect(days).toBeGreaterThan(179)
      expect(days).toBeLessThanOrEqual(180)

      requested.length = 0
      await site.reload()
      await expect(site.locator("[data-consent-banner]")).toHaveCount(0)
      await expect(
        site.getByRole("button", { name: "Cookie settings" })
      ).toBeVisible()
      await expect.poll(() => requested.length).toBeGreaterThan(0)
      await visitor.close()

      const other = await browser.newContext()
      const page2 = await other.newPage()
      const none = await stubTrackers(page2)
      await page2.goto("/")
      await page2
        .locator("[data-consent-banner]")
        .getByRole("button", { name: "Reject non-essential" })
        .click()
      await page2.waitForLoadState("networkidle")
      expect(none).toEqual([])
      expect(
        (await other.cookies()).find((c) => c.name === "sp_consent")?.value
      ).toMatch(/^1\.0\.0\./)
      await other.close()
    } finally {
      await publishSetting(page, "tracking", (d) => ({
        ...d,
        enabled: false,
        gtmId: null,
        ga4Id: null,
        metaPixelId: null,
      }))
    }
  })

  test("custom code: admins cannot see or change it", async ({ page }) => {
    await signIn(page, E2E_ADMIN.email)
    expect(
      (await page.request.get("/api/v1/admin/marketing/customCode")).status()
    ).toBe(403)
    await page.goto("/admin/marketing/tracking")
    await expect(
      page.getByRole("navigation", { name: "Marketing" })
    ).not.toContainText("Custom code")
  })

  test("custom code: the owner's snippets run on public pages", async ({
    page,
    browser,
  }) => {
    await signIn(page, E2E_OWNER.email)
    await page.goto("/admin/marketing/custom-code")
    await expect(
      page.getByRole("heading", { level: 1, name: "Custom code" })
    ).toBeVisible()
    await publishSetting(page, "customCode", () => ({
      headHtml:
        '<meta name="sp-e2e" content="head"><script>window.__spHead = 1</script>',
      bodyEndHtml: "<script>window.__spBody = 2</script>",
    }))
    try {
      const visitor = await browser.newContext()
      const site = await visitor.newPage()
      await site.goto("/about")
      await expect
        .poll(() =>
          site.evaluate(() => {
            const w = window as unknown as Record<string, unknown>
            return [w.__spHead, w.__spBody]
          })
        )
        .toEqual([1, 2])
      await expect(site.locator('head meta[name="sp-e2e"]')).toHaveCount(1)
      await visitor.close()
    } finally {
      await publishSetting(page, "customCode", () => ({
        headHtml: "",
        bodyEndHtml: "",
      }))
    }
  })
})
