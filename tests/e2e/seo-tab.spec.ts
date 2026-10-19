import { expect, type Page, test } from "@playwright/test"

import { E2E_OWNER } from "./admin-accounts"
import { BASE_URL } from "./env"
import { clientIpFor, E2E_PASSWORD } from "./fixtures"

// The SEO tab inside the editors (MK D1.4).

const SAME_ORIGIN = { origin: BASE_URL }

test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(testInfo.title),
  })
})

async function signIn(page: Page) {
  await page.goto("/admin/sign-in")
  await page.getByLabel("Email").fill(E2E_OWNER.email)
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL((url) => url.pathname === "/admin")
}

async function serviceId(page: Page, slug: string) {
  const res = await page.request.get(`/api/v1/admin/services?q=${slug}`)
  const body = (await res.json()) as { items: { id: string; slug: string }[] }
  return body.items.find((s) => s.slug === slug)!.id
}

test("social title saved from /admin/services/<id>?tab=seo persists after reload", async ({
  page,
}) => {
  await signIn(page)
  const id = await serviceId(page, "alarm-responses")
  await page.goto(`/admin/services/${id}?tab=seo`)
  await expect(page.getByRole("tab", { name: "SEO" })).toHaveAttribute(
    "aria-selected",
    "true"
  )
  const socialTitle = page.getByRole("textbox", { name: /^Social title/ })
  try {
    await socialTitle.fill("Alarm responses, day and night")
    // The previews follow the field before any save.
    await expect(
      page.getByRole("figure", { name: "Social card preview" })
    ).toContainText("Alarm responses, day and night")
    await page.getByRole("button", { name: "Save SEO" }).click()
    await expect(page.getByText("SEO saved")).toBeVisible()
    await page.reload()
    await expect(
      page.getByRole("textbox", { name: /^Social title/ })
    ).toHaveValue("Alarm responses, day and night")
    const head = await (
      await page.request.get("/services/alarm-responses")
    ).text()
    expect(head).toContain(
      '<meta property="og:title" content="Alarm responses, day and night"/>'
    )
  } finally {
    await page.request.put(`/api/v1/admin/seo/entries/service/${id}`, {
      headers: SAME_ORIGIN,
      data: { seo: {} },
    })
  }
})

test("an unsaved content edit survives a switch to the SEO tab and back", async ({
  page,
}) => {
  await signIn(page)
  const id = await serviceId(page, "alarm-responses")
  await page.goto(`/admin/services/${id}`)
  const title = page.getByRole("textbox", { name: /^Title/ }).first()
  const before = await title.inputValue()
  await title.fill(`${before} (draft)`)
  await page.getByRole("tab", { name: "SEO" }).click()
  await expect(page).toHaveURL(/[?&]tab=seo/)
  await page.getByRole("tab", { name: "Content" }).click()
  await expect(page).not.toHaveURL(/[?&]tab=seo/)
  await expect(title).toHaveValue(`${before} (draft)`)
  // Restore (autosave may already have stored the draft edit).
  await title.fill(before)
  await page.keyboard.press("ControlOrMeta+s")
  await expect(page.getByRole("status", { name: /^Save status/ })).toHaveText(
    /Saved/
  )
})

test("an issue's Fix link from SEO health lands on the editor's SEO tab", async ({
  page,
}) => {
  await signIn(page)
  // D1.5 renders these links on /admin/seo; their target is the contract.
  const res = await page.request.get("/api/v1/admin/seo/health")
  const health = (await res.json()) as {
    issues: { kind: string; fixHref: string }[]
  }
  const issue = health.issues.find((i) => i.kind === "service")
  test.skip(!issue, "the seed has no service issue")
  await page.goto(issue!.fixHref)
  await expect(page).toHaveURL(/\/admin\/services\/[^/?]+\?tab=seo$/)
  await expect(page.getByRole("tab", { name: "SEO" })).toHaveAttribute(
    "aria-selected",
    "true"
  )
  await expect(
    page.getByRole("figure", { name: "Search result preview" })
  ).toBeVisible()
})
