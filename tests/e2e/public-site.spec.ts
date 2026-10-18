import { expect, test } from "@playwright/test"

// Public site served from the seeded sp_e2e database (tests/e2e/seed.ts).

test.describe("public site from the database", () => {
  for (const path of ["/services/no-such-service", "/blog/no-such-article"]) {
    test(`unknown slug ${path} is a real 404`, async ({ page }) => {
      // proxy.ts checks the slug before the page streams (phase 8).
      const response = await page.goto(path)
      expect(response?.status()).toBe(404)
      await expect(
        page.getByRole("heading", { name: "This page could not be found." })
      ).toBeVisible()
      await expect(
        page.locator('meta[name="robots"][content*="noindex"]')
      ).not.toHaveCount(0)
    })
  }

  test("an unmatched URL is a real 404", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist")
    expect(response?.status()).toBe(404)
  })

  for (const [path, title] of [
    ["/privacy", "Privacy Policy"],
    ["/terms", "Terms of Use"],
  ] as const) {
    test(`${path} renders with the site's PageHero`, async ({ page }) => {
      const response = await page.goto(path)
      expect(response?.status()).toBe(200)
      await expect(page.locator("[data-hero] h1")).toHaveText(title)
      await expect(
        page.getByRole("navigation", { name: "Breadcrumb" })
      ).toBeVisible()
      await expect(page.locator("article h2").first()).toBeVisible()
      await expect(page).toHaveTitle(`${title} | Security Partners Ltd.`)
    })
  }

  test("footer legal links point at /privacy and /terms", async ({ page }) => {
    await page.goto("/")
    const footer = page.locator("footer")
    await expect(
      footer.getByRole("link", { name: "Privacy Policy" })
    ).toHaveAttribute("href", "/privacy")
    await expect(footer.getByRole("link", { name: "Terms" })).toHaveAttribute(
      "href",
      "/terms"
    )
  })
})

test.describe("GSAP motion still initialises on DB-rendered markup", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } })

  for (const path of ["/", "/services/alarm-responses"]) {
    test(`motion on ${path}`, async ({ page }) => {
      const errors: string[] = []
      page.on("pageerror", (err) => errors.push(err.message))
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text())
      })
      await page.goto(path)
      await expect(page.locator("html")).toHaveClass(/\bjs\b/)
      // CSS hides hero pieces until GSAP's intro reveals them.
      await expect(page.locator("[data-hero-title]")).toBeVisible()
      await expect(page.locator("[data-hero-item]").first()).toHaveCSS(
        "opacity",
        "1"
      )
      if (path === "/")
        // the 18+ counter animates from 0 to its final value
        await expect(page.locator("[data-count]")).toHaveText("18+", {
          timeout: 10_000,
        })
      expect(errors).toEqual([])
    })
  }
})
