import { expect, type Page, test } from "@playwright/test"
import { Secret, TOTP } from "otpauth"

import { clientIpFor, E2E_PASSWORD, readFixtures } from "./fixtures"

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
}

test("account page: turn on 2FA, then sign in with a backup code (Task 2.6)", async ({
  page,
}) => {
  const { account } = readFixtures()
  await signIn(page, account.email)
  await expect(
    page.getByRole("heading", { name: `Welcome, ${account.name}` })
  ).toBeVisible()
  await page.getByRole("link", { name: "Account" }).click()
  await expect(
    page.getByRole("heading", { name: "Account", exact: true })
  ).toBeVisible()
  const sections = page.getByRole("tablist", { name: "Account sections" })
  await expect(sections.getByRole("tab", { name: "Profile" })).toHaveAttribute(
    "aria-selected",
    "true"
  )
  await sections.getByRole("tab", { name: "Sessions" }).click()
  await expect(page).toHaveURL(/\?tab=sessions$/)
  await expect(page.getByText("This device")).toBeVisible()

  await sections.getByRole("tab", { name: "Two-factor" }).click()
  await page.getByLabel("Your password").fill(E2E_PASSWORD)
  await page
    .getByRole("button", { name: "Set up two-factor authentication" })
    .click()
  const secret = (await page.getByTestId("totp-secret").textContent()) ?? ""
  const backupCodes = await page
    .getByRole("list", { name: "Backup codes" })
    .getByRole("listitem")
    .allTextContents()
  expect(backupCodes).toHaveLength(10)
  const totp = new TOTP({ secret: Secret.fromBase32(secret) })
  await page.getByLabel("Code from the app").fill(totp.generate())
  await page.getByRole("button", { name: "Turn on" }).click()
  await expect(
    page.getByText("Two-factor authentication turned on.")
  ).toBeVisible()
  await expect(page.getByText("Two-factor authentication is on")).toBeVisible()

  await page
    .getByRole("button", { name: `Account menu for ${account.name}` })
    .click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/admin\/sign-in\?notice=signed-out$/)
  await signIn(page, account.email)
  await expect(page).toHaveURL(/\/admin\/two-factor/)
  await page.getByRole("button", { name: "Use a backup code instead" }).click()
  await page.getByLabel("Backup code").fill(backupCodes[0])
  await page.getByRole("button", { name: "Verify" }).click()
  await expect(
    page.getByRole("heading", { name: `Welcome, ${account.name}` })
  ).toBeVisible()
})
