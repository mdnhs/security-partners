import { cache, Suspense } from "react"
import { unstable_rethrow } from "next/navigation"
import { connection } from "next/server"

import { SiteFooter } from "@/components/home/site-footer"
import { SiteHeader } from "@/components/home/site-header"
import { SiteLocale } from "@/components/site-locale"
import { SiteThemeStyle } from "@/components/site-theme-style"
import { loadChromeSources } from "@/server/modules/pages/sources"
import { type ChromeView, chromeView } from "@/templates/shared/views"

/**
 * The navbar and footer, rendered once by the public layout around every
 * page, so moving between pages only swaps what is between them: they are
 * not remounted, and nothing blank shows in their place. Each is its own
 * Suspense boundary beside the page, never around it (a boundary around the
 * page's content turns notFound() into a streamed soft 404, see
 * components/site-themed.tsx), with the brand overrides in the same boundary
 * so neither paints before the theme.
 */

// One load per request for both slots (React's per-request cache).
const loadChrome = cache(async (): Promise<ChromeView> =>
  chromeView(await loadChromeSources())
)

/**
 * Fails closed: when the settings cannot be read (the database is down) the
 * slot renders nothing, and the page's own error screen is what the visitor
 * sees, as before. Framework control-flow errors (notFound, redirect,
 * prerender bail-outs) are rethrown.
 */
async function chromeOrNull(): Promise<ChromeView | null> {
  await connection()
  try {
    return await loadChrome()
  } catch (error) {
    unstable_rethrow(error)
    console.error("[site chrome] navbar and footer unavailable", error)
    return null
  }
}

async function Header() {
  const chrome = await chromeOrNull()
  if (!chrome) return null
  return (
    <>
      <SiteHeader {...chrome.header} />
      {/* settings.site.locale onto <html lang>; once per page load. */}
      <SiteLocale lang={chrome.locale} />
    </>
  )
}

async function Footer() {
  const chrome = await chromeOrNull()
  if (!chrome) return null
  return <SiteFooter {...chrome.footer} />
}

export function SiteHeaderSlot() {
  return (
    <Suspense fallback={null}>
      <SiteThemeStyle id="site-theme-header" />
      <Header />
    </Suspense>
  )
}

export function SiteFooterSlot() {
  return (
    <Suspense fallback={null}>
      <SiteThemeStyle id="site-theme-footer" />
      <Footer />
    </Suspense>
  )
}
