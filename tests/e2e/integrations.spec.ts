import { networkInterfaces } from "node:os"

import { expect, type Page, test } from "@playwright/test"

import { E2E_OWNER } from "./admin-accounts"
import {
  clientIpFor,
  E2E_PASSWORD,
  E2E_SMTP_PASSWORD,
  greeting,
  readFixtures,
} from "./fixtures"

// Master 7.1: SMTP credentials saved through Settings ▸ Integrations come
// back masked, a changed server asks for the password again, "Test
// connection" shows the server's fixed result, and Disconnect clears them
// (so later specs still run without SMTP).
//
// The E2E server runs in production mode, where loopback is refused as an
// SMTP host (SSRF guard). The main flow saves 192.0.2.1 (TEST-NET-1, RFC
// 5737: allowed by the guard, never answers), so it is the same on every
// machine, online or not. A separate round trip to the dev Mailpit runs
// only where this machine has an RFC 1918 address.

const PASSWORD = E2E_SMTP_PASSWORD
const TEST_NET = "192.0.2.1"

/** This machine's first RFC 1918 IPv4 address (Mailpit listens on all). */
function privateAddress(): string | undefined {
  for (const list of Object.values(networkInterfaces()))
    for (const entry of list ?? []) {
      if (entry.family !== "IPv4" || entry.internal) continue
      const [a, b] = entry.address.split(".").map(Number)
      if (
        a === 10 ||
        (a === 172 && b! >= 16 && b! <= 31) ||
        (a === 192 && b === 168)
      )
        return entry.address
    }
  return undefined
}

test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(testInfo.title),
  })
})

async function signIn(page: Page, who: { email: string; name: string }) {
  await page.goto("/admin/sign-in")
  await page.getByLabel("Email").fill(who.email)
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(
    page.getByRole("heading", { name: greeting(who.name) })
  ).toBeVisible()
}

async function openSmtp(page: Page) {
  await page.goto("/admin/settings")
  await page
    .getByRole("navigation", { name: "Site settings" })
    .getByRole("link", { name: "Integrations" })
    .click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Integrations" })
  ).toBeVisible()
  await page.getByRole("link", { name: /Email \(SMTP\)/ }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Email (SMTP)" })
  ).toBeVisible()
}

/** The visible status pill (the overview stays mounted, hidden, after a client navigation). */
const pill = (page: Page, text: string) =>
  page.getByText(text, { exact: true }).filter({ visible: true })

async function fillSmtp(page: Page, host: string, user: string) {
  await page.getByLabel("SMTP server").fill(host)
  await page.getByLabel("Port").fill("1025")
  await page.getByLabel(/^User name/).fill(user)
  await page.getByLabel("Password").fill(PASSWORD)
  await page.getByLabel("Sender name").fill("Security Partners")
  await page.getByLabel("Sender address").fill("no-reply@e2e.test")
}

async function disconnect(page: Page) {
  await page.getByRole("button", { name: "Disconnect" }).click()
  await page
    .getByRole("alertdialog", { name: "Disconnect Email (SMTP)?" })
    .getByRole("button", { name: "Disconnect" })
    .click()
  await expect(pill(page, "Not set up")).toBeVisible()
  // Disconnect is gone; focus moves to the status, not the page.
  await expect(page.locator('[data-slot="integration-status"]')).toBeFocused()
}

test("save SMTP credentials (masked), retarget, test and disconnect", async ({
  page,
}) => {
  test.setTimeout(60_000)
  await signIn(page, E2E_OWNER)
  await openSmtp(page)
  await expect(pill(page, "Not set up")).toBeVisible()

  // Loopback is refused in production (SSRF guard), under the field.
  await fillSmtp(page, "127.0.0.1", "mailer@e2e.test")
  await page.getByRole("button", { name: "Save" }).click()
  await expect(
    page.getByText("This address is not allowed for an email server")
  ).toBeVisible()
  await expect(page.getByLabel("SMTP server")).toBeFocused()

  const save = page.getByRole("button", { name: "Save" })
  await page.getByLabel("SMTP server").fill(TEST_NET)
  await save.click()
  await expect(page.getByText("Saved · ends in 1234")).toBeVisible()
  await expect(pill(page, "Connected")).toBeVisible()
  await expect(page.getByLabel("Password")).toHaveValue("")
  // Save keeps focus once it is unavailable again (WCAG 2.4.3).
  await expect(save).toHaveAttribute("aria-disabled", "true")
  await expect(save).toBeFocused()
  const api = await page.request.get(
    "/api/v1/admin/integrations/integrations.smtp"
  )
  const body = await api.text()
  expect(body).not.toContain(PASSWORD)
  expect(JSON.parse(body).secrets.password).toEqual({
    set: true,
    hint: "••••1234",
  })

  // A new port with the password left empty: asked for again, focused.
  await page.getByLabel("Port").fill("2525")
  await save.click()
  await expect(
    page.getByText("Enter the password again for the new server")
  ).toBeVisible()
  await expect(page.getByLabel("Password")).toBeFocused()
  await page.getByLabel("Port").fill("1025")
  await expect(save).toHaveAttribute("aria-disabled", "true")

  // TEST-NET-1 never answers: a timeout, or a refusal where the network
  // is down. Either way only the server's fixed text is shown.
  const testButton = page.getByRole("button", { name: "Test connection" })
  await testButton.click()
  await expect(
    page.getByRole("status", { name: "Connection test" })
  ).toHaveText(
    /^Test failed — (The server did not respond in time|Could not connect to the server) \(192\.0\.2\.1:1025\)\.$/,
    { timeout: 20_000 }
  )
  await expect(testButton).toBeFocused()

  await disconnect(page)
  await expect(page.getByText("Not saved yet", { exact: true })).toBeVisible()
})

test("Test connection reaches the dev Mailpit", async ({ page }) => {
  const host = privateAddress()
  test.skip(!host, "needs an RFC 1918 IPv4 address to reach Mailpit")
  test.setTimeout(60_000)
  await signIn(page, E2E_OWNER)
  await openSmtp(page)
  await fillSmtp(page, host!, `mailer-${Date.now()}@e2e.test`)
  await page.getByRole("button", { name: "Save" }).click()
  await expect(page.getByText("Saved · ends in 1234")).toBeVisible()
  // Off loopback the server requires STARTTLS (Task 1 guard), which
  // Mailpit does not offer, so the fixed "Secure connection failed" result
  // proves the round trip. The passing path ("Connected to … and signed in
  // as …") is covered on loopback by tests/integration/api/integrations.test.ts.
  await page.getByRole("button", { name: "Test connection" }).click()
  await expect(
    page.getByRole("status", { name: "Connection test" })
  ).toHaveText(`Test failed — Secure connection failed (${host}:1025).`, {
    timeout: 20_000,
  })
  await disconnect(page)
})

test("integrations are for owners and admins only", async ({ page }) => {
  await signIn(page, readFixtures().editor)
  await page.goto("/admin/settings/site")
  await expect(
    page
      .getByRole("navigation", { name: "Site settings" })
      .getByRole("link", { name: "Identity" })
  ).toBeVisible()
  await expect(
    page
      .getByRole("navigation", { name: "Site settings" })
      .getByRole("link", { name: "Integrations" })
  ).toHaveCount(0)
  await page.goto("/admin/settings/integrations/smtp")
  await expect(
    page.getByRole("heading", { name: "You do not have access to this page" })
  ).toBeVisible()
  const api = await page.request.get("/api/v1/admin/integrations")
  expect(api.status()).toBe(403)
})
