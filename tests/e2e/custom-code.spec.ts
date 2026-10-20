import { expect, type Page, test } from "@playwright/test"

import { E2E_ADMIN, E2E_OWNER } from "./admin-accounts"
import { BASE_URL } from "./env"
import { clientIpFor, E2E_PASSWORD } from "./fixtures"

// D2.3: owner-only custom code snippets — consent-gated and route-scoped.
// Tracking is switched on with every channel off: the banner shows, no
// tracker loads.

const SAME_ORIGIN = { origin: BASE_URL }
const NO_CODE = { disabled: false, allowedHosts: [], snippets: [] }
const TRACKING_OFF = {
  enabled: false,
  gtmEnabled: false,
  gtmId: null,
  ga4Enabled: false,
  ga4Id: null,
  metaEnabled: false,
  metaPixelId: null,
}

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

const probe = (page: Page) =>
  page.evaluate(() => (window as unknown as { __probe?: number }).__probe)

test.describe.serial("custom code snippets (D2.3)", () => {
  test("an analytics snippet on /blog/* waits for consent and stays off other pages", async ({
    page,
    browser,
  }) => {
    await signIn(page, E2E_OWNER.email)
    await page.goto("/admin/marketing/code")
    await expect(
      page.getByRole("heading", { level: 1, name: "Custom code" })
    ).toBeVisible()
    await publishSetting(page, "customCode", () => ({
      ...NO_CODE,
      snippets: [
        {
          id: crypto.randomUUID(),
          name: "Probe",
          placement: "body",
          src: "",
          html: "<script>window.__probe = 1</script>",
          category: "analytics",
          routes: ["/blog/*"],
          enabled: true,
        },
      ],
    }))
    await publishSetting(page, "tracking", (d) => ({
      ...d,
      ...TRACKING_OFF,
      enabled: true,
    }))
    try {
      const visitor = await browser.newContext()
      const site = await visitor.newPage()
      await site.goto("/blog")
      const banner = site.locator("[data-consent-banner]")
      await expect(banner).toBeVisible()
      await site.waitForLoadState("networkidle")
      expect(await probe(site)).toBeUndefined()

      await banner.getByRole("button", { name: "Accept all" }).click()
      await expect.poll(() => probe(site)).toBe(1)

      await site.goto("/")
      await site.waitForLoadState("networkidle")
      expect(await probe(site)).toBeUndefined()
      await expect(site.locator("#sp-custom-code-body")).toHaveCount(0)
      await visitor.close()
    } finally {
      await publishSetting(page, "customCode", () => NO_CODE)
      await publishSetting(page, "tracking", (d) => ({
        ...d,
        ...TRACKING_OFF,
      }))
    }
  })

  test("the kill switch stops every snippet and the admin page says so", async ({
    page,
    browser,
  }) => {
    await signIn(page, E2E_OWNER.email)
    await publishSetting(page, "customCode", () => ({
      ...NO_CODE,
      disabled: true,
      snippets: [
        {
          id: crypto.randomUUID(),
          name: "Probe",
          placement: "body",
          src: "",
          html: "<script>window.__probe = 1</script>",
          category: "necessary",
          routes: [],
          enabled: true,
        },
      ],
    }))
    try {
      await page.goto("/admin/marketing/code")
      await expect(
        page.getByRole("status").filter({ hasText: "switched off" })
      ).toBeVisible()
      const visitor = await browser.newContext()
      const site = await visitor.newPage()
      await site.goto("/")
      await site.waitForLoadState("networkidle")
      expect(await probe(site)).toBeUndefined()
      await visitor.close()
    } finally {
      await publishSetting(page, "customCode", () => NO_CODE)
    }
  })

  test("admins get 403 on custom code (owner-only kept)", async ({ page }) => {
    await signIn(page, E2E_ADMIN.email)
    expect(
      (await page.request.get("/api/v1/admin/marketing/customCode")).status()
    ).toBe(403)
  })
})
