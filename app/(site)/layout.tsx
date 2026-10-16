import { Geist_Mono, Lato } from "next/font/google"
import { Suspense } from "react"

import "../globals.css"
import { SmoothScroll } from "@/components/motion/smooth-scroll"
import { PreviewBar } from "@/components/preview-bar"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

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
        <ThemeProvider>{children}</ThemeProvider>
        {/* Draft-mode only (admins); renders nothing for visitors. */}
        <Suspense fallback={null}>
          <PreviewBar />
        </Suspense>
      </body>
    </html>
  )
}
