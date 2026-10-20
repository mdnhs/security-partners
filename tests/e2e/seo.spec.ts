import { expect, type Page, test } from "@playwright/test"

import { E2E_OWNER } from "./admin-accounts"
import { BASE_URL } from "./env"
import { clientIpFor, E2E_PASSWORD } from "./fixtures"

// Next's proxy adapter sends same-host Locations as relative URLs.
const absolute = (location: string | undefined) =>
  new URL(location ?? "", BASE_URL).href

async function signIn(page: Page, email: string) {
  await page.goto("/admin/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL((url) => url.pathname === "/admin")
}

const SAME_ORIGIN = { origin: BASE_URL }

test.describe("redirects (proxy)", () => {
  test.beforeEach(async ({ context }, testInfo) => {
    await context.setExtraHTTPHeaders({
      "x-forwarded-for": clientIpFor(testInfo.title),
    })
  })

  test("a manual redirect answers 301 and counts its hit", async ({ page }) => {
    await signIn(page, E2E_OWNER.email)
    const created = await page.request.post("/api/v1/admin/redirects", {
      headers: SAME_ORIGIN,
      data: {
        fromPath: "/old-alarms",
        toPath: "/services/alarm-responses",
        code: 301,
      },
    })
    expect(created.status()).toBe(201)
    const { id } = (await created.json()) as { id: string }
    try {
      const res = await page.request.get("/old-alarms?utm_source=e2e", {
        maxRedirects: 0,
      })
      expect(res.status()).toBe(301)
      expect(absolute(res.headers().location)).toBe(
        `${BASE_URL}/services/alarm-responses?utm_source=e2e`
      )
      await expect
        .poll(async () => {
          const list = await page.request.get(
            "/api/v1/admin/redirects?q=old-alarms"
          )
          return ((await list.json()) as { items: { hits: number }[] }).items[0]
            ?.hits
        })
        .toBe(1)
    } finally {
      await page.request.delete(`/api/v1/admin/redirects/${id}`, {
        headers: SAME_ORIGIN,
      })
    }
  })

  test("renaming a published service 301s the old address", async ({
    page,
  }) => {
    await signIn(page, E2E_OWNER.email)
    const find = async (slug: string) => {
      const res = await page.request.get(`/api/v1/admin/services?q=${slug}`)
      const { items } = (await res.json()) as {
        items: { id: string; slug: string; version: number }[]
      }
      return items.find((i) => i.slug === slug)!
    }
    const rename = async (from: string, to: string) => {
      const s = await find(from)
      const res = await page.request.patch(
        `/api/v1/admin/services/${s.id}/slug`,
        {
          headers: SAME_ORIGIN,
          data: { slug: to, version: s.version },
        }
      )
      expect(res.status()).toBe(200)
    }
    await rename("open-up-lock-ups", "open-up-and-lock-up")
    try {
      const old = await page.request.get("/services/open-up-lock-ups", {
        maxRedirects: 0,
      })
      expect(old.status()).toBe(301)
      expect(absolute(old.headers().location)).toBe(
        `${BASE_URL}/services/open-up-and-lock-up`
      )
      expect(
        (await page.request.get("/services/open-up-and-lock-up")).status()
      ).toBe(200)
    } finally {
      await rename("open-up-and-lock-up", "open-up-lock-ups")
    }
  })
})

test.describe("sitemap and robots", () => {
  test("sitemap.xml lists published URLs on the site origin", async ({
    request,
  }) => {
    const res = await request.get("/sitemap.xml")
    expect(res.status()).toBe(200)
    const xml = await res.text()
    expect(xml).toContain(`<loc>${BASE_URL}/</loc>`)
    expect(xml).toContain(`<loc>${BASE_URL}/services/alarm-responses</loc>`)
    expect(xml).toContain(`<loc>${BASE_URL}/blog/key-holding-explained</loc>`)
    expect(xml).toContain("<lastmod>")
    expect(xml).not.toContain("/admin")
  })

  test("robots.txt keeps crawlers out of /admin and /api", async ({
    request,
  }) => {
    const text = await (await request.get("/robots.txt")).text()
    expect(text).toContain("Disallow: /admin")
    expect(text).toContain("Disallow: /api")
    expect(text).toContain(`Sitemap: ${BASE_URL}/sitemap.xml`)
  })
})

// Phase 8: what search engines and social networks receive. Metadata is
// blocking (htmlLimitedBots), so it is in <head> for every client.

const headOf = (html: string) => html.slice(0, html.indexOf("</head>"))
const meta = (head: string, key: string) =>
  new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`).exec(
    head
  )?.[1] ?? null
const canonical = (head: string) =>
  /<link rel="canonical" href="([^"]*)"/.exec(head)?.[1] ?? null

test.describe("metadata in <head>", () => {
  test("home: title, description, canonical, Open Graph, Twitter", async ({
    request,
  }) => {
    const res = await request.get("/")
    expect(res.status()).toBe(200)
    const head = headOf(await res.text())
    expect(head).toContain(
      "<title>Security Partners Ltd. | Watching Over You</title>"
    )
    expect(meta(head, "description")).toMatch(/^Proactive, flexible/)
    // Next writes the site root as the bare origin (resolve-url.js: a "/"
    // pathname resolves to `origin`); same URL as `${BASE_URL}/`.
    expect(canonical(head)).toBe(BASE_URL)
    expect(meta(head, "og:type")).toBe("website")
    expect(meta(head, "og:image")).toBe(`${BASE_URL}/og/page/home`)
    expect(meta(head, "twitter:card")).toBe("summary_large_image")
  })

  test("service and article pages", async ({ request }) => {
    const service = headOf(
      await (await request.get("/services/alarm-responses")).text()
    )
    expect(canonical(service)).toBe(`${BASE_URL}/services/alarm-responses`)
    expect(meta(service, "og:image")).toBe(
      `${BASE_URL}/og/service/alarm-responses`
    )
    const article = headOf(
      await (await request.get("/blog/key-holding-explained")).text()
    )
    expect(meta(article, "og:type")).toBe("article")
    expect(meta(article, "article:published_time")).toMatch(
      /^\d{4}-\d{2}-\d{2}T/
    )
  })

  test("the 404 page has the default description and noindex", async ({
    request,
  }) => {
    const res = await request.get("/this-page-does-not-exist")
    expect(res.status()).toBe(404)
    const head = headOf(await res.text())
    expect(meta(head, "description")).toMatch(/^Proactive, flexible/)
    expect(head).toMatch(/<meta name="robots" content="noindex"/)
  })

  test("a browser also gets the description in document.head", async ({
    page,
  }) => {
    await page.goto("/about")
    await expect(page.locator('head meta[name="description"]')).toHaveCount(1)
    await expect(page.locator('body meta[name="description"]')).toHaveCount(0)
  })
})

const jsonLd = async (page: Page) =>
  (
    await page.locator('script[type="application/ld+json"]').allTextContents()
  ).flatMap((text) => {
    const value = JSON.parse(text) as unknown
    return Array.isArray(value) ? value : [value]
  }) as { "@type": string; [key: string]: unknown }[]

test.describe("structured data", () => {
  test("every page carries the business; articles add Article + breadcrumbs", async ({
    page,
  }) => {
    await page.goto("/")
    expect((await jsonLd(page)).map((d) => d["@type"])).toEqual([
      "LocalBusiness",
    ])
    await page.goto("/blog/key-holding-explained")
    const types = (await jsonLd(page)).map((d) => d["@type"]).sort()
    expect(types).toEqual(["Article", "BreadcrumbList", "LocalBusiness"])
    await page.goto("/services/alarm-responses")
    expect((await jsonLd(page)).map((d) => d["@type"]).sort()).toEqual([
      "BreadcrumbList",
      "LocalBusiness",
    ])
  })
})

test.describe("generated share cards", () => {
  test("a 1200×630 PNG per published page; unknown → 404", async ({
    request,
  }) => {
    const res = await request.get("/og/service/alarm-responses")
    expect(res.status()).toBe(200)
    expect(res.headers()["content-type"]).toBe("image/png")
    const png = await res.body()
    expect(png.readUInt32BE(16)).toBe(1200)
    expect(png.readUInt32BE(20)).toBe(630)
    expect((await request.get("/og/service/no-such-service")).status()).toBe(
      404
    )
    expect((await request.get("/og/nope/home")).status()).toBe(404)
    expect((await request.get("/og/service/Not_A-Slug")).status()).toBe(404)
    expect((await request.get("/og/page/no-such-page")).status()).toBe(404)
  })

  test("cards are cached briefly by clients and identical on repeat", async ({
    request,
  }) => {
    const first = await request.get("/og/page/home")
    expect(first.status()).toBe(200)
    expect(first.headers()["cache-control"]).toBe(
      "public, max-age=600, stale-while-revalidate=3600"
    )
    const second = await request.get("/og/page/home")
    expect(Buffer.compare(await first.body(), await second.body())).toBe(0)
  })
})
