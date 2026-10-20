import { chromium, expect, test } from "@playwright/test"

import { BASE_URL } from "./env"

// Master 8.1 acceptance: Lighthouse SEO 100 on the home page. Lighthouse
// drives Playwright's Chromium through chrome-launcher.
//
// Lighthouse 13 no longer identifies itself as a bot, so its score relies on
// proxy.ts marking every public document request for blocking metadata
// (lib/seo/blocking-metadata.ts): title, description and canonical must be
// in <head> for any user agent, not only for known crawlers.

const LIGHTHOUSE_LIKE_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"

test("home page metadata is in <head> for a browser user agent", async ({
  request,
}) => {
  const res = await request.get("/", {
    headers: { "user-agent": LIGHTHOUSE_LIKE_UA },
  })
  expect(res.status()).toBe(200)
  const html = await res.text()
  const head = html.slice(0, html.indexOf("</head>"))
  expect(head).toMatch(/<title>[^<]+<\/title>/)
  expect(head).toMatch(/<meta name="description" content="[^"]+"/)
  expect(head).toMatch(/<link rel="canonical" href="[^"]+"/)
})

test("Lighthouse SEO score is 100 on the home page", async () => {
  test.setTimeout(180_000)
  const { default: lighthouse } = await import("lighthouse")
  const chromeLauncher = await import("chrome-launcher")
  const chrome = await chromeLauncher.launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ["--headless=new", "--no-sandbox"],
  })
  try {
    const result = await lighthouse(`${BASE_URL}/`, {
      port: chrome.port,
      onlyCategories: ["seo"],
      output: "json",
      logLevel: "error",
    })
    const lhr = result!.lhr
    const weighted = new Set(
      lhr.categories.seo.auditRefs
        .filter((ref) => ref.weight > 0)
        .map((ref) => ref.id)
    )
    const failing = Object.values(lhr.audits)
      .filter((a) => weighted.has(a.id) && a.score !== null && a.score < 1)
      .map((a) => `${a.id}: ${a.title}`)
    expect(failing).toEqual([])
    expect(lhr.categories.seo.score).toBe(1)
  } finally {
    await chrome.kill()
  }
})
