import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test"

import { E2E_OWNER } from "./admin-accounts"
import { BASE_URL } from "./env"
import { clientIpFor, E2E_PASSWORD } from "./fixtures"

// MK-parity C5: the Appearance screen. Publishing an admin preset recolours
// the admin for everyone (a <style id="theme-tokens">); resetting to the SP
// preset and publishing again emits nothing. A site draft is seen only in
// preview. Every test leaves the seeded default theme live and no draft.

test.describe.configure({ mode: "serial" })

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
  await expect(page).toHaveURL(/\/admin$/)
}

type ThemeDto = { version: number; hasDraft: boolean }

/** Back to the seeded default: reset both scopes, publish if anything is live. */
async function restoreDefault(request: APIRequestContext) {
  const headers = { origin: BASE_URL }
  const current = (await (
    await request.get("/api/v1/admin/appearance")
  ).json()) as ThemeDto
  const reset = await request.post("/api/v1/admin/appearance/reset", {
    headers,
    data: {
      version: current.version,
      preset: "security-partners",
      scope: "both",
    },
  })
  expect(reset.status()).toBe(200)
  const after = (await reset.json()) as ThemeDto
  if (after.hasDraft) {
    const published = await request.post("/api/v1/admin/appearance/publish", {
      headers,
      data: { version: after.version },
    })
    expect(published.status()).toBe(200)
  }
}

test("owner publishes an admin preset; admin recolours; reset restores", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await signIn(page, E2E_OWNER.email)
  try {
    await page.goto("/admin/appearance")
    await page.getByRole("tab", { name: "Admin" }).click()
    await page.getByRole("button", { name: /Evergreen/ }).click()
    // Live: the draft recolours this page only.
    await expect(page.locator("html")).toHaveAttribute("style", /--primary:/)
    await expect(page.getByRole("status", { name: "Save status" })).toHaveText(
      "Draft saved"
    )
    await page.getByRole("button", { name: "Publish" }).click()
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Publish" })
      .click()
    await expect(page.getByText("Theme published")).toBeVisible()

    await page.goto("/admin")
    await expect(page.locator("style#theme-tokens")).toHaveCount(1)
    // Off the Appearance page nothing is set inline.
    await expect(page.locator("html")).not.toHaveAttribute(
      "style",
      /--primary:/
    )

    await page.goto("/admin/appearance")
    await page.getByRole("button", { name: "Reset to preset…" }).click()
    const dialog = page.getByRole("dialog", { name: "Reset to preset" })
    await expect(dialog.getByRole("combobox", { name: "Preset" })).toHaveText(
      /Security Partners/
    )
    await dialog.getByRole("radio", { name: "Admin" }).check()
    await dialog.getByRole("button", { name: "Reset draft" }).click()
    await expect(dialog).toBeHidden()
    await page.getByRole("button", { name: "Publish" }).click()
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Publish" })
      .click()
    await expect(page.getByText("Theme published")).toBeVisible()

    await page.goto("/admin")
    await expect(page.locator("style#theme-tokens")).toHaveCount(0)
  } finally {
    await restoreDefault(page.request)
  }
})

test("marketer sees Appearance read-only", async ({ page }) => {
  await signIn(page, "marketer@demo.local")
  await page.goto("/admin/appearance")
  await expect(
    page.getByRole("heading", { level: 1, name: "Appearance" })
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Discard draft" })).toHaveCount(
    0
  )
  await expect(
    page.getByRole("button", { name: "Reset to preset…" })
  ).toHaveCount(0)
  await expect(page.getByRole("button", { name: /Evergreen/ })).toBeDisabled()
  await expect(page.getByRole("textbox", { name: "Brand" })).toBeDisabled()
  // The API refuses a write as well.
  const res = await page.request.put("/api/v1/admin/appearance/draft", {
    headers: { origin: BASE_URL },
    data: { version: 1, draft: {} },
  })
  expect(res.status()).toBe(403)
})

test("site draft preview shows the draft; public stays default", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000)
  await signIn(page, E2E_OWNER.email)
  try {
    const current = (await (
      await page.request.get("/api/v1/admin/appearance")
    ).json()) as ThemeDto & { draft: { site: object; admin: object } }
    const saved = await page.request.put("/api/v1/admin/appearance/draft", {
      headers: { origin: BASE_URL },
      data: {
        version: current.version,
        draft: {
          ...current.draft,
          site: { preset: "security-partners", brand: "#49925e", tokens: {} },
        },
      },
    })
    expect(saved.status()).toBe(200)

    // "Preview on site" opens the theme's preview link in a new tab.
    await page.goto("/admin/appearance")
    const [tab] = await Promise.all([
      page.context().waitForEvent("page"),
      page.getByRole("button", { name: "Preview on site" }).click(),
    ])
    await tab.waitForURL(`${BASE_URL}/`)
    await expect(tab.locator("style#site-theme")).toHaveCount(1)
    // Playwright's text matchers skip <style> content: read it directly.
    await expect
      .poll(() =>
        tab.locator("style#site-theme").evaluate((el) => el.textContent)
      )
      .toContain("--color-brand-green:")

    // A visitor (no session, no preview) sees the default: nothing emitted.
    const visitor = await browser.newContext()
    try {
      const anon = await visitor.newPage()
      await anon.goto("/")
      await expect(anon.locator("style#site-theme")).toHaveCount(0)
    } finally {
      await visitor.close()
    }
  } finally {
    await page.request.get("/api/v1/preview/exit")
    await restoreDefault(page.request)
  }
})
