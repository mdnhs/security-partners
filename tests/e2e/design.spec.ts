import { expect, type Page, test } from "@playwright/test"

import { E2E_OWNER } from "./admin-accounts"
import { clientIpFor, E2E_PASSWORD, greeting, readFixtures } from "./fixtures"

// MK-parity A7: /admin/design, the component gallery on sample data, is for
// the owner only (customCode:update; Phase B: requirePage("/admin/design")).
// Two contexts, each signing in from its own address (production rate limits).

async function signIn(page: Page, who: { email: string; name: string }) {
  await page.goto("/admin/sign-in")
  await page.getByLabel("Email").fill(who.email)
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(
    page.getByRole("heading", { name: greeting(who.name) })
  ).toBeVisible()
}

test("owner sees the design gallery; editor is forbidden", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": clientIpFor("design owner") },
  })
  const editorContext = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": clientIpFor("design editor") },
  })
  const owner = await ownerContext.newPage()
  const editor = await editorContext.newPage()
  try {
    await signIn(owner, E2E_OWNER)
    await owner.goto("/admin/design")
    await expect(
      owner.getByRole("heading", { name: "Design system" })
    ).toBeVisible()
    await expect(owner.getByRole("combobox").first()).toBeVisible()
    // Not in the menu: reached by URL only.
    await expect(
      owner
        .getByRole("navigation", { name: "Admin", exact: true })
        .getByRole("link", { name: /design/i })
    ).toHaveCount(0)

    await signIn(editor, readFixtures().editor)
    await editor.goto("/admin/design")
    await expect(
      editor.getByText(/don.t have access|do not have access|forbidden/i)
    ).toBeVisible()
    await expect(
      editor.getByRole("heading", { name: "Design system" })
    ).toHaveCount(0)
  } finally {
    await ownerContext.close()
    await editorContext.close()
  }
})
