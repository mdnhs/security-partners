import { expect, type Page, test } from "@playwright/test"

import { E2E_OWNER } from "./admin-accounts"
import { assistantOnHomeEditor, pinAssistant } from "./ai-pins"
import { clientIpFor, E2E_PASSWORD, greeting } from "./fixtures"

// MK-parity A9, measured in a real browser (the DOM tests can only check
// classes): the KPI row sits one page gap (24 px) under the header, Next up
// rows are 28 px apart, and the topbar never overflows with every control
// shown (role chip, AI, mail, bell) at 1024 px, nor on 360/390 px phones.

test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(testInfo.title),
  })
})

async function signIn(page: Page) {
  await pinAssistant(page)
  await page.goto("/admin/sign-in")
  await page.getByLabel("Email").fill(E2E_OWNER.email)
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(
    page.getByRole("heading", { name: greeting(E2E_OWNER.name) })
  ).toBeVisible()
}

/** Pinned SMTP integration: saving it refetches the (pinned) AI status. */
const SAVED_SMTP = {
  key: "integrations.smtp",
  slug: "smtp",
  label: "Email (SMTP)",
  description: "Sends invitations, password resets and enquiry notifications.",
  configured: true,
  version: 2,
  values: {
    host: "smtp.example.ie",
    port: 587,
    secure: false,
    user: "mailer@example.ie",
    fromName: "Security Partners",
    fromAddress: "no-reply@example.ie",
  },
  secrets: { password: { set: true, hint: "••••1234" } },
  updatedAt: "2026-10-16T09:00:00.000Z",
  updatedBy: { id: "u1", name: "Ada Admin" },
}

/** Every topbar control lies inside the topbar, which does not scroll. */
async function expectTopbarFits(page: Page) {
  const topbar = page.locator("[data-slot=topbar]")
  const fits = await topbar.evaluate((bar) => {
    const box = bar.getBoundingClientRect()
    const inside = [...bar.querySelectorAll("a, button")]
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .every((el) => {
        const r = el.getBoundingClientRect()
        return r.left >= box.left - 0.5 && r.right <= box.right + 0.5
      })
    return { inside, scroll: bar.scrollWidth <= bar.clientWidth }
  })
  expect(fits).toEqual({ inside: true, scroll: true })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
}

test("dashboard: KPI row one 24 px gap under the header; Next up at 28 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page)
  const header = page.getByTestId("greeting").locator("xpath=ancestor::header")
  const firstKpi = page.getByRole("article").first()
  await expect(firstKpi).toBeVisible()
  const headerBox = (await header.boundingBox())!
  const kpiBox = (await firstKpi.boundingBox())!
  expect(Math.round(kpiBox.y - (headerBox.y + headerBox.height))).toBe(24)

  const rows = page
    .getByRole("list", { name: "Next steps" })
    .getByRole("listitem")
  if ((await rows.count()) > 1) {
    const a = (await rows.nth(0).boundingBox())!
    const b = (await rows.nth(1).boundingBox())!
    expect(Math.round(b.y - a.y)).toBe(28)
  }
})

test("topbar fits at 1024 px with role chip, AI, mail and bell", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await signIn(page)
  // The seed has no AI integration, so the layout renders the button off
  // and the status query never refetches on its own: turn it on the way
  // Settings does (pinned status, no provider), then measure the topbar.
  await assistantOnHomeEditor(page, SAVED_SMTP)
  const topbar = page.locator("[data-slot=topbar]")
  await expect(
    topbar.getByRole("button", { name: "AI assistant" })
  ).toBeVisible()
  await expect(topbar.getByRole("link", { name: /^Enquiries/ })).toBeVisible()
  await expect(
    topbar.getByRole("button", { name: /^Account menu for / })
  ).toBeVisible()
  await expectTopbarFits(page)
  // The search pill keeps at least its 44 px target.
  const pill = (await topbar
    .getByRole("button", { name: /Search/ })
    .boundingBox())!
  expect(pill.width).toBeGreaterThanOrEqual(44)
})

for (const width of [360, 390]) {
  test(`phone topbar at ${width} px shows the mail link and fits`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 })
    await signIn(page)
    const mail = page
      .locator("[data-slot=topbar]")
      .getByRole("link", { name: /^Enquiries/ })
    await expect(mail).toBeVisible()
    const box = (await mail.boundingBox())!
    expect(Math.round(box.width)).toBe(44)
    expect(Math.round(box.height)).toBe(44)
    await expectTopbarFits(page)
  })
}
