import { expect, type Page, test } from "@playwright/test"

import { BASE_URL } from "./env"
import { clientIpFor, E2E_PASSWORD, readFixtures } from "./fixtures"

// Page builder (D5.5): create → add a block → autosave → publish → /p/;
// a stale second editor gets the conflict dialog; a slug change leaves a
// 301; marketers read only; ⌘K New page; focus after delete; 320 px reflow
// and 44 px targets on a coarse pointer. Specs run serially on sp_e2e.

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

type Dto = {
  id: string
  slug: string
  version: number
  draft: { blocks: { id: string; type: string }[] }
}

/** Removes builder pages left by an earlier run at these addresses. */
async function removeBySlug(page: Page, ...slugs: string[]) {
  const res = await page.request.get("/api/v1/admin/builder-pages")
  const { items } = (await res.json()) as { items: Dto[] }
  for (const item of items.filter((i) => slugs.includes(i.slug)))
    await page.request.delete(`/api/v1/admin/builder-pages/${item.id}`, {
      headers: SAME_ORIGIN,
    })
}

const saveStatus = (page: Page) =>
  page.getByRole("status", { name: /^Save status/ })

const outline = (page: Page) =>
  page.getByRole("navigation", { name: "Page outline" })

async function createThroughDialog(page: Page, title: string) {
  await page.goto("/admin/pages")
  await page.getByRole("button", { name: "New page" }).click()
  const dialog = page.getByRole("dialog", { name: "New page" })
  await dialog.getByRole("textbox", { name: "Title" }).fill(title)
  await dialog.getByRole("button", { name: "Create page" }).click()
  await page.waitForURL(/\/admin\/pages\/custom\/[0-9a-f-]{36}$/)
  await expect(
    page.getByRole("heading", { level: 1, name: title })
  ).toBeVisible()
  return page.url().split("/").pop()!
}

/** Deletes the starting page hero (it needs an image to publish). */
async function deleteHero(page: Page) {
  await outline(page).getByRole("button", { name: "Delete Page hero" }).click()
  await page
    .getByRole("alertdialog", { name: "Delete Page hero?" })
    .getByRole("button", { name: "Delete block" })
    .click()
}

async function addStats(page: Page, figure: string, label: string) {
  await page.getByRole("button", { name: "Add block" }).click()
  await page
    .getByRole("dialog", { name: "Add a block" })
    .getByRole("button", { name: "Stats" })
    .click()
  const settings = page.getByRole("region", { name: "Block settings" })
  await settings.getByRole("textbox", { name: "Figure" }).fill(figure)
  await settings.getByRole("textbox", { name: "Label" }).fill(label)
  await settings
    .getByRole("textbox", { name: "Description" })
    .fill("Round the clock")
}

test("editor creates Spring campaign, adds Stats, autosaves, publishes and sees it at /p/spring-campaign", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000)
  const { editor } = readFixtures()
  await signIn(page, editor.email)
  await removeBySlug(page, "spring-campaign", "spring-offers")
  await createThroughDialog(page, "Spring campaign")
  await expect(page.getByText("/p/spring-campaign")).toBeVisible()

  await deleteHero(page)
  // Focus does not fall to <body> after a delete (review D5.4 I1).
  await expect(
    page.getByText("No blocks yet. Add one to start the page.")
  ).toBeFocused()
  await addStats(page, "24/7", "Response")
  await expect(saveStatus(page)).toHaveText("Saved", { timeout: 10_000 })

  await page.getByRole("button", { name: "Publish" }).click()
  await page
    .getByRole("dialog", { name: "Publish changes?" })
    .getByRole("button", { name: "Publish now" })
    .click()
  await expect(page.getByText("Published").first()).toBeVisible()

  const visitor = await browser.newContext()
  const pub = await visitor.newPage()
  const res = await pub.goto("/p/spring-campaign")
  expect(res?.status()).toBe(200)
  await expect(pub.getByText("24/7")).toBeVisible()
  await expect(pub.getByText("Response")).toBeVisible()
  await visitor.close()
})

test("focus after delete lands on the neighbouring block", async ({ page }) => {
  const { editor } = readFixtures()
  await signIn(page, editor.email)
  await removeBySlug(page, "focus-check")
  const created = await page.request.post("/api/v1/admin/builder-pages", {
    headers: SAME_ORIGIN,
    data: { title: "Focus check", slug: "focus-check" },
  })
  const dto = (await created.json()) as Dto
  await page.goto(`/admin/pages/custom/${dto.id}`)
  await addStats(page, "1", "One")
  await addStats(page, "2", "Two")
  await outline(page)
    .getByRole("button", { name: "Delete Stats (#stats)" })
    .click()
  await page
    .getByRole("alertdialog", { name: "Delete Stats (#stats)?" })
    .getByRole("button", { name: "Delete block" })
    .click()
  await expect(
    outline(page).getByRole("button", { name: "Stats, #stats-2" })
  ).toBeFocused()
  await removeBySlug(page, "focus-check")
})

test("a second editor saving a stale version gets the conflict dialog → Reload their version", async ({
  page,
  browser,
}, testInfo) => {
  const { editor } = readFixtures()
  await signIn(page, editor.email)
  await removeBySlug(page, "conflict-check")
  const created = await page.request.post("/api/v1/admin/builder-pages", {
    headers: SAME_ORIGIN,
    data: { title: "Conflict check", slug: "conflict-check" },
  })
  const dto = (await created.json()) as Dto
  await page.goto(`/admin/pages/custom/${dto.id}`)
  await expect(
    page.getByRole("heading", { level: 1, name: "Conflict check" })
  ).toBeVisible()

  // Editor B saves first (same version A loaded).
  const contextB = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": clientIpFor(`${testInfo.title} B`) },
  })
  const pageB = await contextB.newPage()
  await signIn(pageB, editor.email)
  const theirs = {
    blocks: dto.draft.blocks.map((b) => ({
      ...b,
      data: { crumb: "Theirs", title: "Their title", description: "" },
    })),
  }
  const saved = await pageB.request.put(
    `/api/v1/admin/builder-pages/${dto.id}/draft`,
    { headers: SAME_ORIGIN, data: { version: dto.version, draft: theirs } }
  )
  expect(saved.status()).toBe(200)
  await contextB.close()

  await page
    .getByRole("region", { name: "Block settings" })
    .getByRole("textbox", { name: "Title" })
    .fill("Mine")
  const dialog = page.getByRole("alertdialog", {
    name: "Someone else changed this",
  })
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  await dialog.getByRole("button", { name: "Reload their version" }).click()
  await expect(
    page
      .getByRole("region", { name: "Block settings" })
      .getByRole("textbox", { name: "Title" })
  ).toHaveValue("Their title")
  await removeBySlug(page, "conflict-check")
})

test("changing the address of a published page leaves a 301 from the old one", async ({
  page,
  request,
}) => {
  const { editor } = readFixtures()
  await signIn(page, editor.email)
  const list = await page.request.get("/api/v1/admin/builder-pages")
  const { items } = (await list.json()) as { items: Dto[] }
  const spring = items.find((i) => i.slug === "spring-campaign")
  expect(spring, "created by the first test").toBeDefined()
  await page.goto(`/admin/pages/custom/${spring!.id}?tab=seo`)
  const address = page.getByRole("textbox", { name: "Address" })
  await address.fill("spring-offers")
  await page.getByRole("button", { name: "Save title and address" }).click()
  await expect(page.getByText("/p/spring-offers").first()).toBeVisible()

  const res = await request.get("/p/spring-campaign", { maxRedirects: 0 })
  expect(res.status()).toBe(301)
  expect(new URL(res.headers().location, BASE_URL).pathname).toBe(
    "/p/spring-offers"
  )
  await removeBySlug(page, "spring-offers")
})

test("a marketer sees the pages list read-only, without New page", async ({
  page,
}) => {
  await signIn(page, "marketer@demo.local")
  await page.goto("/admin/pages")
  await expect(
    page.getByRole("heading", { name: "Custom pages" })
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "New page" })).toHaveCount(0)
})

test("⌘K New page opens the new page dialog", async ({ page }) => {
  const { editor } = readFixtures()
  await signIn(page, editor.email)
  await page.keyboard.press("ControlOrMeta+k")
  const palette = page.getByRole("dialog", { name: "Search the admin" })
  await palette.getByRole("option", { name: "New page" }).click()
  await expect(page.getByRole("dialog", { name: "New page" })).toBeVisible()
})

test("builder at 320 px on a touch screen: no horizontal scroll, 44 px targets", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 800 },
    hasTouch: true,
    isMobile: true,
    extraHTTPHeaders: { "x-forwarded-for": clientIpFor(testInfo.title) },
  })
  const page = await context.newPage()
  const { editor } = readFixtures()
  await signIn(page, editor.email)
  await removeBySlug(page, "reflow-check")
  const created = await page.request.post("/api/v1/admin/builder-pages", {
    headers: SAME_ORIGIN,
    data: { title: "Reflow check", slug: "reflow-check" },
  })
  const dto = (await created.json()) as Dto
  await page.goto(`/admin/pages/custom/${dto.id}`)
  await addStats(page, "1", "One")
  const scroll = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(scroll.width).toBeLessThanOrEqual(scroll.viewport)
  for (const button of await outline(page).getByRole("button").all()) {
    const box = await button.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  }
  await removeBySlug(page, "reflow-check")
  await context.close()
})
