import { expect, test } from "@playwright/test"

import { deleteLeadsFrom } from "./lead-cleanup"

const VISITOR = "visitor@example.ie"

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

  test("the contact form posts to the leads API and shows the success copy", async ({
    page,
    request,
  }) => {
    try {
      // No Turnstile site key in the e2e seed: no external script may load.
      const external: string[] = []
      await page.route("https://challenges.cloudflare.com/**", (route) => {
        external.push(route.request().url())
        return route.abort()
      })
      await page.goto("/contact")
      const status = page.locator('form p[role="status"]')
      await expect(status).toHaveClass("sr-only")
      await expect(status).toHaveText("")

      await page.getByLabel("Your Name").fill("E2E Visitor")
      await page.getByLabel("Email").fill(VISITOR)
      await page.getByLabel("Message").fill("Need a quote for two sites")
      const posted = page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/v1/public/leads") &&
          r.request().method() === "POST"
      )
      await page.getByRole("button", { name: "Send Message" }).click()
      expect((await posted).status()).toBe(200)
      await expect(
        page.getByText(
          "Thank you, your message has been sent. We will be in touch shortly."
        )
      ).toBeVisible()
      await expect(page.getByLabel("Your Name")).toHaveValue("")
      expect(external).toEqual([])
    } finally {
      // The real lead would show in the admin sidebar's badge, which the
      // visual suite (same server, same run) expects hidden.
      await deleteLeadsFrom(request, VISITOR)
    }
  })

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
