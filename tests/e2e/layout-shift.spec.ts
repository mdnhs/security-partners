import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

import { expect, test, type Page } from "@playwright/test"

import { PUBLIC_URLS } from "../visual/urls"

// Cumulative Layout Shift of every public page, from the browser's own
// layout-shift entries (Chrome's definition; shifts within 500 ms of real
// input are ignored by the browser). Each page is opened, left to settle,
// then scrolled to the bottom and back in half-screen steps so lazy images
// and scroll-triggered reveals have happened. Every shift is recorded with
// the elements that moved and where they were before and after.
//
// CLS_OUT=<file> writes the full report as JSON.

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const

const VISIBLE = process.env.CLS_VISIBLE === "1"
/** CLS_VISIBLE=1 slows everything down so a person can watch. */
const PACE = VISIBLE ? 4 : 1

/** Good CLS is under 0.1 (web.dev); the site's own budget is stricter. */
const BUDGET = 0.02

type Shift = {
  t: number
  value: number
  sources: { node: string; from: number[]; to: number[] }[]
}
type Report = { settled: number; scrolled: number; shifts: Shift[] }

const OBSERVER = (visible: boolean) =>
  `
  (() => {
    const rect = (r) => [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]
    const describe = (n) => {
      const el = n && (n.nodeType === 1 ? n : n.parentElement)
      if (!el) return "?"
      const cls = String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || "")
        .split(/\\s+/).filter(Boolean).slice(0, 3).join(".")
      const data = [...el.attributes].filter((a) => a.name.startsWith("data-")).map((a) => a.name).slice(0, 2).join(",")
      const text = (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 28)
      return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (cls ? "." + cls : "") + (data ? "[" + data + "]" : "") + ' "' + text + '"'
    }
    window.__cls = { value: 0, shifts: [] }
    // CLS_VISIBLE=1: a score badge and a red flash on whatever moves (fixed
    // and pointer-less, so it cannot shift anything itself).
    const visible = %VISIBLE%
    let badge
    const showBadge = () => {
      if (!visible) return
      if (!badge) {
        badge = document.createElement("div")
        badge.style.cssText = "position:fixed;top:8px;right:8px;z-index:2147483647;pointer-events:none;font:700 15px/1 system-ui;padding:8px 12px;border-radius:8px;color:#fff;background:#15803d"
        document.documentElement.appendChild(badge)
      }
      badge.textContent = "CLS " + window.__cls.value.toFixed(4)
      badge.style.background = window.__cls.value > 0.1 ? "#b91c1c" : window.__cls.value > 0 ? "#b45309" : "#15803d"
    }
    const flash = (n) => {
      const el = n && (n.nodeType === 1 ? n : n.parentElement)
      if (!visible || !el) return
      const old = el.style.outline
      el.style.outline = "4px solid #ef4444"
      setTimeout(() => (el.style.outline = old), 1200)
    }
    addEventListener("DOMContentLoaded", showBadge)
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.hadRecentInput) continue
        window.__cls.value += e.value
        showBadge()
        for (const s of e.sources) flash(s.node)
        window.__cls.shifts.push({
          t: Math.round(e.startTime),
          value: Number(e.value.toFixed(5)),
          sources: e.sources.map((s) => ({ node: describe(s.node), from: rect(s.previousRect), to: rect(s.currentRect) })),
        })
      }
    }).observe({ type: "layout-shift", buffered: true })
  })()
`.replace("%VISIBLE%", String(visible))

const read = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __cls: { value: number; shifts: unknown[] } })
        .__cls
  )

async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => innerHeight)
  const total = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < total; y += height / 2) {
    await page.evaluate((top) => window.scrollTo(0, top), y)
    await page.waitForTimeout(110 * PACE)
  }
  await page.waitForTimeout(700)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(500)
}

/** Written as each test ends: a failing test restarts the worker. */
function record(key: string, report: Report) {
  const out = process.env.CLS_OUT
  if (!out) return
  mkdirSync(dirname(out), { recursive: true })
  const all = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {}
  all[key] = report
  writeFileSync(out, JSON.stringify(all, null, 2))
}

// Control: a zero everywhere is only worth something if the instrument sees
// a shift that is really there. Push the page down by 120 px after load.
test("the measurement sees a shift that is really there (control)", async ({
  page,
}) => {
  await page.addInitScript(OBSERVER(VISIBLE))
  await page.goto("/", { waitUntil: "load" })
  await page.waitForTimeout(800)
  expect((await read(page)).value).toBe(0)
  await page.evaluate(() => {
    const bar = document.createElement("div")
    bar.setAttribute("data-control", "")
    bar.style.cssText = "height:120px;background:#c00"
    document.body.prepend(bar)
  })
  await page.waitForTimeout(500)
  const after = await read(page)
  expect(after.value).toBeGreaterThan(0.05)
  // The report names what MOVED (the top strip and the page under the new
  // bar), with where it was and where it went: down by the bar's 120 px.
  const moved = JSON.stringify(after.shifts)
  expect(moved).toContain("24 Hour Number")
  expect(moved).toContain(",120,")
})

for (const viewport of VIEWPORTS) {
  test.describe(`layout shift, ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })
    test.setTimeout(VISIBLE ? 240_000 : 60_000)

    for (const url of PUBLIC_URLS) {
      test(url, async ({ page }) => {
        await page.addInitScript(OBSERVER(VISIBLE))
        await page.goto(url, { waitUntil: "load" })
        await page.waitForTimeout(1500 * (VISIBLE ? 2 : 1))
        const settled = (await read(page)).value
        await scrollThrough(page)
        const final = await read(page)
        record(`${viewport.name} ${url}`, {
          settled: Number(settled.toFixed(5)),
          scrolled: Number(final.value.toFixed(5)),
          shifts: final.shifts as Shift[],
        })
        expect(final.value, `${url} (${viewport.name})`).toBeLessThanOrEqual(
          BUDGET
        )
      })
    }
  })
}

// Moving between pages in the same tab (client-side navigation), the way a
// visitor does: the navbar and footer persist, the page between them swaps.
// The links are clicked from script, so the browser does not discount the
// shifts as caused by input.
for (const [viewport, slow] of VIEWPORTS.flatMap((v) => [
  [v, false] as const,
  [v, true] as const,
])) {
  test(`moving between pages, ${viewport.name}${slow ? ", slow server" : ""}`, async ({
    page,
  }) => {
    test.setTimeout(VISIBLE ? 240_000 : 90_000)
    await page.setViewportSize(viewport)
    if (slow) {
      // The next page's content arrives late (a cold cache, a busy server):
      // for 800 ms the page between navbar and footer is empty. The footer
      // must not climb up under the navbar and drop again.
      await page.route("**/*", async (route) => {
        if (route.request().headers()["rsc"] === "1")
          await new Promise((r) => setTimeout(r, 800))
        await route.continue()
      })
    }
    await page.addInitScript(OBSERVER(VISIBLE))
    await page.goto("/", { waitUntil: "load" })
    await page.waitForTimeout(1200 * PACE)
    for (const href of [
      "/about",
      "/services",
      "/team",
      "/blog",
      "/contact",
      "/services/event-security",
      "/",
    ]) {
      // The desktop navbar link, or the logo for home; on mobile the
      // desktop nav is hidden, so click the link element directly.
      await page.evaluate((to) => {
        const link =
          document.querySelector<HTMLAnchorElement>(`header a[href="${to}"]`) ??
          document.querySelector<HTMLAnchorElement>(`a[href="${to}"]`)
        link!.click()
      }, href)
      await page.waitForURL((url) => url.pathname === href)
      await page.waitForTimeout(1300 * PACE)
      await scrollThrough(page)
    }
    const final = await read(page)
    record(`${viewport.name} soft navigation${slow ? " (slow)" : ""}`, {
      settled: 0,
      scrolled: Number(final.value.toFixed(5)),
      shifts: final.shifts as Shift[],
    })
    expect(
      final.value,
      `soft navigation (${viewport.name}${slow ? ", slow" : ""})`
    ).toBeLessThanOrEqual(BUDGET)
  })
}
