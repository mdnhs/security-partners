import type { Page } from "@playwright/test"

// The site's GSAP + Lenis code honours prefers-reduced-motion, which leaves every
// element in its final state. We also wait for fonts and lazy images so screenshots
// are deterministic.
export async function freezeMotion(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.addStyleTag({
    content: `*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}`,
  })
  await page.evaluate(async () => {
    await document.fonts.ready
    const imgs = Array.from(document.images)
    for (const img of imgs) img.loading = "eager"
    await Promise.all(
      imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.onload = img.onerror = () => r(null) }))),
    )
  })
}
