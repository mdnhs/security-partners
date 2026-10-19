import { expect, test } from "@playwright/test"

import { E2E_OWNER } from "./admin-accounts"
import { clientIpFor, E2E_PASSWORD } from "./fixtures"

// MK parity B2: pre-MK admin URLs redirect (308, next.config redirects()) to
// their new paths with dynamic segments and the query string intact.

test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(testInfo.title),
  })
})

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

for (const [from, to] of [
  ["/admin/articles?status=draft", "/admin/insights?status=draft"],
  ["/admin/articles/new", "/admin/insights/new"],
  ["/admin/categories", "/admin/insights/categories"],
  ["/admin/team", "/admin/collections/team"],
  ["/admin/clients", "/admin/collections/clients"],
  ["/admin/group-companies", "/admin/collections/group-companies"],
  ["/admin/collections", "/admin/collections/team"],
] as const) {
  test(`${from} lands on ${to}`, async ({ page }) => {
    await page.goto("/admin/sign-in")
    await page.getByLabel("Email").fill(E2E_OWNER.email)
    await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/admin$/)
    await page.goto(from)
    await expect(page).toHaveURL(new RegExp(`${escape(to)}$`))
  })
}

test("legacy redirect is permanent and keeps id and query", async ({
  request,
}) => {
  // Runs before proxy.ts and needs no session.
  const res = await request.get("/admin/articles/abc?tab=seo", {
    maxRedirects: 0,
  })
  expect(res.status()).toBe(308)
  expect(res.headers().location).toMatch(/\/admin\/insights\/abc\?tab=seo$/)
})
