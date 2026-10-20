import type { Metadata } from "next"
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google"

import "./admin.css"
import { AdminThemeProvider } from "@/components/admin/theme-provider"
import { cn } from "@/lib/utils"

// MK's admin face; admin.css maps --font-sans to it.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Admin · Security Partners",
    template: "%s · Security Partners admin",
  },
  robots: { index: false, follow: false },
  // The bundled icon (public/favicon.ico); the public site's root layout
  // uses settings.site.favicon when set.
  icons: { icon: "/favicon.ico" },
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
