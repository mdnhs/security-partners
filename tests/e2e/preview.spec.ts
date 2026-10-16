import { expect, type Page, test } from "@playwright/test"

import { BASE_URL } from "./env"
import { clientIpFor, E2E_PASSWORD, readFixtures } from "./fixtures"

// Draft preview (master 4.4): draft mode bypasses the 'use cache' entries of
// the public queries, and only the signed-in previewer ever sees drafts.

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
  await expect(page.getByRole("heading", { name: /^Welcome/ })).toBeVisible()
}

type PageDto = { version: number; draft: { hero: { title: string } } }

/** Sets the terms page's draft hero title; returns the previous one. */
async function setTermsDraftTitle(page: Page, title: string): Promise<string> {
  const current = (await (
    await page.request.get("/api/v1/admin/pages/terms")
  ).json()) as PageDto
  const draft = structuredClone(current.draft)
  draft.hero.title = title
  const res = await page.request.put("/api/v1/admin/pages/terms/draft", {
    headers: { origin: BASE_URL },
    data: { version: current.version, draft },
  })
  expect(res.status()).toBe(200)
  return current.draft.hero.title
}

const PUBLISHED = "Terms of Use"
const DRAFT = "Terms of Use (draft e2e)"

test("preview shows the draft past the cache; exit returns to published content", async ({
  page,
  context,
}) => {
  const hero = page.locator("[data-hero] h1")
  const bar = page.getByRole("region", { name: "Preview" })

  // Warm the published cache entry first.
  await page.goto("/terms")
  await expect(hero).toHaveText(PUBLISHED)

  await signIn(page, readFixtures().editor.email)
  const original = await setTermsDraftTitle(page, DRAFT)

  try {
    // Saving a draft leaves the public (cached) page unchanged.
    await page.goto("/terms")
    await expect(hero).toHaveText(PUBLISHED)
    await expect(bar).toHaveCount(0)

    // Enable preview → the draft renders, with the preview bar.
    await page.goto("/api/v1/admin/preview?entity=page&id=terms")
    await expect(page).toHaveURL(/\/terms$/)
    await expect(hero).toHaveText(DRAFT)
    await expect(bar).toBeVisible()

    // Exit → published content again, no bar, cookies gone.
    await bar.getByRole("button", { name: "Exit preview" }).click()
    await expect(page).toHaveURL(/\/terms$/)
    await expect(hero).toHaveText(PUBLISHED)
    await expect(bar).toHaveCount(0)
    const names = (await context.cookies()).map((c) => c.name)
    expect(names).not.toContain("sp.preview")
    expect(names).not.toContain("__prerender_bypass")

    // Next's draft-mode cookie alone (no sp.preview) never shows drafts.
    await page.goto("/api/v1/admin/preview?entity=page&id=terms")
    await expect(hero).toHaveText(DRAFT)
    await context.clearCookies({ name: "sp.preview" })
    await page.goto("/terms")
    await expect(hero).toHaveText(PUBLISHED)
    await expect(bar).toHaveCount(0)
    expect((await context.cookies()).map((c) => c.name)).not.toContain(
      "__prerender_bypass"
    )
  } finally {
    await setTermsDraftTitle(page, original)
  }
})
