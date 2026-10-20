import { expect, type Page, test } from "@playwright/test"

import type { ArticleDto, ArticleOptions } from "@/lib/schemas/api/articles"
import type { Paginated } from "@/lib/schemas/api/list"
import type { MediaItem } from "@/lib/schemas/api/media"

import { BASE_URL } from "./env"
import { clientIpFor, E2E_PASSWORD, greeting, readFixtures } from "./fixtures"

// Master 5.4: a scheduled article goes live on the server's own scheduler
// tick (60 s) and the cache is expired through the signed internal route.

test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(testInfo.title),
  })
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

test("a scheduled article goes live on the next scheduler tick", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000)
  const { editor } = readFixtures()
  await signIn(page, editor)
  const headers = { origin: BASE_URL }
  const options = (await (
    await page.request.get("/api/v1/admin/articles/options")
  ).json()) as ArticleOptions
  const images = (await (
    await page.request.get("/api/v1/admin/media?kind=image&pageSize=1")
  ).json()) as Paginated<MediaItem>
  const title = "Timed Patrol Update"
  const slug = "timed-patrol-update"
  const created = await page.request.post("/api/v1/admin/articles", {
    headers,
    data: {
      slug,
      categoryId: options.categories[0].id,
      draft: {
        title,
        excerpt: "Goes live by itself.",
        cover: { mediaId: images.items[0].id },
        lead: null,
        tags: [],
        body: null,
      },
    },
  })
  expect(created.status()).toBe(201)
  const article = (await created.json()) as ArticleDto
  const schedule = await page.request.post(
    `/api/v1/admin/articles/${article.id}/schedule`,
    {
      headers,
      data: {
        version: article.version,
        scheduledAt: new Date(Date.now() + 3_000).toISOString(),
      },
    }
  )
  expect(schedule.status()).toBe(200)
  expect(((await schedule.json()) as ArticleDto).status).toBe("scheduled")

  const context = await browser.newContext()
  const visitor = await context.newPage()
  // Not on the site yet (this also caches the article list without it)…
  await visitor.goto(`/blog/${slug}`)
  await expect(
    visitor.getByRole("heading", { level: 1, name: title })
  ).toHaveCount(0)
  // …until the scheduler publishes it and expires the cache.
  await expect(async () => {
    await visitor.goto(`/blog/${slug}`)
    await expect(
      visitor.getByRole("heading", { level: 1, name: title })
    ).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 180_000, intervals: [5_000] })
  await visitor.goto("/blog")
  await expect(
    visitor.getByRole("heading", { level: 3, name: title })
  ).toBeVisible()
  await context.close()

  const after = (await (
    await page.request.get(`/api/v1/admin/articles/${article.id}`)
  ).json()) as ArticleDto
  expect(after).toMatchObject({ status: "published", live: true })
})
