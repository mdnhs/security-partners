import { readFileSync } from "node:fs"

import { expect, type Page, test } from "@playwright/test"

import { BASE_URL } from "./env"
import { clientIpFor, E2E_PASSWORD, greeting, readFixtures } from "./fixtures"

// Animated logo (settings.site.logoAnimation): upload the fixture Lottie,
// set it on the site settings and publish, then the public header and
// footer draw it on a canvas in the logo box (the image stays for its alt
// text). With reduced motion the player never loads. The setting is
// cleared again at the end so other specs see the static logo.

const LOGO = readFileSync("tests/fixtures/lottie/logo.json")
const API = { origin: BASE_URL }

test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": clientIpFor(testInfo.title),
  })
})

async function signIn(page: Page) {
  const who = readFixtures().editor
  await page.goto("/admin/sign-in")
  await page.getByLabel("Email").fill(who.email)
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(
    page.getByRole("heading", { name: greeting(who.name) })
  ).toBeVisible()
}

async function publishSite(page: Page, logoAnimation: unknown) {
  const current = (await (
    await page.request.get("/api/v1/admin/settings/site")
  ).json()) as { draft: Record<string, unknown>; version: number }
  const saved = await page.request.put("/api/v1/admin/settings/site/draft", {
    headers: API,
    data: {
      draft: { ...current.draft, logoAnimation },
      version: current.version,
    },
  })
  expect(saved.status()).toBe(200)
  const { version } = (await saved.json()) as { version: number }
  const published = await page.request.post(
    "/api/v1/admin/settings/site/publish",
    { headers: API, data: { version } }
  )
  expect(published.status()).toBe(200)
}

test("animated logo plays in the public header and footer", async ({
  page,
  browser,
}) => {
  await signIn(page)
  const upload = await page.request.post("/api/v1/admin/media/upload", {
    headers: API,
    multipart: {
      file: {
        name: "e2e-logo.json",
        mimeType: "application/json",
        buffer: LOGO,
      },
    },
  })
  expect(upload.status()).toBe(201)
  const item = (await upload.json()) as { id: string; mime: string }
  expect(item.mime).toBe("video/lottie+json")
  await publishSite(page, { mediaId: item.id })

  try {
    const visitor = await browser.newContext({ reducedMotion: "no-preference" })
    const site = await visitor.newPage()
    const errors: string[] = []
    site.on("pageerror", (e) => errors.push(e.message))
    const wasm = site.waitForResponse((r) =>
      r.url().endsWith("/vendor/dotlottie-web/0.80.0/dotlottie-player.wasm")
    )
    await site.goto("/")
    expect((await wasm).status()).toBe(200)
    for (const box of [
      site.locator("header a:has(img)").first(),
      site.locator("footer div.relative:has(> img)").first(),
    ]) {
      const canvas = box.locator("canvas[data-logo-animation]")
      await expect(canvas).toHaveAttribute("aria-hidden", "true")
      await expect(canvas).toHaveCSS("opacity", "1", { timeout: 15_000 })
      const img = box.locator("> img")
      await expect(img).toHaveAttribute("alt", "Security Partners Ltd.")
      await expect(img).toHaveCSS("opacity", "0")
      // Same box: the canvas covers exactly the image's area.
      const [c, i] = await Promise.all([
        canvas.boundingBox(),
        img.boundingBox(),
      ])
      expect(c).toEqual(i)
    }
    expect(errors).toEqual([])
    await visitor.close()

    const still = await browser.newContext({ reducedMotion: "reduce" })
    const calm = await still.newPage()
    let playerRequested = false
    calm.on("request", (r) => {
      if (r.url().includes("dotlottie-player.wasm")) playerRequested = true
    })
    await calm.goto("/")
    await expect(calm.locator("header img").first()).toBeVisible()
    await calm.waitForTimeout(1_000)
    await expect(calm.locator("canvas[data-logo-animation]")).toHaveCount(0)
    expect(playerRequested).toBe(false)
    await still.close()
  } finally {
    await publishSite(page, null)
  }
})
