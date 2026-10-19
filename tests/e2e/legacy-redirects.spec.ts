import { expect, type Page, test } from "@playwright/test"

import { E2E_OWNER } from "./admin-accounts"
import { clientIpFor, E2E_PASSWORD } from "./fixtures"

// MK parity spec §5.2: old admin URLs 308 to the new paths (next.config
// redirects(), no DB) and keep the query string.

test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(testInfo.title),
  })
})

async function signIn(page: Page) {
  await page.goto("/admin/sign-in")
  await page.getByLabel("Email").fill(E2E_OWNER.email)
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL((url) => url.pathname === "/admin")
}

for (const [from, to] of [
  ["/admin/audit?actor=x", "/admin/activity?actor=x"],
  ["/admin/marketing/tracking", "/admin/marketing"],
  ["/admin/marketing/custom-code", "/admin/marketing/code"],
  ["/admin/settings/integrations/ai", "/admin/settings/ai-assistant"],
] as const)
  test(`${from} lands on ${to}`, async ({ page }) => {
    await signIn(page)
    await page.goto(from)
    await expect(page).toHaveURL(new RegExp(`${to.replace(/[?.]/g, "\\$&")}$`))
  })

test("old admin URLs answer 308 before sign-in", async ({ request }) => {
  const res = await request.get("/admin/audit?actor=x", { maxRedirects: 0 })
  expect(res.status()).toBe(308)
  expect(res.headers().location).toMatch(/\/admin\/activity\?actor=x$/)
})
