import { expect, type Page, test } from "@playwright/test"

import { BASE_URL } from "../e2e/env"
import { clientIpFor } from "../e2e/fixtures"

import { VISUAL_ADMIN } from "./admin-user"
import { freezeMotion } from "./freeze-motion"

// D5.5 "Copy to new page": About copied into a builder page and published
// must render its <main> pixel-identical to /about (maxDiffPixels 0). Both
// shots are compared with ONE baseline, so any difference fails one of
// them. The hero's breadcrumb trail is the page's own, so it is masked.
test.skip(process.platform !== "darwin", "visual baselines are macOS-only")

const SAME_ORIGIN = { origin: BASE_URL }
const SLUG = "about-copy"

test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(
      `visual ${testInfo.title} ${testInfo.project.name}`
    ),
  })
})

async function signIn(page: Page) {
  await page.goto("/admin/sign-in")
  await page.getByLabel("Email").fill(VISUAL_ADMIN.email)
  await page.getByLabel("Password", { exact: true }).fill(VISUAL_ADMIN.password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL((url) => url.pathname === "/admin")
}

async function removeCopy(page: Page) {
  const res = await page.request.get("/api/v1/admin/builder-pages")
  const { items } = (await res.json()) as {
    items: { id: string; slug: string }[]
  }
  for (const item of items.filter((i) => i.slug === SLUG))
    await page.request.delete(`/api/v1/admin/builder-pages/${item.id}`, {
      headers: SAME_ORIGIN,
    })
}

async function mainShot(page: Page, path: string) {
  const res = await page.goto(path, { waitUntil: "networkidle" })
  expect(res?.status()).toBe(200)
  await freezeMotion(page)
  const main = page.locator("main")
  await expect(main).toHaveScreenshot("about-main.png", {
    maxDiffPixels: 0,
    mask: [main.locator("nav[aria-label]").first()],
  })
}

test("Copy to new page from About → publish → /p/about-copy main matches /about", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000)
  await signIn(page)
  await removeCopy(page)

  await page.goto("/admin/pages/about")
  await page.getByRole("button", { name: "Copy to new page" }).click()
  const dialog = page.getByRole("dialog", { name: "Copy to a new page" })
  await expect(dialog.getByRole("textbox", { name: "Address" })).toHaveValue(
    SLUG
  )
  await dialog.getByRole("button", { name: "Create copy" }).click()
  await page.waitForURL(/\/admin\/pages\/custom\/[0-9a-f-]{36}$/)
  await expect(
    page.getByRole("heading", { level: 1, name: "About copy" })
  ).toBeVisible()
  await page.getByRole("button", { name: "Publish" }).click()
  await page
    .getByRole("dialog", { name: "Publish changes?" })
    .getByRole("button", { name: "Publish now" })
    .click()
  await expect(page.getByText("Published").first()).toBeVisible()

  const visitor = await browser.newContext({ reducedMotion: "reduce" })
  const pub = await visitor.newPage()
  await mainShot(pub, "/about")
  await mainShot(pub, `/p/${SLUG}`)
  await visitor.close()

  await removeCopy(page)
})
