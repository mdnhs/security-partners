import { expect, test } from "@playwright/test"

import { clientIpFor } from "./fixtures"

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
