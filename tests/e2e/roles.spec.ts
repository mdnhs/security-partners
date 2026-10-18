import { expect, type Page, test } from "@playwright/test"

import { dockItems, menuSections } from "@/components/admin/shell/nav"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import { ROLES } from "@/lib/auth/roles"

import { BASE_URL } from "./env"
import { clientIpFor, E2E_PASSWORD } from "./fixtures"

// Spec §1.2 #3 / §15 "sign-in per role": every demo account (seeded by
// tests/e2e/seed.ts with seedDemoUsers) sees exactly the menu, screens and
// API its role grants — derived from the same nav + permission tables.

test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(testInfo.title),
  })
})

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

async function signIn(page: Page, email: string) {
  await page.goto("/admin/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

/** Screens guarded by requirePermission (forbidden page otherwise). */
const SCREENS: { path: string; permission: PermissionRequest }[] = [
  { path: "/admin/pages", permission: { page: ["read"] } },
  { path: "/admin/settings/site", permission: { settings: ["read"] } },
  {
    path: "/admin/settings/integrations/smtp",
    permission: { integration: ["read"] },
  },
  { path: "/admin/leads", permission: { lead: ["read"] } },
  { path: "/admin/users", permission: { user: ["read"] } },
  { path: "/admin/audit", permission: { audit: ["read"] } },
]

for (const role of ROLES) {
  test(`${role} signs in and sees exactly its menu, screens and API (spec §1.2 #3)`, async ({
    page,
  }) => {
    test.setTimeout(60_000)
    await signIn(page, `${role}@demo.local`)

    const menu = menuSections([role]).flatMap((s) =>
      s.items.map((i) => i.label)
    )
    // exact: "Admin" would also match the footer dock ("Administration").
    const nav = page.getByRole("navigation", { name: "Admin", exact: true })
    await expect(nav.getByRole("link")).toHaveCount(menu.length)
    for (const label of menu)
      await expect(
        nav.getByRole("link", { name: new RegExp(`^${escape(label)}`) })
      ).toBeVisible()
    const dock = page.getByRole("navigation", { name: "Administration" })
    const docked = dockItems([role]).map((item) => item.label)
    await expect(dock.getByRole("link")).toHaveCount(docked.length)
    for (const label of docked)
      await expect(
        dock.getByRole("link", { name: label, exact: true })
      ).toBeVisible()

    for (const { path, permission } of SCREENS) {
      await page.goto(path)
      const denied = page.getByRole("heading", {
        name: "You do not have access to this page",
      })
      if (hasPermission([role], permission)) {
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
        await expect(denied).toHaveCount(0)
      } else await expect(denied).toBeVisible()
    }

    const api = await page.request.get("/api/v1/admin/pages")
    expect(api.status()).toBe(
      hasPermission([role], { page: ["read"] }) ? 200 : 403
    )
  })
}

test("author: the API refuses publishing and editing someone else's article (Review Focus 5)", async ({
  page,
}) => {
  await signIn(page, "author@demo.local")
  const list = await page.request.get("/api/v1/admin/articles?pageSize=1")
  expect(list.status()).toBe(200)
  const [first] = (await list.json()).items as { id: string }[]
  expect(first).toBeDefined()
  const detail = await (
    await page.request.get(`/api/v1/admin/articles/${first!.id}`)
  ).json()
  // Same-origin, so a 403 here is the permission check, not CSRF.
  const headers = { origin: BASE_URL, "content-type": "application/json" }
  const publish = await page.request.post(
    `/api/v1/admin/articles/${first!.id}/publish`,
    { headers, data: { version: detail.version } }
  )
  expect(publish.status()).toBe(403)
  expect((await publish.json()).error.message).not.toBe(
    "Cross-origin request rejected"
  )
  const edit = await page.request.put(
    `/api/v1/admin/articles/${first!.id}/draft`,
    { headers, data: { version: detail.version, draft: detail.draft } }
  )
  expect(edit.status()).toBe(403)
})
