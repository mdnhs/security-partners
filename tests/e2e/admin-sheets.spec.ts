import { expect, test } from "@playwright/test"

import { clientIpFor, E2E_PASSWORD, readFixtures } from "./fixtures"

// Ledger P04-1 carry: the mobile navigation sheet traps focus and returns
// it to its trigger.

test.use({ viewport: { width: 390, height: 844 } })

test("the mobile navigation sheet keeps focus inside and returns it to its trigger (WCAG 2.4.3)", async ({
  page,
  context,
}, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(testInfo.title),
  })
  const { editor } = readFixtures()
  await page.goto("/admin/sign-in")
  await page.getByLabel("Email").fill(editor.email)
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/admin$/)

  const trigger = page.getByRole("button", { name: "Toggle navigation" })
  await trigger.click()
  const sheet = page.getByRole("dialog")
  await expect(sheet).toBeVisible()
  const focusInside = () =>
    sheet.evaluate((el) => el.contains(document.activeElement))
  // The dialog moves focus in once it has opened (an effect after paint).
  await expect.poll(focusInside).toBe(true)
  // 15 Tabs pass the last control (Close) and wrap; Shift+Tab wraps back.
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab")
    await expect.poll(focusInside).toBe(true)
  }
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Shift+Tab")
    await expect.poll(focusInside).toBe(true)
  }
  await page.keyboard.press("Escape")
  await expect(sheet).toBeHidden()
  await expect(trigger).toBeFocused()
})
