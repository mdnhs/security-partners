import { expect, type Page, test } from "@playwright/test"
import { URI } from "otpauth"

import { BASE_URL } from "./env"
import { clientIpFor, E2E_PASSWORD, readFixtures } from "./fixtures"

/** The signed-in user's menu in the sidebar footer (holds "Sign out"). */
async function openUserMenu(page: Page) {
  await page.locator('[data-slot="sidebar-footer"]').getByRole("button").click()
}

async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
}

test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(testInfo.title),
  })
})

test.describe("admin auth pages + proxy (Task 2.5)", () => {
  test("/admin without a session cookie redirects to /admin/sign-in?next=/admin", async ({
    page,
    request,
  }) => {
    const res = await request.get("/admin", { maxRedirects: 0 })
    expect(res.status()).toBe(307)
    const location = new URL(res.headers().location, "http://localhost")
    expect(location.pathname).toBe("/admin/sign-in")
    expect(location.searchParams.get("next")).toBe("/admin")

    await page.goto("/admin")
    await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/)
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
  })

  test("/admin/* and /api/* responses carry X-Robots-Tag: noindex; the public site does not", async ({
    request,
  }) => {
    for (const path of [
      "/admin",
      "/admin/sign-in",
      "/admin/forgot-password",
      "/api/v1/health/live",
      "/api/auth/get-session",
      "/api/v1/does-not-exist",
    ]) {
      const res = await request.get(path, { maxRedirects: 0 })
      expect(res.headers()["x-robots-tag"], path).toBe("noindex")
    }
    const home = await request.get("/")
    expect(home.status()).toBe(200)
    expect(home.headers()["x-robots-tag"]).toBeUndefined()
  })

  test("a wrong password shows an error and stays on sign-in", async ({
    page,
  }) => {
    const { editor } = readFixtures()
    await page.goto("/admin/sign-in")
    await signIn(page, editor.email, "not-the-right-password")
    await expect(
      page.getByText("Email or password is incorrect.")
    ).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/sign-in/)
  })

  test("set-password flow works with an invite token (single use)", async ({
    page,
  }) => {
    const { invitee } = readFixtures()
    const password = "invited-user-password-1"
    await page.goto(invitee.inviteUrl)
    await expect(
      page.getByRole("heading", { name: "Set your password" })
    ).toBeVisible()
    await page.getByLabel("Password", { exact: true }).fill(password)
    await page.getByLabel("Repeat password").fill(password)
    await page.getByRole("button", { name: "Set password" }).click()

    await expect(page).toHaveURL(/\/admin\/sign-in\?notice=password-set$/)
    await expect(
      page.getByText("Your password is set. Sign in to continue.")
    ).toBeVisible()
    await signIn(page, invitee.email, password)
    await expect(page).toHaveURL(/\/admin$/)
    await expect(
      page.getByRole("heading", { name: `Welcome, ${invitee.name}` })
    ).toBeVisible()

    await page.goto(invitee.inviteUrl)
    await page
      .getByLabel("Password", { exact: true })
      .fill("another-password-22")
    await page.getByLabel("Repeat password").fill("another-password-22")
    await page.getByRole("button", { name: "Set password" }).click()
    await expect(
      page.getByText("This link has expired or was already used.")
    ).toBeVisible()
  })

  test("the two-factor challenge page is shown when 2FA is enabled", async ({
    page,
  }) => {
    const { twoFactor } = readFixtures()
    await page.goto("/admin/sign-in?next=%2Fadmin")
    await signIn(page, twoFactor.email, E2E_PASSWORD)
    await expect(page).toHaveURL(/\/admin\/two-factor\?next=%2Fadmin$/)
    await expect(
      page.getByRole("heading", { name: "Two-factor authentication" })
    ).toBeVisible()

    await page.getByLabel("Authentication code").fill("000000")
    await page.getByRole("button", { name: "Verify" }).click()
    await expect(page.getByText("That code is not valid.")).toBeVisible()

    await page
      .getByLabel("Authentication code")
      .fill(URI.parse(twoFactor.totpUri).generate())
    await page.getByRole("button", { name: "Verify" }).click()
    await expect(page).toHaveURL(/\/admin$/)
    await expect(
      page.getByRole("heading", { name: `Welcome, ${twoFactor.name}` })
    ).toBeVisible()
  })

  test("sign out returns to sign-in and /admin is gated again", async ({
    page,
  }) => {
    const { editor } = readFixtures()
    await page.goto("/admin/sign-in")
    await signIn(page, editor.email, E2E_PASSWORD)
    await expect(
      page.getByRole("heading", { name: `Welcome, ${editor.name}` })
    ).toBeVisible()
    await openUserMenu(page)
    await page.getByRole("menuitem", { name: "Sign out" }).click()
    await expect(page).toHaveURL(/\/admin\/sign-in\?notice=signed-out$/)
    await page.goto("/admin")
    await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin$/)
  })

  test("a failed sign-out shows an error and keeps the session", async ({
    page,
  }) => {
    const { editor } = readFixtures()
    await page.goto("/admin/sign-in")
    await signIn(page, editor.email, E2E_PASSWORD)
    await expect(
      page.getByRole("heading", { name: `Welcome, ${editor.name}` })
    ).toBeVisible()

    await page.route("**/api/auth/sign-out", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Internal server error" }),
      })
    )
    await openUserMenu(page)
    await page.getByRole("menuitem", { name: "Sign out" }).click()
    // The menu stays open with the error; the item can be retried.
    await expect(page.getByRole("menu")).toContainText("Internal server error")
    await expect(page).toHaveURL(/\/admin$/)
    await expect(
      page.getByRole("menuitem", { name: "Sign out" })
    ).not.toHaveAttribute("aria-disabled", "true")

    await page.unroute("**/api/auth/sign-out")
    await page.getByRole("menuitem", { name: "Sign out" }).click()
    await expect(page).toHaveURL(/\/admin\/sign-in\?notice=signed-out$/)
  })

  test("unknown ?notice= values (incl. __proto__) render no notice", async ({
    page,
  }) => {
    for (const notice of ["__proto__", "constructor", "nope"]) {
      await page.goto(`/admin/sign-in?notice=${notice}`)
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible()
      await expect(page.locator('[data-slot="alert"]')).toHaveCount(0)
    }
  })

  test("forgot password answers the same for any email", async ({ page }) => {
    const { editor } = readFixtures()
    const answers = []
    for (const email of [editor.email, "nobody@e2e.test"]) {
      await page.goto("/admin/forgot-password")
      await page.getByLabel("Email").fill(email)
      const response = page.waitForResponse(
        "**/api/auth/request-password-reset"
      )
      await page.getByRole("button", { name: "Send reset link" }).click()
      const res = await response
      const notice = page.getByRole("status")
      await expect(notice).toContainText(`If ${email} has an admin account`)
      answers.push({
        status: res.status(),
        body: await res.json(),
        notice: (await notice.innerText()).replace(email, "<email>"),
      })
    }
    expect(answers[0].status).toBe(200)
    expect(answers[1]).toEqual(answers[0])
  })

  test("forgot password submitted before hydration keeps the email out of the URL", async ({
    browser,
  }, testInfo) => {
    // The only auth form in the static HTML: the others read search params
    // and render on the client (Suspense), so they need JS to appear at all.
    const context = await browser.newContext({
      baseURL: BASE_URL,
      javaScriptEnabled: false,
      extraHTTPHeaders: { "x-forwarded-for": clientIpFor(testInfo.title) },
    })
    const page = await context.newPage()
    await page.goto("/admin/forgot-password")
    await page.getByLabel("Email").fill("leak@e2e.test")
    await page.getByRole("button", { name: "Send reset link" }).click()
    await page.waitForLoadState()
    expect(page.url()).not.toContain("leak")
    await context.close()
  })

  test("sign-in is rate limited in production: the 6th attempt in a minute → 429", async ({
    request,
  }) => {
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const res = await request.post("/api/auth/sign-in/email", {
        headers: { "x-forwarded-for": "198.18.255.1", origin: BASE_URL },
        data: { email: "nobody@e2e.test", password: "wrong-password-123" },
      })
      statuses.push(res.status())
    }
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429])
  })

  test("unknown /admin/* URLs are 404 inside the admin root layout", async ({
    page,
    request,
  }) => {
    // Without a session the proxy gate answers first.
    const gated = await request.get("/admin/does-not-exist", {
      maxRedirects: 0,
    })
    expect(gated.status()).toBe(307)

    const { editor } = readFixtures()
    await page.goto("/admin/sign-in")
    await signIn(page, editor.email, E2E_PASSWORD)
    await expect(
      page.getByRole("heading", { name: `Welcome, ${editor.name}` })
    ).toBeVisible()

    const res = await page.goto("/admin/does-not-exist")
    expect(res?.status()).toBe(404)
    await expect(
      page.getByRole("heading", { name: "Page not found" })
    ).toBeVisible()
    // Admin root layout (lang en-IE), not the public site's (lang en).
    await expect(page.locator("html")).toHaveAttribute("lang", "en-IE")
  })

  test("public pages still render from the (site) group; unknown URLs are 404", async ({
    request,
  }) => {
    const home = await request.get("/")
    expect(await home.text()).toContain(
      "Security Partners Ltd. | Watching Over You"
    )
    expect((await request.get("/this-page-does-not-exist")).status()).toBe(404)
  })
})
