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
