import { expect, type Page, test } from "@playwright/test"

import { clientIpFor } from "../e2e/fixtures"

import { VISUAL_ADMIN } from "./admin-user"

// Admin shell baselines (spec §15: "Admin shell baselines added in Phase 4").
// The page content (<main>) is masked: only the frame is pinned here, so
// later dashboard/data changes do not move these screenshots.

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
  await expect(page.getByTestId("greeting")).toBeVisible()
  // The sidebar's lead count is server-rendered from the database: the
  // visual seed has no enquiries, so it stays hidden. A lead left by another
  // spec (e.g. the public contact form e2e) would show it — fail loudly.
  await expect(page.getByLabel(/ new leads$/)).toHaveCount(0)
  await page.evaluate(() => document.fonts.ready)
}

test("admin shell frame", async ({ page }) => {
  await signIn(page)
  await expect(page).toHaveScreenshot("admin-shell.png", {
    mask: [page.getByRole("main")],
  })
})

test("admin sidebar collapsed to icons", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "the icon rail exists from 1024 px up"
  )
  await signIn(page)
  await page.getByRole("button", { name: "Toggle navigation" }).click()
  await expect(page.locator('[data-slot="sidebar"]')).toHaveAttribute(
    "data-state",
    "collapsed"
  )
  // The search pill slides under the pointer: no hover ring in the baseline.
  await page.mouse.move(0, 0)
  await expect(page).toHaveScreenshot("admin-shell-collapsed.png", {
    mask: [page.getByRole("main")],
  })
})

test("admin navigation sheet (below 1024 px)", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile",
    "the sheet exists below lg only"
  )
  await signIn(page)
  await page.getByRole("button", { name: "Toggle navigation" }).click()
  await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible()
  // The modal sheet hides <main> from the accessibility tree (getByRole would
  // mask nothing) and a mask is painted above the sheet, so the page content
  // is hidden with CSS instead: only the sheet and the dimmed frame remain.
  await page.addStyleTag({ content: "main#main { visibility: hidden }" })
  await expect(page).toHaveScreenshot("admin-shell-nav.png")
})
