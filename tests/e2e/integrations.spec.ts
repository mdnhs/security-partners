import { networkInterfaces } from "node:os"

import { expect, type Page, test } from "@playwright/test"

import { E2E_OWNER } from "./admin-accounts"
import { clientIpFor, E2E_PASSWORD, greeting, readFixtures } from "./fixtures"

// Master 7.1: SMTP credentials saved through Settings ▸ Integrations come
// back masked, a changed server asks for the password again, and "Test
// connection" reaches the dev Mailpit (docker-compose.dev.yml, port 1025)
// and shows the server's fixed result.
// The E2E server runs in production mode, where loopback is refused as an
// SMTP host (SSRF guard), so Mailpit is reached through this machine's
// first private IPv4 address. Disconnects at the end so later specs still
// run without SMTP.

const PASSWORD = "smtp-secret-1234"

/** This machine's first non-internal IPv4 address (Mailpit listens on all). */
function lanAddress(): string | undefined {
  for (const list of Object.values(networkInterfaces()))
    for (const entry of list ?? [])
      if (entry.family === "IPv4" && !entry.internal) return entry.address
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

test("save SMTP credentials (masked) and test them against Mailpit", async ({
  page,
}) => {
  const host = lanAddress()
  test.skip(!host, "needs a non-loopback IPv4 address to reach Mailpit")
  const user = `mailer-${Date.now()}@e2e.test`
  await signIn(page, E2E_OWNER)
  await page.goto("/admin/settings")
  await page
    .getByRole("navigation", { name: "Settings" })
    .getByRole("link", { name: "Integrations" })
    .click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Integrations" })
  ).toBeVisible()
  await page.getByRole("link", { name: /Email \(SMTP\)/ }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Email (SMTP)" })
  ).toBeVisible()
  // The overview stays mounted but hidden after the client navigation
  // (its pills match too): only the visible pill counts.
  await expect(
    page.getByText("Not set up", { exact: true }).filter({ visible: true })
  ).toBeVisible()

  // Loopback is refused in production (SSRF guard), under the field.
  await page.getByLabel("SMTP server").fill("127.0.0.1")
  await page.getByLabel("Port").fill("1025")
  await page.getByLabel(/^User name/).fill(user)
  await page.getByLabel("Password").fill(PASSWORD)
  await page.getByLabel("Sender name").fill("Security Partners")
  await page.getByLabel("Sender address").fill("no-reply@e2e.test")
  await page.getByRole("button", { name: "Save" }).click()
  await expect(
    page.getByText("This address is not allowed for an email server")
  ).toBeVisible()
  await expect(page.getByLabel("SMTP server")).toBeFocused()

  await page.getByLabel("SMTP server").fill(host!)
  await page.getByRole("button", { name: "Save" }).click()
  await expect(page.getByText("Saved · ends in 1234")).toBeVisible()
  await expect(
    page.getByText("Connected", { exact: true }).filter({ visible: true })
  ).toBeVisible()
  await expect(page.getByLabel("Password")).toHaveValue("")
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
  await page.getByRole("button", { name: "Save" }).click()
  await expect(
    page.getByText("Enter the password again for the new server")
  ).toBeVisible()
  await expect(page.getByLabel("Password")).toBeFocused()
  await page.getByLabel("Port").fill("1025")
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled()

  // The test really runs against Mailpit: off loopback the server requires
  // STARTTLS (Task 1 guard), which Mailpit does not offer, so the fixed
  // "Secure connection failed" result comes back. The passing path
  // ("Connected to … and signed in as …") is covered against Mailpit on
  // loopback by tests/integration/api/integrations.test.ts (dev mode).
  await page.getByRole("button", { name: "Test connection" }).click()
  await expect(
    page.getByRole("status", { name: "Connection test" })
  ).toContainText(`Test failed — Secure connection failed (${host}:1025).`)

  await page.getByRole("button", { name: "Disconnect" }).click()
  const dialog = page.getByRole("alertdialog", {
    name: "Disconnect Email (SMTP)?",
  })
  await dialog.getByRole("button", { name: "Disconnect" }).click()
  await expect(
    page.getByText("Not set up", { exact: true }).filter({ visible: true })
  ).toBeVisible()
  await expect(page.getByText("Not saved yet", { exact: true })).toBeVisible()
})

test("integrations are for owners and admins only", async ({ page }) => {
  await signIn(page, readFixtures().editor)
  await page.goto("/admin/settings/site")
  await expect(
    page
      .getByRole("navigation", { name: "Settings" })
      .getByRole("link", { name: "Site" })
  ).toBeVisible()
  await expect(
    page
      .getByRole("navigation", { name: "Settings" })
      .getByRole("link", { name: "Integrations" })
  ).toHaveCount(0)
  await page.goto("/admin/settings/integrations/smtp")
  await expect(
    page.getByRole("heading", { name: "You do not have access to this page" })
  ).toBeVisible()
  const api = await page.request.get("/api/v1/admin/integrations")
  expect(api.status()).toBe(403)
})
