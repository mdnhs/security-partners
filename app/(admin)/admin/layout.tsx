import type { Metadata } from "next"
import localFont from "next/font/local"
import { unstable_rethrow } from "next/navigation"
import { connection } from "next/server"

import "./admin.css"
import { AdminThemeProvider } from "@/components/admin/theme-provider"
import { cn } from "@/lib/utils"
import { resolveMedia } from "@/server/modules/media/queries"
import { getPublishedSettings } from "@/server/modules/settings/queries"
import { DEFAULT_FAVICON } from "@/templates/shared/page-meta"

// MK's admin face; admin.css maps --font-sans to it.
// Fonts live in assets/fonts (latin subset, SIL OFL): the build needs no network.
const jakarta = localFont({
  src: [
    {
      path: "../../../assets/fonts/plus-jakarta-sans-latin-400-normal.woff2",
      weight: "400",
    },
    {
      path: "../../../assets/fonts/plus-jakarta-sans-latin-500-normal.woff2",
      weight: "500",
    },
    {
      path: "../../../assets/fonts/plus-jakarta-sans-latin-600-normal.woff2",
      weight: "600",
    },
    {
      path: "../../../assets/fonts/plus-jakarta-sans-latin-700-normal.woff2",
      weight: "700",
    },
  ],
  variable: "--font-jakarta",
  display: "swap",
})

const fontMono = localFont({
  src: "../../../assets/fonts/geist-mono-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-geist-mono",
  display: "swap",
})

const BASE_METADATA: Metadata = {
  title: {
    default: "Admin · Security Partners",
    template: "%s · Security Partners admin",
  },
  robots: { index: false, follow: false },
}

/**
 * The tab icon is the site's favicon (settings.site.favicon, as on the public
 * site), else the bundled public/favicon.ico. Never fails the page: with the
 * database down the bundled icon is used.
 */
export async function generateMetadata(): Promise<Metadata> {
  await connection()
  try {
    const site = await getPublishedSettings("site")
    const { favicon } = await resolveMedia({ favicon: site?.favicon ?? null })
    return {
      ...BASE_METADATA,
      icons: { icon: favicon?.url ?? DEFAULT_FAVICON },
    }
  } catch (error) {
    unstable_rethrow(error)
    return { ...BASE_METADATA, icons: { icon: DEFAULT_FAVICON } }
  }
}

/**
 * Root layout for /admin (separate from the public site's). admin.css is
 * the admin's own Tailwind entry (it does not import the public
 * globals.css); its tokens are all under html[data-admin].
 */
export default function AdminRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-IE"
      data-admin=""
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        jakarta.variable
      )}
    >
      <body className="min-h-svh bg-background text-foreground">
        {/* The published theme is applied per segment (AdminThemed), in the
            same Suspense boundary as the content it styles. */}
        <AdminThemeProvider>{children}</AdminThemeProvider>
      </body>
    </html>
  )
}
