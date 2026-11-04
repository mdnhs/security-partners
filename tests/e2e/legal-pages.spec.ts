import { expect, type Page, test } from "@playwright/test"

import { BASE_URL } from "./env"
import { clientIpFor, E2E_PASSWORD, readFixtures } from "./fixtures"

// Legal pages: an admin creates, publishes, reorders, renames and deletes
// pages like a Cookie Policy; each published one is served at /<slug>, linked
// from the footer after Privacy and Terms, and leaves a real 404 when it is a
// draft or gone. Specs run serially on sp_e2e.

const SAME_ORIGIN = { origin: BASE_URL }

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

type Item = { id: string; slug: string }

/** Removes legal pages left by an earlier run, and the redirects they made. */
async function cleanUp(page: Page, ...slugs: string[]) {
  const res = await page.request.get("/api/v1/admin/legal-pages")
  const { items } = (await res.json()) as { items: Item[] }
  for (const item of items.filter((i) => slugs.includes(i.slug)))
    await page.request.delete(`/api/v1/admin/legal-pages/${item.id}`, {
      headers: SAME_ORIGIN,
    })
}

async function createThroughDialog(page: Page, title: string) {
  await page.goto("/admin/pages")
  await page.getByRole("button", { name: "New legal page" }).click()
  const dialog = page.getByRole("dialog", { name: "New legal page" })
  await dialog.getByRole("textbox", { name: "Title" }).fill(title)
  await dialog.getByRole("button", { name: "Create page" }).click()
  await page.waitForURL(/\/admin\/pages\/legal\/[0-9a-f-]{36}$/)
  await expect(
    page.getByRole("heading", { level: 1, name: title })
  ).toBeVisible()
}

async function publishCurrent(page: Page) {
  await page.getByRole("button", { name: "Publish" }).click()
  await page
    .getByRole("dialog", { name: "Publish changes?" })
    .getByRole("button", { name: "Publish now" })
    .click()
  await expect(page.getByText("Published").first()).toBeVisible()
}

/** The footer's legal bar, in order (Privacy and Terms first). */
async function footerLegal(page: Page, path = "/") {
  await page.goto(path)
  const bar = page.getByRole("contentinfo").locator("p", { hasText: "Privacy" })
  await expect(bar).toBeVisible()
  return (await bar.getByRole("link").allTextContents()).map((t) => t.trim())
}

test.describe.configure({ mode: "serial" })

test("create → publish → live at /<slug>, linked from the footer, 'Last updated' shown", async ({
  page,
  browser,
}) => {
  const { editor } = readFixtures()
  await signIn(page, editor.email)
  await cleanUp(
    page,
    "cookie-policy",
    "acceptable-use",
    "draft-notes",
    "cookies"
  )

  await createThroughDialog(page, "Cookie Policy")
  expect(page.url()).toMatch(/\/admin\/pages\/legal\//)
  await publishCurrent(page)

  const visitor = await browser.newContext()
  const pub = await visitor.newPage()
  const res = await pub.goto("/cookie-policy")
  expect(res?.status()).toBe(200)
  await expect(
    pub.getByRole("heading", { level: 1, name: "Cookie Policy" })
  ).toBeVisible()
  await expect(pub.getByText(/Last updated/)).toBeVisible()
  expect(await footerLegal(pub, "/cookie-policy")).toEqual([
    "Privacy Policy",
    "Terms",
    "Cookie Policy",
  ])
  await visitor.close()
})

test("a draft is a real 404 and stays out of the footer", async ({
  page,
  browser,
}) => {
  const { editor } = readFixtures()
  await signIn(page, editor.email)
  await createThroughDialog(page, "Draft Notes")

  const visitor = await browser.newContext()
  const pub = await visitor.newPage()
  expect((await pub.goto("/draft-notes"))?.status()).toBe(404)
  expect(await footerLegal(pub)).not.toContain("Draft Notes")
  // Unknown root addresses are real 404s too.
  expect((await pub.goto("/no-such-legal-page"))?.status()).toBe(404)
  await visitor.close()
})

test("reserved and malformed addresses are refused in the dialog", async ({
  page,
}) => {
  const { editor } = readFixtures()
  await signIn(page, editor.email)
  await page.goto("/admin/pages")
  await page.getByRole("button", { name: "New legal page" }).click()
  const dialog = page.getByRole("dialog", { name: "New legal page" })
  await dialog.getByRole("textbox", { name: "Title" }).fill("About")
  await expect(dialog.getByRole("textbox", { name: "Address" })).toHaveValue(
    "about"
  )
  await dialog.getByRole("button", { name: "Create page" }).click()
  await expect(dialog.getByText("This address is reserved")).toBeVisible()
  await dialog.getByRole("textbox", { name: "Address" }).fill("Bad Address")
  await dialog.getByRole("button", { name: "Create page" }).click()
  await expect(
    dialog.getByText("Use lower-case words joined by hyphens")
  ).toBeVisible()
})

test("reordering changes the footer order", async ({ page, browser }) => {
  const { editor } = readFixtures()
  await signIn(page, editor.email)
  await createThroughDialog(page, "Acceptable Use")
  await publishCurrent(page)

  const visitor = await browser.newContext()
  const pub = await visitor.newPage()
  expect(await footerLegal(pub)).toEqual([
    "Privacy Policy",
    "Terms",
    "Cookie Policy",
    "Acceptable Use",
  ])

  await page.goto("/admin/pages")
  // The list is Cookie Policy, Draft Notes (a draft, not in the footer),
  // Acceptable Use: two steps move Cookie Policy below Acceptable Use. Each
  // move is saved by a PUT: wait for it before the next click and the reload.
  for (let step = 0; step < 2; step++) {
    const saved = page.waitForResponse(
      (res) =>
        res.url().endsWith("/api/v1/admin/legal-pages/order") &&
        res.request().method() === "PUT"
    )
    await page.getByRole("button", { name: "Move Cookie Policy down" }).click()
    expect((await saved).status()).toBe(200)
  }
  // The new order is shown after a reload.
  await page.reload()
  await expect(
    page.getByRole("list", { name: "Legal pages, in footer order" })
  ).toBeVisible()
  expect(await footerLegal(pub)).toEqual([
    "Privacy Policy",
    "Terms",
    "Acceptable Use",
    "Cookie Policy",
  ])
  await visitor.close()
})

test("a new address moves the live page and leaves a 301 from the old one", async ({
  page,
  browser,
}) => {
  const { editor } = readFixtures()
  await signIn(page, editor.email)
  await page.goto("/admin/pages")
  await page.getByRole("link", { name: "Cookie Policy" }).first().click()
  await page.waitForURL(/\/admin\/pages\/legal\//)

  await page.getByRole("textbox", { name: "Address" }).fill("cookies")
  await page.getByRole("button", { name: "Save title and address" }).click()
  await expect(page.getByText("The page is now at /cookies.")).toBeVisible()

  const visitor = await browser.newContext()
  const pub = await visitor.newPage()
  expect((await pub.goto("/cookies"))?.status()).toBe(200)
  const old = await pub.request.get("/cookie-policy", { maxRedirects: 0 })
  expect(old.status()).toBe(301)
  expect(old.headers().location).toContain("/cookies")
  await visitor.close()
})

test("deleting removes the page, its footer link and its address", async ({
  page,
  browser,
}) => {
  const { editor } = readFixtures()
  await signIn(page, editor.email)
  await page.goto("/admin/pages")
  await page.getByRole("link", { name: "Cookie Policy" }).first().click()
  await page.waitForURL(/\/admin\/pages\/legal\//)
  await page.getByRole("button", { name: "Delete" }).click()
  await page
    .getByRole("alertdialog", { name: "Delete Cookie Policy?" })
    .getByRole("button", { name: "Delete page" })
    .click()
  await page.waitForURL((url) => url.pathname === "/admin/pages")

  const visitor = await browser.newContext()
  const pub = await visitor.newPage()
  expect((await pub.goto("/cookies"))?.status()).toBe(404)
  expect(await footerLegal(pub)).not.toContain("Cookie Policy")
  await visitor.close()
  await cleanUp(page, "acceptable-use", "draft-notes", "cookies")
})
