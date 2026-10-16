import { type Browser, expect, type Page, test } from "@playwright/test"

import { clientIpFor, E2E_PASSWORD, readFixtures } from "./fixtures"

// Master 4.4: edit the home hero heading → autosave → publish → public /
// shows it; preview shows drafts only with the preview cookie; ⌘S; unsaved
// guard; conflict dialog. Specs run serially on the seeded sp_e2e.

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
  await expect(page.getByRole("heading", { name: /^Welcome, / })).toBeVisible()
}

async function openHomeEditor(page: Page) {
  await page.goto("/admin/pages/home")
  await expect(
    page.getByRole("heading", { level: 1, name: "Home" })
  ).toBeVisible()
  return page.getByRole("region", { name: "Hero" })
}

const saveStatus = (page: Page) =>
  page.getByRole("status", { name: /^Save status/ })

async function publicHeading(browser: Browser) {
  const anonymous = await browser.newContext()
  const page = await anonymous.newPage()
  await page.goto("/")
  const text = await page.locator("[data-hero-title]").textContent()
  await anonymous.close()
  return text?.trim()
}

test("edit hero heading → autosave → preview → publish → public site", async ({
  page,
  browser,
}) => {
  const { editor } = readFixtures()
  await signIn(page, editor.email)
  const hero = await openHomeEditor(page)
  const heading = hero.getByRole("textbox", { name: "Heading" })
  await expect(heading).toHaveValue("Security Partners Ltd.")

  await heading.fill("Watching Over Laois")
  await expect(saveStatus(page)).toHaveText("Unsaved changes")
  // Debounced autosave (1.5 s) without any further input.
  await expect(saveStatus(page)).toHaveText("Saved", { timeout: 10_000 })

  // Drafts are invisible to visitors…
  expect(await publicHeading(browser)).toBe("Security Partners Ltd.")
  // …and visible in preview for this signed-in user.
  const [preview] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("link", { name: "Preview" }).click(),
  ])
  await expect(preview.locator("[data-hero-title]")).toHaveText(
    "Watching Over Laois"
  )
  await expect(preview.getByRole("region", { name: "Preview" })).toBeVisible()
  await preview.getByRole("button", { name: "Exit preview" }).click()
  await expect(preview.locator("[data-hero-title]")).toHaveText(
    "Security Partners Ltd."
  )
  await expect(preview.getByRole("region", { name: "Preview" })).toHaveCount(0)
  await preview.close()

  await page.getByRole("button", { name: "Publish", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Publish changes?" })
  await expect(dialog.getByRole("list", { name: "Changes" })).toContainText(
    "Hero › Heading"
  )
  await dialog.getByRole("button", { name: "Publish now" }).click()
  await expect(dialog).toBeHidden()
  await expect(
    page.getByText("The site shows the new version now.")
  ).toBeVisible()

  expect(await publicHeading(browser)).toBe("Watching Over Laois")
})

test("a stale preview cookie without a session shows only published content", async ({
  page,
  browser,
}) => {
  const { editor } = readFixtures()
  await signIn(page, editor.email)
  const hero = await openHomeEditor(page)
  await hero
    .getByRole("textbox", { name: "Tagline" })
    .fill("Draft-only tagline")
  await expect(saveStatus(page)).toHaveText("Saved", { timeout: 10_000 })
  const [preview] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("link", { name: "Preview" }).click(),
  ])
  await expect(preview.getByText("Draft-only tagline")).toBeVisible()
  // Copy only the draft-mode + preview cookies (no session) to a fresh visitor.
  const previewCookies = (await page.context().cookies()).filter((c) =>
    ["__prerender_bypass", "sp.preview"].includes(c.name)
  )
  expect(previewCookies.map((c) => c.name).sort()).toEqual([
    "__prerender_bypass",
    "sp.preview",
  ])
  const visitor = await browser.newContext()
  await visitor.addCookies(previewCookies)
  const other = await visitor.newPage()
  await other.goto("/")
  await expect(other.locator("[data-hero-title]")).toBeVisible()
  await expect(other.getByText("Draft-only tagline")).toHaveCount(0)
  await visitor.close()
})

test("⌘S saves immediately; leaving with unsaved changes asks first", async ({
  page,
}) => {
  const { editor } = readFixtures()
  await signIn(page, editor.email)
  const hero = await openHomeEditor(page)
  const tagline = hero.getByRole("textbox", { name: "Tagline" })
  await tagline.fill("Saved with the keyboard")
  const put = page.waitForRequest(
    (r) =>
      r.method() === "PUT" &&
      r.url().endsWith("/api/v1/admin/pages/home/draft"),
    { timeout: 1_000 }
  )
  await page.keyboard.press("ControlOrMeta+s")
  await put
  await expect(saveStatus(page)).toHaveText("Saved")

  await hero.getByRole("textbox", { name: "Heading" }).fill("")
  await expect(saveStatus(page)).toHaveText("Fix errors to save")
  let asked = ""
  page.once("dialog", async (dialog) => {
    asked = dialog.message()
    await dialog.dismiss()
  })
  await page
    .getByRole("navigation", { name: "Admin" })
    .getByRole("link", { name: "Services" })
    .click()
  expect(asked).toContain("not saved")
  await expect(page).toHaveURL(/\/admin\/pages\/home$/)
})

test("two editors: the stale one gets the conflict dialog and reloads theirs", async ({
  page,
  browser,
}, testInfo) => {
  const { editor } = readFixtures()
  await signIn(page, editor.email)
  const heroA = await openHomeEditor(page)

  const contextB = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": clientIpFor(`${testInfo.title} B`) },
  })
  const pageB = await contextB.newPage()
  await signIn(pageB, editor.email)
  const heroB = await openHomeEditor(pageB)
  await heroB
    .getByRole("textbox", { name: "Eyebrow" })
    .fill("Changed by editor B")
  await expect(saveStatus(pageB)).toHaveText("Saved", { timeout: 10_000 })
  await contextB.close()

  await heroA
    .getByRole("textbox", { name: "Eyebrow" })
    .fill("Changed by editor A")
  const conflict = page.getByRole("alertdialog", {
    name: "Someone else changed this",
  })
  await expect(conflict).toBeVisible({ timeout: 10_000 })
  await conflict.getByRole("button", { name: "Reload their version" }).click()
  await expect(heroA.getByRole("textbox", { name: "Eyebrow" })).toHaveValue(
    "Changed by editor B"
  )
  await expect(saveStatus(page)).toHaveText("Saved")
})
