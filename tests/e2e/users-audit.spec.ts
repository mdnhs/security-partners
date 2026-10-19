import { expect, type Page, test } from "@playwright/test"

import { E2E_ADMIN, E2E_OWNER } from "./admin-accounts"
import { clientIpFor, E2E_PASSWORD, readFixtures } from "./fixtures"

// Phase 4 Task 12 (spec §8.1 Users + Audit log). Serial on the seeded
// sp_e2e: later tests use the invitation the first test sends.
test.describe.configure({ mode: "serial" })

const invitee = {
  email: `nora.new.${Date.now()}@e2e.test`,
  name: "Nora New",
}

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
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
}

/** The footer dock (website card) holds Users and Audit log for admins. */
const dockLink = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: "Administration" })
    .getByRole("link", { name, exact: true })
    .first()

async function openInvitee(page: Page) {
  await page.getByRole("searchbox", { name: "Search users" }).fill(invitee.name)
  await page
    .getByRole("table", { name: "Users" })
    .getByRole("link", { name: invitee.name })
    .click()
  await expect(
    page.getByRole("heading", { level: 1, name: invitee.name })
  ).toBeVisible()
}

const tab = (page: Page, name: string) =>
  page
    .getByRole("tablist", { name: "User sections" })
    .getByRole("tab", { name, exact: true })

test("owner invites a user and copies the invitation link", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await signIn(page, E2E_OWNER.email)
  await dockLink(page, "Users").click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Users" })
  ).toBeVisible()

  await page.getByRole("button", { name: "Invite user" }).click()
  const dialog = page.getByRole("dialog", { name: "Invite user" })
  await expect(
    dialog.getByRole("checkbox", { name: "Owner", exact: true })
  ).toBeVisible()
  await dialog
    .getByRole("textbox", { name: "Email", exact: true })
    .fill(invitee.email)
  await dialog
    .getByRole("textbox", { name: "Name", exact: true })
    .fill(invitee.name)
  await dialog.getByRole("checkbox", { name: "Editor", exact: true }).check()
  await dialog.getByRole("button", { name: "Send invitation" }).click()

  const done = page.getByRole("dialog", { name: "Invitation created" })
  // No SMTP in E2E: the link is the only way to pass the invitation on.
  await expect(done.getByRole("status")).toContainText("Email is not set up")
  const link = done.getByRole("textbox", { name: "Invitation link" })
  await expect(link).toHaveValue(/\/admin\/set-password\?token=/)
  await done.getByRole("button", { name: "Copy link" }).click()
  await expect(done.getByRole("button", { name: "Copied" })).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toBe(await link.inputValue())
  await done.getByRole("button", { name: "Done" }).click()

  await expect(
    page
      .getByRole("table", { name: "Users" })
      .getByRole("row", { name: new RegExp(invitee.name) })
  ).toContainText("Invited")
})

test("owner changes the invitee's roles", async ({ page }) => {
  await signIn(page, E2E_OWNER.email)
  await page.goto("/admin/users")
  await openInvitee(page)
  await tab(page, "Roles").click()
  const save = page.getByRole("button", { name: "Save roles" })
  await expect(save).toBeDisabled()
  await page.getByRole("checkbox", { name: "Viewer", exact: true }).check()
  await save.click()
  await expect(page.getByText("Roles saved")).toBeVisible()
  await expect(save).toBeDisabled()
  // The header follows the saved user; so does the list after a reload.
  await expect(
    page.getByRole("heading", { level: 1 }).locator("..")
  ).toContainText("Viewer")
  await page.goto("/admin/users")
  await expect(
    page
      .getByRole("table", { name: "Users" })
      .getByRole("row", { name: new RegExp(invitee.name) })
  ).toContainText("Viewer")
})

test("owner bans the invitee for 7 days, then unbans them", async ({
  page,
}) => {
  await signIn(page, E2E_OWNER.email)
  await page.goto("/admin/users")
  await openInvitee(page)
  await tab(page, "Access").click()
  await page.getByRole("textbox", { name: /Reason/ }).fill("Left the company")
  await page.getByRole("combobox", { name: "Duration" }).click()
  await page.getByRole("option", { name: "7 days" }).click()
  await page.getByRole("button", { name: "Ban user" }).click()
  const confirm = page.getByRole("alertdialog", {
    name: `Ban ${invitee.name}?`,
  })
  await expect(confirm).toContainText("for 7 days")
  await confirm.getByRole("button", { name: "Ban", exact: true }).click()
  await expect(page.getByRole("button", { name: "Unban" })).toBeVisible()
  await expect(page.getByText(/Left the company/)).toBeVisible()
  await expect(
    page.getByRole("heading", { level: 1 }).locator("..")
  ).toContainText("Banned")
  // A banned user gets no "View as" and no password link.
  await expect(page.getByRole("button", { name: "View as" })).toHaveCount(0)
  await tab(page, "Password").click()
  await expect(
    page.getByText("Unban this user before sending a password link.")
  ).toBeVisible()
  await tab(page, "Access").click()
  await page.getByRole("button", { name: "Unban" }).click()
  await expect(page.getByRole("button", { name: "Ban user" })).toBeVisible()
  await expect(
    page.getByRole("heading", { level: 1 }).locator("..")
  ).toContainText("Invited")
})

test("owner views the admin as the editor, then stops", async ({ page }) => {
  const { editor } = readFixtures()
  await signIn(page, E2E_OWNER.email)
  await page.goto("/admin/users")
  await page.getByRole("searchbox", { name: "Search users" }).fill(editor.name)
  await page
    .getByRole("table", { name: "Users" })
    .getByRole("link", { name: editor.name })
    .click()
  await page.getByRole("button", { name: "View as" }).click()
  const confirm = page.getByRole("alertdialog", {
    name: `View the admin as ${editor.name}?`,
  })
  await confirm.getByRole("button", { name: "Start viewing" }).click()

  const banner = page.getByRole("region", { name: "Impersonation" })
  await expect(banner).toContainText(
    `You are viewing the admin as ${editor.name}`
  )
  await expect(page).toHaveURL(/\/admin$/)
  // The editor holds no user:read: the dock loses Users and Audit log.
  await expect(dockLink(page, "Users")).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: `Account menu for ${editor.name}` })
  ).toBeVisible()

  await banner.getByRole("button", { name: "Stop impersonating" }).click()
  await expect(page.getByRole("region", { name: "Impersonation" })).toHaveCount(
    0
  )
  await expect(
    page.getByRole("button", { name: `Account menu for ${E2E_OWNER.name}` })
  ).toBeVisible()
  await expect(dockLink(page, "Users")).toBeVisible()
})

test("an admin sees no owner-only controls, and the API agrees", async ({
  page,
}) => {
  await signIn(page, E2E_ADMIN.email)
  await dockLink(page, "Users").click()

  await page.getByRole("button", { name: "Invite user" }).click()
  const dialog = page.getByRole("dialog", { name: "Invite user" })
  await expect(
    dialog.getByRole("checkbox", { name: "Admin", exact: true })
  ).toBeVisible()
  await expect(
    dialog.getByRole("checkbox", { name: "Owner", exact: true })
  ).toHaveCount(0)
  await dialog.getByRole("button", { name: "Cancel" }).click()

  await page.getByRole("searchbox", { name: "Search users" }).fill("Olive")
  await page
    .getByRole("table", { name: "Users" })
    .getByRole("link", { name: E2E_OWNER.name })
    .click()
  await expect(
    page.getByRole("heading", { level: 1, name: E2E_OWNER.name })
  ).toBeVisible()
  await expect(page.getByRole("note")).toContainText(
    "Only an owner can change an owner's account."
  )
  await expect(page.getByRole("tablist")).toHaveCount(0)
  for (const name of [
    "Save profile",
    "Save roles",
    "Ban user",
    "View as",
    "Create password reset link",
    "Sign out everywhere",
  ])
    await expect(page.getByRole("button", { name })).toHaveCount(0)

  // Hidden is not the protection: the API refuses the owner ban (403). The
  // body proves it is the owner rule (FORBIDDEN envelope), not the
  // same-origin guard or a validation error.
  const ownerId = new URL(page.url()).pathname.split("/").at(-1)
  const refused = await page.evaluate(async (id) => {
    const res = await fetch(`/api/v1/admin/users/${id}/ban`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
    return { status: res.status, body: (await res.json()) as unknown }
  }, ownerId)
  expect(refused.status).toBe(403)
  expect(refused.body).toMatchObject({
    error: {
      code: "FORBIDDEN",
      message: "You do not have permission to do this",
    },
  })
})

test("the audit log filters by action and person and shows the invitation", async ({
  page,
}) => {
  await signIn(page, E2E_OWNER.email)
  await dockLink(page, "Audit log").click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Audit log" })
  ).toBeVisible()

  await page.getByLabel("Action", { exact: true }).fill("user.invite")
  const table = page.getByRole("table", { name: "Audit log" })
  const row = table
    .getByRole("row", { name: /user\.invite/ })
    .filter({ hasText: E2E_OWNER.name })
  await expect(row).toHaveCount(1)
  await expect(row).toContainText("invited a user")

  // The person filter searches users as you type.
  await page.getByRole("combobox", { name: "Who" }).click()
  await page.getByRole("combobox", { name: "Search people" }).fill("Adam")
  await page
    .getByRole("listbox", { name: "People" })
    .getByRole("option", { name: /Adam Admin/ })
    .click()
  await expect(page.getByRole("combobox", { name: "Who" })).toContainText(
    "Adam Admin"
  )
  await expect(page.getByText("Nothing matches these filters")).toBeVisible()
  await page.getByRole("button", { name: "Clear filters" }).click()
  await expect(table).toBeVisible()

  await page.getByLabel("Action", { exact: true }).fill("user.invite")
  await row.getByRole("button", { name: /^Details of user\.invite/ }).click()
  const sheet = page.getByRole("dialog", { name: "Audit entry" })
  await expect(sheet.getByLabel("Details", { exact: true })).toContainText(
    invitee.email
  )
  await expect(sheet).toContainText(E2E_OWNER.email)
  await expect(sheet).toContainText("invited a user")
})
