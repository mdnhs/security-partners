import { expect, type Page, test } from "@playwright/test"

import { BASE_URL } from "./env"
import { clientIpFor, E2E_PASSWORD, greeting, readFixtures } from "./fixtures"
import { deleteLeadsFrom } from "./lead-cleanup"

// Master 7.3/7.4: the public form creates a lead the intake user works in
// the inbox, with the staff-notification outcome on its activity; honeypot →
// no lead; the 6th post from one IP in 10 minutes → 429.
//
// Email delivery itself is not asserted here: the E2E server is the standalone server.js
// (production), whose SMTP guard (Phase 6) refuses loopback and requires
// STARTTLS off loopback, which the dev Mailpit does not offer. Delivery of
// the staff email to Mailpit is covered on loopback by
// tests/integration/api/leads-public.test.ts.

const SUCCESS =
  "Thank you, your message has been sent. We will be in touch shortly."
/** This spec's visitor address: its leads are deleted again (sidebar badge). */
const VISITOR = "leads-spec@example.test"

test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(testInfo.title),
  })
})

test.afterAll(async ({ playwright }) => {
  // The visual suite (same server) expects the new-leads badge hidden.
  const request = await playwright.request.newContext({ baseURL: BASE_URL })
  await deleteLeadsFrom(request, VISITOR)
  await request.dispose()
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

async function sendEnquiry(
  page: Page,
  name: string,
  opts: { honeypot?: string } = {}
) {
  await page.goto("/contact")
  const form = page
    .locator("form")
    .filter({ has: page.getByLabel("Your Name") })
  await form.getByLabel("Your Name").fill(name)
  await form.getByLabel("Email").fill(VISITOR)
  await form.getByLabel("Phone").fill("085 123 4567")
  await form.getByLabel("Message").fill("Please quote for static security.")
  if (opts.honeypot)
    await form.locator("#website").fill(opts.honeypot, { force: true })
  await form.getByRole("button", { name: "Send Message" }).click()
  await expect(form.getByText(SUCCESS)).toBeVisible()
}

test("public enquiry → lead in the intake inbox, worked by the intake user", async ({
  page,
  browser,
}) => {
  const { intake } = readFixtures()
  const name = `Visitor ${Date.now()}`

  const visitor = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": clientIpFor(`${name} visitor`) },
  })
  await sendEnquiry(await visitor.newPage(), name)
  await visitor.close()

  await signIn(page, intake)
  // Intake sees only leads (plus Dashboard/Account) and the API agrees.
  const nav = page.getByRole("navigation", { name: "Admin" })
  await expect(nav.getByRole("link", { name: /^Leads/ })).toBeVisible()
  await expect(nav.getByRole("link", { name: "Pages" })).toHaveCount(0)
  expect((await page.request.get("/api/v1/admin/pages")).status()).toBe(403)

  await nav.getByRole("link", { name: /^Leads/ }).click()
  await page.getByRole("searchbox", { name: "Search leads" }).fill(name)
  await page.getByRole("link", { name }).first().click()
  // D3.2: the enquiry opens in a side drawer over the inbox.
  const drawer = page.getByRole("dialog", { name })
  await expect(drawer.getByRole("heading", { name })).toBeVisible()

  // shadcn Select (MK parity A5): open the combobox, pick the option.
  await drawer.getByRole("combobox", { name: "Lead status" }).click()
  await page.getByRole("option", { name: "Contacted" }).click()
  // No success toast (final review M8): the select and badge show it.
  await expect(
    drawer.getByRole("combobox", { name: "Lead status" })
  ).toHaveText("Contacted")
  await drawer.getByLabel("Add a note").fill("Called, sending a quote")
  await drawer.getByRole("button", { name: "Add note" }).click()
  await expect(
    drawer
      .getByRole("region", { name: "Notes" })
      .getByText("Called, sending a quote")
  ).toBeVisible()
  const activity = drawer.getByRole("region", { name: "Activity" })
  await expect(activity.getByText("Sent from /contact")).toBeVisible()
  // Recipients come from settings.leads (seeded leads@e2e.test); the mailer
  // ran and recorded its outcome (no SMTP in this production server).
  await expect(
    activity.getByText(
      "Staff notification not sent: email is not configured or failed."
    )
  ).toBeVisible()
  await expect(activity.getByText("New → Contacted")).toBeVisible()
})

test("honeypot filled → success shown, but no lead is stored", async ({
  page,
  browser,
}) => {
  const { intake } = readFixtures()
  const name = `Bot ${Date.now()}`
  const bot = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": clientIpFor(`${name} bot`) },
  })
  await sendEnquiry(await bot.newPage(), name, {
    honeypot: "http://spam.example",
  })
  await bot.close()

  await signIn(page, intake)
  const res = await page.request.get(
    `/api/v1/admin/leads?status=all&q=${encodeURIComponent(name)}`
  )
  expect(res.status()).toBe(200)
  expect(((await res.json()) as { total: number }).total).toBe(0)
})

test("6th enquiry from one IP within 10 minutes → 429 with Retry-After", async ({
  playwright,
}) => {
  const api = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      "x-forwarded-for": clientIpFor(`rate-limit-6th ${Date.now()}`),
    },
  })
  // Honeypot bodies: counted by the limiter, but no lead or email is created.
  const data = {
    name: "Rate",
    email: VISITOR,
    message: "Hi",
    website: "bot",
  }
  for (let i = 0; i < 5; i++)
    expect((await api.post("/api/v1/public/leads", { data })).status()).toBe(
      200
    )
  const sixth = await api.post("/api/v1/public/leads", { data })
  expect(sixth.status()).toBe(429)
  expect(Number(sixth.headers()["retry-after"])).toBeGreaterThan(0)
  expect(((await sixth.json()) as { error: { code: string } }).error.code).toBe(
    "RATE_LIMITED"
  )
  await api.dispose()
})

test("first-touch attribution travels with the enquiry to the Source section (D3.1)", async ({
  page,
  browser,
}) => {
  const { intake } = readFixtures()
  const name = `Attributed ${Date.now()}`

  const visitor = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": clientIpFor(`${name} visitor`) },
  })
  const tab = await visitor.newPage()
  // Lands from an external search with UTM tags, then moves on to /contact:
  // the first touch is kept for the visit.
  await tab.goto("/?utm_source=e2e-search&utm_campaign=%3Cb%3Ed31%3C%2Fb%3E", {
    referer: "https://www.example.org/results?q=private",
  })
  await sendEnquiry(tab, name)
  await visitor.close()

  await signIn(page, intake)
  await page.goto("/admin/leads")
  await page.getByRole("searchbox", { name: "Search leads" }).fill(name)
  await page.getByRole("link", { name }).first().click()
  const source = page
    .getByRole("dialog", { name })
    .getByRole("region", { name: "Source" })
  await expect(
    source.getByText("https://www.example.org/results")
  ).toBeVisible()
  await expect(source.getByText("e2e-search")).toBeVisible()
  // Visitor-supplied markup stays text.
  await expect(source.getByText("<b>d31</b>")).toBeVisible()
  await expect(source.getByText(/q=private/)).toHaveCount(0)
})

test("the detail URL lands on the drawer, and Back closes it (D3.2)", async ({
  page,
  browser,
}) => {
  const { intake } = readFixtures()
  const name = `Drawer ${Date.now()}`
  const visitor = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": clientIpFor(`${name} visitor`) },
  })
  await sendEnquiry(await visitor.newPage(), name)
  await visitor.close()

  await signIn(page, intake)
  const res = await page.request.get(
    `/api/v1/admin/leads?q=${encodeURIComponent(name)}`
  )
  const { items } = (await res.json()) as { items: { id: string }[] }
  const id = items[0]!.id

  // Old links (notification email, search) redirect to the inbox drawer.
  await page.goto(`/admin/leads/${id}`)
  await expect(page).toHaveURL(`/admin/leads?lead=${id}`)
  await expect(
    page.getByRole("dialog", { name }).getByRole("heading", { name })
  ).toBeVisible()
  await page.getByRole("dialog", { name }).getByRole("button", { name: "Close" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page).toHaveURL("/admin/leads")

  // Opening pushes a history entry: the browser's Back closes the drawer
  // and stays on the inbox.
  await page.getByRole("searchbox", { name: "Search leads" }).fill(name)
  await page.getByRole("link", { name }).first().click()
  await expect(page.getByRole("dialog", { name })).toBeVisible()
  expect(new URL(page.url()).searchParams.get("lead")).toBe(id)
  await page.goBack()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  expect(new URL(page.url()).searchParams.get("lead")).toBeNull()
  await expect(
    page.getByRole("heading", { level: 1, name: "Enquiries" })
  ).toBeVisible()
})
