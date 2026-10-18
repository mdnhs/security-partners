import { type Browser, expect, type Page, test } from "@playwright/test"
import sharp from "sharp"

import { clientIpFor, E2E_PASSWORD, greeting, readFixtures } from "./fixtures"

// Master 6.3: upload in the library → pick it as the home hero in the page
// editor → publish → the public page renders the new image (served
// same-origin by /api/v1/media/file and optimised by next/image). Before
// that, an image over 10 MB is uploaded from the picker itself: `next
// start` takes it through the /api body limit (20 MB), never the proxy's
// 10 MB buffer (the proxy matches /admin only). The tests run in order:
// the second one replaces the first one's hero draft and publishes.

const MB = 1024 * 1024

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

async function openHomeHero(page: Page) {
  await page.goto("/admin/pages/home")
  await expect(
    page.getByRole("heading", { level: 1, name: "Home" })
  ).toBeVisible()
  const tab = page
    .getByRole("tablist", { name: "Sections" })
    .getByRole("tab", { name: "Hero" })
  await tab.click()
  await expect(tab).toHaveAttribute("aria-selected", "true")
  return page.getByRole("region", { name: "Hero" })
}

/** Clicks "Use this image" and waits for the autosaved draft. */
async function useAndSave(page: Page, picker: ReturnType<Page["getByRole"]>) {
  const saved = page.waitForResponse(
    (r) =>
      r.request().method() === "PUT" &&
      r.url().endsWith("/api/v1/admin/pages/home/draft"),
    { timeout: 15_000 }
  )
  await picker.getByRole("button", { name: "Use this image" }).click()
  await expect(picker).toBeHidden()
  expect((await saved).status()).toBe(200)
  await expect(page.getByRole("status", { name: /^Save status/ })).toHaveText(
    "Saved",
    { timeout: 10_000 }
  )
}

/** Incompressible pixels (a fixed LCG), so the PNG stays as large as its raw data. */
async function noisePng(width: number, height: number) {
  const raw = Buffer.alloc(width * height * 3)
  let seed = 0x2f6e2b1
  for (let i = 0; i < raw.length; i++) {
    seed = (Math.imul(seed, 1_103_515_245) + 12_345) >>> 0
    raw[i] = seed >>> 24
  }
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .png({ compressionLevel: 0 })
    .toBuffer()
}

async function publicHero(browser: Browser) {
  const visitor = await browser.newContext()
  const page = await visitor.newPage()
  await page.goto("/")
  const img = page.locator("[data-hero-media] img")
  await expect(img).toBeVisible()
  const src = await img.getAttribute("src")
  const loaded = await img.evaluate(async (el: HTMLImageElement) => {
    await el.decode().catch(() => undefined)
    return el.naturalWidth
  })
  await visitor.close()
  return { src: src ?? "", loaded }
}

test("the page editor's picker uploads an image over 10 MB and selects it", async ({
  page,
}) => {
  test.setTimeout(120_000)
  const big = await noisePng(2700, 1500)
  expect(big.byteLength).toBeGreaterThan(10 * MB)
  expect(big.byteLength).toBeLessThan(20 * MB)

  await signIn(page, readFixtures().editor)
  const hero = await openHomeHero(page)
  await hero.getByRole("button", { name: "Change image: Background image" }).click()
  const picker = page.getByRole("dialog", { name: "Choose: Background image" })
  await expect(
    picker.getByRole("button", { name: "Upload new image" })
  ).toBeVisible()

  const upload = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      r.url().endsWith("/api/v1/admin/media/upload"),
    { timeout: 90_000 }
  )
  await picker.locator("[data-upload-input]").setInputFiles({
    name: "e2e-large-noise.png",
    mimeType: "image/png",
    buffer: big,
  })
  const response = await upload
  expect(response.status()).toBe(201)
  const item = (await response.json()) as {
    id: string
    url: string
    size: number
    width: number
    originalName: string
  }
  expect(item).toMatchObject({
    width: 2700,
    originalName: "e2e-large-noise.png",
  })
  expect(item.size).toBeGreaterThan(10 * MB)

  // Selected in the grid, announced politely, ready to use.
  await expect(
    picker.getByRole("status", { name: "Upload progress" })
  ).toHaveText("e2e-large-noise.png uploaded and selected.")
  await expect(
    picker.getByRole("button", { name: "e2e-large-noise.png", pressed: true })
  ).toBeVisible()
  await useAndSave(page, picker)
  const draft = (await (
    await page.request.get("/api/v1/admin/pages/home")
  ).json()) as { draft: { hero: { backgroundImage: { mediaId: string } } } }
  expect(draft.draft.hero.backgroundImage.mediaId).toBe(item.id)
})

test("library upload → hero image in the page editor → publish → public home", async ({
  page,
  browser,
}) => {
  await signIn(page, readFixtures().editor)

  // 1. Upload in the library.
  await page.goto("/admin/media")
  await expect(
    page.getByRole("heading", { level: 1, name: "Media" })
  ).toBeVisible()
  const png = await sharp({
    create: { width: 1600, height: 900, channels: 3, background: "#1f6f43" },
  })
    .png()
    .toBuffer()
  await page
    .locator("[data-upload-input]")
    .setInputFiles({ name: "e2e-hero.png", mimeType: "image/png", buffer: png })
  const details = page.getByRole("dialog", { name: "e2e-hero.png" })
  await expect(details).toBeVisible()
  await details.getByLabel("Alternative text").fill("E2E hero upload")
  await details.getByRole("button", { name: "Save details" }).click()
  await expect(page.getByText("File details saved.")).toBeVisible()
  const fileUrl = await details
    .getByRole("link", { name: /^Open file/ })
    .getAttribute("href")
  expect(fileUrl).toMatch(
    /^\/api\/v1\/media\/file\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/
  )
  const file = await page.request.get(fileUrl!)
  expect(file.status()).toBe(200)
  expect(file.headers()["cache-control"]).toBe(
    "public, max-age=31536000, immutable"
  )
  await page.keyboard.press("Escape")
  await expect(details).toBeHidden()

  // 2. Pick it as the home hero.
  const hero = await openHomeHero(page)
  await hero.getByRole("button", { name: "Change image: Background image" }).click()
  const picker = page.getByRole("dialog", { name: "Choose: Background image" })
  await picker
    .getByRole("searchbox", { name: "Search images" })
    .fill("e2e-hero")
  await picker.getByRole("button", { name: "E2E hero upload" }).click()
  await useAndSave(page, picker)

  // 3. Publish.
  await page.getByRole("button", { name: "Publish", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Publish changes?" })
  await expect(dialog.getByRole("list", { name: "Changes" })).toContainText(
    "Background image"
  )
  await dialog.getByRole("button", { name: "Publish now" }).click()
  await expect(dialog).toBeHidden()

  // 4. The public page uses the new image through the default optimizer.
  const { src, loaded } = await publicHero(browser)
  expect(src).toContain(encodeURIComponent(fileUrl!))
  expect(src.startsWith("/_next/image?url=")).toBe(true)
  expect(loaded).toBeGreaterThan(0)
})
