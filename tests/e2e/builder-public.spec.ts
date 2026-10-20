import { expect, type Page, test } from "@playwright/test"

import { BASE_URL } from "./env"
import { clientIpFor, E2E_PASSWORD, readFixtures } from "./fixtures"

// Builder pages at /p/<slug> (D5.3): real 404s from the proxy, blocks in
// order, hidden blocks absent, SEO title, draft preview with the bar.

const SAME_ORIGIN = { origin: BASE_URL }

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
  await page.waitForURL((url) => url.pathname === "/admin")
}

type BuilderPageDto = {
  id: string
  version: number
  draft: { blocks: { id: string }[] }
}

const text = (id: string, anchor: string, words: string, hidden = false) => ({
  id,
  type: "richtext",
  anchor,
  hidden,
  data: {
    doc: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: words }] },
      ],
    },
  },
})

async function heroImage(page: Page): Promise<{ mediaId: string }> {
  const res = await page.request.get("/api/v1/admin/pages/about")
  expect(res.status()).toBe(200)
  const about = (await res.json()) as {
    draft: { hero: { image: { mediaId: string } } }
  }
  return about.draft.hero.image
}

async function createPage(
  page: Page,
  slug: string,
  blocks: unknown[]
): Promise<BuilderPageDto> {
  const created = await page.request.post("/api/v1/admin/builder-pages", {
    headers: SAME_ORIGIN,
    data: { title: `E2E ${slug}`, slug },
  })
  expect(created.status()).toBe(201)
  const dto = (await created.json()) as BuilderPageDto
  const saved = await page.request.put(
    `/api/v1/admin/builder-pages/${dto.id}/draft`,
    {
      headers: SAME_ORIGIN,
      data: { version: dto.version, draft: { blocks } },
    }
  )
  expect(saved.status()).toBe(200)
  return (await saved.json()) as BuilderPageDto
}

async function removePage(page: Page, id: string) {
  await page.request.delete(`/api/v1/admin/builder-pages/${id}`, {
    headers: SAME_ORIGIN,
  })
}

test("an unknown builder page is a real 404", async ({ page }) => {
  const res = await page.request.get("/p/no-such-page-e2e", {
    maxRedirects: 0,
  })
  expect(res.status()).toBe(404)
})

test("a published builder page renders visible blocks in order with its SEO title", async ({
  page,
}) => {
  await signIn(page, readFixtures().editor.email)
  const image = await heroImage(page)
  const dto = await createPage(page, "e2e-published", [
    {
      id: "e2e-hero",
      type: "hero.page",
      anchor: "hero-page",
      hidden: false,
      data: {
        image,
        crumb: "E2E",
        title: "Builder hero e2e",
        description: "A page made of blocks.",
      },
    },
    text("e2e-first", "first", "First block words"),
    text("e2e-hidden", "hidden", "Hidden block words", true),
    text("e2e-second", "second", "Second block words"),
  ])
  try {
    // Draft only: the public address is a real 404.
    const before = await page.request.get("/p/e2e-published", {
      maxRedirects: 0,
    })
    expect(before.status()).toBe(404)

    const published = await page.request.post(
      `/api/v1/admin/builder-pages/${dto.id}/publish`,
      { headers: SAME_ORIGIN, data: { version: dto.version } }
    )
    expect(published.status()).toBe(200)
    const seo = await page.request.put(
      `/api/v1/admin/seo/entries/builder/${dto.id}`,
      {
        headers: SAME_ORIGIN,
        data: { seo: { title: "Builder SEO title e2e" } },
      }
    )
    expect(seo.status()).toBe(200)

    const res = await page.goto("/p/e2e-published")
    expect(res?.status()).toBe(200)
    await expect(page).toHaveTitle("Builder SEO title e2e")
    await expect(
      page.getByRole("heading", { level: 1, name: "Builder hero e2e" })
    ).toBeVisible()
    await expect(page.getByText("Hidden block words")).toHaveCount(0)
    const order = await page
      .locator("main")
      .evaluate((main) =>
        ["Builder hero e2e", "First block words", "Second block words"].map(
          (t) => (main.textContent ?? "").indexOf(t)
        )
      )
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    await expect(page.locator("#first")).toContainText("First block words")
  } finally {
    await removePage(page, dto.id)
  }
  const after = await page.request.get("/p/e2e-published", { maxRedirects: 0 })
  expect(after.status()).toBe(404)
})

test("preview of an unpublished builder page shows the draft with the preview bar", async ({
  page,
}) => {
  await signIn(page, readFixtures().editor.email)
  const dto = await createPage(page, "e2e-draft", [
    text("e2e-draft-text", "draft-text", "Draft only words"),
  ])
  try {
    const res = await page.request.get("/p/e2e-draft", { maxRedirects: 0 })
    expect(res.status()).toBe(404)

    await page.goto(`/api/v1/admin/preview?entity=builder-page&id=${dto.id}`)
    await expect(page).toHaveURL(/\/p\/e2e-draft$/)
    await expect(page.getByText("Draft only words")).toBeVisible()
    await expect(page.getByRole("region", { name: "Preview" })).toBeVisible()
  } finally {
    await page.request.get("/api/v1/preview/exit")
    await removePage(page, dto.id)
  }
})
