import { expect, type Page, test } from "@playwright/test"

import { E2E_OWNER } from "./admin-accounts"
import { submitApplication } from "./careers-apply"
import { clientIpFor, E2E_PASSWORD, readFixtures } from "./fixtures"

// Careers (plan 2026-11-04-careers): the listing, a job page and the
// application form over the demo openings seeded by tests/visual/seed.ts
// (server/db/seed/demo-jobs.ts: five open roles, three previous openings).

test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(testInfo.title),
  })
})

test.describe("careers listing", () => {
  test("lists the open roles, filters them, and shows previous openings", async ({
    page,
  }) => {
    await page.goto("/careers")
    await expect(
      page.getByRole("heading", { level: 1, name: "Careers" })
    ).toBeVisible()
    const open = page.locator("#open-positions")
    await expect(open.getByText("5 open roles")).toBeVisible()
    const cards = open.locator("li[data-card]")
    await expect(cards).toHaveCount(5)

    await open.getByRole("searchbox").fill("cctv monitoring")
    await expect(cards).toHaveCount(1)
    await expect(cards.first()).toContainText("CCTV Monitoring Operator")
    await open.getByRole("searchbox").fill("")

    await open.getByRole("button", { name: "Mobile Patrol" }).click()
    await expect(cards).toHaveCount(1)
    await expect(cards.first()).toContainText("Urgent")
    await open.getByRole("button", { name: "All Roles (5)" }).click()
    await expect(cards).toHaveCount(5)

    await open.getByLabel("All Locations").selectOption("Laois & Offaly")
    await expect(cards).toHaveCount(1)

    const previous = page
      .getByRole("heading", { name: "Previous Openings" })
      .locator("xpath=ancestor::section")
    await expect(previous.getByText("Retail Security Officer")).toBeVisible()
    await expect(previous.getByText("Position Filled").first()).toBeVisible()
  })

  test("the header links to Careers", async ({ page }) => {
    await page.goto("/")
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Careers" })
      .click()
    await expect(page).toHaveURL(/\/careers$/)
  })

  test("an unknown job address is a real 404", async ({ page }) => {
    expect((await page.goto("/careers/no-such-role"))?.status()).toBe(404)
    expect((await page.goto("/careers/no-such-role/apply"))?.status()).toBe(404)
  })
})

test.describe("job detail", () => {
  test("an open role: summary, apply link, similar roles and JobPosting data", async ({
    page,
  }) => {
    const response = await page.goto("/careers/static-security-officer")
    expect(response?.status()).toBe(200)
    await expect(
      page.getByRole("heading", { level: 1, name: "Static Security Officer" })
    ).toBeVisible()
    const summary = page.getByRole("region", { name: "Job Summary" })
    await expect(summary.getByText("SP-2611-STA")).toBeVisible()
    await expect(summary.getByText("Closing Date")).toBeVisible()
    await expect(
      summary.getByRole("link", { name: "Apply for This Job" })
    ).toHaveAttribute("href", "/careers/static-security-officer/apply")
    await expect(page.getByRole("link", { name: "Apply Now" })).toHaveAttribute(
      "href",
      "/careers/static-security-officer/apply"
    )

    const similar = page
      .getByRole("heading", { name: "Similar Roles" })
      .locator("xpath=ancestor::section")
    await expect(similar.locator("li[data-card]")).toHaveCount(3)
    await expect(similar).not.toContainText("Static Security Officer")

    const ld = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents()
    const posting = ld
      .flatMap((text) => [JSON.parse(text)].flat())
      .find((node) => node["@type"] === "JobPosting")
    expect(posting).toMatchObject({
      title: "Static Security Officer",
      employmentType: "FULL_TIME",
    })
  })

  test("a filled role: the closed notice, no Apply and no JobPosting", async ({
    page,
  }) => {
    expect(
      (await page.goto("/careers/retail-security-officer"))?.status()
    ).toBe(200)
    await expect(
      page.getByText("This role has closed and is no longer accepting")
    ).toHaveCount(2)
    await expect(page.getByRole("link", { name: /Apply/ })).toHaveCount(0)
    const ld = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents()
    expect(ld.join("")).not.toContain("JobPosting")
  })
})

test.describe("apply", () => {
  test("an applicant fills the form with a CV and sees the confirmation", async ({
    page,
  }) => {
    await page.goto("/careers/static-security-officer/apply")
    await expect(
      page.getByRole("heading", { level: 1, name: "Apply for This Role" })
    ).toBeVisible()
    await page.getByLabel("First Name").fill("Aoife")
    await page.getByLabel("Surname").fill("Byrne")
    await page.getByLabel("Email Address").fill("aoife@example.ie")
    await page.getByLabel("Mobile Number").fill("085 123 4567")
    await page.getByLabel("Town / County").fill("Portlaoise")
    await page.getByRole("radio", { name: "Irish or UK citizen" }).check()
    await page
      .getByRole("radiogroup", { name: "Do you hold a valid PSA licence?" })
      .getByRole("radio", { name: "No" })
      .check()
    await page.getByLabel("Employer / Activity").fill("Advance Security Ltd")
    await page.getByLabel("From", { exact: true }).fill("2021-03")
    for (const [group, answer] of [
      ["Are you willing to undergo Garda vetting", "Yes"],
      ["Have you lived outside Ireland", "No"],
      ["Do you have a full driving licence", "Yes"],
    ])
      await page
        .getByRole("radiogroup", { name: new RegExp(group) })
        .getByRole("radio", { name: answer })
        .check()
    await page
      .getByLabel("Security Experience in Ireland")
      .selectOption("1–2 years")
    await page.getByLabel("Earliest Start Date").fill("2026-12-01")
    await page.getByRole("checkbox", { name: "Nights" }).check()
    await page.getByLabel("Upload Your CV").setInputFiles({
      name: "cv.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7\n% e2e cv\n%%EOF"),
    })
    await page
      .getByRole("checkbox", {
        name: /information in this application is true/,
      })
      .check()
    await page
      .getByRole("checkbox", { name: /processing my personal data/ })
      .check()
    await page.getByRole("button", { name: "Submit Application" }).click()
    await expect(
      page.getByRole("heading", { name: "Application sent" })
    ).toBeVisible()
  })

  test("a filled role shows the closed notice and no form", async ({
    page,
  }) => {
    expect(
      (await page.goto("/careers/retail-security-officer/apply"))?.status()
    ).toBe(200)
    await expect(
      page.getByText(
        "This role has closed and is no longer accepting applications."
      )
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Submit Application" })
    ).toHaveCount(0)
  })
})

test.describe("talent pool", () => {
  test("Send Us Your CV opens the form without a role, and it is accepted", async ({
    page,
    request,
  }) => {
    await page.goto("/careers")
    await page.getByRole("link", { name: "Send Us Your CV" }).click()
    await page.waitForURL("**/careers/apply")
    await expect(
      page.getByRole("heading", { level: 1, name: "Don’t see the right role?" })
    ).toBeVisible()
    await expect(
      page.getByText("Unsuccessful applications are deleted after 12 months")
    ).toBeVisible()
    await expect(
      page.getByText("Keep my details on file for 24 months")
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Submit Application" })
    ).toBeVisible()
    await submitApplication(request, "")
  })
})

async function signIn(page: Page, email: string) {
  await page.goto("/admin/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL((url) => url.pathname === "/admin")
}

async function publishCurrent(page: Page) {
  await page.getByRole("button", { name: "Publish" }).click()
  // "Published" may already show from an earlier publish: wait for this one.
  const published = page.waitForResponse(
    (res) =>
      /\/api\/v1\/admin\/jobs\/[^/]+\/publish$/.test(res.url()) && res.ok()
  )
  await page
    .getByRole("dialog", { name: "Publish changes?" })
    .getByRole("button", { name: "Publish now" })
    .click()
  await published
  await expect(page.getByText("Published").first()).toBeVisible()
}

test.describe("careers admin", () => {
  test("an editor creates and publishes a job, then marks it filled", async ({
    page,
    browser,
  }) => {
    const title = `E2E Door Supervisor ${Date.now()}`
    await signIn(page, readFixtures().editor.email)
    await page.goto("/admin/careers")
    await page.getByRole("button", { name: "New job" }).click()
    const dialog = page.getByRole("dialog", { name: "New job" })
    await dialog.getByLabel("Job title").fill(title)
    await dialog.getByRole("button", { name: "Create draft" }).click()
    await page.waitForURL(/\/admin\/careers\/jobs\/[0-9a-f-]{36}$/)
    await publishCurrent(page)

    const visitor = await (await browser.newContext()).newPage()
    await visitor.goto("/careers")
    await expect(
      visitor.locator("#open-positions").getByText(title)
    ).toBeVisible()

    await page.getByRole("switch", { name: "Position filled" }).click()
    await publishCurrent(page)
    await visitor.reload()
    await expect(
      visitor.locator("#open-positions").getByText(title)
    ).toHaveCount(0)
    const previous = visitor
      .getByRole("heading", { name: "Previous Openings" })
      .locator("xpath=ancestor::section")
    await expect(previous.getByText(title)).toBeVisible()
  })

  test("the owner opens an application, downloads the CV, shortlists and deletes it", async ({
    page,
  }) => {
    await submitApplication(page.request, "static-security-officer", {
      firstName: "Róisín",
      surname: "Admin-Flow",
    })
    await signIn(page, E2E_OWNER.email)
    await page.goto("/admin/careers/applications")
    await page.getByRole("link", { name: "Róisín Admin-Flow" }).first().click()
    await page.waitForURL(/\/admin\/careers\/applications\/[0-9a-f-]{36}$/)
    await expect(
      page.getByRole("heading", { name: "PSA Licence" })
    ).toBeVisible()

    const href = await page
      .getByRole("link", { name: /niamh-cv\.pdf/ })
      .getAttribute("href")
    const file = await page.request.get(href!)
    expect(file.status()).toBe(200)
    expect(file.headers()["content-disposition"]).toContain("attachment")

    await page.getByRole("combobox", { name: "Status" }).click()
    await page.getByRole("option", { name: "Shortlisted" }).click()
    await expect(page.getByTestId("application-status")).toHaveText(
      "Shortlisted"
    )

    await page.getByRole("button", { name: "Delete" }).click()
    await page
      .getByRole("alertdialog", { name: "Delete this application?" })
      .getByRole("button", { name: "Delete application" })
      .click()
    await page.waitForURL(
      (url) => url.pathname === "/admin/careers/applications"
    )
    expect((await page.request.get(href!)).status()).toBe(404)
  })
})
