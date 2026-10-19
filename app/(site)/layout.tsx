import type { Metadata } from "next"
import { Geist_Mono, Lato } from "next/font/google"
import { unstable_rethrow } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"

import "../globals.css"
import { AttributionCapture } from "@/components/attribution-capture"
import { SmoothScroll } from "@/components/motion/smooth-scroll"
import { PreviewBar } from "@/components/preview-bar"
import { SiteExtras } from "@/components/site-extras"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import { publicOrigin } from "@/server/lib/site-origin"
import { loadSiteSources } from "@/server/modules/pages/sources"
import { DEFAULT_FAVICON, siteMetadata } from "@/templates/shared/page-meta"

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

/**
 * Site-wide metadata (metadataBase, default description for the 404 page).
 * Never fails the page: with the database down the page's own boundary
 * (error.tsx) reports it, so this returns nothing instead of throwing.
 */
export async function generateMetadata(): Promise<Metadata> {
  await connection()
  try {
    const s = await loadSiteSources()
    return siteMetadata(s, publicOrigin(s.settings.site.productionUrl))
  } catch (error) {
    unstable_rethrow(error)
    return { icons: { icon: DEFAULT_FAVICON } }
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Title and description come from each page's generateMetadata (DB).
  // lang is part of the static shell; SiteLocale applies settings.site.locale.
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        lato.variable
      )}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
      </head>
      <body>
        <SmoothScroll />
        {/* First-touch lead attribution; renders nothing. */}
        <AttributionCapture />
        <ThemeProvider>{children}</ThemeProvider>
        {/* Draft-mode only (admins); renders nothing for visitors. */}
        <Suspense fallback={null}>
          <PreviewBar />
        </Suspense>
        {/* JSON-LD (and, when tracking is on, the consent banner). */}
        <Suspense fallback={null}>
          <SiteExtras />
        </Suspense>
      </body>
    </html>
  )
}
