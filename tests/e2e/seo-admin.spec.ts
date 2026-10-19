import { expect, type Page, test } from "@playwright/test"

import { E2E_OWNER } from "./admin-accounts"
import { BASE_URL } from "./env"
import { clientIpFor, E2E_PASSWORD } from "./fixtures"

// SEO › Redirects and the SEO sheet (Phase 8, master 8.1–8.2).

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

// Next's proxy adapter sends same-host Locations as relative URLs.
const absolute = (location: string | undefined) =>
  new URL(location ?? "", BASE_URL).href

test("owner adds a redirect in SEO › Redirects; the old address 301s", async ({
  page,
}) => {
  await signIn(page, E2E_OWNER.email)
  await page.goto("/admin/seo/redirects")
  await expect(
    page.getByRole("heading", { level: 1, name: "Redirects" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Add redirect" }).first().click()
  const dialog = page.getByRole("dialog", { name: "Add redirect" })
  await dialog.getByLabel("Old address").fill("/e2e-old-contact")
  await dialog.getByLabel("New address").fill("/contact")
  await dialog.getByRole("button", { name: "Add redirect" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole("table", { name: "Redirects" })).toContainText(
    "/e2e-old-contact"
  )

  const res = await page.request.get("/e2e-old-contact", { maxRedirects: 0 })
  expect(res.status()).toBe(301)
  expect(absolute(res.headers().location)).toBe(`${BASE_URL}/contact`)

  await page
    .getByRole("button", { name: "Delete redirect from /e2e-old-contact" })
    .click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click()
  // The seed has no other redirect, so the table gives way to the empty
  // state: check the row's action is gone rather than the table's text.
  await expect(
    page.getByRole("button", { name: "Delete redirect from /e2e-old-contact" })
  ).toHaveCount(0)
})

test("a redirect turned off stops answering; on again, it 308s (D1.7)", async ({
  page,
}) => {
  await signIn(page, E2E_OWNER.email)
  const created = await page.request.post("/api/v1/admin/redirects", {
    headers: { origin: BASE_URL },
    data: {
      fromPath: "/e2e-toggle",
      toPath: "/contact",
      code: 308,
      note: "e2e toggle",
    },
  })
  expect(created.status()).toBe(201)
  const { id } = (await created.json()) as { id: string }
  try {
    await page.goto("/admin/seo/redirects?q=e2e-toggle")
    const table = page.getByRole("table", { name: "Redirects" })
    await expect(table).toContainText("e2e toggle")
    await expect(table).toContainText("Never")
    await page
      .getByRole("button", { name: "Turn off redirect from /e2e-toggle" })
      .click()
    await expect(
      page.getByRole("button", { name: "Turn on redirect from /e2e-toggle" })
    ).toBeVisible()
    const off = await page.request.get("/e2e-toggle", { maxRedirects: 0 })
    expect(off.status()).toBe(404)

    await page
      .getByRole("button", { name: "Turn on redirect from /e2e-toggle" })
      .click()
    await expect(
      page.getByRole("button", { name: "Turn off redirect from /e2e-toggle" })
    ).toBeVisible()
    const on = await page.request.get("/e2e-toggle", { maxRedirects: 0 })
    expect(on.status()).toBe(308)
    expect(absolute(on.headers().location)).toBe(`${BASE_URL}/contact`)
  } finally {
    await page.request.delete(`/api/v1/admin/redirects/${id}`, {
      headers: { origin: BASE_URL },
    })
  }
})

test("SEO overview: the sheet saves a page's description", async ({ page }) => {
  await signIn(page, E2E_OWNER.email)
  // All: Terms may pass every check (Needs work would hide it).
  await page.goto("/admin/seo?show=all")
  await page.getByRole("button", { name: "Edit SEO for Terms of use" }).click()
  const sheet = page.getByRole("dialog", { name: "SEO: Terms of use" })
  const description = sheet.getByRole("textbox", { name: /^Description/ })
  const before = await description.inputValue()
  try {
    await description.fill(
      "The terms that apply when you use the Security Partners website."
    )
    await sheet.getByRole("button", { name: "Save SEO" }).click()
    await expect(sheet).toBeHidden()
    const head = await (await page.request.get("/terms")).text()
    expect(head).toContain(
      'content="The terms that apply when you use the Security Partners website."'
    )
  } finally {
    // A failed save leaves the sheet open with unsaved edits: close it
    // (Esc, then confirm the discard) so the restore can reopen it.
    if (await sheet.isVisible()) {
      await page.keyboard.press("Escape")
      const discard = page
        .getByRole("alertdialog", { name: "Discard your SEO changes?" })
        .getByRole("button", { name: "Discard changes" })
      await discard
        .waitFor({ timeout: 2_000 })
        .then(() => discard.click())
        .catch(() => {})
      await expect(sheet).toBeHidden()
    }
    // restore
    await page
      .getByRole("button", { name: "Edit SEO for Terms of use" })
      .click()
    const again = page.getByRole("dialog", { name: "SEO: Terms of use" })
    await again.getByRole("textbox", { name: /^Description/ }).fill(before)
    await again.getByRole("button", { name: "Save SEO" }).click()
    await expect(again).toBeHidden()
  }
})

test("SEO overview: alt-text card, Needs work / All, Fix opens the editor's SEO tab", async ({
  page,
}) => {
  await signIn(page, E2E_OWNER.email)
  await page.goto("/admin/seo")
  const alt = page.getByRole("region", { name: "Alt text" })
  await expect(alt).toContainText(
    /\d+ of \d+ images described · \d+ decorative/
  )
  await expect(
    alt.getByRole("link", { name: "Find images without alt text" })
  ).toHaveAttribute("href", "/admin/media?missingAlt=true")

  const filter = page.getByRole("navigation", { name: "Show" })
  await expect(
    filter.getByRole("link", { name: "Needs work" })
  ).toHaveAttribute("aria-current", "page")
  // Needs work never says "All checks pass"; All lists the passing records.
  await expect(page.getByText("All checks pass")).toHaveCount(0)
  await filter.getByRole("link", { name: "All" }).click()
  await page.waitForURL((url) => url.searchParams.get("show") === "all")
  await expect(filter.getByRole("link", { name: "All" })).toHaveAttribute(
    "aria-current",
    "page"
  )
  await filter.getByRole("link", { name: "Needs work" }).click()
  await page.waitForURL((url) => !url.searchParams.has("show"))

  // The seed has issues (services' images lack alt text, D1.2 report):
  // the first record Fix lands on that editor's SEO tab.
  const fix = page
    .getByRole("link", { name: /^Fix / })
    .and(page.locator('[href*="?tab=seo"]'))
    .first()
  const href = await fix.getAttribute("href")
  expect(href).toMatch(/^\/admin\/(pages|services|insights)\/.+\?tab=seo$/)
  await fix.click()
  await page.waitForURL((url) => url.searchParams.get("tab") === "seo")
  await expect(page.getByRole("tab", { name: "SEO" })).toHaveAttribute(
    "aria-selected",
    "true"
  )
})
