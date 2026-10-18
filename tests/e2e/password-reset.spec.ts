import { expect, test } from "@playwright/test"

import { clientIpFor, readFixtures } from "./fixtures"

// Spec §15 "reset". The E2E server is the production server.js, whose SMTP
// guard refuses the loopback Mailpit, so the email leg (request → mail with
// the link) is covered by tests/integration; here the link the email would
// carry is minted by tests/e2e/seed.ts and the browser does the rest.

test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(testInfo.title),
  })
})

test("forgot password → reset link → new password → sign in (spec §15 reset)", async ({
  page,
}) => {
  const { resetUser } = readFixtures()
  await page.goto("/admin/forgot-password")
  await page.getByLabel("Email").fill(resetUser.email)
  await page.getByRole("button", { name: "Send reset link" }).click()
  await expect(page.getByRole("status")).toContainText(
    `If ${resetUser.email} has an admin account`
  )

  await page.goto(resetUser.resetUrl)
  const password = "a-fresh-password-for-rita"
  await page.getByLabel("New password").fill(password)
  await page.getByLabel("Repeat password").fill(password)
  await page.getByRole("button", { name: "Change password" }).click()
  await expect(page).toHaveURL(/\/admin\/sign-in\?notice=password-reset$/)

  await page.getByLabel("Email").fill(resetUser.email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/admin$/)

  // The link is single use.
  await page.goto(resetUser.resetUrl)
  await page.getByLabel("New password").fill("yet-another-password-1")
  await page.getByLabel("Repeat password").fill("yet-another-password-1")
  await page.getByRole("button", { name: "Change password" }).click()
  await expect(
    page.getByText("This link has expired or was already used.")
  ).toBeVisible()
})
